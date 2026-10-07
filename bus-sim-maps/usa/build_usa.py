"""Palm Valley - a Southern-California-style suburb for NammaBusSim, built in Blender.

    blender -b -P build_usa.py -- [--out DIR] [--render] [--samples 40] [--no-glb] [--only Mission]

Right-hand traffic. A 6-lane "stroad" with a two-way left-turn lane and bike
lanes, a palm-lined median boulevard, an elevated freeway with a diamond
interchange (curved ramps down to signalised ramp terminals), strip mall,
big-box store with a huge parking lot, gas station, drive-thru, motel,
garden apartments, warehouses, and curvy suburbs of stucco houses with clay
tile roofs, two-car garages and tall Washingtonia palms - with mountains on
the northern horizon. Needs shapely (see ../india/README.md).
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from shapely.geometry import LineString, Point, Polygon, box as sbox
from shapely.ops import unary_union


def _find_dir():
    cands = [os.path.dirname(os.path.abspath(__file__))] if "__file__" in globals() else []
    cands += [os.path.dirname(bpy.path.abspath(t.filepath)) for t in bpy.data.texts if t.filepath]
    cands += [os.environ.get("NBS_USA_DIR", ""), os.getcwd()]
    for c in cands:
        if c and os.path.isfile(os.path.join(c, "build_usa.py")) and os.path.isdir(os.path.join(c, "textures")):
            return c
    raise RuntimeError("Can't find the usa map folder; set NBS_USA_DIR")


HERE = _find_dir()
sys.path.insert(0, os.path.join(HERE, "..", "common"))
import nbs_kit as K  # noqa: E402
import nbs_city as NC  # noqa: E402
from nbs_kit import face, obox, cyl, tube, blob, crown, local, srgb  # noqa: E402
from nbs_city import tangent_at, lines_of, plate  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def _arg(name, default=None):
    if name in ARGS:
        i = ARGS.index(name)
        return ARGS[i + 1] if i + 1 < len(ARGS) and not ARGS[i + 1].startswith("--") else True
    return default


OUT = os.path.abspath(_arg("--out", os.path.join(HERE, "out")))
SEED = int(_arg("--seed", 1776))
R = random.Random(SEED)
MAP = "usa_palm_valley"
WORLD = (-720.0, -660.0, 720.0, 660.0)
CORE = (-480.0, -420.0, 480.0, 440.0)
FP = 0.15

MATS = {
    "asphalt": dict(img="asphalt.jpg", T=6.0, rough=0.85, bump=0.2),
    "parking": dict(img="parking.jpg", T=8.0, rough=0.85),
    "sidewalk": dict(img="sidewalk.jpg", T=3.0, rough=0.8),
    "curb": dict(img="curb.jpg", T=2.0, rough=0.75),
    "lawn": dict(img="lawn.jpg", T=4.0, rough=0.95),
    "dry_grass": dict(img="dry_grass.jpg", T=6.0, rough=1.0),
    "mulch": dict(img="mulch.jpg", T=3.0, rough=1.0),
    "concrete": dict(img="concrete.jpg", T=6.0, rough=0.85),
    "wall_plain": dict(img="wall_plain.jpg", T=8.0, rough=0.85),
    "bark": dict(img="bark.jpg", T=1.0, rough=0.9),
    "leaves": dict(img="leaves.jpg", T=1.6, rough=0.9),
    "palm_leaves": dict(img="palm_leaves.jpg", T=1.2, rough=0.9),
    "f_beige": dict(img="facade_stucco_beige.jpg", tw=9.0, th=3.2, rough=0.8),
    "f_white": dict(img="facade_stucco_white.jpg", tw=9.0, th=3.2, rough=0.8),
    "f_peach": dict(img="facade_stucco_peach.jpg", tw=9.0, th=3.2, rough=0.8),
    "f_sage": dict(img="facade_stucco_sage.jpg", tw=9.0, th=3.2, rough=0.8),
    "f_apartment": dict(img="facade_apartment.jpg", tw=9.0, th=6.4, rough=0.8),
    "roof_tile": dict(img="roof_tile.jpg", T=1.0, rough=0.6, bump=0.4),
    "shingles": dict(img="shingles.jpg", T=2.0, rough=0.8, bump=0.3),
    "strip": dict(img="strip_atlas.jpg", rough=0.4),
    "big_signs": dict(img="big_signs.jpg", rough=0.4, emit_tex=0.5),
    "sign_speed": dict(img="sign_speed.jpg", rough=0.4),
    "sign_stop": dict(img="sign_stop.png", alpha=True, rough=0.4),
    "sign_street": dict(img="sign_street.jpg", rough=0.4),
    "sign_freeway": dict(img="sign_freeway.jpg", rough=0.4),
    "sign_busstop": dict(img="sign_busstop.jpg", rough=0.4),
    "bench_ad": dict(img="bench_ad.jpg", rough=0.5),
    "mountain": dict(color=srgb(132, 136, 150), rough=1.0),
    "bus_side": dict(img="bus_side.jpg", rough=0.3),
    "paint_white": dict(color=srgb(238, 238, 232), rough=0.6),
    "paint_yellow": dict(color=srgb(240, 190, 20), rough=0.6),
    "paint_bike": dict(color=srgb(60, 150, 80), rough=0.7),
    "metal_light": dict(color=srgb(190, 192, 192), rough=0.4, metal=0.5),
    "metal_dark": dict(color=srgb(60, 62, 66), rough=0.45, metal=0.6),
    "signal_yellow": dict(color=srgb(230, 180, 20), rough=0.4),
    "glass": dict(color=srgb(70, 90, 100), rough=0.05, metal=0.4),
    "white": dict(color=srgb(242, 240, 236), rough=0.5),
    "garage": dict(color=srgb(240, 238, 232), rough=0.5),
    "red": dict(color=srgb(190, 30, 30), rough=0.5),
    "blue": dict(color=srgb(30, 70, 150), rough=0.5),
    "wire": dict(color=srgb(18, 18, 18), rough=0.6),
    "rubber": dict(color=srgb(22, 22, 22), rough=0.9),
    "lamp_red": dict(color=srgb(230, 20, 20), emit=srgb(255, 30, 20), emit_s=10.0),
    "lamp_green": dict(color=srgb(20, 220, 80), emit=srgb(40, 255, 120), emit_s=10.0),
    "lamp_off": dict(color=srgb(36, 36, 36), rough=0.2),
    "lamp_white": dict(color=srgb(250, 250, 240), emit=srgb(255, 250, 235), emit_s=2.0),
    "car_white": dict(color=srgb(232, 232, 230), rough=0.25, metal=0.2),
    "car_black": dict(color=srgb(18, 18, 20), rough=0.2, metal=0.3),
    "car_silver": dict(color=srgb(170, 172, 176), rough=0.25, metal=0.7),
    "car_red": dict(color=srgb(160, 30, 30), rough=0.25, metal=0.3),
    "car_blue": dict(color=srgb(40, 70, 130), rough=0.25, metal=0.3),
    "far_ground": dict(color=srgb(150, 136, 100), rough=1.0),
}
K.configure(WORLD, MATS, os.path.join(HERE, "textures"), seed=SEED)

CLASSES = {
    "stroad": dict(lanes=3, lane_w=3.6, median=4.2, painted=True, shoulder=1.6, sw=2.6, rank=4, speed=40),
    "boulevard": dict(lanes=2, lane_w=3.6, median=6.0, shoulder=1.6, sw=2.6, rank=4, speed=40),
    "arterial": dict(lanes=2, lane_w=3.6, median=0.0, shoulder=0.6, sw=2.2, rank=3, speed=35),
    "ramp": dict(lanes=1, lane_w=4.2, median=0.0, shoulder=0.6, sw=0.0, rank=3, speed=35),
    "local": dict(lanes=1, lane_w=4.4, median=0.0, shoulder=0.0, sw=1.5, rank=2, speed=25),
}
C = NC.City(WORLD, CORE, CLASSES, drive="right", fp_h=FP)
BULBS = [(170.0, 140.0), (350.0, 110.0)]
FWY = [(-720, -290), (-300, -284), (0, -280), (300, -276), (720, -270)]
FWY_Z = 8.0


def define_roads():
    C.road("MISSION", "stroad", [(-20, -660), (-10, -300), (0, 0), (-10, 300), (-25, 660)], name_en="Mission Blvd")
    C.road("PALM", "boulevard", [(-720, 60), (-300, 50), (0, 58), (300, 42), (720, 50)], name_en="Palm Canyon Dr")
    C.road("FOOTHILL", "stroad", [(-720, 380), (0, 392), (720, 372)], name_en="Foothill Blvd")
    C.road("VALLEY", "arterial", [(-720, -120), (0, -112), (720, -126)], name_en="Valley Rd")
    C.road("EAST", "arterial", [(420, -660), (410, 0), (425, 660)], name_en="East Ave")
    C.road("WEST", "arterial", [(-420, -660), (-412, 0), (-425, 660)], name_en="West Ave")
    C.road("RAMP_S", "ramp", [(-120, -314), (0, -312), (120, -310)], name_en="Valley Fwy ramps (south)")
    C.road("RAMP_N", "ramp", [(-120, -250), (0, -248), (120, -246)], name_en="Valley Fwy ramps (north)")
    C.road("SOUTH", "arterial", [(-720, -520), (0, -515), (720, -525)], name_en="Industrial Way")
    # suburbs north of Palm Canyon
    C.road("VISTA", "local", [(-6, 180), (80, 190), (160, 240), (260, 230), (330, 180), (412, 175)], start_on="MISSION", end_on="EAST", name_en="Vista Dr")
    C.road("SUNSET", "local", [(80, 389), (100, 320), (180, 300), (240, 330), (260, 384)], start_on="FOOTHILL", end_on="FOOTHILL", name_en="Sunset Dr")
    C.road("CANYON_CT", "local", [(160, 240), (165, 190), (170, 140)], start_on="VISTA", name_en="Canyon Ct")
    C.road("MESA_CT", "local", [(330, 180), (340, 145), (350, 110)], start_on="VISTA", name_en="Mesa Ct")
    C.road("ROSE", "local", [(180, 300), (175, 270), (165, 240)], start_on="SUNSET", end_on="VISTA", name_en="Rose Ln")


def tract_grid():
    """1950s tract grid north-west of Mission & Palm Canyon."""
    C.grid_in_region(["MISSION", "PALM", "WEST", "FOOTHILL"], (-200, 220), (-210, 220), 3.0, [-110, -40, 30, 100],
                     [-150, -75, 0, 75, 150], "local", "local", wiggle=2.0, min_len=40, prefix="T",
                     names=lambda nm, ax, k: dict(name_en=(["Oak St", "Elm St", "Pine St", "Cedar St"][k] if ax == "a" else f"{k + 1}th Ave")))


def signal_rule(j, rs):
    ranks = sorted((r.rank for r in rs), reverse=True)
    return len(ranks) >= 2 and ranks[1] >= 3


def stop_rule(j, r):
    if j["signal"]:
        return True
    others = [C.rd[n].rank for n in j["roads"] if n != r.name]
    return r.cls == "local" and others and max(others) >= r.rank


# ------------------------------------------------------------- vegetation
def washingtonia(x, y, z=0.0, s=1.0):
    """Tall skinny fan palm - the LA skyline palm."""
    s *= R.uniform(0.85, 1.2)
    h = 17.0 * s
    cyl("Vegetation", x, y, z, z + h, 0.32, 0.22, "bark", seg=7, cap=False)
    blob("Vegetation", "palm_leaves", x, y, z + h + 0.6, 1.8, 1.8, 1.3, rough=0.25, level=1)
    blob("Vegetation", "bark", x, y, z + h - 0.9, 0.7, 0.7, 1.1, rough=0.1, level=1)


def date_palm(x, y, z=0.0, s=1.0):
    s *= R.uniform(0.85, 1.15)
    h = 6.0 * s
    cyl("Vegetation", x, y, z, z + h, 0.5, 0.42, "bark", seg=8, cap=False)
    for k in range(9):
        a = 2 * math.pi * k / 9
        blob("Vegetation", "palm_leaves", x + math.cos(a) * 2.2 * s, y + math.sin(a) * 2.2 * s, z + h + 0.3, 2.0 * s, 2.0 * s, 0.5 * s, rough=0.2, level=1)


def shade_tree(x, y, z=0.0, s=1.0):
    s *= R.uniform(0.8, 1.15)
    cyl("Vegetation", x, y, z, z + 2.6 * s, 0.22 * s, 0.16 * s, "bark", seg=7, cap=False)
    crown("Vegetation", "leaves", x, y, z + 4.8 * s, 3.2 * s, 3.2 * s, 2.4 * s, 7)


def car(x, y, yaw, color=None, z=0.0, truck=False):
    color = color or R.choice(["car_white"] * 3 + ["car_black"] * 2 + ["car_silver"] * 3 + ["car_red", "car_blue"])
    L = 5.6 if truck else 4.8
    obox("Vehicles", x, y, z + 0.35, L, 1.95, 0.85, yaw, color)
    px, py = x + math.cos(yaw) * (0.6 if truck else -0.2), y + math.sin(yaw) * (0.6 if truck else -0.2)
    obox("Vehicles", px, py, z + 1.2, 2.0 if truck else 2.6, 1.8, 0.65, yaw, {"*": "glass", "top": color})
    for lx in (L / 2 - 1.0, -L / 2 + 1.0):
        for ly in (0.92, -0.92):
            qx, qy = local(x, y, yaw, lx, ly)
            ox, oy = -math.sin(yaw) * 0.12, math.cos(yaw) * 0.12
            tube("Vehicles", (qx - ox, qy - oy, z + 0.38), (qx + ox, qy + oy, z + 0.38), 0.38, "rubber", seg=8, cap=True)


def bus(x, y, yaw, coll="ReferenceBus"):
    L, W, H = 12.2, 2.6, 3.3
    c, s = math.cos(yaw), math.sin(yaw)

    def uv(fk, pts, m):
        if m != "bus_side":
            return None
        return [((((p[0] - x) * c + (p[1] - y) * s) + L / 2) / L * (1 if fk == "s" else -1) + (0 if fk == "s" else 1),
                 (0.5 if fk == "s" else 0.0) + (p[2] - 0.35) / (H - 0.35) * 0.5) for p in pts]
    obox(coll, x, y, 0.35, L, W, H - 0.35, yaw, {"n": "bus_side", "s": "bus_side", "*": "white", "top": "metal_light"}, uv=uv)
    for lx in (L / 2 - 2.5, -L / 2 + 2.8):
        for ly in (W / 2 - 0.1, -W / 2 + 0.1):
            px, py = local(x, y, yaw, lx, ly)
            tube(coll, (px + s * 0.15, py - c * 0.15, 0.5), (px - s * 0.15, py + c * 0.15, 0.5), 0.5, "rubber", seg=10, cap=True)


# -------------------------------------------------------------- buildings
def front_dir(yaw):
    return -math.sin(yaw), math.cos(yaw)


def hip_roof(cx, cy, yaw, w, d, z, pitch, o, mat):
    t = math.tan(math.radians(pitch))
    ew, ed = w / 2 + o, d / 2 + o
    ze = z - o * t
    P = lambda lx, ly, zz: (*local(cx, cy, yaw, lx, ly), zz)  # noqa: E731
    if ew >= ed:
        hs = ed
        zr = ze + hs * t
        faces = [[P(-ew, -ed, ze), P(ew, -ed, ze), P(ew - hs, 0, zr), P(-ew + hs, 0, zr)],
                 [P(ew, ed, ze), P(-ew, ed, ze), P(-ew + hs, 0, zr), P(ew - hs, 0, zr)],
                 [P(ew, -ed, ze), P(ew, ed, ze), P(ew - hs, 0, zr)], [P(-ew, ed, ze), P(-ew, -ed, ze), P(-ew + hs, 0, zr)]]
    else:
        hs = ew
        zr = ze + hs * t
        faces = [[P(ew, -ed, ze), P(ew, ed, ze), P(0, ed - hs, zr), P(0, -ed + hs, zr)],
                 [P(-ew, ed, ze), P(-ew, -ed, ze), P(0, -ed + hs, zr), P(0, ed - hs, zr)],
                 [P(ew, ed, ze), P(-ew, ed, ze), P(0, ed - hs, zr)], [P(-ew, -ed, ze), P(ew, -ed, ze), P(0, -ed + hs, zr)]]
    for f in faces:
        p0, p1 = np.array(f[0]), np.array(f[1])
        e = (p1 - p0) / np.linalg.norm(p1 - p0)
        n = np.array(K.normal(f))
        sv = np.cross(n, e)
        T = MATS[mat]["T"]
        face("Buildings", mat, f, [(float(np.dot(np.array(p) - p0, e)) / T, float(np.dot(np.array(p) - p0, sv)) / T) for p in f], (cx, cy))
        face("Buildings", "white", [(a, b, c_ - 0.06) for a, b, c_ in f[::-1]], [(0, 0)] * len(f), (cx, cy))


def house(cx, cy, yaw, w, d, detail=True, lite=False):
    """Ranch or two-storey stucco house with clay-tile roof, 2-car garage, driveway, lawn, palms."""
    mat = R.choice(["f_beige", "f_white", "f_peach", "f_sage"])
    floors = 1 if R.random() < 0.65 else 2
    roof = "roof_tile" if R.random() < 0.7 else "shingles"
    setback = min(7.5, d * 0.35)
    hw, hd = w - 1.6, d - setback - 2.0
    bx, by = local(cx, cy, yaw, 0, -d / 2 + setback + hd / 2)
    H = 3.2 * floors
    obox("Buildings", bx, by, 0, hw, hd, H, yaw, {"*": mat, "top": None}, zuv=0.0, u0=R.choice([0, 0.5]))
    hip_roof(bx, by, yaw, hw, hd, H, R.uniform(18, 24), 0.6, roof)
    if lite:
        return
    gl = (hw / 2 - 3.3) * (1 if R.random() < 0.5 else -1)
    hxv, hyv = front_dir(yaw)
    gx, gy = local(bx, by, yaw, gl, -hd / 2 - 0.02)
    plate("garage", gx, gy, 1.2, -hxv, -hyv, 5.0, 2.4, back=None, coll="Buildings")
    pts = [local(bx, by, yaw, gl + a, b) for a, b in ((-2.8, -hd / 2 - setback - 3.0), (2.8, -hd / 2 - setback - 3.0), (2.8, -hd / 2), (-2.8, -hd / 2))]
    K.tri_area("Lots", "concrete", Polygon(pts), 0.03)
    if R.random() < 0.7:
        dx, dy = local(bx, by, yaw, gl + R.choice([-1.4, 1.4]), -hd / 2 - setback * 0.5)
        car(dx, dy, yaw + math.pi / 2, truck=R.random() < 0.3)
    if R.random() < 0.55:
        tx, ty = local(cx, cy, yaw, -gl * 0.9, -d / 2 + setback * 0.4)
        (washingtonia if R.random() < 0.5 else (date_palm if R.random() < 0.5 else shade_tree))(tx, ty)


def strip_mall(x0, y0, x1, y1, front="w"):
    """L-shaped strip centre facing a parking lot, with a pylon sign."""
    lot = sbox(x0, y0, x1, y1)
    C.mark_poly(lot, building=True)
    K.tri_area("Lots", "parking", lot, 0.03)
    # building along the east side (front faces west) and north side (front faces south)
    units = []
    bx0 = x1 - 18
    obox("Buildings", (bx0 + x1) / 2, (y0 + y1) / 2, 0, 18, y1 - y0 - 4, 5.5, 0, {"*": "wall_plain", "w": None, "top": "concrete"})
    n = int((y1 - y0 - 4) // 9)
    for k in range(n):
        a, b = y0 + 2 + k * 9, y0 + 2 + (k + 1) * 9
        c = R.randrange(12)
        u0, v0 = (c % 4) / 4, 1 - (c // 4 + 1) / 3
        face("Buildings", "strip", [(bx0 - 0.01, b, 0), (bx0 - 0.01, a, 0), (bx0 - 0.01, a, 5.0), (bx0 - 0.01, b, 5.0)],
             [(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 1 / 3), (u0, v0 + 1 / 3)])
    obox("Buildings", bx0 - 1.5, (y0 + y1) / 2, 4.6, 3.0, y1 - y0 - 4, 0.3, 0, "wall_plain", skip=())
    for yy in np.arange(y0 + 4, y1 - 3, 9.0):
        cyl("Buildings", bx0 - 2.8, yy, 0, 4.6, 0.2, 0.2, "wall_plain", seg=8)
    # parking stalls in rows facing the shops
    for col in np.arange(x0 + 6, bx0 - 12, 17.0):
        for yy in np.arange(y0 + 3, y1 - 3, 2.8):
            face("Markings", "paint_white", [(col, yy, 0.04), (col + 5.5, yy, 0.04), (col + 5.5, yy + 0.12, 0.04), (col, yy + 0.12, 0.04)], [(0, 0)] * 4)
            if R.random() < 0.45:
                car(col + 2.8, yy + 1.4, 0.0, z=0.03)
    # pylon sign at the street corner
    px, py = x0 + 3, y0 + 3
    obox("Props", px, py, 0, 1.2, 1.2, 9.0, 0, "wall_plain")
    plate("big_signs", px, py, 7.5, 0, 1, 6.0, 1.5, back="big_signs", uvs=((0, 6 / 8), (1, 6 / 8), (1, 7 / 8), (0, 7 / 8)))
    plate("big_signs", px + 0.9, py, 7.5, -1, 0, 6.0, 1.5, back=None, uvs=((0, 6 / 8), (1, 6 / 8), (1, 7 / 8), (0, 7 / 8)))


def big_box(x0, y0, x1, y1):
    lot = sbox(x0, y0, x1, y1)
    C.mark_poly(lot, building=True)
    K.tri_area("Lots", "parking", lot, 0.03)
    bw, bd = (x1 - x0) * 0.62, 70.0
    cx, cy = (x0 + x1) / 2, y1 - bd / 2 - 3
    obox("Buildings", cx, cy, 0, bw, bd, 10.0, 0, {"*": "wall_plain", "top": "concrete"})
    obox("Buildings", cx, cy - bd / 2 - 1.5, 0, 26, 3, 11.5, 0, {"*": "blue", "top": "concrete"})
    plate("big_signs", cx, cy - bd / 2 - 3.05, 9.0, 0, 1, 24, 6, back=None, coll="Buildings", uvs=((0, 7 / 8), (1, 7 / 8), (1, 1), (0, 1)))
    plate("glass", cx, cy - bd / 2 - 3.05, 2.5, 0, 1, 10, 5, back=None, coll="Buildings")
    for row in np.arange(y0 + 6, cy - bd / 2 - 12, 18.0):
        for xx in np.arange(x0 + 4, x1 - 4, 2.8):
            face("Markings", "paint_white", [(xx, row, 0.04), (xx + 0.12, row, 0.04), (xx + 0.12, row + 5.5, 0.04), (xx, row + 5.5, 0.04)], [(0, 0)] * 4)
            if R.random() < 0.4:
                car(xx + 1.4, row + 2.8, math.pi / 2, z=0.03, truck=R.random() < 0.3)
    for xx in np.arange(x0 + 10, x1 - 5, 40.0):
        cyl("Props", xx, y0 + 30, 0, 11.0, 0.15, 0.12, "metal_dark", seg=6)
        obox("Props", xx, y0 + 30, 10.9, 1.2, 0.6, 0.2, 0, {"*": "metal_dark", "bottom": "lamp_white"}, skip=())


def gas_station(x0, y0, x1, y1):
    lot = sbox(x0, y0, x1, y1)
    C.mark_poly(lot, building=True)
    K.tri_area("Lots", "concrete", lot, 0.03)
    cx, cy = (x0 + x1) / 2 - 4, (y0 + y1) / 2
    obox("Buildings", cx, cy, 5.2, 26, 16, 0.9, 0, {"*": "white", "s": "red", "n": "red", "bottom": "lamp_white"}, skip=())
    for dx in (-8, 0, 8):
        for dy in (-4, 4):
            obox("Props", cx + dx, cy + dy, 0, 0.5, 0.5, 5.2, 0, "white")
            obox("Props", cx + dx, cy + dy, 0, 1.0, 0.6, 1.8, 0, {"*": "white", "e": "red", "w": "red"})
    obox("Buildings", x1 - 7, cy, 0, 12, 14, 4.2, 0, {"*": "wall_plain", "w": "glass", "top": "concrete"})
    obox("Props", x0 + 2, y1 - 2, 0, 0.6, 0.6, 7.5, 0, "metal_dark")
    plate("big_signs", x0 + 2, y1 - 2, 6.5, 0, -1, 5.0, 1.25, back="big_signs", uvs=((0, 4 / 8), (1, 4 / 8), (1, 5 / 8), (0, 5 / 8)))


def drive_thru(x0, y0, x1, y1):
    lot = sbox(x0, y0, x1, y1)
    C.mark_poly(lot, building=True)
    K.tri_area("Lots", "parking", lot, 0.03)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + 4
    obox("Buildings", cx, cy, 0, 18, 12, 4.8, 0, {"*": "red", "top": "concrete"})
    obox("Buildings", cx, cy, 4.8, 19, 13, 0.9, 0, "signal_yellow", skip=("bottom",))
    obox("Props", x0 + 3, y0 + 3, 0, 0.8, 0.8, 12.0, 0, "metal_dark")
    plate("big_signs", x0 + 3, y0 + 3, 10.5, 0, 1, 6.0, 1.5, back="big_signs", uvs=((0, 5 / 8), (1, 5 / 8), (1, 6 / 8), (0, 6 / 8)))
    for k in range(4):
        car(cx + 12, cy - 6 + k * 6, math.pi / 2, z=0.03)


def motel(x0, y0, x1, y1):
    lot = sbox(x0, y0, x1, y1)
    C.mark_poly(lot, building=True)
    K.tri_area("Lots", "parking", lot, 0.03)
    w = x1 - x0 - 8
    obox("Buildings", (x0 + x1) / 2, y1 - 9, 0, w, 12, 6.4, 0, {"*": "f_apartment", "top": "concrete"})
    obox("Buildings", (x0 + x1) / 2, y1 - 16, 3.0, w, 2.0, 0.25, 0, "white", skip=())
    obox("Buildings", (x0 + x1) / 2, y1 - 16.9, 3.25, w, 0.08, 1.0, 0, "white", skip=())
    obox("Props", x0 + 4, y0 + 4, 0, 0.6, 0.6, 9.0, 0, "metal_dark")
    plate("big_signs", x0 + 4, y0 + 4, 8.0, 0, 1, 6.0, 1.5, back="big_signs", uvs=((0, 3 / 8), (1, 3 / 8), (1, 4 / 8), (0, 4 / 8)))
    for k in range(8):
        car(x0 + 8 + k * 3.0, y1 - 22, math.pi / 2, z=0.03)


def apartment(cx, cy, yaw, w, d, detail=True):
    obox("Buildings", cx, cy, 0, w, d, 6.4, yaw, {"*": "f_apartment", "top": None}, zuv=0.0)
    hip_roof(cx, cy, yaw, w, d, 6.4, 18, 0.5, "roof_tile")
    if detail:
        px, py = local(cx, cy, yaw, 0, -d / 2 - 1.0)
        obox("Buildings", px, py, 3.0, w, 2.0, 0.25, yaw, "white", skip=())


def warehouse(cx, cy, yaw, w, d, detail=True):
    obox("Buildings", cx, cy, 0, w, d, 10.0, yaw, {"*": "concrete", "top": "metal_light"})
    if detail:
        for k in range(int(w // 8)):
            px, py = local(cx, cy, yaw, -w / 2 + 4 + k * 8, -d / 2 - 0.02)
            plate("garage", px, py, 2.2, -front_dir(yaw)[0], -front_dir(yaw)[1], 3.5, 4.0, back=None, coll="Buildings")


# -------------------------------------------------------------- freeway
def ramp_sweep(pts, w, z0, z1, coll="Freeway"):
    """Deck whose height ramps linearly from z0 to z1 along pts (with parapets)."""
    P = np.array(pts, float)
    tang = np.gradient(P, axis=0)
    tang /= (np.linalg.norm(tang, axis=1)[:, None] + 1e-9)
    nrm = np.stack([-tang[:, 1], tang[:, 0]], 1)
    L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    Z = z0 + (z1 - z0) * L / L[-1]
    lf, rt = P + nrm * w / 2, P - nrm * w / 2
    for i in range(len(P) - 1):
        a, b = i, i + 1
        ref = tuple(P[i])
        face(coll, "asphalt", [(*rt[a], Z[a]), (*rt[b], Z[b]), (*lf[b], Z[b]), (*lf[a], Z[a])], [(rt[a][0] / 6, rt[a][1] / 6), (rt[b][0] / 6, rt[b][1] / 6), (lf[b][0] / 6, lf[b][1] / 6), (lf[a][0] / 6, lf[a][1] / 6)], ref)
        face(coll, "concrete", [(*lf[a], Z[a] - 1.0), (*lf[b], Z[b] - 1.0), (*rt[b], Z[b] - 1.0), (*rt[a], Z[a] - 1.0)], [(0, 0)] * 4, ref)
        for side, s in ((rt, -1), (lf, 1)):
            q = [(*side[a], Z[a] - 1.0), (*side[b], Z[b] - 1.0), (*side[b], Z[b] + 0.9), (*side[a], Z[a] + 0.9)]
            if s > 0:
                q = [q[1], q[0], q[3], q[2]]
            face(coll, "concrete", q, K.uv_world(q, 4.0), ref)
        if Z[a] > 2.0 and i % 15 == 0:
            obox(coll, P[i][0], P[i][1], 0, 1.4, 1.4, Z[a] - 1.0, math.atan2(tang[i][1], tang[i][0]), "concrete")


def build_freeway():
    ln = LineString(K.catmull_rom(FWY, 2.0))
    road_geo = C.geo["road"]
    K.sweep_box("Freeway", "asphalt", "concrete", list(ln.coords), 30.0, FWY_Z - 1.4, FWY_Z, mat_bottom="concrete")
    for sgn in (-1, 1):
        for e in lines_of(ln.offset_curve(sgn * 14.8)):
            K.sweep_box("Freeway", "concrete", "concrete", list(e.coords), 0.4, FWY_Z, FWY_Z + 1.1)
    K.sweep_box("Freeway", "concrete", "concrete", list(ln.coords), 0.6, FWY_Z, FWY_Z + 0.9)
    for o in (-10.8, -7.2, 7.2, 10.8):
        for e in lines_of(ln.offset_curve(o)):
            s = 0.0
            while s < e.length:
                K.ribbon("Freeway", "paint_white", [e.interpolate(s).coords[0], e.interpolate(min(e.length, s + 3.0)).coords[0]], 0.15, FWY_Z + 0.012)
                s += 12.0
    for o in (-13.6, -1.2, 1.2, 13.6):
        for e in lines_of(ln.offset_curve(o)):
            K.ribbon("Freeway", "paint_yellow" if abs(o) < 2 else "paint_white", list(e.coords), 0.15, FWY_Z + 0.012)
    s = 10.0
    while s < ln.length:
        c = ln.interpolate(s)
        tx, ty = tangent_at(ln, s)
        for o in (-9.0, 9.0):
            px, py = c.x - ty * o, c.y + tx * o
            if not road_geo.buffer(1.5).contains(Point(px, py)):
                obox("Freeway", px, py, 0, 1.8, 1.8, FWY_Z - 1.4, math.atan2(ty, tx), "concrete")
        s += 32.0
    C.mark_poly(ln.buffer(16.0).difference(road_geo.buffer(0.5)))
    # diamond interchange ramps: from the ground ramp roads up to the freeway shoulders
    for (gx, gy), (fx, fy), up in (((-120, -314), (-300, -300), True), ((120, -310), (300, -292), True),
                                   ((-120, -250), (-300, -268), True), ((120, -246), (300, -262), True)):
        mid = ((gx + fx) / 2, (gy + fy) / 2 + (-6 if gy < -280 else 6))
        pts = K.catmull_rom([(gx, gy), mid, (fx, fy)], 2.0)
        ramp_sweep(pts, 9.0, 0.0, FWY_Z)
        C.mark_poly(LineString(pts).buffer(6.0))
    # overhead guide sign gantry for westbound traffic approaching the Mission exit
    s0 = ln.project(Point(220, -277))
    c = ln.interpolate(s0)
    tx, ty = tangent_at(ln, s0)
    for o in (-15.5, 15.5):
        cyl("Freeway", c.x - ty * o, c.y + tx * o, FWY_Z, FWY_Z + 7.5, 0.25, 0.25, "metal_light", seg=8)
    tube("Freeway", (c.x - ty * -15.5, c.y + tx * -15.5, FWY_Z + 7.2), (c.x - ty * 15.5, c.y + tx * 15.5, FWY_Z + 7.2), 0.2, "metal_light", seg=6)
    sx, sy = c.x - ty * 7.0, c.y + tx * 7.0
    plate("sign_freeway", sx, sy, FWY_Z + 5.6, -tx, -ty, 9.0, 3.75)


def mountains():
    """Distant San-Gabriel-like ridge to the north (backdrop only)."""
    xs = np.linspace(-26000, 26000, 161)
    ys = np.linspace(9000, 17000, 14)
    rng = np.random.default_rng(5)
    ridge = 1000 + 450 * np.sin(xs / 3100) + 280 * np.sin(xs / 1150 + 1.0) + rng.normal(0, 90, len(xs))
    H = np.zeros((len(ys), len(xs)))
    for j, y in enumerate(ys):
        f = np.clip(1 - abs(y - 12500) / 3600, 0, 1) ** 0.7
        H[j] = ridge * f + rng.normal(0, 30, len(xs)) * f
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            q = [(xs[i], ys[j], H[j, i]), (xs[i + 1], ys[j], H[j, i + 1]), (xs[i + 1], ys[j + 1], H[j + 1, i + 1]), (xs[i], ys[j + 1], H[j + 1, i])]
            face("Backdrop", "mountain", q, [(p[0] / 2500, p[1] / 2500 + p[2] / 2500) for p in q], (0, 0), smooth=True)


# ----------------------------------------------------------------- props
KEEP = []


def signals_and_signs():
    names = {"MISSION": 0, "PALM": 1, "FOOTHILL": 2, "VALLEY": 3, "EAST": 4, "WEST": 5}
    for j, x, y, hx, hy, r in C.signal_poles:
        kx, ky = C.kerb_vec(hx, hy)
        cyl("Props", x, y, FP, 7.5, 0.2, 0.15, "metal_light", seg=8)
        arm = min(r.cw / 2 + 1.0, 14.0)
        tube("Props", (x, y, 7.0), (x - kx * arm, y - ky * arm, 7.0), 0.12, "metal_light", seg=6)
        green = abs(hx) > abs(hy)
        for k in (0.4, 0.75, 1.0):
            px, py = x - kx * arm * k, y - ky * arm * k
            yaw = math.atan2(hy, hx)
            obox("Props", px, py, 5.6, 0.35, 0.6, 1.3, yaw, "signal_yellow", skip=())
            for i, m in enumerate(("lamp_red" if not green else "lamp_off", "lamp_off", "lamp_green" if green else "lamp_off")):
                z = 6.62 - i * 0.42
                tube("Props", (px - hx * 0.17, py - hy * 0.17, z), (px - hx * 0.22, py - hy * 0.22, z), 0.13, m, seg=10, cap=True)
        # overhead street-name sign of the cross street
        other = next((n for n in j["roads"] if n != r.name), None)
        row = names.get(other, R.randrange(6))
        px, py = x - kx * arm * 0.2, y - ky * arm * 0.2
        plate("sign_street", px - hx * 0.1, py - hy * 0.1, 7.4, hx, hy, 3.4, 0.55, uvs=((0, 1 - (row + 1) / 6), (1, 1 - (row + 1) / 6), (1, 1 - row / 6), (0, 1 - row / 6)))
        KEEP.append((x, y, 3.0))
    for j, x, y, hx, hy, r in C.stop_signs:
        if not C.in_core(x, y):
            continue
        cyl("Props", x, y, FP, 2.9, 0.04, 0.04, "metal_light", seg=6)
        plate("sign_stop", x, y, 2.2, hx, hy, 0.76, 0.76)
        KEEP.append((x, y, 1.5))


def street_furniture():
    for r in C.roads:
        if r.cls == "ramp":
            continue
        for pc in C.pieces(r, 6.0):
            if not C.in_core(*pc.interpolate(0.5, normalized=True).coords[0], 30):
                continue
            # streetlights (cobra head on steel poles), one side
            side = 1 if hash(r.name) % 2 else -1
            s = 15.0
            while s < pc.length - 5:
                c = pc.interpolate(s)
                tx, ty = tangent_at(pc, s)
                nx, ny = -ty * side, tx * side
                x, y = c.x + nx * (r.cw / 2 + 0.5), c.y + ny * (r.cw / 2 + 0.5)
                if all(math.dist((x, y), k[:2]) > k[2] for k in KEEP):
                    cyl("Props", x, y, FP, 9.0, 0.12, 0.08, "metal_light", seg=7)
                    ex, ey = x - nx * 2.4, y - ny * 2.4
                    tube("Props", (x, y, 8.7), (ex, ey, 9.0), 0.05, "metal_light")
                    obox("Props", ex, ey, 8.86, 0.75, 0.35, 0.16, math.atan2(ny, nx), {"*": "metal_light", "bottom": "lamp_white"}, skip=())
                s += 45.0
            # palms: the boulevard median gets a row of Washingtonias, stroads get palms on the sidewalk
            if r.cls == "boulevard":
                s = 6.0
                while s < pc.length - 6:
                    c = pc.interpolate(s)
                    if C.geo["median"].contains(c):
                        washingtonia(c.x, c.y, 0.2)
                    s += 14.0
            if r.cls in ("stroad", "local"):
                for side2 in (1, -1):
                    s = R.uniform(4, 12)
                    while s < pc.length - 4:
                        c = pc.interpolate(s)
                        tx, ty = tangent_at(pc, s)
                        nx, ny = -ty * side2, tx * side2
                        off = r.cw / 2 + r.sw * 0.5 if r.cls == "stroad" else r.cw / 2 + r.sw + 1.2
                        x, y = c.x + nx * off, c.y + ny * off
                        if all(math.dist((x, y), k[:2]) > k[2] for k in KEEP) and all(math.dist((x, y), cw) > 4 for cw in C.crosswalks):
                            if r.cls == "stroad":
                                washingtonia(x, y, FP)
                            elif C.rfree(x, y, 0, 1.0, 1.0, 0.0):
                                (shade_tree if R.random() < 0.6 else washingtonia)(x, y, 0.0, 0.9)
                        s += 26.0 if r.cls == "stroad" else R.uniform(16, 26)


def bus_stop(name_en, road, near, toward):
    st = C.stop_at(road, near, toward, kerb_extra=0.5)
    x, y, hx, hy, kx, ky = st["x"], st["y"], st["hx"], st["hy"], st["kx"], st["ky"]
    yaw = math.atan2(hy, hx)
    cyl("Props", x - kx * 0.3, y - ky * 0.3, FP, 3.0, 0.04, 0.04, "metal_light", seg=6)
    plate("sign_busstop", x - kx * 0.3, y - ky * 0.3, 2.5, -kx, -ky, 0.45, 0.68)
    bx, by = x + kx * 0.4 + hx * 3, y + ky * 0.4 + hy * 3
    obox("Props", bx, by, FP + 0.45, 2.0, 0.5, 0.06, yaw, "white")
    plate("bench_ad", bx + kx * 0.25, by + ky * 0.25, FP + 0.75, -kx, -ky, 2.0, 0.5, back="white")
    KEEP.append((x, y, 6.0))
    return dict(name_en=name_en, name_local="", stop_point=[round(st["stop"][0], 2), round(st["stop"][1], 2)], heading=[round(hx, 3), round(hy, 3)])


# ------------------------------------------------------------------- lots
def pick(r, x, y):
    if y < -330:
        return dict(kind="warehouse", w=R.uniform(40, 80), d=R.uniform(30, 50), setback=8.0, gap=8.0)
    if -250 < y < 40 and r.cls in ("stroad", "arterial", "boulevard"):
        return dict(kind="apartment", w=R.uniform(26, 40), d=R.uniform(14, 18), setback=6.0, gap=4.0)
    if r.cls in ("stroad", "boulevard") and y >= 40:
        return dict(kind="house", w=R.uniform(18, 22), d=R.uniform(30, 34), setback=3.0, gap=1.0)
    return dict(kind="house", w=R.uniform(17, 21), d=R.uniform(28, 33), setback=1.0, gap=0.8)


def build_lot(L):
    a = (L["cx"], L["cy"], L["yaw"], L["w"], L["d"])
    if L["kind"] == "warehouse":
        warehouse(*a, L["detail"])
    elif L["kind"] == "apartment":
        apartment(*a, L["detail"])
    else:
        house(*a, L["detail"], lite=not L["detail"])


# ------------------------------------------------------------------- main
def cameras():
    cams = [
        K.add_camera("Cam_Aerial", (-360, -520, 260), (40, 80, 0), 30),
        C.lane_cam("Cam_Mission_Stroad", "MISSION", (-6, -60), (-10, 300), look=120, h=3.0),
        C.lane_cam("Cam_Palm_Canyon", "PALM", (-200, 52), (300, 42), look=120, h=3.0),
        C.lane_cam("Cam_Freeway_Interchange", "RAMP_N", (-80, -249), (120, -246), look=80, h=3.0),
        C.lane_cam("Cam_Suburb_Court", "CANYON_CT", (164, 200), (170, 140), look=50, h=1.9),
        K.add_camera("Cam_Megamart", (165, -100, 6), (300, 10, 4), 26),
        C.lane_cam("Cam_Foothill_Mountains", "FOOTHILL", (-300, 386), (0, 392), look=200, h=3.0, look_h=10.0),
        K.add_camera("Cam_TopDown", (0, 0, 900), (0, 0.001, 0), 50, ortho=1100),
    ]
    bpy.context.scene.camera = cams[0]


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = K.build_materials()
    define_roads()
    for r in C.roads:
        r.line = None
    C.build_network(signal_rule)
    tract_grid()
    C.juncs.clear()
    C.find_junctions(signal_rule)
    print("roads", len(C.roads), "junctions", len(C.juncs), flush=True)
    bulbs_r = unary_union([Point(*b).buffer(12.0, 32) for b in BULBS])
    bulbs_f = unary_union([Point(*b).buffer(14.0, 32) for b in BULBS])

    def median_fn(med):
        K.tri_area("Roads", "lawn", med, 0.2)
        K.ring_walls("Roads", med, 0.0, 0.2, lambda m: "curb")
    C.build_surfaces(asphalt="asphalt", footpath="sidewalk", kerb_road="curb", kerb_back="curb", corner_r=8.0,
                     extra_road=bulbs_r, extra_foot=bulbs_f, median_fn=median_fn)
    styles = {"stroad": dict(center="twltl", divider=(3.0, 9.0), bike=1.4, bike_mat="paint_bike"),
              "boulevard": dict(divider=(3.0, 9.0), bike=1.4, bike_mat="paint_bike"),
              "arterial": dict(center="yellow_double", divider=(3.0, 9.0)),
              "ramp": dict(center="yellow_double")}
    C.build_markings(styles, crosswalk="ladder", stop_rule=stop_rule)
    build_freeway()
    mountains()
    strip_mall(25, -100, 150, 40)
    big_box(170, -100, 395, 38)
    gas_station(-75, -5, -24, 40)
    drive_thru(-150, -20, -95, 40)
    motel(-300, -95, -175, 35)
    stops = [bus_stop("Mission Blvd & Vista Dr", "MISSION", (-6, 150), (-10, 300)),
             bus_stop("Foothill Blvd & Sunset Dr", "FOOTHILL", (200, 388), (720, 372)),
             bus_stop("East Ave & Vista Dr", "EAST", (412, 230), (420, -660)),
             bus_stop("Valley Rd & Valley Plaza", "VALLEY", (100, -114), (-720, -120)),
             bus_stop("Mission Blvd & Palm Canyon", "MISSION", (-3, -50), (-10, 300))]
    signals_and_signs()
    for rank in (4, 3, 2):
        for r in C.roads:
            if r.rank == rank and r.cls != "ramp":
                C.frontage(r, pick, build_lot)
    C.fill_interiors([(18.0, 28.0), (14.0, 22.0)], lambda L: house(L["cx"], L["cy"], L["yaw"], L["w"], L["d"], L["detail"], lite=True),
                     step=4.0, pad=1.0, where=lambda x, y: y > 40)
    C.fill_interiors([(32.0, 16.0), (24.0, 14.0)], lambda L: apartment(L["cx"], L["cy"], L["yaw"], L["w"], L["d"], L["detail"]),
                     step=6.0, pad=6.0, where=lambda x, y: -240 < y < 35)
    C.fill_interiors([(70.0, 40.0), (44.0, 30.0)], lambda L: warehouse(L["cx"], L["cy"], L["yaw"], L["w"], L["d"], L["detail"]),
                     step=8.0, pad=6.0, where=lambda x, y: y < -330)
    street_furniture()
    NC.ground(WORLD, "dry_grass", "far_ground")
    st0 = C.stop_at("MISSION", (-6, 150), (-10, 300))
    bus(st0["stop"][0] - st0["hx"] * 3, st0["stop"][1] - st0["hy"] * 3, math.atan2(st0["hy"], st0["hx"]))
    print("faces:", K.STATS["faces"], flush=True)
    K.flush(mats, collision={"Roads", "Footpaths", "Buildings", "Freeway", "Terrain", "Lots"},
            surfaces={"Roads": "asphalt", "Footpaths": "kerb", "Terrain": "dirt", "Lots": "asphalt"})
    j = lambda a, b: C.junction(a, b)  # noqa: E731
    tr = lambda jj: jj["r"] + 3.0      # noqa: E731
    J1, J2, J3, J4 = j("MISSION", "FOOTHILL"), j("FOOTHILL", "EAST"), j("EAST", "VALLEY"), j("VALLEY", "MISSION")
    start = st0["stop"]
    legs = [C.lane_leg("MISSION", start, J1["pos"], 0, tr(J1)),
            C.lane_leg("FOOTHILL", J1["pos"], J2["pos"], tr(J1), tr(J2)),
            C.lane_leg("EAST", J2["pos"], J3["pos"], tr(J2), tr(J3)),
            C.lane_leg("VALLEY", J3["pos"], J4["pos"], tr(J3), tr(J4)),
            C.lane_leg("MISSION", J4["pos"], start, tr(J4), 0)]
    path = C.join(legs)
    data = C.write_json(os.path.join(OUT, MAP + "_route.json"),
                        dict(map=MAP, country="USA", city="Palm Valley, California (fictional, SoCal-inspired)",
                             route=dict(number="42", name_local="", name_en="Mission - Foothill"), speed_units="mph"),
                        path, stops, dict(position=[*start, 0.0], heading_deg_from_east=round(math.degrees(math.atan2(st0["hy"], st0["hx"])), 1),
                                          note="Mission Blvd & Vista Dr, northbound; doors on the right"))
    NC.route_curve(bpy, path, "BusRoute_42")
    K.setup_world(sun_elev=50, sun_az=160, sun_energy=4.8, sky_strength=0.35, dust=1.0)
    cameras()
    if not _arg("--no-glb"):
        K.export_glb(os.path.join(OUT, MAP + ".glb"), {"Roads", "Footpaths", "Markings", "Buildings", "Freeway", "Lots", "Terrain",
                                                        "Vegetation", "Props", "Vehicles", "Islands", "Backdrop"})
    K.save_blend(os.path.join(OUT, MAP + ".blend"))
    print("saved; route", data["route"]["length_m"], "m;", len(data["stops"]), "stops", flush=True)
    if _arg("--render"):
        K.render_previews(os.path.join(OUT, "previews"), int(_arg("--samples", 40)), _arg("--only"))


if __name__ == "__main__":
    main()
