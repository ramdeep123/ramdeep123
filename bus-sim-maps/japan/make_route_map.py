"""Draw the bus route and stops over the top-down render -> out/previews/route_map.jpg.

    python make_route_map.py          (needs Pillow; run after build_city.py --render)

Matches Cam_TopDown in build_city.py: orthographic, centred on (0, 40), 780 m wide.
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
CX, CY, SPAN = 0.0, 40.0, 780.0
FONTS = ["/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf", "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
         "C:/Windows/Fonts/msgothic.ttc"]


def main():
    data = json.load(open(os.path.join(OUT, "japan_sakuragaoka_route.json"), encoding="utf-8"))
    img = Image.open(os.path.join(OUT, "previews", "topdown.jpg")).convert("RGB")
    W, H = img.size

    def px(p):
        return ((p[0] - (CX - SPAN / 2)) / SPAN * W, ((CY + SPAN / 2) - p[1]) / SPAN * H)

    fpath = next((f for f in FONTS if os.path.exists(f)), None)
    font = ImageFont.truetype(fpath, 30) if fpath else ImageFont.load_default()
    d = ImageDraw.Draw(img, "RGBA")
    pts = [px(p) for p in data["route"]["points"]]
    d.line(pts + [pts[0]], fill=(255, 90, 0, 230), width=9, joint="curve")
    for i in range(0, len(pts) - 6, 40):                       # direction arrows
        (x0, y0), (x1, y1) = pts[i], pts[i + 5]
        d.line([(x0, y0), (x1, y1)], fill=(255, 255, 255, 255), width=4)
        d.ellipse([x1 - 6, y1 - 6, x1 + 6, y1 + 6], fill=(255, 255, 255, 255))
    for n, st in enumerate(data["stops"]):
        x, y = px(st["stop_point"])
        d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=(20, 60, 160, 255), outline=(255, 255, 255, 255), width=4)
        label = f"{n + 1}  {st['name_ja']}  {st['name_en']}"
        tb = d.textbbox((x + 24, y - 18), label, font=font)
        d.rectangle([tb[0] - 6, tb[1] - 4, tb[2] + 6, tb[3] + 4], fill=(255, 255, 255, 220))
        d.text((x + 24, y - 18), label, font=font, fill=(20, 20, 20, 255))
    sp = data["spawn"]["position"]
    x, y = px(sp)
    d.polygon([(x + 22, y), (x - 10, y - 14), (x - 10, y + 14)], fill=(0, 200, 90, 255))
    title = f"桜ヶ丘循環 Sakuragaoka Loop - {data['route']['length_m']:.0f} m, {len(data['stops'])} stops, left-hand traffic"
    d.rectangle([0, 0, W, 56], fill=(0, 0, 0, 160))
    d.text((20, 10), title, font=font, fill=(255, 255, 255, 255))
    out = os.path.join(OUT, "previews", "route_map.jpg")
    img.save(out, quality=90)
    print("wrote", out)


if __name__ == "__main__":
    main()
