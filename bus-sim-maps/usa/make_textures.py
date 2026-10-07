"""Textures for the USA map (Palm Valley, a Southern-California-style suburb).

    python make_textures.py       (Pillow + numpy)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
import nbs_tex as T  # noqa: E402

FONT = os.path.join(HERE, "..", "common", "fonts", "NotoSans.ttf")


def tf(d, box, text, fill, size=200, weight="Bold"):
    T.text_fit(d, box, text, fill, FONT, size, weight)


def sidewalk():
    s = 1024
    a = T.colorize(T.tile_noise(s, 6, 5), (176, 172, 164), (204, 200, 192))
    a += (T.R().random((s, s, 1)) - 0.5) * 12
    img = T.to_img(a)
    d = ImageDraw.Draw(img)
    for k in range(3):
        d.line([(k * s // 2, 0), (k * s // 2, s)], fill=(130, 126, 120), width=4)
        d.line([(0, k * s // 2), (s, k * s // 2)], fill=(130, 126, 120), width=4)
    T.save(img, "sidewalk.jpg")


def stucco(name, base, trim=(250, 250, 246), floors=1):
    """Stucco house: 2 bays (4.5 m) x 1 floor (3.2 m) per tile; windows with white trim."""
    w, h = 1024, 364 * floors
    img = T.wall_base(w, h, base, tuple(min(255, v + 14) for v in base), cells=3)
    d = ImageDraw.Draw(img, "RGBA")
    bw, fl = w / 2, h / floors
    for f in range(floors):
        for b in range(2):
            x0, y0 = b * bw + 120, f * fl + 70
            x1, y1 = (b + 1) * bw - 120, (f + 1) * fl - 90
            T.window(img, (x0, y0, x1, y1), tint=(96, 110, 120), frame=trim, fw=8, muntins=0)
            d = ImageDraw.Draw(img, "RGBA")
            d.rectangle([x0 - 10, y1, x1 + 10, y1 + 12], fill=trim)
    T.save(T.grain(img, 4), name)


def barrel_tile(name, base=(176, 82, 52)):
    """Spanish clay barrel-tile roof (1 m tile), barrels down the slope."""
    s = 512
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    wave = 0.5 + 0.5 * np.cos(xx / s * 4 * 2 * np.pi)
    rows = (yy / s * 3) % 1.0
    shade = 0.45 + 0.55 * wave ** 0.6 * (0.8 + 0.2 * rows)
    shade *= np.where(rows > 0.93, 0.62, 1.0)
    a = shade[..., None] * np.array(base, np.float32) * (0.85 + 0.3 * T.tile_noise(s, 6, 4))[..., None]
    T.save(T.to_img(a), name)


def shingles(name, base):
    s = 512
    img = Image.new("RGB", (s, s), base)
    d = ImageDraw.Draw(img)
    for r in range(16):
        off = (r % 2) * 16
        for c in range(-1, 17):
            g = T.R().normal(0, 10)
            d.rectangle([c * 32 + off + 1, r * 32 + 1, c * 32 + off + 31, r * 32 + 30], fill=tuple(int(np.clip(v + g, 0, 255)) for v in base))
        d.line([(0, r * 32 + 31), (s, r * 32 + 31)], fill=tuple(int(v * 0.5) for v in base), width=3)
    T.save(img, name)


STRIP = [("VALLEY DONUTS", (240, 120, 40)), ("NAILS & SPA", (200, 60, 140)), ("TACOS", (200, 40, 30)), ("PHARMACY", (20, 100, 180)),
         ("LAUNDROMAT", (40, 140, 180)), ("PHO 88", (120, 30, 40)), ("DENTAL", (60, 160, 200)), ("PIZZA", (180, 30, 30)),
         ("LIQUOR", (30, 30, 30)), ("BOBA TEA", (160, 110, 60)), ("TAX SERVICE", (30, 90, 60)), ("CELL PHONES", (80, 40, 150))]


def strip_atlas():
    """Strip-mall units: sign letters on a fascia band, glass storefront."""
    cw, ch = 512, 340
    atlas = Image.new("RGB", (cw * 4, ch * 3))
    for i, (t, col) in enumerate(STRIP):
        img = Image.new("RGB", (cw, ch), (220, 210, 190))
        d = ImageDraw.Draw(img, "RGBA")
        band = int(ch * 0.32)
        d.rectangle([0, 0, cw, band], fill=(214, 200, 176))
        tf(d, (20, 10, cw - 20, band - 10), t, col, 90)
        inner = T.to_img(T.sky_glass(cw - 40, ch - band - 20, (150, 170, 180), 0.5))
        di = ImageDraw.Draw(inner, "RGBA")
        for _ in range(14):
            x, y = T.R().integers(0, cw - 40, 2)
            di.rectangle([x, y + 60, x + T.R().integers(10, 40), y + 60 + T.R().integers(10, 30)], fill=tuple(int(v * 0.5 + 90) for v in T.R().integers(60, 240, 3)) + (170,))
        img.paste(inner, (20, band + 10))
        d = ImageDraw.Draw(img, "RGBA")
        d.rectangle([20, band + 10, cw - 20, ch - 10], outline=(60, 64, 70), width=8)
        d.line([(cw / 2, band + 10), (cw / 2, ch - 10)], fill=(60, 64, 70), width=6)
        d.text((cw / 2 + 20, ch - 70), "OPEN", font=T.font(FONT, 28), fill=(255, 40, 40))
        atlas.paste(img, ((i % 4) * cw, (i // 4) * ch))
    T.save(atlas, "strip_atlas.jpg", 90)


def big_signs():
    """Atlas of big signs (8 rows of 1024 x 256)."""
    rows = [("MEGAMART", "EVERYDAY LOW PRICES", (20, 70, 160), (255, 255, 255)),
            ("VALLEY PLAZA", "SHOPS · DINING", (130, 60, 40), (255, 240, 210)),
            ("BURGER BARN", "DRIVE-THRU  OPEN 24 HRS", (200, 30, 30), (255, 220, 40)),
            ("GAS  4.89", "DIESEL 5.29", (20, 120, 60), (255, 255, 255)),
            ("PALM MOTEL", "VACANCY", (30, 140, 150), (255, 240, 120)),
            ("AUTO REPAIR", "SMOG CHECK", (240, 200, 30), (20, 20, 20)),
            ("PALM VALLEY", "TRANSIT CENTER", (240, 240, 236), (20, 90, 170)),
            ("COFFEE", "DRIVE-THRU", (70, 46, 34), (255, 255, 255))]
    w, h = 1024, 256
    atlas = Image.new("RGB", (w, h * len(rows)))
    for i, (a, b, bg, fg) in enumerate(rows):
        img = Image.new("RGB", (w, h), bg)
        d = ImageDraw.Draw(img)
        d.rectangle([6, 6, w - 7, h - 7], outline=fg, width=6)
        tf(d, (20, 10, w - 20, 170), a, fg, 150)
        tf(d, (20, 160, w - 20, h - 14), b, fg, 60)
        atlas.paste(img, (0, i * h))
    T.save(atlas, "big_signs.jpg", 90)


def signs():
    img = Image.new("RGB", (384, 512), (250, 250, 250))
    d = ImageDraw.Draw(img)
    d.rectangle([8, 8, 375, 503], outline=(20, 20, 20), width=10)
    tf(d, (20, 30, 364, 130), "SPEED", (20, 20, 20), 80)
    tf(d, (20, 120, 364, 220), "LIMIT", (20, 20, 20), 80)
    tf(d, (20, 230, 364, 480), "40", (20, 20, 20), 260)
    T.save(img, "sign_speed.jpg")
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    oct_ = [(s / 2 + (s / 2 - 6) * np.cos(np.pi / 8 + k * np.pi / 4), s / 2 + (s / 2 - 6) * np.sin(np.pi / 8 + k * np.pi / 4)) for k in range(8)]
    d.polygon(oct_, fill=(255, 255, 255))
    oct2 = [(s / 2 + (s / 2 - 26) * np.cos(np.pi / 8 + k * np.pi / 4), s / 2 + (s / 2 - 26) * np.sin(np.pi / 8 + k * np.pi / 4)) for k in range(8)]
    d.polygon(oct2, fill=(200, 16, 30))
    tf(d, (60, 150, s - 60, s - 150), "STOP", (255, 255, 255), 200)
    T.save(img, "sign_stop.png")
    # overhead street-name signs on signal mast arms (6 rows)
    names = ["Mission Blvd", "Palm Canyon Dr", "Foothill Blvd", "Valley Rd", "East Ave", "West Ave"]
    img = Image.new("RGB", (1024, 160 * 6), (0, 110, 60))
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        d.rectangle([6, i * 160 + 6, 1017, i * 160 + 153], outline=(255, 255, 255), width=6)
        tf(d, (20, i * 160 + 14, 1004, i * 160 + 146), n, (255, 255, 255), 110, "SemiBold")
    T.save(img, "sign_street.jpg")
    # freeway guide sign
    img = Image.new("RGB", (1536, 640), (0, 110, 60))
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, 1525, 629], outline=(255, 255, 255), width=10)
    d.rectangle([1180, 30, 1500, 120], fill=(250, 220, 30))
    tf(d, (1190, 34, 1490, 116), "EXIT 12", (20, 20, 20), 70)
    tf(d, (60, 120, 1480, 330), "Mission Blvd", (255, 255, 255), 190, "SemiBold")
    tf(d, (60, 340, 1480, 470), "Palm Valley  Downtown", (255, 255, 255), 110, "SemiBold")
    tf(d, (60, 480, 1480, 610), "1/2 MILE", (255, 255, 255), 100)
    T.save(img, "sign_freeway.jpg")
    img = Image.new("RGB", (512, 768), (20, 90, 170))
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, 501, 757], outline=(255, 255, 255), width=10)
    tf(d, (30, 40, 482, 300), "BUS", (255, 255, 255), 200)
    tf(d, (30, 300, 482, 450), "STOP", (255, 255, 255), 140)
    tf(d, (30, 480, 482, 720), "Route 42", (255, 230, 80), 100)
    T.save(img, "sign_busstop.jpg")
    # bench ad
    img = Image.new("RGB", (1024, 256), (250, 210, 40))
    d = ImageDraw.Draw(img)
    tf(d, (20, 10, 1004, 246), "INJURED? CALL 1-800-555-0142", (20, 20, 20), 110)
    T.save(img, "bench_ad.jpg")


def mountain():
    s = 1024
    a = T.colorize(T.tile_noise(s, 3, 7, 0.6), (110, 104, 86), (150, 140, 112))
    g = T.tile_noise(s, 8, 4)
    a = a * (1 - np.clip(g - 0.55, 0, 1)[..., None]) + np.array((84, 96, 64)) * np.clip(g - 0.55, 0, 1)[..., None]
    T.save(T.to_img(a), "mountain.jpg")


def livery():
    w, h = 2048, 512
    sheet = Image.new("RGB", (w, h * 2))
    for row in range(2):
        img = Image.new("RGB", (w, h), (240, 240, 236))
        d = ImageDraw.Draw(img)
        d.rectangle([0, h * 0.6, w, h * 0.78], fill=(20, 90, 170))
        d.rectangle([0, h * 0.78, w, h * 0.82], fill=(250, 190, 30))
        for i in range(9):
            x0 = 180 + i * 200 if row == 1 else 60 + i * 200
            d.rectangle([x0, h * 0.16, x0 + 180, h * 0.55], fill=(36, 44, 52))
        if row == 1:
            for x0 in (w - 220, w // 2 - 80):
                d.rectangle([x0, h * 0.12, x0 + 160, h * 0.94], fill=(46, 54, 60))
        d.rectangle([w * 0.5 if row else w * 0.05, h * 0.02, w * 0.95 if row else w * 0.5, h * 0.12], fill=(15, 15, 15))
        tf(d, (w * 0.52 if row else w * 0.07, h * 0.02, w * 0.93 if row else w * 0.48, h * 0.12), "42  MISSION - FOOTHILL", (255, 160, 0), 44, "Regular")
        tf(d, (w * 0.2, h * 0.62, w * 0.8, h * 0.76), "PALM VALLEY TRANSIT", (255, 255, 255), 60)
        sheet.paste(img, (0, row * h))
    T.save(sheet, "bus_side.jpg", 90)


def main():
    T.set_out(os.path.join(HERE, "textures"), 76)
    T.asphalt("asphalt.jpg", (60, 60, 60), (92, 90, 88), patches=4, patch_alpha=35, cracks=24)
    sidewalk()
    T.curb("curb.jpg", (170, 168, 162), (204, 202, 196))
    T.noise_tex("lawn.jpg", (74, 110, 46), (124, 150, 72), speck=34)
    T.noise_tex("dry_grass.jpg", (150, 130, 80), (196, 176, 116), speck=30)
    T.noise_tex("mulch.jpg", (90, 60, 40), (130, 90, 60), cells=20, speck=40)
    T.noise_tex("concrete.jpg", (160, 158, 152), (194, 192, 186))
    T.noise_tex("parking.jpg", (52, 52, 54), (78, 78, 78), cells=6, speck=20)
    T.noise_tex("wall_plain.jpg", (214, 204, 186), (234, 226, 210), cells=4, s=512, speck=8, streak=True)
    T.noise_tex("bark.jpg", (90, 76, 60), (130, 112, 90), cells=12, s=256, speck=20)
    T.leaves("leaves.jpg", (50, 86, 36), (110, 140, 60))
    T.leaves("palm_leaves.jpg", (60, 96, 40), (120, 150, 60))
    stucco("facade_stucco_beige.jpg", (222, 204, 170))
    stucco("facade_stucco_white.jpg", (236, 232, 222))
    stucco("facade_stucco_peach.jpg", (232, 186, 150))
    stucco("facade_stucco_sage.jpg", (176, 186, 156))
    stucco("facade_apartment.jpg", (226, 214, 190), floors=2)
    barrel_tile("roof_tile.jpg"); shingles("shingles.jpg", (96, 90, 84))
    strip_atlas(); big_signs(); signs(); mountain(); livery()


if __name__ == "__main__":
    main()
