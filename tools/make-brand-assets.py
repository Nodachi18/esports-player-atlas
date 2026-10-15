#!/usr/bin/env python3
"""Regenerate the favicons and the Open Graph image in public/.

The output is committed, so this only runs when the mark or the wording changes:
    python3 tools/make-brand-assets.py

The mark is the same pentagon the header draws (public/app/views.js builds it from
polygonPoints(44, [1,1,1,1,1], 50, 50)) — five vertices for the five Categories, first
one at the top, running clockwise. Colours come from :root in public/app/styles.css.
Barlow is read straight out of public/fonts/, so the wordmark here and the wordmark in
the header are the same typeface rather than two that nearly match.

Needs Pillow, fonttools and brotli; none of them are a runtime or build dependency.
"""

import io
import math
import pathlib
import struct

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

VOID = (5, 11, 16, 255)        # --void
ROLE = (117, 200, 250, 255)    # --role
INK = (234, 245, 252, 255)     # --ink
MUTE = (136, 161, 178, 255)    # --mute
LINE_DIM = (23, 50, 68, 255)   # --line-dim

# Supersampling factor. Pillow's draw is aliased, so everything is drawn large and
# resized down with LANCZOS; that is what produces the smooth edges.
SS = 8


def pentagon(cx, cy, r, scale=1.0):
    """Five points, index 0 at the top running clockwise — vertex() in scores.js."""
    return [
        (
            cx + math.cos(-math.pi / 2 + i * 2 * math.pi / 5) * r * scale,
            cy + math.sin(-math.pi / 2 + i * 2 * math.pi / 5) * r * scale,
        )
        for i in range(5)
    ]


def load_font(file, size):
    """Barlow ships as woff2, which Pillow cannot open; unpack it in memory."""
    font = TTFont(PUBLIC / "fonts" / file)
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size)


def tracked_text(draw, xy, text, font, fill, tracking):
    """Pillow has no letter-spacing, and the wordmark is set at .14em."""
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += draw.textlength(char, font=font) + tracking
    return x - tracking


def tracked_width(draw, text, font, tracking):
    return sum(draw.textlength(c, font=font) for c in text) + tracking * (len(text) - 1)


def icon(size, radius_ratio=0.22, bleed=False):
    """The app icon: the pentagon on a --void tile, drawn at SS× and reduced.

    `bleed` fills the whole square (iOS masks its own corners and composites anything
    transparent onto white, so the apple-touch icon must be opaque to the edge).
    """
    px = size * SS
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if bleed:
        draw.rectangle([0, 0, px, px], fill=VOID)
    else:
        draw.rounded_rectangle([0, 0, px - 1, px - 1], radius=px * radius_ratio, fill=VOID)

    # Optically centred: a pentagon's bounding box sits above its circumcentre, so the
    # mark is nudged down or it reads as top-heavy.
    points = pentagon(px / 2, px * 0.521, px * 0.345)
    draw.line(points + [points[0]], fill=ROLE, width=round(px * 0.078), joint="curve")
    # `joint="curve"` rounds the joins but leaves the two ends of the path open.
    r = px * 0.039
    draw.ellipse([points[0][0] - r, points[0][1] - r, points[0][0] + r, points[0][1] + r], fill=ROLE)

    return img.resize((size, size), Image.LANCZOS)


def write_ico(path, sizes):
    """Pillow's ICO writer downsamples one image for every entry, which turns the 16px
    frame to mush. Each size is rendered at its own scale instead and the container —
    a header, one directory entry each, then the PNGs — is written by hand."""
    frames = []
    for size in sizes:
        buf = io.BytesIO()
        icon(size).save(buf, format="PNG")
        frames.append(buf.getvalue())

    offset = 6 + 16 * len(sizes)
    out = [struct.pack("<HHH", 0, 1, len(sizes))]
    for size, data in zip(sizes, frames):
        out.append(struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset))
        offset += len(data)
    out.extend(frames)
    path.write_bytes(b"".join(out))


def og_image():
    """1200×630 — the size every unfurler crops to, so nothing important near the edge."""
    w, h = 1200, 630
    img = Image.new("RGBA", (w * 2, h * 2), VOID)
    draw = ImageDraw.Draw(img)

    # A radar, rings and spokes, running off the right edge: the thing the site actually
    # draws on every profile, dimmed to --line-dim so it stays a background. Drawn on its
    # own layer because ImageDraw overwrites pixels rather than blending into them, so a
    # translucent fill drawn straight onto the canvas comes out opaque.
    radar = Image.new("RGBA", img.size, (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(radar)
    cx, cy, r = w * 2 * 0.785, h * 2 * 0.52, h * 2 * 0.40
    for ring in (0.25, 0.5, 0.75, 1.0):
        ring_pts = pentagon(cx, cy, r, ring)
        rdraw.line(ring_pts + [ring_pts[0]], fill=LINE_DIM, width=4, joint="curve")
    for point in pentagon(cx, cy, r):
        rdraw.line([(cx, cy), point], fill=LINE_DIM, width=4)
    # One plotted rating, the shape a profile page shows.
    plot = [pentagon(cx, cy, r, s)[i] for i, s in enumerate([0.82, 0.55, 0.72, 0.47, 0.65])]
    rdraw.polygon(plot, fill=(117, 200, 250, 36))
    rdraw.line(plot + [plot[0]], fill=(117, 200, 250, 190), width=6, joint="curve")
    img = Image.alpha_composite(img, radar)
    draw = ImageDraw.Draw(img)

    # The mark, left, at the same weight as the header's.
    mcx, mcy, mr = 150, 150, 54
    pts = pentagon(mcx, mcy, mr)
    draw.line(pts + [pts[0]], fill=ROLE, width=11, joint="curve")
    draw.ellipse([pts[0][0] - 5.5, pts[0][1] - 5.5, pts[0][0] + 5.5, pts[0][1] + 5.5], fill=ROLE)

    wordmark = load_font("barlow-condensed-700-latin.woff2", 150)
    body = load_font("barlow-500-latin.woff2", 58)

    tracked_text(draw, (238, 76), "PLAYER ATLAS", wordmark, INK, 150 * 0.14)
    draw.text((154, 330), "Community and professional ratings", font=body, fill=MUTE)
    draw.text((154, 404), "for competitive players.", font=body, fill=MUTE)

    # Five Categories, named, because they are what a rating actually is.
    label = load_font("barlow-700-latin.woff2", 36)
    x, y = 154, 1120
    for i, cat in enumerate(["STRATEGY", "TACTICS", "MICRO", "MACRO", "DECISIONS"]):
        if i:
            draw.text((x, y), "·", font=label, fill=LINE_DIM)
            x += draw.textlength("·", font=label) + 26
        width = tracked_width(draw, cat, label, 36 * 0.1)
        tracked_text(draw, (x, y), cat, label, ROLE if i == 0 else MUTE, 36 * 0.1)
        x += width + 26

    return img.resize((w, h), Image.LANCZOS).convert("RGB")


def main():
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Player Atlas">
  <rect width="100" height="100" rx="22" fill="#050b10"/>
  <polygon points="{' '.join(f'{x:.1f},{y:.1f}' for x, y in pentagon(50, 52.1, 33))}"
           fill="none" stroke="#75c8fa" stroke-width="7.8" stroke-linejoin="round"/>
</svg>
"""
    (PUBLIC / "icon.svg").write_text(svg)

    write_ico(PUBLIC / "favicon.ico", [16, 32, 48])
    icon(180, bleed=True).convert("RGB").save(PUBLIC / "apple-touch-icon.png")
    for size in (192, 512):
        icon(size).save(PUBLIC / f"icon-{size}.png")
    og_image().save(PUBLIC / "og.png", optimize=True)

    for name in ["icon.svg", "favicon.ico", "apple-touch-icon.png",
                 "icon-192.png", "icon-512.png", "og.png"]:
        print(f"{name:24} {(PUBLIC / name).stat().st_size / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
