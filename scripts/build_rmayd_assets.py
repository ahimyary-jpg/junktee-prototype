#!/usr/bin/env python3
"""Build responsive RMAYD web assets from the untouched supplied originals."""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "brands" / "rmayd" / "originals"
OUTPUT_DIRS = (
    ROOT / "assets" / "brands" / "rmayd",
    ROOT / "github-pages" / "assets" / "brands" / "rmayd",
)

ASSETS = {
    "primary": {
        "source": "RMAYD.logos-01.png",
        "widths": (480, 960, 1440),
        "padding": (0.086, 0.18),
        "quality": 92,
    },
    "secondary": {
        "source": "RMAYD.logos-02.png",
        "widths": (360, 720, 1080),
        "padding": (0.135, 0.08),
        "quality": 92,
    },
    "instagram": {
        "source": "instagram.jpeg",
        "widths": (240, 480, 720),
        "padding": (0.075, 0.06),
        "quality": 96,
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def content_bbox(image: Image.Image, threshold: int = 26) -> tuple[int, int, int, int]:
    """Find foreground relative to the sampled dark canvas, ignoring compression noise."""
    rgb = image.convert("RGB")
    corners = (
        rgb.getpixel((0, 0)),
        rgb.getpixel((rgb.width - 1, 0)),
        rgb.getpixel((0, rgb.height - 1)),
        rgb.getpixel((rgb.width - 1, rgb.height - 1)),
    )
    background = tuple(sum(pixel[channel] for pixel in corners) // 4 for channel in range(3))
    bg_image = Image.new("RGB", rgb.size, background)
    difference = ImageChops.difference(rgb, bg_image).convert("L")
    mask = difference.point(lambda value: 255 if value > threshold else 0)
    return mask.getbbox() or (0, 0, rgb.width, rgb.height)


def padded_crop(image: Image.Image, x_padding: float, y_padding: float) -> Image.Image:
    left, top, right, bottom = content_bbox(image)
    width, height = right - left, bottom - top
    left = max(0, round(left - width * x_padding))
    right = min(image.width, round(right + width * x_padding))
    top = max(0, round(top - height * y_padding))
    bottom = min(image.height, round(bottom + height * y_padding))
    return image.crop((left, top, right, bottom)).convert("RGB")


def build() -> None:
    missing = [spec["source"] for spec in ASSETS.values() if not (SOURCE_DIR / spec["source"]).is_file()]
    if missing:
        raise SystemExit(f"Missing RMAYD originals: {', '.join(missing)}")

    for output_dir in OUTPUT_DIRS:
        originals_dir = output_dir / "originals"
        originals_dir.mkdir(parents=True, exist_ok=True)
        for spec in ASSETS.values():
            source = SOURCE_DIR / spec["source"]
            destination = originals_dir / spec["source"]
            if source.resolve() != destination.resolve():
                shutil.copyfile(source, destination)
            if sha256(source) != sha256(destination):
                raise RuntimeError(f"Original asset changed while copying: {source.name}")

    for name, spec in ASSETS.items():
        source_path = SOURCE_DIR / spec["source"]
        with Image.open(source_path) as source_image:
            crop = padded_crop(source_image, *spec["padding"])
            if name == "instagram":
                crop = ImageEnhance.Contrast(crop).enhance(1.025)
            for width in spec["widths"]:
                height = round(crop.height * width / crop.width)
                resized = crop.resize((width, height), Image.Resampling.LANCZOS)
                for output_dir in OUTPUT_DIRS:
                    output_path = output_dir / f"{name}-{width}.webp"
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    resized.save(output_path, "WEBP", quality=spec["quality"], method=6)

    for output_dir in OUTPUT_DIRS:
        print(f"Built RMAYD assets in {output_dir.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
