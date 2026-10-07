"""Textures for the Europe map (Lindenfeld, a German old town).

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


def fachwerk(name, infill, timber=(58, 40, 30)):
    """Half-timbered facade: 3 bays (2.6 m) x 2 floors (3.0 m) -> 7.8 x 6 m."""
    w, h = 1024, 788
    img = T.wall_base(w, h, infill, tuple(min(255, v + 14) for v in infill), cells=3)
    d = ImageDraw.Draw(img)
    bw, fl = w / 3, h / 2
    tw = 26
    for f in range(2):
        y0, y1 = f * fl, (f + 1) * fl
        d.rectangle([0, y1 - tw, w, y1], fill=timber)                 # sill beam
        d.rectangle([0, y0, w, y0 + tw], fill=timber)
        for b in range(4):
            x = b * bw
            d.rectangle([x - tw / 2, y0, x + tw / 2, y1], fill=timber)   # posts
        for b in range(3):
            x0 = b * bw
            if (b + f) % 2 == 0:       # window bay
                T.window(img, (x0 + 70, y0 + 70, x0 + bw - 70, y1 - 90), tint=(80, 96, 106), frame=(240, 236, 226), fw=8, muntins=1)
                d = ImageDraw.Draw(img)
                d.rectangle([x0 + 40, y1 - 90, x0 + bw - 40, y1 - 70], fill=(180, 60, 50))   # flower box
            else:                      # St-Andrew cross bracing
                d.line([(x0 + 10, y0 + tw), (x0 + bw - 10, y1 - tw)], fill=timber, width=tw)
                d.line([(x0 + bw - 10, y0 + tw), (x0 + 10, y1 - tw)], fill=timber, width=tw)
    T.save(T.grain(img, 5), name)


def altbau(name, base, trim=(240, 236, 226)):
    """Gruenderzeit plaster facade: 4 bays (3 m) x 2 floors (3.4 m) with stucco window surrounds."""
    w, h = 1024, 580
    img = T.wall_base(w, h, base, tuple(min(255, v + 16) for v in base), cells=3)
    d = ImageDraw.Draw(img)
    bw, fl = w / 4, h / 2
    for f in range(2):
        y0 = f * fl
        d.rectangle([0, y0 + fl - 22, w, y0 + fl - 8], fill=trim)       # cornice band
        for b in range(4):
            x0 = b * bw
            wx0, wx1, wy0, wy1 = x0 + 70, x0 + bw - 70, y0 + 60, y0 + fl - 60
            d.rectangle([wx0 - 18, wy0 - 34, wx1 + 18, wy1 + 16], fill=trim)
            d.polygon([(wx0 - 26, wy0 - 34), (wx1 + 26, wy0 - 34), ((wx0 + wx1) / 2, wy0 - 70)], fill=trim)   # pediment
            T.window(img, (wx0, wy0, wx1, wy1), tint=(80, 96, 108), frame=(250, 250, 246), fw=7, muntins=1)
            d = ImageDraw.Draw(img)
    T.save(T.grain(T.to_img(T.streaks(np.asarray(img, np.float32), 0.3)), 4), name)


def modern(name):
    s = 1024
    img = T.wall_base(s, s, (226, 226, 222), (242, 242, 240))
    d = ImageDraw.Draw(img)
    fl = s / 4
    for f in range(4):
        for b in range(5):
            x0, y0 = b * s / 5 + 30, f * fl + 50
            T.window(img, (x0, y0, x0 + s / 5 - 60, y0 + fl - 90), tint=(90, 110, 120), frame=(70, 74, 78), fw=6, mullion=False)
    T.save(img, name)


def biber(name, base=(170, 72, 48)):
    """Biberschwanz (beaver-tail) clay roof tiles, 1 m tile."""
    s = 512
    img = Image.new("RGB", (s, s), tuple(int(v * 0.55) for v in base))
    d = ImageDraw.Draw(img)
    rows, cols = 12, 9
    for r in range(rows):
        off = (r % 2) * (s / cols / 2)
        for c in range(-1, cols + 1):
            x = c * s / cols + off
            y = r * s / rows
            g = T.R().normal(0, 12)
            col = tuple(int(np.clip(v + g, 0, 255)) for v in base)
            d.rounded_rectangle([x + 2, y, x + s / cols - 2, y + s / rows * 1.4], radius=12, fill=col)
    T.save(img, name)


def slate(name):
    s = 512
    img = Image.new("RGB", (s, s), (50, 54, 60))
    d = ImageDraw.Draw(img)
    for r in range(16):
        off = (r % 2) * 16
        for c in range(-1, 17):
            g = int(T.R().normal(76, 8))
            d.rectangle([c * 32 + off + 1, r * 32 + 1, c * 32 + off + 30, r * 32 + 30], fill=(g - 4, g, g + 6))
    T.save(img, name)


def sandstone():
    s = 512
    img = Image.new("RGB", (s, s), (150, 120, 96))
    d = ImageDraw.Draw(img)
    for r in range(8):
        off = (r % 2) * 64
        for c in range(-1, 5):
            g = T.R().normal(0, 10)
            d.rectangle([c * 128 + off + 2, r * 64 + 2, c * 128 + off + 126, r * 64 + 62], fill=(int(186 + g), int(150 + g), int(118 + g)))
    T.save(T.grain(img, 10), "sandstone.jpg")


SHOPS = [("Bäckerei", (200, 140, 40)), ("Apotheke", (200, 20, 40)), ("Metzgerei", (150, 30, 30)), ("Buchhandlung", (30, 60, 100)),
         ("Café am Markt", (70, 46, 34)), ("Döner Kebab", (220, 120, 20)), ("Optiker", (30, 30, 30)), ("Blumen", (60, 130, 60)),
         ("Eiscafé", (40, 140, 180)), ("Stadtbank", (190, 20, 20)), ("Friseur", (110, 40, 120)), ("Kiosk", (240, 200, 40))]


def shop_atlas():
    cw, ch = 512, 340
    atlas = Image.new("RGB", (cw * 4, ch * 3))
    for i, (t, col) in enumerate(SHOPS):
        img = Image.new("RGB", (cw, ch), (236, 232, 222))
        d = ImageDraw.Draw(img, "RGBA")
        band = int(ch * 0.28)
        tf(d, (20, 8, cw - 20, band - 6), t, col, 80, "SemiBold")
        inner = T.to_img(T.sky_glass(cw - 60, ch - band - 30, (150, 160, 162), 0.45))
        di = ImageDraw.Draw(inner, "RGBA")
        for _ in range(14):
            x, y = T.R().integers(0, cw - 60, 2)
            di.rectangle([x, y + 50, x + T.R().integers(8, 30), y + 50 + T.R().integers(8, 30)], fill=tuple(int(v * 0.5 + 90) for v in T.R().integers(60, 240, 3)) + (170,))
        img.paste(inner, (30, band + 10))
        d = ImageDraw.Draw(img, "RGBA")
        d.rectangle([30, band + 10, cw - 30, ch - 20], outline=(60, 50, 40), width=10)
        d.line([(cw * 0.66, band + 10), (cw * 0.66, ch - 20)], fill=(60, 50, 40), width=8)
        atlas.paste(img, ((i % 4) * cw, (i // 4) * ch))
    T.save(atlas, "shop_atlas.jpg", 90)


def signs():
    s = 512
    # Haltestelle: green H on yellow disc
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([6, 6, s - 6, s - 6], fill=(250, 210, 20), outline=(20, 120, 60), width=26)
    tf(d, (120, 90, s - 120, s - 90), "H", (20, 120, 60), 340)
    T.save(img, "sign_haltestelle.png")
    # Vorfahrtstrasse: yellow diamond
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(s / 2, 4), (s - 4, s / 2), (s / 2, s - 4), (4, s / 2)], fill=(255, 255, 255), outline=(30, 30, 30))
    d.polygon([(s / 2, 70), (s - 70, s / 2), (s / 2, s - 70), (70, s / 2)], fill=(250, 200, 20))
    T.save(img, "sign_vorfahrt.png")
    # Zone 30
    img = Image.new("RGB", (384, 512), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, 377, 505], outline=(20, 20, 20), width=8)
    tf(d, (20, 20, 364, 120), "ZONE", (20, 20, 20), 90)
    d.ellipse([52, 140, 332, 420], fill=(255, 255, 255), outline=(200, 20, 30), width=34)
    tf(d, (110, 200, 274, 360), "30", (20, 20, 20), 150)
    T.save(img, "sign_zone30.jpg")
    # Vorfahrt achten (yield): inverted triangle
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(8, 40), (s - 8, 40), (s / 2, s - 20)], fill=(200, 20, 30))
    d.polygon([(72, 78), (s - 72, 78), (s / 2, s - 120)], fill=(255, 255, 255))
    T.save(img, "sign_yield.png")
    # street name plates (6 rows) - white with black border
    names = ["Ring", "Marktgasse", "Kirchgasse", "Bahnhofstraße", "Lindenallee", "Schulstraße"]
    img = Image.new("RGB", (1024, 128 * 6), (250, 250, 250))
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        d.rectangle([6, i * 128 + 8, 1017, i * 128 + 120], outline=(20, 20, 20), width=8)
        tf(d, (20, i * 128 + 14, 1004, i * 128 + 114), n, (20, 20, 20), 90, "SemiBold")
    T.save(img, "sign_street.jpg")
    # stop name board
    img = Image.new("RGB", (1024, 256), (250, 250, 250))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1024, 256], outline=(20, 120, 60), width=14)
    tf(d, (40, 20, 984, 236), "Stadtwerke Lindenfeld  ·  Bus & Tram", (20, 120, 60), 70, "SemiBold")
    T.save(img, "sign_stopname.jpg")
    img = Image.new("RGB", (2048, 256), (30, 30, 34))
    d = ImageDraw.Draw(img)
    tf(d, (40, 20, 2008, 236), "RATHAUS  ·  STADT LINDENFELD", (230, 200, 120), 150)
    T.save(img, "sign_rathaus.jpg")


def livery(name, body, stripe, text, length_px=2048):
    w, h = length_px, 512
    sheet = Image.new("RGB", (w, h * 2))
    for row in range(2):
        img = Image.new("RGB", (w, h), body)
        d = ImageDraw.Draw(img)
        d.rectangle([0, h * 0.68, w, h * 0.86], fill=stripe)
        for i in range(w // 210):
            x0 = 150 + i * 210 if row == 1 else 60 + i * 210
            d.rectangle([x0, h * 0.14, x0 + 190, h * 0.6], fill=(36, 44, 52))
        if row == 1:
            for x0 in (w - 220, w // 2 - 80, 300):
                d.rectangle([x0, h * 0.1, x0 + 160, h * 0.95], fill=(46, 54, 60))
        d.rectangle([w * 0.5 if row else w * 0.05, h * 0.01, w * 0.95 if row else w * 0.5, h * 0.11], fill=(15, 15, 15))
        tf(d, (w * 0.52 if row else w * 0.07, h * 0.01, w * 0.93 if row else w * 0.48, h * 0.11), text, (255, 160, 0), 44, "Regular")
        tf(d, (w * 0.2, h * 0.7, w * 0.8, h * 0.84), "Stadtwerke Lindenfeld", (255, 255, 255), 56)
        sheet.paste(img, (0, row * h))
    T.save(sheet, name, 90)


def main():
    T.set_out(os.path.join(HERE, "textures"), 49)
    T.asphalt("asphalt.jpg", (50, 50, 52), (74, 74, 74), patches=3, patch_alpha=30, cracks=10)
    T.cobbles("cobbles.jpg")
    T.pavers("sidewalk.jpg", [(160, 158, 154), (150, 148, 146), (170, 168, 162)], bw=40, bh=40)
    T.curb("curb.jpg", (160, 160, 158), (196, 196, 192))
    T.noise_tex("grass.jpg", (60, 100, 44), (110, 146, 66), speck=30)
    T.noise_tex("gravel.jpg", (150, 144, 132), (186, 180, 168), cells=24, speck=40)
    T.noise_tex("plaster.jpg", (214, 206, 190), (234, 228, 214), cells=4, s=512, speck=8, streak=True)
    T.noise_tex("bark.jpg", (70, 64, 56), (106, 98, 88), cells=12, s=256, speck=20)
    T.noise_tex("water.jpg", (60, 90, 100), (90, 120, 126), cells=5, speck=6)
    T.leaves("leaves.jpg", (40, 76, 30), (100, 136, 56))
    fachwerk("fachwerk_white.jpg", (234, 228, 214))
    fachwerk("fachwerk_ochre.jpg", (220, 184, 120))
    fachwerk("fachwerk_rose.jpg", (220, 176, 166))
    altbau("altbau_yellow.jpg", (226, 200, 140))
    altbau("altbau_green.jpg", (176, 196, 170))
    altbau("altbau_salmon.jpg", (226, 170, 146))
    altbau("altbau_grey.jpg", (186, 188, 186))
    modern("modern.jpg")
    biber("roof_red.jpg"); biber("roof_brown.jpg", (120, 64, 46)); slate("slate.jpg"); sandstone()
    shop_atlas(); signs()
    livery("tram_side.jpg", (236, 236, 232), (190, 20, 30), "4  Ring  ·  Hauptbahnhof", 3072)
    livery("bus_side.jpg", (236, 236, 232), (20, 120, 60), "17  Ringlinie  ·  Nordtor")


if __name__ == "__main__":
    main()
