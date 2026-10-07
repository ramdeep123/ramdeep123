"""Generate the texture set for the India (Bengaluru-style) map.

    python make_textures.py          (needs Pillow with libraqm + numpy)

Kannada + English signage is drawn with Noto Sans Kannada (SIL OFL, bundled in
./fonts). Pillow needs libraqm for correct Kannada conjuncts; the official
Pillow wheels ship it. Noise / window helpers are shared with ../japan.
"""
import importlib.util
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "textures")
FONT = os.path.join(HERE, "fonts", "NotoSansKannada.ttf")

_spec = importlib.util.spec_from_file_location("jtex", os.path.join(HERE, "..", "japan", "make_textures.py"))
J = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(J)
J.OUT = OUT
tile_noise, colorize, to_img, save, grain = J.tile_noise, J.colorize, J.to_img, J.save, J.grain
paste_window, sky_glass, wall_base = J.paste_window, J.sky_glass, J.wall_base
rng = np.random.default_rng(11)
J.rng = rng


def font(size, weight="Bold"):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def text_fit(d, box, text, fill, max_size=200, weight="Bold"):
    x0, y0, x1, y1 = box
    size = max_size
    while size > 6:
        f = font(size, weight)
        bb = d.textbbox((0, 0), text, font=f)
        if bb[2] - bb[0] <= (x1 - x0) * 0.92 and bb[3] - bb[1] <= (y1 - y0) * 0.86:
            break
        size -= 2
    f = font(size, weight)
    bb = d.textbbox((0, 0), text, font=f)
    d.text((x0 + (x1 - x0 - (bb[2] - bb[0])) / 2 - bb[0], y0 + (y1 - y0 - (bb[3] - bb[1])) / 2 - bb[1]), text, font=f, fill=fill)


def streaks(a, strength=0.35, cells=26):
    s = a.shape[1]
    st = np.asarray(Image.fromarray((tile_noise(s, cells, 2) * 255).astype(np.uint8)).resize((s, 1)).resize((s, a.shape[0])), np.float32) / 255
    return a * (1 - np.clip(st - 0.5, 0, 1) * strength)[..., None]


# ------------------------------------------------------------- ground
def asphalt():
    s = 1024
    a = colorize(tile_noise(s, 4, 6, 0.55), (78, 76, 74), (112, 108, 102))
    fine = rng.random((s, s))
    a += ((fine > 0.98) * 30 - (fine < 0.03) * 20)[..., None]
    a += (rng.random((s, s, 1)) - 0.5) * 16
    dust = tile_noise(s, 3, 3)
    a = a * (1 - np.clip(dust - 0.6, 0, 1)[..., None] * 0.8) + np.array((150, 128, 104)) * np.clip(dust - 0.6, 0, 1)[..., None] * 0.8
    img = to_img(a)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(6):        # darker re-laid patches
        x, y = rng.integers(0, s - 300, 2)
        w, h = rng.integers(80, 300, 2)
        pts = [(x + rng.integers(-20, 20), y + rng.integers(-20, 20)), (x + w, y + rng.integers(-20, 20)),
               (x + w + rng.integers(-20, 20), y + h), (x + rng.integers(-20, 20), y + h + rng.integers(-20, 20))]
        d.polygon(pts, fill=(60, 60, 62, 55))
    for _ in range(5):        # potholes
        x, y = rng.integers(40, s - 40, 2)
        r = rng.integers(10, 26)
        pts = [(x + np.cos(t) * r * rng.uniform(0.6, 1.3), y + np.sin(t) * r * rng.uniform(0.6, 1.3)) for t in np.linspace(0, 6.28, 12)]
        d.polygon(pts, fill=(40, 38, 36, 220))
        d.line(pts + [pts[0]], fill=(130, 120, 104, 200), width=3)
    for _ in range(30):       # cracks
        x, y = rng.integers(0, s, 2).astype(float)
        ang = rng.random() * 6.28
        for _ in range(rng.integers(5, 16)):
            nx, ny = x + np.cos(ang) * 14, y + np.sin(ang) * 14
            d.line([(x, y), (nx, ny)], fill=(40, 40, 40, 160), width=2)
            x, y = nx % s, ny % s
            ang += rng.normal(0, 0.7)
    save(img, "asphalt.jpg")


def pavers():
    """Interlocking concrete pavers, grey with a red border band (2.4 m tile)."""
    s = 1024
    img = Image.new("RGB", (s, s), (96, 92, 88))
    d = ImageDraw.Draw(img)
    bw, bh = 54, 27
    for r in range(s // bh + 1):
        off = (r % 2) * bw // 2
        for c in range(-1, s // bw + 1):
            x, y = c * bw + off, r * bh
            g = rng.normal(0, 8)
            red = (r // 4) % 6 == 0
            col = (int(150 + g), int(90 + g), int(74 + g)) if red else (int(166 + g), int(160 + g), int(150 + g))
            d.rectangle([x + 2, y + 2, x + bw - 2, y + bh - 2], fill=col)
    a = np.asarray(img, np.float32) * (0.82 + 0.3 * tile_noise(s, 5, 5))[..., None]
    save(to_img(a), "pavers.jpg")


def curb_bw():
    """Black & yellow painted kerb (u = 1 m along the kerb, v = height)."""
    w, h = 512, 128
    a = np.zeros((h, w, 3), np.float32)
    a[:, : w // 2] = (226, 186, 30)
    a[:, w // 2:] = (30, 30, 30)
    n = tile_noise(w, 8, 4)[:h, :w]
    a = a * (0.75 + 0.35 * n[..., None])
    dirt = np.clip(np.linspace(-0.2, 1.0, h)[:, None] * (0.8 + 0.4 * n), 0, 1)[..., None]
    a = a * (1 - dirt * 0.45) + np.array((120, 100, 80)) * dirt * 0.45
    save(to_img(a), "curb_bw.jpg")


def soil():
    s = 1024
    a = colorize(tile_noise(s, 5, 6), (130, 78, 52), (176, 118, 82))     # red laterite
    g = tile_noise(s, 4, 4)
    grass = colorize(tile_noise(s, 50, 3), (118, 120, 70), (160, 150, 96))
    m = np.clip((g - 0.55) * 2.5, 0, 0.75)[..., None]
    a = a * (1 - m) + grass * m
    a += (rng.random((s, s, 1)) - 0.5) * 30
    save(to_img(a), "soil.jpg")


def grass():
    s = 1024
    a = colorize(tile_noise(s, 6, 6), (70, 96, 44), (128, 140, 70))
    a += (rng.random((s, s, 1)) - 0.5) * 36
    save(to_img(a), "grass.jpg")


def water():
    s = 1024
    a = colorize(tile_noise(s, 6, 5), (44, 70, 62), (80, 104, 84))
    save(to_img(a), "water.jpg")


def concrete():
    s = 1024
    a = colorize(tile_noise(s, 5, 6), (132, 128, 120), (174, 170, 160))
    a += (rng.random((s, s, 1)) - 0.5) * 12
    save(to_img(streaks(a)), "concrete.jpg")


def leaves():
    s = 512
    a = colorize(tile_noise(s, 10, 5), (30, 58, 22), (88, 124, 46))
    spots = rng.random((s, s))
    a[spots > 0.94] *= 1.35
    a[spots < 0.07] *= 0.55
    save(to_img(a), "leaves.jpg")


def palm_frond():
    """Coconut frond with alpha: rachis along v, leaflets to both sides."""
    w, h = 256, 1024
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(16, h - 10, 9):
        L = (w / 2 - 6) * min(1.0, (h - y) / (h * 0.45)) * min(1.0, y / 120 + 0.3)
        g = int(rng.integers(70, 120))
        col = (int(g * 0.45), g, int(g * 0.3), 255)
        droop = 40 + y * 0.03
        d.line([(w / 2, y), (w / 2 - L, y + droop)], fill=col, width=9)
        d.line([(w / 2, y), (w / 2 + L, y + droop)], fill=col, width=9)
    d.line([(w / 2, 0), (w / 2, h)], fill=(120, 110, 60, 255), width=8)
    save(img, "palm_frond.png")


# ------------------------------------------------------------- facades
WINDOW_FRAME = (236, 236, 230)


def grill_window(img, box, frame=WINDOW_FRAME, grill=(40, 110, 70)):
    x0, y0, x1, y1 = [int(v) for v in box]
    paste_window(img, box, tint=(70, 86, 96), curtain=J.rand_curtain(), frame=frame, fw=5)
    d = ImageDraw.Draw(img)
    for x in range(x0 + 14, x1 - 6, 18):
        d.line([(x, y0 + 4), (x, y1 - 4)], fill=grill, width=4)
    d.line([(x0, (y0 + y1) // 2), (x1, (y0 + y1) // 2)], fill=grill, width=4)


def facade_house(name, c0, c1):
    """Painted independent house: 2 bays (3.5 m) x 2 floors (3.0 m) = 7 x 6 m."""
    w, h = 1024, 878
    img = wall_base(w, h, c0, c1, cells=3)
    d = ImageDraw.Draw(img, "RGBA")
    bw, fl = w / 2, h / 2
    grill_col = tuple(int(v) for v in rng.choice([(40, 110, 70), (30, 60, 130), (60, 60, 60), (230, 230, 230)]))
    for f in range(2):
        for b in range(2):
            x0, y0 = b * bw, f * fl
            k = rng.random()
            if k < 0.6:
                grill_window(img, (x0 + 110, y0 + 120, x0 + bw - 110, y0 + fl - 110), grill=grill_col)
            elif k < 0.85:
                # door (balcony / main)
                d.rectangle([x0 + 170, y0 + 90, x0 + bw - 170, y0 + fl - 4], fill=(110, 70, 44), outline=(70, 46, 30), width=6)
                d.rectangle([x0 + 186, y0 + 110, x0 + bw - 186, y0 + 220], fill=(130, 86, 54))
            else:
                grill_window(img, (x0 + 160, y0 + 140, x0 + bw - 160, y0 + 240), grill=grill_col)   # ventilator
            # chajja (sunshade) shadow above openings
            d.rectangle([x0 + 90, y0 + 82, x0 + bw - 90, y0 + 110], fill=(0, 0, 0, 70))
        if rng.random() < 0.4:   # electricity meter box / pipes
            d.rectangle([20, f * fl + 200, 80, f * fl + 280], fill=(200, 200, 190), outline=(90, 90, 90), width=3)
        d.line([(w - 30, 0), (w - 30, h)], fill=(90, 90, 90, 160), width=10)     # rainwater pipe
    a = streaks(np.asarray(img, np.float32), 0.5)
    save(grain(to_img(a), 6), name)


def facade_shoprow():
    """Upper floors over shops: windows, small clinic/tuition boards. 4 bays x 3 floors (3.2 m)."""
    w, h = 1024, 768
    img = wall_base(w, h, (196, 186, 166), (222, 214, 196), cells=3)
    d = ImageDraw.Draw(img, "RGBA")
    bw, fl = w / 4, h / 3
    boards = [("ಕ್ಲಿನಿಕ್ Clinic", (240, 240, 240), (200, 20, 30)), ("ಟ್ಯೂಷನ್ Tuition", (20, 60, 150), (255, 255, 255)),
              ("ಡೆಂಟಲ್ Dental", (255, 255, 255), (0, 120, 160)), ("ಆಫೀಸ್ Office", (250, 200, 30), (30, 30, 30))]
    for f in range(3):
        for b in range(4):
            x0, y0 = b * bw, f * fl
            grill_window(img, (x0 + 40, y0 + 70, x0 + bw - 40, y0 + fl - 50), grill=(60, 60, 60))
            d.rectangle([x0 + 20, y0 + 50, x0 + bw - 20, y0 + 70], fill=(0, 0, 0, 80))
        if rng.random() < 0.7:
            t, bg, fg = boards[rng.integers(len(boards))]
            bx = rng.integers(0, 3) * bw
            d.rectangle([bx + 20, f * fl + 4, bx + bw * 1.6, f * fl + 46], fill=bg)
            text_fit(d, (bx + 20, f * fl + 4, bx + bw * 1.6, f * fl + 46), t, fg, 40)
    save(grain(to_img(streaks(np.asarray(img, np.float32), 0.5)), 6), "facade_shoprow.jpg")


def facade_complex():
    """Commercial 'complex': blue glass + silver ACP bands. 4 bays x 4 floors, 3.5 m."""
    s = 1024
    img = to_img(sky_glass(s, s, (70, 110, 150), 0.6))
    d = ImageDraw.Draw(img, "RGBA")
    fl = s / 4
    for f in range(4):
        d.rectangle([0, f * fl + fl - 70, s, f * fl + fl], fill=(196, 200, 204))
        d.line([(0, f * fl + fl - 70), (s, f * fl + fl - 70)], fill=(150, 154, 160), width=4)
    for x in range(0, s, s // 8):
        d.line([(x, 0), (x, s)], fill=(160, 164, 170), width=6)
    save(grain(img, 5), "facade_complex.jpg")


def facade_apartment():
    """Gated apartment: cream walls, brown bands, balcony doors. 3 units (4 m) x 4 floors (3 m)."""
    w, h = 1024, 1024
    img = wall_base(w, h, (222, 208, 180), (238, 228, 206))
    d = ImageDraw.Draw(img, "RGBA")
    uw, fl = w / 3, h / 4
    for f in range(4):
        d.rectangle([0, f * fl, w, f * fl + 26], fill=(150, 96, 60))
        for u in range(3):
            x0, y0 = u * uw, f * fl
            paste_window(img, (x0 + 30, y0 + 60, x0 + uw * 0.55, y0 + fl - 4), tint=(80, 96, 106), curtain=J.rand_curtain(), frame=(200, 200, 196))
            grill_window(img, (x0 + uw * 0.62, y0 + 70, x0 + uw - 30, y0 + fl * 0.62), grill=(80, 80, 80))
            if rng.random() < 0.5:
                for k in range(rng.integers(2, 6)):    # drying clothes
                    lx = x0 + 40 + k * 30
                    d.rectangle([lx, y0 + 64, lx + 24, y0 + 64 + rng.integers(40, 100)], fill=tuple(int(v) for v in rng.integers(80, 250, 3)))
    save(grain(to_img(streaks(np.asarray(img, np.float32), 0.4)), 6), "facade_apartment.jpg")


def facade_techpark():
    s = 1024
    img = to_img(sky_glass(s, s, (60, 120, 140), 0.55))
    d = ImageDraw.Draw(img, "RGBA")
    for f in range(4):
        y = f * s / 4
        d.rectangle([0, y + s / 4 - 30, s, y + s / 4], fill=(40, 60, 70))
    for x in range(0, s, s // 6):
        d.line([(x, 0), (x, s)], fill=(200, 210, 215), width=5)
    save(grain(img, 4), "facade_techpark.jpg")


def wall_plain(name, c0, c1):
    s = 512
    img = wall_base(s, s, c0, c1, cells=3)
    save(to_img(streaks(np.asarray(img, np.float32), 0.6, 18)), name)


def compound_wall():
    """Plastered compound wall with faded painted lettering (2 x 2 m tile)."""
    s = 512
    img = wall_base(s, s, (186, 176, 160), (214, 206, 190), cells=3)
    d = ImageDraw.Draw(img, "RGBA")
    if True:
        d.text((40, 200), "STICK NO BILLS", font=font(44), fill=(160, 40, 30, 110))
        d.rectangle([300, 80, 420, 240], fill=(230, 220, 120, 70))
    save(to_img(streaks(np.asarray(img, np.float32), 0.6, 18)), "compound_wall.jpg")


# --------------------------------------------------------- signs & shops
SHOPS = [
    ("ಶ್ರೀ ಲಕ್ಷ್ಮಿ ಸ್ಟೋರ್ಸ್", "Sri Lakshmi Stores", (250, 210, 0), (180, 20, 20)),
    ("ಮೆಡಿಕಲ್ಸ್", "Sri Sai Medicals", (0, 140, 70), (255, 255, 255)),
    ("ದರ್ಶಿನಿ", "Mallige Darshini", (200, 30, 30), (255, 240, 200)),
    ("ಅಯ್ಯಂಗಾರ್ ಬೇಕರಿ", "Iyengar Bakery", (250, 140, 0), (90, 20, 10)),
    ("ಮೊಬೈಲ್ಸ್", "Star Mobiles", (20, 60, 160), (255, 255, 255)),
    ("ಜೆರಾಕ್ಸ್", "Xerox & Printouts", (255, 255, 255), (20, 20, 120)),
    ("ಹಾರ್ಡ್‌ವೇರ್", "Balaji Hardware", (230, 230, 40), (20, 20, 20)),
    ("ಟೈಲರ್ಸ್", "Royal Tailors", (120, 30, 120), (255, 255, 255)),
    ("ಸ್ವೀಟ್ಸ್", "Anand Sweets", (240, 100, 140), (255, 255, 255)),
    ("ಎಲೆಕ್ಟ್ರಿಕಲ್ಸ್", "Ganesh Electricals", (0, 150, 200), (255, 255, 255)),
    ("ಜ್ಯೂಸ್ ಸೆಂಟರ್", "Fresh Juice Centre", (90, 170, 40), (255, 255, 255)),
    ("ಹೋಟೆಲ್", "Udupi Hotel", (240, 230, 210), (160, 30, 20)),
]


def shop_cell(spec, w=512, h=340):
    kn, en, bg, fg = spec
    img = Image.new("RGB", (w, h), (50, 46, 42))
    d = ImageDraw.Draw(img, "RGBA")
    band = int(h * 0.34)
    d.rectangle([0, 0, w, band], fill=bg)
    text_fit(d, (8, 2, w - 8, band * 0.58), kn, fg, 70)
    text_fit(d, (8, band * 0.55, w - 8, band - 4), en, fg, 44)
    # interior with shelves
    inner = to_img(sky_glass(w, h - band, (120, 112, 100), 0.4))
    di = ImageDraw.Draw(inner, "RGBA")
    for row in range(4):
        y = 20 + row * 50
        di.rectangle([10, y + 36, w - 10, y + 40], fill=(90, 70, 50, 255))
        for _ in range(34):
            x = rng.integers(10, w - 20)
            base = rng.integers(70, 200, 3)
            c = tuple(int(v * 0.55 + 70) for v in base) + (220,)
            di.rectangle([x, y + rng.integers(10, 24), x + rng.integers(5, 12), y + 36], fill=c)
    img.paste(inner, (0, band))
    d = ImageDraw.Draw(img, "RGBA")
    # rolling shutter rolled up (box + a partly lowered shutter on one side)
    d.rectangle([0, band, w, band + 18], fill=(110, 110, 104))
    if rng.random() < 0.5:
        sh = rng.integers(40, 140)
        for y in range(band + 18, band + 18 + sh, 7):
            d.line([(w * 0.55, y), (w, y)], fill=(150, 150, 146), width=4)
    # goods & stools out front
    for i in range(rng.integers(1, 4)):
        x = rng.integers(10, w - 70)
        d.rectangle([x, h - 50, x + 44, h - 4], fill=tuple(int(v * 0.6 + 50) for v in rng.integers(60, 220, 3)), outline=(40, 40, 40))
    return img


def shop_atlas():
    cw, ch = 512, 340
    atlas = Image.new("RGB", (cw * 4, ch * 3))
    for i, spec in enumerate(SHOPS):
        atlas.paste(shop_cell(spec, cw, ch), ((i % 4) * cw, (i // 4) * ch))
    save(atlas, "shop_atlas.jpg", 90)


HOARDINGS = [
    ("ಪ್ಲಾಟ್‌ಗಳು ಮಾರಾಟಕ್ಕೆ", "PLOTS FOR SALE  98450 12345", (20, 100, 60), (255, 255, 255)),
    ("ಮಲ್ಲಿಗೆ ಜ್ಯುವೆಲರ್ಸ್", "MALLIGE JEWELLERS", (120, 0, 30), (250, 210, 80)),
    ("ನಮ್ಮ ಕೋಚಿಂಗ್", "NAMMA IAS ACADEMY", (250, 200, 0), (20, 20, 60)),
    ("ಹೊಸ ಸಿನಿಮಾ", "NOW SHOWING  ·  ALL THEATRES", (20, 20, 30), (255, 120, 0)),
]


def hoarding_atlas():
    cw, ch = 1024, 340
    atlas = Image.new("RGB", (cw, ch * 4))
    d = ImageDraw.Draw(atlas)
    for i, (kn, en, bg, fg) in enumerate(HOARDINGS):
        y0 = i * ch
        d.rectangle([0, y0, cw, y0 + ch - 1], fill=bg)
        d.rectangle([0, y0, cw - 1, y0 + ch - 1], outline=(230, 230, 230), width=12)
        text_fit(d, (40, y0 + 30, cw - 40, y0 + 190), kn, fg, 150)
        text_fit(d, (40, y0 + 190, cw - 40, y0 + ch - 30), en, fg, 90)
    save(atlas, "hoarding_atlas.jpg", 90)


def arrow(d, cx, cy, deg, size=56, col=(255, 255, 255)):
    a = np.radians(deg)
    fx, fy = np.cos(a), -np.sin(a)
    px, py = -fy, fx
    tip = (cx + fx * size, cy + fy * size)
    base = (cx + fx * size * 0.1, cy + fy * size * 0.1)
    tail = (cx - fx * size, cy - fy * size)
    d.line([tail, base], fill=col, width=int(size * 0.35))
    d.polygon([tip, (base[0] + px * size * 0.6, base[1] + py * size * 0.6), (base[0] - px * size * 0.6, base[1] - py * size * 0.6)], fill=col)


def signs():
    s = 512
    # bus stop board
    img = Image.new("RGB", (1024, 384), (20, 90, 160))
    d = ImageDraw.Draw(img)
    d.rectangle([8, 8, 1015, 375], outline=(255, 255, 255), width=8)
    text_fit(d, (30, 20, 994, 190), "ಬಸ್ ನಿಲ್ದಾಣ", (255, 255, 255), 150)
    text_fit(d, (30, 190, 994, 360), "BUS STOP", (255, 230, 0), 140)
    save(img, "sign_busstop.jpg")
    # speed limit 40
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([8, 8, s - 8, s - 8], fill=(206, 16, 32))
    d.ellipse([60, 60, s - 60, s - 60], fill=(255, 255, 255))
    text_fit(d, (110, 110, s - 110, s - 110), "40", (10, 10, 10), 220)
    save(img, "sign_speed40.png")
    # no parking
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([8, 8, s - 8, s - 8], fill=(206, 16, 32))
    d.ellipse([60, 60, s - 60, s - 60], fill=(30, 80, 170))
    d.line([(110, 110), (s - 110, s - 110)], fill=(206, 16, 32), width=56)
    text_fit(d, (150, 150, s - 150, s - 150), "P", (255, 255, 255), 200)
    save(img, "sign_noparking.png")
    # direction board
    img = Image.new("RGB", (1024, 512), (20, 80, 50))
    d = ImageDraw.Draw(img)
    d.rectangle([8, 8, 1015, 503], outline=(255, 255, 255), width=8)
    rows = [("↑", "ಮೆಜೆಸ್ಟಿಕ್", "Majestic 9 km"), ("←", "ಮಲ್ಲಿಗೆ ವೃತ್ತ", "Mallige Circle"), ("→", "ಹೊರ ವರ್ತುಲ ರಸ್ತೆ", "Outer Ring Road")]
    for i, (ar, kn, en) in enumerate(rows):
        y = 30 + i * 158
        arrow(d, 90, y + 70, {"↑": 90, "←": 180, "→": 0}[ar])
        text_fit(d, (170, y, 1000, y + 80), kn, (255, 255, 255), 70)
        text_fit(d, (170, y + 76, 1000, y + 140), en, (255, 255, 255), 56)
    save(img, "sign_direction.jpg")
    # metro station
    img = Image.new("RGB", (2048, 256), (110, 40, 130))
    d = ImageDraw.Draw(img)
    text_fit(d, (60, 20, 900, 236), "ಮಲ್ಲಿಗೆ ನಗರ", (255, 255, 255), 170)
    text_fit(d, (950, 30, 1990, 226), "Mallige Nagar Metro", (255, 255, 255), 120)
    save(img, "sign_metro.jpg")
    # temple plaque
    img = Image.new("RGB", (1024, 256), (150, 20, 20))
    d = ImageDraw.Draw(img)
    text_fit(d, (20, 10, 1004, 150), "ಶ್ರೀ ಗಣೇಶ ದೇವಸ್ಥಾನ", (255, 220, 80), 120)
    text_fit(d, (20, 140, 1004, 246), "Sri Ganesha Temple", (255, 220, 80), 80)
    save(img, "sign_temple.jpg")
    # depot / TTMC name
    img = Image.new("RGB", (2048, 256), (240, 240, 236))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 2048, 40], fill=(0, 120, 60))
    d.rectangle([0, 216, 2048, 256], fill=(0, 120, 60))
    text_fit(d, (40, 44, 1000, 212), "ಮಲ್ಲಿಗೆ ನಗರ ಬಸ್ ನಿಲ್ದಾಣ", (0, 90, 40), 150)
    text_fit(d, (1040, 44, 2010, 212), "Mallige Nagar Bus Station", (40, 40, 40), 120)
    save(img, "sign_depot.jpg")


def gopuram():
    """Tier texture for the temple tower: rows of colourful figure niches."""
    w, h = 1024, 512
    img = Image.new("RGB", (w, h), (236, 220, 170))
    d = ImageDraw.Draw(img)
    for row in range(2):
        y0 = row * h / 2
        d.rectangle([0, y0, w, y0 + 30], fill=(190, 60, 40))
        for i in range(10):
            x0 = i * w / 10
            d.rectangle([x0 + 10, y0 + 50, x0 + w / 10 - 10, y0 + h / 2 - 20], fill=(250, 240, 210), outline=(150, 100, 40), width=4)
            col = tuple(int(v) for v in rng.choice([(40, 110, 200), (230, 120, 30), (40, 150, 80), (200, 40, 60), (250, 200, 40)]))
            cx = x0 + w / 20
            d.ellipse([cx - 18, y0 + 70, cx + 18, y0 + 110], fill=col)
            d.rectangle([cx - 26, y0 + 110, cx + 26, y0 + h / 2 - 40], fill=col)
    save(grain(img, 10), "gopuram.jpg")


def bus_livery():
    """12 m city bus, green & white. Top: left (door) side, front at image left. Bottom: right side."""
    w, h = 2048, 512
    sheet = Image.new("RGB", (w, h * 2))
    for row in range(2):
        img = Image.new("RGB", (w, h), (236, 240, 232))
        d = ImageDraw.Draw(img)
        d.rectangle([0, h * 0.66, w, h * 0.9], fill=(20, 130, 60))
        d.polygon([(0, h * 0.66), (w, h * 0.5), (w, h * 0.66)], fill=(250, 190, 0))
        for i in range(9):
            x0 = 240 + i * 196 if row == 0 else 60 + i * 196
            d.rectangle([x0, h * 0.16, x0 + 180, h * 0.5], fill=(40, 50, 56))
        if row == 0:
            d.rectangle([40, h * 0.12, 200, h * 0.92], fill=(60, 66, 70))
            d.rectangle([1650, h * 0.12, 1810, h * 0.92], fill=(60, 66, 70))
            sign = (240, 1200)
        else:
            sign = (900, 1860)
        d.rectangle([sign[0], h * 0.02, sign[1], h * 0.12], fill=(15, 15, 15))
        d.text((sign[0] + 20, h * 0.015), "500  ಮಲ್ಲಿಗೆ ನಗರ ವೃತ್ತ", font=font(40), fill=(255, 150, 0))
        d.text((700 if row == 0 else 300, h * 0.7), "NAMMA BUS  ನಮ್ಮ ಬಸ್", font=font(64), fill=(255, 255, 255))
        sheet.paste(img, (0, row * h))
    save(sheet, "bus_side.jpg", 90)


def metro_livery():
    w, h = 2048, 256
    img = Image.new("RGB", (w, h), (200, 204, 210))
    d = ImageDraw.Draw(img)
    d.rectangle([0, h * 0.6, w, h * 0.72], fill=(110, 40, 130))
    for i in range(10):
        x0 = 60 + i * 200
        d.rectangle([x0, h * 0.18, x0 + 150, h * 0.52], fill=(30, 40, 50))
    for x0 in (300, 980, 1660):
        d.rectangle([x0, h * 0.12, x0 + 120, h * 0.95], fill=(170, 176, 182), outline=(90, 90, 90), width=4)
    save(img, "metro_side.jpg", 90)


def road_text():
    """Painted lane text, letters stretched along the road (image top = far end)."""
    for name, txt in (("paint_busstop.png", "BUS STOP"), ("paint_slow.png", "SLOW")):
        w, h = 512, 1024
        tmp = Image.new("L", (1200, 220), 0)
        ImageDraw.Draw(tmp).text((600, 110), txt, font=font(170), fill=255, anchor="mm")
        tmp = tmp.crop(tmp.getbbox()).resize((w - 40, h - 40))
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        img.paste((240, 240, 230, 255), (20, 20), tmp)
        save(img, name)


def main():
    os.makedirs(OUT, exist_ok=True)
    asphalt(); pavers(); curb_bw(); soil(); grass(); water(); concrete(); leaves(); palm_frond()
    facade_house("facade_house_pink.jpg", (214, 150, 160), (232, 174, 182))
    facade_house("facade_house_yellow.jpg", (226, 196, 100), (240, 214, 130))
    facade_house("facade_house_mint.jpg", (150, 200, 170), (176, 220, 190))
    facade_house("facade_house_blue.jpg", (130, 166, 206), (160, 190, 224))
    facade_house("facade_house_orange.jpg", (226, 150, 90), (240, 176, 120))
    facade_house("facade_house_white.jpg", (224, 222, 214), (242, 240, 234))
    facade_shoprow(); facade_complex(); facade_apartment(); facade_techpark()
    wall_plain("wall_plain.jpg", (196, 188, 172), (220, 212, 198)); compound_wall()
    shop_atlas(); hoarding_atlas(); signs(); gopuram(); bus_livery(); metro_livery(); road_text()


if __name__ == "__main__":
    main()
