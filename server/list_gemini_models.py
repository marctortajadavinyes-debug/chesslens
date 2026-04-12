#!/usr/bin/env python3
import os
import google.generativeai as genai

api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not api_key:
    raise SystemExit("Missing GEMINI_API_KEY (or GOOGLE_API_KEY)")

genai.configure(api_key=api_key)

print("Listing models...\n")
for m in genai.list_models():
    print(m.name, "| methods:", getattr(m, "supported_generation_methods", None))
    