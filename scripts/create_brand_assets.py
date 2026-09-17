"""Deterministic vector-style launcher assets; no stock imagery."""
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / "apps/mobile/assets"
root.mkdir(parents=True, exist_ok=True)


def icon(size, transparent=False):
    image = Image.new("RGBA" if transparent else "RGB", (size, size), (0, 0, 0, 0) if transparent else '#176B70')
    draw = ImageDraw.Draw(image)
    # A continuous care pulse, kept within the adaptive-icon safe zone.
    points = [(0.23, 0.51), (0.37, 0.51), (0.44, 0.35), (0.55, 0.66), (0.63, 0.47), (0.77, 0.47)]
    coordinates = [(int(x * size), int(y * size)) for x, y in points]
    width = int(size * 0.053)
    draw.line(coordinates, fill='white', width=width, joint='curve')
    for x, y in coordinates:
        radius = width / 2
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill='white')
    return image


icon(1024).save(root / "icon.png")
icon(1024, transparent=True).save(root / "adaptive-icon.png")
icon(64).save(root / "favicon.png")
