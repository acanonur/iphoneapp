#!/usr/bin/env python3
"""
Generate Ikimiz's app icons.

The mark is two lowercase i's standing side by side — a dot over a rounded stem
each, which is also the simplest drawing of two people. One is coral and one is
teal, the app's two inks, on its plum ground; the name begins with them: *iki*,
"two". Two solid shapes, no gradient, no shadow — so the mark survives being
tinted, desaturated or cut out by whichever icon style the phone is set to.

It is drawn here rather than kept as opaque binaries nobody can edit. The
geometry lives once, in MARK below, and the same numbers are used by the in-app
logo (`mobile/src/ui/Logo.tsx`) and written out as `mobile/assets/logo.svg`.

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

# The mark on a 100 × 100 grid: (centre x, dot centre y, stem top, stem bottom).
# The second figure stands a little taller, so the pair reads as two different
# people rather than a pause button.
DOT_RADIUS = 9.5
STEM_WIDTH = 17.0
MARK = [
    (38.5, 31.0, 45.0, 79.0, "coral"),
    (61.5, 24.0, 38.0, 79.0, "teal"),
]

SUPERSAMPLE = 4


def draw_mark(size: int, scale: float, ground, inks: dict) -> Image.Image:
    """The mark centred on a square canvas, occupying `scale` of it."""
    big = size * SUPERSAMPLE
    image = Image.new("RGBA", (big, big), ground)
    draw = ImageDraw.Draw(image)

    unit = big * scale / 100.0
    origin = (big - 100.0 * unit) / 2.0

    def at(value: float) -> float:
        return origin + value * unit

    for cx, dot_y, top, bottom, ink in MARK:
        colour = inks[ink]
        half = STEM_WIDTH / 2.0
        draw.rounded_rectangle(
            [at(cx - half), at(top), at(cx + half), at(bottom)],
            radius=half * unit,
            fill=colour,
        )
        draw.ellipse(
            [at(cx - DOT_RADIUS), at(dot_y - DOT_RADIUS), at(cx + DOT_RADIUS), at(dot_y + DOT_RADIUS)],
            fill=colour,
        )

    return image.resize((size, size), Image.LANCZOS)


def write_svg(path: Path) -> None:
    """The same mark as an SVG, one group per layer, for Icon Composer or print."""
    shapes = []
    for cx, dot_y, top, bottom, ink in MARK:
        colour = "#f0704f" if ink == "coral" else "#4cb7b1"
        half = STEM_WIDTH / 2.0
        shapes.append(
            f'  <g id="{ink}" fill="{colour}">\n'
            f'    <circle cx="{cx}" cy="{dot_y}" r="{DOT_RADIUS}"/>\n'
            f'    <rect x="{cx - half}" y="{top}" width="{STEM_WIDTH}" height="{bottom - top}" rx="{half}"/>\n'
            f"  </g>"
        )
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n'
        '  <rect id="ground" width="100" height="100" fill="#231f2b"/>\n'
        + "\n".join(shapes)
        + "\n</svg>\n"
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
