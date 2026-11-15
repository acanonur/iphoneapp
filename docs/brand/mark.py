"""Builds the Yaver mark as SVG from Archivo ExtraBold's own Y outline."""
Y_PATH = "M277 0V272L8 687H215L369 430H374L527 687H723L457 272V0Z"   # font units, y up
Y_X0, Y_X1, Y_H = 8, 723, 687
STEM = 180                                                            # stem width at the baseline

BG, INK, RED = "#f3f2f2", "#201e1d", "#ec3013"

def mark(size, field, letter, stop, stop_side=STEM, width_ratio=0.54, lift=0.0, radius=False):
    """size: canvas px. width_ratio: mark width / canvas. lift: fraction of canvas to raise the mark."""
    w_units = Y_X1 - Y_X0
    k = size * width_ratio / w_units
    left = (size - w_units * k) / 2 - Y_X0 * k
    top = (size - Y_H * k) / 2 - lift * size
    base = top + Y_H * k
    sx = left + (Y_X1 - stop_side) * k
    sy = base - stop_side * k
    clip = ''
    body = (f'<rect width="{size}" height="{size}" fill="{field}"/>'
            f'<path d="{Y_PATH}" fill="{letter}" transform="translate({left:.3f} {base:.3f}) scale({k:.5f} {-k:.5f})"/>'
            f'<rect x="{sx:.3f}" y="{sy:.3f}" width="{stop_side*k:.3f}" height="{stop_side*k:.3f}" fill="{stop}"/>')
    if radius:
        r = size * 0.2237
        clip = f'<clipPath id="m{size}{field[1:]}{stop[1:]}{stop_side}"><rect width="{size}" height="{size}" rx="{r:.2f}"/></clipPath>'
        body = f'{clip}<g clip-path="url(#m{size}{field[1:]}{stop[1:]}{stop_side})">{body}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{body}</svg>'

if __name__ == "__main__":
    import sys
    variants = [
        ("A180 red / white Y / ink stop = stem", RED, BG, INK, 180),
        ("A204 red / white Y / ink stop larger", RED, BG, INK, 204),
        ("C180 red / white Y / white stop",      RED, BG, BG, 180),
        ("B180 ground / ink Y / red stop",       BG, INK, RED, 180),
        ("B204 ground / ink Y / red stop larger", BG, INK, RED, 204),
    ]
    cells = []
    for name, f, l, s, side in variants:
        big = mark(300, f, l, s, side, radius=True)
        mid = mark(120, f, l, s, side, radius=True)
        sm = mark(60, f, l, s, side, radius=True)
        cells.append(f'<div class="c">{big}<div class="r">{mid}{sm}</div><p>{name}</p></div>')
    html = ('<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:36px;background:#cfcdc9;font:14px system-ui;display:flex;gap:30px}'
            '.c{display:flex;flex-direction:column;gap:12px}.r{display:flex;gap:14px;align-items:flex-end}p{margin:0;color:#201e1d}</style>' + ''.join(cells))
    open('sheet2.html', 'w').write(html)
