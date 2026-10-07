"""Textures for the Canada map (Maplewood, a Toronto-inspired neighbourhood).

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
    """Poured concrete slabs with saw joints every 1.5 m (tile 3 m)."""
    s = 1024
    a = T.colorize(T.tile_noise(s, 6, 5), (168, 166, 160), (196, 194, 188))
    a += (T.R().random((s, s, 1)) - 0.5) * 14
    img = T.to_img(a)
    d = ImageDraw.Draw(img)
    for k in range(3):
        d.line([(k * s // 2, 0), (k * s // 2, s)], fill=(120, 118, 114), width=4)
        d.line([(0, k * s // 2), (s, k * s // 2)], fill=(120, 118, 114), width=4)
    T.save(img, "sidewalk.jpg")


def brick_facade(name, base, trim=(236, 230, 214)):
    """Victorian storefront upper floors: brick, tall arched windows, cornice. 3 bays x 2 floors (3 x 3.6 m)."""
    w, h = 1024, 768
    img = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(img, "RGBA")
    bw, bh = 28, 11
    for r in range(h // bh + 1):
        off = (r % 2) * bw // 2
        for c in range(-1, w // bw + 1):
            g = T.R().normal(0, 10)
            col = tuple(int(np.clip(v + g, 0, 255)) for v in base)
            d.rectangle([c * bw + off + 1, r * bh + 1, c * bw + off + bw - 1, r * bh + bh - 1], fill=col)
    bwid, fl = w / 3, h / 2
    for f in range(2):
        for b in range(3):
            x0, y0 = b * bwid + 70, f * fl + 70
            x1, y1 = (b + 1) * bwid - 70, (f + 1) * fl - 40
            d.pieslice([x0 - 6, y0 - 50, x1 + 6, y0 + 56], 180, 360, fill=trim)
            d.rectangle([x0 - 6, y1, x1 + 6, y1 + 14], fill=trim)
            T.window(img, (x0, y0, x1, y1), tint=(90, 104, 116), frame=(240, 240, 236), fw=6, muntins=1)
            d = ImageDraw.Draw(img, "RGBA")
            d.pieslice([x0, y0 - 44, x1, y0 + 44], 180, 360, fill=(80, 94, 104))
    d.rectangle([0, 0, w, 26], fill=trim)
    T.save(T.grain(T.to_img(T.streaks(np.asarray(img, np.float32), 0.3)), 5), name)


def siding(name, base, shutter=(40, 60, 90)):
    """Detached house: horizontal vinyl siding, windows with shutters. 2 bays (4 m) x 2 floors (3 m)."""
    w, h = 1024, 768
    img = T.wall_base(w, h, base, tuple(min(255, v + 18) for v in base), cells=3)
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(0, h, 12):
        d.line([(0, y), (w, y)], fill=(0, 0, 0, 34), width=2)
    bw, fl = w / 2, h / 2
    for f in range(2):
        for b in range(2):
            x0, y0 = b * bw + 150, f * fl + 70
            x1, y1 = (b + 1) * bw - 150, (f + 1) * fl - 80
            T.window(img, (x0, y0, x1, y1), tint=(90, 104, 116), frame=(246, 246, 242), fw=8, muntins=1)
            d = ImageDraw.Draw(img, "RGBA")
            d.rectangle([x0 - 46, y0, x0 - 8, y1], fill=shutter)
            d.rectangle([x1 + 8, y0, x1 + 46, y1], fill=shutter)
            d.rectangle([x0 - 10, y1, x1 + 10, y1 + 12], fill=(246, 246, 242))
    T.save(T.grain(img, 4), name)


def brick_house():
    """Toronto bay-and-gable semi: red brick, tall windows, white trim. 2 bays x 2 floors."""
    w, h = 1024, 768
    base = (150, 66, 50)
    img = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(img)
    for r in range(h // 11 + 1):
        off = (r % 2) * 14
        for c in range(-1, w // 28 + 1):
            g = T.R().normal(0, 9)
            d.rectangle([c * 28 + off + 1, r * 11 + 1, c * 28 + off + 27, r * 11 + 10], fill=tuple(int(np.clip(v + g, 0, 255)) for v in base))
    for f in range(2):
        for b in range(2):
            x0, y0 = b * 512 + 140, f * 384 + 60
            x1, y1 = (b + 1) * 512 - 140, (f + 1) * 384 - 50
            T.window(img, (x0, y0, x1, y1), tint=(90, 104, 116), frame=(244, 242, 236), fw=8, muntins=1)
            d = ImageDraw.Draw(img)
            d.rectangle([x0 - 12, y0 - 26, x1 + 12, y0 - 6], fill=(236, 230, 214))
    T.save(T.grain(img, 4), "facade_brickhouse.jpg")


def condo():
    """Glass condo tower: floor slabs with glass balconies. 4 bays x 4 floors (3 m)."""
    s = 1024
    img = T.to_img(T.sky_glass(s, s, (90, 130, 150), 0.6))
    d = ImageDraw.Draw(img, "RGBA")
    fl = s / 4
    for f in range(4):
        y = f * fl + fl - 40
        d.rectangle([0, y, s, y + 40], fill=(236, 238, 238))
        d.rectangle([0, y - 70, s, y], fill=(200, 220, 228, 90))
        for x in range(0, s, s // 4):
            d.line([(x, f * fl), (x, f * fl + fl)], fill=(230, 232, 232), width=10)
    T.save(T.grain(img, 4), "facade_condo.jpg")


SHOPS = [("MAPLE DONUTS", (190, 20, 30)), ("PHARMACY", (0, 120, 70)), ("HARDWARE", (230, 120, 20)), ("CAFÉ", (70, 46, 34)),
         ("BOOKS", (30, 60, 120)), ("PIZZA", (200, 40, 30)), ("BARBER", (30, 30, 30)), ("VARIETY", (240, 200, 20)),
         ("CREDIT UNION", (20, 70, 140)), ("PHO", (120, 30, 40)), ("BAKERY", (160, 100, 50)), ("FLOWERS", (80, 140, 60))]


def shop_atlas():
    cw, ch = 512, 340
    atlas = Image.new("RGB", (cw * 4, ch * 3))
    for i, (t, bg) in enumerate(SHOPS):
        img = Image.new("RGB", (cw, ch), (40, 40, 42))
        d = ImageDraw.Draw(img, "RGBA")
        band = int(ch * 0.24)
        d.rectangle([0, 0, cw, band], fill=bg)
        tf(d, (12, 4, cw - 12, band - 4), t, (255, 255, 255) if sum(bg) < 500 else (20, 20, 20), 70)
        inner = T.to_img(T.sky_glass(cw, ch - band, (150, 160, 162), 0.45))
        di = ImageDraw.Draw(inner, "RGBA")
        for _ in range(18):
            x, y = T.R().integers(0, cw, 2)
            c = tuple(int(v * 0.5 + 80) for v in T.R().integers(60, 240, 3)) + (180,)
            di.rectangle([x, y + 40, x + T.R().integers(8, 30), y + 40 + T.R().integers(8, 40)], fill=c)
        img.paste(inner, (0, band))
        d = ImageDraw.Draw(img, "RGBA")
        d.rectangle([0, band, cw, ch], outline=(30, 34, 30), width=10)
        d.rectangle([cw * 0.68, band, cw * 0.86, ch], fill=(40, 30, 24), outline=(20, 20, 20), width=5)   # recessed door
        d.rectangle([0, ch - 30, cw * 0.68, ch], fill=(60, 50, 44))
        atlas.paste(img, ((i % 4) * cw, (i // 4) * ch))
    T.save(atlas, "shop_atlas.jpg", 90)


def shingles(name, base):
    s = 512
    img = Image.new("RGB", (s, s), base)
    d = ImageDraw.Draw(img)
    rows = 16
    for r in range(rows):
        off = (r % 2) * 16
        for c in range(-1, 17):
            g = T.R().normal(0, 10)
            d.rectangle([c * 32 + off + 1, r * 32 + 1, c * 32 + off + 31, r * 32 + 30], fill=tuple(int(np.clip(v + g, 0, 255)) for v in base))
        d.line([(0, r * 32 + 31), (s, r * 32 + 31)], fill=tuple(int(v * 0.5) for v in base), width=3)
    T.save(img, name)


def signs():
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    oct_ = [(s / 2 + (s / 2 - 6) * np.cos(np.pi / 8 + k * np.pi / 4), s / 2 + (s / 2 - 6) * np.sin(np.pi / 8 + k * np.pi / 4)) for k in range(8)]
    d.polygon(oct_, fill=(255, 255, 255))
    oct2 = [(s / 2 + (s / 2 - 26) * np.cos(np.pi / 8 + k * np.pi / 4), s / 2 + (s / 2 - 26) * np.sin(np.pi / 8 + k * np.pi / 4)) for k in range(8)]
    d.polygon(oct2, fill=(200, 16, 30))
    tf(d, (60, 150, s - 60, s - 150), "STOP", (255, 255, 255), 200)
    T.save(img, "sign_stop.png")
    img = Image.new("RGB", (384, 512), (250, 250, 250))
    d = ImageDraw.Draw(img)
    d.rectangle([8, 8, 375, 503], outline=(20, 20, 20), width=10)
    tf(d, (20, 30, 364, 140), "MAXIMUM", (20, 20, 20), 70)
    tf(d, (20, 150, 364, 470), "50", (20, 20, 20), 300)
    T.save(img, "sign_speed.jpg")
    # street name blades atlas (6 rows)
    names = ["QUEEN ST", "ELGIN ST", "COLLEGE ST", "MAPLE CRES", "BIRCH AVE", "CEDAR CRT"]
    img = Image.new("RGB", (1024, 128 * 6), (0, 100, 60))
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        d.rectangle([4, i * 128 + 4, 1019, i * 128 + 123], outline=(255, 255, 255), width=6)
        tf(d, (20, i * 128 + 10, 1004, i * 128 + 118), n, (255, 255, 255), 90)
    T.save(img, "sign_street.jpg")
    img = Image.new("RGB", (512, 768), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 512, 260], fill=(200, 20, 40))
    tf(d, (20, 20, 492, 240), "MAPLEWOOD TRANSIT", (255, 255, 255), 80)
    tf(d, (20, 280, 492, 560), "BUS STOP", (200, 20, 40), 120)
    tf(d, (20, 580, 492, 740), "504  506", (30, 30, 30), 110)
    T.save(img, "sign_busstop.jpg")
    img = Image.new("RGB", (2048, 256), (40, 30, 26))
    d = ImageDraw.Draw(img)
    tf(d, (40, 20, 2008, 236), "MAPLEWOOD COMMUNITY RINK", (250, 220, 120), 160)
    T.save(img, "sign_rink.jpg")


def ice():
    s = 1024
    a = T.colorize(T.tile_noise(s, 8, 4), (214, 226, 236), (240, 246, 250))
    img = T.to_img(a)
    d = ImageDraw.Draw(img)
    d.line([(s / 2, 0), (s / 2, s)], fill=(200, 20, 30), width=14)
    for x in (s * 0.3, s * 0.7):
        d.line([(x, 0), (x, s)], fill=(30, 60, 180), width=14)
    d.ellipse([s / 2 - 120, s / 2 - 120, s / 2 + 120, s / 2 + 120], outline=(30, 60, 180), width=8)
    T.save(img, "ice.jpg")


def livery(name, body, stripe, text, length_px=2048):
    w, h = length_px, 512
    sheet = Image.new("RGB", (w, h * 2))
    for row in range(2):
        img = Image.new("RGB", (w, h), body)
        d = ImageDraw.Draw(img)
        d.rectangle([0, h * 0.62, w, h * 0.74], fill=stripe)
        for i in range(9):
            x0 = 180 + i * 200 if row == 1 else 60 + i * 200
            d.rectangle([x0, h * 0.16, x0 + 180, h * 0.55], fill=(36, 44, 52))
        if row == 1:   # right side (doors), front at image right
            for x0 in (w - 220, w // 2 - 80):
                d.rectangle([x0, h * 0.12, x0 + 160, h * 0.94], fill=(46, 54, 60))
        d.rectangle([w * 0.5 if row else w * 0.05, h * 0.02, w * 0.95 if row else w * 0.5, h * 0.12], fill=(15, 15, 15))
        tf(d, (w * 0.52 if row else w * 0.07, h * 0.02, w * 0.93 if row else w * 0.48, h * 0.12), text, (255, 160, 0), 44, "Regular")
        tf(d, (w * 0.2, h * 0.76, w * 0.8, h * 0.92), "MAPLEWOOD TRANSIT", (255, 255, 255) if sum(body) < 400 else stripe, 60)
        sheet.paste(img, (0, row * h))
    T.save(sheet, name, 90)


def main():
    T.set_out(os.path.join(HERE, "textures"), 41)
    T.asphalt("asphalt.jpg", (46, 46, 48), (72, 71, 70), patches=4, patch_alpha=40, cracks=20)
    sidewalk()
    T.curb("curb.jpg", (160, 158, 152), (196, 194, 188))
    T.noise_tex("lawn.jpg", (66, 100, 44), (118, 144, 70), speck=34)
    T.noise_tex("concrete.jpg", (150, 148, 142), (186, 184, 178), streak=False)
    T.noise_tex("water.jpg", (50, 80, 100), (80, 112, 130), cells=5, speck=6)
    T.noise_tex("wall_plain.jpg", (196, 190, 180), (220, 214, 204), cells=4, s=512, speck=8, streak=True)
    T.noise_tex("bark.jpg", (60, 50, 44), (96, 84, 72), cells=12, s=256, speck=20)
    for nm, c0, c1 in (("leaves_red", (130, 20, 16), (210, 50, 30)), ("leaves_orange", (180, 80, 10), (240, 140, 40)),
                       ("leaves_yellow", (190, 150, 20), (240, 210, 70)), ("leaves_green", (40, 80, 30), (100, 140, 60))):
        T.leaves(nm + ".jpg", c0, c1)
    brick_facade("facade_vic_red.jpg", (150, 64, 48))
    brick_facade("facade_vic_yellow.jpg", (200, 170, 110), trim=(110, 40, 30))
    siding("facade_siding_white.jpg", (226, 226, 220))
    siding("facade_siding_blue.jpg", (140, 162, 184), shutter=(250, 250, 250))
    siding("facade_siding_beige.jpg", (206, 190, 160), shutter=(80, 40, 30))
    brick_house(); condo(); shop_atlas()
    shingles("shingles_grey.jpg", (78, 80, 84)); shingles("shingles_brown.jpg", (96, 72, 56))
    signs(); ice()
    livery("streetcar_side.jpg", (236, 236, 232), (200, 20, 40), "501 QUEEN  MAPLEWOOD LOOP", 3072)
    livery("bus_side.jpg", (236, 236, 232), (200, 20, 40), "504  MAPLEWOOD - COLLEGE")


if __name__ == "__main__":
    main()
