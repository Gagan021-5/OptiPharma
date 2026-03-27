"""
╔══════════════════════════════════════════════════════════════════════╗
║  OptiPharma — Gemini Vision Client                                  ║
║  Encapsulated Google Gemini 1.5 Pro Vision API for OCR & chemical   ║
║  compound verification on cropped medicine strip text regions.       ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional

import google.generativeai as genai
from PIL import Image

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("optipharma.gemini")


# ─────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-1.5-pro"

# Strict extraction prompt — forces structured JSON output
EXTRACTION_PROMPT = """You are a pharmaceutical verification AI. Analyze this medicine strip image with extreme precision.

TASK:
1. Extract ALL visible text from the medicine strip image.
2. Identify the Batch Number (usually prefixed with "B.No", "Batch", or "LOT").
3. Identify ALL chemical compounds / active ingredients listed.
4. Identify the Brand Name of the medicine.

RESPOND ONLY with this exact JSON structure (no markdown, no explanation):
{
  "batch_number": "<extracted batch number or UNKNOWN>",
  "brand_name": "<extracted brand name or UNKNOWN>",
  "compounds": ["<compound 1>", "<compound 2>", ...],
  "raw_text": "<all visible text concatenated>",
  "confidence": <0.0 to 1.0 float indicating OCR confidence>
}"""

VERIFICATION_PROMPT_TEMPLATE = """You are a pharmaceutical verification AI. Compare the following:

EXTRACTED compounds from the medicine strip:
{extracted}

EXPECTED compounds from the official database for Batch {batch}:
{expected}

TASK: Determine if the extracted compounds match the expected compounds.
- Minor spelling variations are acceptable (e.g., "Paracetamol" vs "paracetamol").
- The order does not matter.
- ALL expected compounds must be present in the extracted list.

RESPOND ONLY with this exact JSON (no markdown):
{{
  "match": true/false,
  "match_percentage": <0-100 float>,
  "mismatches": ["<any expected compounds NOT found>"],
  "notes": "<brief reasoning>"
}}"""


# ─────────────────────────────────────────────────────────────────
# Client Class
# ─────────────────────────────────────────────────────────────────

class GeminiVisionClient:
    """
    Handles all interactions with Google Gemini 1.5 Pro Vision API.
    Provides two core operations:
      1. extract_text()  — OCR extraction from medicine strip
      2. verify_compounds() — Cross-check extracted vs expected compounds
    """

    def __init__(self):
        if not GEMINI_API_KEY:
            logger.warning("⚠ GEMINI_API_KEY not set — Gemini calls will fail.")
        else:
            genai.configure(api_key=GEMINI_API_KEY)
        
        self.model = genai.GenerativeModel(MODEL_NAME)
        logger.info(f"✓ Gemini client initialized with model: {MODEL_NAME}")

    # ─────────────────────────────────────────────────────────────
    # Text Extraction
    # ─────────────────────────────────────────────────────────────

    async def extract_text(self, image: Image.Image) -> Dict[str, Any]:
        """
        Send a cropped text-region image to Gemini for OCR extraction.
        
        Args:
            image: PIL Image of the cropped text region.
            
        Returns:
            Dict with keys: batch_number, brand_name, compounds, raw_text, confidence
        """
        try:
            logger.info("→ Sending image to Gemini for text extraction...")
            
            response = self.model.generate_content(
                [EXTRACTION_PROMPT, image],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,        # Low temp for deterministic extraction
                    max_output_tokens=1024,
                ),
            )

            # Parse the JSON response
            raw = response.text.strip()
            # Strip markdown code fences if Gemini wraps it
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            
            result = json.loads(raw)
            logger.info(f"✓ Gemini extraction complete — Batch: {result.get('batch_number', 'N/A')}")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"✗ Gemini returned non-JSON: {e}")
            return {
                "batch_number": "UNKNOWN",
                "brand_name": "UNKNOWN",
                "compounds": [],
                "raw_text": response.text if 'response' in dir() else "",
                "confidence": 0.0,
            }
        except Exception as e:
            logger.error(f"✗ Gemini API error: {e}")
            return {
                "batch_number": "UNKNOWN",
                "brand_name": "UNKNOWN",
                "compounds": [],
                "raw_text": "",
                "confidence": 0.0,
            }

    # ─────────────────────────────────────────────────────────────
    # Compound Verification
    # ─────────────────────────────────────────────────────────────

    async def verify_compounds(
        self,
        extracted_compounds: List[str],
        expected_compounds: List[str],
        batch_number: str,
    ) -> Dict[str, Any]:
        """
        Ask Gemini to semantically compare extracted vs expected compounds.
        Handles fuzzy matching (spelling variations, abbreviations).
        
        Args:
            extracted_compounds: List of compounds OCR'd from the strip.
            expected_compounds:  List of expected compounds from MongoDB.
            batch_number:        The batch number for context.
            
        Returns:
            Dict with keys: match, match_percentage, mismatches, notes
        """
        try:
            prompt = VERIFICATION_PROMPT_TEMPLATE.format(
                extracted=json.dumps(extracted_compounds),
                expected=json.dumps(expected_compounds),
                batch=batch_number,
            )

            logger.info(f"→ Verifying compounds for batch {batch_number}...")
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.0,  # Fully deterministic for verification
                    max_output_tokens=512,
                ),
            )

            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            result = json.loads(raw)
            logger.info(f"✓ Compound verification: match={result.get('match')} ({result.get('match_percentage', 0)}%)")
            return result

        except Exception as e:
            logger.error(f"✗ Compound verification failed: {e}")
            # Fallback: simple string comparison
            extracted_lower = {c.lower().strip() for c in extracted_compounds}
            expected_lower = {c.lower().strip() for c in expected_compounds}
            matched = extracted_lower & expected_lower
            pct = (len(matched) / len(expected_lower) * 100) if expected_lower else 0
            return {
                "match": pct >= 80,
                "match_percentage": round(pct, 1),
                "mismatches": list(expected_lower - extracted_lower),
                "notes": "Fallback string comparison used due to API error.",
            }


# ─────────────────────────────────────────────────────────────────
# Singleton
# ─────────────────────────────────────────────────────────────────

gemini_client = GeminiVisionClient()
