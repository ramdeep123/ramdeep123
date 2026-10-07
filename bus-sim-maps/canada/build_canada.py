"""Maplewood - a Toronto-inspired Canadian neighbourhood for NammaBusSim, built in Blender.

    blender -b -P build_canada.py -- [--out DIR] [--render] [--samples 40] [--no-glb] [--only Queen]

Right-hand traffic. Queen St with streetcar tracks and overhead wires between
Victorian brick storefronts; arterials with yellow double centre lines and
mast-arm signals; curving suburban crescents and cul-de-sacs with detached
houses, garages, driveways and lawns; brick bay-and-gable semis on the old
grid; maples in autumn colours; wooden hydro poles; an outdoor community
rink, a church, a donut shop with drive-thru and glass condo towers.
Needs shapely (see ../india/README.md).
"""
import math
import os
import random
import sys

import bpy
from shapely.geometry import Point, box as sbox
from shapely.ops import unary_union


def _find_dir():
    cands = [os.path.dirname(os.path.abspath(__file__))] if "__file__" in globals() else []
    cands += [os.path.dirname(bpy.path.abspath(t.filepath)) for t in bpy.data.texts if t.filepath]
    cands += [os.environ.get("NBS_CANADA_DIR", ""), os.getcwd()]
    for c in cands:
        if c and os.path.isfile(os.path.join(c, "build_canada.py")) and os.path.isdir(os.path.join(c, "textures")):
            return c
    raise RuntimeError("Can't find the canada map folder; set NBS_CANADA_DIR")


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
SEED = int(_arg("--seed", 1867))
R = random.Random(SEED)
MAP = "canada_maplewood"
WORLD = (-700.0, -650.0, 700.0, 650.0)
CORE = (-460.0, -420.0, 480.0, 440.0)
FP = 0.15

MATS = {
    "asphalt": dict(img="asphalt.jpg", T=6.0, rough=0.85, bump=0.2),
    "sidewalk": dict(img="sidewalk.jpg", T=3.0, rough=0.8),
    "curb": dict(img="curb.jpg", T=2.0, rough=0.75),
    "lawn": dict(img="lawn.jpg", T=4.0, rough=0.95),
    "concrete": dict(img="concrete.jpg", T=6.0, rough=0.85),
    "wall_plain": dict(img="wall_plain.jpg", T=8.0, rough=0.85),
    "bark": dict(img="bark.jpg", T=1.0, rough=0.9),
    "leaves_red": dict(img="leaves_red.jpg", T=1.6, rough=0.9),
    "leaves_orange": dict(img="leaves_orange.jpg", T=1.6, rough=0.9),
    "leaves_yellow": dict(img="leaves_yellow.jpg", T=1.6, rough=0.9),
    "leaves_green": dict(img="leaves_green.jpg", T=1.6, rough=0.9),
    "f_vic_red": dict(img="facade_vic_red.jpg", tw=10.8, th=7.2, rough=0.8),
    "f_vic_yellow": dict(img="facade_vic_yellow.jpg", tw=10.8, th=7.2, rough=0.8),
    "f_siding_white": dict(img="facade_siding_white.jpg", tw=8.0, th=6.0, rough=0.6),
    "f_siding_blue": dict(img="facade_siding_blue.jpg", tw=8.0, th=6.0, rough=0.6),
    "f_siding_beige": dict(img="facade_siding_beige.jpg", tw=8.0, th=6.0, rough=0.6),
    "f_brickhouse": dict(img="facade_brickhouse.jpg", tw=8.0, th=6.0, rough=0.8),
    "f_condo": dict(img="facade_condo.jpg", tw=16.0, th=12.0, rough=0.1, metal=0.4),
    "shops": dict(img="shop_atlas.jpg", rough=0.4),
    "shingles_grey": dict(img="shingles_grey.jpg", T=2.0, rough=0.8, bump=0.3),
    "shingles_brown": dict(img="shingles_brown.jpg", T=2.0, rough=0.8, bump=0.3),
    "ice": dict(img="ice.jpg", rough=0.1),
    "sign_stop": dict(img="sign_stop.png", alpha=True, rough=0.4),
    "sign_speed": dict(img="sign_speed.jpg", rough=0.4),
    "sign_street": dict(img="sign_street.jpg", rough=0.4),
    "sign_busstop": dict(img="sign_busstop.jpg", rough=0.4),
    "sign_rink": dict(img="sign_rink.jpg", rough=0.5),
    "streetcar_side": dict(img="streetcar_side.jpg", rough=0.3),
    "bus_side": dict(img="bus_side.jpg", rough=0.3),
    "paint_white": dict(color=srgb(236, 236, 230), rough=0.6),
    "paint_yellow": dict(color=srgb(236, 180, 20), rough=0.6),
    "steel": dict(color=srgb(110, 112, 116), rough=0.3, metal=1.0),
    "metal_light": dict(color=srgb(190, 192, 192), rough=0.4, metal=0.5),
    "metal_dark": dict(color=srgb(50, 52, 56), rough=0.45, metal=0.6),
    "signal_yellow": dict(color=srgb(230, 180, 20), rough=0.4),
    "glass": dict(color=srgb(60, 80, 92), rough=0.05, metal=0.4),
    "white": dict(color=srgb(240, 240, 236), rough=0.5),
    "brick_red": dict(color=srgb(150, 64, 48), rough=0.8),
    "garage": dict(color=srgb(236, 236, 230), rough=0.5),
    "door_red": dict(color=srgb(150, 30, 30), rough=0.5),
    "hydrant": dict(color=srgb(220, 30, 20), rough=0.4),
    "awning_red": dict(color=srgb(170, 30, 30), rough=0.7),
    "awning_green": dict(color=srgb(30, 90, 60), rough=0.7),
    "awning_blue": dict(color=srgb(30, 50, 110), rough=0.7),
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
    "far_ground": dict(color=srgb(96, 110, 70), rough=1.0),
}
K.configure(WORLD, MATS, os.path.join(HERE, "textures"), seed=SEED)

CLASSES = {
    "mainst": dict(lanes=2, lane_w=3.3, median=0.0, shoulder=2.4, sw=4.0, rank=4, speed=40),
    "arterial": dict(lanes=2, lane_w=3.4, median=0.0, shoulder=0.4, sw=2.6, rank=4, speed=50),
    "local": dict(lanes=1, lane_w=4.0, median=0.0, shoulder=0.25, sw=1.8, rank=2, speed=40),
}
C = NC.City(WORLD, CORE, CLASSES, drive="right", fp_h=FP)
BULBS = [(190.0, 255.0), (150.0, -95.0), (-300.0, 215.0)]


def define_roads():
    C.road("QUEEN", "mainst", [(-700, -40), (-300, -30), (0, -20), (300, -35), (700, -45)], name_en="Queen St")
    C.road("ELGIN", "arterial", [(-60, -650), (-50, -300), (-40, 0), (-55, 300), (-70, 650)], name_en="Elgin St")
    C.road("COLLEGE", "arterial", [(-700, 300), (-300, 290), (0, 310), (400, 295), (700, 300)], name_en="College St")
    C.road("FRONT", "arterial", [(-700, -330), (0, -340), (700, -325)], name_en="Front St")
    C.road("BIRCH", "arterial", [(-400, -650), (-410, 0), (-400, 650)], name_en="Birch Ave")
    C.road("CEDAR", "arterial", [(380, -650), (370, 0), (385, 650)], name_en="Cedar Ave")
    # post-war suburb: curving crescents and cul-de-sacs
    C.road("MAPLE_CRES", "local", [(60, -22), (70, 110), (170, 200), (280, 120), (300, -33)], start_on="QUEEN", end_on="QUEEN", name_en="Maple Cres")
    C.road("OAK", "local", [(-42, 140), (20, 135), (68, 112)], start_on="ELGIN", end_on="MAPLE_CRES", name_en="Oak Dr")
    C.road("CEDAR_CRT", "local", [(170, 200), (180, 230), (190, 255)], start_on="MAPLE_CRES", name_en="Cedar Crt")
    C.road("PINE", "local", [(280, 120), (330, 170), (372, 180)], start_on="MAPLE_CRES", end_on="CEDAR", name_en="Pine Dr")
    C.road("BIRCHWOOD", "local", [(20, -339), (40, -220), (150, -150), (260, -200), (300, -333)], start_on="FRONT", end_on="FRONT", name_en="Birchwood Cres")
    C.road("ASH_CRT", "local", [(150, -150), (150, -120), (150, -95)], start_on="BIRCHWOOD", name_en="Ash Crt")
    C.road("ELM", "local", [(-45, -200), (40, -220)], start_on="ELGIN", end_on="BIRCHWOOD", name_en="Elm St")
    C.road("SPRUCE", "local", [(300, -333), (330, -250), (372, -240)], start_on="FRONT", end_on="CEDAR", name_en="Spruce Dr")
    # old grid north of Queen, west of Elgin (bay-and-gable semis)
    for k, x in enumerate((-130, -210, -290)):
        C.road(f"OLD{k}", "local", [(x, -32), (x + 4, 140), (x, 294)], start_on="QUEEN", end_on="COLLEGE", name_en=["Euclid Ave", "Palmerston Ave", "Markham St"][k])
    C.road("HARBORD", "local", [(-405, 140), (-290, 141), (-210, 140), (-130, 141), (-46, 140)], start_on="BIRCH", end_on="ELGIN", name_en="Harbord St")
    C.road("LINDEN", "local", [(-232, -335), (-230, -190), (-228, -34)], start_on="FRONT", end_on="QUEEN", name_en="Linden St")


def stop_rule(j, r):
    if j["signal"]:
        return True
    others = [C.rd[n].rank for n in j["roads"] if n != r.name]
    return r.cls == "local" and others and max(others) >= r.rank


# ------------------------------------------------------------------ props
LEAVES = ["leaves_red", "leaves_orange", "leaves_orange", "leaves_yellow", "leaves_green", "leaves_red"]


def maple(x, y, z=0.0, s=1.0):
    s *= R.uniform(0.8, 1.2)
    m = R.choice(LEAVES)
    cyl("Vegetation", x, y, z, z + 3.0 * s, 0.25 * s, 0.17 * s, "bark", seg=7, cap=False)
    crown("Vegetation", m, x, y, z + 6.0 * s, 3.6 * s, 3.6 * s, 3.4 * s, 8)


def spruce(x, y, z=0.0, s=1.0):
    s *= R.uniform(0.8, 1.2)
    cyl("Vegetation", x, y, z, z + 1.5, 0.2, 0.15, "bark", seg=6, cap=False)
    for k in range(4):
        cyl("Vegetation", x, y, z + 1.2 + k * 2.2 * s, z + 4.0 + k * 2.2 * s, (2.6 - k * 0.55) * s, 0.2, "leaves_green", seg=8)


def car(x, y, yaw, color=None, z=0.0):
    color = color or R.choice(["car_white"] * 3 + ["car_black"] * 2 + ["car_silver"] * 3 + ["car_red", "car_blue"])
    obox("Vehicles", x, y, z + 0.3, 4.8, 1.85, 0.8, yaw, color)
    px, py = x - math.cos(yaw) * 0.2, y - math.sin(yaw) * 0.2
    obox("Vehicles", px, py, z + 1.1, 2.6, 1.7, 0.6, yaw, {"*": "glass", "top": color})
    for lx in (1.55, -1.55):
        for ly in (0.88, -0.88):
            qx, qy = local(x, y, yaw, lx, ly)
            ox, oy = -math.sin(yaw) * 0.11, math.cos(yaw) * 0.11
            tube("Vehicles", (qx - ox, qy - oy, z + 0.34), (qx + ox, qy + oy, z + 0.34), 0.34, "rubber", seg=8, cap=True)


def vehicle(x, y, yaw, L, W, H, mat, coll):
    c, s = math.cos(yaw), math.sin(yaw)

    def uv(fk, pts, m):
        if m != mat:
            return None
        out = []
        for p in pts:
            lx = (p[0] - x) * c + (p[1] - y) * s
            u = (lx + L / 2) / L
            v = (p[2] - 0.35) / (H - 0.35)
            out.append((u, 0.5 + v * 0.5) if fk == "s" else (1 - u, v * 0.5))
        return out
    obox(coll, x, y, 0.35, L, W, H - 0.35, yaw, {"n": mat, "s": mat, "*": "white", "top": "metal_light"}, uv=uv)
    for lx in (L / 2 - 2.5, -L / 2 + 2.8):
        for ly in (W / 2 - 0.1, -W / 2 + 0.1):
            px, py = local(x, y, yaw, lx, ly)
            ox, oy = -s * 0.15, c * 0.15
            tube(coll, (px - ox, py - oy, 0.5), (px + ox, py + oy, 0.5), 0.5, "rubber", seg=10, cap=True)


# -------------------------------------------------------------- buildings
def gable_roof(cx, cy, yaw, w, d, z, pitch, o, mat, gable_mat, along_x=True):
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
        L = math.dist(q[0][:2], q[1][:2]) / 2.0
        sl = math.hypot(hd, rise + o * t) / 2.0
        face("Buildings", mat, q, [(0, 0), (L, 0), (L, sl), (0, sl)], (cx, cy))
        face("Buildings", "white", [(x, y, z - 0.06) for x, y, z in q[::-1]], [(0, 0)] * 4, (cx, cy))
    for sgn in (-1, 1):
        g = [P(sgn * w / 2, -d / 2, z), P(sgn * w / 2, d / 2, z), P(sgn * w / 2, 0, z + rise)]
        if sgn < 0:
            g = [g[1], g[0], g[2]]
        face("Buildings", gable_mat, g, K.uv_world(g, 4.0), (cx, cy))
    return z + rise


def front_dir(yaw):
    return -math.sin(yaw), math.cos(yaw)


def detached(cx, cy, yaw, w, d, detail=True, lite=False):
    """Suburban 2-storey house: garage + driveway + lawn (lot w x d, front at local -y)."""
    mat = R.choice(["f_siding_white", "f_siding_blue", "f_siding_beige", "f_brickhouse"])
    roof = R.choice(["shingles_grey", "shingles_brown"])
    setback = min(7.0, d * 0.4)
    hw, hd = w - 5.0, d - setback - 2.0
    if hw < 6 or hd < 6:
        hw, hd = w - 1.5, d - setback - 1.0
    garage_left = R.random() < 0.5
    hx = (-w / 2 + 0.8 + hw / 2) if not garage_left else (w / 2 - 0.8 - hw / 2)
    bx, by = local(cx, cy, yaw, hx, -d / 2 + setback + hd / 2)
    obox("Buildings", bx, by, 0, hw, hd, 6.0, yaw, {"*": mat, "top": None}, zuv=0.0, u0=R.choice([0, 0.5]))
    gable_roof(bx, by, yaw, hw, hd, 6.0, R.uniform(24, 34), 0.5, roof, mat if "brick" not in mat else "wall_plain", along_x=R.random() < 0.7)
    if lite:
        return
    gx_l = (w / 2 - 0.6 - 2.0) if not garage_left else (-w / 2 + 0.6 + 2.0)
    gx, gy = local(cx, cy, yaw, gx_l, -d / 2 + setback + 3.2)
    obox("Buildings", gx, gy, 0, 3.8, 6.4, 3.0, yaw, {"*": mat, "s": None, "top": "shingles_grey"}, zuv=0.0)
    hxv, hyv = front_dir(yaw)
    fx, fy = local(gx, gy, yaw, 0, -3.21)
    plate("garage", fx, fy, 1.15, -hxv, -hyv, 3.2, 2.3, back=None, coll="Buildings")
    # driveway to the street + front door + lawn tree
    dx0, dy0 = local(cx, cy, yaw, gx_l, -d / 2 + setback / 2 - 0.5)
    from shapely.geometry import Polygon
    pts = [local(cx, cy, yaw, gx_l + a, b) for a, b in ((-1.7, -d / 2 - 2.8), (1.7, -d / 2 - 2.8), (1.7, -d / 2 + setback), (-1.7, -d / 2 + setback))]
    K.tri_area("Lots", "concrete", Polygon(pts), 0.03)
    if R.random() < 0.55:
        car(dx0, dy0, yaw + math.pi / 2)
    ex, ey = local(bx, by, yaw, 0, -hd / 2 - 0.02)
    plate(R.choice(["door_red", "white", "metal_dark"]), ex, ey, 1.1, -hxv, -hyv, 1.0, 2.2, back=None, coll="Buildings")
    if R.random() < 0.7:
        tx, ty = local(cx, cy, yaw, -gx_l * 0.8, -d / 2 + setback * 0.45)
        (maple if R.random() < 0.8 else spruce)(tx, ty, 0.0, 0.9)


def semi(cx, cy, yaw, w, d, detail=True):
    """Bay-and-gable brick semi (old Toronto grid): front porch, steep gable to the street."""
    setback = 4.0
    hd = d - setback - 1.0
    bx, by = local(cx, cy, yaw, 0, -d / 2 + setback + hd / 2)
    obox("Buildings", bx, by, 0, w - 0.4, hd, 6.4, yaw, {"*": "f_brickhouse", "top": None}, zuv=0.2)
    gable_roof(bx, by, yaw, w - 0.4, hd, 6.4, 45, 0.3, "shingles_grey", "brick_red", along_x=False)
    if not detail:
        return
    hxv, hyv = front_dir(yaw)
    px, py = local(bx, by, yaw, 0, -hd / 2 - 1.2)
    obox("Buildings", px, py, 0, w - 1.0, 2.4, 0.5, yaw, "white")
    obox("Buildings", px, py, 2.8, w - 0.8, 2.6, 0.15, yaw, "white", skip=())
    for lx in (-(w - 1.4) / 2, (w - 1.4) / 2):
        qx, qy = local(px, py, yaw, lx, -1.0)
        cyl("Buildings", qx, qy, 0.5, 2.8, 0.08, 0.08, "white", seg=6)
    if R.random() < 0.6:
        tx, ty = local(cx, cy, yaw, 0, -d / 2 + 1.0)
        maple(tx, ty, 0.0, 0.85)


def storefront(cx, cy, yaw, w, d, detail=True):
    """Victorian main-street building: shop + 2 brick floors + cornice + awning."""
    mat = R.choice(["f_vic_red", "f_vic_red", "f_vic_yellow"])
    gf = 4.2
    floors = R.choice([2, 2, 3])
    top = gf + floors * 3.6
    obox("Buildings", cx, cy, 0, w, d, gf, yaw, {"*": "wall_plain", "s": None, "top": None})
    n = max(1, int(round(w / 7.0)))
    for k in range(n):
        a, b = -w / 2 + w * k / n, -w / 2 + w * (k + 1) / n
        A, B = local(cx, cy, yaw, a, -d / 2 - 0.01), local(cx, cy, yaw, b, -d / 2 - 0.01)
        cidx = R.randrange(12)
        u0, v0 = (cidx % 4) / 4, 1 - (cidx // 4 + 1) / 3
        face("Buildings", "shops", [(A[0], A[1], 0), (B[0], B[1], 0), (B[0], B[1], gf), (A[0], A[1], gf)],
             [(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 1 / 3), (u0, v0 + 1 / 3)], (cx, cy))
    obox("Buildings", cx, cy, gf, w, d, top - gf, yaw, {"*": "wall_plain", "s": mat, "top": "concrete"}, zuv=gf, u0=R.random())
    if not detail:
        return
    px, py = local(cx, cy, yaw, 0, -d / 2 - 0.3)
    obox("Buildings", px, py, top - 0.6, w + 0.2, 0.7, 0.6, yaw, "white", skip=())     # cornice
    mat_a = R.choice(["awning_red", "awning_green", "awning_blue"])
    A0, B0 = local(cx, cy, yaw, -w / 2 + 0.2, -d / 2), local(cx, cy, yaw, w / 2 - 0.2, -d / 2)
    A1, B1 = local(cx, cy, yaw, -w / 2 + 0.2, -d / 2 - 1.6), local(cx, cy, yaw, w / 2 - 0.2, -d / 2 - 1.6)
    q = [(A1[0], A1[1], gf - 0.9), (B1[0], B1[1], gf - 0.9), (B0[0], B0[1], gf - 0.1), (A0[0], A0[1], gf - 0.1)]
    face("Buildings", mat_a, q, [(0, 0)] * 4, (cx, cy))
    face("Buildings", mat_a, q[::-1], [(0, 0)] * 4, (cx, cy))


def condo(cx, cy, yaw, w, d, detail=True):
    floors = R.randint(22, 38)
    obox("Buildings", cx, cy, 0, w, d, 12.0, yaw, {"*": "f_vic_red", "top": "concrete"}, zuv=0.0)
    tw, td = w * 0.6, d * 0.6
    tx, ty = local(cx, cy, yaw, 0, d * 0.1)
    obox("Buildings", tx, ty, 12.0, tw, td, floors * 3.0, yaw, {"*": "f_condo", "top": "concrete"}, zuv=12.0)
    obox("Buildings", tx, ty, 12.0 + floors * 3.0, tw * 0.5, td * 0.5, 4.0, yaw, "metal_light")


# ------------------------------------------------------------ specials
def build_streetcar_line():
    """Queen St: two streetcar tracks in the inner lanes, overhead wires on span poles."""
    r = C.rd["QUEEN"]
    ln = r.line
    for tc in (-1.65, 1.65):
        for e in lines_of(ln.offset_curve(tc)):
            for g in (-0.75, 0.75):
                for e2 in lines_of(e.offset_curve(g)):
                    K.ribbon("Markings", "steel", list(e2.coords), 0.09, 0.013)
            K.sweep_box("Props", "wire", "wire", list(e.coords), 0.03, 5.8, 5.83)
    s = 8.0
    while s < ln.length:
        c = ln.interpolate(s)
        if C.in_core(c.x, c.y, 60):
            tx, ty = tangent_at(ln, s)
            nx, ny = -ty, tx
            ends = []
            for sgn in (-1, 1):
                px, py = c.x + nx * sgn * (r.cw / 2 + 0.6), c.y + ny * sgn * (r.cw / 2 + 0.6)
                if any(math.dist((px, py), cw) < 3 for cw in C.crosswalks):
                    ends = []
                    break
                cyl("Props", px, py, FP, 7.2, 0.14, 0.11, "metal_dark", seg=8)
                ends.append((px, py))
            if len(ends) == 2:
                tube("Props", (*ends[0], 6.3), (*ends[1], 6.3), 0.015, "wire", seg=3)
        s += 35.0
    # a streetcar heading east on the south track
    s0 = ln.project(Point(150, -30))
    c = ln.interpolate(s0)
    tx, ty = tangent_at(ln, s0)
    x, y = c.x + ty * 1.65, c.y - tx * 1.65
    vehicle(x, y, math.atan2(ty, tx), 30.0, 2.6, 3.8, "streetcar_side", "Vehicles")
    tube("Vehicles", (x, y, 3.8), (x + tx * 2, y + ty * 2, 5.8), 0.04, "metal_dark")


def build_park_and_rink():
    park = sbox(-385, -310, -248, -185)
    C.mark_poly(park, building=True)
    K.tri_area("Lots", "lawn", park, 0.03)
    rink = sbox(-345, -270, -285, -240)
    K.tri_area("Lots", "ice", rink, 0.08, uvs_fn=lambda pts: [((p[0] + 345) / 60, (p[1] + 270) / 30) for p in pts])
    K.ring_walls("Lots", rink, 0.0, 1.1, lambda m: "white")
    face("Landmark", "sign_rink", [(-340, -276.01, 2.6), (-290, -276.01, 2.6), (-290, -276.01, 3.6), (-340, -276.01, 3.6)], [(0, 0), (1, 0), (1, 1), (0, 1)])
    obox("Landmark", -315, -276, 0, 52, 0.1, 2.6, 0, "metal_dark", skip=("top",))
    obox("Landmark", -315, -205, 0, 22, 10, 4.0, 0, {"*": "brick_red", "top": "concrete"})
    for _ in range(18):
        x, y = R.uniform(-380, -252), R.uniform(-305, -190)
        if not (-350 < x < -280 and -278 < y < -232):
            (maple if R.random() < 0.75 else spruce)(x, y, 0.03)


def build_church():
    r = C.rd["QUEEN"]
    s = r.line.project(Point(-340, -32))
    c = r.line.interpolate(s)
    tx, ty = tangent_at(r.line, s)
    nx, ny = ty, -tx                     # south side of Queen
    yaw = math.atan2(ny, nx) - math.pi / 2
    cx, cy = c.x + nx * (r.half + 16), c.y + ny * (r.half + 16)
    C.rmark(cx, cy, yaw, 26, 34)
    obox("Landmark", cx, cy, 0, 16, 30, 10.0, yaw, {"*": "brick_red", "top": None})
    gable_roof(cx, cy, yaw, 16, 30, 10.0, 48, 0.6, "shingles_grey", "brick_red", along_x=False)
    sx, sy = local(cx, cy, yaw, 0, -15.5)
    obox("Landmark", sx, sy, 0, 5.5, 5.5, 20.0, yaw, "brick_red")
    cyl("Landmark", sx, sy, 20.0, 34.0, 3.6, 0.05, "shingles_grey", seg=4)
    tube("Landmark", (sx, sy, 34.0), (sx, sy, 36.5), 0.08, "metal_dark")
    hx, hy = front_dir(yaw)
    dx, dy = local(sx, sy, yaw, 0, -2.76)
    plate("door_red", dx, dy, 1.8, -hx, -hy, 2.0, 3.6, back=None, coll="Landmark")


def build_donut_shop():
    cx, cy = -130.0, -300.0
    lot = sbox(-160, -322, -100, -278)
    C.mark_poly(lot, building=True)
    K.tri_area("Lots", "asphalt", lot, 0.03)
    obox("Buildings", cx, cy + 6, 0, 18, 12, 4.6, math.pi, {"*": "brick_red", "top": "concrete"})
    plate("shops", cx, cy, 2.3, 0, 1, 16, 4.0, back=None, coll="Buildings", uvs=((0, 2 / 3), (0.25, 2 / 3), (0.25, 1), (0, 1)))
    for k in range(6):
        car(-155 + k * 3.0, -288, math.pi / 2)
    for k in range(3):                       # drive-thru queue
        car(-104, -284 - k * 6.0, -math.pi / 2)


def poles_and_lights():
    """Wooden hydro poles with crossarms, transformer cans and cobra-head lights."""
    for r in C.roads:
        side = 1 if hash(r.name) % 2 else -1
        for pc in C.pieces(r, 4.0):
            if not C.in_core(*pc.interpolate(0.5, normalized=True).coords[0], 30):
                continue
            n = max(1, int(round(pc.length / 38)))
            tops = []
            for k in range(n + 1):
                s = pc.length * k / n
                c = pc.interpolate(s)
                tx, ty = tangent_at(pc, s)
                nx, ny = -ty * side, tx * side
                x, y = c.x + nx * (r.cw / 2 + 0.45), c.y + ny * (r.cw / 2 + 0.45)
                if any(math.dist((x, y), cw) < 4 for cw in C.crosswalks) or any(math.dist((x, y), kk[:2]) < kk[2] for kk in KEEP):
                    tops.append(None)
                    continue
                cyl("Props", x, y, FP, 11.5, 0.17, 0.13, "bark", seg=7)
                yaw = math.atan2(ty, tx)
                obox("Props", x, y, 10.7, 0.12, 2.2, 0.12, yaw, "bark", skip=())
                if R.random() < 0.25:
                    cyl("Props", x - nx * 0.4, y - ny * 0.4, 8.2, 9.4, 0.3, 0.3, "metal_light", seg=10)
                ex, ey = x - nx * 2.2, y - ny * 2.2
                tube("Props", (x, y, 8.0), (ex, ey, 8.3), 0.05, "metal_light")
                obox("Props", ex, ey, 8.18, 0.7, 0.32, 0.16, yaw + math.pi / 2, {"*": "metal_light", "bottom": "lamp_white"}, skip=())
                tops.append((x, y, -ty, tx))
            for a, b in zip(tops, tops[1:]):
                if not a or not b:
                    continue
                span = math.dist(a[:2], b[:2])
                for o, z in ((-1.0, 10.8), (0.0, 10.8), (1.0, 10.8), (0.0, 7.3)):
                    p0 = (a[0] + a[2] * o, a[1] + a[3] * o, z)
                    p1 = (b[0] + b[2] * o, b[1] + b[3] * o, z)
                    sag = 0.02 * span + 0.2
                    prev = p0
                    for m in range(1, 7):
                        t = m / 6
                        cur = (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, z - sag * 4 * t * (1 - t))
                        tube("Wires", prev, cur, 0.014, "wire", seg=3, ref=p0)
                        prev = cur
            # street trees + hydrants
            for side2 in (1, -1):
                s = R.uniform(5, 12)
                while s < pc.length - 5:
                    c = pc.interpolate(s)
                    tx, ty = tangent_at(pc, s)
                    nx, ny = -ty * side2, tx * side2
                    x, y = c.x + nx * (r.cw / 2 + r.sw + 1.5), c.y + ny * (r.cw / 2 + r.sw + 1.5)
                    if r.cls != "mainst" and C.rfree(x, y, 0, 1.0, 1.0, 0.0) and all(math.dist((x, y), kk[:2]) > kk[2] for kk in KEEP):
                        maple(x, y, 0.0)
                    s += R.uniform(14, 22)
                if R.random() < 0.5:
                    c = pc.interpolate(pc.length * 0.3)
                    tx, ty = tangent_at(pc, pc.length * 0.3)
                    hx_, hy_ = c.x - ty * side2 * (r.cw / 2 + 0.5), c.y + tx * side2 * (r.cw / 2 + 0.5)
                    cyl("Props", hx_, hy_, FP, FP + 0.75, 0.13, 0.13, "hydrant", seg=8)
                    blob("Props", "hydrant", hx_, hy_, FP + 0.8, 0.15, 0.15, 0.12, level=1)


KEEP = []


def signals_and_signs():
    for j, x, y, hx, hy, r in C.signal_poles:
        kx, ky = C.kerb_vec(hx, hy)
        cyl("Props", x, y, FP, 7.0, 0.16, 0.13, "metal_dark", seg=8)
        arm = r.cw / 2 + 0.2
        tube("Props", (x, y, 6.6), (x - kx * arm, y - ky * arm, 6.6), 0.1, "metal_dark", seg=6)
        green = abs(hx) > abs(hy)
        for k in (0.35, 0.75):
            px, py = x - kx * arm * k, y - ky * arm * k
            yaw = math.atan2(hy, hx)
            obox("Props", px, py, 5.1, 0.35, 0.65, 1.3, yaw, "signal_yellow", skip=())
            for i, m in enumerate(("lamp_red" if not green else "lamp_off", "lamp_off", "lamp_green" if green else "lamp_off")):
                z = 6.12 - i * 0.42
                tube("Props", (px - hx * 0.17, py - hy * 0.17, z), (px - hx * 0.22, py - hy * 0.22, z), 0.13, m, seg=10, cap=True)
        KEEP.append((x, y, 2.5))
    names = {"QUEEN": 0, "ELGIN": 1, "COLLEGE": 2, "MAPLE_CRES": 3, "BIRCH": 4, "CEDAR_CRT": 5}
    for j, x, y, hx, hy, r in C.stop_signs:
        if not C.in_core(x, y):
            continue
        cyl("Props", x, y, FP, 3.2, 0.04, 0.04, "metal_light", seg=6)
        plate("sign_stop", x, y, 2.3, hx, hy, 0.75, 0.75)
        row = names.get(r.name, R.randrange(6))
        plate("sign_street", x, y, 3.05, -hy, hx, 1.2, 0.15, uvs=((0, 1 - (row + 1) / 6), (1, 1 - (row + 1) / 6), (1, 1 - row / 6), (0, 1 - row / 6)))
        KEEP.append((x, y, 1.5))


def bus_stop(name_en, road, near, toward, shelter=True):
    st = C.stop_at(road, near, toward, kerb_extra=0.5)
    x, y, hx, hy, kx, ky = st["x"], st["y"], st["hx"], st["hy"], st["kx"], st["ky"]
    yaw = math.atan2(hy, hx)
    cyl("Props", x - kx * 0.4, y - ky * 0.4, FP, 3.2, 0.04, 0.04, "metal_light", seg=6)
    plate("sign_busstop", x - kx * 0.4, y - ky * 0.4, 2.7, -kx, -ky, 0.5, 0.75)
    if shelter:
        bx, by = x + kx * 0.6, y + ky * 0.6
        obox("Props", bx, by, 2.5, 4.4, 1.6, 0.1, yaw, "metal_light", skip=())
        obox("Props", bx + kx * 0.75, by + ky * 0.75, FP + 0.2, 4.2, 0.05, 2.1, yaw, "glass")
    KEEP.append((x, y, 6.0))
    return dict(name_en=name_en, name_local="", stop_point=[round(st["stop"][0], 2), round(st["stop"][1], 2)], heading=[round(hx, 3), round(hy, 3)])


# ------------------------------------------------------------------ lots
def in_suburb(x, y):
    return (-40 < x < 372 and (y > -20 or y < -40)) and -335 < y < 300


def pick(r, x, y):
    dq = math.dist((x, y), (-40, -20))
    if r.name == "QUEEN":
        if dq < 150 and R.random() < 0.5:
            return dict(kind="condo", w=R.uniform(26, 36), d=R.uniform(24, 30), setback=0.3, gap=2.0)
        return dict(kind="store", w=R.uniform(6.5, 11), d=R.uniform(14, 18), setback=0.1, gap=0.05, tight=True)
    if r.cls == "arterial":
        if dq < 220 and R.random() < 0.4:
            return dict(kind="store", w=R.uniform(7, 12), d=R.uniform(14, 18), setback=0.3, gap=0.1, tight=True)
        return dict(kind="house", w=R.uniform(15, 19), d=R.uniform(24, 30), setback=1.0, gap=0.6)
    if r.name.startswith("OLD") or r.name in ("HARBORD", "LINDEN"):
        return dict(kind="semi", w=R.uniform(5.8, 7.5), d=R.uniform(22, 28), setback=0.5, gap=0.05, tight=True)
    return dict(kind="house", w=R.uniform(15, 18), d=R.uniform(26, 32), setback=1.0, gap=0.6)


def build_lot(L):
    a = (L["cx"], L["cy"], L["yaw"], L["w"], L["d"])
    k = L["kind"]
    if k == "store":
        storefront(*a, L["detail"])
    elif k == "condo":
        condo(*a, L["detail"])
    elif k == "semi":
        semi(*a, L["detail"])
    else:
        detached(*a, L["detail"], lite=not L["detail"])


# ------------------------------------------------------------------ main
def cameras():
    cams = [
        K.add_camera("Cam_Aerial", (-380, -470, 280), (40, 40, 0), 30),
        C.lane_cam("Cam_Queen_Streetcar", "QUEEN", (60, -21), (300, -35), look=90, h=2.9),
        C.lane_cam("Cam_Maple_Crescent", "MAPLE_CRES", (75, 60), (170, 200), look=45, h=2.0, lens=24),
        C.lane_cam("Cam_Cul_de_sac", "ASH_CRT", (150, -140), (150, -95), look=40, h=1.9, lens=22),
        C.lane_cam("Cam_College_St", "COLLEGE", (250, 300), (-300, 290), look=110),
        C.lane_cam("Cam_Old_Grid", "OLD1", (-208, 60), (-210, 290), look=60, h=1.9),
        K.add_camera("Cam_Rink", (-360, -300, 6), (-300, -250, 0), 26),
        K.add_camera("Cam_TopDown", (0, 0, 900), (0, 0.001, 0), 50, ortho=1100),
    ]
    bpy.context.scene.camera = cams[0]


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = K.build_materials()
    define_roads()
    C.build_network()
    print("roads", len(C.roads), "junctions", len(C.juncs), flush=True)
    bulbs_r = unary_union([Point(*b).buffer(11.0, 32) for b in BULBS[:2]])
    bulbs_f = unary_union([Point(*b).buffer(11.0 + 2.0, 32) for b in BULBS[:2]])
    C.build_surfaces(asphalt="asphalt", footpath="sidewalk", kerb_road="curb", kerb_back="curb", corner_r=7.0,
                     extra_road=bulbs_r, extra_foot=bulbs_f)
    styles = {
        "mainst": dict(center="yellow_double", divider=(3.0, 6.0)),
        "arterial": dict(center="yellow_double", divider=(3.0, 6.0)),
    }
    C.build_markings(styles, crosswalk="lines", stop_rule=stop_rule)
    # parking lane edge lines on Queen St
    for pc in C.pieces(C.rd["QUEEN"], 6.5):
        for sgn in (-1, 1):
            for e in lines_of(pc.offset_curve(sgn * (C.rd["QUEEN"].cw / 2 - 2.4))):
                C.dashed(e, 0.12, 5.5, 1.0, "paint_white")
    build_streetcar_line()
    build_park_and_rink()
    build_church()
    build_donut_shop()
    stops = [bus_stop("Queen St & Elgin St", "QUEEN", (20, -21), (300, -35)),
             bus_stop("Queen St & Maple Cres", "QUEEN", (240, -31), (700, -45)),
             bus_stop("Cedar Ave & Pine Dr", "CEDAR", (371, 120), (385, 650)),
             bus_stop("College St & Cedar Crt", "COLLEGE", (200, 303), (-300, 290)),
             bus_stop("Elgin St & Oak Dr", "ELGIN", (-45, 170), (-50, -300))]
    signals_and_signs()
    for rank in (4, 2):
        for r in C.roads:
            if r.rank == rank:
                C.frontage(r, pick, build_lot)
    C.fill_interiors([(16.0, 26.0), (12.0, 20.0)], lambda L: detached(L["cx"], L["cy"], L["yaw"], L["w"], L["d"], L["detail"], lite=True),
                     step=4.0, pad=0.8)
    poles_and_lights()
    NC.ground(WORLD, "lawn", "far_ground")
    st0 = C.stop_at("QUEEN", (20, -21), (300, -35))
    vehicle(st0["stop"][0] - st0["hx"] * 3, st0["stop"][1] - st0["hy"] * 3, math.atan2(st0["hy"], st0["hx"]), 12.0, 2.6, 3.2, "bus_side", "ReferenceBus")
    print("faces:", K.STATS["faces"], flush=True)
    K.flush(mats, collision={"Roads", "Footpaths", "Buildings", "Landmark", "Terrain", "Lots"},
            surfaces={"Roads": "asphalt", "Footpaths": "kerb", "Terrain": "grass", "Lots": "concrete"})
    j = lambda a, b: C.junction(a, b)  # noqa: E731
    tr = lambda jj: jj["r"] + 3.0      # noqa: E731
    J1, J2, J3, J4 = j("QUEEN", "CEDAR"), j("CEDAR", "COLLEGE"), j("COLLEGE", "ELGIN"), j("ELGIN", "QUEEN")
    start = st0["stop"]
    legs = [C.lane_leg("QUEEN", start, J1["pos"], 0, tr(J1)),
            C.lane_leg("CEDAR", J1["pos"], J2["pos"], tr(J1), tr(J2)),
            C.lane_leg("COLLEGE", J2["pos"], J3["pos"], tr(J2), tr(J3)),
            C.lane_leg("ELGIN", J3["pos"], J4["pos"], tr(J3), tr(J4)),
            C.lane_leg("QUEEN", J4["pos"], start, tr(J4), 0)]
    path = C.join(legs)
    data = C.write_json(os.path.join(OUT, MAP + "_route.json"),
                        dict(map=MAP, country="Canada", city="Maplewood, Ontario (fictional, Toronto-inspired)",
                             route=dict(number="504", name_local="", name_en="Maplewood - College loop")),
                        path, stops, dict(position=[*start, 0.0], heading_deg_from_east=round(math.degrees(math.atan2(st0["hy"], st0["hx"])), 1),
                                          note="Queen St & Elgin St stop, eastbound; doors on the right"))
    NC.route_curve(bpy, path, "BusRoute_504")
    K.setup_world(sun_elev=34, sun_az=210, sun_energy=3.8, sky_strength=0.4, dust=1.2)
    cameras()
    if not _arg("--no-glb"):
        K.export_glb(os.path.join(OUT, MAP + ".glb"), {"Roads", "Footpaths", "Markings", "Buildings", "Landmark", "Lots", "Terrain",
                                                        "Vegetation", "Props", "Wires", "Vehicles", "Islands", "Backdrop"})
    K.save_blend(os.path.join(OUT, MAP + ".blend"))
    print("saved; route", data["route"]["length_m"], "m;", len(data["stops"]), "stops", flush=True)
    if _arg("--render"):
        K.render_previews(os.path.join(OUT, "previews"), int(_arg("--samples", 40)), _arg("--only"))


if __name__ == "__main__":
    main()
