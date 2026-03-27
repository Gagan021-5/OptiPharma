"""
╔══════════════════════════════════════════════════════════════════╗
║  PharmaShield — FastAPI AI/CV Microservice Entry Point          ║
║  Exposes /api/analyze endpoint for the hybrid pipeline.         ║
╚══════════════════════════════════════════════════════════════════╝
"""

import logging
import json
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from cv_pipeline import run_pipeline
from models import ThreatReport

# ─────────────────────────────────────────────────────────────────
# Logging Setup
# ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-28s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pharmashield.api")

# ─────────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="PharmaShield AI/CV Microservice",
    description="Hybrid Computer Vision + LLM pipeline for counterfeit medicine detection",
    version="1.0.0",
)

# CORS — allow all origins for hackathon demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check for the AI microservice."""
    return {"status": "operational", "service": "pharmashield-cv", "version": "1.0.0"}


@app.post("/api/analyze", response_model=ThreatReport)
async def analyze_medicine(
    image: UploadFile = File(..., description="Medicine strip image"),
    expected_compounds: Optional[str] = Form(None, description="JSON array of expected compounds from MongoDB"),
    batch_number: Optional[str] = Form(None, description="Known batch number"),
    reference_logo: Optional[str] = Form("default_logo.png", description="Reference logo filename"),
):
    """
    Primary analysis endpoint.
    
    Receives a medicine strip image and runs the hybrid pipeline:
      Tier 1 (OpenCV SSIM) → Gate → Tier 2 (Gemini Vision)
    
    The Node.js gateway attaches `expected_compounds` (from MongoDB)
    so the pipeline can verify extracted compounds against the Truth Ledger.
    """
    logger.info(f"━━━ Incoming scan request ━━━")
    logger.info(f"  File: {image.filename} ({image.content_type})")
    
    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
    if image.content_type and image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {image.content_type}. Use JPEG, PNG, WebP, or BMP.",
        )

    # Read image bytes
    image_bytes = await image.read()
    
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image file received.")

    # Parse expected compounds from JSON string (sent by Node gateway)
    compounds_list = None
    if expected_compounds:
        try:
            compounds_list = json.loads(expected_compounds)
            logger.info(f"  Expected compounds: {compounds_list}")
        except json.JSONDecodeError:
            logger.warning("  ⚠ Could not parse expected_compounds JSON")

    # Run the hybrid pipeline
    report = await run_pipeline(
        image_bytes=image_bytes,
        expected_compounds=compounds_list,
        batch_number_hint=batch_number,
        reference_logo=reference_logo or "default_logo.png",
    )

    logger.info(f"  → Verdict: {report.verdict.value} | Confidence: {report.confidence}%")
    return report


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "PharmaShield AI/CV Microservice",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/analyze": "Run hybrid CV+LLM verification pipeline",
            "GET /health": "Health check",
        },
    }
