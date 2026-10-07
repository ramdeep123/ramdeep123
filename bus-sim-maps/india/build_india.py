"""Mallige Nagar (ಮಲ್ಲಿಗೆ ನಗರ) - a Bengaluru-style district for NammaBusSim, built in Blender.

    blender -b -P build_india.py -- [--out DIR] [--render] [--samples 40] [--no-glb] [--only Circle]

Needs shapely inside Blender's Python (see README). Roads are smooth splines, not
a grid: an S-curved Outer Ring Road under an elevated metro, a 4-lane Main Road,
a traffic "circle" (roundabout) with a statue, a lake road bending round a kere,
winding old-town lanes and a slightly skewed planned layout. Junctions,
rounded kerbs, medians and markings are derived from the curves automatically.
LEFT-HAND traffic, Indian markings and street life.

Units: metres. Blender axes: +X east, +Y north, +Z up.
"""
import json
import math
import os
import random
import sys

import bpy
import numpy as np
from PIL import Image, ImageDraw
import shapely
from shapely.geometry import LineString, MultiLineString, Point, Polygon, box as sbox
from shapely.ops import polygonize, substring, unary_union


def _find_dir():
    cands = []
    if "__file__" in globals():
        cands.append(os.path.dirname(os.path.abspath(__file__)))
    for t in bpy.data.texts:
        if t.filepath:
            cands.append(os.path.dirname(bpy.path.abspath(t.filepath)))
    cands += [os.environ.get("NBS_INDIA_DIR", ""), os.getcwd()]
    for c in cands:
        if c and os.path.isdir(os.path.join(c, "textures")) and os.path.isfile(os.path.join(c, "build_india.py")):
            return c
    raise RuntimeError("Can't find the india map folder; set NBS_INDIA_DIR")


HERE = _find_dir()
sys.path.insert(0, os.path.join(HERE, "..", "common"))
import nbs_kit as K  # noqa: E402
from nbs_kit import face, poly, box, obox, cyl, tube, blob, crown, local, srgb  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def _arg(name, default=None):
    if name in ARGS:
        i = ARGS.index(name)
        return ARGS[i + 1] if i + 1 < len(ARGS) and not ARGS[i + 1].startswith("--") else True
    return default


OUT = os.path.abspath(_arg("--out", os.path.join(HERE, "out")))
SEED = int(_arg("--seed", 560))
R = random.Random(SEED)
MAP = "india_mallige_nagar"
CORE = (-460.0, -420.0, 560.0, 460.0)
WORLD = (-720.0, -680.0, 720.0, 680.0)
FP_H = 0.2                    # footpath kerb height (Indian kerbs are tall)

# ------------------------------------------------------------- materials
MATS = {
    "asphalt": dict(img="asphalt.jpg", T=7.0, rough=0.9, bump=0.3),
    "pavers": dict(img="pavers.jpg", T=2.4, rough=0.85, bump=0.15),
    "curb_bw": dict(img="curb_bw.jpg", rough=0.7),
    "concrete": dict(img="concrete.jpg", T=6.0, rough=0.85),
    "soil": dict(img="soil.jpg", T=14.0, rough=1.0),
    "grass": dict(img="grass.jpg", T=4.0, rough=0.95),
    "far_ground": dict(color=srgb(104, 100, 74), rough=1.0),
    "water": dict(img="water.jpg", T=20.0, rough=0.05, metal=0.0),
    "leaves": dict(img="leaves.jpg", T=1.6, rough=0.9),
    "palm": dict(img="palm_frond.png", alpha=True, rough=0.8),
    "paint_white": dict(color=srgb(235, 235, 228), rough=0.6),
    "paint_yellow": dict(color=srgb(236, 180, 20), rough=0.6),
    "paint_busstop": dict(img="paint_busstop.png", alpha=True, rough=0.6),
    "paint_slow": dict(img="paint_slow.png", alpha=True, rough=0.6),
    "f_pink": dict(img="facade_house_pink.jpg", tw=7.0, th=6.0, rough=0.8),
    "f_yellow": dict(img="facade_house_yellow.jpg", tw=7.0, th=6.0, rough=0.8),
    "f_mint": dict(img="facade_house_mint.jpg", tw=7.0, th=6.0, rough=0.8),
    "f_blue": dict(img="facade_house_blue.jpg", tw=7.0, th=6.0, rough=0.8),
    "f_orange": dict(img="facade_house_orange.jpg", tw=7.0, th=6.0, rough=0.8),
    "f_white": dict(img="facade_house_white.jpg", tw=7.0, th=6.0, rough=0.8),
    "f_shoprow": dict(img="facade_shoprow.jpg", tw=14.0, th=9.6, rough=0.8),
    "f_complex": dict(img="facade_complex.jpg", tw=14.0, th=14.0, rough=0.15, metal=0.3),
    "f_apartment": dict(img="facade_apartment.jpg", tw=12.0, th=12.0, rough=0.7),
    "f_techpark": dict(img="facade_techpark.jpg", tw=16.0, th=16.0, rough=0.1, metal=0.4),
    "wall_plain": dict(img="wall_plain.jpg", T=6.0, rough=0.85),
    "compound": dict(img="compound_wall.jpg", T=2.0, rough=0.9),
    "shops": dict(img="shop_atlas.jpg", rough=0.5),
    "hoarding": dict(img="hoarding_atlas.jpg", rough=0.5, emit_tex=0.2),
    "sign_busstop": dict(img="sign_busstop.jpg", rough=0.4),
    "sign_speed": dict(img="sign_speed40.png", alpha=True, rough=0.4),
    "sign_noparking": dict(img="sign_noparking.png", alpha=True, rough=0.4),
    "sign_dir": dict(img="sign_direction.jpg", rough=0.4),
    "sign_metro": dict(img="sign_metro.jpg", rough=0.4, emit_tex=0.3),
    "sign_temple": dict(img="sign_temple.jpg", rough=0.5),
    "sign_depot": dict(img="sign_depot.jpg", rough=0.4),
    "gopuram": dict(img="gopuram.jpg", rough=0.7),
    "bus_side": dict(img="bus_side.jpg", rough=0.3),
    "metro_side": dict(img="metro_side.jpg", rough=0.25, metal=0.4),
    "metal_light": dict(color=srgb(190, 192, 192), rough=0.4, metal=0.5),
    "metal_dark": dict(color=srgb(64, 66, 70), rough=0.45, metal=0.6),
    "steel": dict(color=srgb(150, 152, 156), rough=0.3, metal=1.0),
    "wire": dict(color=srgb(18, 18, 18), rough=0.6),
    "pole": dict(color=srgb(160, 158, 150), rough=0.8),
    "tank_black": dict(color=srgb(22, 22, 24), rough=0.5),
    "tile_red": dict(color=srgb(170, 70, 44), rough=0.7),
    "tin_blue": dict(color=srgb(50, 90, 150), rough=0.4, metal=0.5),
    "tin_green": dict(color=srgb(40, 120, 80), rough=0.4, metal=0.5),
    "glass": dict(color=srgb(60, 80, 90), rough=0.05, metal=0.4),
    "white": dict(color=srgb(238, 238, 232), rough=0.5),
    "wood": dict(color=srgb(110, 80, 56), rough=0.8),
    "bronze": dict(color=srgb(120, 90, 50), rough=0.35, metal=0.9),
    "gold": dict(color=srgb(220, 170, 60), rough=0.25, metal=1.0),
    "flowers": dict(color=srgb(220, 60, 30), rough=0.8),
    "rubber": dict(color=srgb(22, 22, 22), rough=0.9),
    "lamp_red": dict(color=srgb(230, 20, 20), emit=srgb(255, 30, 20), emit_s=10.0),
    "lamp_green": dict(color=srgb(20, 220, 80), emit=srgb(40, 255, 90), emit_s=10.0),
    "lamp_off": dict(color=srgb(36, 36, 36), rough=0.2),
    "lamp_white": dict(color=srgb(250, 250, 240), emit=srgb(255, 250, 235), emit_s=2.0),
    "auto_green": dict(color=srgb(30, 130, 60), rough=0.4),
    "auto_yellow": dict(color=srgb(240, 200, 20), rough=0.4),
    "cow": dict(color=srgb(226, 220, 206), rough=0.9),
    "car_white": dict(color=srgb(232, 232, 230), rough=0.25, metal=0.2),
    "car_silver": dict(color=srgb(170, 172, 176), rough=0.25, metal=0.7),
    "car_red": dict(color=srgb(160, 30, 30), rough=0.25, metal=0.3),
    "car_blue": dict(color=srgb(40, 70, 130), rough=0.25, metal=0.3),
    "car_black": dict(color=srgb(18, 18, 20), rough=0.2, metal=0.3),
    "purple": dict(color=srgb(110, 40, 130), rough=0.4),
}
K.configure(WORLD, MATS, os.path.join(HERE, "textures"), seed=SEED)

# -------------------------------------------------------------- road classes
RC = {
    "orr": dict(lanes=3, lane_w=3.5, median=3.0, shoulder=0.5, sw=3.0, speed=50),
    "main": dict(lanes=2, lane_w=3.5, median=1.2, shoulder=0.4, sw=2.5, speed=40),
    "road": dict(lanes=1, lane_w=3.75, median=0.0, shoulder=0.25, sw=2.0, speed=30),
    "cross": dict(lanes=1, lane_w=3.0, median=0.0, shoulder=0.0, sw=0.0, speed=25),
    "lane": dict(lanes=1, lane_w=2.25, median=0.0, shoulder=0.0, sw=0.0, speed=20),
    "drive": dict(lanes=1, lane_w=3.5, median=0.0, shoulder=0.0, sw=0.0, speed=15),
}
RANK = {"orr": 5, "main": 4, "road": 3, "cross": 2, "lane": 1, "drive": 1}

CIRCLE = dict(c=(-70.0, 120.0), ri=13.0, ro=23.0, name_kn="ಮಲ್ಲಿಗೆ ವೃತ್ತ", name_en="Mallige Circle")
LAKE = dict(c=(330.0, 292.0), rx=126.0, ry=78.0, rot=12.0)
DEPOT = dict(x0=74.0, y0=-258.0, x1=172.0, y1=-168.0)


class Road:
    def __init__(self, name, cls, pts, start_on=None, end_on=None, kn="", en=""):
        self.name, self.cls, self.ctrl = name, cls, pts
        self.start_on, self.end_on, self.kn, self.en = start_on, end_on, kn, en
        p = RC[cls]
        self.p = p
        self.cw = p["median"] + 2 * (p["lanes"] * p["lane_w"] + p["shoulder"])
        self.sw = p["sw"]
        self.rank = RANK[cls]
        self.line = None

    @property
    def half(self):
        return self.cw / 2 + self.sw

    def lane_offset(self):
        """Centre of the kerb-side (left) lane from the centreline."""
        return self.p["median"] / 2 + (self.p["lanes"] - 0.5) * self.p["lane_w"]


ROADS = [
    Road("ORR", "orr", [(-720, -262), (-450, -250), (-250, -200), (-60, -130), (120, -62), (300, -40), (480, -82), (720, -150)],
         kn="ಹೊರ ವರ್ತುಲ ರಸ್ತೆ", en="Outer Ring Road"),
    Road("MAIN_N", "main", [(-185, 680), (-165, 430), (-120, 260), (-82, 170), CIRCLE["c"]], kn="ಮಲ್ಲಿಗೆ ಮುಖ್ಯ ರಸ್ತೆ", en="Mallige Main Road"),
    Road("MAIN_S", "main", [CIRCLE["c"], (-46, 55), (-18, -10), (18, -80), (45, -160), (70, -300), (62, -460), (50, -680)],
         kn="ಮಲ್ಲಿಗೆ ಮುಖ್ಯ ರಸ್ತೆ", en="Mallige Main Road"),
    Road("TEMPLE_ST", "road", [CIRCLE["c"], (-150, 112), (-235, 96), (-330, 92), (-450, 70), (-720, 40)], kn="ದೇವಸ್ಥಾನ ಬೀದಿ", en="Temple Street"),
    Road("LAKE_RD", "road", [CIRCLE["c"], (10, 140), (110, 165), (220, 178), (330, 182), (430, 200), (505, 240)], end_on="EAST_RD",
         kn="ಕೆರೆ ರಸ್ತೆ", en="Kere Road"),
    Road("EAST_RD", "road", [(330, -45), (420, 40), (500, 150), (520, 260), (545, 420), (590, 680)], start_on="ORR",
         kn="ಪೂರ್ವ ರಸ್ತೆ", en="East Road"),
    Road("LAKEVIEW_RD", "road", [(-150, 350), (0, 345), (140, 395), (300, 418), (450, 420), (545, 420)], start_on="MAIN_N", end_on="EAST_RD",
         kn="ಕೆರೆ ನೋಟ ರಸ್ತೆ", en="Lake View Road"),
    Road("SOUTH_RD", "road", [(-720, -430), (-400, -410), (-120, -380), (66, -372), (400, -395), (720, -350)], kn="ದಕ್ಷಿಣ ರಸ್ತೆ", en="South Road"),
    Road("WEST_LAKE_LN", "cross", [(110, 165), (95, 250), (70, 345)], start_on="LAKE_RD", end_on="LAKEVIEW_RD"),
    # old town (pete) lanes - organic, winding
    Road("L1", "lane", [(-235, 96), (-245, 40), (-218, -15), (-238, -75), (-262, -150), (-265, -205)], start_on="TEMPLE_ST", end_on="ORR"),
    Road("L2", "lane", [(-330, 92), (-338, 25), (-305, -55), (-332, -140), (-360, -228)], start_on="TEMPLE_ST", end_on="ORR"),
    Road("L3", "cross", [(-150, 112), (-158, 45), (-128, -20), (-146, -95), (-160, -170)], start_on="TEMPLE_ST", end_on="ORR"),
    Road("L4", "lane", [(-470, 28), (-338, 25), (-245, 40), (-158, 45), (-46, 55)], end_on="MAIN_S"),
    Road("L5", "lane", [(-470, -62), (-305, -55), (-238, -75), (-146, -95)], end_on="L3"),
    Road("L6", "cross", [(-300, 93), (-312, 180), (-292, 250), (-285, 300), (-305, 450), (-300, 680)], start_on="TEMPLE_ST"),
    Road("L7", "lane", [(-200, 104), (-210, 180), (-195, 248), (-205, 340), (-225, 470), (-232, 680)], start_on="TEMPLE_ST"),
    Road("L8", "cross", [(-720, 262), (-470, 250), (-292, 250), (-195, 248), (-122, 258)], end_on="MAIN_N"),
    Road("L9", "lane", [(-470, 395), (-300, 385), (-210, 400), (-160, 395)], end_on="MAIN_N"),
    Road("L10", "cross", [(-360, -228), (-350, -310), (-330, -405)], start_on="ORR", end_on="SOUTH_RD"),
    Road("L11", "lane", [(-150, -165), (-120, -260), (-140, -380)], start_on="ORR", end_on="SOUTH_RD"),
    Road("L12", "lane", [(-470, -320), (-350, -310), (-120, -260), (48, -270)], end_on="MAIN_S"),
    Road("L13", "cross", [(400, -50), (420, -200), (400, -390)], start_on="ORR", end_on="SOUTH_RD"),
    Road("L14", "cross", [(520, 260), (620, 250), (720, 270)], start_on="EAST_RD"),
    Road("L15", "lane", [(-470, 150), (-380, 160), (-312, 180)], end_on="L6"),
    Road("GATE", "drive", [(80, -215), (55, -215)], end_on="MAIN_S"),
]
RD = {r.name: r for r in ROADS}
JUNCS = []


def build_network():
    for r in ROADS:
        r.line = LineString(K.catmull_rom(r.ctrl, 2.0))
    for _ in range(2):          # snap ends onto the roads they join
        for r in ROADS:
            cs = list(r.line.coords)
            if r.start_on:
                o = RD[r.start_on].line
                cs[0] = o.interpolate(o.project(Point(cs[0]))).coords[0]
            if r.end_on:
                o = RD[r.end_on].line
                cs[-1] = o.interpolate(o.project(Point(cs[-1]))).coords[0]
            r.line = LineString(cs)
    # planned layout ("1st Stage"): skewed, gently curved grid inside the Main/ORR/East/Lake block
    region_lines = unary_union([RD[n].line for n in ("MAIN_S", "ORR", "EAST_RD", "LAKE_RD")])
    region = next(p for p in polygonize(region_lines) if p.contains(Point(200, 60)))
    region = region.difference(Point(*CIRCLE["c"]).buffer(70))
    ang = math.radians(9)
    u, v = np.array((math.cos(ang), math.sin(ang))), np.array((-math.sin(ang), math.cos(ang)))
    o = np.array((180.0, 60.0))
    k = 0
    for off in (-80, -25, 30, 85):                       # "Mains" along u
        pts = [tuple(o + v * off + u * t + v * 6 * math.sin(t / 90)) for t in range(-420, 421, 30)]
        for piece in _lines(LineString(pts).intersection(region)):
            if piece.length > 60:
                ROADS.append(Road(f"MAIN{k}", "cross", list(piece.coords), kn=f"{k + 1}ನೇ ಮುಖ್ಯ ರಸ್ತೆ", en=f"{k + 1}th Main"))
                k += 1
    k = 0
    for off in range(-170, 300, 58):                     # "Crosses" along v
        pts = [tuple(o + u * off + v * t + u * 4 * math.sin(t / 70)) for t in range(-300, 301, 30)]
        for piece in _lines(LineString(pts).intersection(region)):
            if piece.length > 50:
                ROADS.append(Road(f"CROSS{k}", "lane" if k % 2 else "cross", list(piece.coords), kn=f"{k + 1}ನೇ ಅಡ್ಡ ರಸ್ತೆ", en=f"{k + 1}th Cross"))
                k += 1
    for r in ROADS:
        if r.line is None:
            r.line = LineString(K.catmull_rom(r.ctrl, 2.0)) if len(r.ctrl) < 6 else LineString(r.ctrl).segmentize(2.0)
        RD[r.name] = r
    find_junctions()


def _lines(g):
    if g.is_empty:
        return []
    if g.geom_type == "LineString":
        return [g]
    return [x for x in getattr(g, "geoms", []) if x.geom_type == "LineString"]


def find_junctions():
    raw = []
    for i, a in enumerate(ROADS):
        for b in ROADS[i + 1:]:
            if a.line.distance(b.line) > 0.6:
                continue
            inter = a.line.intersection(b.line)
            pts = [inter] if inter.geom_type == "Point" else [g for g in getattr(inter, "geoms", []) if g.geom_type == "Point"]
            for ea in (Point(a.line.coords[0]), Point(a.line.coords[-1])):
                if ea.distance(b.line) < 0.6:
                    pts.append(ea)
            for eb in (Point(b.line.coords[0]), Point(b.line.coords[-1])):
                if eb.distance(a.line) < 0.6:
                    pts.append(eb)
            for p in pts:
                raw.append(((p.x, p.y), {a.name, b.name}))
    cc = CIRCLE["c"]
    circ = dict(pos=cc, roads=set(), circle=True)
    for pos, names in raw:
        if math.dist(pos, cc) < CIRCLE["ro"] + 6:
            circ["roads"] |= names
            continue
        for j in JUNCS:
            if math.dist(j["pos"], pos) < 7:
                j["roads"] |= names
                break
        else:
            JUNCS.append(dict(pos=pos, roads=set(names), circle=False))
    JUNCS.append(circ)
    for j in JUNCS:
        rs = [RD[n] for n in j["roads"]]
        j["r"] = CIRCLE["ro"] + 2 if j["circle"] else max(r.cw for r in rs) / 2 + 3.0
        top = sorted((r.rank for r in rs), reverse=True)
        j["signal"] = (not j["circle"]) and len(top) >= 2 and top[0] >= 3 and top[1] >= 3 and in_core(*j["pos"])


def in_core(x, y, pad=0.0):
    return CORE[0] - pad <= x <= CORE[2] + pad and CORE[1] - pad <= y <= CORE[3] + pad


def juncs_of(r):
    return [j for j in JUNCS if r.name in j["roads"]]


def junction(a, b):
    for j in JUNCS:
        if a in j["roads"] and b in j["roads"]:
            return j
    raise KeyError((a, b))


def lake_poly():
    t = np.linspace(0, 2 * math.pi, 96, endpoint=False)
    c, s = math.cos(math.radians(LAKE["rot"])), math.sin(math.radians(LAKE["rot"]))
    wob = 1 + 0.06 * np.sin(3 * t + 1) + 0.04 * np.sin(5 * t)
    x, y = LAKE["rx"] * np.cos(t) * wob, LAKE["ry"] * np.sin(t) * wob
    return Polygon(zip(LAKE["c"][0] + x * c - y * s, LAKE["c"][1] + x * s + y * c))


# ----------------------------------------------------------- road surfaces
GEO = {}


def build_road_surfaces():
    cc = Point(*CIRCLE["c"])
    carr = [r.line.buffer(r.cw / 2, cap_style="flat", join_style="round") for r in ROADS]
    carr.append(cc.buffer(CIRCLE["ro"], 48))
    road = unary_union(carr).buffer(5.0, 16).buffer(-5.0, 16)
    island = cc.buffer(CIRCLE["ri"], 48)
    road = road.difference(island).simplify(0.03)
    outer = [r.line.buffer(r.cw / 2 + r.sw, cap_style="flat", join_style="round") for r in ROADS if r.sw > 0]
    outer.append(cc.buffer(CIRCLE["ro"] + 3.0, 48))
    foot = unary_union(outer).buffer(3.0, 12).buffer(-3.0, 12).difference(road).difference(island).simplify(0.03)
    discs = unary_union([Point(*j["pos"]).buffer(j["r"] + 5.5, 24) for j in JUNCS])
    meds = [r.line.buffer(r.p["median"] / 2, cap_style="flat") for r in ROADS if r.p["median"] > 0]
    median = unary_union(meds).difference(discs).intersection(road).simplify(0.03)
    road_top = road.difference(median)
    GEO.update(road=road, foot=foot, median=median, island=island, discs=discs)
    K.tri_area("Roads", "asphalt", road_top, 0.0)
    K.tri_area("Footpaths", "pavers", foot, FP_H)
    K.tri_area("Roads", "concrete", median, 0.22)
    K.tri_area("Circle", "grass", island, 0.35)

    road_b = road.buffer(0.05)
    shapely.prepare(road_b)

    def kerb(mid):
        return "curb_bw" if road_b.contains(Point(mid)) else "concrete"
    K.ring_walls("Footpaths", foot, 0.0, FP_H, kerb)
    K.ring_walls("Roads", median, 0.0, 0.22, lambda m: "curb_bw")
    K.ring_walls("Circle", island, 0.0, 0.35, lambda m: "curb_bw")


# --------------------------------------------------------------- markings
ZP = 0.014


def paint_line(pts, w, mat="paint_white"):
    K.ribbon("Markings", mat, pts, w, ZP)


def dashed(line, w, on=3.0, off=5.0, mat="paint_white"):
    s = 0.0
    while s < line.length:
        seg = substring(line, s, min(s + on, line.length))
        if seg.length > 0.3:
            paint_line(list(seg.coords), w, mat)
        s += on + off


def decal(mat, cx, cy, hx, hy, length, width, z=ZP + 0.002):
    """Road text read by a driver heading (hx, hy); image top = far end."""
    lx, ly = -hy, hx
    nb = (cx - hx * length / 2, cy - hy * length / 2)
    fb = (cx + hx * length / 2, cy + hy * length / 2)
    pts = [(nb[0] + lx * width / 2, nb[1] + ly * width / 2, z), (nb[0] - lx * width / 2, nb[1] - ly * width / 2, z),
           (fb[0] - lx * width / 2, fb[1] - ly * width / 2, z), (fb[0] + lx * width / 2, fb[1] + ly * width / 2, z)]
    face("Markings", mat, pts, [(0, 0), (1, 0), (1, 1), (0, 1)])


def tangent_at(line, s):
    a = line.interpolate(max(0.0, s - 1.0))
    b = line.interpolate(min(line.length, s + 1.0))
    dx, dy = b.x - a.x, b.y - a.y
    L = math.hypot(dx, dy) or 1.0
    return dx / L, dy / L


def pieces(r, extra=0.0):
    """Centre-line parts of road r outside junction areas."""
    ds = [Point(*j["pos"]).buffer(j["r"] + extra, 24) for j in juncs_of(r)]
    g = r.line.difference(unary_union(ds)) if ds else r.line
    return [p for p in _lines(g) if p.length > 2.0]


CROSSWALKS = []


def build_markings():
    for r in ROADS:
        p = r.p
        for pc in pieces(r, 6.5):
            mid = pc.interpolate(0.5, normalized=True)
            if not in_core(mid.x, mid.y, 60) or r.cls in ("lane", "drive"):
                continue
            if r.cls in ("orr", "main", "road"):
                for sgn in (-1, 1):
                    edge = pc.offset_curve(sgn * (r.cw / 2 - 0.35))
                    for e in _lines(edge):
                        paint_line(list(e.coords), 0.15)
                    for k in range(1, p["lanes"]):
                        for e in _lines(pc.offset_curve(sgn * (p["median"] / 2 + k * p["lane_w"]))):
                            dashed(e, 0.12)
                if p["median"] == 0:
                    dashed(pc, 0.12, 3.0, 4.5)
        # zebra crossings + stop lines at signals and the circle
        for j in juncs_of(r):
            if not (j["signal"] or j["circle"]) or r.cls not in ("orr", "main", "road") or not in_core(*j["pos"], 20):
                continue
            sj = r.line.project(Point(*j["pos"]))
            for dirn in (-1, 1):
                sc = sj + dirn * (j["r"] + 2.0)
                if not (0 < sc < r.line.length):
                    continue
                c = r.line.interpolate(sc)
                tx, ty = tangent_at(r.line, sc)
                nx, ny = -ty, tx
                t = -r.cw / 2 + 0.6
                while t < r.cw / 2 - 0.6:
                    bx, by = c.x + nx * t, c.y + ny * t
                    pts = [(bx - tx * 1.5 - nx * 0.25, by - ty * 1.5 - ny * 0.25, ZP), (bx + tx * 1.5 - nx * 0.25, by + ty * 1.5 - ny * 0.25, ZP),
                           (bx + tx * 1.5 + nx * 0.25, by + ty * 1.5 + ny * 0.25, ZP), (bx - tx * 1.5 + nx * 0.25, by - ty * 1.5 + ny * 0.25, ZP)]
                    if K.normal(pts)[2] < 0:
                        pts = pts[::-1]
                    face("Markings", "paint_white", pts, [(0, 0)] * 4)
                    t += 1.0
                CROSSWALKS.append((c.x, c.y))
                # stop line on the approach (left) half: traffic heads toward the junction (-dirn along s)
                ss = sj + dirn * (j["r"] + 4.6)
                if 0 < ss < r.line.length:
                    sc_ = r.line.interpolate(ss)
                    hx, hy = tangent_at(r.line, ss)
                    hx, hy = -dirn * hx, -dirn * hy
                    lx, ly = -hy, hx
                    a0, a1 = p["median"] / 2 + 0.1, r.cw / 2 - 0.35
                    pts = [(sc_.x + lx * a0 - hx * 0.25, sc_.y + ly * a0 - hy * 0.25, ZP), (sc_.x + lx * a1 - hx * 0.25, sc_.y + ly * a1 - hy * 0.25, ZP),
                           (sc_.x + lx * a1 + hx * 0.25, sc_.y + ly * a1 + hy * 0.25, ZP), (sc_.x + lx * a0 + hx * 0.25, sc_.y + ly * a0 + hy * 0.25, ZP)]
                    if K.normal(pts)[2] < 0:
                        pts = pts[::-1]
                    face("Markings", "paint_white", pts, [(0, 0)] * 4)
                    if j["signal"]:
                        SIGNAL_POLES.append((j, sc_.x + lx * (r.cw / 2 + 0.9), sc_.y + ly * (r.cw / 2 + 0.9), hx, hy, r))


SIGNAL_POLES = []


def speed_breakers():
    """Painted humps near junctions on cross roads and lanes."""
    for r in ROADS:
        if r.cls not in ("cross", "lane"):
            continue
        for pc in pieces(r, 0.0):
            if pc.length < 45 or not in_core(*pc.interpolate(0.5, normalized=True).coords[0]):
                continue
            for s in (9.0, pc.length - 9.0):
                if R.random() < 0.35:
                    continue
                c = pc.interpolate(s)
                tx, ty = tangent_at(pc, s)
                nx, ny = -ty, tx
                prof = [(-1.8, 0.0), (-1.0, 0.07), (0.0, 0.1), (1.0, 0.07), (1.8, 0.0)]
                w = r.cw / 2
                n = int(r.cw / 0.5)
                for k in range(n):
                    t0, t1 = -w + k * r.cw / n, -w + (k + 1) * r.cw / n
                    m = "paint_white" if k % 2 == 0 else "rubber"
                    for (a, za), (b, zb) in zip(prof, prof[1:]):
                        pts = [(c.x + tx * a + nx * t0, c.y + ty * a + ny * t0, za + 0.005), (c.x + tx * b + nx * t0, c.y + ty * b + ny * t0, zb + 0.005),
                               (c.x + tx * b + nx * t1, c.y + ty * b + ny * t1, zb + 0.005), (c.x + tx * a + nx * t1, c.y + ty * a + ny * t1, za + 0.005)]
                        if K.normal(pts)[2] < 0:
                            pts = pts[::-1]
                        face("Roads", m, pts, [(0, 0)] * 4)
                BREAKERS.append([round(c.x, 2), round(c.y, 2)])


BREAKERS = []

# --------------------------------------------------------------- occupancy
RES = 0.5
GX, GY = int((WORLD[2] - WORLD[0]) / RES), int((WORLD[3] - WORLD[1]) / RES)
OCC = np.zeros((GY, GX), bool)
BLD = np.zeros((GY, GX), bool)


def raster(geom):
    img = Image.new("L", (GX, GY), 0)
    d = ImageDraw.Draw(img)

    def pix(cs):
        return [((x - WORLD[0]) / RES, (y - WORLD[1]) / RES) for x, y in cs]
    for pg in K._polys(geom):
        d.polygon(pix(pg.exterior.coords), fill=1)
        for h in pg.interiors:
            d.polygon(pix(h.coords), fill=0)
    return np.asarray(img, bool)


def rcells(cx, cy, yaw, w, d):
    c, s = math.cos(yaw), math.sin(yaw)
    ex = abs(w / 2 * c) + abs(d / 2 * s)
    ey = abs(w / 2 * s) + abs(d / 2 * c)
    i0, i1 = int((cx - ex - WORLD[0]) / RES), int((cx + ex - WORLD[0]) / RES) + 1
    j0, j1 = int((cy - ey - WORLD[1]) / RES), int((cy + ey - WORLD[1]) / RES) + 1
    if i0 < 0 or j0 < 0 or i1 > GX or j1 > GY:
        return None
    xs = WORLD[0] + (np.arange(i0, i1) + 0.5) * RES
    ys = WORLD[1] + (np.arange(j0, j1) + 0.5) * RES
    X, Y = np.meshgrid(xs - cx, ys - cy)
    lx, ly = X * c + Y * s, -X * s + Y * c
    return j0, j1, i0, i1, (np.abs(lx) <= w / 2) & (np.abs(ly) <= d / 2)


def rfree(cx, cy, yaw, w, d, pad=0.5):
    a = rcells(cx, cy, yaw, w, d)
    b = rcells(cx, cy, yaw, w + 2 * pad, d + 2 * pad)
    if a is None or b is None:
        return False
    j0, j1, i0, i1, m = a
    if (OCC[j0:j1, i0:i1] & m).any():
        return False
    j0, j1, i0, i1, m = b
    return not (BLD[j0:j1, i0:i1] & m).any()


def rmark(cx, cy, yaw, w, d, building=True):
    a = rcells(cx, cy, yaw, w, d)
    if a is None:
        return
    j0, j1, i0, i1, m = a
    OCC[j0:j1, i0:i1] |= m
    if building:
        BLD[j0:j1, i0:i1] |= m


# -------------------------------------------------------------- vegetation
def rain_tree(x, y, z=0.0, s=1.0):
    """Samanea saman: short trunk, huge flat umbrella crown arching over roads."""
    s *= R.uniform(0.85, 1.15)
    cyl("Vegetation", x, y, z, z + 4.5 * s, 0.45 * s, 0.32 * s, "wood", seg=8, cap=False)
    for k in range(4):
        a = k * math.pi / 2 + R.uniform(-0.4, 0.4)
        tube("Vegetation", (x, y, z + 4.0 * s), (x + math.cos(a) * 4.5 * s, y + math.sin(a) * 4.5 * s, z + 7.5 * s), 0.22 * s, "wood", seg=6)
    crown("Vegetation", "leaves", x, y, z + 8.5 * s, 9.0 * s, 9.0 * s, 3.0 * s, 9)


def gulmohar(x, y, z=0.0, s=1.0):
    s *= R.uniform(0.85, 1.15)
    cyl("Vegetation", x, y, z, z + 3.5 * s, 0.25 * s, 0.18 * s, "wood", seg=7, cap=False)
    crown("Vegetation", "leaves", x, y, z + 5.5 * s, 4.5 * s, 4.5 * s, 2.2 * s, 7)
    for _ in range(14):                      # scattered red-orange blossom clusters on the crown surface
        a = R.uniform(0, 6.28)
        e = R.uniform(0.1, 0.8)
        blob("Vegetation", "flowers", x + math.cos(a) * 4.2 * s * (1 - e * e) ** 0.5, y + math.sin(a) * 4.2 * s * (1 - e * e) ** 0.5,
             z + 5.5 * s + e * 2.0 * s, 0.45 * s, 0.45 * s, 0.3 * s, rough=0.2, level=1)


def ashoka(x, y, z=0.0, s=1.0):
    s *= R.uniform(0.85, 1.2)
    cyl("Vegetation", x, y, z, z + 1.5, 0.12, 0.1, "wood", seg=6, cap=False)
    blob("Vegetation", "leaves", x, y, z + 5.5 * s, 1.2 * s, 1.2 * s, 4.8 * s, rough=0.12)


def palm(x, y, z=0.0, s=1.0):
    s *= R.uniform(0.9, 1.15)
    h = 9.5 * s
    lean = (R.uniform(-0.8, 0.8), R.uniform(-0.8, 0.8))
    prev = (x, y, z)
    for k in range(1, 6):
        t = k / 5
        cur = (x + lean[0] * t * t * 2, y + lean[1] * t * t * 2, z + h * t)
        tube("Vegetation", prev, cur, 0.2 * s, "wood", seg=6)
        prev = cur
    tx, ty, tz = prev
    for k in range(12):
        a = 2 * math.pi * k / 12 + R.uniform(-0.15, 0.15)
        L = R.uniform(3.6, 4.6) * s
        dx, dy = math.cos(a), math.sin(a)
        px, py = -dy * 0.7, dx * 0.7
        droop = R.uniform(1.0, 2.2)
        mid = (tx + dx * L * 0.5, ty + dy * L * 0.5, tz + 0.6)
        end = (tx + dx * L, ty + dy * L, tz - droop)
        for (a0, a1, v0, v1) in (((tx, ty, tz), mid, 0.0, 0.5), (mid, end, 0.5, 1.0)):
            pts = [(a0[0] - px, a0[1] - py, a0[2]), (a0[0] + px, a0[1] + py, a0[2]), (a1[0] + px, a1[1] + py, a1[2]), (a1[0] - px, a1[1] - py, a1[2])]
            face("Vegetation", "palm", pts, [(0, v0), (1, v0), (1, v1), (0, v1)], (x, y))
            face("Vegetation", "palm", pts[::-1], [(0, v1), (1, v1), (1, v0), (0, v0)], (x, y))


# --------------------------------------------------------------- buildings
HOUSE_MATS = ["f_pink", "f_yellow", "f_mint", "f_blue", "f_orange", "f_white", "f_white", "f_yellow"]
FH = 3.0


def roof_stuff(cx, cy, yaw, w, d, z, big=False):
    C = "Buildings"
    # parapet
    for lx, ly, sx, sy in ((0, -d / 2 + 0.1, w, 0.2), (0, d / 2 - 0.1, w, 0.2), (-w / 2 + 0.1, 0, 0.2, d), (w / 2 - 0.1, 0, 0.2, d)):
        px, py = local(cx, cy, yaw, lx, ly)
        obox(C, px, py, z, sx, sy, 0.9, yaw, "wall_plain")
    # stair headroom with door, sometimes a small Mangalore-tile roof
    if w > 5 and d > 6:
        hx, hy = local(cx, cy, yaw, w / 2 - 1.8, d / 2 - 2.0)
        obox(C, hx, hy, z, 3.0, 3.4, 2.6, yaw, {"*": "wall_plain", "top": "concrete"})
        if R.random() < 0.3:
            obox(C, hx, hy, z + 2.6, 3.4, 3.8, 0.25, yaw, "tile_red", skip=())
    # black water tanks on stands
    for _ in range(R.randint(1, 2 if not big else 4)):
        tx, ty = local(cx, cy, yaw, R.uniform(-w / 2 + 1.2, w / 2 - 1.2), R.uniform(-d / 2 + 1.2, 0))
        obox(C, tx, ty, z, 1.4, 1.4, 0.8, yaw, "metal_dark")
        cyl(C, tx, ty, z + 0.8, z + 2.2, 0.65, 0.6, "tank_black", seg=8)
    # rebar stubs for the "next floor"
    if R.random() < 0.12 and not big:
        for lx in (-w / 2 + 0.3, w / 2 - 0.3):
            for ly in (-d / 2 + 0.3, d / 2 - 0.3):
                px, py = local(cx, cy, yaw, lx, ly)
                for k in range(2):
                    tube(C, (px + k * 0.1, py, z + 0.9), (px + k * 0.1, py, z + 1.9), 0.012, "metal_dark", seg=3)
    # dish antenna / clothes line
    if R.random() < 0.25:
        px, py = local(cx, cy, yaw, -w / 2 + 1.0, -d / 2 + 1.0)
        tube(C, (px, py, z + 0.9), (px, py, z + 1.6), 0.03, "metal_dark", seg=3)
        tube(C, (px, py, z + 1.6), (px + 0.1, py, z + 1.62), 0.32, "white", seg=6, cap=True)


def chajjas(cx, cy, yaw, w, d, z0, floors, mat="concrete"):
    for f in range(floors):
        px, py = local(cx, cy, yaw, 0, -d / 2 - 0.3)
        obox("Buildings", px, py, z0 + f * FH + 2.35, w - 0.4, 0.6, 0.08, yaw, mat, skip=())


def house(cx, cy, yaw, w, d, floors, compound=True, detail=True, lite=False):
    """Independent house: painted RCC frame, chajjas, balcony, tanks on roof.
    lite=True for back-lot houses hidden behind the street frontage."""
    C = "Buildings"
    m = R.choice(HOUSE_MATS)
    if lite:
        H = floors * FH + 0.45
        obox(C, cx, cy, 0.0, w, d, H, yaw, {"*": m, "top": "concrete"}, zuv=0.45, u0=R.choice([0, 0.5]))
        if detail:
            tx, ty = local(cx, cy, yaw, R.uniform(-w / 4, w / 4), R.uniform(-d / 4, d / 4))
            cyl(C, tx, ty, H, H + 1.4, 0.65, 0.6, "tank_black", seg=6)
            if R.random() < 0.5:
                hx, hy = local(cx, cy, yaw, w / 2 - 1.6, d / 2 - 1.8)
                obox(C, hx, hy, H, 2.8, 3.2, 2.5, yaw, {"*": "wall_plain", "top": "concrete"})
        return
    yard = R.uniform(1.5, 3.0) if compound else 0.0
    bw, bd = w - (1.0 if compound else 0.0), d - yard - (0.6 if compound else 0.0)
    bx, by = local(cx, cy, yaw, 0, yard / 2 + (0.3 if compound else 0))
    H = floors * FH + 0.45
    obox(C, bx, by, 0.0, bw, bd, 0.45, yaw, "concrete")
    obox(C, bx, by, 0.45, bw, bd, H - 0.45, yaw, {"*": m, "top": "concrete"}, zuv=0.45, u0=R.choice([0, 0.5]))
    if not detail:
        return
    chajjas(bx, by, yaw, bw, bd, 0.45, floors)
    if floors >= 2 and R.random() < 0.6:          # front balcony with MS grill
        pw = min(bw * 0.6, 4.0)
        lx = R.uniform(-bw / 2 + pw / 2, bw / 2 - pw / 2)
        px, py = local(bx, by, yaw, lx, -bd / 2 - 0.55)
        obox(C, px, py, 0.45 + FH - 0.15, pw, 1.1, 0.15, yaw, "concrete", skip=())
        qx, qy = local(bx, by, yaw, lx, -bd / 2 - 1.08)
        obox(C, qx, qy, 0.45 + FH, pw, 0.05, 1.0, yaw, R.choice(["metal_dark", "tin_green", "tin_blue"]), skip=("top", "bottom"))
    roof_stuff(bx, by, yaw, bw, bd, H)
    if compound:
        # compound wall with a painted MS gate, two-wheeler inside
        fy = -d / 2 + 0.1
        gate_w = 3.0
        gl = R.uniform(-w / 2 + 0.4 + gate_w / 2, w / 2 - 0.4 - gate_w / 2)
        for a, b in ((-w / 2, gl - gate_w / 2), (gl + gate_w / 2, w / 2)):
            if b - a > 0.2:
                px, py = local(cx, cy, yaw, (a + b) / 2, fy)
                obox(C, px, py, 0, b - a, 0.2, 1.4, yaw, "compound")
        for side in (-1, 1):
            px, py = local(cx, cy, yaw, -w / 2 + 0.1 if side < 0 else w / 2 - 0.1, 0)
            obox(C, px, py, 0, 0.2, d, 1.4, yaw, "compound")
        gx, gy = local(cx, cy, yaw, gl, fy)
        obox(C, gx, gy, 0.1, gate_w, 0.06, 1.3, yaw, R.choice(["tin_green", "tin_blue", "metal_dark"]), skip=())
        if yard > 2.0 and R.random() < 0.35:
            sx, sy = local(cx, cy, yaw, gl, fy + yard / 2 + 0.2)
            two_wheeler(sx, sy, yaw + math.pi / 2)
        if R.random() < 0.15:
            tx, ty = local(cx, cy, yaw, -w / 2 + 1.0, fy + 1.0)
            (palm if R.random() < 0.5 else ashoka)(tx, ty, 0.0, 0.8)


def shop_block(cx, cy, yaw, w, d, floors, upper=None, awning=True, hoard=False, detail=True):
    """Shops on the ground floor, offices/homes above (G+1..G+4)."""
    C = "Buildings"
    gf = 3.8
    upper = upper or R.choice(["f_shoprow", "f_shoprow"] + HOUSE_MATS[:4])
    top = gf + (floors - 1) * (3.2 if upper == "f_shoprow" else FH)
    obox(C, cx, cy, 0, w, d, gf, yaw, {"*": "wall_plain", "s": None, "top": None if floors > 1 else "concrete"})
    n = max(1, int(round(w / 6.0)))
    for k in range(n):
        a, b = -w / 2 + w * k / n, -w / 2 + w * (k + 1) / n
        A = local(cx, cy, yaw, a, -d / 2 - 0.01)
        B = local(cx, cy, yaw, b, -d / 2 - 0.01)
        c = R.randrange(12)
        u0, v0 = (c % 4) / 4, 1 - (c // 4 + 1) / 3
        face(C, "shops", [(A[0], A[1], 0), (B[0], B[1], 0), (B[0], B[1], gf), (A[0], A[1], gf)],
             [(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 1 / 3), (u0, v0 + 1 / 3)], (cx, cy))
    if floors > 1:
        obox(C, cx, cy, gf, w, d, top - gf, yaw, {"*": upper, "top": "concrete"}, zuv=gf, u0=R.random())
    if not detail:
        return
    if awning:                                   # sloped tin sunshade over the shop fronts
        mat = R.choice(["tin_blue", "tin_green", "metal_light"])
        A0, B0 = local(cx, cy, yaw, -w / 2, -d / 2), local(cx, cy, yaw, w / 2, -d / 2)
        A1, B1 = local(cx, cy, yaw, -w / 2, -d / 2 - 1.4), local(cx, cy, yaw, w / 2, -d / 2 - 1.4)
        pts = [(A1[0], A1[1], gf - 0.5), (B1[0], B1[1], gf - 0.5), (B0[0], B0[1], gf + 0.1), (A0[0], A0[1], gf + 0.1)]
        face(C, mat, pts, [(0, 0)] * 4, (cx, cy))
        face(C, mat, pts[::-1], [(0, 0)] * 4, (cx, cy))
    if floors > 1:
        chajjas(cx, cy, yaw, w, d, gf, floors - 1)
    roof_stuff(cx, cy, yaw, w, d, top, big=w > 12)
    if hoard and w > 7:                          # rooftop hoarding facing the road
        row = R.randrange(4)
        hw, hh = min(12.0, w - 1), 4.0
        px, py = local(cx, cy, yaw, 0, -d / 2 + 1.5)
        for lx in (-hw / 2 + 1, hw / 2 - 1):
            qx, qy = local(px, py, yaw, lx, 0.5)
            obox(C, qx, qy, top, 0.2, 0.2, 2.2, yaw, "metal_dark")
        A = local(px, py, yaw, -hw / 2, 0)
        B = local(px, py, yaw, hw / 2, 0)
        z0 = top + 2.0
        v0, v1 = 1 - (row + 1) / 4, 1 - row / 4
        face(C, "hoarding", [(A[0], A[1], z0), (B[0], B[1], z0), (B[0], B[1], z0 + hh), (A[0], A[1], z0 + hh)], [(0, v0), (1, v0), (1, v1), (0, v1)], (cx, cy))
        face(C, "metal_dark", [(A[0], A[1], z0 + hh), (B[0], B[1], z0 + hh), (B[0], B[1], z0), (A[0], A[1], z0)], [(0, 0)] * 4, (cx, cy))
    # parked two-wheelers in front
    if R.random() < 0.7:
        for k in range(R.randint(2, 6)):
            px, py = local(cx, cy, yaw, -w / 2 + 1 + k * 0.9, -d / 2 - 0.9)
            two_wheeler(px, py, yaw + math.pi / 2 + R.uniform(-0.2, 0.2))


def complex_bldg(cx, cy, yaw, w, d, floors, detail=True):
    C = "Buildings"
    gf = 4.0
    top = gf + (floors - 1) * 3.5
    shop_block(cx, cy, yaw, w, d, 1, awning=False, detail=False)
    obox(C, cx, cy, gf, w, d, top - gf, yaw, {"*": "f_complex", "top": "concrete"}, zuv=gf)
    if detail:
        roof_stuff(cx, cy, yaw, w, d, top, big=True)


def apartment(cx, cy, yaw, w, d, floors, detail=True):
    C = "Buildings"
    top = 1.0 + floors * FH
    obox(C, cx, cy, 0, w, d, 1.0, yaw, "concrete")
    obox(C, cx, cy, 1.0, w, d, top - 1.0, yaw, {"*": "f_apartment", "top": "concrete"}, zuv=1.0)
    if not detail:
        return
    for f in range(1, floors):
        for k in range(int(w // 4)):
            px, py = local(cx, cy, yaw, -w / 2 + 2 + k * 4, -d / 2 - 0.6)
            obox(C, px, py, 1.0 + f * FH - 0.15, 3.0, 1.2, 0.15, yaw, "concrete", skip=())
            qx, qy = local(cx, cy, yaw, -w / 2 + 2 + k * 4, -d / 2 - 1.17)
            obox(C, qx, qy, 1.0 + f * FH, 3.0, 0.06, 1.0, yaw, "glass", skip=("top", "bottom"))
    roof_stuff(cx, cy, yaw, w, d, top, big=True)


def two_wheeler(x, y, yaw):
    """Scooter / motorcycle: wheels, low frame, seat, front apron + handlebar."""
    C = "Vehicles"
    col = R.choice(["car_black", "car_black", "car_red", "car_blue", "car_silver", "car_white"])
    c, s = math.cos(yaw), math.sin(yaw)
    for off in (0.62, -0.62):
        px, py = x + c * off, y + s * off
        tube(C, (px + s * 0.05, py - c * 0.05, 0.28), (px - s * 0.05, py + c * 0.05, 0.28), 0.28, "rubber", seg=8, cap=True)
    obox(C, x - c * 0.05, y - s * 0.05, 0.3, 1.0, 0.22, 0.22, yaw, col)                 # floor / frame
    obox(C, x - c * 0.3, y - s * 0.3, 0.52, 0.75, 0.3, 0.28, yaw, col)                  # rear body
    obox(C, x - c * 0.3, y - s * 0.3, 0.8, 0.65, 0.28, 0.08, yaw, "rubber")             # seat
    obox(C, x + c * 0.48, y + s * 0.48, 0.3, 0.14, 0.3, 0.7, yaw, col)                  # front apron
    hx, hy = x + c * 0.52, y + s * 0.52
    tube(C, (hx - s * 0.33, hy + c * 0.33, 1.02), (hx + s * 0.33, hy - c * 0.33, 1.02), 0.02, "metal_dark", seg=4)
    obox(C, hx, hy, 0.95, 0.12, 0.2, 0.12, yaw, "metal_light")


def auto_rickshaw(x, y, yaw):
    C = "Vehicles"
    obox(C, x, y, 0.3, 2.6, 1.3, 0.6, yaw, "auto_green")
    fx, fy = x + math.cos(yaw) * 0.9, y + math.sin(yaw) * 0.9
    obox(C, fx, fy, 0.9, 0.08, 1.2, 0.8, yaw, "glass", skip=())
    obox(C, x - math.cos(yaw) * 0.15, y - math.sin(yaw) * 0.15, 1.75, 2.3, 1.35, 0.12, yaw, "auto_yellow", skip=())
    for lx, ly in ((-0.7, 0.62), (-0.7, -0.62), (0.7, 0.62), (0.7, -0.62)):
        px, py = local(x, y, yaw, lx, ly)
        obox(C, px, py, 0.9, 0.06, 0.06, 0.85, yaw, "metal_dark")
    for lx, ly in ((1.1, 0.0), (-0.8, 0.6), (-0.8, -0.6)):
        px, py = local(x, y, yaw, lx, ly)
        ox, oy = -math.sin(yaw) * 0.06, math.cos(yaw) * 0.06
        tube(C, (px - ox, py - oy, 0.24), (px + ox, py + oy, 0.24), 0.24, "rubber", seg=8, cap=True)


def car(x, y, yaw, color=None):
    C = "Vehicles"
    color = color or R.choice(["car_white"] * 4 + ["car_silver"] * 3 + ["car_red", "car_blue", "car_black"])
    obox(C, x, y, 0.3, 4.0, 1.7, 0.75, yaw, color)
    px, py = x - math.cos(yaw) * 0.2, y - math.sin(yaw) * 0.2
    obox(C, px, py, 1.05, 2.2, 1.58, 0.55, yaw, {"*": "glass", "top": color})
    for lx in (1.3, -1.3):
        for ly in (0.83, -0.83):
            qx, qy = local(x, y, yaw, lx, ly)
            ox, oy = -math.sin(yaw) * 0.1, math.cos(yaw) * 0.1
            tube(C, (qx - ox, qy - oy, 0.31), (qx + ox, qy + oy, 0.31), 0.31, "rubber", seg=8, cap=True)


def cow(x, y, yaw):
    C = "Vehicles"
    obox(C, x, y, 0.75, 1.7, 0.6, 0.65, yaw, "cow")
    for lx in (0.65, -0.65):
        for ly in (0.2, -0.2):
            px, py = local(x, y, yaw, lx, ly)
            obox(C, px, py, 0, 0.14, 0.14, 0.78, yaw, "cow")
    hx, hy = local(x, y, yaw, 1.05, 0)
    obox(C, hx, hy, 1.05, 0.55, 0.35, 0.38, yaw, "cow")
    for ly in (0.12, -0.12):
        px, py = local(hx, hy, yaw, 0.1, ly)
        tube(C, (px, py, 1.4), (px - math.cos(yaw) * 0.1, py - math.sin(yaw) * 0.1, 1.68), 0.03, "metal_dark", seg=3)


def bus_model(x, y, yaw, coll_name="Vehicles"):
    """12 m city bus, doors on the left side."""
    L, W, H = 12.0, 2.6, 3.2
    c, s = math.cos(yaw), math.sin(yaw)

    def uv(fk, pts, m):
        if m != "bus_side":
            return None
        out = []
        for p in pts:
            lx = (p[0] - x) * c + (p[1] - y) * s
            u = (lx + L / 2) / L
            v = (p[2] - 0.35) / (H - 0.35)
            out.append((1 - u, 0.5 + v * 0.5) if fk == "n" else (u, v * 0.5))
        return out
    obox(coll_name, x, y, 0.35, L, W, H - 0.35, yaw, {"n": "bus_side", "s": "bus_side", "e": "white", "w": "white", "top": "metal_light"}, uv=uv)
    fx, fy = x + c * (L / 2 + 0.01), y + s * (L / 2 + 0.01)
    obox(coll_name, fx, fy, 1.2, 0.02, W - 0.2, 1.6, yaw, "glass", skip=())
    for lx in (L / 2 - 2.5, -L / 2 + 3.0):
        for ly in (W / 2 - 0.1, -W / 2 + 0.1):
            px, py = local(x, y, yaw, lx, ly)
            ox, oy = -s * 0.15, c * 0.15
            tube(coll_name, (px - ox, py - oy, 0.5), (px + ox, py + oy, 0.5), 0.5, "rubber", seg=10, cap=True)


# -------------------------------------------------------------- lot filling
def zone_for(r, x, y):
    dc = math.dist((x, y), CIRCLE["c"])
    if r.cls == "orr":
        return "orr"
    if r.cls == "main" or r.name == "TEMPLE_ST" or dc < 160:
        return "market"
    if r.cls == "road":
        return "mixed"
    if x < -100 and y > -230:
        return "pete"                 # old town: attached houses, no setbacks
    return "layout"                   # planned layout: compound walls & gates


def frontage(r):
    if not r.line or r.cls == "drive":
        return
    fs = r.cw / 2 + r.sw
    for pc in pieces(r, 4.0):
        for side in (1, -1):
            s = R.uniform(0.0, 2.0)
            while s < pc.length - 5:
                c0 = pc.interpolate(s)
                z = zone_for(r, c0.x, c0.y)
                detail = in_core(c0.x, c0.y, 30)
                if z == "orr":
                    kind = R.choice(["complex", "complex", "shop", "apartment"])
                    w, d, sb = R.uniform(14, 26), R.uniform(14, 22), R.uniform(1.0, 4.0)
                elif z == "market":
                    kind = "shop"
                    w, d, sb = R.uniform(6, 13), R.uniform(10, 16), 0.2
                elif z == "mixed":
                    kind = R.choice(["shop", "house", "house", "apartment"])
                    w, d, sb = R.uniform(8, 14), R.uniform(11, 16), R.uniform(0.3, 1.5)
                    if kind == "apartment":
                        w, d = R.uniform(18, 26), R.uniform(14, 18)
                elif z == "pete":
                    kind = R.choice(["house", "house", "house", "shop"])
                    w, d, sb = R.uniform(5, 8), R.uniform(8, 12), 0.15
                else:
                    kind = "house"
                    w, d, sb = R.uniform(9, 12.5), R.uniform(12, 15), 0.3
                w = min(w, pc.length - s)
                if w < 4.5:
                    break
                sc = s + w / 2
                cp = pc.interpolate(sc)
                tx, ty = tangent_at(pc, sc)
                nx, ny = -ty * side, tx * side          # away from the road
                yaw = math.atan2(ny, nx) - math.pi / 2
                placed = False
                dd = d
                while dd >= max(7.0, d * 0.6):
                    off = fs + sb + dd / 2
                    cx, cy = cp.x + nx * off, cp.y + ny * off
                    tight = z in ("pete", "market")
                    if rfree(cx, cy, yaw, w - (0.8 if tight else 0.0), dd, 0.0 if tight else 0.6):
                        build_lot(kind, z, cx, cy, yaw, w, dd, detail, r)
                        rmark(cx, cy, yaw, w, dd)
                        placed = True
                        break
                    dd -= 1.5
                s += (w + (0.05 if z in ("pete", "market") else R.uniform(0.5, 1.5))) if placed else 1.5


def build_lot(kind, z, cx, cy, yaw, w, d, detail, r):
    if kind == "shop":
        fl = R.randint(2, 4) if z == "market" else R.randint(1, 3)
        shop_block(cx, cy, yaw, w, d, fl, hoard=(r.rank >= 3 and R.random() < 0.25), detail=detail)
    elif kind == "complex":
        complex_bldg(cx, cy, yaw, w, d, R.randint(3, 6), detail)
    elif kind == "apartment":
        apartment(cx, cy, yaw, w, d, R.randint(4, 8), detail)
    else:
        house(cx, cy, yaw, w, d, R.choice([1, 2, 2, 2, 3, 3, 4]) if z != "pete" else R.choice([1, 2, 2, 3]),
              compound=(z in ("layout", "mixed")), detail=detail)


_TREE = None


def nearest_dir(x, y):
    global _TREE
    if _TREE is None:
        _TREE = shapely.STRtree([r.line for r in ROADS])
    i = _TREE.nearest(Point(x, y))
    ln = ROADS[int(i)].line
    s = ln.project(Point(x, y))
    tx, ty = tangent_at(ln, s)
    q = ln.interpolate(s)
    return tx, ty, (x - q.x, y - q.y)


def fill_interiors():
    xs = np.arange(WORLD[0] + 8, WORLD[2] - 8, 3.0)
    ys = np.arange(WORLD[1] + 8, WORLD[3] - 8, 3.0)
    for y in ys:
        for x in xs:
            j, i = int((y - WORLD[1]) / RES), int((x - WORLD[0]) / RES)
            if OCC[j, i] or BLD[j, i]:
                continue
            tx, ty, away = nearest_dir(x, y)
            nx, ny = -ty, tx
            if nx * away[0] + ny * away[1] < 0:
                nx, ny = -nx, -ny
            yaw = math.atan2(ny, nx) - math.pi / 2
            for w, d in ((9.0, 11.0), (7.0, 9.0), (5.5, 7.5)):
                if rfree(x, y, yaw, w, d, 0.4):
                    pete = x < -100 and y > -230
                    house(x, y, yaw, w, d, R.choice([1, 2, 2, 3]), detail=in_core(x, y, 20), lite=True)
                    rmark(x, y, yaw, w, d)
                    break


# ------------------------------------------------------------ special areas
def build_lake():
    lake = lake_poly()
    K.tri_area("Lake", "water", lake, -0.7)
    # stone-pitched bund facing the water (walls face inward)
    cs = list(lake.exterior.coords)
    for a, b in zip(cs, cs[1:]):
        pts = [(b[0], b[1], -0.7), (a[0], a[1], -0.7), (a[0], a[1], 0.0), (b[0], b[1], 0.0)]
        if K.normal(pts)[0] * (LAKE["c"][0] - a[0]) + K.normal(pts)[1] * (LAKE["c"][1] - a[1]) < 0:
            pts = pts[::-1]
        face("Lake", "concrete", pts, K.uv_world(pts, 3.0), a)
    walk = lake.buffer(5.0).difference(lake)
    K.tri_area("Lake", "pavers", walk, 0.12)
    K.ring_walls("Lake", walk, 0.0, 0.12, lambda m: "concrete")
    # railing along the water edge + trees around the bund
    ring = lake.buffer(0.4).exterior
    L = ring.length
    s = 0.0
    while s < L:
        p = ring.interpolate(s)
        q = ring.interpolate(min(L, s + 3.0))
        cyl("Props", p.x, p.y, 0.12, 1.1, 0.04, 0.04, "metal_dark", seg=4, cap=False)
        tube("Props", (p.x, p.y, 1.0), (q.x, q.y, 1.0), 0.03, "metal_dark")
        s += 3.0
    outer = lake.buffer(9.0).exterior
    s = 0.0
    while s < outer.length:
        p = outer.interpolate(s)
        (rain_tree if R.random() < 0.55 else palm)(p.x, p.y, 0.0, R.uniform(0.75, 1.0))
        s += R.uniform(16, 26)
    poly_mark = lake.buffer(10.0)
    GEO["lake"] = poly_mark
    return poly_mark


def build_circle():
    cx, cy = CIRCLE["c"]
    # pedestal + bronze statue + flower beds
    box("Circle", cx - 2.2, cy - 2.2, 0.35, cx + 2.2, cy + 2.2, 1.4, {"*": "concrete", "top": "pavers"})
    box("Circle", cx - 1.2, cy - 1.2, 1.4, cx + 1.2, cy + 1.2, 3.8, "concrete")
    cyl("Circle", cx, cy, 3.8, 5.6, 0.45, 0.35, "bronze", seg=10)
    blob("Circle", "bronze", cx, cy, 6.0, 0.35, 0.35, 0.42, rough=0.02)
    tube("Circle", (cx + 0.3, cy, 5.3), (cx + 0.6, cy + 0.2, 6.4), 0.08, "bronze", seg=6)
    for k in range(10):
        a = 2 * math.pi * k / 10
        blob("Circle", "flowers" if k % 2 else "leaves", cx + math.cos(a) * 8, cy + math.sin(a) * 8, 0.6, 1.4, 1.4, 0.5, level=1)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        palm(cx + math.cos(a) * 10.5, cy + math.sin(a) * 10.5, 0.35, 0.85)
    # name board on the island facing south
    face("Circle", "sign_dir", [(cx - 2.5, cy - 11.5, 0.6), (cx + 2.5, cy - 11.5, 0.6), (cx + 2.5, cy - 11.5, 3.1), (cx - 2.5, cy - 11.5, 3.1)],
         [(0, 0), (1, 0), (1, 1), (0, 1)])
    box("Circle", cx - 2.6, cy - 11.4, 0.35, cx + 2.6, cy - 11.3, 3.2, "metal_dark")


def build_temple():
    r = RD["TEMPLE_ST"]
    s = r.line.project(Point(-268, 95))
    c = r.line.interpolate(s)
    tx, ty = tangent_at(r.line, s)
    nx, ny = -ty, tx
    if ny < 0:
        nx, ny = -nx, -ny
    yaw = math.atan2(ny, nx) - math.pi / 2
    off = r.half + 22
    cx, cy = c.x + nx * off, c.y + ny * off
    W, D = 40.0, 40.0
    rmark(cx, cy, yaw, W, D)
    C = "Temple"
    gx, gy = local(cx, cy, yaw, 0, 0)
    pts = [local(cx, cy, yaw, lx, ly) for lx, ly in ((-W / 2, -D / 2), (W / 2, -D / 2), (W / 2, D / 2), (-W / 2, D / 2))]
    K.tri_area(C, "concrete", Polygon(pts), 0.05)
    # compound wall in red & white stripes (painted plain here) with the gopuram as gateway
    for lx, ly, sx, sy in ((0, D / 2, W, 0.5), (-W / 2, 0, 0.5, D), (W / 2, 0, 0.5, D), (-W / 4 - 2.5, -D / 2, W / 2 - 5, 0.5), (W / 4 + 2.5, -D / 2, W / 2 - 5, 0.5)):
        px, py = local(cx, cy, yaw, lx, ly)
        obox(C, px, py, 0, sx, sy, 2.4, yaw, {"*": "white", "top": "tile_red"})
    # gopuram: stacked tapering tiers
    px, py = local(cx, cy, yaw, 0, -D / 2)
    obox(C, px, py, 0, 10.0, 7.0, 6.0, yaw, {"*": "white", "s": "gopuram", "n": "gopuram"})
    w, d, z = 9.4, 6.4, 6.0
    for k in range(5):
        obox(C, px, py, z, w, d, 2.6, yaw, {"*": "gopuram", "top": "white"})
        z += 2.6
        w *= 0.84
        d *= 0.86
    obox(C, px, py, z, w, d * 0.8, 1.6, yaw, "tile_red")
    for lx in (-w / 3, 0, w / 3):
        qx, qy = local(px, py, yaw, lx, 0)
        cyl(C, qx, qy, z + 1.6, z + 2.6, 0.25, 0.04, "gold", seg=8)
    sx, sy = local(cx, cy, yaw, 0, -D / 2 - 3.6)
    A, B = local(sx, sy, yaw, -4.0, 0), local(sx, sy, yaw, 4.0, 0)
    face(C, "sign_temple", [(A[0], A[1], 6.3), (B[0], B[1], 6.3), (B[0], B[1], 8.3), (A[0], A[1], 8.3)], [(0, 0), (1, 0), (1, 1), (0, 1)])
    # mandapa (pillared hall) + vimana
    mx, my = local(cx, cy, yaw, 0, 4)
    obox(C, mx, my, 0, 16, 12, 1.0, yaw, "concrete")
    for lx in range(-7, 8, 2):
        for ly in (-5, 0, 5):
            qx, qy = local(mx, my, yaw, lx, ly)
            obox(C, qx, qy, 1.0, 0.5, 0.5, 4.0, yaw, "white")
    obox(C, mx, my, 5.0, 17, 13, 0.6, yaw, {"*": "white", "top": "concrete"})
    vx, vy = local(cx, cy, yaw, 0, 13)
    obox(C, vx, vy, 1.0, 7, 7, 5.0, yaw, "white")
    w = 7.0
    z = 6.0
    for k in range(3):
        obox(C, vx, vy, z, w, w, 1.8, yaw, {"*": "gopuram", "top": "white"})
        z += 1.8
        w *= 0.75
    cyl(C, vx, vy, z, z + 1.5, 0.6, 0.05, "gold", seg=10)
    # flag mast, ashoka trees, cows and flower carts outside
    qx, qy = local(cx, cy, yaw, 0, -6)
    cyl(C, qx, qy, 0.05, 11.0, 0.15, 0.1, "gold", seg=8)
    for lx in (-16, -12, 12, 16):
        qx, qy = local(cx, cy, yaw, lx, 10)
        ashoka(qx, qy)
    for lx in (-14, 9):
        qx, qy = local(cx, cy, yaw, lx, -D / 2 - 6.5)
        cow(qx, qy, yaw + R.uniform(-1, 1))
    for lx in (-10, 10):
        qx, qy = local(cx, cy, yaw, lx, -D / 2 - 4.5)
        cart(qx, qy, yaw)


def cart(x, y, yaw):
    C = "Props"
    obox(C, x, y, 0.8, 2.0, 1.0, 0.12, yaw, "wood")
    obox(C, x, y, 0.92, 1.9, 0.9, 0.25, yaw, "flowers")
    for lx in (-0.7, 0.7):
        px, py = local(x, y, yaw, lx, 0)
        ox, oy = -math.sin(yaw) * 0.55, math.cos(yaw) * 0.55
        tube(C, (px - ox, py - oy, 0.4), (px + ox, py + oy, 0.4), 0.4, "wood", seg=8)
    cyl(C, x, y, 0.92, 2.6, 0.03, 0.03, "metal_dark", seg=4, cap=False)
    cyl(C, x, y, 2.4, 2.75, 1.4, 0.05, R.choice(["auto_yellow", "tin_blue", "car_red"]), seg=10)


def build_depot():
    C = "Depot"
    d = DEPOT
    yard = sbox(d["x0"], d["y0"], d["x1"], d["y1"])
    K.tri_area(C, "concrete", yard, 0.03)
    mark_poly(yard.buffer(1.0))
    # perimeter wall with the gate on the west side
    for (x0, y0, x1, y1) in ((d["x0"], d["y1"] - 0.3, d["x1"], d["y1"]), (d["x0"], d["y0"], d["x1"], d["y0"] + 0.3),
                             (d["x1"] - 0.3, d["y0"], d["x1"], d["y1"]), (d["x0"], d["y0"], d["x0"] + 0.3, -222.0), (d["x0"], -208.0, d["x0"] + 0.3, d["y1"])):
        box(C, x0, y0, 0, x1, y1, 2.2, {"*": "compound", "top": "concrete"})
    # boarding platform + canopy (passengers board on the bus's left)
    box(C, 92, -187.0, 0, 162, -183.0, 0.3, {"*": "curb_bw", "top": "pavers"})
    box(C, 90, -188.5, 4.4, 164, -178.0, 4.7, {"*": "metal_light", "bottom": "metal_light"}, skip=())
    for x in range(94, 162, 8):
        cyl(C, x, -185.0, 0.3, 4.4, 0.12, 0.12, "metal_light")
    for k in range(4):
        x = 100 + k * 16
        box(C, x, -186.8, 0.3, x + 2.0, -186.4, 0.75, "wood")
    # office block with the bus station name (faces the yard)
    obox(C, 156, -247, 0, 28, 18, 8.0, 0, {"*": "wall_plain", "n": "f_shoprow", "top": "concrete"})
    plate("sign_depot", 156, -237.9, 7.0, 0, -1, 26, 1.6, back=None, coll_name=C)
    roof_stuff(156, -247, 0, 28, 18, 8.0, big=True)
    # parked buses in the south-west of the yard
    for x in (92.0, 108.0, 124.0):
        bus_model(x, -246.0, 0.0)
    rain_tree(86, -232, 0.03, 0.8)
    rain_tree(166, -228, 0.03, 0.7)


def mark_poly(geom):
    global OCC
    OCC |= raster(geom)


def build_techpark():
    C = "Buildings"
    poly_ = sbox(205, -320, 380, -150)
    K.tri_area(C, "concrete", poly_, 0.03)
    mark_poly(poly_.buffer(1.0))
    for (cx, cy, w, d, f) in ((240, -190, 34, 22, 12), (310, -200, 30, 30, 14), (350, -280, 30, 22, 9), (250, -280, 40, 20, 6)):
        obox(C, cx, cy, 0, w, d, 5.0, 0, {"*": "glass", "top": None})
        obox(C, cx, cy, 5.0, w, d, f * 4.0, 0, {"*": "f_techpark", "top": "concrete"}, zuv=5.0)
        obox(C, cx, cy, 5.0 + f * 4.0, w * 0.4, d * 0.4, 3.0, 0, "metal_light")
    for x in range(212, 375, 18):
        palm(x, -155.0, 0.03, 0.9)
    for k in range(16):
        car(220 + k * 3.0, -240.0, math.pi / 2)


# ---------------------------------------------------------------- metro
def build_metro():
    C = "Metro"
    orr = RD["ORR"]
    ln = orr.line
    zb, zt = 11.2, 12.8
    js = [j for j in JUNCS if "ORR" in j["roads"]]
    K.sweep_box(C, "concrete", "concrete", list(ln.coords), 9.0, zb, zt, mat_bottom="concrete")
    for sgn in (-1, 1):
        for e in _lines(ln.offset_curve(sgn * 4.35)):
            K.sweep_box(C, "concrete", "concrete", list(e.coords), 0.3, zt, zt + 1.3)
    for off in (-2.9, -1.5, 1.5, 2.9):
        for e in _lines(ln.offset_curve(off)):
            for g in (-0.72, 0.72):
                for e2 in _lines(e.offset_curve(g)):
                    K.sweep_box(C, "steel", "steel", list(e2.coords), 0.08, zt, zt + 0.17)
    s = 10.0
    while s < ln.length:
        c = ln.interpolate(s)
        if all(math.dist((c.x, c.y), j["pos"]) > j["r"] + 4 for j in js):
            tx, ty = tangent_at(ln, s)
            yaw = math.atan2(ty, tx)
            obox(C, c.x, c.y, 0.22, 1.8, 1.6, zb - 1.2 - 0.22, yaw, "concrete")
            obox(C, c.x, c.y, zb - 1.2, 2.6, 8.0, 1.2, yaw, "concrete", skip=())
        s += 30.0
    # station spanning the ORR
    s0 = ln.project(Point(200, -50))
    c = ln.interpolate(s0)
    tx, ty = tangent_at(ln, s0)
    yaw = math.atan2(ty, tx)
    Lx, Wy = 120.0, 40.0
    rmark(c.x, c.y, yaw, Lx + 6, Wy + 6, building=True)
    obox(C, c.x, c.y, 6.6, Lx, Wy, 2.6, yaw, {"*": "white", "bottom": "concrete", "top": "concrete"}, skip=())
    obox(C, c.x, c.y, zt, Lx, 22.0, 0.3, yaw, {"*": "concrete", "top": "pavers"}, skip=())
    for ly in (-6.0, 6.0):
        px, py = local(c.x, c.y, yaw, 0, ly)
        obox(C, px, py, zt, Lx - 4, 4.0, 1.1, yaw, {"*": "curb_bw", "top": "pavers"})
    for lx in np.arange(-Lx / 2 + 4, Lx / 2 - 2, 12.0):
        for ly in (-Wy / 2 + 1, Wy / 2 - 1):
            px, py = local(c.x, c.y, yaw, lx, ly)
            obox(C, px, py, 0.0, 1.4, 1.4, 6.6, yaw, "concrete")
        for ly in (-10.5, 10.5):
            px, py = local(c.x, c.y, yaw, lx, ly)
            cyl(C, px, py, zt + 0.3, zt + 7.0, 0.2, 0.2, "metal_light", seg=8)
    obox(C, c.x, c.y, zt + 7.0, Lx + 4, 26.0, 0.5, yaw, {"*": "purple", "top": "metal_light", "bottom": "metal_light"}, skip=())
    for ly, flip in ((-13.06, False), (13.06, True)):
        A, B = local(c.x, c.y, yaw, -30, ly), local(c.x, c.y, yaw, 30, ly)
        pts = [(A[0], A[1], zt + 4.6), (B[0], B[1], zt + 4.6), (B[0], B[1], zt + 6.9), (A[0], A[1], zt + 6.9)]
        uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        if flip:
            pts = [pts[1], pts[0], pts[3], pts[2]]
        face(C, "sign_metro", pts, uvs)
        obox(C, *local(c.x, c.y, yaw, 0, ly * 0.985), zt + 4.5, 62, 0.2, 2.5, yaw, "purple")
    for lx in (-Lx / 2 + 6, Lx / 2 - 6):
        for ly in (-Wy / 2 - 3, Wy / 2 + 3):
            px, py = local(c.x, c.y, yaw, lx, ly)
            obox(C, px, py, 0, 4.0, 4.0, zt + 1.0, yaw, {"*": "glass", "top": "purple"})
    # train at the platform
    for k in range(3):
        px, py = local(c.x, c.y, yaw, -21 + k * 21, -2.9)
        tc = math.cos(yaw)

        def uvm(fk, pts, m, px=px, py=py):
            if m != "metro_side":
                return None
            return [((((p[0] - px) * math.cos(yaw) + (p[1] - py) * math.sin(yaw)) + 10) / 20, (p[2] - zt - 0.5) / 3.6) for p in pts]
        obox(C, px, py, zt + 0.5, 20.5, 2.9, 3.6, yaw, {"n": "metro_side", "s": "metro_side", "*": "metal_light"}, uv=uvm)
    METRO["station"] = (c.x, c.y)


METRO = {}


# ------------------------------------------------------------ street props
def poles_and_cables():
    """Concrete poles with sagging bundles of power + cable-TV/fibre lines, streetlights, transformers."""
    for r in ROADS:
        if r.cls not in ("road", "cross", "lane", "main"):
            continue
        side = 1 if hash(r.name) % 2 else -1
        for pc in pieces(r, 3.0):
            if not in_core(*pc.interpolate(0.5, normalized=True).coords[0], 40):
                continue
            n = max(1, int(round(pc.length / 32)))
            tops = []
            for k in range(n + 1):
                s = pc.length * k / n
                c = pc.interpolate(s)
                tx, ty = tangent_at(pc, s)
                nx, ny = -ty * side, tx * side
                off = (r.cw / 2 + r.sw - 0.4) if r.sw > 0 else (r.cw / 2 + 0.25)
                x, y = c.x + nx * off, c.y + ny * off
                if any(math.dist((x, y), cw) < 4 for cw in CROSSWALKS) or (r.sw == 0 and not rfree(x, y, 0, 0.5, 0.5, 0)):
                    tops.append(None)
                    continue
                z0 = FP_H if r.sw > 0 else 0.0
                yaw = math.atan2(ty, tx)
                obox("Props", x, y, z0, 0.3, 0.22, 9.0 - z0, yaw, "pole")
                obox("Props", x, y, 8.4, 0.12, 1.6, 0.12, yaw, "metal_dark", skip=())
                # LED streetlight arm over the road
                ex, ey = x - nx * 1.8, y - ny * 1.8
                tube("Props", (x, y, 8.0), (ex, ey, 8.3), 0.04, "metal_light")
                obox("Props", ex, ey, 8.18, 0.6, 0.25, 0.12, yaw, {"*": "metal_light", "bottom": "lamp_white"}, skip=())
                if R.random() < 0.12 and r.sw > 0:      # transformer (TC) on a platform
                    px, py = x + tx * 1.6, y + ty * 1.6
                    obox("Props", px, py, z0, 0.25, 0.22, 7.0, yaw, "pole")
                    obox("Props", x + tx * 0.8, y + ty * 0.8, 3.0, 2.2, 1.2, 0.15, yaw, "metal_dark", skip=())
                    obox("Props", x + tx * 0.8, y + ty * 0.8, 3.15, 1.2, 0.9, 1.3, yaw, "metal_light")
                tops.append((x, y, nx, ny))
            for a, b in zip(tops, tops[1:]):
                if not a or not b or math.dist(a[:2], b[:2]) > 45:
                    continue
                span = math.dist(a[:2], b[:2])
                ncab = R.randint(4, 9)
                for kk in range(ncab):
                    o = (kk - ncab / 2) * 0.12
                    z = 8.3 - kk * 0.25
                    sag = span * R.uniform(0.02, 0.05) + 0.3
                    p0 = (a[0] + a[2] * o, a[1] + a[3] * o, z)
                    p1 = (b[0] + b[2] * o, b[1] + b[3] * o, z + R.uniform(-0.3, 0.3))
                    prev = p0
                    for m in range(1, 9):
                        t = m / 8
                        cur = (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t - sag * 4 * t * (1 - t))
                        tube("Wires", prev, cur, 0.012 if kk < 3 else 0.02, "wire", seg=3, ref=p0)
                        prev = cur


def street_trees():
    for r in ROADS:
        if r.cls not in ("main", "road", "orr"):
            continue
        for pc in pieces(r, 6.0):
            for side in (1, -1):
                s = R.uniform(4, 12)
                while s < pc.length - 4:
                    c = pc.interpolate(s)
                    tx, ty = tangent_at(pc, s)
                    nx, ny = -ty * side, tx * side
                    off = r.cw / 2 + r.sw * 0.7
                    x, y = c.x + nx * off, c.y + ny * off
                    if in_core(x, y) and all(math.dist((x, y), cw) > 5 for cw in CROSSWALKS) and all(math.dist((x, y), e[:2]) > e[2] for e in KEEP):
                        if r.cls == "orr":
                            (gulmohar if R.random() < 0.5 else ashoka)(x, y, FP_H, 0.9)
                        else:
                            (rain_tree if R.random() < 0.7 else gulmohar)(x, y, FP_H, R.uniform(0.8, 1.05))
                    s += R.uniform(22, 34) if r.cls != "orr" else 18
    # main road median: small trees + streetlight masts on the ORR median
    for pc in pieces(RD["ORR"], 8.0):
        s = 15.0
        while s < pc.length - 10:
            c = pc.interpolate(s)
            if in_core(c.x, c.y, 40):
                tx, ty = tangent_at(pc, s)
                cyl("Props", c.x, c.y, 0.22, 10.0, 0.13, 0.09, "metal_light", seg=8)
        # (lights hang under the metro deck - kept simple)
            s += 40.0


KEEP = []    # (x, y, r) zones trees should avoid (bus stops, signals)


def signals():
    for j, x, y, hx, hy, r in SIGNAL_POLES:
        if not in_core(x, y):
            continue
        cyl("Props", x, y, FP_H, 4.6, 0.1, 0.08, "metal_dark", seg=8)
        # vertical head facing the approaching traffic: red on top
        fx, fy = x - hx * 0.25, y - hy * 0.25
        yaw = math.atan2(hy, hx)
        obox("Props", fx, fy, 3.0, 0.35, 0.4, 1.3, yaw, "metal_dark", skip=())
        for k, m in enumerate(("lamp_red", "lamp_off", "lamp_off") if abs(hx) > abs(hy) else ("lamp_off", "lamp_off", "lamp_green")):
            z = 4.05 - k * 0.42
            tube("Props", (fx - hx * 0.17, fy - hy * 0.17, z), (fx - hx * 0.22, fy - hy * 0.22, z), 0.13, m, seg=10, cap=True)
        obox("Props", x - hx * 0.25, y - hy * 0.25, 2.35, 0.3, 0.5, 0.45, yaw, "lamp_red" if abs(hx) > abs(hy) else "lamp_green", skip=())
        KEEP.append((x, y, 3.0))


def plate(mat, cx, cy, cz, hx, hy, w, h, back="metal_light", coll_name="Props", uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
    """Vertical plate read by someone looking along (hx, hy)."""
    rx, ry = hy, -hx
    cx, cy = cx - hx * 0.03, cy - hy * 0.03
    pts = [(cx - rx * w / 2, cy - ry * w / 2, cz - h / 2), (cx + rx * w / 2, cy + ry * w / 2, cz - h / 2),
           (cx + rx * w / 2, cy + ry * w / 2, cz + h / 2), (cx - rx * w / 2, cy - ry * w / 2, cz + h / 2)]
    face(coll_name, mat, pts, list(uvs))
    if back:
        face(coll_name, back, [(p[0] + hx * 0.01, p[1] + hy * 0.01, p[2]) for p in pts[::-1]], [(0, 0)] * 4)


# ------------------------------------------------------------- bus route
def lane_leg(road, a, b, trim_a=0.0, trim_b=0.0):
    ln = road.line
    sa, sb = ln.project(Point(a)), ln.project(Point(b))
    sa += trim_a if sb > sa else -trim_a
    sb -= trim_b if sb > sa else -trim_b
    seg = substring(ln, sa, sb)
    if seg.length < 1:
        return []
    off = seg.offset_curve(road.lane_offset())
    return list(off.coords)


def bezier(p, tp, q, tq, step=2.0):
    k = math.dist(p, q) * 0.45
    c1 = (p[0] + tp[0] * k, p[1] + tp[1] * k)
    c2 = (q[0] - tq[0] * k, q[1] - tq[1] * k)
    n = max(4, int(math.dist(p, q) / step))
    out = []
    for i in range(1, n):
        t = i / n
        u = 1 - t
        out.append((u ** 3 * p[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * q[0],
                    u ** 3 * p[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * q[1]))
    return out


def _tan(pts, end):
    a, b = (pts[-2], pts[-1]) if end else (pts[0], pts[1])
    L = math.dist(a, b) or 1.0
    return ((b[0] - a[0]) / L, (b[1] - a[1]) / L)


def join(legs):
    path = list(legs[0])
    for leg in legs[1:]:
        path += bezier(path[-1], _tan(path, True), leg[0], _tan(leg, False))
        path += leg
    return path


def circle_arc(a_in, a_out, r):
    """Clockwise arc (left-hand traffic) from angle a_in to a_out."""
    cx, cy = CIRCLE["c"]
    if a_out > a_in:
        a_out -= 2 * math.pi
    n = max(6, int((a_in - a_out) * r / 2))
    return [(cx + r * math.cos(a_in + (a_out - a_in) * k / n), cy + r * math.sin(a_in + (a_out - a_in) * k / n)) for k in range(n + 1)]


def arm_angle(road):
    cx, cy = CIRCLE["c"]
    ln = road.line
    s = ln.project(Point(cx, cy))
    q = ln.interpolate(s + (CIRCLE["ro"] + 8) * (1 if s < 1 else -1))
    return math.atan2(q.y - cy, q.x - cx)


def bus_route():
    cc = CIRCLE["c"]
    j1 = junction("ORR", "MAIN_S")["pos"]
    j3 = junction("ORR", "EAST_RD")["pos"]
    jl = junction("LAKE_RD", "EAST_RD")["pos"]
    jg = junction("GATE", "MAIN_S")["pos"]
    tr = lambda j: j["r"] + 3.0      # noqa: E731
    J1, J3, JL, JG = junction("ORR", "MAIN_S"), junction("ORR", "EAST_RD"), junction("LAKE_RD", "EAST_RD"), junction("GATE", "MAIN_S")
    rc = CIRCLE["ro"] + 4.0
    bay = (150.0, -180.6)
    legs = []
    legs.append([bay, (100.0, -180.6)])
    legs.append(lane_leg(RD["GATE"], (80, -215), jg, 0, tr(JG)))
    legs.append(lane_leg(RD["MAIN_S"], jg, cc, tr(JG), rc))
    a_in, a_out = arm_angle(RD["MAIN_S"]), arm_angle(RD["LAKE_RD"])
    ring_r = CIRCLE["ri"] + 6.5
    legs.append(circle_arc(a_in - 0.18, a_out + 0.18, ring_r))
    legs.append(lane_leg(RD["LAKE_RD"], cc, jl, rc, tr(JL)))
    legs.append(lane_leg(RD["EAST_RD"], jl, j3, tr(JL), tr(J3)))
    legs.append(lane_leg(RD["ORR"], j3, j1, tr(J3), tr(J1)))
    legs.append(lane_leg(RD["MAIN_S"], j1, jg, tr(J1), tr(JG)))
    legs.append(lane_leg(RD["GATE"], jg, (80, -215), tr(JG), 0))
    legs.append([(98.0, -212.0), (135.0, -212.0)])          # through the yard, U-turn to the platform
    legs.append([(158.0, -180.6), bay])
    path = join([l for l in legs if len(l) >= 2])
    # resample to ~2 m
    ls = LineString(path)
    n = int(ls.length / 2.0)
    return [ls.interpolate(i * ls.length / n).coords[0] for i in range(n)], legs


STOPS = [
    dict(road="MAIN_S", near=(-30, 10), heading_to=CIRCLE["c"], kn="ಮಲ್ಲಿಗೆ ನಗರ 1ನೇ ಹಂತ", en="Mallige Nagar 1st Stage"),
    dict(road="LAKE_RD", near=(220, 178), heading_to=(505, 240), kn="ಕೆರೆ ಉದ್ಯಾನ", en="Kere Park"),
    dict(road="EAST_RD", near=(445, 80), heading_to=(330, -45), kn="ಸರ್ಕಾರಿ ಶಾಲೆ", en="Govt. School"),
    dict(road="ORR", near=(160, -55), heading_to=(-60, -130), kn="ಮಲ್ಲಿಗೆ ನಗರ ಮೆಟ್ರೋ", en="Mallige Nagar Metro"),
]


def build_bus_stops():
    out = []
    for st in STOPS:
        r = RD[st["road"]]
        ln = r.line
        s = ln.project(Point(st["near"]))
        dirn = 1 if ln.project(Point(st["heading_to"])) > s else -1
        c = ln.interpolate(s)
        tx, ty = tangent_at(ln, s)
        hx, hy = tx * dirn, ty * dirn
        lx, ly = -hy, hx                         # left = kerb side
        off = r.cw / 2 + r.sw * 0.55
        x, y = c.x + lx * off, c.y + ly * off
        yaw = math.atan2(hy, hx)
        C = "Props"
        # BMTC-style steel shelter: roof, ad back panel, bench, BUS STOP board
        obox(C, x, y, 2.6, 5.0, 1.8, 0.12, yaw, "metal_light", skip=())
        bx, by = x + lx * 0.85, y + ly * 0.85
        obox(C, bx, by, FP_H + 0.3, 4.8, 0.06, 2.3, yaw, "metal_dark")
        row = R.randrange(4)
        v0, v1 = 1 - (row + 1) / 4, 1 - row / 4
        plate("hoarding", bx, by, FP_H + 1.55, lx, ly, 4.6, 1.5, back=None, uvs=((0, v0), (1, v0), (1, v1), (0, v1)))
        for lxx in (-2.3, 2.3):
            for lyy in (-0.8, 0.8):
                px, py = local(x, y, yaw, lxx, lyy)
                cyl(C, px, py, FP_H, 2.6, 0.04, 0.04, "metal_light", seg=6)
        px, py = local(x, y, yaw, 0, 0.45)
        obox(C, px, py, FP_H + 0.45, 3.6, 0.4, 0.06, yaw, "steel")
        sx, sy = local(x, y, yaw, 0, -0.92)
        plate("sign_busstop", sx, sy, 3.3, lx, ly, 3.2, 1.2)
        # painted BUS STOP in the kerb lane just before the stop
        lo = r.lane_offset()
        dx, dy = c.x + lx * lo - hx * 14, c.y + ly * lo - hy * 14
        decal("paint_busstop", dx, dy, hx, hy, 5.0, 2.4)
        KEEP.append((x, y, 8.0))
        sp = (c.x + lx * lo + hx * 3, c.y + ly * lo + hy * 3)
        out.append(dict(name_kn=st["kn"], name_en=st["en"], shelter=[round(x, 2), round(y, 2)], stop_point=[round(sp[0], 2), round(sp[1], 2)],
                        heading=[round(hx, 3), round(hy, 3)], door_side="left"))
    return out


def write_json(path, stops):
    def gl(p):
        return [round(p[0], 3), 0.0, round(-p[1], 3)]
    cum = [0.0]
    for a, b in zip(path, path[1:]):
        cum.append(cum[-1] + math.dist(a, b))
    allst = [dict(name_kn="ಮಲ್ಲಿಗೆ ನಗರ ಬಸ್ ನಿಲ್ದಾಣ", name_en="Mallige Nagar Bus Station (platform 1)", stop_point=[150.0, -180.6],
                  heading=[-1, 0], door_side="left")] + stops
    for st in allst:
        i = min(range(len(path)), key=lambda k: math.dist(path[k], st["stop_point"]))
        st["route_index"], st["route_distance_m"] = i, round(cum[i], 1)
        st["stop_point_gltf"] = gl(st["stop_point"])
    allst.sort(key=lambda s: s["route_distance_m"])
    roads = []
    for r in ROADS:
        roads.append(dict(id=r.name, name_kn=r.kn, name_en=r.en, cls=r.cls, carriageway_m=r.cw, footpath_m=r.sw, median_m=r.p["median"],
                          lanes_per_direction=r.p["lanes"], lane_width_m=r.p["lane_w"], speed_kmh=r.p["speed"],
                          centerline=[[round(x, 2), round(y, 2)] for x, y in r.line.simplify(0.5).coords]))
    data = dict(
        map=MAP, country="India", city="Mallige Nagar, Bengaluru (fictional, Bengaluru-inspired)", units="metres", traffic="left-hand",
        coordinate_systems=dict(blender="+X east, +Y north, +Z up", gltf="+X east, +Y up, -Z north (gltf = [x, z, -y])"),
        drivable_bounds_blender=dict(xmin=CORE[0], ymin=CORE[1], xmax=CORE[2], ymax=CORE[3]),
        spawn=dict(position=[150.0, -180.6, 0.0], position_gltf=gl((150.0, -180.6)), heading_deg_from_east=180.0,
                   note="Platform 1, Mallige Nagar Bus Station; doors (left) face the platform"),
        route=dict(number="500", name_kn="ಮಲ್ಲಿಗೆ ನಗರ ವೃತ್ತ", name_en="Mallige Nagar Circle loop", loop=True,
                   length_m=round(cum[-1] + math.dist(path[-1], path[0]), 1),
                   points=[[round(x, 2), round(y, 2)] for x, y in path], points_gltf=[gl(p) for p in path]),
        stops=allst,
        roundabout=dict(center=list(CIRCLE["c"]), island_radius_m=CIRCLE["ri"], outer_radius_m=CIRCLE["ro"], direction="clockwise",
                        name_kn=CIRCLE["name_kn"], name_en=CIRCLE["name_en"]),
        signalised_junctions=[[round(j["pos"][0], 2), round(j["pos"][1], 2)] for j in JUNCS if j["signal"] and in_core(*j["pos"])],
        speed_breakers=BREAKERS, roads=roads,
    )
    with open(os.path.join(OUT, MAP + "_route.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return data


def route_curve(path):
    cu = bpy.data.curves.new("BusRoute", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(path) - 1)
    for i, p in enumerate(path):
        sp.points[i].co = (p[0], p[1], 0.4, 1)
    sp.use_cyclic_u = True
    cu.bevel_depth = 0.3
    m = bpy.data.materials.new("route_overlay")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (1, 0.3, 0, 1)
    b.inputs["Emission Color"].default_value = (1, 0.3, 0, 1)
    b.inputs["Emission Strength"].default_value = 3
    cu.materials.append(m)
    ob = bpy.data.objects.new("BusRoute_500", cu)
    ob.hide_render = True
    K.coll("BusRoute (helper)").objects.link(ob)


# ------------------------------------------------------------------ main
def ground():
    world = sbox(*WORLD)
    K.tri_area("Terrain", "soil", world.difference(lake_poly()), -0.03)
    F = 6000.0
    for q in (((-F, -F), (F, -F), (F, WORLD[1]), (-F, WORLD[1])), ((-F, WORLD[3]), (F, WORLD[3]), (F, F), (-F, F)),
              ((-F, WORLD[1]), (WORLD[0], WORLD[1]), (WORLD[0], WORLD[3]), (-F, WORLD[3])),
              ((WORLD[2], WORLD[1]), (F, WORLD[1]), (F, WORLD[3]), (WORLD[2], WORLD[3]))):
        face("Backdrop", "far_ground", [(x, y, -0.2) for x, y in q], [(x / 80, y / 80) for x, y in q], ref=(0, 0))


def lane_cam(name, road, near, toward, back=0.0, h=2.8, look=80.0, lens=22, look_h=None):
    """Camera in the kerb lane of `road` near `near`, facing toward `toward` (driver's eye)."""
    r = RD[road]
    ln = r.line
    s = ln.project(Point(near))
    dirn = 1 if ln.project(Point(toward)) > s else -1
    s -= dirn * back
    c = ln.interpolate(s)
    tx, ty = tangent_at(ln, s)
    hx, hy = tx * dirn, ty * dirn
    lo = r.lane_offset()
    x, y = c.x - hy * lo, c.y + hx * lo
    q = ln.interpolate(s + dirn * look)
    qx, qy = q.x - hy * lo * 0.3, q.y + hx * lo * 0.3
    return K.add_camera(name, (x, y, h), (qx, qy, look_h if look_h is not None else h + 1.0), lens)


def cameras():
    cc = CIRCLE["c"]
    cams = [
        K.add_camera("Cam_Aerial", (-330, -360, 260), (40, 60, 0), 30),
        lane_cam("Cam_Circle", "MAIN_S", (-30, 10), cc, look=75, h=3.0),
        lane_cam("Cam_ORR_Metro", "ORR", (60, -85), (-60, -130), look=90),
        lane_cam("Cam_Temple_Street", "TEMPLE_ST", (-170, 108), (-330, 92), look=70),
        lane_cam("Cam_Kere_Road", "LAKE_RD", (90, 160), (330, 182), look=80),
        lane_cam("Cam_Old_Town_Lane", "L1", (-232, -50), (-262, -150), look=22, h=1.8, lens=22, look_h=2.4),
        lane_cam("Cam_Circle_Close", "MAIN_S", (-50, 62), CIRCLE["c"], look=40, h=3.0),
        K.add_camera("Cam_Bus_Station", (88, -205, 5.0), (150, -184, 1.8), 26),
        K.add_camera("Cam_TopDown", (50, 20, 800), (50, 20.001, 0), 50, ortho=1000),
    ]
    bpy.context.scene.camera = cams[0]


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = K.build_materials()
    build_network()
    print("roads", len(ROADS), "junctions", len(JUNCS), flush=True)
    build_road_surfaces()
    OCC[:] = raster(unary_union([GEO["road"], GEO["foot"], GEO["median"], GEO["island"].buffer(1)]))
    build_markings()
    speed_breakers()
    build_lake()
    mark_poly(GEO["lake"])
    build_circle()
    build_depot()
    build_techpark()
    build_metro()
    build_temple()
    stops = build_bus_stops()
    signals()
    for rank in (5, 4, 3, 2, 1):
        for r in ROADS:
            if r.rank == rank:
                frontage(r)
    fill_interiors()
    street_trees()
    poles_and_cables()
    # street life: autos near the circle & metro, a few parked cars
    for k in range(6):
        a = math.radians(200 + k * 7)
        auto_rickshaw(CIRCLE["c"][0] + math.cos(a) * 40, CIRCLE["c"][1] + math.sin(a) * 40, a + math.pi / 2)
    ground()
    bus_model(150.0, -180.6, math.pi, "ReferenceBus")
    print("faces:", K.STATS["faces"], "batches:", len(K.BATCHES), flush=True)
    K.flush(mats, collision={"Roads", "Footpaths", "Buildings", "Depot", "Metro", "Temple", "Circle", "Terrain", "Lake"},
            surfaces={"Roads": "asphalt", "Footpaths": "kerb", "Terrain": "ground", "Depot": "concrete"})
    path, _ = bus_route()
    data = write_json(path, stops)
    route_curve(path)
    K.setup_world(sun_elev=48, sun_az=120, sun_energy=4.6, sky_strength=0.35, dust=2.6)
    cameras()
    if not _arg("--no-glb"):
        K.export_glb(os.path.join(OUT, MAP + ".glb"),
                     {"Roads", "Footpaths", "Markings", "Buildings", "Depot", "Metro", "Temple", "Circle", "Lake", "Terrain",
                      "Vegetation", "Props", "Wires", "Vehicles", "Backdrop"})
    K.save_blend(os.path.join(OUT, MAP + ".blend"))
    print("saved; route", data["route"]["length_m"], "m;", len(data["stops"]), "stops", flush=True)
    if _arg("--render"):
        K.render_previews(os.path.join(OUT, "previews"), int(_arg("--samples", 40)), _arg("--only"))


if __name__ == "__main__":
    main()
