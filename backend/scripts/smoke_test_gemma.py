"""Smoke test script for hosted Google Gemma model integration in DataMind.

Sends a harmless prompt to the hosted Gemma API and prints the response status,
latency, and answer. NEVER prints or logs secret API keys.
"""

import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Load .env if present
load_dotenv(backend_dir / ".env")

from app.config import get_settings
from app.gemma_service import (
    GemmaAuthError,
    GemmaError,
    GemmaModelNotFoundError,
    GemmaRateLimitError,
    GemmaService,
    GemmaTimeoutError,
)


def run_smoke_test() -> bool:
    settings = get_settings()
    api_key = settings.effective_gemma_api_key
    model_name = settings.gemma_model

    print("=" * 60)
    print("DATAMIND — HOSTED GOOGLE GEMMA SMOKE TEST")
    print("=" * 60)
    print(f"Target Model:  {model_name}")
    print(f"API Key Set:   {'YES (masked: ' + api_key[:4] + '...' + api_key[-4:] + ')' if len(api_key) > 8 else ('YES (short)' if api_key else 'NO - NOT CONFIGURED')}")
    print(f"Endpoint:      https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent")
    print("-" * 60)

    if not api_key:
        print("ERROR: No Gemma or Google API key found.")
        print("Please set GEMMA_API_KEY in backend/.env or export it in your environment.")
        return False

    harmless_prompt = "What is the capital of France? Reply with only the single city name."
    print(f"Prompt:        \"{harmless_prompt}\"")
    print("Sending request to hosted Gemma model...")

    service = GemmaService(api_key=api_key, model=model_name, timeout_seconds=30.0)

    start_time = time.perf_counter()
    try:
        response_text = service.generate_raw(harmless_prompt)
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        print("-" * 60)
        print(f"STATUS:        SUCCESS (HTTP 200)")
        print(f"Elapsed Time:  {elapsed_ms} ms")
        print(f"Response:      {response_text}")
        print("=" * 60)
        print("Hosted Google Gemma model verified successfully!")
        return True

    except GemmaAuthError as exc:
        print(f"AUTHENTICATION FAILURE: {exc}")
        return False
    except GemmaModelNotFoundError as exc:
        print(f"MODEL NOT FOUND: {exc}")
        return False
    except GemmaRateLimitError as exc:
        print(f"RATE LIMIT EXCEEDED: {exc}")
        return False
    except GemmaTimeoutError as exc:
        print(f"TIMEOUT FAILURE: {exc}")
        return False
    except GemmaError as exc:
        print(f"PROVIDER ERROR: {exc}")
        return False
    except Exception as exc:
        print(f"UNEXPECTED ERROR: {type(exc).__name__}: {exc}")
        return False


if __name__ == "__main__":
    success = run_smoke_test()
    sys.exit(0 if success else 1)
