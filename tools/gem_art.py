"""Realistic drawings of stone cuts and settings for the Gold & Gemstones page (materials.html).

Everything is plain inline SVG worked out here, so the page needs no image files: each stone is split into its real
facets (table, star, bezel and girdle facets for brilliant cuts; stepped rows for emerald and baguette cuts) and each
facet is shaded by the way it faces the light. Settings are drawn in polished 18k gold around those stones.
"""
import math

LIGHT = math.radians(-125)  # light comes from the top left


def _mix(a, b, t):
    a, b = [int(a[i:i + 2], 16) for i in (1, 3, 5)], [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(a, b))


DIAMOND = ("#9eabb8", "#ffffff", "#6b7682", "url(#gem-table)")  # dark facet, light facet, outline, table
_colours = DIAMOND


def tint(dark, light, edge):
    """Colours for a coloured stone (ruby, emerald...): facets shade from dark to light, the table glows in between."""
    return (dark, light, edge, _mix(dark, light, 0.72))


def _tone(angle, bias=0.0):
    """Facet colour: bright where the facet faces the light, darker where it faces away."""
    t = 0.5 + 0.5 * math.cos(angle - LIGHT) + bias
    t = max(0.0, min(1.0, t))
    return _mix(_colours[0], _colours[1], t)


def coloured(colours, draw, *args, **kwargs):
    """Draw a stone (brilliant() or step_cut()) in the given tint() colours instead of diamond white."""
    global _colours
    _colours = colours
    try:
        return draw(*args, **kwargs)
    finally:
        _colours = DIAMOND


def _pts(points):
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in points)


def _poly(points, fill, stroke="#7f8b97", width=0.35):
    return f'<polygon points="{_pts(points)}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round"/>'


def _ray(inside, angle, rmax=2.0):
    """Distance from the centre to the outline along a direction, for a shape given as an inside() test."""
    lo, hi = 0.0, rmax
    for _ in range(40):
        mid = (lo + hi) / 2
        if inside(mid * math.cos(angle), mid * math.sin(angle)):
            lo = mid
        else:
            hi = mid
    return lo


def brilliant(inside, cx, cy, size, n=16, table=0.45, star=0.7, center=(0.0, 0.0)):
    """A brilliant-cut stone: girdle points on the outline, a table in the middle and star, bezel and girdle facets."""
    ox, oy = center
    girdle = []
    for i in range(n):
        a = -math.pi / 2 + 2 * math.pi * i / n
        r = _ray(lambda x, y: inside(x + ox, y + oy), a)
        girdle.append((a, r))

    def at(i, k):
        a, r = girdle[i % n]
        return (cx + size * (ox + k * r * math.cos(a)), cy + size * (oy + k * r * math.sin(a)))

    half = n // 2
    tab = [at(2 * k + 1, table) for k in range(half)]
    stars = [at(2 * k, star) for k in range(half)]
    out = []
    for k in range(half):
        a_mid = girdle[2 * k][0]
        a_next = girdle[(2 * k + 1) % n][0]
        out.append(_poly([stars[k], at(2 * k, 1), at(2 * k + 1, 1)], _tone(a_mid + 0.2, -0.05)))
        out.append(_poly([stars[k], at(2 * k - 1, 1), at(2 * k, 1)], _tone(a_mid - 0.2, -0.15)))
        out.append(_poly([stars[k], tab[k], stars[(k + 1) % half], at(2 * k + 1, 1)], _tone(a_next + math.pi, 0.0)))
        out.append(_poly([tab[k - 1], stars[k], tab[k]], _tone(a_mid, 0.15)))
    out.append(_poly(tab, _colours[3]))
    outline = [at(i, 1) for i in range(n)]
    out.append(f'<polygon points="{_pts(outline)}" fill="none" stroke="{_colours[2]}" stroke-width="0.8" stroke-linejoin="round"/>')
    return "".join(out)


def step_cut(outline, rings=4):
    """An emerald or baguette cut: rows of long facets stepping down to a flat table, like a staircase."""
    cx = sum(x for x, _ in outline) / len(outline)
    cy = sum(y for _, y in outline) / len(outline)
    levels = [[(cx + (x - cx) * s, cy + (y - cy) * s) for x, y in outline]
              for s in [1 - i * (0.62 / rings) for i in range(rings + 1)]]
    out = []
    for ring in range(rings):
        a, b = levels[ring], levels[ring + 1]
        for i in range(len(outline)):
            j = (i + 1) % len(outline)
            mx, my = (a[i][0] + a[j][0]) / 2 - cx, (a[i][1] + a[j][1]) / 2 - cy
            face = math.atan2(my, mx)
            out.append(_poly([a[i], a[j], b[j], b[i]], _tone(face + math.pi if ring % 2 else face, -0.1 + 0.05 * ring)))
    out.append(_poly(levels[-1], _colours[3]))
    out.append(f'<polygon points="{_pts(outline)}" fill="none" stroke="{_colours[2]}" stroke-width="0.8" stroke-linejoin="round"/>')
    return "".join(out)


# ---------------------------------------------------------------- outlines (unit size, centred on 0,0)
def round_(x, y): return x * x + y * y <= 1
def oval(x, y): return (x / 0.72) ** 2 + y * y <= 1
def princess(x, y): return max(abs(x), abs(y)) <= 0.82
def cushion(x, y): return (abs(x) / 0.86) ** 4 + (abs(y) / 0.86) ** 4 <= 1


def marquise(x, y):
    t = abs(y)
    return t <= 1 and abs(x) <= 0.5 * (1 - t * t)


def pear(x, y):
    if (x * x + (y - 0.35) ** 2) <= 0.62 ** 2:
        return True
    if -1 <= y <= 0.35:
        t = (0.35 - y) / 1.35
        return abs(x) <= 0.62 * (1 - t ** 1.7)
    return False


def heart(x, y):
    X, Y = x * 1.18, -(y * 1.18) + 0.2
    return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0


def octagon(cx, cy, w, h, c):
    return [(cx - w + c, cy - h), (cx + w - c, cy - h), (cx + w, cy - h + c), (cx + w, cy + h - c),
            (cx + w - c, cy + h), (cx - w + c, cy + h), (cx - w, cy + h - c), (cx - w, cy - h + c)]


def rect(cx, cy, w, h):
    return [(cx - w, cy - h), (cx + w, cy - h), (cx + w, cy + h), (cx - w, cy + h)]


def cabochon(cx, cy, rx, ry):
    return (f'<ellipse cx="{cx}" cy="{cy + 2}" rx="{rx}" ry="{ry}" fill="#1f5d57" opacity="0.25"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#gem-cab)" stroke="#2f7f78" stroke-width="0.6"/>'
            f'<ellipse cx="{cx - rx * 0.35}" cy="{cy - ry * 0.45}" rx="{rx * 0.32}" ry="{ry * 0.2}" fill="#fff" opacity="0.7"'
            f' transform="rotate(-25 {cx - rx * 0.35} {cy - ry * 0.45})"/>')


def shadow(cx, cy, rx, ry):
    return f'<ellipse cx="{cx + 1.5}" cy="{cy + 2.5}" rx="{rx}" ry="{ry}" fill="#000" opacity="0.08"/>'


CUT_ART = {
    "Round brilliant": shadow(50, 50, 38, 38) + brilliant(round_, 50, 50, 38),
    "Oval": shadow(50, 50, 28, 40) + brilliant(oval, 50, 50, 40),
    "Princess": shadow(50, 50, 33, 33) + brilliant(princess, 50, 50, 40),
    "Cushion": shadow(50, 50, 34, 34) + brilliant(cushion, 50, 50, 40),
    "Emerald cut": shadow(50, 50, 28, 40) + step_cut(octagon(50, 50, 27, 39, 8)),
    "Pear": shadow(50, 50, 26, 40) + brilliant(pear, 50, 48, 40, center=(0, 0.1)),
    "Marquise": shadow(50, 50, 20, 40) + brilliant(marquise, 50, 50, 41),
    "Heart": shadow(50, 50, 33, 30) + brilliant(heart, 50, 50, 36, center=(0, 0.05)),
    "Baguette": shadow(50, 50, 16, 40) + step_cut(rect(50, 50, 15, 39), rings=3),
    "Cabochon": cabochon(50, 50, 34, 27),
}


# ---------------------------------------------------------------- settings, drawn in polished gold
def band(y=50, h=16):
    return (f'<rect x="-2" y="{y - h / 2}" width="104" height="{h}" fill="url(#gold-band)"/>'
            f'<line x1="-2" y1="{y - h / 2 + 0.5}" x2="102" y2="{y - h / 2 + 0.5}" stroke="#fff3cc" stroke-width="0.8" opacity="0.8"/>')


def bead(x, y, r=2.4):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#gold-ball)" stroke="#9c7a2f" stroke-width="0.3"/>')


def small(x, y, r):
    return brilliant(round_, x, y, r, n=12, table=0.5, star=0.74)


def prong():
    claws = "".join(f'<ellipse cx="{50 + 25 * math.cos(a):.2f}" cy="{50 + 25 * math.sin(a):.2f}" rx="4.2" ry="5.4" '
                    f'transform="rotate({math.degrees(a) + 90:.0f} {50 + 25 * math.cos(a):.2f} {50 + 25 * math.sin(a):.2f})" '
                    f'fill="url(#gold-ball)" stroke="#9c7a2f" stroke-width="0.4"/>'
                    for a in [math.radians(d) for d in (-135, -45, 45, 135)])
    return band() + shadow(50, 50, 27, 27) + brilliant(round_, 50, 50, 27) + claws


def bezel():
    return (band() + shadow(50, 50, 33, 33)
            + '<circle cx="50" cy="50" r="32" fill="url(#gold-ball)" stroke="#9c7a2f" stroke-width="0.5"/>'
            + '<circle cx="50" cy="50" r="25.5" fill="#a9853a"/>'
            + brilliant(round_, 50, 50, 24.5))


def pave():
    stones = []
    for row, y in enumerate((43, 57)):
        for i in range(6):
            x = 12 + i * 15.2 + (7.6 if row else 0)
            if x < 95:
                stones.append(small(x, y, 6.4))
    beads = "".join(bead(12 + i * 15.2 + 7.6, 43 + 7, 1.3) for i in range(5)) + "".join(
        bead(12 + i * 15.2, 50, 1.3) for i in range(6))
    return band(50, 30) + "".join(stones) + beads


def channel():
    stones = "".join(brilliant(princess, 13 + i * 18.5, 50, 10.8) for i in range(5))
    walls = ('<rect x="-2" y="35" width="104" height="5" fill="url(#gold-wall)"/>'
             '<rect x="-2" y="60" width="104" height="5" fill="url(#gold-wall)"/>')
    return band(50, 30) + '<rect x="-2" y="40" width="104" height="20" fill="#9b7a33"/>' + stones + walls


def halo():
    ring = "".join(small(50 + 31 * math.cos(a), 50 + 31 * math.sin(a), 5.4)
                   for a in [2 * math.pi * i / 16 for i in range(16)])
    return (band() + shadow(50, 50, 38, 38)
            + '<circle cx="50" cy="50" r="37.5" fill="url(#gold-ball)" stroke="#9c7a2f" stroke-width="0.4"/>'
            + ring + brilliant(round_, 50, 50, 23))


def flush():
    return (band(50, 34)
            + '<circle cx="50" cy="50" r="10.5" fill="#8f6f2c"/>'
            + '<circle cx="50" cy="50" r="9.6" fill="none" stroke="#fff0c2" stroke-width="0.7" opacity="0.6"/>'
            + brilliant(round_, 50, 50, 8.6, n=8, table=0.5, star=0.75))


def bar():
    stones = "".join(brilliant(round_, 14 + i * 24, 50, 10.5) for i in range(4))
    bars = "".join(f'<rect x="{24.5 + i * 24}" y="37" width="3" height="26" rx="1" fill="url(#gold-wall-v)"/>' for i in range(3))
    rails = ('<rect x="-2" y="35" width="104" height="3.5" fill="url(#gold-wall)"/>'
             '<rect x="-2" y="61.5" width="104" height="3.5" fill="url(#gold-wall)"/>')
    return band(50, 30) + stones + bars + rails


def cluster():
    petals = "".join(small(50 + 21 * math.cos(a), 50 + 21 * math.sin(a), 10.8)
                     for a in [-math.pi / 2 + 2 * math.pi * i / 6 for i in range(6)])
    beads = "".join(bead(50 + 25 * math.cos(a), 50 + 25 * math.sin(a), 1.6)
                    for a in [-math.pi / 2 + math.pi / 6 + 2 * math.pi * i / 6 for i in range(6)])
    return (band() + shadow(50, 50, 33, 33)
            + '<circle cx="50" cy="50" r="32" fill="url(#gold-ball)" stroke="#9c7a2f" stroke-width="0.4"/>'
            + petals + brilliant(round_, 50, 50, 11) + beads)


SETTING_ART = {
    "Prong (claw)": prong(), "Bezel": bezel(), "Pavé": pave(), "Channel": channel(),
    "Halo": halo(), "Flush": flush(), "Bar": bar(), "Cluster": cluster(),
}

# Shared colours, defined once on the page and used by every drawing.
DEFS = """<svg class="gem-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <radialGradient id="gem-table" cx="35%" cy="30%" r="80%">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#e8eef3"/><stop offset="1" stop-color="#c3ced8"/>
  </radialGradient>
  <radialGradient id="gem-cab" cx="38%" cy="32%" r="75%">
    <stop offset="0" stop-color="#9fe0d6"/><stop offset="0.55" stop-color="#3fa89c"/><stop offset="1" stop-color="#1d6b63"/>
  </radialGradient>
  <linearGradient id="gold-band" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f6e2a4"/><stop offset="0.35" stop-color="#d8b45f"/>
    <stop offset="0.75" stop-color="#b08a3b"/><stop offset="1" stop-color="#e3c57c"/>
  </linearGradient>
  <linearGradient id="gold-wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fbe9b4"/><stop offset="0.5" stop-color="#d4ae58"/><stop offset="1" stop-color="#a37f33"/>
  </linearGradient>
  <linearGradient id="gold-wall-v" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fbe9b4"/><stop offset="0.5" stop-color="#d4ae58"/><stop offset="1" stop-color="#a37f33"/>
  </linearGradient>
  <radialGradient id="gold-ball" cx="35%" cy="30%" r="75%">
    <stop offset="0" stop-color="#fff4cf"/><stop offset="0.45" stop-color="#e0be6a"/><stop offset="1" stop-color="#a8843a"/>
  </radialGradient>
</defs></svg>"""


def art(markup, label=""):
    return f'<svg class="gem-art" viewBox="0 0 100 100" role="img" aria-label="{label}">{markup}</svg>'
