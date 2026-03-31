"""Quick debug script to call Gemini directly and see the exact error."""
import asyncio
import json
import sys
from PIL import Image

# Load and call
from gemini_client import GeminiVisionClient

async def main():
    client = GeminiVisionClient()
    
    img_path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Gagan\.gemini\antigravity\brain\5a4945ca-886d-450e-b56d-937dfb7f5a9d\amoxicillin_strip_1774900254293.png"
    
    print(f"Loading image: {img_path}")
    image = Image.open(img_path)
    print(f"Image size: {image.size}, mode: {image.mode}")
    
    print("\n--- Calling extract_text ---")
    result = await client.extract_text(image)
    
    print("\n--- RESULT ---")
    print(json.dumps(result, indent=2))
    
    # Check if it's the fallback
    if result.get("brand_name") == "PAN 40":
        print("\n⚠️  FALLBACK WAS TRIGGERED — Gemini call failed!")
    else:
        print(f"\n✅  Real extraction: brand={result.get('brand_name')}, batch={result.get('batch_number')}")

asyncio.run(main())
