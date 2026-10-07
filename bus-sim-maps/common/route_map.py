"""Draw a map's bus route and stops over its top-down render.

    python ../common/route_map.py <map_dir> <map_name> <cx> <cy> <span> [font.ttf]

Writes <map_dir>/out/previews/route_map.jpg. cx, cy, span must match the
map's orthographic Cam_TopDown (centre and width in metres).
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def main(map_dir, name, cx, cy, span, fpath=None):
    out = os.path.join(map_dir, "out")
    data = json.load(open(os.path.join(out, name + "_route.json"), encoding="utf-8"))
    img = Image.open(os.path.join(out, "previews", "topdown.jpg")).convert("RGB")
    W, H = img.size

    def px(p):
        return ((p[0] - (cx - span / 2)) / span * W, ((cy + span / 2) - p[1]) / span * H)

    try:
        f = ImageFont.truetype(fpath, 28) if fpath else ImageFont.truetype("DejaVuSans-Bold.ttf", 26)
        try:
            f.set_variation_by_name("Bold")
        except Exception:
            pass
    except Exception:
        f = ImageFont.load_default()
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
        label = f"{n + 1}  {st.get('name_local', '')}  {st['name_en']}".replace("    ", "  ")
        tb = d.textbbox((x + 22, y - 20), label, font=f)
        if tb[2] > W - 10:
            tb = d.textbbox((x - 22 - (tb[2] - tb[0]), y - 20), label, font=f)
        d.rectangle([tb[0] - 6, tb[1] - 4, tb[2] + 6, tb[3] + 4], fill=(255, 255, 255, 225))
        d.text((tb[0], tb[1] - (tb[1] - (y - 20))), label, font=f, fill=(20, 20, 20, 255))
    rt = data["route"]
    title = f"{rt.get('number', '')} {rt.get('name_local', '')} {rt.get('name_en', '')} · {rt['length_m']:.0f} m, {len(data['stops'])} stops, {data['traffic']} traffic"
    d.rectangle([0, 0, W, 58], fill=(0, 0, 0, 160))
    d.text((20, 10), title.strip(), font=f, fill=(255, 255, 255, 255))
    path = os.path.join(out, "previews", "route_map.jpg")
    img.save(path, quality=90)
    print("wrote", path)


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], a[1], float(a[2]), float(a[3]), float(a[4]), a[5] if len(a) > 5 else None)
