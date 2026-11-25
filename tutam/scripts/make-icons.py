#!/usr/bin/env python3
"""
Generate Tutam's app icons.

*Tutam* is Turkish for "a pinch". The mark is a table seen from above: a plate,
a glass, and a pinch of paprika scattered beside them. The plate is a cream
ring, the glass a saffron disc that sits over the plate's rim, the pinch three
paprika grains — on a bottle-green cloth. Food, drink and the pinch that
finishes both, made of circles, so it stays readable at 29 pixels and when the
phone tints or flattens its icons.

Drawn here rather than kept as binaries nobody can edit. The same geometry is
written out as `assets/logo.svg`.

Needs Pillow:  python3 -m pip install pillow
Run from anywhere:  python3 tutam/scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

GROUND = (0x1F, 0x3D, 0x2F, 255)
CREAM = (0xFB, 0xF7, 0xEE, 255)
SAFFRON = (0xF0, 0xB8, 0x4A, 255)
PAPRIKA = (0xE2, 0x62, 0x3F, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

# On a 100 × 100 grid: (centre x, centre y, radius).
PLATE = (42.0, 57.0, 27.0)
PLATE_RIM = 7.5  # how thick the ring is
GLASS = (69.0, 32.0, 15.5)
# The pinch: three grains, largest nearest the plate.
PINCH = [(76.0, 67.0, 6.2), (88.0, 58.5, 3.4), (86.5, 79.5, 4.0)]
GAP = 4.5  # clear space cut around the glass where it crosses the plate

SUPERSAMPLE = 4


def draw_mark(size: int, scale: float, ground, inks: dict) -> Image.Image:
    """The mark centred on a square canvas, occupying `scale` of it."""
    big = size * SUPERSAMPLE
    image = Image.new("RGBA", (big, big), ground)
    draw = ImageDraw.Draw(image)
    unit = big * scale / 100.0
    origin = (big - 100.0 * unit) / 2.0

    def disc(cx: float, cy: float, r: float, fill) -> None:
        draw.ellipse(
            [origin + (cx - r) * unit, origin + (cy - r) * unit, origin + (cx + r) * unit, origin + (cy + r) * unit],
            fill=fill,
        )

    px, py, pr = PLATE
    disc(px, py, pr, inks["plate"])
    disc(px, py, pr - PLATE_RIM, ground)

    gx, gy, gr = GLASS
    disc(gx, gy, gr + GAP, ground)
    disc(gx, gy, gr, inks["glass"])

    for grain in PINCH:
        disc(*grain, inks["pinch"])

    return image.resize((size, size), Image.LANCZOS)


def write_svg(path: Path) -> None:
    px, py, pr = PLATE
    gx, gy, gr = GLASS
    mid = pr - PLATE_RIM / 2
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
        '  <rect id="ground" width="100" height="100" fill="#1f3d2f"/>\n'
        f'  <circle id="plate" cx="{px}" cy="{py}" r="{mid}" fill="none" stroke="#fbf7ee" stroke-width="{PLATE_RIM}"/>\n'
        f'  <circle id="gap" cx="{gx}" cy="{gy}" r="{gr + GAP}" fill="#1f3d2f"/>\n'
        f'  <circle id="glass" cx="{gx}" cy="{gy}" r="{gr}" fill="#f0b84a"/>\n'
        '  <g id="pinch" fill="#e2623f">\n'
        + "".join(f'    <circle cx="{x}" cy="{y}" r="{r}"/>\n' for x, y, r in PINCH)
        + "  </g>\n"
        "</svg>\n"
    )


def main() -> None:
    assets = Path(__file__).resolve().parent.parent / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    colour = {"plate": CREAM, "glass": SAFFRON, "pinch": PAPRIKA}
    mono = {"plate": WHITE, "glass": WHITE, "pinch": WHITE}

    # App icon: full bleed, no alpha (the App Store rejects transparency).
    draw_mark(1024, 1.0, GROUND, colour).convert("RGB").save(assets / "icon.png")
    # Android adaptive foreground and its single-colour themed layer, inside the safe circle.
    draw_mark(1024, 0.62, CLEAR, colour).save(assets / "adaptive-icon.png")
    draw_mark(1024, 0.62, CLEAR, mono).save(assets / "adaptive-icon-mono.png")
    # Splash: the mark, small, over the splash background colour.
    draw_mark(1024, 0.5, CLEAR, colour).save(assets / "splash-icon.png")
    draw_mark(64, 1.0, GROUND, colour).save(assets / "favicon.png")
    write_svg(assets / "logo.svg")
    print(f"wrote icon, adaptive-icon, adaptive-icon-mono, splash-icon, favicon, logo.svg to {assets}")


if __name__ == "__main__":
    main()
