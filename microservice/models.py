"""
╔══════════════════════════════════════════════════════════════════╗
║  OptiPharma — Pydantic Response Models                          ║
║  Strict, typed contracts for the entire verification pipeline.  ║
╚══════════════════════════════════════════════════════════════════╝
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
from datetime import datetime


# ─────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────

class Verdict(str, Enum):
    """Final verdict classification."""
    VERIFIED = "VERIFIED"
    COUNTERFEIT = "COUNTERFEIT"
    INCONCLUSIVE = "INCONCLUSIVE"


class RejectionReason(str, Enum):
    """Machine-readable rejection reasons."""
    VISUAL_ANOMALY = "Visual Anomaly: Logo SSIM below threshold"
    COMPOUND_MISMATCH = "Compound Mismatch: Extracted chemicals do not match records"
    BATCH_NOT_FOUND = "Batch Not Found: No record of this batch number"
    OCR_FAILURE = "OCR Failure: Could not extract text from strip"


# ─────────────────────────────────────────────────────────────────
# Sub-models
# ─────────────────────────────────────────────────────────────────

class SSIMResult(BaseModel):
    """Result from the OpenCV SSIM comparison stage."""
    score: float = Field(..., ge=0.0, le=1.0, description="SSIM score (0-1)")
    passed_gate: bool = Field(..., description="True if SSIM >= 0.95 threshold")
    reference_logo_used: str = Field(default="", description="Filename of the reference logo")


class CompoundVerification(BaseModel):
    """Result from the Gemini chemical compound verification stage."""
    extracted_compounds: List[str] = Field(default_factory=list, description="Compounds extracted by Gemini OCR")
    expected_compounds: List[str] = Field(default_factory=list, description="Expected compounds from the Truth Ledger")
    match: bool = Field(default=False, description="True if all expected compounds were found")
    match_percentage: float = Field(default=0.0, description="Percentage of compounds matched")


class ExtractedText(BaseModel):
    """Raw text data extracted from the medicine strip."""
    batch_number: str = Field(default="", description="Extracted batch number")
    raw_text: str = Field(default="", description="Full raw OCR text")
    brand_name: str = Field(default="", description="Detected brand name")


# ─────────────────────────────────────────────────────────────────
# Primary Response
# ─────────────────────────────────────────────────────────────────

class ThreatReport(BaseModel):
    """
    The complete threat analysis report returned to the frontend.
    This is the single source of truth for a scan result.
    """
    verdict: Verdict = Field(..., description="Final verification verdict")
    confidence: float = Field(default=0.0, ge=0.0, le=100.0, description="Overall confidence score (%)")
    rejection_reason: Optional[str] = Field(default=None, description="Reason for counterfeit/inconclusive verdict")

    # Sub-reports
    ssim: SSIMResult = Field(..., description="SSIM analysis results")
    compound_verification: Optional[CompoundVerification] = Field(default=None, description="Compound check (only if SSIM passed)")
    extracted_text: Optional[ExtractedText] = Field(default=None, description="Extracted text data (only if SSIM passed)")

    # Metadata
    pipeline_version: str = Field(default="1.0.0", description="Pipeline version identifier")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="UTC timestamp")
    processing_time_ms: float = Field(default=0.0, description="Total processing time in milliseconds")
