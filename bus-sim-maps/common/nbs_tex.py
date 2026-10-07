"""Texture helpers shared by the country texture generators (Pillow + numpy)."""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

rng = np.random.default_rng(3)
OUT = ["."]


def set_out(path, seed=3):
    global rng
    OUT[0] = path
    os.makedirs(path, exist_ok=True)
    rng = np.random.default_rng(seed)


def R():
    return rng


def tile_noise(size, cells, octaves=4, persistence=0.5):
    """Seamless fractal value noise in [0,1]."""
    total = np.zeros((size, size), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        if c >= size:
            break
        base = rng.random((c, c)).astype(np.float32)
        img = Image.fromarray((np.tile(base, (3, 3)) * 255).astype(np.uint8)).resize((size * 3, size * 3), Image.BICUBIC)
        total += np.asarray(img, np.float32)[size:2 * size, size:2 * size] / 255.0 * amp
        norm += amp
        amp *= persistence
    total /= norm
    return (total - total.min()) / max(1e-6, total.max() - total.min())


def colorize(gray, c0, c1):
    c0, c1 = np.array(c0, np.float32), np.array(c1, np.float32)
    return gray[..., None] * (c1 - c0) + c0


def to_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def save(img, name, quality=88):
    path = os.path.join(OUT[0], name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(path, quality=quality, optimize=True)
    else:
        img.save(path, optimize=True)
    print("  ", name, img.size)


def grain(img, amount=8):
    a = np.asarray(img.convert("RGB"), np.float32)
    a += (rng.random(a.shape[:2] + (1,)) - 0.5) * amount * 2
    return to_img(a)


def streaks(a, strength=0.35, cells=26):
    s = a.shape[1]
    st = np.asarray(Image.fromarray((tile_noise(s, cells, 2) * 255).astype(np.uint8)).resize((s, 1)).resize((s, a.shape[0])), np.float32) / 255
    return a * (1 - np.clip(st - 0.5, 0, 1) * strength)[..., None]


def wall_base(w, h, c0, c1, cells=4):
    n = tile_noise(max(w, h), cells, 5)[:h, :w]
    a = colorize(n, c0, c1) + (rng.random((h, w, 1)) - 0.5) * 8
    return to_img(a)


def sky_glass(w, h, tint=(118, 140, 160), dark=0.55):
    yy = np.linspace(0, 1, h)[:, None]
    a = np.ones((h, w, 3), np.float32) * np.array(tint) * ((1 - yy) + yy * dark)[..., None]
    a += (tile_noise(max(w, h), 4, 3)[:h, :w, None] - 0.5) * 30
    return a


def rand_curtain():
    r = rng.random()
    if r < 0.3:
        return None
    if r < 0.55:
        return ("left", 0.25 + rng.random() * 0.4)
    if r < 0.8:
        return ("both", 0.3 + rng.random() * 0.5)
    return ("blind", 0.2 + rng.random() * 0.8)


def window(img, box, tint=(110, 132, 150), curtain="rand", frame=(210, 212, 214), fw=4, mullion=True, muntins=0):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    if w < 4 or h < 4:
        return
    glass = to_img(sky_glass(w, h, tint))
    d = ImageDraw.Draw(glass, "RGBA")
    curtain = rand_curtain() if curtain == "rand" else curtain
    if curtain:
        cw = int(w * curtain[1])
        if curtain[0] == "left":
            d.rectangle([0, 0, cw, h], fill=(226, 216, 196, 235))
        elif curtain[0] == "both":
            d.rectangle([0, 0, cw // 2, h], fill=(220, 214, 200, 235))
            d.rectangle([w - cw // 2, 0, w, h], fill=(220, 214, 200, 235))
        else:
            for yb in range(0, int(h * curtain[1]), 5):
                d.line([(0, yb), (w, yb)], fill=(218, 218, 210, 230), width=3)
    img.paste(glass, (x0, y0))
    d = ImageDraw.Draw(img)
    d.rectangle([x0, y0, x1, y1], outline=frame, width=fw)
    if mullion and w > 40:
        d.line([(x0 + w // 2, y0), (x0 + w // 2, y1)], fill=frame, width=max(2, fw - 1))
    for k in range(1, muntins + 1):
        y = y0 + h * k // (muntins + 1)
        d.line([(x0, y), (x1, y)], fill=frame, width=max(2, fw - 2))


def font(path, size, weight="Bold"):
    f = ImageFont.truetype(path, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def text_fit(d, box, text, fill, fpath, max_size=200, weight="Bold", vertical=False):
    x0, y0, x1, y1 = box
    size = max_size
    while size > 6:
        f = font(fpath, size, weight)
        if vertical:
            tw = max(d.textbbox((0, 0), ch, font=f)[2] for ch in text)
            th = size * 1.08 * len(text)
        else:
            bb = d.textbbox((0, 0), text, font=f)
            tw, th = bb[2] - bb[0], bb[3] - bb[1]
        if tw <= (x1 - x0) * 0.92 and th <= (y1 - y0) * 0.88:
            break
        size -= 2
    f = font(fpath, size, weight)
    if vertical:
        y = y0 + ((y1 - y0) - size * 1.08 * len(text)) / 2
        for ch in text:
            bb = d.textbbox((0, 0), ch, font=f)
            d.text((x0 + ((x1 - x0) - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1] * 0.4), ch, font=f, fill=fill)
            y += size * 1.08
        return
    bb = d.textbbox((0, 0), text, font=f)
    d.text((x0 + (x1 - x0 - (bb[2] - bb[0])) / 2 - bb[0], y0 + (y1 - y0 - (bb[3] - bb[1])) / 2 - bb[1]), text, font=f, fill=fill)


def asphalt(name="asphalt.jpg", c0=(48, 48, 50), c1=(78, 77, 76), patches=3, patch_alpha=35, cracks=14, dust=None):
    s = 1024
    a = colorize(tile_noise(s, 4, 6, 0.55), c0, c1)
    fine = rng.random((s, s))
    a += ((fine > 0.985) * 34 - (fine < 0.02) * 18)[..., None]
    a += (rng.random((s, s, 1)) - 0.5) * 14
    if dust:
        dn = tile_noise(s, 3, 3)
        m = np.clip(dn - 0.6, 0, 1)[..., None] * 0.8
        a = a * (1 - m) + np.array(dust) * m
    img = to_img(a)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(patches):
        x, y = rng.integers(0, s - 300, 2)
        w, h = rng.integers(90, 280, 2)
        d.rectangle([x, y, x + w, y + h], fill=(30, 30, 32, patch_alpha))
    for _ in range(cracks):
        x, y = rng.integers(0, s, 2).astype(float)
        ang = rng.random() * 6.28
        for _ in range(rng.integers(6, 18)):
            nx, ny = x + np.cos(ang) * 14, y + np.sin(ang) * 14
            if abs(nx - x) < 40:
                d.line([(x, y), (nx, ny)], fill=(22, 22, 24, 150), width=2)
            x, y = nx % s, ny % s
            ang += rng.normal(0, 0.6)
    save(img, name)


def noise_tex(name, c0, c1, cells=6, s=1024, speck=20, streak=False):
    a = colorize(tile_noise(s, cells, 6), c0, c1) + (rng.random((s, s, 1)) - 0.5) * speck
    save(to_img(streaks(a) if streak else a), name)


def pavers(name, colors, bw=54, bh=27, s=1024, herring=False, joint=(90, 88, 84)):
    img = Image.new("RGB", (s, s), joint)
    d = ImageDraw.Draw(img)
    for r in range(s // bh + 1):
        off = (r % 2) * bw // 2
        for c in range(-1, s // bw + 1):
            x, y = c * bw + off, r * bh
            base = colors[rng.integers(len(colors))]
            g = rng.normal(0, 7)
            d.rectangle([x + 2, y + 2, x + bw - 2, y + bh - 2], fill=tuple(int(v + g) for v in base))
    a = np.asarray(img, np.float32) * (0.85 + 0.25 * tile_noise(s, 5, 5))[..., None]
    save(to_img(a), name)


def cobbles(name, c0=(110, 104, 98), c1=(150, 144, 136), s=1024, n=22):
    """Granite setts (Kopfsteinpflaster) in arcs."""
    img = Image.new("RGB", (s, s), (60, 58, 56))
    d = ImageDraw.Draw(img)
    cell = s // n
    for r in range(n + 1):
        off = (r % 2) * cell // 2
        for c in range(-1, n + 1):
            x, y = c * cell + off, r * cell
            g = rng.uniform(0, 1)
            col = tuple(int(c0[k] + (c1[k] - c0[k]) * g) for k in range(3))
            d.rounded_rectangle([x + 3, y + 3, x + cell - 3, y + cell - 3], radius=cell // 4, fill=col)
    a = np.asarray(img, np.float32) * (0.85 + 0.25 * tile_noise(s, 5, 4))[..., None]
    save(to_img(a), name)


def leaves(name, c0, c1, s=512):
    a = colorize(tile_noise(s, 10, 5), c0, c1)
    spots = rng.random((s, s))
    a[spots > 0.94] *= 1.3
    a[spots < 0.07] *= 0.55
    save(to_img(a), name)


def curb(name, c0=(150, 150, 146), c1=(190, 188, 182)):
    noise_tex(name, c0, c1, cells=8, s=512, speck=10)
