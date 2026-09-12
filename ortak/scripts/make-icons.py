#!/usr/bin/env python3
"""
Generate Ortak's app icons.

The icons are flat geometry in the app's own palette, so they are drawn here
rather than kept as opaque binaries nobody can edit: two squares, offset and
overlapping — two people, one shared space — in the system's ink and its single
red, on the system's ground. Zero radius, no gradient, no shadow, in keeping
with the rest of the design.

Run from anywhere:  python3 ortak/scripts/make-icons.py
Writes into ortak/mobile/assets/.
"""

import struct
import zlib
from pathlib import Path

GROUND = (0xF3, 0xF2, 0xF2)
INK = (0x20, 0x1E, 0x1D)
RED = (0xEC, 0x30, 0x13)


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    """pixels is RGB, row-major, 3 bytes per pixel."""
    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        raw.extend(pixels[y * stride : (y + 1) * stride])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def canvas(size: int, colour: tuple[int, int, int]) -> bytearray:
    return bytearray(bytes(colour) * size * size)


def fill_rect(px: bytearray, size: int, x0: int, y0: int, x1: int, y1: int, colour) -> None:
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(size, x1), min(size, y1)
    row = bytes(colour) * (x1 - x0)
    for y in range(y0, y1):
        start = (y * size + x0) * 3
        px[start : start + len(row)] = row


def mark(size: int, scale: float) -> bytearray:
    """The two-square mark, centred, occupying `scale` of the canvas."""
    px = canvas(size, GROUND)
    side = int(size * scale * 0.62)
    offset = int(side * 0.46)
    total = side + offset
    left = (size - total) // 2
    top = (size - total) // 2

    fill_rect(px, size, left, top, left + side, top + side, INK)
    fill_rect(px, size, left + offset, top + offset, left + offset + side, top + offset + side, RED)
    return px


def main() -> None:
    assets = Path(__file__).resolve().parent.parent / "mobile" / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    # App icon: the mark fills the tile confidently.
    write_png(assets / "icon.png", 1024, 1024, mark(1024, 1.0))

    # Android adaptive foreground: the outer third can be cropped by any mask,
    # so the mark sits well inside the safe circle.
    write_png(assets / "adaptive-icon.png", 1024, 1024, mark(1024, 0.62))

    # Splash: the same mark, small, on the same ground.
    write_png(assets / "splash-icon.png", 1024, 1024, mark(1024, 0.42))

    # Favicon for the web build.
    write_png(assets / "favicon.png", 64, 64, mark(64, 1.0))

    print(f"wrote icon.png, adaptive-icon.png, splash-icon.png, favicon.png to {assets}")


if __name__ == "__main__":
    main()
