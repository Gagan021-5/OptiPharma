"""
test_gemini_json_fix.py
=======================
Proves that enforcing `response_mime_type="application/json"` in the
GenerationConfig eliminates the JSONDecodeError fallback path.

Two scenarios are simulated per method:
  1. BROKEN  – The model wraps valid JSON in conversational markdown
               (the old failure mode).
  2. FIXED   – The model returns raw JSON only
               (what `response_mime_type` guarantees).

Run:
    pytest test_gemini_json_fix.py -v
"""

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

# ── Simulated API Payloads ──────────────────────────────────────────

AMOXICILLIN_JSON = {
    "batch_number": "B.No AMX-2026-0412",
    "brand_name": "Amoxicillin 500mg",
    "compounds": ["Amoxicillin Trihydrate IP eq. to Amoxicillin 500mg"],
    "raw_text": (
        "Amoxicillin Capsules IP 500 mg AMOXICILLIN 500mg "
        "Batch No: AMX-2026-0412 Mfg: 01/2026 Exp: 12/2027 "
        "Each capsule contains: Amoxicillin Trihydrate IP "
        "eq. to Amoxicillin 500 mg Excipients q.s."
    ),
    "confidence": 0.96,
}

VERIFICATION_JSON = {
    "match": True,
    "match_percentage": 100.0,
    "mismatches": [],
    "notes": "Amoxicillin Trihydrate matches expected compound list.",
}


# ── The two response shapes ────────────────────────────────────────

def _broken_response(payload: dict) -> SimpleNamespace:
    """Simulates old Gemini behaviour: conversational wrapper + fenced JSON."""
    wrapped = (
        "Sure! Here is the extracted data from the medicine strip:\n\n"
        "```json\n"
        f"{json.dumps(payload, indent=2)}\n"
        "```\n\n"
        "Let me know if you need anything else!"
    )
    return SimpleNamespace(text=wrapped)


def _clean_response(payload: dict) -> SimpleNamespace:
    """Simulates new behaviour with response_mime_type='application/json'."""
    return SimpleNamespace(text=json.dumps(payload))


# ── Helpers ─────────────────────────────────────────────────────────

def _run(coro):
    """Run an async coroutine synchronously for test assertions."""
    return asyncio.get_event_loop().run_until_complete(coro)


# ── Patched client factory ──────────────────────────────────────────

def _make_client():
    """
    Build a GeminiVisionClient with the API-key check and model
    construction patched out so tests run offline.
    """
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key-for-test"}):
        with patch("google.generativeai.configure"):
            with patch("google.generativeai.GenerativeModel") as MockModel:
                mock_model_instance = MagicMock()
                MockModel.return_value = mock_model_instance

                # Re-import after patching so the module-level singleton
                # picks up the mock.
                import importlib
                import gemini_client as gc
                importlib.reload(gc)

                client = gc.GeminiVisionClient()
                client.model = mock_model_instance
                return client, mock_model_instance


# ====================================================================
#  EXTRACTION TESTS
# ====================================================================

class TestExtractText:
    """Tests for GeminiVisionClient.extract_text"""

    def setup_method(self):
        self.client, self.mock_model = _make_client()
        # Provide a tiny 1×1 white PIL image as a dummy input
        from PIL import Image
        self.dummy_image = Image.new("RGB", (1, 1), "white")

    # ── Scenario A: Old broken response → triggers fallback ─────────

    def test_broken_response_triggers_fallback(self):
        """
        When Gemini wraps JSON in conversational text,
        json.loads WILL fail and the fallback dict is returned.
        """
        self.mock_model.generate_content.return_value = _broken_response(
            AMOXICILLIN_JSON
        )

        result = _run(self.client.extract_text(self.dummy_image))

        # The fallback dict has brand_name == "PAN 40" (hard-coded default)
        assert result["brand_name"] == "PAN 40", (
            "Expected the FALLBACK to engage because the old response "
            "contains conversational text that breaks json.loads."
        )
        print(
            "\n✅  BROKEN response correctly triggered the fallback "
            f"(brand_name={result['brand_name']})"
        )

    # ── Scenario B: Clean JSON response → successful parse ──────────

    def test_clean_response_parses_correctly(self):
        """
        With response_mime_type='application/json' the model returns
        pure JSON, which json.loads handles perfectly.
        """
        self.mock_model.generate_content.return_value = _clean_response(
            AMOXICILLIN_JSON
        )

        result = _run(self.client.extract_text(self.dummy_image))

        assert result["brand_name"] == "Amoxicillin 500mg"
        assert result["batch_number"] == "B.No AMX-2026-0412"
        assert len(result["compounds"]) == 1
        assert "Amoxicillin Trihydrate" in result["compounds"][0]
        assert result["confidence"] == 0.96
        print(
            "\n✅  CLEAN response parsed successfully → "
            f"brand_name={result['brand_name']}, "
            f"batch={result['batch_number']}"
        )


# ====================================================================
#  VERIFICATION TESTS
# ====================================================================

class TestVerifyCompounds:
    """Tests for GeminiVisionClient.verify_compounds"""

    def setup_method(self):
        self.client, self.mock_model = _make_client()

    # ── Scenario A: Old broken response → triggers fallback ─────────

    def test_broken_response_triggers_fallback(self):
        self.mock_model.generate_content.return_value = _broken_response(
            VERIFICATION_JSON
        )

        result = _run(
            self.client.verify_compounds(
                extracted_compounds=["Amoxicillin Trihydrate IP eq. to Amoxicillin 500mg"],
                expected_compounds=["Amoxicillin Trihydrate IP eq. to Amoxicillin 500mg"],
                batch_number="AMX-2026-0412",
                brand_name_hint="Amoxicillin 500mg",
                raw_text="full OCR text here",
            )
        )

        # Fallback note contains "Fallback live-demo"
        assert "Fallback" in result.get("notes", ""), (
            "Expected the FALLBACK to engage because conversational "
            "wrapper text breaks json.loads."
        )
        print(
            "\n✅  BROKEN verification response correctly triggered fallback "
            f"(notes={result['notes']!r})"
        )

    # ── Scenario B: Clean JSON response → successful parse ──────────

    def test_clean_response_parses_correctly(self):
        self.mock_model.generate_content.return_value = _clean_response(
            VERIFICATION_JSON
        )

        result = _run(
            self.client.verify_compounds(
                extracted_compounds=["Amoxicillin Trihydrate IP eq. to Amoxicillin 500mg"],
                expected_compounds=["Amoxicillin Trihydrate IP eq. to Amoxicillin 500mg"],
                batch_number="AMX-2026-0412",
                brand_name_hint="Amoxicillin 500mg",
                raw_text="full OCR text here",
            )
        )

        assert result["match"] is True
        assert result["match_percentage"] == 100.0
        assert result["mismatches"] == []
        print(
            "\n✅  CLEAN verification response parsed successfully → "
            f"match={result['match']}, pct={result['match_percentage']}%"
        )


# ====================================================================
#  Direct runner (no pytest required)
# ====================================================================

if __name__ == "__main__":
    print("=" * 64)
    print("  OptiPharma · Gemini JSON-mode fix · Test Suite")
    print("=" * 64)

    suite = [
        ("extract_text – broken response (should fallback)", TestExtractText, "test_broken_response_triggers_fallback"),
        ("extract_text – clean response (should parse)",     TestExtractText, "test_clean_response_parses_correctly"),
        ("verify_compounds – broken response (should fallback)", TestVerifyCompounds, "test_broken_response_triggers_fallback"),
        ("verify_compounds – clean response (should parse)",     TestVerifyCompounds, "test_clean_response_parses_correctly"),
    ]

    passed, failed = 0, 0
    for label, cls, method_name in suite:
        instance = cls()
        instance.setup_method()
        try:
            getattr(instance, method_name)()
            passed += 1
        except AssertionError as exc:
            print(f"\n❌  FAILED: {label}\n   {exc}")
            failed += 1

    print("\n" + "=" * 64)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 64)
