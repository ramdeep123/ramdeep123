"""Generate the texture set for the Japan city map.

Run with any Python 3 that has Pillow + numpy:
    python make_textures.py

Writes JPG/PNG files into ./textures. Japanese text is drawn with the IPAGothic
font (fonts-ipafont-gothic on Debian/Ubuntu); pass --font to use another
CJK font such as Noto Sans JP or Hiragino on macOS.

Every tiling texture is seamless, and each one's real-world size in metres is
listed in TILE_METRES so build_city.py can map UVs at true scale.
"""
import argparse
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "textures")
FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "C:/Windows/Fonts/msgothic.ttc",
]
FONT_PATH = None

rng = np.random.default_rng(7)
random.seed(7)


# ---------------------------------------------------------------- helpers
def font(size):
    return ImageFont.truetype(FONT_PATH, size)


def tile_noise(size, cells, octaves=4, persistence=0.5):
    """Seamless fractal value noise in [0,1], shape (size, size)."""
    total = np.zeros((size, size), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        if c >= size:
            break
        base = rng.random((c, c)).astype(np.float32)
        big = np.tile(base, (3, 3))
        img = Image.fromarray((big * 255).astype(np.uint8)).resize(
            (size * 3, size * 3), Image.BICUBIC)
        arr = np.asarray(img, np.float32)[size:2 * size, size:2 * size] / 255.0
        total += arr * amp
        norm += amp
        amp *= persistence
    total /= norm
    return (total - total.min()) / max(1e-6, total.max() - total.min())


def colorize(gray, c0, c1):
    c0, c1 = np.array(c0, np.float32), np.array(c1, np.float32)
    return gray[..., None] * (c1 - c0) + c0


def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def save(img, name, quality=88):
    path = os.path.join(OUT, name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(path, quality=quality, optimize=True)
    else:
        img.save(path, optimize=True)
    print("  ", name, img.size)


def grain(img, amount=10, cells=64):
    a = np.asarray(img.convert("RGB"), np.float32)
    n = tile_noise(img.size[0], cells, 3)[: img.size[1], : img.size[0]] if img.size[0] == img.size[1] else \
        rng.random((img.size[1], img.size[0])).astype(np.float32)
    a += (n[..., None] - 0.5) * amount * 2
    return to_img(a)


def text_fit(draw, box, text, fill, max_size=200, vertical=False, stretch_font=None):
    """Draw text centred in box, shrinking until it fits."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    size = max_size
    while size > 6:
        f = stretch_font or font(size)
        if stretch_font is None:
            f = font(size)
        if vertical:
            bbs = [draw.textbbox((0, 0), ch, font=f) for ch in text]
            tw = max(b[2] - b[0] for b in bbs)
            th = sum(size * 1.05 for _ in text)
        else:
            bb = draw.textbbox((0, 0), text, font=f)
            tw, th = bb[2] - bb[0], bb[3] - bb[1]
        if tw <= w * 0.9 and th <= h * 0.86:
            break
        size -= 2
    f = font(size)
    if vertical:
        y = y0 + (h - size * 1.05 * len(text)) / 2
        for ch in text:
            bb = draw.textbbox((0, 0), ch, font=f)
            draw.text((x0 + (w - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1] * 0.5), ch, font=f, fill=fill)
            y += size * 1.05
    else:
        bb = draw.textbbox((0, 0), text, font=f)
        draw.text((x0 + (w - (bb[2] - bb[0])) / 2 - bb[0], y0 + (h - (bb[3] - bb[1])) / 2 - bb[1]),
                  text, font=f, fill=fill)
    return size


# ------------------------------------------------------------ ground set
def asphalt():
    s = 1024
    base = tile_noise(s, 4, 6, 0.55)
    fine = rng.random((s, s)).astype(np.float32)
    a = colorize(base, (48, 48, 50), (74, 73, 72))
    # aggregate speckles
    a += ((fine > 0.985) * 38 - (fine < 0.02) * 18)[..., None]
    a += (rng.random((s, s, 1)) - 0.5) * 14
    # tyre-polished darker bands and oil stains
    stains = tile_noise(s, 3, 3)
    a *= (1 - np.clip(stains - 0.62, 0, 1) * 0.9)[..., None]
    # patched repair rectangles
    img = to_img(a)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(3):
        x, y = rng.integers(0, s - 260, 2)
        w, h = rng.integers(90, 260, 2)
        d.rectangle([x, y, x + w, y + h], fill=(34, 34, 36, 34))
    # hairline cracks
    for _ in range(14):
        x, y = rng.integers(0, s, 2).astype(float)
        pts = [(x, y)]
        ang = rng.random() * 6.28
        for _ in range(rng.integers(6, 18)):
            ang += rng.normal(0, 0.6)
            x += np.cos(ang) * 14
            y += np.sin(ang) * 14
            pts.append((x % s, y % s))
        for p, q in zip(pts, pts[1:]):
            if abs(p[0] - q[0]) < 40 and abs(p[1] - q[1]) < 40:
                d.line([p, q], fill=(22, 22, 24, 150), width=2)
    save(img, "asphalt.jpg")


def sidewalk():
    """30 cm square concrete pavers with a brick-colour band, Japanese style."""
    s, n = 1024, 8                       # 8 x 8 slabs -> 2.4 m tile
    cell = s // n
    img = Image.new("RGB", (s, s), (120, 118, 112))
    d = ImageDraw.Draw(img)
    for i in range(n):
        for j in range(n):
            g = rng.normal(0, 7)
            if j in (3, 4):              # warm interlocking band
                c = (int(150 + g), int(112 + g), int(96 + g))
            else:
                c = (int(176 + g), int(172 + g), int(164 + g))
            d.rectangle([i * cell + 2, j * cell + 2, (i + 1) * cell - 3, (j + 1) * cell - 3], fill=c)
    a = np.asarray(img, np.float32)
    a *= (0.88 + 0.2 * tile_noise(s, 6, 5))[..., None]
    a += (rng.random((s, s, 1)) - 0.5) * 16
    save(to_img(a), "sidewalk.jpg")


def tactile():
    """Yellow tenji blocks, one 30 cm block per texture: guide bars and warning dots."""
    s = 256
    for name, kind in (("tactile_bars.jpg", "bars"), ("tactile_dots.jpg", "dots")):
        img = Image.new("RGB", (s, s), (226, 182, 28))
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, s - 1, s - 1], outline=(150, 118, 14), width=3)
        if kind == "dots":
            for i in range(5):
                for j in range(5):
                    cx, cy = 26 + i * 51, 26 + j * 51
                    d.ellipse([cx - 13, cy - 13, cx + 13, cy + 13], fill=(244, 204, 52), outline=(170, 132, 18))
        else:
            for i in range(4):
                cx = 32 + i * 64
                d.rounded_rectangle([cx - 11, 4, cx + 11, s - 5], 10, fill=(244, 204, 52), outline=(170, 132, 18))
        save(grain(img, 8), name)


def concrete(name, c0, c1, cells=5, streaks=True, s=1024):
    n = tile_noise(s, cells, 6)
    a = colorize(n, c0, c1)
    a += (rng.random((s, s, 1)) - 0.5) * 10
    if streaks:   # vertical rain streaks
        st = tile_noise(s, 24, 2)[:, :1].repeat(s, 1).T
        st = np.asarray(Image.fromarray((st * 255).astype(np.uint8)).resize((s, s)), np.float32) / 255
        a *= (1 - np.clip(st - 0.55, 0, 1) * 0.35)[..., None]
    save(to_img(a), name)


def ground():
    s = 1024
    n = tile_noise(s, 5, 6)
    a = colorize(n, (112, 110, 104), (150, 146, 138))
    g = tile_noise(s, 3, 4)
    grass = colorize(tile_noise(s, 40, 3), (92, 104, 70), (118, 128, 86))
    m = np.clip((g - 0.7) * 3, 0, 0.6)[..., None]
    a = a * (1 - m) + grass * m
    a += (rng.random((s, s, 1)) - 0.5) * 18
    save(to_img(a), "ground.jpg")


def grass():
    s = 1024
    n = tile_noise(s, 6, 6)
    a = colorize(n, (58, 84, 40), (110, 132, 62))
    a += (rng.random((s, s, 1)) - 0.5) * 34
    save(to_img(a), "grass.jpg")


def gravel():
    s = 1024
    img = Image.new("RGB", (s, s), (170, 166, 156))
    d = ImageDraw.Draw(img)
    for _ in range(26000):
        x, y = rng.integers(0, s, 2)
        r = rng.integers(2, 6)
        g = int(rng.normal(178, 22))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(g, g - 3, g - 10))
    save(img, "gravel.jpg")


def leaves():
    s = 512
    a = colorize(tile_noise(s, 10, 5), (34, 62, 26), (96, 132, 52))
    spots = rng.random((s, s))
    a[spots > 0.93] *= 1.35
    a[spots < 0.08] *= 0.55
    save(to_img(a), "leaves.jpg")


def block_wall():
    """Concrete block wall (ブロック塀): 0.4 x 0.2 m blocks, tile 1.6 x 1.6 m."""
    s = 512
    img = Image.new("RGB", (s, s), (110, 108, 102))
    d = ImageDraw.Draw(img)
    bw, bh = s // 4, s // 8
    for r in range(8):
        off = (bw // 2) if r % 2 else 0
        for c in range(-1, 5):
            x = c * bw + off
            g = int(rng.normal(168, 8))
            d.rectangle([x + 2, r * bh + 2, x + bw - 2, r * bh + bh - 2], fill=(g, g - 2, g - 8))
    a = np.asarray(img, np.float32) * (0.85 + 0.25 * tile_noise(s, 5, 4))[..., None]
    save(to_img(a), "block_wall.jpg")


# ------------------------------------------------------------- roofs
def roof_flat():
    s = 1024
    a = colorize(tile_noise(s, 5, 6), (104, 104, 100), (150, 148, 140))
    img = to_img(a)
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(0, s, 128):   # waterproof membrane seams
        d.line([(i, 0), (i, s)], fill=(80, 80, 78, 120), width=3)
    for _ in range(12):
        x, y = rng.integers(0, s, 2)
        r = rng.integers(30, 120)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(60, 62, 56, 40))
    save(grain(img, 8), "roof_flat.jpg")


def roof_kawara(name, tint):
    """Japanese clay tile roof, tile = 2 m x 2 m, rows run along the eave (u)."""
    s = 512
    rows, cols = 8, 7
    a = np.zeros((s, s, 3), np.float32)
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    wave = 0.5 + 0.5 * np.cos((xx / s * cols) * 2 * np.pi)          # tile barrels
    rowpos = (yy / s * rows) % 1.0
    shade = 0.35 + 0.65 * wave ** 0.7 * (0.75 + 0.25 * rowpos)
    shade *= np.where(rowpos > 0.92, 0.6, 1.0)                        # overlap shadow
    base = np.array(tint, np.float32)
    a = shade[..., None] * base
    a *= (0.9 + 0.2 * tile_noise(s, 6, 4))[..., None]
    save(to_img(a), name)


def roof_metal(name, tint):
    """Standing-seam metal roof (トタン/ガルバリウム), seams down the slope."""
    s = 512
    xx = np.mgrid[0:s, 0:s][1].astype(np.float32)
    seam = ((xx / s * 4) % 1.0)
    shade = np.where(seam < 0.06, 0.6, 1.0) * (0.9 + 0.1 * np.cos(seam * 2 * np.pi))
    a = shade[..., None] * np.array(tint, np.float32)
    a *= (0.85 + 0.25 * tile_noise(s, 4, 4))[..., None]
    save(to_img(a), name)


# ------------------------------------------------------------- facades
def sky_glass(w, h, tint=(118, 140, 160), dark=0.55):
    yy = np.linspace(0, 1, h)[:, None]
    g = (1 - yy) * 1.0 + yy * dark
    a = np.ones((h, w, 3), np.float32) * np.array(tint) * g[..., None]
    a += (tile_noise(max(w, h), 4, 3)[:h, :w, None] - 0.5) * 30
    return a


def paste_window(img, box, tint=(110, 132, 150), curtain=None, frame=(210, 212, 214), fw=4, mullion=True):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    if w < 4 or h < 4:
        return
    glass = to_img(sky_glass(w, h, tint))
    d = ImageDraw.Draw(glass, "RGBA")
    if curtain:
        cw = int(w * curtain[1])
        if curtain[0] == "left":
            d.rectangle([0, 0, cw, h], fill=(226, 216, 196, 235))
        elif curtain[0] == "both":
            d.rectangle([0, 0, cw // 2, h], fill=(220, 214, 200, 235))
            d.rectangle([w - cw // 2, 0, w, h], fill=(220, 214, 200, 235))
        elif curtain[0] == "blind":
            for yb in range(0, int(h * curtain[1]), 5):
                d.line([(0, yb), (w, yb)], fill=(218, 218, 210, 230), width=3)
    img.paste(glass, (x0, y0))
    d = ImageDraw.Draw(img)
    d.rectangle([x0, y0, x1, y1], outline=frame, width=fw)
    if mullion and w > 40:
        d.line([(x0 + w // 2, y0), (x0 + w // 2, y1)], fill=frame, width=max(2, fw - 1))


def rand_curtain():
    r = rng.random()
    if r < 0.3:
        return None
    if r < 0.55:
        return ("left", 0.25 + rng.random() * 0.4)
    if r < 0.8:
        return ("both", 0.3 + rng.random() * 0.5)
    return ("blind", 0.2 + rng.random() * 0.8)


def wall_base(w, h, c0, c1, cells=4):
    n = tile_noise(max(w, h), cells, 5)[:h, :w]
    a = colorize(n, c0, c1)
    a += (rng.random((h, w, 1)) - 0.5) * 8
    return to_img(a)


def facade_office():
    """Glass curtain wall: 4 bays x 4 floors, bay 3.6 m, floor 3.6 m."""
    s = 1024
    img = to_img(sky_glass(s, s, (96, 124, 146), 0.7))
    d = ImageDraw.Draw(img, "RGBA")
    bay, fl = s // 4, s // 4
    for f in range(4):
        y0 = f * fl
        d.rectangle([0, y0 + fl - 46, s, y0 + fl], fill=(70, 78, 86, 255))        # spandrel
        for b in range(4):
            x0 = b * bay
            if rng.random() < 0.5:
                d.rectangle([x0, y0, x0 + bay, y0 + int(fl * rng.random() * 0.6)], fill=(214, 216, 212, 150))
            for k in range(3):
                d.line([(x0 + k * bay // 3, y0), (x0 + k * bay // 3, y0 + fl)], fill=(52, 58, 64), width=6)
        d.line([(0, y0), (s, y0)], fill=(52, 58, 64), width=8)
    save(grain(img, 6), "facade_office.jpg")


def facade_midrise(name, c0, c1, frame):
    """Punched windows: 4 bays x 4 floors, 3.2 m each."""
    s = 1024
    img = wall_base(s, s, c0, c1)
    d = ImageDraw.Draw(img, "RGBA")
    bay = fl = s // 4
    for f in range(4):
        y0 = f * fl
        d.rectangle([0, y0 + fl - 12, s, y0 + fl - 4], fill=(0, 0, 0, 30))
        for b in range(4):
            x0 = b * bay
            wide = rng.random() < 0.6
            if wide:
                paste_window(img, (x0 + 30, y0 + 60, x0 + bay - 30, y0 + fl - 70), curtain=rand_curtain(), frame=frame)
            else:
                paste_window(img, (x0 + 70, y0 + 50, x0 + bay - 70, y0 + fl - 60), curtain=rand_curtain(), frame=frame)
            if rng.random() < 0.35:   # wall-mounted AC unit
                ax = x0 + bay - 66
                d.rectangle([ax, y0 + fl - 64, ax + 52, y0 + fl - 22], fill=(226, 226, 220))
                d.ellipse([ax + 8, y0 + fl - 58, ax + 38, y0 + fl - 28], outline=(150, 150, 146), width=3)
    a = np.asarray(img, np.float32)
    st = np.asarray(Image.fromarray((tile_noise(s, 30, 2) * 255).astype(np.uint8)).resize((s, 1)).resize((s, s)), np.float32) / 255
    a *= (1 - np.clip(st - 0.6, 0, 1) * 0.4)[..., None]
    save(to_img(a), name)


def facade_mansion(name, c0, c1):
    """Apartment ("mansion") recessed wall behind balconies: 3 units x 4 floors.
    Unit 4.5 m wide, floor 3.0 m. Sliding doors + small windows + AC units."""
    w, h = 1024, 1092   # 13.5 x 12 m  (~ 76 px / m)
    img = wall_base(w, h, c0, c1)
    d = ImageDraw.Draw(img, "RGBA")
    uw, fl = w / 3, h / 4
    for f in range(4):
        y0 = f * fl
        for u in range(3):
            x0 = u * uw
            # sliding glass door
            paste_window(img, (x0 + 30, y0 + 40, x0 + uw * 0.62, y0 + fl - 6), curtain=rand_curtain(),
                         frame=(180, 182, 184), fw=5)
            # small window
            paste_window(img, (x0 + uw * 0.7, y0 + 60, x0 + uw - 30, y0 + fl * 0.55), curtain=rand_curtain(),
                         frame=(180, 182, 184), fw=4, mullion=False)
            # AC outdoor unit sitting on the balcony floor
            ax = x0 + uw * 0.68
            d.rectangle([ax, y0 + fl - 70, ax + 70, y0 + fl - 8], fill=(232, 232, 226))
            d.ellipse([ax + 8, y0 + fl - 64, ax + 52, y0 + fl - 20], outline=(150, 150, 146), width=4)
            # laundry on the pole
            if rng.random() < 0.45:
                for k in range(rng.integers(2, 6)):
                    lx = x0 + 50 + k * 34
                    col = tuple(int(v) for v in rng.integers(120, 250, 3))
                    d.rectangle([lx, y0 + 52, lx + 26, y0 + 52 + rng.integers(40, 90)], fill=col)
                d.line([(x0 + 40, y0 + 50), (x0 + uw * 0.62, y0 + 50)], fill=(160, 160, 160), width=3)
            # partition between units
            d.rectangle([x0 + uw - 8, y0, x0 + uw, y0 + fl], fill=(200, 200, 196))
        d.rectangle([0, y0, w, y0 + 10], fill=(0, 0, 0, 50))
    save(grain(img, 6), name)


def facade_house(name, c0, c1):
    """Detached house siding: 2 bays (3.6 m) x 2 floors (2.9 m) -> 7.2 x 5.8 m."""
    w, h = 1024, 824
    img = wall_base(w, h, c0, c1, cells=3)
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(0, h, 14):               # lap siding
        d.line([(0, y), (w, y)], fill=(0, 0, 0, 26), width=2)
    bw, fl = w / 2, h / 2
    for f in range(2):
        for b in range(2):
            x0, y0 = b * bw, f * fl
            kind = rng.random()
            if kind < 0.45:
                paste_window(img, (x0 + 120, y0 + 90, x0 + bw - 120, y0 + fl - 120), curtain=rand_curtain(),
                             frame=(150, 146, 140), fw=6)
                # rain shutter box
                d.rectangle([x0 + 112, y0 + 70, x0 + bw - 112, y0 + 92], fill=(150, 146, 140))
            elif kind < 0.75:
                paste_window(img, (x0 + 170, y0 + 110, x0 + bw - 170, y0 + 200), curtain=rand_curtain(),
                             frame=(150, 146, 140), fw=5, mullion=False)
                d.line([(x0 + 160, y0 + 104), (x0 + bw - 160, y0 + 104)], fill=(120, 120, 120), width=6)
            # else blank wall
    save(grain(img, 6), name)


def facade_apaato():
    """2-storey wooden apartment (アパート), corridor side: 4 doors x 2 floors -> 12 x 5.8 m."""
    w, h = 1024, 496
    img = wall_base(w, h, (196, 186, 166), (222, 214, 196), cells=3)
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(0, h, 12):
        d.line([(0, y), (w, y)], fill=(0, 0, 0, 24), width=2)
    uw, fl = w / 4, h / 2
    for f in range(2):
        for u in range(4):
            x0, y0 = u * uw, f * fl
            d.rectangle([x0 + 30, y0 + 40, x0 + 100, y0 + fl - 6], fill=(124, 104, 86), outline=(80, 66, 54), width=3)
            d.ellipse([x0 + 88, y0 + 140, x0 + 96, y0 + 148], fill=(210, 190, 120))
            paste_window(img, (x0 + 130, y0 + 60, x0 + uw - 40, y0 + 130), curtain=rand_curtain(),
                         frame=(170, 170, 166), fw=4, mullion=False)
            for k in range(3):  # window grille
                xx = x0 + 140 + k * (uw - 190) / 3
                d.line([(xx, y0 + 60), (xx, y0 + 130)], fill=(150, 150, 150), width=3)
            d.rectangle([x0 + 40, y0 + 18, x0 + 92, y0 + 34], fill=(240, 240, 236))  # name plate / meter
    save(grain(img, 6), "facade_apaato.jpg")


def facade_blank(name, c0, c1):
    s = 512
    img = wall_base(s, s, c0, c1, cells=3)
    a = np.asarray(img, np.float32)
    st = np.asarray(Image.fromarray((tile_noise(s, 20, 2) * 255).astype(np.uint8)).resize((s, 1)).resize((s, s)), np.float32) / 255
    a *= (1 - np.clip(st - 0.5, 0, 1) * 0.5)[..., None]
    save(to_img(a), name)


# ----------------------------------------------------- signs & shopfronts
SHOPS = [
    ("ラーメン 麺屋 桜", (200, 30, 30), (255, 255, 255), "noren"),
    ("薬局 ドラッグ", (20, 110, 190), (255, 255, 255), "open"),
    ("カフェ 珈琲館", (70, 46, 34), (240, 226, 200), "glass"),
    ("不動産 賃貸", (240, 140, 20), (255, 255, 255), "posters"),
    ("居酒屋 たぬき", (40, 40, 40), (250, 230, 120), "noren"),
    ("歯科 クリニック", (240, 240, 240), (30, 120, 170), "glass"),
    ("美容室 HAIR", (230, 230, 225), (60, 60, 60), "glass"),
    ("書店 本の森", (30, 90, 60), (255, 255, 255), "open"),
    ("牛丼 はやし屋", (240, 120, 0), (255, 255, 255), "glass"),
    ("パン ベーカリー", (150, 90, 40), (255, 240, 210), "open"),
    ("100円ショップ", (220, 20, 110), (255, 255, 255), "open"),
    ("シャッター", None, None, "shutter"),
]


def shop_cell(spec, w=512, h=340):
    name, bg, fg, kind = spec
    img = Image.new("RGB", (w, h), (40, 40, 42))
    d = ImageDraw.Draw(img, "RGBA")
    band = int(h * 0.26)
    if kind == "shutter":
        img.paste(to_img(np.ones((h, w, 3)) * 150), (0, 0))
        d = ImageDraw.Draw(img, "RGBA")
        d.rectangle([0, 0, w, band], fill=(170, 168, 160))
        for y in range(band + 6, h, 8):
            d.line([(14, y), (w - 14, y)], fill=(110, 110, 108), width=3)
        d.rectangle([0, band, 14, h], fill=(90, 90, 90))
        d.rectangle([w - 14, band, w, h], fill=(90, 90, 90))
        for _ in range(3):   # tags of grime
            x = rng.integers(40, w - 80)
            d.rectangle([x, h - 60, x + 50, h - 10], fill=(90, 90, 90, 60))
        return img
    d.rectangle([0, 0, w, band], fill=bg)
    d.rectangle([0, band - 6, w, band], fill=(0, 0, 0, 80))
    text_fit(d, (10, 4, w - 10, band - 6), name, fg, 64)
    # interior / glass
    glass = sky_glass(w, h - band, (150, 160, 162), 0.45)
    interior = Image.fromarray(np.clip(glass, 0, 255).astype(np.uint8))
    di = ImageDraw.Draw(interior, "RGBA")
    for _ in range(18):   # shelves / products / people silhouettes
        x, y = rng.integers(0, w, 2)
        c = tuple(int(v) for v in rng.integers(60, 240, 3)) + (150,)
        di.rectangle([x, y + 40, x + rng.integers(10, 60), y + 40 + rng.integers(8, 40)], fill=c)
    di.rectangle([0, h - band - 30, w, h - band], fill=(60, 60, 60, 200))
    img.paste(interior, (0, band))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, band, w, h], outline=(70, 70, 72), width=8)
    d.line([(w * 0.62, band), (w * 0.62, h)], fill=(70, 70, 72), width=6)  # door frame
    d.line([(w * 0.31, band), (w * 0.31, h)], fill=(70, 70, 72), width=4)
    if kind == "noren":
        nb = (bg[0] // 2 + 20, bg[1] // 2 + 10, bg[2] // 2 + 40)
        for i in range(4):
            x = w * 0.62 + 8 + i * (w * 0.38 - 16) / 4
            d.rectangle([x + 2, band + 6, x + (w * 0.38 - 16) / 4 - 2, band + 110], fill=nb)
        d.text((w * 0.66, band + 30), "営業中", font=font(26), fill=(255, 255, 255))
    if kind == "posters":
        for i in range(8):
            x = 20 + (i % 4) * 58
            y = band + 20 + (i // 4) * 80
            d.rectangle([x, y, x + 50, y + 70], fill=(250, 250, 245), outline=(200, 60, 30), width=2)
            for k in range(5):
                d.line([(x + 6, y + 10 + k * 12), (x + 44, y + 10 + k * 12)], fill=(90, 90, 90), width=2)
    if kind == "open":  # goods out front
        for i in range(6):
            x = 18 + i * 40
            c = tuple(int(v) for v in rng.integers(80, 255, 3))
            d.rectangle([x, h - 90, x + 34, h - 10], fill=c, outline=(50, 50, 50))
    # A-frame sign
    if rng.random() < 0.5 and kind != "shutter":
        d.rectangle([w * 0.05, h - 70, w * 0.05 + 40, h - 6], fill=(30, 30, 30), outline=(200, 200, 200), width=2)
    return img


def shop_atlas():
    cw, ch = 512, 340
    atlas = Image.new("RGB", (cw * 4, ch * 3))
    for i, spec in enumerate(SHOPS):
        atlas.paste(shop_cell(spec, cw, ch), ((i % 4) * cw, (i // 4) * ch))
    save(atlas, "shop_atlas.jpg", 90)


KANBAN = [
    ("カラオケ", (220, 0, 90), (255, 255, 255)),
    ("焼肉", (20, 20, 20), (255, 210, 0)),
    ("歯科", (255, 255, 255), (0, 110, 190)),
    ("居酒屋", (190, 20, 20), (255, 255, 255)),
    ("整骨院", (0, 140, 90), (255, 255, 255)),
    ("英会話", (255, 180, 0), (30, 30, 30)),
    ("麻雀", (30, 60, 150), (255, 255, 255)),
    ("ホテル", (110, 20, 140), (255, 255, 255)),
]


def kanban_atlas():
    cw, ch = 128, 512
    atlas = Image.new("RGB", (cw * 8, ch))
    d = ImageDraw.Draw(atlas)
    for i, (t, bg, fg) in enumerate(KANBAN):
        x0 = i * cw
        d.rectangle([x0, 0, x0 + cw - 1, ch - 1], fill=bg, outline=(200, 200, 200), width=6)
        text_fit(d, (x0 + 8, 20, x0 + cw - 8, ch - 20), t, fg, 110, vertical=True)
    save(atlas, "kanban_atlas.png")


BILLBOARDS = [
    ("新発売 さくら緑茶", (236, 244, 230), (30, 110, 40)),
    ("SAKURA BANK 桜銀行", (0, 60, 130), (255, 255, 255)),
    ("引越しは 0120-123-456", (250, 210, 0), (20, 20, 20)),
    ("英会話 ABC スクール", (230, 30, 40), (255, 255, 255)),
]


def billboard_atlas():
    cw, ch = 1024, 340
    atlas = Image.new("RGB", (cw, ch * 4))
    d = ImageDraw.Draw(atlas)
    for i, (t, bg, fg) in enumerate(BILLBOARDS):
        y0 = i * ch
        d.rectangle([0, y0, cw, y0 + ch - 1], fill=bg)
        d.rectangle([0, y0, cw - 1, y0 + ch - 1], outline=(70, 70, 70), width=10)
        text_fit(d, (30, y0 + 20, cw - 30, y0 + ch - 20), t, fg, 150)
    save(atlas, "billboard_atlas.jpg", 90)


def konbini():
    """Convenience store front 12 m x 4 m."""
    w, h = 1536, 512
    img = to_img(sky_glass(w, h, (176, 186, 188), 0.6))
    d = ImageDraw.Draw(img, "RGBA")
    band = 130
    d.rectangle([0, 0, w, band], fill=(250, 250, 250))
    d.rectangle([0, 18, w, 44], fill=(0, 150, 80))
    d.rectangle([0, 44, w, 70], fill=(40, 90, 200))
    text_fit(d, (0, 70, w, band), "デイリーマート  DAILY MART  24時間営業", (0, 120, 70), 56)
    for i in range(14):   # shelves of goods visible through the glass
        for k in range(3):
            x = 40 + i * 104
            y = band + 80 + k * 90
            d.rectangle([x, y, x + 96, y + 70], fill=(225, 225, 220, 200))
            for j in range(6):
                c = tuple(int(v) for v in rng.integers(70, 255, 3)) + (230,)
                d.rectangle([x + 4 + j * 15, y + 20, x + 16 + j * 15, y + 64], fill=c)
    for x in range(0, w, 192):
        d.line([(x, band), (x, h)], fill=(190, 194, 196), width=10)
    d.rectangle([w * 0.42, band, w * 0.58, h], outline=(160, 164, 166), width=10)
    d.text((w * 0.445, band + 160), "自動ドア", font=font(34), fill=(30, 30, 30, 230))
    for i, t in enumerate(["からあげ", "おにぎり", "ATM", "コーヒー"]):
        x = 80 + i * 340
        d.rectangle([x, h - 120, x + 220, h - 60], fill=(240, 60, 40, 230))
        text_fit(d, (x, h - 120, x + 220, h - 60), t, (255, 255, 255), 40)
    save(img, "konbini.jpg", 90)


def station_sign():
    w, h = 2048, 256
    img = Image.new("RGB", (w, h), (246, 246, 244))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 30], fill=(0, 140, 70))
    d.rectangle([0, h - 30, w, h], fill=(0, 140, 70))
    text_fit(d, (60, 34, w * 0.62, h - 34), "桜ヶ丘駅", (20, 20, 20), 180)
    text_fit(d, (w * 0.6, 50, w - 60, h - 50), "Sakuragaoka Sta.", (40, 40, 40), 120)
    save(img, "station_sign.png")


def busstop_plate():
    """Round bus stop plate (front & back share it) + timetable."""
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([6, 6, s - 6, s - 6], fill=(255, 255, 255), outline=(230, 120, 0), width=26)
    d.rectangle([40, s * 0.36, s - 40, s * 0.64], fill=(230, 120, 0))
    text_fit(d, (60, s * 0.37, s - 60, s * 0.63), "バス停", (255, 255, 255), 120)
    text_fit(d, (70, 70, s - 70, s * 0.34), "都営", (230, 120, 0), 90)
    text_fit(d, (60, s * 0.66, s - 60, s - 80), "BUS STOP", (60, 60, 60), 60)
    save(img, "busstop_plate.png")
    w, h = 256, 512
    tt = Image.new("RGB", (w, h), (250, 250, 248))
    d = ImageDraw.Draw(tt)
    d.rectangle([0, 0, w, 60], fill=(0, 90, 160))
    text_fit(d, (0, 0, w, 60), "時刻表", (255, 255, 255), 44)
    for r in range(16):
        y = 70 + r * 27
        d.text((10, y), f"{6 + r:2d}", font=font(20), fill=(20, 20, 20))
        mins = sorted(rng.choice(60, rng.integers(2, 6), replace=False))
        d.text((50, y), " ".join(f"{m:02d}" for m in mins), font=font(20), fill=(40, 40, 40))
        d.line([(0, y + 25), (w, y + 25)], fill=(200, 200, 200))
    save(tt, "timetable.jpg")


def road_signs():
    """Inverted red triangle 止まれ, speed 40 disc, and a blue direction sign."""
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(8, 30), (s - 8, 30), (s / 2, s - 20)], fill=(255, 255, 255))
    d.polygon([(30, 44), (s - 30, 44), (s / 2, s - 50)], fill=(206, 16, 32))
    text_fit(d, (110, 70, s - 110, 260), "止まれ", (255, 255, 255), 110)
    text_fit(d, (150, 260, s - 150, 330), "STOP", (255, 255, 255), 60)
    save(img, "sign_stop.png")
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([8, 8, s - 8, s - 8], fill=(255, 255, 255))
    d.ellipse([20, 20, s - 20, s - 20], fill=(206, 16, 32))
    d.ellipse([84, 84, s - 84, s - 84], fill=(255, 255, 255))
    text_fit(d, (110, 110, s - 110, s - 110), "40", (20, 60, 160), 220)
    save(img, "sign_speed40.png")
    w, h = 1024, 512
    img = Image.new("RGB", (w, h), (20, 70, 170))
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, w - 10, h - 10], outline=(255, 255, 255), width=8)
    d.line([(w / 2, h - 40), (w / 2, 130)], fill=(255, 255, 255), width=40)
    d.polygon([(w / 2 - 60, 150), (w / 2 + 60, 150), (w / 2, 70)], fill=(255, 255, 255))
    d.line([(w / 2, 300), (140, 300)], fill=(255, 255, 255), width=40)
    d.polygon([(160, 240), (160, 360), (80, 300)], fill=(255, 255, 255))
    d.line([(w / 2, 300), (w - 140, 300)], fill=(255, 255, 255), width=40)
    d.polygon([(w - 160, 240), (w - 160, 360), (w - 80, 300)], fill=(255, 255, 255))
    text_fit(d, (w / 2 - 200, 20, w / 2 + 200, 80), "桜ヶ丘駅 Station", (255, 255, 255), 50)
    text_fit(d, (30, 330, 330, 460), "新宿 Shinjuku", (255, 255, 255), 50)
    text_fit(d, (w - 330, 330, w - 30, 460), "渋谷 Shibuya", (255, 255, 255), 50)
    save(img, "sign_direction.jpg")


def road_text():
    """Painted road text decals, white on transparent, stretched for drivers."""
    for name, txt in (("paint_tomare.png", "止まれ"), ("paint_bus.png", "バス")):
        w, h = 256, 1024
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        y = 10
        hch = (h - 20) / len(txt)
        for ch in txt:
            tmp = Image.new("L", (200, 200), 0)
            ImageDraw.Draw(tmp).text((100, 100), ch, font=font(180), fill=255, anchor="mm")
            tmp = tmp.resize((w - 20, int(hch)), Image.BICUBIC)
            img.paste((246, 246, 240, 255), (10, int(y)), tmp)
            y += hch
        # image top = far end of the marking, so drivers read it top-to-bottom
        save(img, name)


def vending():
    w, h = 512, 1024
    atlas = Image.new("RGB", (w * 2, h))
    for v, body in enumerate([(210, 30, 40), (30, 90, 180)]):
        img = Image.new("RGB", (w, h), body)
        d = ImageDraw.Draw(img)
        d.rectangle([24, 30, w - 24, h * 0.58], fill=(236, 240, 242))
        for r in range(4):
            for c in range(7):
                x = 40 + c * 62
                y = 50 + r * 140
                col = tuple(int(v2) for v2 in rng.integers(40, 255, 3))
                d.rounded_rectangle([x, y, x + 40, y + 100], 10, fill=col)
                d.rectangle([x - 4, y + 106, x + 48, y + 122], fill=(30, 30, 30))
                d.text((x + 4, y + 106), "120", font=font(14), fill=(255, 80, 60))
        d.rectangle([w - 120, h * 0.62, w - 40, h * 0.74], fill=(40, 40, 40))   # coin/IC panel
        d.rectangle([60, h * 0.82, w - 60, h * 0.93], fill=(20, 20, 20))        # dispenser
        text_fit(d, (40, h * 0.62, w - 140, h * 0.74), "つめた〜い", (255, 255, 255), 50)
        atlas.paste(img, (v * w, 0))
    save(atlas, "vending.jpg")


def bus_livery():
    """Japanese city bus (non-step), 10.5 m. Top half: left (door) side, front at
    image left. Bottom half: right side, front at image right. Text never mirrors."""
    w, h = 2048, 512
    sheet = Image.new("RGB", (w, h * 2))
    for row in range(2):
        img = Image.new("RGB", (w, h), (240, 240, 236))
        d = ImageDraw.Draw(img)
        d.rectangle([0, h * 0.70, w, h * 0.80], fill=(0, 140, 80))
        d.rectangle([0, h * 0.80, w, h * 0.84], fill=(250, 180, 0))
        d.rectangle([0, h * 0.94, w, h], fill=(60, 60, 60))
        for i in range(8):
            x0 = 230 + i * 220 if row == 0 else 60 + i * 220
            d.rectangle([x0, h * 0.18, x0 + 200, h * 0.62], fill=(40, 52, 62))
        if row == 0:
            d.rectangle([40, h * 0.15, 190, h * 0.92], fill=(50, 62, 70))       # front door
            d.rectangle([900, h * 0.15, 1080, h * 0.92], fill=(50, 62, 70))     # middle door
            sign = (150, 950)
        else:
            sign = (1100, 1900)
        d.rectangle([sign[0], h * 0.04, sign[1], h * 0.14], fill=(20, 20, 20))
        d.text((sign[0] + 20, h * 0.045), "桜ヶ丘駅 行  Sakuragaoka Sta.", font=font(40), fill=(255, 160, 0))
        d.text((1300 if row == 0 else 200, h * 0.86), "NAMMA KOTSU 2026", font=font(30), fill=(255, 255, 255))
        sheet.paste(img, (0, row * h))
    save(sheet, "bus_side.jpg", 90)


def berth_signs():
    """Bus terminal berth signs (のりば) + taxi, 4 rows."""
    w, h = 1024, 256
    rows = [("1", "市役所・西町 方面", "City Hall / Nishimachi"), ("2", "南公園 方面", "Minami Park"),
            ("3", "桜ヶ丘循環", "Sakuragaoka Loop"), ("T", "タクシーのりば", "Taxi")]
    sheet = Image.new("RGB", (w, h * 4))
    for i, (num, ja, en) in enumerate(rows):
        img = Image.new("RGB", (w, h), (20, 50, 110))
        d = ImageDraw.Draw(img)
        d.rectangle([20, 20, 230, h - 20], fill=(255, 255, 255))
        text_fit(d, (20, 20, 230, h - 20), num, (20, 50, 110), 190)
        text_fit(d, (260, 20, w - 20, 150), ("のりば  " if num != "T" else "") + ja, (255, 255, 255), 90)
        text_fit(d, (260, 160, w - 20, h - 20), en, (200, 220, 255), 60)
        sheet.paste(img, (0, i * h))
    save(sheet, "berth_signs.jpg", 90)


def train_livery():
    w, h = 2048, 256
    img = Image.new("RGB", (w, h), (200, 204, 208))
    d = ImageDraw.Draw(img)
    d.rectangle([0, h * 0.62, w, h * 0.72], fill=(0, 150, 70))
    for i in range(10):
        x0 = 60 + i * 200
        d.rectangle([x0, h * 0.18, x0 + 150, h * 0.52], fill=(40, 50, 60))
    for x0 in (360, 1020, 1680):
        d.rectangle([x0, h * 0.12, x0 + 110, h * 0.95], fill=(150, 156, 160), outline=(90, 90, 90), width=4)
        d.rectangle([x0 + 10, h * 0.2, x0 + 100, h * 0.5], fill=(40, 50, 60))
    a = np.asarray(img, np.float32)
    a += (np.linspace(-10, 10, w)[None, :, None])
    save(to_img(a), "train_side.jpg", 90)


def shrine():
    w, h = 512, 256
    img = Image.new("RGB", (w, h), (24, 24, 26))
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, w - 6, h - 6], outline=(200, 170, 70), width=8)
    text_fit(d, (20, 20, w - 20, h - 20), "桜ヶ丘神社", (230, 200, 90), 130)
    save(img, "shrine_plaque.jpg")


TILE_METRES = {
    "asphalt.jpg": 6.0, "sidewalk.jpg": 2.4, "tactile_bars.jpg": 0.3, "tactile_dots.jpg": 0.3, "concrete.jpg": 6.0,
    "ground.jpg": 10.0, "grass.jpg": 4.0, "gravel.jpg": 3.0, "roof_flat.jpg": 10.0,
}


def main():
    global FONT_PATH
    ap = argparse.ArgumentParser()
    ap.add_argument("--font")
    args = ap.parse_args()
    FONT_PATH = args.font or next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
    if not FONT_PATH:
        raise SystemExit("No Japanese font found; pass --font /path/to/NotoSansJP-Bold.otf")
    os.makedirs(OUT, exist_ok=True)
    print("font:", FONT_PATH)
    asphalt(); sidewalk(); tactile(); ground(); grass(); gravel(); leaves(); block_wall()
    concrete("concrete.jpg", (136, 134, 128), (176, 174, 166))
    concrete("curb.jpg", (150, 150, 146), (190, 188, 182), streaks=False, s=512)
    roof_flat(); roof_kawara("roof_kawara_grey.jpg", (88, 92, 100)); roof_kawara("roof_kawara_blue.jpg", (60, 78, 104))
    roof_kawara("roof_kawara_brown.jpg", (110, 80, 62))
    roof_metal("roof_metal_green.jpg", (74, 104, 84)); roof_metal("roof_metal_red.jpg", (128, 62, 52))
    facade_office()
    facade_midrise("facade_midrise_beige.jpg", (196, 184, 160), (220, 210, 190), (190, 190, 186))
    facade_midrise("facade_midrise_brick.jpg", (128, 78, 62), (160, 100, 80), (200, 200, 196))
    facade_midrise("facade_midrise_grey.jpg", (150, 152, 152), (184, 186, 186), (90, 90, 92))
    facade_mansion("facade_mansion_white.jpg", (222, 220, 212), (240, 238, 232))
    facade_mansion("facade_mansion_tile.jpg", (150, 112, 86), (176, 136, 108))
    facade_house("facade_house_white.jpg", (226, 224, 216), (244, 242, 236))
    facade_house("facade_house_beige.jpg", (204, 186, 150), (226, 210, 178))
    facade_house("facade_house_grey.jpg", (140, 150, 158), (170, 178, 184))
    facade_apaato()
    facade_blank("wall_side_light.jpg", (186, 182, 172), (214, 210, 202))
    facade_blank("wall_side_dark.jpg", (120, 118, 112), (150, 148, 142))
    shop_atlas(); kanban_atlas(); billboard_atlas(); konbini(); station_sign()
    busstop_plate(); road_signs(); road_text(); vending(); bus_livery(); berth_signs(); train_livery(); shrine()


if __name__ == "__main__":
    main()
