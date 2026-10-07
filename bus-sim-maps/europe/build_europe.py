"""Lindenfeld - a German old town for NammaBusSim, built in Blender.

    blender -b -P build_europe.py -- [--out DIR] [--render] [--samples 40] [--no-glb] [--only Ring]

Right-hand traffic. A curving Ring road on the line of the old town wall,
with a tram on a grass track in its median, red bike lanes and linden
alleys; cobbled, winding Gassen inside the Ring lined with half-timbered
(Fachwerk) houses; a Marktplatz with the Rathaus and a fountain; a Gothic
church with a tall spire; radial Hauptstrassen out through the gates; a
Kreisverkehr (roundabout); Gruenderzeit perimeter blocks with stucco
facades and slate mansard roofs; German signage (Haltestelle, Vorfahrt,
Zone 30). Needs shapely (see ../india/README.md).
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from shapely.geometry import LineString, Point, Polygon


def _find_dir():
    cands = [os.path.dirname(os.path.abspath(__file__))] if "__file__" in globals() else []
    cands += [os.path.dirname(bpy.path.abspath(t.filepath)) for t in bpy.data.texts if t.filepath]
    cands += [os.environ.get("NBS_EUROPE_DIR", ""), os.getcwd()]
    for c in cands:
        if c and os.path.isfile(os.path.join(c, "build_europe.py")) and os.path.isdir(os.path.join(c, "textures")):
            return c
    raise RuntimeError("Can't find the europe map folder; set NBS_EUROPE_DIR")


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
SEED = int(_arg("--seed", 1871))
R = random.Random(SEED)
MAP = "europe_lindenfeld"
WORLD = (-700.0, -650.0, 700.0, 650.0)
CORE = (-470.0, -420.0, 480.0, 440.0)
FP = 0.14
CENTER = (0.0, 40.0)

MATS = {
    "asphalt": dict(img="asphalt.jpg", T=6.0, rough=0.85, bump=0.2),
    "cobbles": dict(img="cobbles.jpg", T=2.4, rough=0.75, bump=0.6),
    "sidewalk": dict(img="sidewalk.jpg", T=1.6, rough=0.8, bump=0.15),
    "curb": dict(img="curb.jpg", T=2.0, rough=0.75),
    "grass": dict(img="grass.jpg", T=4.0, rough=0.95),
    "gravel": dict(img="gravel.jpg", T=3.0, rough=0.95),
    "plaster": dict(img="plaster.jpg", T=8.0, rough=0.85),
    "bark": dict(img="bark.jpg", T=1.0, rough=0.9),
    "water": dict(img="water.jpg", T=4.0, rough=0.05),
    "leaves": dict(img="leaves.jpg", T=1.6, rough=0.9),
    "f_fw_white": dict(img="fachwerk_white.jpg", tw=7.8, th=6.0, rough=0.8),
    "f_fw_ochre": dict(img="fachwerk_ochre.jpg", tw=7.8, th=6.0, rough=0.8),
    "f_fw_rose": dict(img="fachwerk_rose.jpg", tw=7.8, th=6.0, rough=0.8),
    "f_alt_yellow": dict(img="altbau_yellow.jpg", tw=12.0, th=6.8, rough=0.8),
    "f_alt_green": dict(img="altbau_green.jpg", tw=12.0, th=6.8, rough=0.8),
    "f_alt_salmon": dict(img="altbau_salmon.jpg", tw=12.0, th=6.8, rough=0.8),
    "f_alt_grey": dict(img="altbau_grey.jpg", tw=12.0, th=6.8, rough=0.8),
    "f_modern": dict(img="modern.jpg", tw=15.0, th=12.0, rough=0.6),
    "roof_red": dict(img="roof_red.jpg", T=1.0, rough=0.6, bump=0.4),
    "roof_brown": dict(img="roof_brown.jpg", T=1.0, rough=0.6, bump=0.4),
    "slate": dict(img="slate.jpg", T=2.0, rough=0.5, bump=0.3),
    "sandstone": dict(img="sandstone.jpg", T=3.0, rough=0.8),
    "shops": dict(img="shop_atlas.jpg", rough=0.5),
    "sign_h": dict(img="sign_haltestelle.png", alpha=True, rough=0.4),
    "sign_vorfahrt": dict(img="sign_vorfahrt.png", alpha=True, rough=0.4),
    "sign_yield": dict(img="sign_yield.png", alpha=True, rough=0.4),
    "sign_zone30": dict(img="sign_zone30.jpg", rough=0.4),
    "sign_street": dict(img="sign_street.jpg", rough=0.4),
    "sign_stopname": dict(img="sign_stopname.jpg", rough=0.4),
    "sign_rathaus": dict(img="sign_rathaus.jpg", rough=0.5),
    "tram_side": dict(img="tram_side.jpg", rough=0.3),
    "bus_side": dict(img="bus_side.jpg", rough=0.3),
    "paint_white": dict(color=srgb(238, 238, 232), rough=0.6),
    "paint_yellow": dict(color=srgb(240, 190, 20), rough=0.6),
    "paint_bike": dict(color=srgb(170, 60, 50), rough=0.8),
    "steel": dict(color=srgb(120, 122, 126), rough=0.3, metal=1.0),
    "metal_light": dict(color=srgb(190, 192, 192), rough=0.4, metal=0.5),
    "metal_dark": dict(color=srgb(50, 52, 56), rough=0.45, metal=0.6),
    "anthracite": dict(color=srgb(60, 62, 66), rough=0.5),
    "glass": dict(color=srgb(70, 90, 100), rough=0.05, metal=0.4),
    "white": dict(color=srgb(240, 238, 232), rough=0.5),
    "timber": dict(color=srgb(58, 40, 30), rough=0.7),
    "copper_green": dict(color=srgb(90, 150, 130), rough=0.5, metal=0.3),
    "gold": dict(color=srgb(220, 170, 60), rough=0.25, metal=1.0),
    "wire": dict(color=srgb(18, 18, 18), rough=0.6),
    "rubber": dict(color=srgb(22, 22, 22), rough=0.9),
    "awning": dict(color=srgb(150, 40, 40), rough=0.7),
    "lamp_red": dict(color=srgb(230, 20, 20), emit=srgb(255, 30, 20), emit_s=10.0),
    "lamp_green": dict(color=srgb(20, 220, 80), emit=srgb(40, 255, 120), emit_s=10.0),
    "lamp_off": dict(color=srgb(36, 36, 36), rough=0.2),
    "lamp_white": dict(color=srgb(250, 250, 240), emit=srgb(255, 250, 235), emit_s=2.0),
    "car_white": dict(color=srgb(232, 232, 230), rough=0.25, metal=0.2),
    "car_black": dict(color=srgb(18, 18, 20), rough=0.2, metal=0.3),
    "car_silver": dict(color=srgb(170, 172, 176), rough=0.25, metal=0.7),
    "car_blue": dict(color=srgb(40, 70, 130), rough=0.25, metal=0.3),
    "car_red": dict(color=srgb(160, 30, 30), rough=0.25, metal=0.3),
    "far_ground": dict(color=srgb(98, 116, 74), rough=1.0),
}
K.configure(WORLD, MATS, os.path.join(HERE, "textures"), seed=SEED)

CLASSES = {
    "ring": dict(lanes=2, lane_w=3.25, median=7.0, shoulder=1.8, sw=3.5, rank=5, speed=50),
    "haupt": dict(lanes=1, lane_w=3.5, median=0.0, shoulder=1.6, sw=3.0, rank=4, speed=50),
    "strasse": dict(lanes=1, lane_w=3.0, median=0.0, shoulder=2.2, sw=2.5, rank=2, speed=30),
    "gasse": dict(lanes=1, lane_w=2.6, median=0.0, shoulder=0.0, sw=0.0, rank=1, speed=20),
}
C = NC.City(WORLD, CORE, CLASSES, drive="right", fp_h=FP)
SEAM = math.radians(135)       # where the closed Ring line starts (no route crosses it)


def ring_pt(a):
    rr = 1 + 0.07 * math.sin(3 * a + 0.4) + 0.045 * math.cos(5 * a)
    return (CENTER[0] + 255 * rr * math.cos(a), CENTER[1] + 195 * rr * math.sin(a))


def define_roads():
    n = 900
    pts = [ring_pt(SEAM + 2 * math.pi * k / n) for k in range(n + 1)]
    C.road("RING", "ring", pts, spline=False, name_local="Ring", name_en="Ring")
    N, E, S, W = ring_pt(math.pi / 2), ring_pt(0.0), ring_pt(-math.pi / 2), ring_pt(math.pi)
    C.road("N_RAD", "haupt", [N, (-5, 330), (-20, 500), (-25, 650)], start_on="RING", name_local="Nordstraße", name_en="Nordstrasse")
    C.road("S_RAD", "haupt", [S, (10, -260), (20, -450), (25, -650)], start_on="RING", name_local="Bahnhofstraße", name_en="Bahnhofstrasse")
    C.road("E_RAD", "haupt", [E, (380, 50), (550, 70), (700, 65)], start_on="RING", name_local="Ostallee", name_en="Ostallee")
    C.road("W_RAD", "haupt", [W, (-380, 30), (-550, 20), (-700, 25)], start_on="RING", name_local="Westallee", name_en="Westallee")
    C.road("WEST_ST", "haupt", [(-392, -650), (-388, -300), (-380, 30), (-386, 300), (-392, 650)], name_local="Lindenallee", name_en="Lindenallee")
    C.road("NORD", "haupt", [(-700, 420), (0, 432), (700, 410)], name_local="Nordring", name_en="Nordring")
    C.road("SUED", "haupt", [(-700, -400), (0, -412), (700, -396)], name_local="Südring", name_en="Suedring")
    C.road("OST", "strasse", [(470, -650), (472, 0), (468, 650)], name_local="Schulstraße", name_en="Schulstrasse")
    C.circle((-380.0, 30.0), 9.0, 17.0, "Kreisverkehr West", "West roundabout")
    # old town: cobbled Gassen winding from the gates to the Marktplatz
    G = "gasse"
    C.road("G_N", G, [N, (15, 170), (-5, 110), (5, 70)], start_on="RING", name_local="Marktgasse", name_en="Marktgasse")
    C.road("G_E", G, [E, (180, 55), (110, 30), (40, 42)], start_on="RING", name_local="Kirchgasse", name_en="Kirchgasse")
    C.road("G_S", G, [S, (-20, -80), (10, -20), (2, 12)], start_on="RING", name_local="Brückengasse", name_en="Brueckengasse")
    C.road("G_W", G, [W, (-170, 20), (-100, 55), (-40, 40)], start_on="RING", name_local="Webergasse", name_en="Webergasse")
    C.road("GX1", G, [(-130, 40), (-110, 120), (-50, 165), (12, 165)], start_on="G_W", end_on="G_N", name_local="Gerbergasse")
    C.road("GX2", G, [(110, 30), (120, -60), (60, -110), (-20, -80)], start_on="G_E", end_on="G_S", name_local="Mühlgasse")
    C.road("GX3", G, [(-100, 55), (-120, -50), (-20, -80)], start_on="G_W", end_on="G_S", name_local="Färbergasse")
    C.road("GX4", G, [(15, 170), (120, 140), (180, 55)], start_on="G_N", end_on="G_E", name_local="Schmiedgasse")


GERMAN = ["Goethestraße", "Schillerstraße", "Mozartstraße", "Lessingstraße", "Kantstraße", "Uhlandstraße", "Bismarckstraße",
          "Gartenstraße", "Hölderlinweg", "Rosenstraße", "Herderstraße", "Wielandstraße"]


def gruenderzeit_grids():
    k = [0]

    def nm(name, ax, i):
        k[0] += 1
        g = GERMAN[k[0] % len(GERMAN)]
        return dict(name_local=g, name_en=g.replace("ß", "ss").replace("ö", "oe"))
    for bounds, inside, ang in ((["RING", "N_RAD", "NORD", "OST", "E_RAD"], (300, 300), 6),
                                (["RING", "N_RAD", "NORD", "WEST_ST", "W_RAD"], (-250, 300), -5),
                                (["RING", "S_RAD", "SUED", "WEST_ST", "W_RAD"], (-250, -250), 4),
                                (["RING", "S_RAD", "SUED", "OST", "E_RAD"], (300, -250), -7)):
        C.grid_in_region(bounds, inside, inside, ang, [-140, -75, -10, 55, 120], [-170, -100, -30, 40, 110], "strasse", "strasse",
                         wiggle=3.0, min_len=45, prefix="Z" + str(len(C.roads)), names=nm)


def signal_rule(j, rs):
    ranks = sorted((r.rank for r in rs), reverse=True)
    return len(ranks) >= 2 and ranks[1] >= 4


def stop_rule(j, r):
    if j["signal"]:
        return True
    others = [C.rd[n].rank for n in j["roads"] if n != r.name]
    return others and max(others) > r.rank


def crosswalk_rule(j, r):
    return j["signal"] or bool(j["circle"])


# ------------------------------------------------------------ vegetation
def linden(x, y, z=FP, s=1.0):
    s *= R.uniform(0.85, 1.15)
    cyl("Vegetation", x, y, z, z + 3.2 * s, 0.24 * s, 0.17 * s, "bark", seg=7, cap=False)
    crown("Vegetation", "leaves", x, y, z + 7.0 * s, 3.4 * s, 3.4 * s, 4.2 * s, 9)


def car(x, y, yaw, color=None, z=0.0):
    color = color or R.choice(["car_white", "car_black", "car_silver", "car_silver", "car_blue", "car_red", "car_black"])
    obox("Vehicles", x, y, z + 0.3, 4.3, 1.8, 0.72, yaw, color)
    px, py = x - math.cos(yaw) * 0.15, y - math.sin(yaw) * 0.15
    obox("Vehicles", px, py, z + 1.02, 2.3, 1.64, 0.55, yaw, {"*": "glass", "top": color})
    for lx in (1.4, -1.4):
        for ly in (0.85, -0.85):
            qx, qy = local(x, y, yaw, lx, ly)
            ox, oy = -math.sin(yaw) * 0.1, math.cos(yaw) * 0.1
            tube("Vehicles", (qx - ox, qy - oy, z + 0.32), (qx + ox, qy + oy, z + 0.32), 0.32, "rubber", seg=8, cap=True)


def vehicle(x, y, yaw, L, W, H, mat, coll):
    c, s = math.cos(yaw), math.sin(yaw)

    def uv(fk, pts, m):
        if m != mat:
            return None
        out = []
        for p in pts:
            u = (((p[0] - x) * c + (p[1] - y) * s) + L / 2) / L
            v = (p[2] - 0.35) / (H - 0.35)
            out.append((u, 0.5 + v * 0.5) if fk == "s" else (1 - u, v * 0.5))
        return out
    obox(coll, x, y, 0.35, L, W, H - 0.35, yaw, {"n": mat, "s": mat, "*": "white", "top": "metal_light"}, uv=uv)
    for lx in (L / 2 - 2.5, -L / 2 + 2.8):
        for ly in (W / 2 - 0.1, -W / 2 + 0.1):
            px, py = local(x, y, yaw, lx, ly)
            tube(coll, (px + s * 0.15, py - c * 0.15, 0.45), (px - s * 0.15, py + c * 0.15, 0.45), 0.45, "rubber", seg=10, cap=True)


# -------------------------------------------------------------- buildings
def front_dir(yaw):
    return -math.sin(yaw), math.cos(yaw)


def gable(cx, cy, yaw, w, d, z, pitch, o, mat, wall_mat, ridge_along_street=True):
    """Gable roof. ridge_along_street=False puts the gable end toward the street (Fachwerk style)."""
    t = math.tan(math.radians(pitch))
    if not ridge_along_street:
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
        L = math.dist(q[0][:2], q[1][:2]) / MATS[mat]["T"]
        sl = math.hypot(hd, rise + o * t) / MATS[mat]["T"]
        face("Buildings", mat, q, [(0, 0), (L, 0), (L, sl), (0, sl)], (cx, cy))
        face("Buildings", "timber", [(a, b, c_ - 0.06) for a, b, c_ in q[::-1]], [(0, 0)] * 4, (cx, cy))
    for sgn in (-1, 1):
        g = [P(sgn * w / 2, -d / 2, z), P(sgn * w / 2, d / 2, z), P(sgn * w / 2, 0, z + rise)]
        if sgn < 0:
            g = [g[1], g[0], g[2]]
        face("Buildings", wall_mat, g, K.uv_facade(g, MATS[wall_mat]["tw"], MATS[wall_mat]["th"], z) if "tw" in MATS[wall_mat] else K.uv_world(g, 4.0), (cx, cy))
    return z + rise


def fachwerk_house(cx, cy, yaw, w, d, detail=True, shop=False):
    mat = R.choice(["f_fw_white", "f_fw_white", "f_fw_ochre", "f_fw_rose"])
    floors = R.choice([2, 3, 3, 4])
    gf = 3.4
    if shop:
        obox("Buildings", cx, cy, 0, w, d, gf, yaw, {"*": "plaster", "s": None, "top": None})
        A, B = local(cx, cy, yaw, -w / 2, -d / 2 - 0.01), local(cx, cy, yaw, w / 2, -d / 2 - 0.01)
        c = R.randrange(12)
        u0, v0 = (c % 4) / 4, 1 - (c // 4 + 1) / 3
        face("Buildings", "shops", [(A[0], A[1], 0), (B[0], B[1], 0), (B[0], B[1], gf), (A[0], A[1], gf)],
             [(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 1 / 3), (u0, v0 + 1 / 3)], (cx, cy))
        z0 = gf
    else:
        obox("Buildings", cx, cy, 0, w, d, 0.6, yaw, "sandstone")
        z0 = 0.6
    H = z0 + (floors - (1 if shop else 0)) * 3.0
    obox("Buildings", cx, cy, z0, w, d, H - z0, yaw, {"*": mat, "top": None}, zuv=z0, u0=R.choice([0, 1 / 3]))
    gable(cx, cy, yaw, w, d, H, R.uniform(50, 58), 0.4, R.choice(["roof_red", "roof_red", "roof_brown"]), mat, ridge_along_street=R.random() < 0.3)
    if detail and shop and R.random() < 0.5:
        px, py = local(cx, cy, yaw, 0, -d / 2 - 0.6)
        obox("Buildings", px, py, gf - 0.5, w * 0.8, 1.2, 0.08, yaw, "awning", skip=())


def altbau(cx, cy, yaw, w, d, detail=True, shop=False):
    """Gruenderzeit perimeter-block house: 4-5 floors, stucco, slate mansard."""
    mat = R.choice(["f_alt_yellow", "f_alt_green", "f_alt_salmon", "f_alt_grey", "f_alt_yellow"])
    floors = R.choice([4, 5, 5])
    gf = 3.6
    if shop:
        obox("Buildings", cx, cy, 0, w, d, gf, yaw, {"*": "plaster", "s": None, "top": None})
        n = max(1, int(round(w / 7)))
        for k in range(n):
            a, b = -w / 2 + w * k / n, -w / 2 + w * (k + 1) / n
            A, B = local(cx, cy, yaw, a, -d / 2 - 0.01), local(cx, cy, yaw, b, -d / 2 - 0.01)
            c = R.randrange(12)
            u0, v0 = (c % 4) / 4, 1 - (c // 4 + 1) / 3
            face("Buildings", "shops", [(A[0], A[1], 0), (B[0], B[1], 0), (B[0], B[1], gf), (A[0], A[1], gf)],
                 [(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 1 / 3), (u0, v0 + 1 / 3)], (cx, cy))
    else:
        obox("Buildings", cx, cy, 0, w, d, gf, yaw, {"*": mat, "top": None}, zuv=gf - 3.4)
    H = gf + (floors - 1) * 3.4
    obox("Buildings", cx, cy, gf, w, d, H - gf, yaw, {"*": mat, "top": None}, zuv=gf, u0=R.choice([0, 0.25, 0.5]))
    if not detail:
        obox("Buildings", cx, cy, H, w, d, 0.3, yaw, "slate", skip=("bottom",))
        return
    px, py = local(cx, cy, yaw, 0, -d / 2 - 0.25)
    obox("Buildings", px, py, H - 0.5, w, 0.5, 0.5, yaw, "white", skip=())        # main cornice
    # mansard: steep lower slope + flat top
    ins = 1.6
    P = lambda lx, ly, zz: (*local(cx, cy, yaw, lx, ly), zz)  # noqa: E731
    zt = H + 3.2
    corners = [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    inner = [(-w / 2 + ins, -d / 2 + ins), (w / 2 - ins, -d / 2 + ins), (w / 2 - ins, d / 2 - ins), (-w / 2 + ins, d / 2 - ins)]
    for i in range(4):
        a, b = corners[i], corners[(i + 1) % 4]
        ia, ib = inner[i], inner[(i + 1) % 4]
        q = [P(*a, H), P(*b, H), P(*ib, zt), P(*ia, zt)]
        L = math.dist(a, b) / 2.0
        face("Buildings", "slate", q, [(0, 0), (L, 0), (L, 1.7), (0, 1.7)], (cx, cy))
    face("Buildings", "slate", [P(*p, zt) for p in inner], [(p[0] / 2, p[1] / 2) for p in inner], (cx, cy))
    for k in range(int(w // 3.2)):      # dormers
        lx = -w / 2 + 1.8 + k * 3.2
        if lx > w / 2 - 1.5:
            break
        qx, qy = local(cx, cy, yaw, lx, -d / 2 + 0.9)
        obox("Buildings", qx, qy, H + 0.6, 1.3, 1.2, 1.6, yaw, {"*": "anthracite", "s": "glass", "top": "slate"})
    if R.random() < 0.4:
        cx2, cy2 = local(cx, cy, yaw, R.uniform(-w / 3, w / 3), d * 0.2)
        obox("Buildings", cx2, cy2, zt, 0.7, 0.5, 1.4, yaw, "plaster")     # chimney


def modern_block(cx, cy, yaw, w, d, detail=True):
    obox("Buildings", cx, cy, 0, w, d, 13.5, yaw, {"*": "f_modern", "top": "plaster"})


# --------------------------------------------------------------- specials
def build_marktplatz(plaza):
    K.tri_area("Plaza", "cobbles", plaza, 0.04)
    cx, cy = CENTER
    # fountain: octagonal sandstone basin + column with a gilded figure
    cyl("Plaza", cx, cy, 0.04, 0.8, 4.2, 4.2, "sandstone", seg=8, cap=False)
    cyl("Plaza", cx, cy, 0.04, 0.55, 3.9, 3.9, "water", seg=8)
    cyl("Plaza", cx, cy, 0.55, 5.5, 0.4, 0.3, "sandstone", seg=8)
    blob("Plaza", "gold", cx, cy, 6.0, 0.35, 0.35, 0.6, rough=0.05)
    # Rathaus on the north side: arcaded ground floor, stepped gable, clock tower
    rx, ry = cx, cy + 38
    obox("Landmark", rx, ry, 0, 34, 16, 12.0, 0, {"*": "sandstone", "top": None})
    for k in range(6):
        obox("Landmark", rx - 14 + k * 5.6, ry - 8.3, 0, 1.0, 0.6, 4.0, 0, "sandstone")
    gable(rx, ry, 0, 34, 16, 12.0, 52, 0.3, "roof_red", "sandstone", ridge_along_street=True)
    obox("Landmark", rx, ry - 2, 12.0, 5, 5, 14.0, 0, "sandstone")
    cyl("Landmark", rx, ry - 2, 26.0, 33.0, 3.4, 0.05, "copper_green", seg=8)
    plate("white", rx, ry - 4.55, 22.0, 0, 1, 2.4, 2.4, back=None, coll="Landmark")
    plate("sign_rathaus", rx, ry - 8.05, 5.0, 0, 1, 16, 2.0, back=None, coll="Landmark")
    # market stalls with striped roofs
    for k in range(6):
        sx, sy = cx - 22 + k * 8.5, cy - 14
        obox("Plaza", sx, sy, 0.04, 3.2, 2.4, 0.9, 0, "timber")
        obox("Plaza", sx, sy, 2.2, 3.6, 2.8, 0.15, 0, "awning", skip=())
        for dx in (-1.5, 1.5):
            cyl("Plaza", sx + dx, sy, 0.04, 2.2, 0.04, 0.04, "metal_dark", seg=4, cap=False)
    for k in range(6):
        a = 2 * math.pi * k / 6
        linden(cx + math.cos(a) * 26, cy + math.sin(a) * 18 - 4, 0.04, 0.8)


def build_church():
    """Gothic hall church with a tall spire, east of the Marktplatz."""
    cx, cy, yaw = 85.0, 105.0, math.radians(10)
    C.rmark(cx, cy, yaw, 60, 26)
    obox("Landmark", cx, cy, 0, 46, 20, 16.0, yaw, {"*": "sandstone", "top": None})
    gable(cx, cy, yaw, 46, 20, 16.0, 58, 0.3, "slate", "sandstone", ridge_along_street=True)
    for k in range(7):                   # buttresses + tall lancet windows
        lx = -21 + k * 7
        for sgn in (-1, 1):
            px, py = local(cx, cy, yaw, lx, sgn * 10.6)
            obox("Landmark", px, py, 0, 1.2, 1.4, 12.0, yaw, "sandstone")
            qx, qy = local(cx, cy, yaw, lx + 3.5, sgn * 10.02)
            hx, hy = (math.sin(yaw), -math.cos(yaw)) if sgn < 0 else (-math.sin(yaw), math.cos(yaw))
            plate("glass", qx, qy, 8.5, -hx, -hy, 1.8, 8.0, back=None, coll="Landmark")
    tx, ty = local(cx, cy, yaw, -26.0, 0)
    obox("Landmark", tx, ty, 0, 9, 9, 42.0, yaw, "sandstone")
    cyl("Landmark", tx, ty, 42.0, 74.0, 5.6, 0.1, "copper_green", seg=8)
    tube("Landmark", (tx, ty, 74.0), (tx, ty, 77.0), 0.12, "gold", seg=4)
    tube("Landmark", (tx - 0.9, ty, 76.0), (tx + 0.9, ty, 76.0), 0.1, "gold", seg=4)


def build_tram():
    """Tram on a grass track in the Ring median, with catenary masts."""
    r = C.rd["RING"]
    ln = r.line
    med = C.geo["median"]
    for o in (-1.6, 1.6):
        for e in lines_of(ln.offset_curve(o)):
            for g in (-0.72, 0.72):
                for e2 in lines_of(e.offset_curve(g)):
                    # rails sit on the grass track in the median and flush in the asphalt across junctions
                    for part in lines_of(e2.intersection(med)):
                        K.sweep_box("Roads", "steel", "steel", list(part.coords), 0.08, 0.22, 0.27)
                    for part in lines_of(e2.difference(med)):
                        K.ribbon("Markings", "steel", list(part.coords), 0.08, 0.013)
            K.sweep_box("Props", "wire", "wire", list(e.coords), 0.03, 6.2, 6.23)
    s = 6.0
    while s < ln.length:
        c = ln.interpolate(s)
        if C.geo["median"].contains(c) and C.in_core(c.x, c.y, 40):
            tx, ty = tangent_at(ln, s)
            cyl("Props", c.x, c.y, 0.22, 7.0, 0.13, 0.1, "anthracite", seg=8)
            tube("Props", (c.x - ty * 2.2, c.y + tx * 2.2, 6.6), (c.x + ty * 2.2, c.y - tx * 2.2, 6.6), 0.05, "anthracite", seg=4)
        s += 32.0
    s0 = ln.project(Point(*ring_pt(math.radians(20))))
    c = ln.interpolate(s0)
    tx, ty = tangent_at(ln, s0)
    x, y = c.x + ty * 1.6, c.y - tx * 1.6
    vehicle(x, y, math.atan2(ty, tx), 32.0, 2.4, 3.6, "tram_side", "Vehicles")


KEEP = []


def signals_and_signs():
    for j, x, y, hx, hy, r in C.signal_poles:
        cyl("Props", x, y, FP, 4.2, 0.08, 0.07, "anthracite", seg=8)
        green = (r.cls == "ring")
        yaw = math.atan2(hy, hx)
        obox("Props", x - hx * 0.2, y - hy * 0.2, 2.6, 0.32, 0.36, 1.2, yaw, "anthracite", skip=())
        for i, m in enumerate(("lamp_red" if not green else "lamp_off", "lamp_off", "lamp_green" if green else "lamp_off")):
            z = 3.6 - i * 0.38
            tube("Props", (x - hx * 0.37, y - hy * 0.37, z), (x - hx * 0.42, y - hy * 0.42, z), 0.11, m, seg=10, cap=True)
        KEEP.append((x, y, 2.0))
    for j, x, y, hx, hy, r in C.stop_signs:
        if not C.in_core(x, y):
            continue
        cyl("Props", x, y, FP if r.sw > 0 else 0.0, 2.8, 0.04, 0.04, "metal_light", seg=6)
        plate("sign_yield", x, y, 2.2, hx, hy, 0.8, 0.8)
        KEEP.append((x, y, 1.5))
    # Vorfahrtstrasse diamonds along the Ring, Zone 30 at the old-town gates
    r = C.rd["RING"]
    for k in range(10):
        s = r.line.length * (k + 0.5) / 10
        c = r.line.interpolate(s)
        tx, ty = tangent_at(r.line, s)
        x, y = c.x - ty * (r.cw / 2 + 0.6), c.y + tx * (r.cw / 2 + 0.6)
        if C.in_core(x, y) and all(math.dist((x, y), kk[:2]) > kk[2] for kk in KEEP):
            cyl("Props", x, y, FP, 2.8, 0.04, 0.04, "metal_light", seg=6)
            plate("sign_vorfahrt", x, y, 2.3, -tx, -ty, 0.7, 0.7)
    for g in ("G_N", "G_E", "G_S", "G_W"):
        ln = C.rd[g].line
        c = ln.interpolate(22.0)
        tx, ty = tangent_at(ln, 22.0)
        x, y = c.x + ty * 3.0, c.y - tx * 3.0
        cyl("Props", x, y, 0.0, 2.6, 0.04, 0.04, "metal_light", seg=6)
        plate("sign_zone30", x, y, 2.0, tx, ty, 0.6, 0.8)


def bus_stop(name_local, road, near, toward):
    st = C.stop_at(road, near, toward, kerb_extra=0.55)
    x, y, hx, hy, kx, ky = st["x"], st["y"], st["hx"], st["hy"], st["kx"], st["ky"]
    yaw = math.atan2(hy, hx)
    cyl("Props", x - kx * 0.4, y - ky * 0.4, FP, 3.0, 0.04, 0.04, "metal_light", seg=6)
    plate("sign_h", x - kx * 0.4, y - ky * 0.4, 2.6, -kx, -ky, 0.55, 0.55)
    plate("sign_stopname", x - kx * 0.4, y - ky * 0.4, 2.1, -kx, -ky, 0.9, 0.22)
    bx, by = x + kx * 0.6, y + ky * 0.6
    obox("Props", bx, by, 2.5, 4.6, 1.6, 0.1, yaw, "glass", skip=())
    obox("Props", bx + kx * 0.75, by + ky * 0.75, FP + 0.15, 4.4, 0.05, 2.2, yaw, "glass")
    KEEP.append((x, y, 6.0))
    en = name_local.replace("ß", "ss").replace("ü", "ue").replace("ö", "oe").replace("ä", "ae")
    return dict(name_local=name_local, name_en=en, stop_point=[round(st["stop"][0], 2), round(st["stop"][1], 2)], heading=[round(hx, 3), round(hy, 3)])


def street_furniture():
    for r in C.roads:
        if r.cls == "gasse":
            continue
        for pc in C.pieces(r, 6.0):
            if not C.in_core(*pc.interpolate(0.5, normalized=True).coords[0], 30):
                continue
            for side in (1, -1):
                s = R.uniform(4, 10)
                step = 11.0 if r.cls == "ring" else (16.0 if r.cls == "haupt" else 20.0)
                while s < pc.length - 4:
                    c = pc.interpolate(s)
                    tx, ty = tangent_at(pc, s)
                    nx, ny = -ty * side, tx * side
                    x, y = c.x + nx * (r.cw / 2 + 0.9), c.y + ny * (r.cw / 2 + 0.9)
                    if all(math.dist((x, y), kk[:2]) > kk[2] for kk in KEEP) and all(math.dist((x, y), cw) > 4 for cw in C.crosswalks):
                        linden(x, y)
                    s += step
                # parked cars along Strassen (in the parking strip)
                if r.cls == "strasse":
                    s = R.uniform(5, 12)
                    while s < pc.length - 6:
                        if R.random() < 0.55:
                            c = pc.interpolate(s)
                            tx, ty = tangent_at(pc, s)
                            nx, ny = -ty * side, tx * side
                            car(c.x + nx * (r.cw / 2 - 1.1), c.y + ny * (r.cw / 2 - 1.1), math.atan2(ty, tx) + (0 if side < 0 else math.pi))
                        s += 5.6
            # street lamps
            s = 12.0
            while s < pc.length - 4:
                c = pc.interpolate(s)
                tx, ty = tangent_at(pc, s)
                x, y = c.x + ty * (r.cw / 2 + 0.4), c.y - tx * (r.cw / 2 + 0.4)
                cyl("Props", x, y, FP, 5.5, 0.08, 0.06, "anthracite", seg=8)
                obox("Props", x, y, 5.5, 0.5, 0.5, 0.6, 0, {"*": "glass", "top": "anthracite", "bottom": "lamp_white"})
                s += 30.0


# ------------------------------------------------------------------ lots
def in_old_town(x, y):
    ln = C.rd["RING"].line
    return Polygon(ln.coords).contains(Point(x, y))


def pick(r, x, y):
    if r.cls == "gasse" or (r.cls == "ring" and in_old_town(x, y)):
        return dict(kind="fachwerk", w=R.uniform(6, 10), d=R.uniform(10, 14), setback=0.1, gap=0.05, tight=True,
                    shop=r.name in ("G_N", "G_E", "G_S", "G_W") and R.random() < 0.6)
    if r.cls in ("ring", "haupt"):
        return dict(kind="altbau", w=R.uniform(14, 22), d=R.uniform(13, 16), setback=0.2, gap=0.05, tight=True, shop=R.random() < 0.7)
    return dict(kind="altbau", w=R.uniform(14, 22), d=R.uniform(12, 15), setback=0.3, gap=0.05, tight=True, shop=R.random() < 0.15)


def build_lot(L):
    a = (L["cx"], L["cy"], L["yaw"], L["w"], L["d"])
    if L["kind"] == "fachwerk":
        fachwerk_house(*a, L["detail"], L.get("shop", False))
    else:
        altbau(*a, L["detail"], L.get("shop", False))


# ------------------------------------------------------------------ main
def cameras():
    cams = [
        K.add_camera("Cam_Aerial", (-380, -430, 270), (20, 60, 0), 30),
        C.lane_cam("Cam_Ring_Tram", "RING", ring_pt(math.radians(-25)), ring_pt(math.radians(30)), look=90, h=2.9),
        C.lane_cam("Cam_Gasse", "G_E", (200, 50), (40, 42), look=40, h=1.8, lens=22, look_h=4.0),
        K.add_camera("Cam_Marktplatz", (-22, 6, 1.8), (6, 60, 9), 24),
        C.lane_cam("Cam_Kreisverkehr", "WEST_ST", (-383, 68), (-392, -650), look=38, h=3.4, look_h=0.8),
        C.lane_cam("Cam_Gruenderzeit", "NORD", (-250, 428), (300, 425), look=90, h=2.6),
        K.add_camera("Cam_Church", (175, 40, 2.0), (70, 100, 35), 24),
        K.add_camera("Cam_TopDown", (0, 20, 900), (0, 20.001, 0), 50, ortho=1100),
    ]
    bpy.context.scene.camera = cams[0]


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = K.build_materials()
    define_roads()
    C.build_network(signal_rule)
    gruenderzeit_grids()
    C.juncs.clear()
    C.find_junctions(signal_rule)
    print("roads", len(C.roads), "junctions", len(C.juncs), flush=True)
    plaza = Polygon([(-36, 14), (36, 14), (40, 66), (-40, 66)]).buffer(4.0, join_style="round")

    def median_fn(med):
        K.tri_area("Roads", "grass", med, 0.22)
        K.ring_walls("Roads", med, 0.0, 0.22, lambda m: "curb")
    C.build_surfaces(asphalt="asphalt", footpath="sidewalk", kerb_road="curb", kerb_back="curb", corner_r=6.0, extra_road=plaza,
                     median_fn=median_fn, alt=[({"gasse"}, "cobbles", plaza)])
    styles = {"ring": dict(edge=False, divider=(3.0, 6.0), bike=1.6, bike_mat="paint_bike"),
              "haupt": dict(center="white_dashed", center_dash=(3.0, 6.0), bike=1.5, bike_mat="paint_bike")}
    C.build_markings(styles, crosswalk="lines", crosswalk_rule=crosswalk_rule, stop_rule=stop_rule)
    C.mark_poly(plaza.buffer(1.0), building=True)
    build_marktplatz(plaza)
    build_church()
    build_tram()
    stops = [bus_stop("Südtor", "RING", ring_pt(math.radians(-80)), ring_pt(0.0)),
             bus_stop("Ostring", "RING", ring_pt(math.radians(25)), ring_pt(math.radians(90))),
             bus_stop("Nordtor", "N_RAD", (-8, 340), (-25, 650)),
             bus_stop("Lindenplatz", "NORD", (-150, 430), (-700, 420)),
             bus_stop("Westpark", "WEST_ST", (-385, 200), (-392, -650)),
             bus_stop("Westtor", "W_RAD", (-330, 33), ring_pt(math.pi)),
             bus_stop("Stadtpark", "RING", ring_pt(math.radians(215)), ring_pt(math.radians(260)))]
    signals_and_signs()
    for rank in (5, 4, 2, 1):
        for r in C.roads:
            if r.rank == rank:
                C.frontage(r, pick, build_lot)
    C.fill_interiors([(9.0, 12.0), (7.0, 10.0)], lambda L: fachwerk_house(L["cx"], L["cy"], L["yaw"], L["w"], L["d"], L["detail"]),
                     step=3.0, pad=0.3, where=in_old_town)
    street_furniture()
    # roundabout island: a linden and flower bed
    ccx, ccy = C.circles[0]["c"]
    linden(ccx, ccy, 0.3, 1.1)
    NC.ground(WORLD, "grass", "far_ground")
    st0 = C.stop_at("RING", ring_pt(math.radians(-80)), ring_pt(0.0))
    vehicle(st0["stop"][0] - st0["hx"] * 3, st0["stop"][1] - st0["hy"] * 3, math.atan2(st0["hy"], st0["hx"]), 12.0, 2.55, 3.1, "bus_side", "ReferenceBus")
    print("faces:", K.STATS["faces"], flush=True)
    K.flush(mats, collision={"Roads", "Footpaths", "Buildings", "Landmark", "Plaza", "Terrain", "Islands"},
            surfaces={"Roads": "asphalt", "Footpaths": "kerb", "Terrain": "grass", "Plaza": "cobbles"})
    j = lambda a, b: C.junction(a, b)  # noqa: E731
    tr = lambda jj: jj["r"] + 3.0      # noqa: E731
    circ = C.circles[0]
    JN, JNO, JNW, JW = j("RING", "N_RAD"), j("N_RAD", "NORD"), j("NORD", "WEST_ST"), j("RING", "W_RAD")
    JS = j("RING", "S_RAD")
    start = st0["stop"]
    rc = circ["ro"] + 4.0
    legs = [C.lane_leg("RING", start, JN["pos"], 0, tr(JN)),
            C.lane_leg("N_RAD", JN["pos"], JNO["pos"], tr(JN), tr(JNO)),
            C.lane_leg("NORD", JNO["pos"], JNW["pos"], tr(JNO), tr(JNW)),
            C.lane_leg("WEST_ST", JNW["pos"], circ["c"], tr(JNW), rc),
            None,                                  # roundabout arc, filled in below
            C.lane_leg("W_RAD", circ["c"], JW["pos"], rc, tr(JW)),
            C.lane_leg("RING", JW["pos"], JS["pos"], tr(JW), tr(JS)),
            C.lane_leg("RING", JS["pos"], start, tr(JS), 0)]
    # roundabout: enter from the north arm (Lindenallee), leave east toward the Westtor
    a_in = C.arm_angle(circ, "WEST_ST")
    ln = C.rd["W_RAD"].line
    q = ln.interpolate(ln.project(Point(*circ["c"])) - (circ["ro"] + 8))
    a_out = math.atan2(q.y - circ["c"][1], q.x - circ["c"][0])
    if math.sin(a_in) < 0:
        a_in += math.pi
    legs[4] = C.circle_arc(circ, a_in + 0.18, a_out - 0.18, circ["ri"] + 5.0)
    path = C.join([l for l in legs if l])
    data = C.write_json(os.path.join(OUT, MAP + "_route.json"),
                        dict(map=MAP, country="Germany", city="Lindenfeld (fictional German old town)",
                             route=dict(number="17", name_local="Ringlinie", name_en="Ring line")),
                        path, stops, dict(position=[*start, 0.0], heading_deg_from_east=round(math.degrees(math.atan2(st0["hy"], st0["hx"])), 1),
                                          note="Haltestelle Suedtor on the Ring; doors on the right"))
    NC.route_curve(bpy, path, "BusRoute_17")
    K.setup_world(sun_elev=38, sun_az=200, sun_energy=4.0, sky_strength=0.4, dust=1.2)
    cameras()
    if not _arg("--no-glb"):
        K.export_glb(os.path.join(OUT, MAP + ".glb"), {"Roads", "Footpaths", "Markings", "Buildings", "Landmark", "Plaza", "Terrain",
                                                        "Vegetation", "Props", "Vehicles", "Islands", "Backdrop"})
    K.save_blend(os.path.join(OUT, MAP + ".blend"))
    print("saved; route", data["route"]["length_m"], "m;", len(data["stops"]), "stops", flush=True)
    if _arg("--render"):
        K.render_previews(os.path.join(OUT, "previews"), int(_arg("--samples", 40)), _arg("--only"))


if __name__ == "__main__":
    main()
