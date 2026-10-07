"""Draw route 500 and its stops over the top-down render -> out/previews/route_map.jpg.

    python make_route_map.py          (needs Pillow with libraqm; run after build_india.py --render)

Matches Cam_TopDown in build_india.py: orthographic, centred on (50, 20), 1000 m wide.
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
CX, CY, SPAN = 50.0, 20.0, 1000.0
FONT = os.path.join(HERE, "fonts", "NotoSansKannada.ttf")


def font(size):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name("Bold")
    except Exception:
        pass
    return f


def main():
    data = json.load(open(os.path.join(OUT, "india_mallige_nagar_route.json"), encoding="utf-8"))
    img = Image.open(os.path.join(OUT, "previews", "topdown.jpg")).convert("RGB")
    W, H = img.size

    def px(p):
        return ((p[0] - (CX - SPAN / 2)) / SPAN * W, ((CY + SPAN / 2) - p[1]) / SPAN * H)

    f = font(28)
    d = ImageDraw.Draw(img, "RGBA")
    pts = [px(p) for p in data["route"]["points"]]
    d.line(pts + [pts[0]], fill=(255, 90, 0, 230), width=8, joint="curve")
    for i in range(0, len(pts) - 6, 45):
        (x0, y0), (x1, y1) = pts[i], pts[i + 5]
        d.line([(x0, y0), (x1, y1)], fill=(255, 255, 255, 255), width=4)
        d.ellipse([x1 - 6, y1 - 6, x1 + 6, y1 + 6], fill=(255, 255, 255, 255))
    for n, st in enumerate(data["stops"]):
        x, y = px(st["stop_point"])
        d.ellipse([x - 15, y - 15, x + 15, y + 15], fill=(20, 90, 160, 255), outline=(255, 255, 255, 255), width=4)
        label = f"{n + 1}  {st['name_kn']}  {st['name_en']}"
        tb = d.textbbox((x + 22, y - 20), label, font=f)
        d.rectangle([tb[0] - 6, tb[1] - 4, tb[2] + 6, tb[3] + 4], fill=(255, 255, 255, 225))
        d.text((x + 22, y - 20), label, font=f, fill=(20, 20, 20, 255))
    title = f"Route {data['route']['number']}  {data['route']['name_kn']}  ·  {data['route']['length_m']:.0f} m, {len(data['stops'])} stops, left-hand traffic"
    d.rectangle([0, 0, W, 58], fill=(0, 0, 0, 160))
    d.text((20, 8), title, font=f, fill=(255, 255, 255, 255))
    out = os.path.join(OUT, "previews", "route_map.jpg")
    img.save(out, quality=90)
    print("wrote", out)


if __name__ == "__main__":
    main()
