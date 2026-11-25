#!/usr/bin/env python3
"""
Generate Hane's app icons.

The mark is a lowercase h in the app's two inks: a coral stem and a teal arch
on the plum ground. Two inks making one letter — and a shape that stands like a
doorway, which is what *hane*, "household", is about. Solid shapes, no gradient,
no shadow, so the mark survives being tinted, desaturated or cut out by
whichever icon style the phone is set to.

It is drawn here rather than kept as opaque binaries nobody can edit. The same
geometry is used by the in-app logo (`mobile/src/ui/Logo.tsx`) and written out
as `mobile/assets/logo.svg`.

Needs Pillow:  python3 -m pip install pillow
Run from anywhere:  python3 ortak/scripts/make-icons.py
Writes into ortak/mobile/assets/.
"""


from pathlib import Path

from PIL import Image, ImageDraw

GROUND = (0x23, 0x1F, 0x2B, 255)
CORAL = (0xF0, 0x70, 0x4F, 255)
TEAL = (0x4C, 0xB7, 0xB1, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

# The mark on a 100 × 100 grid.
STEM = (28.0, 18.0, 45.0, 82.0)  # the coral stem: left, top, right, bottom
STROKE = 17.0  # every stroke of the letter is this wide, with fully round ends
ARCH_TOP = 44.0  # where the teal arch leaves the stem
LEG = (58.0, 75.0, 82.0)  # the arch's leg: left, right, bottom
INNER_RADIUS = 6.0  # the curve inside the arch

SUPERSAMPLE = 4


def draw_mark(size: int, scale: float, ground, inks: dict) -> Image.Image:
    """The mark centred on a square canvas, occupying `scale` of it."""
    big = size * SUPERSAMPLE
    image = Image.new("RGBA", (big, big), ground)
    draw = ImageDraw.Draw(image)

    unit = big * scale / 100.0
    origin = (big - 100.0 * unit) / 2.0

    def box(left: float, top: float, right: float, bottom: float) -> list[float]:
        return [origin + v * unit for v in (left, top, right, bottom)]

    leg_left, leg_right, leg_bottom = LEG
    half = STROKE / 2.0
    teal, coral = inks["teal"], inks["coral"]

    # The arch: a block with one big rounded shoulder, a leg with a round foot,
    # and the counter cut back out of it in the ground colour.
    draw.rounded_rectangle(
        box(STEM[2] - 1, ARCH_TOP, leg_right, leg_bottom - half),
        radius=STROKE * unit,
        fill=teal,
        corners=(False, True, False, False),
    )
    draw.rectangle(box(STEM[2] - 1, ARCH_TOP, leg_left + 0.5, ARCH_TOP + STROKE), fill=teal)
    draw.rounded_rectangle(box(leg_left, ARCH_TOP + STROKE, leg_right, leg_bottom), radius=half * unit, fill=teal)
    draw.rounded_rectangle(
        box(STEM[2] - 6, ARCH_TOP + STROKE, leg_left, leg_bottom + 10),
        radius=INNER_RADIUS * unit,
        fill=ground,
        corners=(False, True, False, False),
    )

    # The stem goes on last, over the join.
    draw.rounded_rectangle(box(*STEM), radius=half * unit, fill=coral)

    return image.resize((size, size), Image.LANCZOS)


def write_svg(path: Path) -> None:
    """The same mark as an SVG, one shape per ink, for Icon Composer or print."""
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
        '  <rect id="ground" width="100" height="100" fill="#231f2b"/>\n'
        '  <path id="teal" fill="#4cb7b1" d="M44 44 H58 A17 17 0 0 1 75 61 V73.5 '
        'A8.5 8.5 0 0 1 58 73.5 V67 A6 6 0 0 0 52 61 H44 Z"/>\n'
        '  <rect id="coral" fill="#f0704f" x="28" y="18" width="17" height="64" rx="8.5"/>\n'
        "</svg>\n"
    )


def main() -> None:
    assets = Path(__file__).resolve().parent.parent / "mobile" / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    colour = {"coral": CORAL, "teal": TEAL}
    mono = {"coral": WHITE, "teal": WHITE}

    # App icon: full bleed, no alpha (the App Store rejects transparency).
    draw_mark(1024, 1.0, GROUND, colour).convert("RGB").save(assets / "icon.png")

    # Android adaptive foreground: any mask may crop the outer third, so the
    # mark sits inside the safe circle on a transparent layer; the plum ground
    # is the adaptive icon's background colour in app.base.json.
    draw_mark(1024, 0.62, CLEAR, colour).save(assets / "adaptive-icon.png")

    # Android 13 themed icons: the same silhouette in one colour.
    draw_mark(1024, 0.62, CLEAR, mono).save(assets / "adaptive-icon-mono.png")

    # Splash: the mark, small, over the splash background colour.
    draw_mark(1024, 0.5, CLEAR, colour).save(assets / "splash-icon.png")

    # Favicon for the web build.
    draw_mark(64, 1.0, GROUND, colour).save(assets / "favicon.png")

    write_svg(assets / "logo.svg")

    print(f"wrote icon, adaptive-icon, adaptive-icon-mono, splash-icon, favicon, logo.svg to {assets}")


if __name__ == "__main__":
    main()
