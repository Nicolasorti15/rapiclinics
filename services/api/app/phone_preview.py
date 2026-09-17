"""Serve the synthetic demo API and phone web preview from one LAN origin."""

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from .main import app

web_root = Path(__file__).resolve().parents[3] / "apps" / "mobile" / "dist-phone"
if not (web_root / "index.html").is_file():
    raise RuntimeError("Export the phone preview to apps/mobile/dist-phone first.")

# API routes are registered first. StaticFiles only exposes the exported web directory.
app.mount("/", StaticFiles(directory=web_root, html=True), name="phone-preview")
