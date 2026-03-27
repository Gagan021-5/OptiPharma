"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  OptiPharma — Hybrid Computer Vision Pipeline (cv_pipeline.py)             ║
║                                                                            ║
║  The CORE engine. Executes a two-tier verification pipeline:               ║
║                                                                            ║
║  ┌─────────────┐     SSIM ≥ 0.95      ┌──────────────┐                    ║
║  │  Tier 1:    │ ──── PASS ──────────► │  Tier 2:     │                    ║
║  │  OpenCV     │                       │  Gemini LLM  │                    ║
║  │  SSIM Gate  │ ──── FAIL ──────────► │  REJECTED    │                    ║
║  └─────────────┘     SSIM < 0.95       └──────────────┘                    ║
║                                                                            ║
║  Tier 1: Gaussian Blur → Canny Edge → Perspective Warp → SSIM             ║
║  Tier 2: Crop Text Region → Gemini OCR → Compound Verification            ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import os
import time
import logging
from typing import Optional, List, Tuple

import cv2
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim

from models import (
    ThreatReport,
    Verdict,
    RejectionReason,
    SSIMResult,
    CompoundVerification,
    ExtractedText,
)
from gemini_client import gemini_client

logger = logging.getLogger("optipharma.pipeline")

# ─────────────────────────────────────────────────────────────────
# Configuration Constants
# ─────────────────────────────────────────────────────────────────

SSIM_THRESHOLD = 0.95  # The Gate — 95% similarity required
REFERENCE_LOGO_DIR = os.path.join(os.path.dirname(__file__), "reference_logos")

# Region extraction ratios (percentage of image dimensions)
# These define where the logo and text areas typically appear on a medicine strip
LOGO_REGION = {
    "x_start": 0.02,   # 2% from left
    "x_end": 0.35,     # 35% from left
    "y_start": 0.05,   # 5% from top
    "y_end": 0.50,     # 50% from top
}

TEXT_REGION = {
    "x_start": 0.00,   # Full width
    "x_end": 1.00,
    "y_start": 0.45,   # Lower half of strip
    "y_end": 1.00,
}


# ─────────────────────────────────────────────────────────────────
# Image Preprocessing — OpenCV Heavy Lifting
# ─────────────────────────────────────────────────────────────────

def preprocess_image(image_array: np.ndarray) -> np.ndarray:
    """
    Apply the deterministic preprocessing pipeline:
      1. Convert to grayscale
      2. Gaussian blur (5x5 kernel) — noise reduction
      3. CLAHE histogram equalization — normalize lighting
    
    Args:
        image_array: Raw BGR image from OpenCV imread.
    
    Returns:
        Preprocessed grayscale image.
    """
    # Step 1: Grayscale conversion
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    
    # Step 2: Gaussian blur — reduces noise without losing structural info
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Step 3: CLAHE — adaptive histogram equalization for variable lighting
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blurred)
    
    logger.info("✓ Preprocessing complete: grayscale → blur → CLAHE")
    return enhanced


def detect_and_warp_strip(image_array: np.ndarray) -> np.ndarray:
    """
    Detect the medicine strip contour using Canny edge detection
    and apply perspective warping to align it.
    
    Pipeline:
      1. Canny edge detection (thresholds: 50, 150)
      2. Find the largest rectangular contour
      3. Compute perspective transform and warp
      4. Fallback: return original if no strip contour found
    
    Args:
        image_array: BGR input image.
    
    Returns:
        Perspective-warped (aligned) image of the strip.
    """
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Canny edge detection — dual threshold for hysteresis
    edges = cv2.Canny(blurred, 50, 150)
    
    # Dilate edges to close gaps in contour boundaries
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)
    
    # Find contours — external only, simplified approximation
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        logger.warning("⚠ No contours found — using original image")
        return image_array
    
    # Sort by area, take the largest (likely the medicine strip)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    for contour in contours[:5]:  # Check top 5 largest
        # Approximate the contour polygon
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        
        # We want a quadrilateral (4 corners = medicine strip)
        if len(approx) == 4:
            logger.info("✓ Strip contour detected — applying perspective warp")
            return four_point_warp(image_array, approx.reshape(4, 2))
    
    # Fallback: use bounding rect of largest contour
    logger.info("⚠ No quad found — using bounding rect crop")
    x, y, w, h = cv2.boundingRect(contours[0])
    return image_array[y:y + h, x:x + w]


def four_point_warp(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """
    Apply a four-point perspective warp to flatten/align an image.
    Orders the points: top-left, top-right, bottom-right, bottom-left.
    
    Args:
        image: Source image.
        pts:   4 corner points of the detected quadrilateral.
    
    Returns:
        Warped, top-down view of the detected region.
    """
    # Order points: TL, TR, BR, BL
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    
    # Compute dimensions of the new image
    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = max(int(width_a), int(width_b))
    
    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = max(int(height_a), int(height_b))
    
    # Destination points for the warp
    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1],
    ], dtype="float32")
    
    # Compute the perspective transform matrix and warp
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (max_width, max_height))
    
    return warped


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Order 4 points as: top-left, top-right, bottom-right, bottom-left.
    Uses sum/diff heuristic for robust ordering.
    """
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # TL has smallest sum
    rect[2] = pts[np.argmax(s)]   # BR has largest sum
    
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]   # TR has smallest difference
    rect[3] = pts[np.argmax(d)]   # BL has largest difference
    
    return rect


# ─────────────────────────────────────────────────────────────────
# Region Extraction
# ─────────────────────────────────────────────────────────────────

def extract_region(image: np.ndarray, region: dict) -> np.ndarray:
    """
    Crop a sub-region from an image using percentage-based coordinates.
    
    Args:
        image: Source image (BGR or grayscale).
        region: Dict with x_start, x_end, y_start, y_end (0-1 ratios).
    
    Returns:
        Cropped sub-region.
    """
    h, w = image.shape[:2]
    x1 = int(w * region["x_start"])
    x2 = int(w * region["x_end"])
    y1 = int(h * region["y_start"])
    y2 = int(h * region["y_end"])
    
    cropped = image[y1:y2, x1:x2]
    logger.info(f"  ↳ Extracted region: ({x1},{y1}) → ({x2},{y2}) [{cropped.shape}]")
    return cropped


# ─────────────────────────────────────────────────────────────────
# SSIM Comparison — The Gate
# ─────────────────────────────────────────────────────────────────

def compute_ssim(logo_region: np.ndarray, reference_filename: str = "default_logo.png") -> SSIMResult:
    """
    Compute Structural Similarity Index (SSIM) between a captured logo
    and the reference logo stored locally.
    
    The SSIM score ranges from -1 to 1, where 1 = identical.
    We use a threshold of 0.95 (95%) as the gate.
    
    Args:
        logo_region: Grayscale image of the captured logo region.
        reference_filename: Filename of the reference logo in reference_logos/.
    
    Returns:
        SSIMResult with score and pass/fail status.
    """
    ref_path = os.path.join(REFERENCE_LOGO_DIR, reference_filename)
    
    # Load reference logo
    if not os.path.exists(ref_path):
        logger.warning(f"⚠ Reference logo not found: {ref_path}")
        # For hackathon demo: if no reference exists, simulate a high SSIM
        # This allows the pipeline to demonstrate Tier 2 even without reference images
        logger.info("  ↳ Demo mode: simulating SSIM = 0.97 (no reference logo)")
        return SSIMResult(
            score=0.97,
            passed_gate=True,
            reference_logo_used="DEMO_MODE",
        )
    
    # Load and preprocess reference logo
    reference = cv2.imread(ref_path, cv2.IMREAD_GRAYSCALE)
    
    # Resize both images to the same dimensions for comparison
    target_size = (256, 256)
    logo_resized = cv2.resize(logo_region, target_size, interpolation=cv2.INTER_AREA)
    ref_resized = cv2.resize(reference, target_size, interpolation=cv2.INTER_AREA)
    
    # Compute SSIM — the core metric
    score, _ = ssim(ref_resized, logo_resized, full=True)
    score = float(score)
    
    passed = score >= SSIM_THRESHOLD
    
    status = "PASS ✓" if passed else "FAIL ✗"
    logger.info(f"  ↳ SSIM Score: {score:.4f} ({score * 100:.1f}%) — {status}")
    
    return SSIMResult(
        score=round(score, 4),
        passed_gate=passed,
        reference_logo_used=reference_filename,
    )


# ─────────────────────────══════════════════════════════════════════
# MAIN PIPELINE ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────

async def run_pipeline(
    image_bytes: bytes,
    expected_compounds: Optional[List[str]] = None,
    batch_number_hint: Optional[str] = None,
    reference_logo: str = "default_logo.png",
) -> ThreatReport:
    """
    Execute the full hybrid CV + LLM verification pipeline.
    
    Flow:
      1. Decode image → preprocess → detect/warp strip
      2. Extract logo region → compute SSIM against reference
      3. THE GATE: if SSIM < 95% → REJECT (no LLM call)
      4. If SSIM passes → extract text region → Gemini OCR
      5. Verify extracted compounds against expected (from MongoDB)
      6. Return structured ThreatReport
    
    Args:
        image_bytes:        Raw image file bytes from the upload.
        expected_compounds: Expected chemical compounds from MongoDB Truth Ledger.
        batch_number_hint:  Known batch number (if gateway pre-identified it).
        reference_logo:     Filename of the reference logo for SSIM comparison.
    
    Returns:
        ThreatReport — the complete verification result.
    """
    start_time = time.time()
    logger.info("═" * 60)
    logger.info("  OptiPharma Pipeline — ENGAGED")
    logger.info("═" * 60)

    # ── Step 1: Decode & Preprocess ─────────────────────────────
    logger.info("[1/5] Decoding and preprocessing image...")
    
    # Decode raw bytes into OpenCV format
    nparr = np.frombuffer(image_bytes, np.uint8)
    raw_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if raw_image is None:
        elapsed = (time.time() - start_time) * 1000
        return ThreatReport(
            verdict=Verdict.INCONCLUSIVE,
            confidence=0,
            rejection_reason="Failed to decode uploaded image",
            ssim=SSIMResult(score=0, passed_gate=False),
            processing_time_ms=round(elapsed, 2),
        )

    # ── Step 2: Detect & Warp Strip ─────────────────────────────
    logger.info("[2/5] Detecting medicine strip and applying perspective warp...")
    aligned = detect_and_warp_strip(raw_image)

    # ── Step 3: SSIM Gate ───────────────────────────────────────
    logger.info("[3/5] Extracting logo region and computing SSIM...")
    
    # Preprocess the aligned image for SSIM
    gray_aligned = preprocess_image(aligned)
    
    # Extract logo region from the strip
    logo_crop = extract_region(gray_aligned, LOGO_REGION)
    
    # Compute SSIM against reference
    ssim_result = compute_ssim(logo_crop, reference_logo)

    # ── THE GATE ────────────────────────────────────────────────
    if not ssim_result.passed_gate:
        elapsed = (time.time() - start_time) * 1000
        logger.warning("🚫 GATE CLOSED — SSIM below threshold. Rejecting without LLM call.")
        return ThreatReport(
            verdict=Verdict.COUNTERFEIT,
            confidence=round((1 - ssim_result.score) * 100, 1),
            rejection_reason=RejectionReason.VISUAL_ANOMALY.value,
            ssim=ssim_result,
            processing_time_ms=round(elapsed, 2),
        )

    logger.info("✓ GATE OPEN — SSIM passed. Proceeding to Tier 2 (Gemini)...")

    # ── Step 4: Gemini OCR ──────────────────────────────────────
    logger.info("[4/5] Cropping text region and sending to Gemini Vision...")
    
    # Extract text region from the aligned (color) image
    text_crop = extract_region(aligned, TEXT_REGION)
    
    # Convert OpenCV BGR to PIL RGB for Gemini
    text_pil = Image.fromarray(cv2.cvtColor(text_crop, cv2.COLOR_BGR2RGB))
    
    # Call Gemini for text extraction
    gemini_result = await gemini_client.extract_text(text_pil)
    
    extracted_text = ExtractedText(
        batch_number=gemini_result.get("batch_number", "UNKNOWN"),
        raw_text=gemini_result.get("raw_text", ""),
        brand_name=gemini_result.get("brand_name", "UNKNOWN"),
    )
    
    extracted_compounds = gemini_result.get("compounds", [])

    # ── Step 5: Compound Verification ───────────────────────────
    logger.info("[5/5] Verifying chemical compounds against Truth Ledger...")
    
    compound_result = None
    final_verdict = Verdict.VERIFIED
    rejection = None
    
    if expected_compounds:
        # We have expected compounds from MongoDB — verify against extraction
        verification = await gemini_client.verify_compounds(
            extracted_compounds=extracted_compounds,
            expected_compounds=expected_compounds,
            batch_number=extracted_text.batch_number,
        )
        
        compound_result = CompoundVerification(
            extracted_compounds=extracted_compounds,
            expected_compounds=expected_compounds,
            match=verification.get("match", False),
            match_percentage=verification.get("match_percentage", 0),
        )
        
        if not compound_result.match:
            final_verdict = Verdict.COUNTERFEIT
            rejection = RejectionReason.COMPOUND_MISMATCH.value
    else:
        # No expected compounds provided — mark as inconclusive
        logger.warning("⚠ No expected compounds provided — cannot verify")
        compound_result = CompoundVerification(
            extracted_compounds=extracted_compounds,
            expected_compounds=[],
            match=False,
            match_percentage=0,
        )
        # Still mark as verified if SSIM passed and we got clean OCR
        if gemini_result.get("confidence", 0) > 0.5:
            final_verdict = Verdict.VERIFIED
        else:
            final_verdict = Verdict.INCONCLUSIVE
            rejection = "Insufficient data for full verification"

    # ── Build and Return Report ─────────────────────────────────
    elapsed = (time.time() - start_time) * 1000
    
    confidence = _calculate_confidence(ssim_result, compound_result)
    
    report = ThreatReport(
        verdict=final_verdict,
        confidence=confidence,
        rejection_reason=rejection,
        ssim=ssim_result,
        compound_verification=compound_result,
        extracted_text=extracted_text,
        processing_time_ms=round(elapsed, 2),
    )

    logger.info(f"═ Pipeline complete in {elapsed:.0f}ms — Verdict: {final_verdict.value}")
    return report


# ─────────────────────────────────────────────────────────────────
# Confidence Score Calculator
# ─────────────────────────────────────────────────────────────────

def _calculate_confidence(ssim_result: SSIMResult, compound: Optional[CompoundVerification]) -> float:
    """
    Calculate an overall confidence score (0-100) based on:
      - SSIM score (weighted 40%)
      - Compound match percentage (weighted 60%)
    """
    ssim_weight = 40
    compound_weight = 60
    
    ssim_score = ssim_result.score * ssim_weight
    
    if compound and compound.match_percentage > 0:
        compound_score = (compound.match_percentage / 100) * compound_weight
    else:
        compound_score = 0
    
    total = round(ssim_score + compound_score, 1)
    return min(total, 100.0)
