"""Textures for the China map (金河新区 Jinhe New District).

    python make_textures.py       (Pillow + numpy; downloads Noto Sans SC if missing)
"""
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
import nbs_tex as T  # noqa: E402

FONT = os.path.join(HERE, "fonts", "NotoSansSC.ttf")
FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"


def tf(d, box, text, fill, size=200, vertical=False):
    T.text_fit(d, box, text, fill, FONT, size, vertical=vertical)


def facade_highrise(name, c0, c1, frame=(200, 200, 196)):
    """Residential tower: 3 units (3.6 m) x 4 floors (3 m) - windows, enclosed balconies, AC units."""
    w, h = 1024, 1138          # 10.8 x 12 m
    img = T.wall_base(w, h, c0, c1)
    d = ImageDraw.Draw(img, "RGBA")
    uw, fl = w / 3, h / 4
    for f in range(4):
        y0 = f * fl
        d.rectangle([0, y0, w, y0 + 16], fill=(0, 0, 0, 30))
        for u in range(3):
            x0 = u * uw
            if T.R().random() < 0.5:     # enclosed balcony glazing
                T.window(img, (x0 + 18, y0 + 60, x0 + uw - 18, y0 + fl - 30), tint=(100, 126, 140), frame=frame, fw=6, muntins=1)
            else:
                T.window(img, (x0 + 60, y0 + 70, x0 + uw - 60, y0 + fl - 70), tint=(100, 126, 140), frame=frame, fw=6)
            if T.R().random() < 0.6:     # AC outdoor unit in its cage
                ax = x0 + uw - 80
                d.rectangle([ax, y0 + fl - 60, ax + 66, y0 + fl - 14], fill=(236, 236, 230), outline=(150, 150, 150), width=3)
                for k in range(4):
                    d.line([(ax + 6 + k * 16, y0 + fl - 58), (ax + 6 + k * 16, y0 + fl - 16)], fill=(160, 160, 160), width=2)
            if T.R().random() < 0.25:    # laundry pole sticking out
                d.line([(x0 + 30, y0 + 50), (x0 + uw - 30, y0 + 50)], fill=(150, 150, 150), width=3)
                for k in range(T.R().integers(2, 6)):
                    lx = x0 + 40 + k * 40
                    d.rectangle([lx, y0 + 52, lx + 26, y0 + 52 + T.R().integers(40, 90)], fill=tuple(int(v) for v in T.R().integers(90, 250, 3)))
    T.save(T.grain(T.to_img(T.streaks(np.asarray(img, np.float32), 0.35)), 5), name)


def facade_office(name, tint, mull=(60, 66, 72)):
    s = 1024
    img = T.to_img(T.sky_glass(s, s, tint, 0.62))
    d = ImageDraw.Draw(img, "RGBA")
    fl = s / 4
    for f in range(4):
        d.rectangle([0, f * fl + fl - 34, s, f * fl + fl], fill=mull + (255,))
        for x in range(0, s, s // 6):
            d.line([(x, f * fl), (x, f * fl + fl)], fill=mull, width=7)
        for b in range(6):
            if T.R().random() < 0.4:
                x0 = b * s / 6
                d.rectangle([x0 + 6, f * fl, x0 + s / 6 - 6, f * fl + fl * T.R().uniform(0.2, 0.6)], fill=(220, 222, 220, 120))
    T.save(T.grain(img, 4), name)


SHOPS = [("超市", "SUPERMARKET", (230, 30, 40)), ("药店", "PHARMACY", (0, 140, 80)), ("金河银行", "BANK", (190, 20, 30)),
         ("奶茶", "MILK TEA", (240, 150, 40)), ("便利店", "24H", (30, 110, 200)), ("兰州拉面", "NOODLES", (200, 40, 30)),
         ("水果", "FRUIT", (60, 170, 60)), ("手机", "MOBILE", (20, 20, 20)), ("理发", "SALON", (120, 40, 140)),
         ("火锅", "HOTPOT", (200, 20, 20)), ("包子铺", "BUNS", (240, 200, 40)), ("咖啡", "COFFEE", (80, 50, 30))]


def shop_atlas():
    cw, ch = 512, 340
    atlas = Image.new("RGB", (cw * 4, ch * 3))
    for i, (cn, en, bg) in enumerate(SHOPS):
        img = Image.new("RGB", (cw, ch), (46, 48, 52))
        d = ImageDraw.Draw(img, "RGBA")
        band = int(ch * 0.3)
        d.rectangle([0, 0, cw, band], fill=bg)
        fg = (255, 255, 255) if sum(bg) < 500 else (30, 30, 30)
        tf(d, (10, 2, cw * 0.72, band - 2), cn, fg, 90)
        tf(d, (cw * 0.7, 6, cw - 8, band - 6), en, fg, 34)
        inner = T.to_img(T.sky_glass(cw, ch - band, (180, 186, 186), 0.5))
        di = ImageDraw.Draw(inner, "RGBA")
        for _ in range(26):
            x, y = T.R().integers(0, cw, 2)
            c = tuple(int(v * 0.55 + 80) for v in T.R().integers(60, 240, 3)) + (200,)
            di.rectangle([x, y + 30, x + T.R().integers(6, 20), y + 30 + T.R().integers(10, 40)], fill=c)
        img.paste(inner, (0, band))
        d = ImageDraw.Draw(img, "RGBA")
        d.rectangle([0, band, cw, ch], outline=(150, 156, 160), width=8)
        d.line([(cw * 0.5, band), (cw * 0.5, ch)], fill=(150, 156, 160), width=6)
        if i in (5, 9, 10):   # red lanterns / door curtain
            for k in range(2):
                cx = cw * (0.25 + 0.5 * k)
                d.ellipse([cx - 22, band + 8, cx + 22, band + 56], fill=(220, 30, 30), outline=(250, 200, 40), width=3)
        atlas.paste(img, ((i % 4) * cw, (i // 4) * ch))
    T.save(atlas, "shop_atlas.jpg", 90)


def mall_band():
    """Mall facade band: LED screens & big signage (4 cells, 1024 x 256 each)."""
    w, h = 1024, 256
    texts = [("金河广场", "JINHE PLAZA", (200, 20, 30)), ("万家购物中心", "MALL", (20, 60, 150)),
             ("影城 IMAX", "CINEMA", (20, 20, 20)), ("美食街", "FOOD STREET", (240, 140, 0))]
    atlas = Image.new("RGB", (w, h * 4))
    for i, (cn, en, bg) in enumerate(texts):
        img = Image.new("RGB", (w, h), bg)
        d = ImageDraw.Draw(img)
        tf(d, (20, 10, w * 0.7, h - 10), cn, (255, 255, 255), 180)
        tf(d, (w * 0.7, 40, w - 20, h - 40), en, (255, 230, 120), 70)
        atlas.paste(img, (0, i * h))
    T.save(atlas, "mall_band.jpg", 90)


def signs():
    # bus stop board
    img = Image.new("RGB", (1024, 384), (20, 90, 170))
    d = ImageDraw.Draw(img)
    d.rectangle([8, 8, 1015, 375], outline=(255, 255, 255), width=8)
    tf(d, (30, 20, 994, 230), "公交站", (255, 255, 255), 190)
    tf(d, (30, 230, 994, 360), "BUS STOP", (255, 230, 0), 110)
    T.save(img, "sign_busstop.jpg")
    # blue guide sign
    img = Image.new("RGB", (1024, 512), (20, 60, 160))
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, 1013, 501], outline=(255, 255, 255), width=8)
    rows = [("世纪大道", "Century Ave"), ("金河路", "Jinhe Rd"), ("人民路", "Renmin Rd")]
    for i, (cn, en) in enumerate(rows):
        y = 30 + i * 158
        tf(d, (40, y, 600, y + 110), cn, (255, 255, 255), 100)
        tf(d, (600, y + 20, 990, y + 100), en, (255, 255, 255), 60)
    T.save(img, "sign_guide.jpg")
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([8, 8, s - 8, s - 8], fill=(206, 16, 32))
    d.ellipse([60, 60, s - 60, s - 60], fill=(255, 255, 255))
    tf(d, (110, 110, s - 110, s - 110), "60", (10, 10, 10), 220)
    T.save(img, "sign_speed.png")
    # compound gate name + pagoda plaque + hub name
    for name, cn, en, bg, fg in (("sign_compound.jpg", "金河花园", "JINHE GARDEN", (150, 20, 20), (250, 210, 90)),
                                 ("sign_hub.jpg", "金河新区公交枢纽", "JINHE BUS HUB", (240, 240, 236), (20, 90, 170)),
                                 ("sign_temple.jpg", "金河塔", "JINHE PAGODA", (30, 30, 34), (240, 200, 80))):
        img = Image.new("RGB", (2048, 256), bg)
        d = ImageDraw.Draw(img)
        tf(d, (40, 10, 1300, 246), cn, fg, 200)
        tf(d, (1320, 40, 2010, 216), en, fg, 100)
        T.save(img, name)


def road_text():
    w, h = 512, 1024
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    tmp = Image.new("L", (300, 1200), 0)
    d = ImageDraw.Draw(tmp)
    T.text_fit(d, (0, 0, 300, 1200), "公交专用", 255, FONT, 300, vertical=True)
    tmp = tmp.crop(tmp.getbbox()).resize((w - 120, h - 40))
    img.paste((236, 180, 20, 255), (60, 20), tmp)
    T.save(img, "paint_buslane.png")


def roof_tile():
    """Grey curved roof tiles (1 m tile), courses along u, barrels down the slope (v)."""
    s = 512
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    wave = 0.5 + 0.5 * np.cos(xx / s * 5 * 2 * np.pi)
    rows = (yy / s * 6) % 1.0
    shade = 0.35 + 0.65 * wave ** 0.8 * (0.8 + 0.2 * rows)
    shade *= np.where(rows > 0.92, 0.6, 1.0)
    a = shade[..., None] * np.array((92, 96, 102), np.float32) * (0.9 + 0.2 * T.tile_noise(s, 6, 4))[..., None]
    T.save(T.to_img(a), "roof_tile.jpg")


def grey_brick():
    s = 512
    img = Image.new("RGB", (s, s), (110, 110, 110))
    d = ImageDraw.Draw(img)
    bw, bh = 64, 22
    for r in range(s // bh + 1):
        off = (r % 2) * bw // 2
        for c in range(-1, s // bw + 1):
            g = int(T.R().normal(140, 9))
            d.rectangle([c * bw + off + 2, r * bh + 2, c * bw + off + bw - 2, r * bh + bh - 2], fill=(g, g + 2, g + 4))
    T.save(img, "grey_brick.jpg")


def main():
    if not os.path.exists(FONT):
        os.makedirs(os.path.dirname(FONT), exist_ok=True)
        print("downloading Noto Sans SC ...")
        urllib.request.urlretrieve(FONT_URL, FONT)
    T.set_out(os.path.join(HERE, "textures"), 21)
    T.asphalt("asphalt.jpg", (42, 43, 46), (66, 66, 68), patches=2, patch_alpha=25, cracks=8)
    T.pavers("sidewalk.jpg", [(172, 168, 160), (160, 156, 150), (180, 176, 168)], bw=120, bh=60)
    T.curb("curb.jpg", (170, 170, 168), (205, 204, 200))
    T.noise_tex("bike_lane.jpg", (120, 50, 46), (150, 66, 58), speck=18)
    T.noise_tex("grass.jpg", (60, 96, 44), (110, 140, 66), speck=30)
    T.noise_tex("ground.jpg", (118, 112, 100), (156, 150, 136), speck=20)
    T.noise_tex("water.jpg", (52, 82, 82), (84, 112, 106), cells=5, speck=6)
    T.noise_tex("stone.jpg", (140, 136, 128), (182, 178, 170), cells=10, speck=24)
    T.noise_tex("concrete.jpg", (140, 140, 136), (180, 180, 176), streak=True)
    T.leaves("leaves.jpg", (34, 66, 30), (92, 132, 54))
    T.leaves("willow.jpg", (70, 110, 40), (140, 170, 80))
    facade_highrise("facade_highrise_white.jpg", (226, 224, 218), (242, 240, 236))
    facade_highrise("facade_highrise_beige.jpg", (212, 196, 170), (230, 218, 196))
    facade_highrise("facade_highrise_brick.jpg", (170, 110, 90), (190, 130, 106))
    facade_office("facade_office_blue.jpg", (80, 120, 160))
    facade_office("facade_office_green.jpg", (80, 140, 130), (190, 196, 196))
    T.noise_tex("wall_white.jpg", (214, 212, 206), (236, 234, 230), cells=4, s=512, speck=8, streak=True)
    shop_atlas(); mall_band(); signs(); road_text(); roof_tile(); grey_brick()


if __name__ == "__main__":
    main()
