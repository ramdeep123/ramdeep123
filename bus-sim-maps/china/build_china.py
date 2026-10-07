"""Jinhe New District (金河新区) - a Chinese city district for NammaBusSim, built in Blender.

    blender -b -P build_china.py -- [--out DIR] [--render] [--samples 40] [--no-glb] [--only Century]

Right-hand traffic. A curving 8-lane boulevard under an elevated expressway,
6-lane avenues with fenced medians and painted non-motorised lanes, a
meandering river with bridges and a willow promenade, south-facing high-rise
residential compounds behind 2-3 storey shop podiums (底商), glass office
towers and a mall, a hutong-style old quarter with grey-tiled courtyard houses,
a riverside pagoda, a pedestrian overpass (天桥), shared bikes, and 公交专用 bus
lanes. Needs shapely (see README).
"""
import math
import os
import random
import sys

import bpy
from shapely.geometry import LineString, Point
from shapely.ops import unary_union


def _find_dir():
    cands = [os.path.dirname(os.path.abspath(__file__))] if "__file__" in globals() else []
    cands += [os.path.dirname(bpy.path.abspath(t.filepath)) for t in bpy.data.texts if t.filepath]
    cands += [os.environ.get("NBS_CHINA_DIR", ""), os.getcwd()]
    for c in cands:
        if c and os.path.isfile(os.path.join(c, "build_china.py")) and os.path.isdir(os.path.join(c, "textures")):
            return c
    raise RuntimeError("Can't find the china map folder; set NBS_CHINA_DIR")


HERE = _find_dir()
sys.path.insert(0, os.path.join(HERE, "..", "common"))
import nbs_kit as K  # noqa: E402
import nbs_city as NC  # noqa: E402
from nbs_kit import face, box, obox, cyl, tube, blob, crown, local, srgb  # noqa: E402
from nbs_city import tangent_at, lines_of, plate  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def _arg(name, default=None):
    if name in ARGS:
        i = ARGS.index(name)
        return ARGS[i + 1] if i + 1 < len(ARGS) and not ARGS[i + 1].startswith("--") else True
    return default


OUT = os.path.abspath(_arg("--out", os.path.join(HERE, "out")))
SEED = int(_arg("--seed", 86))
R = random.Random(SEED)
MAP = "china_jinhe"
WORLD = (-760.0, -660.0, 760.0, 680.0)
CORE = (-500.0, -420.0, 520.0, 470.0)
FP = 0.18

MATS = {
    "asphalt": dict(img="asphalt.jpg", T=6.0, rough=0.85, bump=0.2),
    "sidewalk": dict(img="sidewalk.jpg", T=3.0, rough=0.8, bump=0.1),
    "curb": dict(img="curb.jpg", T=2.0, rough=0.7),
    "bike_lane": dict(img="bike_lane.jpg", T=4.0, rough=0.85),
    "grass": dict(img="grass.jpg", T=4.0, rough=0.95),
    "ground": dict(img="ground.jpg", T=14.0, rough=0.95),
    "water": dict(img="water.jpg", T=24.0, rough=0.05),
    "stone": dict(img="stone.jpg", T=3.0, rough=0.8),
    "concrete": dict(img="concrete.jpg", T=6.0, rough=0.85),
    "leaves": dict(img="leaves.jpg", T=1.6, rough=0.9),
    "willow": dict(img="willow.jpg", T=1.2, rough=0.9),
    "f_white": dict(img="facade_highrise_white.jpg", tw=10.8, th=12.0, rough=0.6),
    "f_beige": dict(img="facade_highrise_beige.jpg", tw=10.8, th=12.0, rough=0.6),
    "f_brick": dict(img="facade_highrise_brick.jpg", tw=10.8, th=12.0, rough=0.7),
    "f_office_blue": dict(img="facade_office_blue.jpg", tw=18.0, th=16.0, rough=0.08, metal=0.5),
    "f_office_green": dict(img="facade_office_green.jpg", tw=18.0, th=16.0, rough=0.08, metal=0.5),
    "wall_white": dict(img="wall_white.jpg", T=8.0, rough=0.8),
    "grey_brick": dict(img="grey_brick.jpg", T=2.4, rough=0.9),
    "roof_tile": dict(img="roof_tile.jpg", T=1.0, rough=0.5, bump=0.4),
    "shops": dict(img="shop_atlas.jpg", rough=0.4, emit_tex=0.3),
    "mall_band": dict(img="mall_band.jpg", rough=0.4, emit_tex=1.2),
    "sign_busstop": dict(img="sign_busstop.jpg", rough=0.4),
    "sign_guide": dict(img="sign_guide.jpg", rough=0.4),
    "sign_speed": dict(img="sign_speed.png", alpha=True, rough=0.4),
    "sign_compound": dict(img="sign_compound.jpg", rough=0.4, emit_tex=0.5),
    "sign_hub": dict(img="sign_hub.jpg", rough=0.4),
    "sign_temple": dict(img="sign_temple.jpg", rough=0.4),
    "paint_buslane": dict(img="paint_buslane.png", alpha=True, rough=0.6),
    "paint_white": dict(color=srgb(236, 236, 230), rough=0.6),
    "paint_yellow": dict(color=srgb(236, 180, 20), rough=0.6),
    "paint_bike": dict(color=srgb(130, 56, 50), rough=0.8),
    "metal_light": dict(color=srgb(196, 198, 198), rough=0.4, metal=0.5),
    "metal_dark": dict(color=srgb(60, 64, 70), rough=0.45, metal=0.6),
    "steel": dict(color=srgb(150, 152, 156), rough=0.3, metal=1.0),
    "glass": dict(color=srgb(70, 96, 112), rough=0.05, metal=0.4),
    "glass_panel": dict(color=srgb(170, 200, 210), rough=0.1, metal=0.2),
    "fence_white": dict(color=srgb(236, 236, 236), rough=0.4),
    "fence_blue": dict(color=srgb(40, 100, 180), rough=0.4),
    "red": dict(color=srgb(190, 24, 24), rough=0.5),
    "lantern": dict(color=srgb(230, 30, 20), emit=srgb(255, 60, 30), emit_s=2.5),
    "gold": dict(color=srgb(220, 170, 60), rough=0.25, metal=1.0),
    "wood_dark": dict(color=srgb(70, 40, 30), rough=0.7),
    "glazed_green": dict(color=srgb(40, 110, 80), rough=0.3),
    "rubber": dict(color=srgb(22, 22, 22), rough=0.9),
    "lamp_red": dict(color=srgb(230, 20, 20), emit=srgb(255, 30, 20), emit_s=10.0),
    "lamp_green": dict(color=srgb(20, 220, 80), emit=srgb(40, 255, 90), emit_s=10.0),
    "lamp_off": dict(color=srgb(36, 36, 36), rough=0.2),
    "lamp_white": dict(color=srgb(250, 250, 240), emit=srgb(255, 250, 235), emit_s=2.0),
    "led": dict(color=srgb(20, 40, 80), emit=srgb(60, 140, 255), emit_s=2.0),
    "bike_yellow": dict(color=srgb(250, 200, 20), rough=0.4),
    "bike_blue": dict(color=srgb(30, 120, 220), rough=0.4),
    "bike_green": dict(color=srgb(40, 180, 90), rough=0.4),
    "car_white": dict(color=srgb(232, 232, 230), rough=0.25, metal=0.2),
    "car_black": dict(color=srgb(18, 18, 20), rough=0.2, metal=0.3),
    "car_silver": dict(color=srgb(170, 172, 176), rough=0.25, metal=0.7),
    "car_red": dict(color=srgb(160, 30, 30), rough=0.25, metal=0.3),
    "bus_green": dict(color=srgb(40, 160, 90), rough=0.3),
    "far_ground": dict(color=srgb(110, 112, 96), rough=1.0),
}
K.configure(WORLD, MATS, os.path.join(HERE, "textures"), seed=SEED)

CLASSES = {
    "boulevard": dict(lanes=4, lane_w=3.5, median=8.0, shoulder=0.5, sw=6.0, rank=5, speed=60),
    "avenue": dict(lanes=3, lane_w=3.5, median=1.0, shoulder=2.5, sw=4.5, rank=4, speed=50),
    "street": dict(lanes=1, lane_w=3.5, median=0.0, shoulder=2.0, sw=3.5, rank=3, speed=40),
    "lane": dict(lanes=1, lane_w=2.5, median=0.0, shoulder=0.0, sw=0.0, rank=1, speed=20),
}
C = NC.City(WORLD, CORE, CLASSES, drive="right", fp_h=FP)

RIVER_PTS = [(-760, 520), (-500, 440), (-300, 370), (-80, 330), (150, 362), (380, 300), (760, 385)]
RIVER_W = 56.0


def define_roads():
    C.road("CENTURY", "boulevard", [(-760, -40), (-400, -20), (-100, 10), (200, 0), (500, -30), (760, -60)], name_local="世纪大道", name_en="Century Avenue")
    C.road("JINHE", "avenue", [(-250, -660), (-245, -300), (-232, 0), (-238, 300), (-262, 680)], name_local="金河路", name_en="Jinhe Road")
    C.road("RENMIN", "avenue", [(160, -660), (165, -300), (170, 0), (178, 300), (165, 680)], name_local="人民路", name_en="Renmin Road")
    C.road("JIANSHE", "street", [(-760, -310), (-250, -302), (165, -300), (760, -322)], name_local="建设路", name_en="Jianshe Road")
    C.road("CHUNJIANG", "street", [(-760, 170), (-245, 165), (172, 160), (760, 150)], name_local="春江路", name_en="Chunjiang Road")
    C.road("XIHUAN", "street", [(-560, -660), (-555, 0), (-560, 680)], name_local="西环路", name_en="Xihuan Road")
    C.road("DONGHUAN", "street", [(500, -660), (505, 0), (498, 680)], name_local="东环路", name_en="Donghuan Road")
    C.road("WENHUA", "street", [(-30, -300), (-25, 0), (-28, 165)], start_on="JIANSHE", end_on="CHUNJIANG", name_local="文化路", name_en="Wenhua Road")
    C.road("NANHUAN", "street", [(-760, -565), (0, -560), (760, -575)], name_local="南环路", name_en="Nanhuan Road")
    river = LineString(K.catmull_rom(RIVER_PTS, 2.0))
    s_bank = river.offset_curve(-(RIVER_W / 2 + 22))
    n_bank = river.offset_curve(RIVER_W / 2 + 22)
    C.road("BINJIANG_S", "street", list(s_bank.coords), spline=False, name_local="滨江南路", name_en="Binjiang South Road")
    C.road("BINJIANG_N", "street", list(n_bank.coords), spline=False, name_local="滨江北路", name_en="Binjiang North Road")
    # hutong-style old quarter north of the river, west of Jinhe Road
    C.road("H1", "lane", [(-555, 590), (-470, 585), (-400, 600), (-330, 590), (-250, 596)], start_on="XIHUAN", end_on="JINHE", name_local="槐树胡同")
    C.road("H2", "lane", [(-470, 500), (-462, 540), (-470, 585), (-484, 680)], start_on="BINJIANG_N")
    C.road("H3", "lane", [(-385, 450), (-392, 520), (-400, 600), (-392, 680)], start_on="BINJIANG_N")
    C.road("H4", "lane", [(-312, 420), (-318, 500), (-330, 590)], start_on="BINJIANG_N", end_on="H1")
    C.road("H5", "lane", [(-555, 640), (-480, 636), (-392, 645), (-300, 640), (-255, 642)], start_on="XIHUAN", end_on="JINHE")
    C.road("ZHONGSHAN", "street", [(-760, 300), (-555, 290)], end_on="XIHUAN")
    return river


def signal_rule(j, rs):
    ranks = sorted((r.rank for r in rs), reverse=True)
    return len(ranks) >= 2 and ranks[1] >= 3


def in_old_town(x, y):
    return x < -250 and y > 470


# ----------------------------------------------------------------- props
def plane_tree(x, y, z=FP, s=1.0):
    s *= R.uniform(0.85, 1.15)
    cyl("Vegetation", x, y, z, z + 4.5 * s, 0.22 * s, 0.16 * s, "concrete", seg=7, cap=False)
    crown("Vegetation", "leaves", x, y, z + 7.0 * s, 3.4 * s, 3.4 * s, 3.0 * s, 8)


def willow(x, y, z=0.0, s=1.0):
    s *= R.uniform(0.85, 1.15)
    cyl("Vegetation", x, y, z, z + 3.5 * s, 0.3 * s, 0.2 * s, "wood_dark", seg=7, cap=False)
    blob("Vegetation", "willow", x, y, z + 5.0 * s, 3.2 * s, 3.2 * s, 2.0 * s, rough=0.1)
    for k in range(10):                # hanging curtains of branches
        a = 2 * math.pi * k / 10
        px, py = x + math.cos(a) * 2.6 * s, y + math.sin(a) * 2.6 * s
        blob("Vegetation", "willow", px, py, z + 3.4 * s, 0.7 * s, 0.7 * s, 2.0 * s, rough=0.15, level=1)


def shared_bikes(x, y, yaw, n):
    for k in range(n):
        px, py = local(x, y, yaw, k * 0.65, 0)
        col = R.choice(["bike_yellow", "bike_blue", "bike_green"])
        ry = yaw + math.pi / 2
        c, s = math.cos(ry), math.sin(ry)
        for off in (0.52, -0.52):
            wx, wy = px + c * off, py + s * off
            tube("Vehicles", (wx - s * 0.02, wy + c * 0.02, 0.35 + FP), (wx + s * 0.02, wy - c * 0.02, 0.35 + FP), 0.33, "rubber", seg=8, cap=True)
        tube("Vehicles", (px - c * 0.45, py - s * 0.45, 0.5 + FP), (px + c * 0.45, py + s * 0.45, 0.75 + FP), 0.03, col, seg=4)
        tube("Vehicles", (px - c * 0.15, py - s * 0.15, 0.45 + FP), (px - c * 0.15, py - s * 0.15, 0.95 + FP), 0.025, col, seg=4)
        obox("Vehicles", px + c * 0.55, py + s * 0.55, 0.8 + FP, 0.3, 0.32, 0.22, ry, col)


def car(x, y, yaw, color=None):
    color = color or R.choice(["car_white"] * 4 + ["car_black"] * 3 + ["car_silver"] * 2 + ["car_red"])
    obox("Vehicles", x, y, 0.3, 4.6, 1.8, 0.75, yaw, color)
    px, py = x - math.cos(yaw) * 0.2, y - math.sin(yaw) * 0.2
    obox("Vehicles", px, py, 1.05, 2.5, 1.66, 0.55, yaw, {"*": "glass", "top": color})
    for lx in (1.5, -1.5):
        for ly in (0.86, -0.86):
            qx, qy = local(x, y, yaw, lx, ly)
            ox, oy = -math.sin(yaw) * 0.1, math.cos(yaw) * 0.1
            tube("Vehicles", (qx - ox, qy - oy, 0.32), (qx + ox, qy + oy, 0.32), 0.32, "rubber", seg=8, cap=True)


def bus_model(x, y, yaw, coll="ReferenceBus"):
    obox(coll, x, y, 0.35, 12.0, 2.5, 2.9, yaw, {"*": "bus_green", "top": "metal_light"})
    for side in (-1.26, 1.26):
        qx, qy = local(x, y, yaw, 0, side)
        obox(coll, qx, qy, 1.4, 10.5, 0.02, 1.3, yaw, "glass", skip=())
    for lx in (3.5, -3.8):
        for ly in (1.15, -1.15):
            qx, qy = local(x, y, yaw, lx, ly)
            ox, oy = -math.sin(yaw) * 0.15, math.cos(yaw) * 0.15
            tube(coll, (qx - ox, qy - oy, 0.5), (qx + ox, qy + oy, 0.5), 0.5, "rubber", seg=10, cap=True)


# -------------------------------------------------------------- buildings
HR_MATS = ["f_white", "f_white", "f_beige", "f_brick"]


def flat_roof(cx, cy, yaw, w, d, z, h=1.0, mat="wall_white"):
    for lx, ly, sx, sy in ((0, -d / 2 + 0.1, w, 0.2), (0, d / 2 - 0.1, w, 0.2), (-w / 2 + 0.1, 0, 0.2, d), (w / 2 - 0.1, 0, 0.2, d)):
        px, py = local(cx, cy, yaw, lx, ly)
        obox("Buildings", px, py, z, sx, sy, h, yaw, mat)


def highrise(cx, cy, yaw, w, d, floors, mat=None, detail=True):
    mat = mat or R.choice(HR_MATS)
    top = 4.0 + floors * 3.0
    obox("Buildings", cx, cy, 0, w, d, 4.0, yaw, {"*": "glass", "top": None})
    obox("Buildings", cx, cy, 4.0, w, d, top - 4.0, yaw, {"*": mat, "top": "concrete"}, zuv=4.0, u0=R.random())
    if detail:
        flat_roof(cx, cy, yaw, w, d, top, 1.2)
        for lx in (-w / 4, w / 4):
            px, py = local(cx, cy, yaw, lx, 0)
            obox("Buildings", px, py, top, min(8, w / 3), min(7, d * 0.6), 4.5, yaw, {"*": mat, "top": "concrete"}, zuv=top)
        if R.random() < 0.35:       # rooftop red name sign
            px, py = local(cx, cy, yaw, 0, -d / 2 + 0.6)
            plate("sign_compound", px, py, top + 3.0, *front_dir(yaw), min(w * 0.8, 24), 3.0, coll="Buildings")


def front_dir(yaw):
    # local -y in world = (sin yaw, -cos yaw); a viewer outside looks the opposite way
    fx, fy = math.sin(yaw), -math.cos(yaw)
    return -fx, -fy


def office(cx, cy, yaw, w, d, floors, detail=True):
    mat = R.choice(["f_office_blue", "f_office_green"])
    top = 6.0 + floors * 4.0
    obox("Buildings", cx, cy, 0, w, d, 6.0, yaw, {"*": "glass", "top": None})
    obox("Buildings", cx, cy, 6.0, w, d, top - 6.0, yaw, {"*": mat, "top": "concrete"}, zuv=6.0)
    if detail:
        obox("Buildings", cx, cy, top, w * 0.7, d * 0.7, 6.0, yaw, {"*": mat, "top": "metal_light"}, zuv=top)
        cyl("Buildings", cx, cy, top + 6.0, top + 22.0, 0.5, 0.15, "steel", seg=6)


def mall(cx, cy, yaw, w, d, detail=True):
    top = 26.0
    obox("Buildings", cx, cy, 0, w, d, top, yaw, {"*": "wall_white", "top": "concrete"})
    hx, hy = front_dir(yaw)
    for k, z in enumerate((8.0, 18.0)):
        row = R.randrange(4)
        px, py = local(cx, cy, yaw, 0, -d / 2)
        plate("mall_band", px, py, z, hx, hy, min(w * 0.85, 60), 5.5, back=None, coll="Buildings",
              uvs=((0, 1 - (row + 1) / 4), (1, 1 - (row + 1) / 4), (1, 1 - row / 4), (0, 1 - row / 4)))
    px, py = local(cx, cy, yaw, w * 0.3, -d / 2)
    plate("led", px, py, 14.0, hx, hy, 14, 8, back=None, coll="Buildings")
    gx, gy = local(cx, cy, yaw, 0, -d / 2 - 0.05)
    plate("glass", gx, gy, 2.5, hx, hy, 20, 5, back=None, coll="Buildings")
    if detail:
        flat_roof(cx, cy, yaw, w, d, top, 1.2)


def podium(cx, cy, yaw, w, d, floors, detail=True, upper="wall_white"):
    """2-3 storey street shops (底商) with signboards."""
    gf = 4.5
    obox("Buildings", cx, cy, 0, w, d, gf, yaw, {"*": "wall_white", "s": None, "top": None if floors > 1 else "concrete"})
    n = max(1, int(round(w / 7.0)))
    for k in range(n):
        a, b = -w / 2 + w * k / n, -w / 2 + w * (k + 1) / n
        A = local(cx, cy, yaw, a, -d / 2 - 0.01)
        B = local(cx, cy, yaw, b, -d / 2 - 0.01)
        cidx = R.randrange(12)
        u0, v0 = (cidx % 4) / 4, 1 - (cidx // 4 + 1) / 3
        face("Buildings", "shops", [(A[0], A[1], 0), (B[0], B[1], 0), (B[0], B[1], gf), (A[0], A[1], gf)],
             [(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 1 / 3), (u0, v0 + 1 / 3)], (cx, cy))
    if floors > 1:
        obox("Buildings", cx, cy, gf, w, d, (floors - 1) * 3.2, yaw, {"*": R.choice(["f_white", "f_beige", "wall_white"]), "top": "concrete"}, zuv=gf)
    if detail:
        flat_roof(cx, cy, yaw, w, d, gf + (floors - 1) * 3.2, 0.9)


def courtyard(cx, cy, yaw, w, d, detail=True):
    """Siheyuan-style courtyard house: grey brick wall, tiled halls around a yard, red gate."""
    Cn = "Buildings"
    wall_h = 2.6
    for lx, ly, sx, sy in ((0, -d / 2 + 0.2, w, 0.4), (0, d / 2 - 0.2, w, 0.4), (-w / 2 + 0.2, 0, 0.4, d), (w / 2 - 0.2, 0, 0.4, d)):
        px, py = local(cx, cy, yaw, lx, ly)
        obox(Cn, px, py, 0, sx, sy, wall_h, yaw, {"*": "grey_brick", "top": "roof_tile"})
    # main hall at the back + side halls
    for (lx, ly, sx, sy) in ((0, d / 2 - 3.2, w - 1.2, 5.4), (-w / 2 + 2.6, -0.5, 4.4, d * 0.45), (w / 2 - 2.6, -0.5, 4.4, d * 0.45)):
        if sx < 3 or sy < 3:
            continue
        px, py = local(cx, cy, yaw, lx, ly)
        obox(Cn, px, py, 0, sx, sy, 3.8, yaw, {"*": "grey_brick", "s": "wood_dark"})
        tile_roof(px, py, yaw, sx, sy, 3.8, along_x=sx >= sy)
    if not detail:
        return
    hx, hy = front_dir(yaw)
    gx, gy = local(cx, cy, yaw, 0, -d / 2 - 0.02)
    plate("red", gx, gy, 1.3, hx, hy, 1.8, 2.6, back=None, coll=Cn)
    for lx in (-1.4, 1.4):
        qx, qy = local(cx, cy, yaw, lx, -d / 2 - 0.5)
        blob("Props", "lantern", qx, qy, 2.6, 0.28, 0.28, 0.36, rough=0.02, level=1)
    if R.random() < 0.5:
        tx, ty = local(cx, cy, yaw, R.uniform(-w / 5, w / 5), R.uniform(-d / 6, d / 6))
        plane_tree(tx, ty, 0.0, 0.8)


def tile_roof(cx, cy, yaw, w, d, z, along_x=True, pitch=28, o=0.6, mat="roof_tile"):
    """Gable roof with grey curved tiles, ridge along the longer side."""
    t = math.tan(math.radians(pitch))
    if not along_x:
        yaw += math.pi / 2
        w, d = d, w
    hd = d / 2 + o
    rise = d / 2 * t
    ze = z - o * t
    P = lambda lx, ly, zz: (*local(cx, cy, yaw, lx, ly), zz)  # noqa: E731
    for sgn in (-1, 1):
        q = [P(-w / 2 - o, sgn * hd, ze), P(w / 2 + o, sgn * hd, ze), P(w / 2 + o, 0, z + rise), P(-w / 2 - o, 0, z + rise)]
        if sgn > 0:
            q = [q[1], q[0], q[3], q[2]]
        L = math.dist(q[0][:2], q[1][:2])
        sl = math.hypot(hd, rise + o * t)
        face("Buildings", mat, q, [(0, 0), (L, 0), (L, sl), (0, sl)], (cx, cy))
        face("Buildings", "wood_dark", [(x, y, z - 0.06) for x, y, z in q[::-1]], [(0, 0)] * 4, (cx, cy))
    for sgn in (-1, 1):
        g = [P(sgn * w / 2, -d / 2, z), P(sgn * w / 2, d / 2, z), P(sgn * w / 2, 0, z + rise)]
        if sgn < 0:
            g = [g[1], g[0], g[2]]
        face("Buildings", "grey_brick", g, K.uv_world(g, 2.4), (cx, cy))
    rx, ry = local(cx, cy, yaw, 0, 0)
    obox("Buildings", rx, ry, z + rise - 0.05, w + 2 * o, 0.35, 0.3, yaw, "roof_tile")


def pagoda(x, y):
    """Seven-storey octagonal pagoda with flared eaves."""
    z = 0.0
    obox("Landmark", x, y, 0, 18, 18, 1.2, 0, "stone")
    z = 1.2
    r = 6.0
    for k in range(7):
        h = 4.6 - k * 0.25
        cyl("Landmark", x, y, z, z + h, r, r * 0.97, "wall_white" if k % 2 == 0 else "wall_white", seg=8, cap=False)
        cyl("Landmark", x, y, z + h, z + h + 0.9, r + 2.0, r * 0.75, "roof_tile", seg=8)
        for a in range(8):
            ang = 2 * math.pi * a / 8
            blob("Landmark", "lantern", x + math.cos(ang) * (r + 1.8), y + math.sin(ang) * (r + 1.8), z + h - 0.3, 0.2, 0.2, 0.28, rough=0.02, level=1)
        z += h + 0.9
        r *= 0.88
    cyl("Landmark", x, y, z, z + 5.0, 0.6, 0.05, "gold", seg=8)
    plate("sign_temple", x, y - 9.2, 2.2, 0, 1, 10, 1.25, coll="Landmark")


# ------------------------------------------------------------- special areas
def build_river(river):
    rpoly = river.buffer(RIVER_W / 2, cap_style="flat")
    rpoly = rpoly.intersection(K_world())
    road_and_foot = unary_union([C.geo["road"], C.geo["foot"]])
    bridges = rpoly.intersection(road_and_foot)
    water = rpoly
    K.tri_area("River", "water", water, -3.0)
    # stone embankment walls facing the water
    for pg in K._polys(rpoly):
        cs = list(pg.exterior.coords)
        for a, b in zip(cs, cs[1:]):
            m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if road_and_foot.contains(Point(m)):
                continue
            pts = [(a[0], a[1], -3.2), (b[0], b[1], -3.2), (b[0], b[1], 0.0), (a[0], a[1], 0.0)]
            n = K.normal(pts)
            if not rpoly.buffer(-0.5).contains(Point(m[0] + n[0] * 1.0, m[1] + n[1] * 1.0)):
                pts = [pts[1], pts[0], pts[3], pts[2]]
            face("River", "stone", pts, K.uv_world(pts, 3.0), m)
    # bridge decks: girder sides + parapets along the river crossings
    K.ring_walls("River", bridges, -1.6, 0.0, lambda m: "concrete")
    for r in C.roads:
        inter = r.line.intersection(rpoly)
        for seg in lines_of(inter):
            for sgn in (-1, 1):
                for e in lines_of(seg.offset_curve(sgn * (r.half - 0.3))):
                    K.sweep_box("River", "stone", "stone", list(e.coords), 0.4, FP, FP + 1.1)
    # promenade with willows on both banks
    prom = rpoly.buffer(8.0).difference(rpoly).difference(road_and_foot).intersection(K_world())
    K.tri_area("River", "stone", prom, 0.12)
    K.ring_walls("River", prom, 0.0, 0.12, lambda m: "curb")
    for side in (-1, 1):
        for e in lines_of(river.offset_curve(side * (RIVER_W / 2 + 4.0))):
            s = 6.0
            while s < e.length:
                p = e.interpolate(s)
                if C.in_core(p.x, p.y, 60) and not road_and_foot.buffer(4).contains(p):
                    willow(p.x, p.y, 0.12)
                s += R.uniform(14, 20)
    C.mark_poly(rpoly.buffer(9.0))
    return rpoly


def K_world():
    from shapely.geometry import box as sbox
    return sbox(*WORLD)


def build_expressway():
    """Elevated expressway on piers in the boulevard's green median."""
    r = C.rd["CENTURY"]
    ln = r.line
    zb, zt = 13.4, 15.4
    K.sweep_box("Expressway", "asphalt", "concrete", list(ln.coords), 25.0, zb, zt, mat_bottom="concrete")
    for sgn in (-1, 1):
        for e in lines_of(ln.offset_curve(sgn * 12.3)):
            K.sweep_box("Expressway", "concrete", "concrete", list(e.coords), 0.4, zt, zt + 1.0)
            K.sweep_box("Expressway", "glass_panel", "glass_panel", list(e.coords), 0.08, zt + 1.0, zt + 3.2)
    for e in lines_of(ln.offset_curve(0.0)):
        K.sweep_box("Expressway", "paint_yellow", "paint_yellow", list(e.coords), 0.3, zt, zt + 0.01)
    for o in (-7.0, -3.5, 3.5, 7.0):
        for e in lines_of(ln.offset_curve(o)):
            s = 0.0
            while s < e.length:
                seg = e.interpolate(s), e.interpolate(min(e.length, s + 6.0))
                K.ribbon("Expressway", "paint_white", [seg[0].coords[0], seg[1].coords[0]], 0.15, zt + 0.012)
                s += 15.0
    js = C.juncs_of(r)
    s = 10.0
    while s < ln.length:
        c = ln.interpolate(s)
        if all(math.dist((c.x, c.y), j["pos"]) > j["r"] + 3 for j in js):
            tx, ty = tangent_at(ln, s)
            yaw = math.atan2(ty, tx)
            obox("Expressway", c.x, c.y, 0.2, 2.2, 3.4, zb - 1.6, yaw, "concrete")
            obox("Expressway", c.x, c.y, zb - 1.6, 3.0, 20.0, 1.6, yaw, "concrete", skip=())
        s += 36.0


def build_overpass():
    """Pedestrian overpass (天桥) across Renmin Road just north of the boulevard."""
    r = C.rd["RENMIN"]
    s = r.line.project(Point(170, 70))
    c = r.line.interpolate(s)
    tx, ty = tangent_at(r.line, s)
    yaw = math.atan2(ty, tx) + math.pi / 2           # deck runs across the road
    L = r.cw + 2 * r.sw + 2
    z = 5.8
    obox("Landmark", c.x, c.y, z, L, 4.0, 0.6, yaw, {"*": "metal_light", "top": "sidewalk"}, skip=())
    for sgn in (-1, 1):
        px, py = local(c.x, c.y, yaw, 0, sgn * 1.95)
        obox("Landmark", px, py, z + 0.6, L, 0.1, 1.2, yaw, "glass_panel", skip=())
        qx, qy = local(c.x, c.y, yaw, sgn * (L / 2 - 1.0), 0)
        obox("Landmark", qx, qy, 0.2, 1.0, 1.0, z, yaw, "metal_light")
        # stairs running along the footpath
        sx, sy = c.x + tx * 9 * sgn, c.y + ty * 9 * sgn
        bx, by = local(c.x, c.y, yaw, sgn * (L / 2 - 2.0), 0)
        for k in range(20):
            t = k / 20
            ex, ey = bx + tx * 15 * t * sgn, by + ty * 15 * t * sgn
            obox("Landmark", ex, ey, z * (1 - t) - 0.15, 1.0, 2.6, 0.15, math.atan2(ty, tx), "sidewalk", skip=())
    hx, hy = tx, ty
    plate("mall_band", c.x - hx * 2.1, c.y - hy * 2.1, z + 1.2, hx, hy, 10, 1.8, back=None, coll="Landmark",
          uvs=((0, 0.75), (1, 0.75), (1, 1), (0, 1)))
    C.rmark(c.x, c.y, yaw, L + 4, 30)


def build_hub():
    """Bus hub on Jianshe Road: long platform shelter at the eastbound kerb."""
    st = C.stop_at("JIANSHE", (60, -300), (165, -300), kerb_extra=0.5, ahead=0)
    x, y, hx, hy, kx, ky = st["x"], st["y"], st["hx"], st["hy"], st["kx"], st["ky"]
    yaw = math.atan2(hy, hx)
    obox("Landmark", x, y, 3.2, 30, 3.2, 0.2, yaw, {"*": "metal_light"}, skip=())
    for lx in range(-14, 15, 6):
        px, py = local(x, y, yaw, lx, 1.2)
        cyl("Landmark", px, py, FP, 3.2, 0.08, 0.08, "metal_light", seg=6)
    bx, by = x + kx * 1.4, y + ky * 1.4
    obox("Landmark", bx, by, FP + 0.2, 28, 0.08, 2.6, yaw, "glass_panel")
    plate("sign_hub", x - kx * 1.62, y - ky * 1.62, 3.9, kx, ky, 16, 1.6, coll="Landmark")
    # hub building behind the platform
    gx, gy = x + kx * 22, y + ky * 22
    obox("Landmark", gx, gy, 0, 50, 28, 8.0, yaw, {"*": "glass", "top": "concrete"})
    plate("sign_hub", x + kx * 7.9, y + ky * 7.9, 6.6, kx, ky, 30, 3.0, back=None, coll="Landmark")
    C.rmark(gx, gy, yaw, 52, 30)
    C.rmark(x + kx * 4, y + ky * 4, yaw, 32, 6)
    return st


def bus_stop(name_local, name_en, road, near, toward):
    st = C.stop_at(road, near, toward, kerb_extra=0.55)
    x, y, hx, hy, kx, ky = st["x"], st["y"], st["hx"], st["hy"], st["kx"], st["ky"]
    yaw = math.atan2(hy, hx)
    obox("Props", x, y, 2.7, 9.0, 2.0, 0.15, yaw, "metal_light", skip=())
    for lx in (-4.3, 4.3):
        for ly in (-0.9, 0.9):
            px, py = local(x, y, yaw, lx, ly)
            cyl("Props", px, py, FP, 2.7, 0.05, 0.05, "metal_light", seg=6)
    bx, by = x + kx * 0.95, y + ky * 0.95
    obox("Props", bx, by, FP + 0.3, 8.6, 0.06, 2.2, yaw, "glass_panel")
    plate("sign_busstop", x - kx * 1.02, y - ky * 1.02, 3.3, kx, ky, 3.6, 1.35)
    lo = st["road"].lane_offset()
    C.decal("paint_buslane", st["lane"][0] - hx * 16, st["lane"][1] - hy * 16, hx, hy, 6.0, 2.6)
    shared_bikes(x + hx * 9, y + hy * 9, yaw, 6)
    KEEP.append((x, y, 9.0))
    return dict(name_local=name_local, name_en=name_en, shelter=[round(x, 2), round(y, 2)],
                stop_point=[round(st["stop"][0], 2), round(st["stop"][1], 2)], heading=[round(hx, 3), round(hy, 3)])


KEEP = []


# ------------------------------------------------------------- street props
def street_props():
    for r in C.roads:
        if r.cls == "lane":
            continue
        for pc in C.pieces(r, 7.0):
            if not C.in_core(*pc.interpolate(0.5, normalized=True).coords[0], 40):
                continue
            for side in (1, -1):
                s = R.uniform(4, 10)
                while s < pc.length - 4:
                    c = pc.interpolate(s)
                    tx, ty = tangent_at(pc, s)
                    nx, ny = -ty * side, tx * side
                    x, y = c.x + nx * (r.cw / 2 + 1.2), c.y + ny * (r.cw / 2 + 1.2)
                    if all(math.dist((x, y), cw) > 5 for cw in C.crosswalks) and all(math.dist((x, y), k[:2]) > k[2] for k in KEEP):
                        plane_tree(x, y, FP, 0.9 if r.cls == "street" else 1.05)
                    s += 9.0 if r.cls != "street" else 11.0
                # double-arm street lamps
                s = 15.0
                while s < pc.length - 5 and r.cls in ("avenue", "boulevard"):
                    c = pc.interpolate(s)
                    tx, ty = tangent_at(pc, s)
                    nx, ny = -ty * side, tx * side
                    x, y = c.x + nx * (r.cw / 2 + 0.5), c.y + ny * (r.cw / 2 + 0.5)
                    cyl("Props", x, y, FP, 10.0, 0.12, 0.08, "metal_light", seg=8)
                    for k in (-1, 1):
                        ex, ey = x - nx * 1.8 * (k > 0) + tx * 0.8 * k, y - ny * 1.8 * (k > 0) + ty * 0.8 * k
                        tube("Props", (x, y, 9.6), (ex, ey, 9.9), 0.05, "metal_light")
                        obox("Props", ex, ey, 9.75, 0.7, 0.3, 0.15, math.atan2(ty, tx), {"*": "metal_light", "bottom": "lamp_white"}, skip=())
                    s += 35.0
            # avenue median fence (white & blue panels)
            if r.cls == "avenue":
                s = 0.0
                L = pc.length
                while s < L - 3:
                    a, b = pc.interpolate(s), pc.interpolate(min(L, s + 3.0))
                    yaw = math.atan2(b.y - a.y, b.x - a.x)
                    m = ((a.x + b.x) / 2, (a.y + b.y) / 2)
                    if C.geo["median"].contains(Point(m)):
                        obox("Props", m[0], m[1], 0.2, 3.0, 0.06, 0.9, yaw, "fence_white", skip=())
                        obox("Props", m[0], m[1], 1.1, 3.0, 0.08, 0.12, yaw, "fence_blue", skip=())
                    s += 3.0
        # boulevard median: double row of trees under the expressway edges
        if r.cls == "boulevard":
            for pc in C.pieces(r, 9.0):
                for o in (-3.0, 3.0):
                    for e in lines_of(pc.offset_curve(o)):
                        s = 6.0
                        while s < e.length:
                            p = e.interpolate(s)
                            if C.in_core(p.x, p.y, 40):
                                blob("Vegetation", "leaves", p.x, p.y, 0.9, 1.0, 1.0, 0.7, rough=0.15, level=1)
                            s += 4.0


def signals():
    for j, x, y, hx, hy, r in C.signal_poles:
        kx, ky = C.kerb_vec(hx, hy)
        cyl("Props", x, y, FP, 6.8, 0.15, 0.12, "metal_light", seg=8)
        arm = r.cw / 2 * 0.75
        ex, ey = x - kx * arm, y - ky * arm
        tube("Props", (x, y, 6.4), (ex, ey, 6.4), 0.09, "metal_light", seg=6)
        green = abs(hx) > abs(hy)
        for k in range(min(3, r.p["lanes"])):
            px, py = x - kx * (2.0 + k * r.p["lane_w"]), y - ky * (2.0 + k * r.p["lane_w"])
            if math.dist((px, py), (x, y)) > arm:
                break
            obox("Props", px, py, 5.7, 1.2, 0.3, 0.42, math.atan2(ky, kx), "metal_dark", skip=())
            for m, off in (("lamp_red" if not green else "lamp_off", -0.4), ("lamp_off", 0.0), ("lamp_green" if green else "lamp_off", 0.4)):
                lx_, ly_ = px + kx * off * -1, py + ky * off * -1
                tube("Props", (lx_ - hx * 0.16, ly_ - hy * 0.16, 5.91), (lx_ - hx * 0.21, ly_ - hy * 0.21, 5.91), 0.13, m, seg=10, cap=True)
        obox("Props", x - hx * 0.25, y - hy * 0.25, 3.0, 0.5, 0.25, 0.4, math.atan2(hy, hx), "lamp_red" if not green else "lamp_green", skip=())
        KEEP.append((x, y, 3.0))


# ----------------------------------------------------------------- lots
def pick(r, x, y):
    if in_old_town(x, y):
        return dict(kind="court", w=R.uniform(12, 18), d=R.uniform(14, 18), setback=0.3, gap=0.4, tight=True)
    near = math.dist((x, y), (0, 0))
    if r.cls == "boulevard":
        if near < 320:
            return dict(kind=R.choice(["office", "office", "mall"]), w=R.uniform(36, 60), d=R.uniform(32, 46), setback=R.uniform(6, 12), gap=R.uniform(10, 20))
        return dict(kind="podium", floors=R.randint(3, 4), w=R.uniform(20, 40), d=R.uniform(16, 20), setback=2.0, gap=R.uniform(4, 10))
    if r.cls == "avenue":
        if near < 260 and R.random() < 0.4:
            return dict(kind="office", w=R.uniform(30, 44), d=R.uniform(28, 36), setback=8.0, gap=12.0)
        return dict(kind="podium", floors=R.randint(2, 4), w=R.uniform(18, 36), d=R.uniform(14, 18), setback=1.5, gap=R.uniform(3, 8))
    if r.cls == "street":
        return dict(kind="podium", floors=R.randint(2, 3), w=R.uniform(16, 30), d=R.uniform(12, 15), setback=1.0, gap=R.uniform(4, 12))
    return dict(kind="court", w=R.uniform(12, 18), d=R.uniform(14, 18), setback=0.3, gap=0.4, tight=True)


def build_lot(L):
    k = L["kind"]
    a = (L["cx"], L["cy"], L["yaw"], L["w"], L["d"])
    if k == "office":
        office(*a, R.randint(14, 32), L["detail"])
    elif k == "mall":
        mall(*a, L["detail"])
    elif k == "podium":
        podium(*a, L.get("floors", 2), L["detail"])
    elif k == "court":
        courtyard(*a, L["detail"])
    if L["detail"] and k == "podium" and R.random() < 0.3:
        hx, hy = front_dir(L["yaw"])
        px, py = local(L["cx"], L["cy"], L["yaw"], R.uniform(-L["w"] / 3, L["w"] / 3), -L["d"] / 2 - 1.2)
        shared_bikes(px, py, L["yaw"], R.randint(3, 8))


def build_tower(L):
    floors = R.randint(18, 32) if math.dist((L["cx"], L["cy"]), (0, 0)) < 600 else R.randint(11, 18)
    highrise(L["cx"], L["cy"], L["yaw"], L["w"], L["d"], floors, detail=L["detail"])
    # parking & greenery between towers (south side = sunlit garden)
    if L["detail"] and R.random() < 0.5:
        px, py = L["cx"] + R.uniform(-L["w"] / 2, L["w"] / 2), L["cy"] - L["d"] / 2 - R.uniform(6, 12)
        plane_tree(px, py, 0.0, 0.9)
    if L["detail"] and R.random() < 0.4:
        for k in range(R.randint(2, 6)):
            car(L["cx"] - L["w"] / 2 + 3 + k * 2.6, L["cy"] + L["d"] / 2 + 3.5, math.pi / 2)


# ----------------------------------------------------------------- main
def cameras():
    cams = [
        K.add_camera("Cam_Aerial", (-420, -460, 330), (0, 60, 0), 30),
        C.lane_cam("Cam_Century_Expressway", "CENTURY", (120, 3), (-100, 10), look=100),
        C.lane_cam("Cam_Renmin_Overpass", "RENMIN", (171, 25), (172, 160), look=110, h=3.0),
        C.lane_cam("Cam_River_Bridge", "JINHE", (-238, 330), (-245, 450), look=120, h=3.0),
        C.lane_cam("Cam_Hutong", "H1", (-460, 586), (-330, 590), look=40, h=1.8, lens=22, look_h=2.4),
        C.lane_cam("Cam_Compound_Street", "CHUNJIANG", (-150, 166), (172, 160), look=90),
        K.add_camera("Cam_Pagoda", (60, 392, 2.5), (5, 450, 16), 24),
        K.add_camera("Cam_TopDown", (0, 20, 900), (0, 20.001, 0), 50, ortho=1100),
    ]
    bpy.context.scene.camera = cams[0]


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = K.build_materials()
    river = define_roads()
    C.build_network(signal_rule)
    print("roads", len(C.roads), "junctions", len(C.juncs), flush=True)

    def footpath_uv(pts):
        return [(p[0] / 3.0, p[1] / 3.0) for p in pts]
    C.build_surfaces(asphalt="asphalt", footpath="sidewalk", kerb_road="curb", kerb_back="curb", median_top="grass",
                     median_kerb="curb", median_h=0.25, footpath_uv=footpath_uv)
    styles = {
        "boulevard": dict(edge=True, divider=(6.0, 9.0)),
        "avenue": dict(edge=True, divider=(6.0, 9.0)),
        "street": dict(edge=True, center="yellow_double"),
    }
    C.build_markings(styles, crosswalk="zebra")
    # painted non-motorised (bike) lanes along avenues & streets
    for r in C.roads:
        if r.cls in ("avenue", "street"):
            for pc in C.pieces(r, 6.5):
                if not C.in_core(*pc.interpolate(0.5, normalized=True).coords[0], 60):
                    continue
                for sgn in (-1, 1):
                    for e in lines_of(pc.offset_curve(sgn * (r.cw / 2 - r.p["shoulder"] / 2 - 0.1))):
                        C.paint(list(e.coords), r.p["shoulder"] - 0.35, "paint_bike", z=0.011)
    rpoly = build_river(river)
    build_expressway()
    build_overpass()
    # riverside park with the pagoda, north of Binjiang North Road
    from shapely.geometry import box as sbox
    park = sbox(-45, 410, 55, 480)
    C.mark_poly(park, building=True)
    K.tri_area("Landmark", "grass", park, 0.05)
    K.tri_area("Landmark", "stone", sbox(-3, 410, 3, 425), 0.07)
    pagoda(5.0, 450.0)
    for _ in range(14):
        x, y = R.uniform(-40, 50), R.uniform(414, 476)
        if math.dist((x, y), (5, 450)) > 15:
            (willow if R.random() < 0.4 else plane_tree)(x, y, 0.05, 0.9)
    hub = build_hub()
    stops = [dict(name_local="金河新区公交枢纽", name_en="Jinhe Bus Hub", stop_point=[round(hub["stop"][0], 2), round(hub["stop"][1], 2)],
                  heading=[round(hub["hx"], 3), round(hub["hy"], 3)])]
    stops.append(bus_stop("人民路南", "Renmin Road South", "RENMIN", (166, -170), (172, 160)))
    stops.append(bus_stop("世纪大道", "Century Avenue", "CENTURY", (60, 5), (-400, -20)))
    stops.append(bus_stop("金河路", "Jinhe Road", "JINHE", (-238, -160), (-245, -300)))
    signals()
    for rank in (5, 4, 3, 1):
        for r in C.roads:
            if r.rank == rank:
                C.frontage(r, pick, build_lot)
    C.fill_interiors([(16.0, 16.0), (12.0, 14.0)], lambda L: courtyard(L["cx"], L["cy"], L["yaw"], L["w"], L["d"], L["detail"]),
                     step=4.0, pad=0.6, where=in_old_town)
    C.fill_interiors([(46.0, 15.0), (34.0, 15.0), (22.0, 15.0)], build_tower, step=5.0, pad=9.0, orient="south",
                     where=lambda x, y: not in_old_town(x, y))
    street_props()
    NC.ground(WORLD, "ground", "far_ground", hole=rpoly)
    bus_model(hub["stop"][0] - hub["hx"] * 3, hub["stop"][1] - hub["hy"] * 3, math.atan2(hub["hy"], hub["hx"]))
    print("faces:", K.STATS["faces"], flush=True)
    K.flush(mats, collision={"Roads", "Footpaths", "Buildings", "Landmark", "Expressway", "River", "Terrain", "Islands"},
            surfaces={"Roads": "asphalt", "Footpaths": "kerb", "Terrain": "ground"})
    # bus route: hub -> Renmin north -> Century west (under the expressway) -> Jinhe south -> Jianshe east
    j = lambda a, b: C.junction(a, b)  # noqa: E731
    tr = lambda jj: jj["r"] + 3.0      # noqa: E731
    J1, J2, J3, J4 = j("JIANSHE", "RENMIN"), j("RENMIN", "CENTURY"), j("CENTURY", "JINHE"), j("JINHE", "JIANSHE")
    legs = [
        C.lane_leg("JIANSHE", hub["stop"], J1["pos"], 0, tr(J1)),
        C.lane_leg("RENMIN", J1["pos"], J2["pos"], tr(J1), tr(J2)),
        C.lane_leg("CENTURY", J2["pos"], J3["pos"], tr(J2), tr(J3)),
        C.lane_leg("JINHE", J3["pos"], J4["pos"], tr(J3), tr(J4)),
        C.lane_leg("JIANSHE", J4["pos"], hub["stop"], tr(J4), 0),
    ]
    path = C.join(legs)
    data = C.write_json(os.path.join(OUT, MAP + "_route.json"),
                        dict(map=MAP, country="China", city="Jinhe New District (fictional, inspired by new districts of Chinese cities)",
                             route=dict(number="K8", name_local="金河新区环线", name_en="Jinhe Loop")),
                        path, stops, dict(position=[*hub["stop"], 0.0], heading_deg_from_east=round(math.degrees(math.atan2(hub["hy"], hub["hx"])), 1),
                                          note="Bus hub platform on Jianshe Road; doors (right side) face the platform"))
    NC.route_curve(bpy, path, "BusRoute_K8")
    K.setup_world(sun_elev=42, sun_az=150, sun_energy=4.0, sky_strength=0.35, dust=3.0)
    cameras()
    if not _arg("--no-glb"):
        K.export_glb(os.path.join(OUT, MAP + ".glb"), {"Roads", "Footpaths", "Markings", "Buildings", "Landmark", "Expressway", "River",
                                                        "Terrain", "Vegetation", "Props", "Vehicles", "Islands", "Backdrop"})
    K.save_blend(os.path.join(OUT, MAP + ".blend"))
    print("saved; route", data["route"]["length_m"], "m;", len(data["stops"]), "stops", flush=True)
    if _arg("--render"):
        K.render_previews(os.path.join(OUT, "previews"), int(_arg("--samples", 40)), _arg("--only"))


if __name__ == "__main__":
    main()
