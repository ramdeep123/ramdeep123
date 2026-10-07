"""Sakuragaoka (桜ヶ丘) - a Tokyo-style district for NammaBusSim, built in Blender.

Run headless:
    blender -b -P build_city.py -- [--out DIR] [--render] [--samples 64] [--no-glb]
or open this file in Blender's Scripting tab and press Run Script.

Builds a ~1 km x 0.96 km Japanese city around a station bus terminal with
LEFT-HAND traffic: 4-lane arterial with median, 2-lane streets with sidewalks,
narrow residential lanes, a station rotary with bus berths, an elevated
railway, utility poles with wires, signals, bus stops, shops with Japanese
signage, mansions, houses with kawara roofs, a shrine, a park, a konbini and a
gas station. Writes:
    out/japan_sakuragaoka.blend   (textures packed, cameras + sun/sky set up)
    out/japan_sakuragaoka.glb     (game-ready, Y-up, embedded textures)
    out/japan_sakuragaoka_route.json  (bus route, stops, road graph, spawn)
    out/previews/*.jpg            (with --render)

Units are metres. Blender axes: +X east, +Y north, +Z up.
"""
import json
import math
import os
import random
import sys

import bpy
import bmesh
import numpy as np


# --------------------------------------------------------------- settings
def _find_dir():
    cands = []
    if "__file__" in globals():
        cands.append(os.path.dirname(os.path.abspath(__file__)))
    for t in bpy.data.texts:
        if t.filepath:
            cands.append(os.path.dirname(bpy.path.abspath(t.filepath)))
    cands += [os.environ.get("NBS_JAPAN_DIR", ""), os.getcwd()]
    for c in cands:
        if c and os.path.isdir(os.path.join(c, "textures")):
            return c
    raise RuntimeError("Can't find the textures/ folder; set NBS_JAPAN_DIR to the japan map folder")


HERE = _find_dir()
TEX = os.path.join(HERE, "textures")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def _arg(name, default=None):
    if name in ARGS:
        i = ARGS.index(name)
        return ARGS[i + 1] if i + 1 < len(ARGS) and not ARGS[i + 1].startswith("--") else True
    return default


OUT = os.path.abspath(_arg("--out", os.path.join(HERE, "out")))
SEED = int(_arg("--seed", 2026))
R = random.Random(SEED)
MAP_NAME = "japan_sakuragaoka"

CORE = (-380.0, -300.0, 380.0, 380.0)      # drivable, fully detailed area
WORLD = (-560.0, -470.0, 560.0, 550.0)     # incl. low-detail surroundings
CHUNK = 200.0
STATION = (0.0, 205.0)
EPS = 1e-3

# road classes - Japanese standards, left-hand traffic
RC = {
    "arterial": dict(lane_w=3.25, lanes=2, median=1.6, shoulder=0.5, sw=4.5, rank=3),
    "secondary": dict(lane_w=3.25, lanes=1, median=0.0, shoulder=0.75, sw=3.0, rank=2),
    "lane": dict(lane_w=2.5, lanes=1, median=0.0, shoulder=0.0, sw=0.0, rank=1),
}


def in_core(x, y, pad=0.0):
    return CORE[0] - pad <= x <= CORE[2] + pad and CORE[1] - pad <= y <= CORE[3] + pad


# ------------------------------------------------------------- materials
def srgb(*c):
    return tuple(((v / 255) / 12.92) if v / 255 <= 0.04045 else (((v / 255) + 0.055) / 1.055) ** 2.4 for v in c)


MATS = {
    # ground & road
    "asphalt": dict(img="asphalt.jpg", T=6.0, rough=0.88, bump=0.25),
    "sidewalk": dict(img="sidewalk.jpg", T=2.4, rough=0.8, bump=0.15),
    "curb": dict(img="curb.jpg", T=2.0, rough=0.8),
    "tactile_bars": dict(img="tactile_bars.jpg", T=0.3, rough=0.6),
    "tactile_dots": dict(img="tactile_dots.jpg", T=0.3, rough=0.6),
    "ground": dict(img="ground.jpg", T=24.0, rough=0.95),
    "grass": dict(img="grass.jpg", T=4.0, rough=0.95),
    "gravel": dict(img="gravel.jpg", T=3.0, rough=0.95, bump=0.3),
    "concrete": dict(img="concrete.jpg", T=6.0, rough=0.85),
    "blockwall": dict(img="block_wall.jpg", T=1.6, rough=0.9),
    "paint_white": dict(color=srgb(236, 236, 230), rough=0.55),
    "paint_yellow": dict(color=srgb(236, 170, 20), rough=0.55),
    "paint_tomare": dict(img="paint_tomare.png", alpha=True, rough=0.55),
    "paint_bus": dict(img="paint_bus.png", alpha=True, rough=0.55),
    # roofs
    "roof_flat": dict(img="roof_flat.jpg", T=10.0, rough=0.85),
    "kawara_grey": dict(img="roof_kawara_grey.jpg", T=2.0, rough=0.5, bump=0.4),
    "kawara_blue": dict(img="roof_kawara_blue.jpg", T=2.0, rough=0.45, bump=0.4),
    "kawara_brown": dict(img="roof_kawara_brown.jpg", T=2.0, rough=0.5, bump=0.4),
    "roof_metal_green": dict(img="roof_metal_green.jpg", T=2.0, rough=0.35, metal=0.3, bump=0.2),
    "roof_metal_red": dict(img="roof_metal_red.jpg", T=2.0, rough=0.35, metal=0.3, bump=0.2),
    # facades (tw x th metres per texture tile)
    "f_office": dict(img="facade_office.jpg", tw=14.4, th=14.4, rough=0.15, metal=0.3),
    "f_mid_beige": dict(img="facade_midrise_beige.jpg", tw=12.8, th=12.8, rough=0.6),
    "f_mid_brick": dict(img="facade_midrise_brick.jpg", tw=12.8, th=12.8, rough=0.7),
    "f_mid_grey": dict(img="facade_midrise_grey.jpg", tw=12.8, th=12.8, rough=0.6),
    "f_mansion_white": dict(img="facade_mansion_white.jpg", tw=13.5, th=12.0, rough=0.6),
    "f_mansion_tile": dict(img="facade_mansion_tile.jpg", tw=13.5, th=12.0, rough=0.6),
    "f_house_white": dict(img="facade_house_white.jpg", tw=7.2, th=5.8, rough=0.7),
    "f_house_beige": dict(img="facade_house_beige.jpg", tw=7.2, th=5.8, rough=0.7),
    "f_house_grey": dict(img="facade_house_grey.jpg", tw=7.2, th=5.8, rough=0.7),
    "f_apaato": dict(img="facade_apaato.jpg", tw=12.0, th=5.8, rough=0.7),
    "wall_light": dict(img="wall_side_light.jpg", T=8.0, rough=0.8),
    "wall_dark": dict(img="wall_side_dark.jpg", T=8.0, rough=0.8),
    # atlases & signs
    "shops": dict(img="shop_atlas.jpg", rough=0.3),
    "kanban": dict(img="kanban_atlas.png", rough=0.4, emit_tex=0.6),
    "billboard": dict(img="billboard_atlas.jpg", rough=0.5),
    "konbini": dict(img="konbini.jpg", rough=0.2, emit_tex=0.4),
    "station_sign": dict(img="station_sign.png", rough=0.4, emit_tex=0.3),
    "busstop_plate": dict(img="busstop_plate.png", alpha=True, rough=0.4),
    "timetable": dict(img="timetable.jpg", rough=0.4),
    "sign_stop": dict(img="sign_stop.png", alpha=True, rough=0.4),
    "sign_speed": dict(img="sign_speed40.png", alpha=True, rough=0.4),
    "sign_dir": dict(img="sign_direction.jpg", rough=0.4),
    "vending": dict(img="vending.jpg", rough=0.3, emit_tex=0.5),
    "bus_side": dict(img="bus_side.jpg", rough=0.3),
    "train_side": dict(img="train_side.jpg", rough=0.25, metal=0.4),
    "shrine_plaque": dict(img="shrine_plaque.jpg", rough=0.5),
    "berth_signs": dict(img="berth_signs.jpg", rough=0.4, emit_tex=0.4),
    "leaves": dict(img="leaves.jpg", T=1.6, rough=0.9),
    "far_ground": dict(img="ground.jpg", rough=1.0),
    "hedge": dict(img="leaves.jpg", T=1.5, rough=0.9),
    # plain
    "metal_light": dict(color=srgb(196, 198, 196), rough=0.4, metal=0.5),
    "metal_dark": dict(color=srgb(70, 72, 76), rough=0.45, metal=0.6),
    "steel": dict(color=srgb(150, 152, 156), rough=0.3, metal=1.0),
    "pole_grey": dict(color=srgb(168, 168, 162), rough=0.8),
    "wire": dict(color=srgb(20, 20, 22), rough=0.6),
    "guard_white": dict(color=srgb(232, 232, 228), rough=0.4),
    "vermilion": dict(color=srgb(212, 60, 30), rough=0.5),
    "black_wood": dict(color=srgb(40, 34, 30), rough=0.7),
    "wood": dict(color=srgb(150, 110, 70), rough=0.7),
    "glass": dict(color=srgb(60, 78, 92), rough=0.05, metal=0.4),
    "frosted": dict(color=srgb(200, 210, 214), rough=0.35),
    "signal_body": dict(color=srgb(90, 96, 104), rough=0.5, metal=0.3),
    "lamp_green": dict(color=srgb(0, 200, 170), emit=srgb(0, 255, 200), emit_s=12.0),
    "lamp_red": dict(color=srgb(230, 20, 20), emit=srgb(255, 30, 20), emit_s=12.0),
    "lamp_off": dict(color=srgb(40, 40, 40), rough=0.2),
    "lamp_white": dict(color=srgb(250, 250, 240), emit=srgb(255, 250, 235), emit_s=2.0),
    "orange": dict(color=srgb(240, 120, 20), rough=0.5),
    "mirror": dict(color=srgb(230, 230, 230), rough=0.02, metal=1.0),
    "rubber": dict(color=srgb(24, 24, 24), rough=0.9),
    "red_paint": dict(color=srgb(200, 30, 30), rough=0.5),
    "green_paint": dict(color=srgb(30, 120, 60), rough=0.5),
    "soil": dict(color=srgb(78, 62, 48), rough=1.0),
    "car_white": dict(color=srgb(232, 232, 230), rough=0.25, metal=0.2),
    "car_black": dict(color=srgb(18, 18, 20), rough=0.2, metal=0.3),
    "car_silver": dict(color=srgb(170, 172, 176), rough=0.25, metal=0.7),
    "car_blue": dict(color=srgb(40, 70, 130), rough=0.25, metal=0.3),
    "car_red": dict(color=srgb(160, 30, 30), rough=0.25, metal=0.3),
    "car_taxi": dict(color=srgb(230, 190, 30), rough=0.3, metal=0.2),
    "led_sign": dict(color=srgb(20, 20, 20), emit=srgb(255, 150, 0), emit_s=3.0),
}
_IMG_SIZE = {}


def load_img(name):
    path = os.path.join(TEX, name)
    img = bpy.data.images.load(path, check_existing=True)
    _IMG_SIZE[name] = tuple(img.size)
    return img


def build_materials():
    out = {}
    for name, spec in MATS.items():
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = spec.get("rough", 0.8)
        bsdf.inputs["Metallic"].default_value = spec.get("metal", 0.0)
        if "img" in spec:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = load_img(spec["img"])
            tex.location = (-500, 200)
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
            if spec.get("alpha"):
                nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
                for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "HASHED")):
                    try:
                        setattr(m, attr, val)
                    except Exception:
                        pass
            if spec.get("bump"):
                bump = nt.nodes.new("ShaderNodeBump")
                bump.location = (-200, -200)
                bump.inputs["Strength"].default_value = spec["bump"]
                if "Distance" in bump.inputs:
                    bump.inputs["Distance"].default_value = 0.02
                nt.links.new(tex.outputs["Color"], bump.inputs["Height"])
                nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
            if spec.get("emit_tex"):
                nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
                bsdf.inputs["Emission Strength"].default_value = spec["emit_tex"]
        else:
            bsdf.inputs["Base Color"].default_value = (*spec["color"], 1.0)
        if spec.get("emit"):
            bsdf.inputs["Emission Color"].default_value = (*spec["emit"], 1.0)
            bsdf.inputs["Emission Strength"].default_value = spec.get("emit_s", 5.0)
        m.diffuse_color = (*spec.get("color", (0.6, 0.6, 0.6)), 1.0)
        out[name] = m
    return out


# ------------------------------------------------------- mesh accumulator
class Batch:
    __slots__ = ("v", "f", "uv", "sm")

    def __init__(self):
        self.v, self.f, self.uv, self.sm = [], [], [], []


BATCHES = {}
STATS = {"faces": 0}


def _bkey(coll, mat, ref):
    cx = int(math.floor((ref[0] - WORLD[0]) / CHUNK))
    cy = int(math.floor((ref[1] - WORLD[1]) / CHUNK))
    return (coll, mat, cx, cy)


def face(coll, mat, pts, uvs, ref=None, smooth=False):
    key = _bkey(coll, mat, ref or pts[0])
    b = BATCHES.get(key)
    if b is None:
        b = BATCHES[key] = Batch()
    i0 = len(b.v)
    b.v.extend(pts)
    b.f.append(tuple(range(i0, i0 + len(pts))))
    b.uv.append(uvs)
    b.sm.append(smooth)
    STATS["faces"] += 1


def _normal(pts):
    nx = ny = nz = 0.0
    for i in range(len(pts)):
        x0, y0, z0 = pts[i]
        x1, y1, z1 = pts[(i + 1) % len(pts)]
        nx += (y0 - y1) * (z0 + z1)
        ny += (z0 - z1) * (x0 + x1)
        nz += (x0 - x1) * (y0 + y1)
    l = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
    return nx / l, ny / l, nz / l


def uv_world(pts, T):
    nx, ny, nz = _normal(pts)
    if abs(nz) > 0.7:
        return [(p[0] / T, p[1] / T) for p in pts]
    rx, ry = -ny, nx
    l = math.hypot(rx, ry) or 1.0
    rx, ry = rx / l, ry / l
    return [((p[0] * rx + p[1] * ry) / T, p[2] / T) for p in pts]


def uv_facade(pts, tw, th, z0, u0=0.0):
    nx, ny, nz = _normal(pts)
    rx, ry = -ny, nx
    l = math.hypot(rx, ry) or 1.0
    rx, ry = rx / l, ry / l
    base = min(p[0] * rx + p[1] * ry for p in pts)
    return [((p[0] * rx + p[1] * ry - base) / tw + u0, (p[2] - z0) / th) for p in pts]


def uv_rect(pts, u0, v0, u1, v1):
    """Stretch one texture rect over a quad given in (bl, br, tr, tl) order."""
    return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)][: len(pts)]


def auto_uv(mat, pts):
    spec = MATS[mat]
    if "T" in spec:
        return uv_world(pts, spec["T"])
    if "tw" in spec:
        return uv_facade(pts, spec["tw"], spec["th"], 0.0)
    return [(0.0, 0.0)] * len(pts)


def poly(coll, mat, pts, uvs=None, ref=None):
    face(coll, mat, pts, uvs or auto_uv(mat, pts), ref)


BOX_FACES = {
    "top": lambda x0, y0, z0, x1, y1, z1: [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
    "bottom": lambda x0, y0, z0, x1, y1, z1: [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)],
    "s": lambda x0, y0, z0, x1, y1, z1: [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
    "n": lambda x0, y0, z0, x1, y1, z1: [(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)],
    "e": lambda x0, y0, z0, x1, y1, z1: [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
    "w": lambda x0, y0, z0, x1, y1, z1: [(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)],
}


def box(coll, x0, y0, z0, x1, y1, z1, mat, skip=("bottom",), uv=None):
    """Axis-aligned box. mat: name or {face: name}. uv: optional fn(face, pts, mat)."""
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    ref = ((x0 + x1) / 2, (y0 + y1) / 2)
    for fk, fn in BOX_FACES.items():
        if fk in skip:
            continue
        m = mat.get(fk, mat.get("*")) if isinstance(mat, dict) else mat
        if m is None:
            continue
        pts = fn(x0, y0, z0, x1, y1, z1)
        uvs = uv(fk, pts, m) if uv else None
        face(coll, m, pts, uvs or auto_uv(m, pts), ref)


def obox(coll, cx, cy, z0, sx, sy, sz, yaw, mat, skip=("bottom",), uv=None):
    """Box centred on (cx, cy), local size sx (along yaw) x sy, from z0 to z0+sz."""
    c, s = math.cos(yaw), math.sin(yaw)

    def T(p):
        lx, ly, z = p
        return (cx + lx * c - ly * s, cy + lx * s + ly * c, z)
    hx, hy = sx / 2, sy / 2
    for fk, fn in BOX_FACES.items():
        if fk in skip:
            continue
        m = mat.get(fk, mat.get("*")) if isinstance(mat, dict) else mat
        if m is None:
            continue
        pts = [T(p) for p in fn(-hx, -hy, z0, hx, hy, z0 + sz)]
        uvs = uv(fk, pts, m) if uv else None
        face(coll, m, pts, uvs or auto_uv(m, pts), (cx, cy))


def cyl(coll, cx, cy, z0, z1, r0, r1, mat, seg=8, cap=True, uvT=1.0):
    ring0 = [(cx + r0 * math.cos(2 * math.pi * i / seg), cy + r0 * math.sin(2 * math.pi * i / seg), z0) for i in range(seg)]
    ring1 = [(cx + r1 * math.cos(2 * math.pi * i / seg), cy + r1 * math.sin(2 * math.pi * i / seg), z1) for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        pts = [ring0[i], ring0[j], ring1[j], ring1[i]]
        face(coll, mat, pts, [(i / seg, z0 / uvT), ((i + 1) / seg, z0 / uvT), ((i + 1) / seg, z1 / uvT), (i / seg, z1 / uvT)], (cx, cy), smooth=True)
    if cap:
        face(coll, mat, ring1, [(0.5 + 0.5 * math.cos(2 * math.pi * i / seg), 0.5 + 0.5 * math.sin(2 * math.pi * i / seg)) for i in range(seg)], (cx, cy))


def tube(coll, p0, p1, r, mat, seg=4, cap=False, ref=None):
    d = np.subtract(p1, p0)
    L = float(np.linalg.norm(d))
    if L < 1e-6:
        return
    d = d / L
    a = np.array((0, 0, 1.0)) if abs(d[2]) < 0.9 else np.array((1.0, 0, 0))
    u = np.cross(d, a)
    u /= np.linalg.norm(u)
    v = np.cross(d, u)
    rings = []
    for p in (p0, p1):
        rings.append([tuple(np.add(p, r * (math.cos(2 * math.pi * i / seg) * u + math.sin(2 * math.pi * i / seg) * v))) for i in range(seg)])
    for i in range(seg):
        j = (i + 1) % seg
        face(coll, mat, [rings[0][i], rings[0][j], rings[1][j], rings[1][i]],
             [(i / seg, 0), ((i + 1) / seg, 0), ((i + 1) / seg, L), (i / seg, L)], ref or p0, smooth=seg > 4)
    if cap:
        face(coll, mat, rings[1], [(0.5, 0.5)] * seg, ref or p0)
        face(coll, mat, rings[0][::-1], [(0.5, 0.5)] * seg, ref or p0)


def prism(coll, pts2d, z0, z1, mat_top, mat_side, top=True):
    n = len(pts2d)
    ref = (sum(p[0] for p in pts2d) / n, sum(p[1] for p in pts2d) / n)
    for i in range(n):
        a, b = pts2d[i], pts2d[(i + 1) % n]
        pts = [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)]
        poly(coll, mat_side, pts, ref=ref)
    if top:
        poly(coll, mat_top, [(p[0], p[1], z1) for p in pts2d], ref=ref)


def stadium(x0, y0, x1, y1, seg=10):
    """Rounded rectangle (semicircle ends on the short sides), CCW."""
    w, h = x1 - x0, y1 - y0
    r = min(w, h) / 2
    pts = []
    if w >= h:
        cy = (y0 + y1) / 2
        for i in range(seg + 1):
            a = -math.pi / 2 + math.pi * i / seg
            pts.append((x1 - r + r * math.cos(a), cy + r * math.sin(a)))
        for i in range(seg + 1):
            a = math.pi / 2 + math.pi * i / seg
            pts.append((x0 + r + r * math.cos(a), cy + r * math.sin(a)))
    else:
        cx = (x0 + x1) / 2
        for i in range(seg + 1):
            a = math.pi * i / seg
            pts.append((cx + r * math.cos(a), y1 - r + r * math.sin(a)))
        for i in range(seg + 1):
            a = math.pi + math.pi * i / seg
            pts.append((cx + r * math.cos(a), y0 + r + r * math.sin(a)))
    return pts


_ICO = {}


def ico(level=2):
    if level not in _ICO:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=level, radius=1.0)
        _ICO[level] = ([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces])
        bm.free()
    return _ICO[level]


def blob(coll, mat, cx, cy, cz, rx, ry, rz, rough=0.18, level=2):
    verts, faces = ico(level)
    jit = [1.0 + R.uniform(-rough, rough) for _ in verts]
    P = [(cx + v[0] * rx * j, cy + v[1] * ry * j, cz + v[2] * rz * j) for v, j in zip(verts, jit)]
    T = MATS[mat].get("T", 3.0)
    for f in faces:
        pts = [P[i] for i in f]
        face(coll, mat, pts, [((p[0] + p[1]) / T, p[2] / T) for p in pts], (cx, cy), smooth=True)


# ----------------------------------------------------------- occupancy
RES = 0.5
GX = int((WORLD[2] - WORLD[0]) / RES)
GY = int((WORLD[3] - WORLD[1]) / RES)
OCC = np.zeros((GY, GX), dtype=bool)       # roads, plazas, specials: never overlap
BLD = np.zeros((GY, GX), dtype=bool)       # buildings: keep a small gap between them


def _cells(x0, y0, x1, y1):
    i0 = int(math.floor((min(x0, x1) - WORLD[0]) / RES))
    i1 = int(math.ceil((max(x0, x1) - WORLD[0]) / RES))
    j0 = int(math.floor((min(y0, y1) - WORLD[1]) / RES))
    j1 = int(math.ceil((max(y0, y1) - WORLD[1]) / RES))
    return max(0, i0), min(GX, i1), max(0, j0), min(GY, j1)


def mark(x0, y0, x1, y1, pad=0.0, building=False):
    i0, i1, j0, j1 = _cells(x0 - pad, y0 - pad, x1 + pad, y1 + pad)
    OCC[j0:j1, i0:i1] = True
    if building:
        BLD[j0:j1, i0:i1] = True


def is_free(x0, y0, x1, y1, pad=0.0):
    """Free of hard obstacles inside the rect, and of buildings within pad of it."""
    if min(x0, x1) < WORLD[0] or max(x0, x1) > WORLD[2] or min(y0, y1) < WORLD[1] or max(y0, y1) > WORLD[3]:
        return False
    i0, i1, j0, j1 = _cells(x0, y0, x1, y1)
    if OCC[j0:j1, i0:i1].any():
        return False
    i0, i1, j0, j1 = _cells(x0 - pad, y0 - pad, x1 + pad, y1 + pad)
    return not BLD[j0:j1, i0:i1].any()


# ----------------------------------------------------------- road network
class Road:
    def __init__(self, axis, c, a, b, cls, name_ja="", name_en=""):
        self.axis, self.c, self.a, self.b, self.cls = axis, c, a, b, cls
        self.name_ja, self.name_en = name_ja, name_en
        p = RC[cls]
        self.p = p
        self.cw = p["median"] + 2 * (p["lanes"] * p["lane_w"] + p["shoulder"])
        self.sw = p["sw"]
        self.rank = p["rank"]
        self.xings = []           # (pos, other, other_neg, other_pos)
        self.sw_gaps = {-1: [], 1: []}

    def W(self, s, t):
        return (s, self.c + t) if self.axis == "x" else (self.c + t, s)

    def rect(self, s0, s1, t0, t1):
        xa, ya = self.W(s0, t0)
        xb, yb = self.W(s1, t1)
        return (min(xa, xb), min(ya, yb), max(xa, xb), max(ya, yb))

    @property
    def gutter(self):
        return 0.35 if self.sw == 0 else 0.0

    @property
    def half(self):
        return self.cw / 2 + self.sw + self.gutter

    def dir_vec(self):
        return (1.0, 0.0) if self.axis == "x" else (0.0, 1.0)

    def perp_vec(self):
        return (0.0, 1.0) if self.axis == "x" else (1.0, 0.0)


WX0, WY0, WX1, WY1 = WORLD
ROADS = [
    # E-W (axis x, c = y)
    Road("x", -250, WX0, WX1, "lane"),
    Road("x", -210, 140, WX1, "lane"),
    Road("x", -170, WX0, WX1, "secondary", "南通り", "Minami-dori"),
    Road("x", -100, -220, 140, "lane"),
    Road("x", -50, 140, WX1, "lane"),
    Road("x", 0, WX0, WX1, "arterial", "桜通り", "Sakura-dori"),
    Road("x", 70, WX0, 0, "lane"),
    Road("x", 75, 0, 300, "lane"),
    Road("x", 110, -380, -220, "lane"),
    Road("x", 150, WX0, WX1, "secondary", "駅前通り", "Ekimae-dori"),
    Road("x", 290, WX0, WX1, "secondary", "北通り", "Kita-dori"),
    Road("x", 345, WX0, WX1, "lane"),
    Road("x", 420, WX0, WX1, "secondary"),
    Road("x", -360, WX0, WX1, "secondary"),
    # N-S (axis y, c = x)
    Road("y", -450, WY0, WY1, "secondary"),
    Road("y", -300, WY0, WY1, "lane"),
    Road("y", -260, -250, -170, "lane"),
    Road("y", -220, WY0, WY1, "secondary", "西通り", "Nishi-dori"),
    Road("y", -140, -250, 150, "lane"),
    Road("y", -70, -170, 150, "lane"),
    Road("y", 0, WY0, 150, "arterial", "駅前大通り", "Ekimae-odori"),
    Road("y", 20, 290, WY1, "lane"),
    Road("y", -110, 290, WY1, "lane"),
    Road("y", 70, -250, 150, "lane"),
    Road("y", 140, WY0, WY1, "secondary", "東通り", "Higashi-dori"),
    Road("y", 220, -170, 150, "lane"),
    Road("y", 230, 290, WY1, "lane"),
    Road("y", 300, WY0, WY1, "lane"),
    Road("y", 450, WY0, WY1, "secondary"),
]
XINGS = []


def connect_roads():
    ew = [r for r in ROADS if r.axis == "x"]
    ns = [r for r in ROADS if r.axis == "y"]
    for r1 in ew:
        for r2 in ns:
            if r1.a - EPS <= r2.c <= r1.b + EPS and r2.a - EPS <= r1.c <= r2.b + EPS:
                ns_s, ns_n = r2.a < r1.c - EPS, r2.b > r1.c + EPS
                ew_w, ew_e = r1.a < r2.c - EPS, r1.b > r2.c + EPS
                r1.xings.append((r2.c, r2, ns_s, ns_n))
                r2.xings.append((r1.c, r1, ew_w, ew_e))
                XINGS.append(dict(x=r2.c, y=r1.c, ew=r1, ns=r2, arms=dict(e=ew_e, w=ew_w, n=ns_n, s=ns_s)))
    for r in ROADS:
        r.xings.sort(key=lambda t: t[0])


def subtract(iv, cuts):
    out = [iv]
    for c0, c1 in cuts:
        nxt = []
        for a, b in out:
            if c1 <= a or c0 >= b:
                nxt.append((a, b))
                continue
            if c0 > a:
                nxt.append((a, c0))
            if c1 < b:
                nxt.append((c1, b))
        out = nxt
    return [(a, b) for a, b in out if b - a > 0.05]


def owns(r, o):
    return r.sw > o.sw or (r.sw == o.sw and r.axis == "x")


def carriage_pieces(r):
    return subtract((r.a, r.b), [(p - o.cw / 2, p + o.cw / 2) for p, o, _, _ in r.xings])


def wants_crosswalk(r, o):
    """Crosswalk across road r's arm where it meets o."""
    return o.sw > 0 and (r.rank >= 2 or o.rank >= 2)


def stop_controlled(r, o):
    return r.rank < o.rank


# --------------------------------------------------------------- roads
def build_roads():
    C = "Roads"
    for x in XINGS:
        ew, ns = x["ew"], x["ns"]
        x0, x1 = x["x"] - ns.cw / 2, x["x"] + ns.cw / 2
        y0, y1 = x["y"] - ew.cw / 2, x["y"] + ew.cw / 2
        poly(C, "asphalt", [(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)])
    for r in ROADS:
        mark(*r.rect(r.a, r.b, -r.half, r.half))
        for s0, s1 in carriage_pieces(r):
            # split long pieces so chunks stay local
            n = max(1, int((s1 - s0) // 60))
            for k in range(n):
                a = s0 + (s1 - s0) * k / n
                b = s0 + (s1 - s0) * (k + 1) / n
                x0, y0, x1, y1 = r.rect(a, b, -r.cw / 2, r.cw / 2)
                poly(C, "asphalt", [(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)])
        if r.sw > 0:
            build_sidewalks(r)
        else:
            build_gutters(r)
        build_markings(r)


SW_H = 0.15


def build_gutters(r):
    """L-shaped concrete gutter (側溝) along both edges of narrow lanes."""
    for side in (-1, 1):
        cuts = [(p - o.half, p + o.half) for p, o, neg, pos in r.xings if (pos if side > 0 else neg)]
        for s0, s1 in subtract((r.a, r.b), cuts):
            n = max(1, int((s1 - s0) // 50))
            for k in range(n):
                a = s0 + (s1 - s0) * k / n
                b = s0 + (s1 - s0) * (k + 1) / n
                x0, y0, x1, y1 = r.rect(a, b, side * r.cw / 2, side * r.half)
                poly("Roads", "concrete", [(x0, y0, 0.006), (x1, y0, 0.006), (x1, y1, 0.006), (x0, y1, 0.006)])


def sidewalk_cuts(r, side):
    cuts = []
    for p, o, neg, pos in r.xings:
        if not (pos if side > 0 else neg):
            continue
        if owns(r, o):
            cuts.append((p - o.cw / 2, p + o.cw / 2))
        else:
            cuts.append((p - o.cw / 2 - o.sw, p + o.cw / 2 + o.sw))
    return cuts + r.sw_gaps[side]


def build_sidewalks(r):
    C = "Sidewalks"
    for side in (-1, 1):
        t_in, t_out = side * r.cw / 2, side * (r.cw / 2 + r.sw)
        t_curb = side * (r.cw / 2 + 0.18)
        for s0, s1 in subtract((r.a, r.b), sidewalk_cuts(r, side)):
            n = max(1, int((s1 - s0) // 50))
            for k in range(n):
                a = s0 + (s1 - s0) * k / n
                b = s0 + (s1 - s0) * (k + 1) / n
                # curb stone strip
                x0, y0, x1, y1 = r.rect(a, b, t_in, t_curb)
                box(C, x0, y0, 0, x1, y1, SW_H, "curb")
                x0, y0, x1, y1 = r.rect(a, b, t_curb, t_out)
                box(C, x0, y0, 0, x1, y1, SW_H, {"top": "sidewalk", "*": "curb"})
            # tactile guide strip down the middle with warning blocks at the ends
            if r.sw >= 3.0 and s1 - s0 > 3.0 and in_core(*r.W((s0 + s1) / 2, 0), 40):
                tm = side * (r.cw / 2 + r.sw * 0.55)
                ta, tb = tm - 0.15, tm + 0.15
                for (a, b, mat) in ((s0 + 0.3, s0 + 0.9, "tactile_dots"), (s0 + 0.9, s1 - 0.9, "tactile_bars"),
                                    (s1 - 0.9, s1 - 0.3, "tactile_dots")):
                    x0, y0, x1, y1 = r.rect(a, b, ta, tb)
                    pts = [(x0, y0, SW_H + 0.004), (x1, y0, SW_H + 0.004), (x1, y1, SW_H + 0.004), (x0, y1, SW_H + 0.004)]
                    if r.axis == "x":
                        uvs = [(p[1] / 0.3, p[0] / 0.3) for p in pts]
                    else:
                        uvs = [(p[0] / 0.3, p[1] / 0.3) for p in pts]
                    face(C, mat, pts, uvs)


ZP = 0.012   # paint height


def paint_rect(r, s0, s1, t0, t1, mat="paint_white"):
    x0, y0, x1, y1 = r.rect(s0, s1, t0, t1)
    face("Markings", mat, [(x0, y0, ZP), (x1, y0, ZP), (x1, y1, ZP), (x0, y1, ZP)], [(0, 0)] * 4)


def paint_line(r, s0, s1, t, w=0.15, mat="paint_white", dash=None):
    if s1 - s0 < 0.2:
        return
    if not dash:
        paint_rect(r, s0, s1, t - w / 2, t + w / 2, mat)
        return
    on, off = dash
    s = s0
    while s < s1:
        paint_rect(r, s, min(s + on, s1), t - w / 2, t + w / 2, mat)
        s += on + off


def paint_text(r, s_far, s_near, t0, t1, mat):
    """Road text decal read by a driver moving from s_near toward s_far (image top = far)."""
    v = 1.0 if s_far > s_near else -1.0
    dx, dy = r.dir_vec()
    lx, ly = -dy * v, dx * v                       # driver's left
    px, py = r.perp_vec()
    lo, hi = sorted((t0, t1))
    left_t, right_t = (hi, lo) if lx * px + ly * py > 0 else (lo, hi)
    z = ZP + 0.002
    q = [r.W(s_near, left_t), r.W(s_near, right_t), r.W(s_far, right_t), r.W(s_far, left_t)]
    face("Markings", mat, [(a, b, z) for a, b in q], [(0, 0), (1, 0), (1, 1), (0, 1)])


def approach_side(r, dirn):
    """Perpendicular sign of the lane that approaches a junction from arm dirn."""
    return -dirn if r.axis == "x" else dirn


CROSSWALKS = []    # for props: (road, s_center_along, junction position)


def build_markings(r):
    p = r.p
    pieces = carriage_pieces(r)
    xs = {round(pp, 3): (o, pp) for pp, o, _, _ in r.xings}
    for s0, s1 in pieces:
        if not in_core(*r.W((s0 + s1) / 2, 0), 120):
            continue
        ends = []
        for s_end, dirn in ((s0, 1), (s1, -1)):
            # junction at this end? (piece end = junction centre -/+ other.cw/2)
            hit = None
            for pp, o, _, _ in r.xings:
                if abs((pp + dirn * o.cw / 2) - s_end) < 0.01:
                    hit = (o, pp)
            ends.append((s_end, dirn, hit))
        trim = {}
        for s_end, dirn, hit in ends:
            if hit is None:
                trim[dirn] = 0.0
                continue
            o, pp = hit
            d0 = 0.6
            t_edge = r.cw / 2 - p["shoulder"]
            if wants_crosswalk(r, o):
                # zebra bars across the arm, parallel to traffic (Japanese style)
                cs0, cs1 = s_end + dirn * d0, s_end + dirn * (d0 + 4.0)
                a, b = min(cs0, cs1), max(cs0, cs1)
                t = -r.cw / 2 + 0.5
                while t + 0.45 <= r.cw / 2 - 0.4:
                    paint_rect(r, a, b, t, t + 0.45)
                    t += 0.9
                CROSSWALKS.append((r, (a + b) / 2, pp, o, dirn))
                d_stop = d0 + 4.0 + 1.5
            else:
                d_stop = 1.2
            stop_sig = r.rank >= 2 and o.rank >= 2
            if stop_sig or stop_controlled(r, o):
                side = approach_side(r, dirn)
                t_in = p["median"] / 2 if p["median"] else 0.15
                ss = s_end + dirn * d_stop
                a, b = min(ss, ss + dirn * 0.45), max(ss, ss + dirn * 0.45)
                lo, hi = sorted((side * t_in, side * t_edge))
                paint_rect(r, a, b, lo, hi)
                if stop_controlled(r, o) and r.rank == 1:
                    s_far = ss + dirn * 1.0
                    s_near = s_far + dirn * 4.5
                    paint_text(r, s_far, s_near, side * 0.3, side * (r.cw / 2 - 0.9), "paint_tomare")
                    STOP_SIGNS.append((r, ss + dirn * 0.6, side, dirn))

            trim[dirn] = d_stop + 0.6
        a = s0 + trim[1]
        b = s1 - trim[-1]
        if b - a < 1.0:
            continue
        if r.cls == "arterial":
            m = p["median"] / 2
            edge = r.cw / 2 - p["shoulder"]
            for sgn in (-1, 1):
                paint_line(r, s0 + 0.3, s1 - 0.3, sgn * edge)
                lane_t = sgn * (m + p["lane_w"])
                sol = 30.0
                if b - a > 2 * sol + 10:
                    paint_line(r, a, a + sol, lane_t)
                    paint_line(r, a + sol, b - sol, lane_t, dash=(5.0, 5.0))
                    paint_line(r, b - sol, b, lane_t)
                else:
                    paint_line(r, a, b, lane_t)
            # raised median with a clipped hedge
            if b - a > 12:
                ma, mb = a + 2.0, b - 2.0
                x0, y0, x1, y1 = r.rect(ma, mb, -m, m)
                box("Roads", x0, y0, 0, x1, y1, 0.2, {"top": "concrete", "*": "curb"})
                x0, y0, x1, y1 = r.rect(ma + 0.5, mb - 0.5, -m + 0.25, m - 0.25)
                box("Vegetation", x0, y0, 0.2, x1, y1, 0.85, "hedge")
                for sgn in (-1, 1):
                    paint_line(r, a, ma, sgn * (m - 0.1), mat="paint_yellow")
                    paint_line(r, mb, b, sgn * (m - 0.1), mat="paint_yellow")
            else:
                for sgn in (-1, 1):
                    paint_line(r, a, b, sgn * (m - 0.1), mat="paint_yellow")
        elif r.cls == "secondary":
            edge = r.cw / 2 - p["shoulder"]
            near_station = math.dist(r.W((a + b) / 2, 0), STATION) < 300
            paint_line(r, a, b, 0.0, mat="paint_yellow" if near_station else "paint_white",
                       dash=None if near_station else (5.0, 5.0))
            for sgn in (-1, 1):
                paint_line(r, s0 + 0.3, s1 - 0.3, sgn * edge)
        else:
            for sgn in (-1, 1):
                paint_line(r, s0 + 0.3, s1 - 0.3, sgn * (r.cw / 2 - 0.6), w=0.15)


STOP_SIGNS = []


# ---------------------------------------------------------- station area
PLAZA = dict(x0=-56.0, x1=56.0, y0=157.0, y1=204.0, plat=212.0, isl=(-38.0, 168.0, 38.0, 192.0),
             entry=(-50.0, -40.0), exit=(40.0, 50.0))
DECK = dict(y0=227.5, y1=242.5, zb=7.6, zt=9.0)
TRACKS = (230.5, 239.5)


def build_station():
    C = "Station"
    P = PLAZA
    st = next(r for r in ROADS if r.axis == "x" and r.c == 150)
    st.sw_gaps[1] += [P["entry"], P["exit"]]
    # asphalt: ring + entry/exit throats through the sidewalk line
    poly("Roads", "asphalt", [(P["x0"] + 6, P["y0"], 0), (P["x1"] - 6, P["y0"], 0), (P["x1"] - 6, P["y1"], 0), (P["x0"] + 6, P["y1"], 0)])
    for a, b in (P["entry"], P["exit"]):
        poly("Roads", "asphalt", [(a, 154.0, 0), (b, 154.0, 0), (b, P["y0"], 0), (a, P["y0"], 0)])
    mark(P["x0"], 150, P["x1"], 250)
    # side pedestrian decks and the boarding platform
    for x0, x1 in ((P["x0"], P["x0"] + 6), (P["x1"] - 6, P["x1"])):
        box("Sidewalks", x0, P["y0"], 0, x1, P["plat"], SW_H, {"top": "sidewalk", "*": "curb"})
    box("Sidewalks", P["x0"] + 6, P["y1"], 0, P["x1"] - 6, P["plat"], SW_H, {"top": "sidewalk", "*": "curb"})
    # central island: stadium, grass, trees, clock
    ix0, iy0, ix1, iy1 = P["isl"]
    pts = stadium(ix0, iy0, ix1, iy1)
    prism("Sidewalks", pts, 0, 0.2, "curb", "curb", top=False)
    poly("Vegetation", "grass", [(p[0], p[1], 0.2) for p in stadium(ix0, iy0, ix1, iy1)])
    for x in (-26, -13, 13, 26):
        tree(x, 180 + R.uniform(-3, 3), 0.2, kind="zelkova", scale=1.2)
    cyl("Props", 0, 180, 0.2, 5.0, 0.12, 0.1, "metal_dark")
    obox("Props", 0, 180, 4.6, 0.9, 0.9, 0.9, 0, "metal_dark")
    for yaw in (0, math.pi / 2, math.pi, -math.pi / 2):
        c, s = math.cos(yaw), math.sin(yaw)
        tube("Props", (c * 0.46, 180 + s * 0.46, 5.05), (c * 0.48, 180 + s * 0.48, 5.05), 0.38, "guard_white", seg=16, cap=True)
    # plaza markings: lane edge + berth boxes with バス text
    plaza_road = Road("x", P["y1"] - 1.6, P["x0"] + 6, P["x1"] - 6, "lane")
    for i, bx in enumerate((-30.0, -6.0, 18.0)):
        r = plaza_road
        a, b = bx - 6.0, bx + 6.0
        paint_rect(r, a, b, 1.35, 1.5, "paint_yellow")
        paint_rect(r, a, b, -1.5, -1.35, "paint_yellow")
        paint_rect(r, a, a + 0.15, -1.5, 1.5, "paint_yellow")
        paint_rect(r, b - 0.15, b, -1.5, 1.5, "paint_yellow")
        paint_text(r, b - 1.5, b - 5.5, -1.0, 1.0, "paint_bus")
        BERTHS.append(dict(n=i + 1, x=bx, y=P["y1"] - 1.6))
    # taxi pool line on the south ring
    taxi_road = Road("x", P["y0"] + 1.6, P["x0"] + 8, P["x1"] - 8, "lane")
    for k in range(5):
        x = -30 + k * 6.5
        paint_rect(taxi_road, x, x + 0.15, -1.3, 1.3)
    # berth canopy (a long white roof on slim columns along the platform)
    zc = 3.6
    box(C, P["x0"] + 7, P["y1"] - 0.3, zc, P["x1"] - 7, P["plat"] + 4, zc + 0.35,
        {"*": "guard_white", "top": "metal_light", "bottom": "metal_light"}, skip=())
    for x in range(-48, 49, 8):
        cyl(C, x, P["y1"] + 2.5, SW_H, zc, 0.13, 0.13, "guard_white")
    for b in BERTHS:
        x = b["x"] + 6.5
        cyl("Props", x, P["y1"] + 0.7, SW_H, 3.0, 0.06, 0.06, "metal_dark")
        row = b["n"] - 1
        v0, v1 = 1 - (row + 1) / 4, 1 - row / 4
        for sgn in (1, -1):
            y = P["y1"] + 0.7 - sgn * 0.03
            x0, x1 = (x - 0.6, x + 0.6) if sgn > 0 else (x + 0.6, x - 0.6)
            face("Props", "berth_signs", [(x0, y, 2.2), (x1, y, 2.2), (x1, y, 2.8), (x0, y, 2.8)], [(0, v0), (1, v0), (1, v1), (0, v1)])
        # bench + timetable
        box("Props", b["x"] - 3, P["y1"] + 3.4, 0.55 + SW_H, b["x"] + 1, P["y1"] + 3.9, 0.6 + SW_H, "wood")
        for xx in (b["x"] - 2.6, b["x"] + 0.6):
            box("Props", xx, P["y1"] + 3.5, SW_H, xx + 0.08, P["y1"] + 3.8, 0.55 + SW_H, "metal_dark")
    # taxi sign
    x = -38.0
    cyl("Props", x, P["y0"] - 0.6, SW_H, 3.0, 0.06, 0.06, "metal_dark")
    for sgn in (1, -1):
        y = P["y0"] - 0.6 + sgn * 0.03
        x0, x1 = (x - 0.6, x + 0.6) if sgn < 0 else (x + 0.6, x - 0.6)
        face("Props", "berth_signs", [(x0, y, 2.2), (x1, y, 2.2), (x1, y, 2.8), (x0, y, 2.8)], [(0, 0), (1, 0), (1, 0.25), (0, 0.25)])

    # --- station building (under and beside the viaduct)
    sx0, sx1, sy0, sy1 = -55.0, 55.0, P["plat"], DECK["y1"] + 6
    zt = DECK["zb"]
    box(C, sx0, sy0 + 3, 0, sx1, sy1 - 3, zt, {"*": "wall_light", "top": None}, skip=("bottom", "top"))
    # glass entrance hall + concourse wall
    box(C, -22, sy0, 0, 22, sy0 + 3, zt - 1.5, {"s": "glass", "e": "glass", "w": "glass", "top": "metal_light"})
    box(C, sx0, sy0, zt - 1.5, sx1, sy0 + 3, zt + 0.6, {"*": "metal_light", "top": "roof_flat"}, skip=("bottom",))
    for x in range(-20, 21, 5):
        box(C, x - 0.08, sy0 - 0.05, 0, x + 0.08, sy0 + 0.05, zt - 1.5, "metal_dark")
    # big station name board on the plaza side (and the north side)
    face(C, "station_sign", [(-24, sy0 - 0.05, zt - 1.3), (24, sy0 - 0.05, zt - 1.3), (24, sy0 - 0.05, zt + 0.4), (-24, sy0 - 0.05, zt + 0.4)],
         [(0, 0), (1, 0), (1, 1), (0, 1)])
    face(C, "station_sign", [(18, sy1 + 0.05, zt - 2.6), (-18, sy1 + 0.05, zt - 2.6), (-18, sy1 + 0.05, zt - 1.3), (18, sy1 + 0.05, zt - 1.3)],
         [(0, 0), (1, 0), (1, 1), (0, 1)])
    box(C, sx0, sy1 - 3, 0, sx1, sy1, zt - 1.3, {"n": "glass", "*": "wall_light", "top": "roof_flat"})
    # side shops in the station building
    for x0 in (-54.0, 23.0):
        x1 = x0 + 31
        n = 5
        for k in range(n):
            a, b = x0 + (x1 - x0) * k / n, x0 + (x1 - x0) * (k + 1) / n
            c = R.randrange(11)
            u0, v0 = (c % 4) / 4, 1 - (c // 4 + 1) * 340 / 1020
            face(C, "shops", [(a, sy0 + 2.95, 0), (b, sy0 + 2.95, 0), (b, sy0 + 2.95, 4), (a, sy0 + 2.95, 4)],
                 [(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 340 / 1020), (u0, v0 + 340 / 1020)])
    mark(sx0, sy0, sx1, sy1)


BERTHS = []


def build_railway():
    C = "Railway"
    y0, y1, zb, zt = DECK["y0"], DECK["y1"], DECK["zb"], DECK["zt"]
    mark(WORLD[0], y0 - 1, WORLD[2], y1 + 1)
    x = WORLD[0]
    while x < WORLD[2]:
        x1 = min(WORLD[2], x + 60)
        box(C, x, y0, zb, x1, y1, zt, {"*": "concrete"}, skip=())
        # sound-barrier parapets
        box(C, x, y0, zt, x1, y0 + 0.3, zt + 1.6, "concrete")
        box(C, x, y1 - 0.3, zt, x1, y1, zt + 1.6, "concrete")
        # track slabs + rails
        for ty in TRACKS:
            box(C, x, ty - 1.4, zt, x1, ty + 1.4, zt + 0.25, "concrete")
            for o in (-0.534, 0.534):
                box(C, x, ty + o - 0.035, zt + 0.25, x1, ty + o + 0.035, zt + 0.42, "steel")
        x = x1
    # portal piers, skipping roads underneath
    ns = [r for r in ROADS if r.axis == "y" and r.a < y0 and r.b > y1]
    xp = WORLD[0] + 10
    while xp < WORLD[2]:
        if all(abs(xp - r.c) > r.half + 1.5 for r in ns) and not (-58 < xp < 58):
            for py in (y0 + 1.6, y1 - 1.6):
                box(C, xp - 0.8, py - 0.8, 0, xp + 0.8, py + 0.8, zb, "concrete")
        xp += 20
    # overhead line masts
    xm = WORLD[0] + 25
    while xm < WORLD[2]:
        for py in (y0 + 0.5, y1 - 0.5):
            box(C, xm - 0.15, py - 0.15, zt, xm + 0.15, py + 0.15, zt + 6.5, "metal_light")
        box(C, xm - 0.12, y0 + 0.5, zt + 6.2, xm + 0.12, y1 - 0.5, zt + 6.5, "metal_light", skip=())
        xm += 50
    for ty in TRACKS:
        tube(C, (WORLD[0], ty, zt + 5.4), (WORLD[2], ty, zt + 5.4), 0.02, "wire", seg=3)
    # island platform with canopy
    py0, py1 = TRACKS[0] + 1.75, TRACKS[1] - 1.75
    box("Station", -90, py0, zt, 90, py1, zt + 1.1, {"top": "sidewalk", "*": "concrete"})
    for x in range(-85, 86, 10):
        cyl("Station", x, (py0 + py1) / 2, zt + 1.1, zt + 4.6, 0.15, 0.15, "metal_light")
    box("Station", -88, py0 - 0.6, zt + 4.6, 88, py1 + 0.6, zt + 4.9, {"*": "metal_light"}, skip=())
    # train standing at the platform: 4 cars
    for k in range(4):
        cx = -62 + k * 20.5
        train_car(cx, TRACKS[0], zt + 0.42)


def train_car(cx, cy, z0):
    C = "Railway"
    L, W, H = 20.0, 2.95, 3.65

    def uv(fk, pts, m):
        if fk in ("n", "s"):
            xs = [p[0] for p in pts]
            lo = min(xs)
            return [((p[0] - lo) / L, (p[2] - z0 - 0.3) / (H - 0.3)) for p in pts]
        return None
    box(C, cx - L / 2, cy - W / 2, z0 + 0.3, cx + L / 2, cy + W / 2, z0 + H,
        {"n": "train_side", "s": "train_side", "e": "metal_light", "w": "metal_light", "top": "metal_light"}, uv=uv)
    box(C, cx - L / 2 + 1, cy - W / 2 + 0.2, z0, cx + L / 2 - 1, cy + W / 2 - 0.2, z0 + 0.3, "metal_dark")


# ------------------------------------------------------------ vegetation
def crown(cx, cy, cz, rx, ry, rz, n):
    """Leafy crown made of n overlapping lumps inside an ellipsoid."""
    blob("Vegetation", "leaves", cx, cy, cz, rx * 0.72, ry * 0.72, rz * 0.72, rough=0.08)
    for _ in range(n):
        a = R.uniform(0, 2 * math.pi)
        e = R.uniform(-0.6, 0.9)
        d = R.uniform(0.45, 0.75)
        px = cx + math.cos(a) * math.sqrt(1 - e * e) * rx * d
        py = cy + math.sin(a) * math.sqrt(1 - e * e) * ry * d
        pz = cz + e * rz * d
        rr = R.uniform(0.38, 0.55)
        blob("Vegetation", "leaves", px, py, pz, rx * rr, ry * rr, rz * rr * 0.9, rough=0.1, level=1)


def tree(x, y, z=0.0, kind="ginkgo", scale=1.0):
    C = "Vegetation"
    s = scale * R.uniform(0.85, 1.15)
    if kind == "ginkgo":       # pruned street ginkgo: tall narrow crown
        h = 3.0 * s
        cyl(C, x, y, z, z + h + 2, 0.16 * s, 0.1 * s, "wood", seg=7, cap=False)
        crown(x, y, z + h + 2.6 * s, 1.8 * s, 1.8 * s, 3.1 * s, 7)
    elif kind == "zelkova":    # keyaki: broad vase crown
        h = 3.2 * s
        cyl(C, x, y, z, z + h + 1.5, 0.22 * s, 0.14 * s, "wood", seg=7, cap=False)
        for k in range(3):
            a = 2 * math.pi * k / 3 + R.uniform(-0.3, 0.3)
            tube(C, (x, y, z + h), (x + math.cos(a) * 1.4 * s, y + math.sin(a) * 1.4 * s, z + h + 1.8 * s), 0.09 * s, "wood", seg=5)
        crown(x, y, z + h + 2.6 * s, 3.4 * s, 3.4 * s, 2.5 * s, 9)
    elif kind == "cedar":      # shrine cedar
        h = 4.0 * s
        cyl(C, x, y, z, z + h + 8, 0.35 * s, 0.2 * s, "wood", seg=7, cap=False)
        for k in range(3):
            crown(x, y, z + h + 2 + k * 3.2 * s, (2.6 - k * 0.6) * s, (2.6 - k * 0.6) * s, 2.0 * s, 4)
    else:                      # garden shrub tree
        cyl(C, x, y, z, z + 1.6 * s, 0.08, 0.06, "wood", seg=5, cap=False)
        crown(x, y, z + 2.0 * s, 1.2 * s, 1.2 * s, 1.1 * s, 3)


# -------------------------------------------------------------- buildings
def shop_cell_uv(c):
    u0, v0 = (c % 4) / 4, 1 - (c // 4 + 1) * 340 / 1020
    return u0, v0, u0 + 0.25, v0 + 340 / 1020


FRONT_NORMAL = {"s": (0, -1), "n": (0, 1), "e": (1, 0), "w": (-1, 0)}


def front_face_pts(x0, y0, x1, y1, z0, z1, front):
    return BOX_FACES[front](x0, y0, z0, x1, y1, z1)


def facade_uv(mat, z0, u0=0.0):
    spec = MATS[mat]
    if "tw" in spec:
        return lambda pts: uv_facade(pts, spec["tw"], spec["th"], z0, u0)
    return lambda pts: uv_world(pts, spec.get("T", 8.0))


def facade_box(C, x0, y0, z0, x1, y1, z1, mats, top=None, u0=None):
    """Box whose side faces use facade UVs anchored at z0; mats: face -> material."""
    u0 = R.random() if u0 is None else u0
    ref = ((x0 + x1) / 2, (y0 + y1) / 2)
    for fk in ("s", "n", "e", "w"):
        m = mats.get(fk, mats.get("*"))
        if not m:
            continue
        pts = BOX_FACES[fk](x0, y0, z0, x1, y1, z1)
        face(C, m, pts, facade_uv(m, z0, u0 if MATS[m].get("tw", 0) > 8 else 0.0)(pts), ref)
    if top:
        pts = BOX_FACES["top"](x0, y0, z0, x1, y1, z1)
        face(C, top, pts, uv_world(pts, MATS[top].get("T", 10.0)), ref)


def parapet(C, x0, y0, x1, y1, z, h=0.9, t=0.25, mat="concrete"):
    box(C, x0, y0, z, x1, y0 + t, z + h, mat)
    box(C, x0, y1 - t, z, x1, y1, z + h, mat)
    box(C, x0, y0 + t, z, x0 + t, y1 - t, z + h, mat)
    box(C, x1 - t, y0 + t, z, x1, y1 - t, z + h, mat)


def rooftop(C, x0, y0, x1, y1, z, floors, front, billboard=False):
    w, d = x1 - x0, y1 - y0
    if floors >= 5 and w > 8 and d > 8:
        cx, cy = x0 + w * R.uniform(0.3, 0.7), y0 + d * R.uniform(0.3, 0.7)
        box(C, cx - 1.6, cy - 1.6, z, cx + 1.6, cy + 1.6, z + 3.0, {"*": "wall_light", "top": "roof_flat"})
    for _ in range(R.randint(1, max(1, int(w * d / 60)))):
        ax, ay = R.uniform(x0 + 1, x1 - 2), R.uniform(y0 + 1, y1 - 2)
        box(C, ax, ay, z, ax + 0.9, ay + 0.35, z + 0.75, "metal_light")
    if R.random() < 0.35 and w > 6 and d > 6:
        tx, ty = R.uniform(x0 + 2, x1 - 2), R.uniform(y0 + 2, y1 - 2)
        for dx, dy in ((-0.8, -0.8), (0.8, -0.8), (0.8, 0.8), (-0.8, 0.8)):
            cyl(C, tx + dx, ty + dy, z, z + 1.2, 0.07, 0.07, "metal_dark", seg=4, cap=False)
        cyl(C, tx, ty, z + 1.2, z + 3.2, 1.2, 1.2, "metal_light", seg=12)
    if billboard:
        nx, ny = FRONT_NORMAL[front]
        bw, bh = min(12.0, (w if ny else d) * 0.9), 3.8
        cx, cy = (x0 + x1) / 2 + nx * ((w / 2) - 1.5), (y0 + y1) / 2 + ny * ((d / 2) - 1.5)
        row = R.randrange(4)
        v0, v1 = 1 - (row + 1) / 4, 1 - row / 4
        zb = z + 1.5
        if ny:
            xa, xb = cx - bw / 2, cx + bw / 2
            for xx in (xa + 1, xb - 1):
                box(C, xx - 0.1, cy - 0.1, z, xx + 0.1, cy + 0.1, zb, "metal_dark")
            box(C, xa, cy - 0.15, zb, xb, cy + 0.15, zb + bh, "metal_dark", skip=())
            yy = cy + ny * 0.16
            pts = [(xa, yy, zb), (xb, yy, zb), (xb, yy, zb + bh), (xa, yy, zb + bh)] if ny < 0 else \
                  [(xb, yy, zb), (xa, yy, zb), (xa, yy, zb + bh), (xb, yy, zb + bh)]
        else:
            ya, yb = cy - bw / 2, cy + bw / 2
            for yy in (ya + 1, yb - 1):
                box(C, cx - 0.1, yy - 0.1, z, cx + 0.1, yy + 0.1, zb, "metal_dark")
            box(C, cx - 0.15, ya, zb, cx + 0.15, yb, zb + bh, "metal_dark", skip=())
            xx = cx + nx * 0.16
            pts = [(xx, ya, zb), (xx, yb, zb), (xx, yb, zb + bh), (xx, ya, zb + bh)] if nx > 0 else \
                  [(xx, yb, zb), (xx, ya, zb), (xx, ya, zb + bh), (xx, yb, zb + bh)]
        face(C, "billboard", pts, [(0, v0), (1, v0), (1, v1), (0, v1)])


def split_front(x0, y0, x1, y1, front, n):
    """Yield n sub-quads (bl, br, tr, tl order; z filled later) across the front face."""
    base = BOX_FACES[front](x0, y0, 0, x1, y1, 1)
    (ax, ay, _), (bx, by, _) = base[0], base[1]
    for k in range(n):
        t0, t1 = k / n, (k + 1) / n
        yield (ax + (bx - ax) * t0, ay + (by - ay) * t0), (ax + (bx - ax) * t1, ay + (by - ay) * t1)


def kanban(C, x0, y0, x1, y1, front, z0, n_cells):
    """Vertical signboard sticking out of the facade near one front corner,
    readable from both directions along the street."""
    nx, ny = FRONT_NORMAL[front]
    (a, b) = next(split_front(x0, y0, x1, y1, front, 1))
    L = math.dist(a, b)
    tx, ty = (b[0] - a[0]) / L, (b[1] - a[1]) / L       # along the facade
    if R.random() < 0.5:
        px, py = a[0] + tx * 0.7, a[1] + ty * 0.7
    else:
        px, py = b[0] - tx * 0.7, b[1] - ty * 0.7
    out, th, H = 1.0, 0.28, 3.2
    q0 = (px + nx * 0.1, py + ny * 0.1)
    q1 = (px + nx * (0.1 + out), py + ny * (0.1 + out))
    for k in range(n_cells):
        zb = z0 + k * H
        cell = R.randrange(8)
        u0, u1 = cell / 8, (cell + 1) / 8
        for sgn in (1, -1):
            o = sgn * th / 2
            vx, vy = -sgn * tx, -sgn * ty                 # viewer looks along v
            rx, ry = vy, -vx                              # viewer's right
            p0 = (q0[0] + tx * o, q0[1] + ty * o)
            p1 = (q1[0] + tx * o, q1[1] + ty * o)
            if (p1[0] - p0[0]) * rx + (p1[1] - p0[1]) * ry < 0:
                p0, p1 = p1, p0
            face(C, "kanban", [(p0[0], p0[1], zb), (p1[0], p1[1], zb), (p1[0], p1[1], zb + H - 0.1), (p0[0], p0[1], zb + H - 0.1)],
                 [(u0, 0), (u1, 0), (u1, 1), (u0, 1)])
        cxp, cyp = (q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2
        obox(C, cxp, cyp, zb + H - 0.1, out, th, 0.1, math.atan2(ny, nx), "metal_dark", skip=())
        obox(C, cxp + nx * out / 2, cyp + ny * out / 2, zb, 0.04, th, H - 0.1, math.atan2(ny, nx), "metal_dark", skip=("top", "bottom"))


def commercial(x0, y0, x1, y1, front, floors, upper, sign=True, billboard=False, detail=True):
    C = "Buildings"
    gf = 4.0
    fh = MATS[upper]["th"] / 4
    top = gf + (floors - 1) * fh
    side_m = "wall_dark" if R.random() < 0.5 else "wall_light"
    # ground floor: shop fronts on the street face
    mats = {k: side_m for k in "nsew"}
    mats[front] = None
    facade_box(C, x0, y0, 0, x1, y1, gf, mats)
    W = abs((x1 - x0) if front in "ns" else (y1 - y0))
    n = max(1, int(round(W / 6.0)))
    for a, b in split_front(x0, y0, x1, y1, front, n):
        u0, v0, u1, v1 = shop_cell_uv(R.randrange(12) if R.random() < 0.9 else 11)
        face(C, "shops", [(a[0], a[1], 0), (b[0], b[1], 0), (b[0], b[1], gf), (a[0], a[1], gf)],
             [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    # awning band between shops and upper floors
    nx, ny = FRONT_NORMAL[front]
    ax0, ay0, ax1, ay1 = x0, y0, x1, y1
    if nx > 0: ax0, ax1 = x1, x1 + 0.6
    if nx < 0: ax0, ax1 = x0 - 0.6, x0
    if ny > 0: ay0, ay1 = y1, y1 + 0.6
    if ny < 0: ay0, ay1 = y0 - 0.6, y0
    box(C, ax0, ay0, gf - 0.05, ax1, ay1, gf + 0.25, "metal_light", skip=())
    # upper floors
    if floors > 1:
        if upper.startswith("f_office") or R.random() < 0.6:
            mats = {k: upper for k in "nsew"}
        else:
            mats = {k: side_m for k in "nsew"}
            mats[front] = upper
            back = {"n": "s", "s": "n", "e": "w", "w": "e"}[front]
            mats[back] = upper
        facade_box(C, x0, y0, gf, x1, y1, top, mats, top="roof_flat")
        if upper.startswith("f_mansion") and detail:
            balconies(C, x0, y0, x1, y1, front, gf, top, fh)
    else:
        facade_box(C, x0, y0, gf, x1, y1, gf, {}, top="roof_flat")
    if detail:
        parapet(C, x0, y0, x1, y1, top)
        rooftop(C, x0, y0, x1, y1, top, floors, front, billboard)
        if sign and floors >= 3:
            kanban(C, x0, y0, x1, y1, front, gf + 0.6, min(floors - 2, 4))


def balconies(C, x0, y0, x1, y1, front, zbase, ztop, fh):
    nx, ny = FRONT_NORMAL[front]
    depth = 1.15
    z = zbase + fh
    floor_z = []
    while z < ztop - 0.5:
        floor_z.append(z)
        z += fh
    floor_z.insert(0, zbase) if zbase > 0.5 else None
    for zf in floor_z:
        if ny:
            yb = y1 if ny > 0 else y0
            yo = yb + ny * depth
            box(C, x0, min(yb, yo), zf - 0.18, x1, max(yb, yo), zf, {"*": "guard_white"}, skip=())
            box(C, x0, min(yo, yo - ny * 0.08), zf, x1, max(yo, yo - ny * 0.08), zf + 1.05, "frosted")
            u = x0
            while u <= x1 + 0.01:
                box(C, u - 0.05, min(yb, yo), zf, u + 0.05, max(yb, yo), zf + 2.4, "frosted")
                u += 4.5
        else:
            xb = x1 if nx > 0 else x0
            xo = xb + nx * depth
            box(C, min(xb, xo), y0, zf - 0.18, max(xb, xo), y1, zf, {"*": "guard_white"}, skip=())
            box(C, min(xo, xo - nx * 0.08), y0, zf, max(xo, xo - nx * 0.08), y1, zf + 1.05, "frosted")
            u = y0
            while u <= y1 + 0.01:
                box(C, min(xb, xo), u - 0.05, zf, max(xb, xo), u + 0.05, zf + 2.4, "frosted")
                u += 4.5


def mansion(x0, y0, x1, y1, front, floors, mat, detail=True):
    """Apartment block: lobby floor + balconied floors (3.0 m)."""
    C = "Buildings"
    fh = 3.0
    top = floors * fh + 0.5
    nx, ny = FRONT_NORMAL[front]
    # pull the wall back so balconies stay within the lot
    bx0, by0, bx1, by1 = x0 + (1.2 if nx < 0 else 0), y0 + (1.2 if ny < 0 else 0), x1 - (1.2 if nx > 0 else 0), y1 - (1.2 if ny > 0 else 0)
    side = R.choice(["wall_light", "f_mid_beige" if mat == "f_mansion_white" else "wall_dark"])
    mats = {k: side for k in "nsew"}
    mats[front] = mat
    facade_box(C, bx0, by0, 0.5, bx1, by1, top, mats, top="roof_flat", u0=0.0)
    box(C, bx0, by0, 0, bx1, by1, 0.5, "concrete")
    if detail:
        balconies(C, bx0, by0, bx1, by1, front, 0.5 + fh, top, fh)
        parapet(C, bx0, by0, bx1, by1, top)
        rooftop(C, bx0, by0, bx1, by1, top, floors, front)


def _roof_faces(C, faces, mat, soffit="wall_light"):
    for pts in faces:
        p0, p1 = np.array(pts[0]), np.array(pts[1])
        e = p1 - p0
        e /= np.linalg.norm(e)
        n = np.array(_normal(pts))
        s = np.cross(n, e)
        T = MATS[mat]["T"]
        uvs = [(float(np.dot(np.array(p) - p0, e)) / T, float(np.dot(np.array(p) - p0, s)) / T) for p in pts]
        face(C, mat, pts, uvs)
        face(C, soffit, pts[::-1], [(0, 0)] * len(pts))


def roof_gable(C, x0, y0, x1, y1, zb, ridge_x, pitch, o, mat, wall):
    t = math.tan(math.radians(pitch))
    if ridge_x:
        ym = (y0 + y1) / 2
        rise = (y1 - y0) / 2 * t
        ze = zb - o * t
        zr = zb + rise
        faces = [[(x0 - o, y0 - o, ze), (x1 + o, y0 - o, ze), (x1 + o, ym, zr), (x0 - o, ym, zr)],
                 [(x1 + o, y1 + o, ze), (x0 - o, y1 + o, ze), (x0 - o, ym, zr), (x1 + o, ym, zr)]]
        gables = [[(x0, y1, zb), (x0, y0, zb), (x0, ym, zr)], [(x1, y0, zb), (x1, y1, zb), (x1, ym, zr)]]
    else:
        xm = (x0 + x1) / 2
        rise = (x1 - x0) / 2 * t
        ze = zb - o * t
        zr = zb + rise
        faces = [[(x1 + o, y0 - o, ze), (x1 + o, y1 + o, ze), (xm, y1 + o, zr), (xm, y0 - o, zr)],
                 [(x0 - o, y1 + o, ze), (x0 - o, y0 - o, ze), (xm, y0 - o, zr), (xm, y1 + o, zr)]]
        gables = [[(x0, y0, zb), (x1, y0, zb), (xm, y0, zr)], [(x1, y1, zb), (x0, y1, zb), (xm, y1, zr)]]
    _roof_faces(C, faces, mat)
    gw = "wall_light" if "tw" in MATS[wall] else wall
    for g in gables:
        face(C, gw, g, uv_world(g, MATS[gw].get("T", 4.0)))
    return zr


def roof_hip(C, x0, y0, x1, y1, zb, pitch, o, mat):
    t = math.tan(math.radians(pitch))
    ex0, ey0, ex1, ey1 = x0 - o, y0 - o, x1 + o, y1 + o
    ze = zb - o * t
    if ex1 - ex0 >= ey1 - ey0:
        hs = (ey1 - ey0) / 2
        ym = (ey0 + ey1) / 2
        zr = ze + hs * t
        faces = [[(ex0, ey0, ze), (ex1, ey0, ze), (ex1 - hs, ym, zr), (ex0 + hs, ym, zr)],
                 [(ex1, ey1, ze), (ex0, ey1, ze), (ex0 + hs, ym, zr), (ex1 - hs, ym, zr)],
                 [(ex1, ey0, ze), (ex1, ey1, ze), (ex1 - hs, ym, zr)],
                 [(ex0, ey1, ze), (ex0, ey0, ze), (ex0 + hs, ym, zr)]]
    else:
        hs = (ex1 - ex0) / 2
        xm = (ex0 + ex1) / 2
        zr = ze + hs * t
        faces = [[(ex1, ey0, ze), (ex1, ey1, ze), (xm, ey1 - hs, zr), (xm, ey0 + hs, zr)],
                 [(ex0, ey1, ze), (ex0, ey0, ze), (xm, ey0 + hs, zr), (xm, ey1 - hs, zr)],
                 [(ex1, ey1, ze), (ex0, ey1, ze), (xm, ey1 - hs, zr)],
                 [(ex0, ey0, ze), (ex1, ey0, ze), (xm, ey0 + hs, zr)]]
    _roof_faces(C, faces, mat)
    return zr


def house(lx0, ly0, lx1, ly1, front, detail=True):
    """Detached 2-storey house on a lot: block wall + gate, yard, kawara roof."""
    C = "Buildings"
    nx, ny = FRONT_NORMAL[front]
    yard = R.uniform(1.5, 3.5)
    x0, y0, x1, y1 = lx0 + 0.6, ly0 + 0.6, lx1 - 0.6, ly1 - 0.6
    if nx > 0: x1 = lx1 - yard
    if nx < 0: x0 = lx0 + yard
    if ny > 0: y1 = ly1 - yard
    if ny < 0: y0 = ly0 + yard
    if x1 - x0 < 5 or y1 - y0 < 5:
        return
    wall = R.choice(["f_house_white", "f_house_beige", "f_house_grey", "f_house_white"])
    H = 5.8
    facade_box(C, x0, y0, 0.0, x1, y1, H, {k: wall for k in "nsew"}, u0=R.choice([0, 0.5]))
    box(C, x0 - 0.05, y0 - 0.05, 0, x1 + 0.05, y1 + 0.05, 0.35, "concrete", skip=("bottom", "top"))
    style = R.random()
    roof = R.choice(["kawara_grey", "kawara_grey", "kawara_blue", "kawara_brown", "roof_metal_green", "roof_metal_red", "kawara_blue"])
    if style < 0.55:
        ridge_x = (x1 - x0) >= (y1 - y0) if R.random() < 0.8 else (x1 - x0) < (y1 - y0)
        roof_gable(C, x0, y0, x1, y1, H, ridge_x, R.uniform(22, 30), 0.55, roof, wall)
    elif style < 0.85:
        roof_hip(C, x0, y0, x1, y1, H, R.uniform(22, 28), 0.55, roof)
    else:
        box(C, x0, y0, H, x1, y1, H + 0.6, {"*": "wall_dark", "top": "roof_flat"})
    if not detail:
        return
    # 2nd-floor balcony on the front
    if R.random() < 0.6:
        w = (x1 - x0) if ny else (y1 - y0)
        bw = min(w * 0.6, 4.5)
        if ny:
            cx = R.uniform(x0 + bw / 2, x1 - bw / 2)
            yb = y1 if ny > 0 else y0
            box(C, cx - bw / 2, min(yb, yb + ny * 0.9), 2.75, cx + bw / 2, max(yb, yb + ny * 0.9), 3.9,
                {"*": "guard_white", "top": "metal_light"}, skip=())
        else:
            cy = R.uniform(y0 + bw / 2, y1 - bw / 2)
            xb = x1 if nx > 0 else x0
            box(C, min(xb, xb + nx * 0.9), cy - bw / 2, 2.75, max(xb, xb + nx * 0.9), cy + bw / 2, 3.9,
                {"*": "guard_white", "top": "metal_light"}, skip=())
    # block wall along the street edge with a gate gap; car in the yard
    gate_w = 3.0 if yard >= 2.8 else 1.2
    if ny:
        yb = ly1 - 0.1 if ny > 0 else ly0
        g0 = R.uniform(lx0 + 0.3, lx1 - gate_w - 0.3)
        for a, b in ((lx0, g0), (g0 + gate_w, lx1)):
            if b - a > 0.3:
                box(C, a, yb, 0, b, yb + 0.12, 1.2, "blockwall")
        if gate_w > 2 and R.random() < 0.6:
            car(g0 + gate_w / 2, (yb + (y1 if ny > 0 else y0)) / 2, math.pi / 2, kei=R.random() < 0.6)
    else:
        xb = lx1 - 0.1 if nx > 0 else lx0
        g0 = R.uniform(ly0 + 0.3, ly1 - gate_w - 0.3)
        for a, b in ((ly0, g0), (g0 + gate_w, ly1)):
            if b - a > 0.3:
                box(C, xb, a, 0, xb + 0.12, b, 1.2, "blockwall")
        if gate_w > 2 and R.random() < 0.6:
            car((xb + (x1 if nx > 0 else x0)) / 2, g0 + gate_w / 2, 0.0, kei=R.random() < 0.6)
    if R.random() < 0.5:
        tx = R.uniform(lx0 + 1, lx1 - 1)
        ty = R.uniform(ly0 + 1, ly1 - 1)
        if not (x0 - 1 < tx < x1 + 1 and y0 - 1 < ty < y1 + 1):
            tree(tx, ty, kind="shrub", scale=R.uniform(0.8, 1.3))


def apaato(lx0, ly0, lx1, ly1, front, detail=True):
    """2-storey wooden apartment with an open corridor + stair facing the street."""
    C = "Buildings"
    nx, ny = FRONT_NORMAL[front]
    x0, y0, x1, y1 = lx0 + 0.5, ly0 + 0.5, lx1 - 0.5, ly1 - 0.5
    cd = 1.3
    if nx > 0: x1 -= cd + 0.5
    if nx < 0: x0 += cd + 0.5
    if ny > 0: y1 -= cd + 0.5
    if ny < 0: y0 += cd + 0.5
    mats = {k: "f_house_beige" for k in "nsew"}
    mats[front] = "f_apaato"
    facade_box(C, x0, y0, 0, x1, y1, 5.8, mats, u0=0.0)
    roof_gable(C, x0, y0, x1, y1, 5.8, ny != 0, 15, 0.4, "kawara_brown", "f_house_beige")
    if not detail:
        return
    if ny:
        yb = y1 if ny > 0 else y0
        yo = yb + ny * cd
        box(C, x0, min(yb, yo), 2.75, x1, max(yb, yo), 2.95, {"*": "metal_dark"}, skip=())
        box(C, x0, min(yo, yo - ny * 0.05), 2.95, x1, max(yo, yo - ny * 0.05), 4.0, "metal_light")
        sx = x0 - 1.2 if R.random() < 0.5 else x1
        obox(C, sx + 0.6, (yb + yo) / 2, 0, 1.0, cd, 0.15, 0, "metal_dark")
        for k in range(14):   # stair treads
            z = 0.2 * (k + 1)
            obox(C, sx + 0.6, (yb + yo) / 2 + 0, z - 0.05, 1.0, 0.25, 0.05, 0, "metal_dark", skip=())
    else:
        xb = x1 if nx > 0 else x0
        xo = xb + nx * cd
        box(C, min(xb, xo), y0, 2.75, max(xb, xo), y1, 2.95, {"*": "metal_dark"}, skip=())
        box(C, min(xo, xo - nx * 0.05), y0, 2.95, max(xo, xo - nx * 0.05), y1, 4.0, "metal_light")


def car(x, y, yaw, color=None, kei=False, taxi=False):
    C = "Vehicles"
    color = color or ("car_taxi" if taxi else R.choice(["car_white"] * 4 + ["car_silver"] * 3 + ["car_black"] * 2 + ["car_blue", "car_red"]))
    L, W = (3.4, 1.47) if kei else (4.6, 1.75)
    body_h = 0.75 if not kei else 0.8
    obox(C, x, y, 0.28, L, W, body_h, yaw, color)
    c, s = math.cos(yaw), math.sin(yaw)
    off = -0.2 if not kei else 0.1
    cab_l = L * (0.5 if not kei else 0.72)
    obox(C, x + c * off, y + s * off, 0.28 + body_h, cab_l, W - 0.12, 0.6 if not kei else 0.75, yaw,
         {"*": "glass", "top": color})
    if taxi:
        obox(C, x + c * off, y + s * off, 0.28 + body_h + 0.6, 0.4, 0.2, 0.18, yaw, "lamp_white")
    for lx in (L / 2 - 0.7, -L / 2 + 0.7):
        for ly in (W / 2 - 0.05, -W / 2 + 0.05):
            px, py = x + c * lx - s * ly, y + s * lx + c * ly
            ox, oy = -s * 0.1, c * 0.1
            tube(C, (px - ox, py - oy, 0.32), (px + ox, py + oy, 0.32), 0.32, "rubber", seg=8, cap=True)


def reference_bus(x, y, yaw):
    """A 10.5 m Japanese non-step city bus for scale (left-side doors)."""
    C = "ReferenceBus"
    L, W, H = 10.5, 2.49, 3.05
    c, s = math.cos(yaw), math.sin(yaw)

    def uv(fk, pts, m):
        if m != "bus_side":
            return None
        out = []
        for p in pts:
            lx = (p[0] - x) * c + (p[1] - y) * s
            u = (lx + L / 2) / L
            v = (p[2] - 0.3) / (H - 0.3)
            if fk == "n":     # local +y = left side (doors), front (+x) at image left
                out.append((1 - u, 0.5 + v * 0.5))
            else:             # right side, front at image right
                out.append((u, v * 0.5))
        return out
    obox(C, x, y, 0.3, L, W, H - 0.3, yaw, {"n": "bus_side", "s": "bus_side", "e": "car_white", "w": "car_white",
                                             "top": "metal_light"}, uv=uv)
    fx, fy = x + c * (L / 2 + 0.01), y + s * (L / 2 + 0.01)
    obox(C, fx, fy, 1.1, 0.02, W - 0.2, 1.65, yaw, "glass", skip=())
    obox(C, fx, fy, 2.85, 0.03, W - 0.6, 0.3, yaw, "led_sign", skip=())
    for lx in (L / 2 - 2.2, -L / 2 + 2.6):
        for ly in (W / 2 - 0.1, -W / 2 + 0.1):
            px, py = x + c * lx - s * ly, y + s * lx + c * ly
            ox, oy = -s * 0.15, c * 0.15
            tube(C, (px - ox, py - oy, 0.48), (px + ox, py + oy, 0.48), 0.48, "rubber", seg=10, cap=True)


# --------------------------------------------------------------- specials
def build_konbini():
    C = "Buildings"
    x0, y0, x1, y1 = 152.0, 37.0, 178.0, 50.0
    mats = {"n": "wall_light", "e": "wall_light", "w": "wall_light"}
    facade_box(C, x0, y0, 0, x1, y1, 4.6, mats, top="roof_flat")
    face(C, "konbini", [(x0, y0, 0), (x1, y0, 0), (x1, y0, 4.6), (x0, y0, 4.6)], [(0, 0), (1, 0), (1, 1), (0, 1)])
    parapet(C, x0, y0, x1, y1, 4.6, 0.6, 0.2, "guard_white")
    # parking with stalls + wheel stops
    poly("Roads", "asphalt", [(150.0, 14.5, 0.02), (182.0, 14.5, 0.02), (182.0, 36.9, 0.02), (150.0, 36.9, 0.02)])
    pk = Road("x", 30.0, 150, 182, "lane")
    for k in range(8):
        xx = 152 + k * 3.2
        paint_rect(pk, xx, xx + 0.12, 1.0, 6.9)
        box("Props", xx + 0.6, 35.6, 0.02, xx + 2.4, 35.85, 0.14, "concrete")
        if R.random() < 0.6 and k < 7:
            car(xx + 1.6, 33.0, math.pi / 2, kei=R.random() < 0.4)
    # pylon sign
    box("Props", 179.5, 15.5, 0, 179.8, 15.8, 5.0, "metal_dark")
    face("Props", "konbini", [(178.4, 15.4, 5.0), (181.0, 15.4, 5.0), (181.0, 15.4, 6.6), (178.4, 15.4, 6.6)],
         [(0.0, 0.75), (0.25, 0.75), (0.25, 1.0), (0.0, 1.0)])
    for v in (1, 2):
        vending_machine(x1 + 0.45, y0 + 1 + v * 1.05, 0.0, v)
    mark(148, 13, 184, 52, building=True)


def build_gas_station():
    C = "Buildings"
    poly("Roads", "concrete", [(228.0, -46.0, 0.02), (270.0, -46.0, 0.02), (270.0, -12.4, 0.02), (228.0, -12.4, 0.02)])
    box(C, 233, -37, 5.2, 257, -19, 6.1, {"*": "guard_white", "top": "metal_light", "bottom": "metal_light"}, skip=())
    box(C, 232.9, -37.1, 5.6, 257.1, -18.9, 6.1, {"s": "red_paint", "n": "red_paint", "e": "red_paint", "w": "red_paint"}, skip=("top", "bottom"))
    for x in (238.0, 252.0):
        for y in (-32.0, -24.0):
            box(C, x - 0.25, y - 0.25, 0, x + 0.25, y + 0.25, 5.2, "guard_white")
            box("Props", x - 0.6, y + 0.6, 0.02, x + 0.6, y + 1.3, 1.8, {"*": "guard_white", "s": "red_paint"})
    facade_box(C, 259, -44, 0, 268, -32, 4.0, {"*": "wall_light", "s": "glass"}, top="roof_flat")
    box("Props", 229, -14, 0, 229.3, -13.7, 6.0, "metal_dark")
    box("Props", 228.4, -14.1, 4.0, 231.4, -13.6, 6.6, {"*": "red_paint", "top": "guard_white"})
    mark(226, -47, 271, -12.4, building=True)


def build_shrine():
    C = "Buildings"
    x0, y0, x1, y1 = -130.0, -95.0, -80.0, -40.0
    poly("Terrain", "gravel", [(x0, y0, 0.02), (x1, y0, 0.02), (x1, y1, 0.02), (x0, y1, 0.02)])
    # stone path
    poly("Terrain", "concrete", [(-107.0, y0, 0.03), (-103.0, y0, 0.03), (-103.0, -68.0, 0.03), (-107.0, -68.0, 0.03)])
    # torii
    tx, ty = -105.0, -91.0
    EXCL.append((tx, ty - 6.0, 6.0))
    for x in (tx - 2.4, tx + 2.4):
        cyl(C, x, ty, 0.03, 5.6, 0.32, 0.27, "vermilion", seg=12)
        cyl(C, x, ty, 0.03, 0.6, 0.38, 0.38, "black_wood", seg=12)
    box(C, tx - 3.1, ty - 0.25, 4.6, tx + 3.1, ty + 0.25, 4.95, "vermilion", skip=())
    box(C, tx - 3.8, ty - 0.35, 5.5, tx + 3.8, ty + 0.35, 5.85, "vermilion", skip=())
    box(C, tx - 4.0, ty - 0.4, 5.85, tx + 4.0, ty + 0.4, 6.15, "black_wood", skip=())
    face(C, "shrine_plaque", [(tx - 0.6, ty - 0.27, 4.95), (tx + 0.6, ty - 0.27, 4.95), (tx + 0.6, ty - 0.27, 5.5), (tx - 0.6, ty - 0.27, 5.5)],
         [(0, 0), (1, 0), (1, 1), (0, 1)])
    # stone lanterns
    for x in (-109.0, -101.0):
        for y in (-80.0, -72.0):
            box("Props", x - 0.4, y - 0.4, 0, x + 0.4, y + 0.4, 0.4, "concrete")
            cyl("Props", x, y, 0.4, 1.4, 0.15, 0.15, "concrete", seg=6)
            box("Props", x - 0.35, y - 0.35, 1.4, x + 0.35, y + 0.35, 1.9, "concrete")
            box("Props", x - 0.5, y - 0.5, 1.9, x + 0.5, y + 0.5, 2.1, "concrete")
    # haiden (worship hall) on a stone base with a deep tiled hip roof
    hx0, hy0, hx1, hy1 = -113.0, -66.0, -97.0, -54.0
    box(C, hx0 - 1, hy0 - 1, 0, hx1 + 1, hy1 + 1, 0.8, "concrete")
    box(C, hx0, hy0, 0.8, hx1, hy1, 4.6, {"*": "wood", "s": "black_wood"})
    for x in range(int(hx0), int(hx1) + 1, 4):
        cyl(C, x, hy0 - 0.3, 0.8, 4.6, 0.18, 0.18, "wood", seg=8)
    roof_hip(C, hx0, hy0, hx1, hy1, 4.6, 38, 1.8, "kawara_grey")
    box(C, -108.0, -68.0, 0.8, -102.0, -66.0, 1.4, "wood")  # offering box
    # honden behind
    box(C, -109.0, -50.0, 0.6, -101.0, -44.0, 3.8, {"*": "wood"})
    roof_gable(C, -109.0, -50.0, -101.0, -44.0, 3.8, False, 35, 0.9, "kawara_grey", "wood")
    # sacred forest
    for _ in range(26):
        x, y = R.uniform(x0 + 2, x1 - 2), R.uniform(y0 + 2, y1 - 2)
        if -116 < x < -94 and -92 < y < -42:
            continue
        tree(x, y, kind=R.choice(["cedar", "zelkova"]), scale=R.uniform(0.9, 1.25))
    # low wall around the grounds
    for (a, b, c_, d) in ((x0, y0, -108.0, y0 + 0.3), (-102.0, y0, x1, y0 + 0.3), (x0, y1 - 0.3, x1, y1),
                          (x0, y0, x0 + 0.3, y1), (x1 - 0.3, y0, x1, y1)):
        box(C, a, b, 0, c_, d, 1.0, "concrete")
    mark(x0, y0, x1, y1)


def build_park():
    C = "Props"
    x0, y0, x1, y1 = -292.0, -242.0, -232.0, -182.0
    poly("Terrain", "grass", [(x0, y0, 0.02), (x1, y0, 0.02), (x1, y1, 0.02), (x0, y1, 0.02)])
    poly("Terrain", "gravel", [(-280.0, -230.0, 0.03), (-250.0, -230.0, 0.03), (-250.0, -205.0, 0.03), (-280.0, -205.0, 0.03)])
    # perimeter fence
    for (a, b) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        tube(C, (a[0], a[1], 0.9), (b[0], b[1], 0.9), 0.03, "green_paint")
        n = int(math.dist(a, b) / 2.5)
        for k in range(n + 1):
            px, py = a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n
            cyl(C, px, py, 0, 0.9, 0.03, 0.03, "green_paint", seg=4, cap=False)
    # swings
    for x in (-276.0, -273.0):
        tube(C, (x, -226.0, 0), (x, -225.0, 2.4), 0.05, "red_paint")
        tube(C, (x, -224.0, 0), (x, -225.0, 2.4), 0.05, "red_paint")
    tube(C, (-277.0, -225.0, 2.4), (-269.0, -225.0, 2.4), 0.06, "red_paint")
    for x in (-276.0, -273.0, -270.5):
        for dx in (-0.25, 0.25):
            tube(C, (x + 1.2 + dx, -225.0, 2.4), (x + 1.2 + dx, -225.0, 0.5), 0.01, "metal_dark", seg=3)
        box(C, x + 0.85, -225.15, 0.45, x + 1.55, -224.85, 0.5, "wood")
    # slide
    box(C, -262.0, -222.0, 0, -260.0, -220.0, 2.0, {"*": "car_blue", "top": "metal_light"})
    obox(C, -262.0, -218.0, 0.0, 0.9, 4.6, 0.08, 0, "metal_light")
    # toilet block + benches + sandbox
    facade_box(C, -290.0, -196.0, 0, -284.0, -186.0, 3.0, {"*": "wall_light"}, top="roof_flat")
    for x in (-266.0, -258.0, -250.0):
        box(C, x, -232.5, 0.42, x + 1.8, -232.0, 0.47, "wood")
        box(C, x + 0.1, -232.4, 0, x + 0.2, -232.1, 0.42, "metal_dark")
        box(C, x + 1.6, -232.4, 0, x + 1.7, -232.1, 0.42, "metal_dark")
    for _ in range(18):
        x, y = R.uniform(x0 + 2, x1 - 2), R.uniform(y0 + 2, y1 - 2)
        if -282 < x < -248 and -232 < y < -203:
            continue
        tree(x, y, kind=R.choice(["zelkova", "ginkgo", "shrub"]), scale=R.uniform(0.8, 1.2))
    mark(x0, y0, x1, y1)


def coin_parking(x0, y0, x1, y1, front):
    poly("Terrain", "asphalt", [(x0, y0, 0.02), (x1, y0, 0.02), (x1, y1, 0.02), (x0, y1, 0.02)])
    horiz = front in ("n", "s")
    L = (x1 - x0) if horiz else (y1 - y0)
    n = int(L // 2.6)
    for k in range(n + 1):
        if horiz:
            xx = x0 + 0.3 + k * 2.6
            face("Markings", "paint_white", [(xx, y0 + 1, 0.03), (xx + 0.1, y0 + 1, 0.03), (xx + 0.1, y1 - 1, 0.03), (xx, y1 - 1, 0.03)], [(0, 0)] * 4)
            if k < n and R.random() < 0.55:
                car(xx + 1.3, (y0 + y1) / 2, math.pi / 2, kei=R.random() < 0.5)
        else:
            yy = y0 + 0.3 + k * 2.6
            face("Markings", "paint_white", [(x0 + 1, yy, 0.03), (x1 - 1, yy, 0.03), (x1 - 1, yy + 0.1, 0.03), (x0 + 1, yy + 0.1, 0.03)], [(0, 0)] * 4)
            if k < n and R.random() < 0.55:
                car((x0 + x1) / 2, yy + 1.3, 0.0, kei=R.random() < 0.5)
    # yellow "P" pay station
    cx, cy = (x0 + 0.8, y0 + 0.8)
    box("Props", cx, cy, 0, cx + 0.5, cy + 0.4, 1.4, "paint_yellow")


def vending_machine(x, y, yaw, v=1):
    """yaw = direction the front faces."""
    u0 = 0.0 if v % 2 else 0.5

    def uv(fk, pts, m):
        if fk == "e":
            return [(u0, 0), (u0 + 0.5, 0), (u0 + 0.5, 1), (u0, 1)]
        return None
    body = "red_paint" if v % 2 else "car_blue"
    obox("Props", x, y, 0, 0.75, 1.0, 1.83, yaw, {"*": body, "e": "vending"}, uv=uv)


# ----------------------------------------------------------- lot filling
def zone_for(r, x, y):
    d = math.dist((x, y), STATION)
    if r.rank == 3:
        return "commercial_hi" if d < 300 else "commercial"
    if r.rank == 2:
        return "commercial" if d < 230 else "mixed"
    return "dense_res" if d < 160 else "residential"


def place_frontage(r, side):
    f = r.half
    cuts = []
    for p, o, neg, pos in r.xings:
        if pos if side > 0 else neg:
            cuts.append((p - o.half - 0.6, p + o.half + 0.6))
    front = ({1: "s", -1: "n"} if r.axis == "x" else {1: "w", -1: "e"})[side]
    for s0, s1 in subtract((r.a, r.b), cuts):
        t = s0 + R.uniform(0.0, 1.5)
        while t < s1 - 5:
            x, y = r.W(t, side * (f + 5))
            z = zone_for(r, x, y)
            detail = in_core(x, y, 30)
            if z == "commercial_hi":
                w, dmax, dmin, setb, kind = R.uniform(9, 22), R.uniform(16, 26), 10, 0.2, "com"
            elif z == "commercial":
                w, dmax, dmin, setb, kind = R.uniform(8, 18), R.uniform(12, 20), 8, 0.3, "com"
            elif z == "mixed":
                kind = R.choice(["com", "man", "house", "house", "mid", "apa"])
                w, dmax, dmin, setb = R.uniform(9, 16), R.uniform(11, 17), 8, R.uniform(0.5, 1.5)
            elif z == "dense_res":
                kind = R.choice(["com", "man", "house", "house", "apa"])
                w, dmax, dmin, setb = R.uniform(8, 13), R.uniform(9, 14), 7, R.uniform(0.3, 1.0)
            else:
                kind = R.choices(["house", "apa", "man", "park"], [70, 14, 12, 4])[0]
                w, dmax, dmin, setb = R.uniform(8.5, 12), R.uniform(9, 13), 7.5, 0.3
                if kind == "man":
                    w, dmax = R.uniform(12, 16), R.uniform(11, 14)
                if kind == "apa":
                    w, dmax = R.uniform(12, 15), R.uniform(9, 11)
                if kind == "park":
                    w, dmax = R.uniform(14, 22), R.uniform(12, 16)
            w = min(w, s1 - t)
            if w < 6:
                break
            placed = False
            d = dmax
            while d >= dmin:
                x0, y0, x1, y1 = r.rect(t, t + w, side * (f + setb), side * (f + setb + d))
                if is_free(x0, y0, x1, y1, 0.35):
                    build_lot(kind, z, r, x0, y0, x1, y1, front, detail)
                    mark(x0, y0, x1, y1, building=True)
                    placed = True
                    break
                d -= 1.5
            t += (w + R.uniform(0.4, 1.4)) if placed else 2.0


def build_lot(kind, zone, r, x0, y0, x1, y1, front, detail):
    near = math.dist(((x0 + x1) / 2, (y0 + y1) / 2), STATION)
    if kind == "com":
        if zone == "commercial_hi":
            floors = R.randint(5, 12) if near < 250 else R.randint(4, 9)
            upper = R.choice(["f_office", "f_mid_beige", "f_mid_grey", "f_mid_brick", "f_mansion_white", "f_mid_beige"])
        elif zone == "commercial":
            floors = R.randint(3, 8) if near < 230 else R.randint(2, 5)
            upper = R.choice(["f_mid_beige", "f_mid_grey", "f_mid_brick", "f_mansion_white", "f_mansion_tile"])
        else:
            floors = R.randint(2, 5)
            upper = R.choice(["f_mid_beige", "f_mid_brick", "f_mansion_tile", "f_mid_grey"])
        commercial(x0, y0, x1, y1, front, floors, upper, sign=R.random() < 0.7 and r.rank >= 2,
                   billboard=r.rank == 3 and floors <= 8 and R.random() < 0.3, detail=detail)
    elif kind == "man":
        mansion(x0, y0, x1, y1, front, R.randint(3, 6) if zone != "residential" else R.randint(3, 4),
                R.choice(["f_mansion_white", "f_mansion_tile"]), detail=detail)
    elif kind == "mid":
        commercial(x0, y0, x1, y1, front, R.randint(3, 6), R.choice(["f_mid_beige", "f_mid_grey"]), sign=False, detail=detail)
    elif kind == "house":
        house(x0, y0, x1, y1, front, detail)
    elif kind == "apa":
        apaato(x0, y0, x1, y1, front, detail)
    elif kind == "park":
        coin_parking(x0, y0, x1, y1, front) if R.random() < 0.7 else pocket_park(x0, y0, x1, y1)
    if detail and kind in ("com", "man") and R.random() < 0.18:
        nx, ny = FRONT_NORMAL[front]
        if ny:
            yy = (y1 + 0.4) if ny > 0 else (y0 - 0.4)
            vending_machine(R.uniform(x0 + 1, x1 - 2), yy, math.atan2(ny, nx), R.randint(1, 2))


def pocket_park(x0, y0, x1, y1):
    poly("Terrain", "grass", [(x0, y0, 0.02), (x1, y0, 0.02), (x1, y1, 0.02), (x0, y1, 0.02)])
    for _ in range(3):
        tree(R.uniform(x0 + 2, x1 - 2), R.uniform(y0 + 2, y1 - 2), kind="zelkova", scale=0.8)
    box("Props", (x0 + x1) / 2 - 0.9, (y0 + y1) / 2, 0.42, (x0 + x1) / 2 + 0.9, (y0 + y1) / 2 + 0.45, 0.47, "wood")


def fill_interiors():
    """Pack the deep parts of blocks with back-lot houses, small apartments and parking."""
    step = 2.0
    ys = np.arange(WORLD[1] + 2, WORLD[3] - 12, step)
    xs = np.arange(WORLD[0] + 2, WORLD[2] - 12, step)
    sizes = [(11.0, 10.0), (10.0, 9.0), (9.0, 8.5), (8.0, 8.0), (7.0, 7.5)]
    for y in ys:
        for x in xs:
            i0, i1, j0, j1 = _cells(x, y, x + 7, y + 7.5)
            if OCC[j0:j1, i0:i1].any():
                continue
            for w, d in sizes:
                w, d = w + R.uniform(-0.5, 0.5), d + R.uniform(-0.5, 0.5)
                if is_free(x, y, x + w, y + d, 0.7):
                    front = R.choice("nsew")
                    detail = in_core(x, y, 20)
                    k = R.random()
                    if k < 0.8:
                        house(x, y, x + w, y + d, front, detail)
                    elif k < 0.9 and w >= 9:
                        apaato(x, y, x + w, y + d, front, detail)
                    elif k < 0.95:
                        coin_parking(x, y, x + w, y + d, front)
                    else:
                        pocket_park(x, y, x + w, y + d)
                    mark(x, y, x + w, y + d, building=True)
                    break


# ------------------------------------------------------------- street props
EXCL = []    # (x, y, r) keep-clear zones for props


def clear(x, y, r=1.5):
    return all(math.dist((x, y), (ex, ey)) > er + r for ex, ey, er in EXCL)


def signal_head(x, y, z, hx, hy, green):
    """Horizontal Japanese 3-lamp signal facing approaching traffic (heading hx, hy)."""
    C = "Props"
    lx, ly = -hy, hx                     # driver's left
    yaw = math.atan2(ly, lx)
    obox(C, x, y, z, 1.25, 0.32, 0.42, yaw, "signal_body", skip=())
    lamps = ((0.4, "lamp_green" if green else "lamp_off"), (0.0, "lamp_off"), (-0.4, "lamp_off" if green else "lamp_red"))
    for off, m in lamps:
        px, py = x + lx * off - hx * 0.16, y + ly * off - hy * 0.16
        tube(C, (px, py, z + 0.21), (px - hx * 0.05, py - hy * 0.05, z + 0.21), 0.14, m, seg=10, cap=True)
        # visor
        tube(C, (px - hx * 0.05, py - hy * 0.05, z + 0.33), (px - hx * 0.25, py - hy * 0.25, z + 0.33), 0.04, "signal_body", seg=4)


def build_signals():
    for X in XINGS:
        ew, ns = X["ew"], X["ns"]
        if ew.rank < 2 or ns.rank < 2 or not in_core(X["x"], X["y"]):
            continue
        cx, cy = X["x"], X["y"]
        for arm, (hx, hy), road, cross in (("s", (0, 1), ns, ew), ("n", (0, -1), ns, ew),
                                            ("w", (1, 0), ew, ns), ("e", (-1, 0), ew, ns)):
            if not X["arms"][arm]:
                continue
            lx, ly = -hy, hx
            # pole on the far-left corner (after crossing the junction)
            far = cross.cw / 2 + 2.0
            lat = road.cw / 2 + 0.7
            px, py = cx + hx * far + lx * lat, cy + hy * far + ly * lat
            cyl("Props", px, py, SW_H, 6.2, 0.14, 0.11, "metal_light", seg=8)
            arm_len = road.cw / 2 + 0.7 - (road.p["median"] / 2 + road.p["lane_w"]) * 0.5
            ex, ey = px - lx * arm_len, py - ly * arm_len
            tube("Props", (px, py, 5.9), (ex, ey, 5.9), 0.07, "metal_light", seg=6)
            signal_head(ex + lx * 0.4, ey + ly * 0.4, 5.35, hx, hy, green=(arm in "we"))
            # pedestrian signal on the same pole, facing across the road
            obox("Props", px - hx * 0.25, py - hy * 0.25, 2.3, 0.3, 0.3, 0.75, math.atan2(hy, hx), "signal_body")
            EXCL.append((px, py, 1.5))
            mark(px - 0.3, py - 0.3, px + 0.3, py + 0.3)


def build_bus_stops():
    stops = []
    for st in BUS_STOPS:
        r = next(rr for rr in ROADS if rr.axis == st["axis"] and abs(rr.c - st["c"]) < 0.1)
        s, side = st["s"], st["side"]
        t_pole = side * (r.cw / 2 + 0.6)
        px, py = r.W(s, t_pole)
        hx, hy = st["heading"]
        # pole on a weighted base + round plate + timetable
        cyl("Props", px, py, SW_H, SW_H + 0.12, 0.3, 0.3, "concrete", seg=10)
        cyl("Props", px, py, SW_H + 0.12, 2.75, 0.04, 0.04, "metal_light", seg=6)
        nx, ny = (r.perp_vec()[0] * side, r.perp_vec()[1] * side)     # pointing away from road
        dx, dy = hx, hy
        rad = 0.32
        for vx, vy in ((dx, dy), (-dx, -dy)):            # readable from both directions
            rx, ry = vy, -vx
            cx, cy = px - vx * 0.03, py - vy * 0.03
            pts = [(cx + rx * math.cos(a) * rad, cy + ry * math.cos(a) * rad, 2.6 + math.sin(a) * rad)
                   for a in (2 * math.pi * k / 16 for k in range(16))]
            uvs = [(0.5 + 0.5 * math.cos(2 * math.pi * k / 16), 0.5 + 0.5 * math.sin(2 * math.pi * k / 16)) for k in range(16)]
            face("Props", "busstop_plate", pts, uvs)
        # timetable faces the waiting passengers on the sidewalk
        plate("timetable", px + nx * 0.06, py + ny * 0.06, 1.5, -nx, -ny, 0.5, 0.8, back=None)
        # shelter
        if st.get("shelter") and r.sw >= 3:
            t0, t1 = side * (r.cw / 2 + 1.2), side * (r.cw / 2 + r.sw - 0.2)
            x0, y0, x1, y1 = r.rect(s - 4.5, s - 0.8, t0, t1)
            box("Props", x0, y0, 2.5, x1, y1, 2.62, {"*": "metal_light"}, skip=())
            bx0, by0, bx1, by1 = r.rect(s - 4.5, s - 0.8, t1 - side * 0.06, t1)
            box("Props", bx0, by0, 0.4 + SW_H, bx1, by1, 2.5, "glass")
            for sv in (s - 4.4, s - 0.9):
                for tv in (t0, t1):
                    qx, qy = r.W(sv, tv)
                    cyl("Props", qx, qy, SW_H, 2.5, 0.04, 0.04, "metal_dark", seg=6)
            bx0, by0, bx1, by1 = r.rect(s - 4.0, s - 1.3, t1 - side * 0.5, t1 - side * 0.1)
            box("Props", bx0, by0, 0.45 + SW_H, bx1, by1, 0.5 + SW_H, "wood")
        # バス text on the curb lane before the stop
        lane_t = side * (r.cw / 2 - r.p["shoulder"] - r.p["lane_w"] / 2)
        s_dir = 1 if (dx + dy) > 0 else -1
        s_far = s - s_dir * 14
        s_near = s_far - s_dir * 4.0
        a_, b_ = lane_t - 0.9, lane_t + 0.9
        paint_text(r, s_far, s_near, a_, b_, "paint_bus")
        EXCL.append((px, py, 7.0))
        stops.append(dict(name_ja=st["ja"], name_en=st["en"], pole=[round(px, 2), round(py, 2)],
                          stop_point=[round(v, 2) for v in r.W(s + s_dir * 1.5, side * (r.cw / 2 - r.p["shoulder"] - r.p["lane_w"] / 2))],
                          heading=[hx, hy]))
    return stops


BUS_STOPS = [
    dict(axis="y", c=140, s=105.0, side=1, heading=(0, -1), ja="桜ヶ丘二丁目", en="Sakuragaoka 2-chome", shelter=True),
    dict(axis="x", c=-170, s=105.0, side=-1, heading=(-1, 0), ja="南公園前", en="Minami Park", shelter=False),
    dict(axis="y", c=0, s=-135.0, side=-1, heading=(0, 1), ja="桜通り南", en="Sakura-dori South", shelter=True),
    dict(axis="x", c=0, s=-180.0, side=-1, heading=(-1, 0), ja="市役所前", en="City Hall", shelter=True),
    dict(axis="y", c=-220, s=110.0, side=-1, heading=(0, 1), ja="西町", en="Nishimachi", shelter=False),
]


def build_street_furniture():
    for r in ROADS:
        for s0, s1 in carriage_pieces(r):
            mid = r.W((s0 + s1) / 2, 0)
            if not in_core(*mid, 60):
                continue
            # --- arterial: ginkgo trees, white guard pipes, streetlights both sides
            if r.cls == "arterial":
                for side in (-1, 1):
                    t_tree = side * (r.cw / 2 + 1.1)
                    s = s0 + 12
                    while s < s1 - 12:
                        x, y = r.W(s, t_tree)
                        if clear(x, y, 2.0) and in_core(x, y):
                            pit = r.rect(s - 0.6, s + 0.6, t_tree - 0.6, t_tree + 0.6)
                            box("Props", pit[0], pit[1], SW_H, pit[2], pit[3], SW_H + 0.02, "soil")
                            tree(x, y, SW_H, "ginkgo")
                        s += 13
                    # guard pipe sections between trees
                    t_g = side * (r.cw / 2 + 0.35)
                    s = s0 + 8
                    while s < s1 - 8:
                        seg_end = min(s + 9.0, s1 - 8)
                        xa, ya = r.W(s, t_g)
                        xb, yb = r.W(seg_end, t_g)
                        if clear(xa, ya, 1) and clear(xb, yb, 1) and in_core(xa, ya):
                            for z in (0.55, 0.85):
                                tube("Props", (xa, ya, SW_H + z), (xb, yb, SW_H + z), 0.03, "guard_white", seg=5)
                            k = s
                            while k <= seg_end + 0.01:
                                qx, qy = r.W(k, t_g)
                                cyl("Props", qx, qy, SW_H, SW_H + 0.9, 0.04, 0.04, "guard_white", seg=5)
                                k += 2.25
                        s += 13
                    streetlights(r, s0, s1, side, 32.0, 6.5 if side < 0 else 0.0)
            elif r.cls == "secondary":
                streetlights(r, s0, s1, 1, 35.0, 0.0)
        # speed limit signs on the arterial
        if r.cls == "arterial":
            for s in np.arange(r.a + 40, r.b - 40, 140.0):
                for side, sgn in ((-1, 1), (1, -1)):
                    x, y = r.W(s, side * (r.cw / 2 + 0.5))
                    if in_core(x, y) and clear(x, y):
                        sign_pole(x, y, "sign_speed", r.dir_vec(), side if r.axis == "x" else -side, side, r)


def plate(mat, cx, cy, cz, hx, hy, w, h, uvs=((0, 0), (1, 0), (1, 1), (0, 1)), back="metal_light"):
    """Vertical plate centred at (cx, cy, cz) read by someone travelling along (hx, hy)."""
    rx, ry = hy, -hx                                  # viewer's right
    cx, cy = cx - hx * 0.03, cy - hy * 0.03
    pts = [(cx - rx * w / 2, cy - ry * w / 2, cz - h / 2), (cx + rx * w / 2, cy + ry * w / 2, cz - h / 2),
           (cx + rx * w / 2, cy + ry * w / 2, cz + h / 2), (cx - rx * w / 2, cy - ry * w / 2, cz + h / 2)]
    face("Props", mat, pts, list(uvs))
    if back:
        face("Props", back, [(p[0] + hx * 0.01, p[1] + hy * 0.01, p[2]) for p in pts[::-1]], [(0, 0)] * 4)


def sign_pole(x, y, mat, d, sgn, side, r, h=2.6, size=0.6, z0=SW_H):
    cyl("Props", x, y, z0, h + size / 2, 0.035, 0.035, "metal_light", seg=6)
    plate(mat, x, y, h, d[0] * sgn, d[1] * sgn, size, size)


def streetlights(r, s0, s1, side, step, offset):
    t = side * (r.cw / 2 + 0.45)
    s = s0 + 10 + offset
    while s < s1 - 6:
        x, y = r.W(s, t)
        if clear(x, y, 1.0) and in_core(x, y):
            cyl("Props", x, y, SW_H, 8.5, 0.1, 0.07, "metal_light", seg=8)
            ix, iy = r.W(s, t - side * 1.6)
            tube("Props", (x, y, 8.3), (ix, iy, 8.6), 0.05, "metal_light", seg=5)
            obox("Props", ix, iy, 8.45, 0.35, 0.7, 0.18, math.atan2(*(reversed(r.perp_vec()))), {"*": "metal_light", "bottom": "lamp_white"}, skip=())
            EXCL.append((x, y, 0.8))
        s += step


POLES = {}


def plan_utility_poles():
    """Utility poles along lanes and secondary streets; also curve mirrors and stop signs."""
    for r in ROADS:
        if r.cls == "arterial":
            continue
        side = 1 if (int(r.c) // 10) % 2 == 0 else -1
        for s0, s1 in subtract((r.a, r.b), [(p - o.half - 2.0, p + o.half + 2.0) for p, o, _, _ in r.xings]):
            n = max(1, int(round((s1 - s0) / 32)))
            for k in range(n + 1):
                s = s0 + (s1 - s0) * k / n
                t = side * (r.cw / 2 - 0.3 if r.sw == 0 else r.half - 0.4)
                x, y = r.W(s, t)
                if not in_core(x, y, 50):
                    continue
                POLES.setdefault((id(r), side), []).append((s, x, y))
    # curve mirrors at lane-lane junctions
    for X in XINGS:
        ew, ns = X["ew"], X["ns"]
        if ew.rank == 1 and ns.rank == 1 and in_core(X["x"], X["y"]):
            qx, qy = R.choice([(1, 1), (-1, 1), (1, -1), (-1, -1)])
            x, y = X["x"] + qx * (ns.cw / 2 + 0.15), X["y"] + qy * (ew.cw / 2 + 0.15)
            mark(x - 0.2, y - 0.2, x + 0.2, y + 0.2)
            MIRRORS.append((x, y, qx, qy))


MIRRORS = []


def build_utility_poles():
    C = "Props"
    for (rid, side), poles in POLES.items():
        poles.sort()
        tops = []
        for s, x, y in poles:
            if not clear(x, y, 0.6):
                tops.append(None)
                continue
            z0 = SW_H if any(r.sw > 0 and id(r) == rid for r in ROADS) else 0.0
            cyl(C, x, y, z0, 12.0, 0.2, 0.13, "pole_grey", seg=8)
            # tiger-stripe guard
            cyl(C, x, y, z0 + 0.3, z0 + 2.0, 0.205, 0.2, "paint_yellow", seg=8, cap=False)
            r = next(rr for rr in ROADS if id(rr) == rid)
            dx, dy = r.perp_vec()
            box(C, x - dx * 0.9 - 0.05 * dy, y - dy * 0.9 - 0.05 * dx, 11.2, x + dx * 0.9 + 0.05 * dy, y + dy * 0.9 + 0.05 * dx, 11.32, "metal_dark", skip=())
            for o in (-0.8, 0.0, 0.8):
                cyl(C, x + dx * o, y + dy * o, 11.32, 11.5, 0.05, 0.04, "guard_white", seg=5)
            if R.random() < 0.3:
                cyl(C, x + dx * 0.45, y + dy * 0.45, 8.0, 9.2, 0.28, 0.28, "metal_light", seg=10)
            box(C, x - 0.12, y - 0.12, 7.3, x + 0.12, y + 0.12, 7.5, "metal_dark", skip=())
            tops.append((x, y, dx, dy))
            EXCL.append((x, y, 0.5))
        # wires between consecutive poles
        for a, b in zip(tops, tops[1:]):
            if not a or not b:
                continue
            span = math.dist(a[:2], b[:2])
            if span > 48:
                continue
            for o, z, rad in ((-0.8, 11.45, 0.012), (0.0, 11.45, 0.012), (0.8, 11.45, 0.012), (0.0, 7.4, 0.03), (0.15, 6.9, 0.022)):
                p0 = (a[0] + a[2] * o, a[1] + a[3] * o, z)
                p1 = (b[0] + b[2] * o, b[1] + b[3] * o, z)
                sag = 0.018 * span + 0.2
                prev = p0
                for k in range(1, 9):
                    t = k / 8
                    cur = (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, z - sag * 4 * t * (1 - t))
                    tube("Wires", prev, cur, rad, "wire", seg=3, ref=p0)
                    prev = cur
    for x, y, qx, qy in MIRRORS:
        cyl(C, x, y, 0, 2.9, 0.04, 0.04, "orange", seg=6)
        cx, cy = x - qx * 0.25, y - qy * 0.25
        tube(C, (cx, cy, 2.9), (cx - qx * 0.08, cy - qy * 0.08, 2.9), 0.42, "orange", seg=14, cap=True)
        tube(C, (cx - qx * 0.081, cy - qy * 0.081, 2.9), (cx - qx * 0.09, cy - qy * 0.09, 2.9), 0.36, "mirror", seg=14, cap=True)
    for r, s, side, dirn in STOP_SIGNS:
        if not in_core(*r.W(s, 0)):
            continue
        t = side * (r.cw / 2 - 0.2)
        x, y = r.W(s, t)
        d = r.dir_vec()
        sign_pole(x, y, "sign_stop", d, -dirn, side, r, h=2.4, size=0.8, z0=0.0)


def build_direction_sign():
    """Overhead blue guide sign over the arterial approaching the main junction."""
    r = next(rr for rr in ROADS if rr.cls == "arterial" and rr.axis == "y")
    s = -60.0
    x0, y0 = r.W(s, r.cw / 2 + 0.8)
    x1, y1 = r.W(s, -r.cw / 2 - 0.8)
    for x, y in ((x0, y0), (x1, y1)):
        cyl("Props", x, y, SW_H, 7.6, 0.2, 0.2, "metal_light", seg=8)
    tube("Props", (x0, y0, 7.3), (x1, y1, 7.3), 0.12, "metal_light", seg=6)
    # sign faces south (northbound traffic): normal -y, reading left->right = west->east
    face("Props", "sign_dir", [(-7.6, s - 0.3, 4.9), (-0.4, s - 0.3, 4.9), (-0.4, s - 0.3, 7.9), (-7.6, s - 0.3, 7.9)],
         [(0, 0), (1, 0), (1, 1), (0, 1)])
    box("Props", -7.6, s - 0.28, 4.9, -0.4, s - 0.15, 7.9, "metal_light")
    EXCL.append((x0, y0, 2.0))
    EXCL.append((x1, y1, 2.0))


# ----------------------------------------------------------------- route
def lane_point(r, s, heading_sign):
    """Centre of the leftmost (curb) lane for traffic moving +/- along r."""
    p = r.p
    off = p["median"] / 2 + (p["lanes"] - 0.5) * p["lane_w"]
    # driving on the left: moving +x -> north half (+t); moving +y -> west half (-t)
    t = off * heading_sign if r.axis == "x" else -off * heading_sign
    return r.W(s, t)


def fillet(points, closed=True, step=2.0):
    pts = [np.array(p, float) for p in points]
    n = len(pts)
    out = []
    for i in range(n):
        p_prev, p, p_next = pts[i - 1], pts[i], pts[(i + 1) % n]
        a = p - p_prev
        b = p_next - p
        la, lb = np.linalg.norm(a), np.linalg.norm(b)
        a, b = a / la, b / lb
        cross = a[0] * b[1] - a[1] * b[0]
        rad = 7.0 if cross > 0 else 12.0     # left turns tight, right turns wide
        ang = math.acos(max(-1, min(1, float(np.dot(a, b)))))
        if ang < 1e-3:
            out.append(p)
            continue
        tlen = min(rad * math.tan(ang / 2), la * 0.45, lb * 0.45)
        rad = tlen / math.tan(ang / 2)
        p0 = p - a * tlen
        nrm = np.array((-a[1], a[0])) * (1 if cross > 0 else -1)
        c = p0 + nrm * rad
        a0 = math.atan2(p0[1] - c[1], p0[0] - c[0])
        sweep = ang * (1 if cross > 0 else -1)
        k = max(3, int(abs(sweep) * rad / step))
        for j in range(k + 1):
            t = a0 + sweep * j / k
            out.append(c + rad * np.array((math.cos(t), math.sin(t))))
    # resample straight parts
    res = []
    for i in range(len(out)):
        p, q = out[i], out[(i + 1) % len(out)]
        L = np.linalg.norm(q - p)
        m = max(1, int(L / step))
        for j in range(m):
            res.append(p + (q - p) * j / m)
    return res


def bus_route():
    by = PLAZA["y1"] - 1.6
    corners = [
        (-30.0, by), (45.0, by), (45.0, 151.625), (141.625, 151.625), (141.625, -171.625),
        (-5.675, -171.625), (-5.675, -5.675), (-221.625, -5.675), (-221.625, 151.625), (-45.0, 151.625), (-45.0, by),
    ]
    path = fillet(corners)
    # rotate so the path starts at berth 1
    i0 = min(range(len(path)), key=lambda i: math.dist(path[i], (-30.0, by)))
    path = path[i0:] + path[:i0]
    return [(float(p[0]), float(p[1])) for p in path]


def write_route_json(stops, path):
    def gl(p, z=0.0):     # Blender (x, y, z) -> glTF (x, z, -y)
        return [round(p[0], 3), round(z, 3), round(-p[1], 3)]
    cum = [0.0]
    for a, b in zip(path, path[1:]):
        cum.append(cum[-1] + math.dist(a, b))
    all_stops = [dict(name_ja="桜ヶ丘駅 1番のりば", name_en="Sakuragaoka Sta. (Berth 1)", pole=[-23.5, PLAZA["y1"] + 0.7],
                      stop_point=[-26.0, PLAZA["y1"] - 1.6], heading=[1, 0])] + stops
    for st in all_stops:
        i = min(range(len(path)), key=lambda k: math.dist(path[k], st["stop_point"]))
        st["route_index"] = i
        st["route_distance_m"] = round(cum[i], 1)
        st["stop_point_gltf"] = gl(st["stop_point"])
    all_stops.sort(key=lambda s: s["route_distance_m"])
    roads = [dict(name_ja=r.name_ja, name_en=r.name_en, cls=r.cls, axis="EW" if r.axis == "x" else "NS",
                  start=[*r.W(max(r.a, CORE[0] if r.axis == "x" else CORE[1]), 0)],
                  end=[*r.W(min(r.b, CORE[2] if r.axis == "x" else CORE[3]), 0)],
                  carriageway_m=r.cw, sidewalk_m=r.sw, lanes_per_direction=r.p["lanes"], lane_width_m=r.p["lane_w"],
                  median_m=r.p["median"])
             for r in ROADS if (r.a < CORE[2] and r.b > CORE[0]) if r.axis == "x" or (r.a < CORE[3] and r.b > CORE[1])]
    data = dict(
        map=MAP_NAME, country="Japan", city="Sakuragaoka, Tokyo (fictional)",
        units="metres", traffic="left-hand", speed_limit_kmh=dict(arterial=40, secondary=30, lane=30),
        coordinate_systems=dict(blender="+X east, +Y north, +Z up", gltf="+X east, +Y up, -Z north (gltf = [x, z, -y])"),
        drivable_bounds_blender=dict(xmin=CORE[0], ymin=CORE[1], xmax=CORE[2], ymax=CORE[3]),
        spawn=dict(position=[-30.0, PLAZA["y1"] - 1.6, 0.0], position_gltf=gl((-30.0, PLAZA["y1"] - 1.6)), heading_deg_from_east=0.0,
                   note="Bus berth 1 at Sakuragaoka Station, facing east, doors (left side) to the platform"),
        route=dict(name_ja="桜ヶ丘循環", name_en="Sakuragaoka Loop", length_m=round(cum[-1] + math.dist(path[-1], path[0]), 1), loop=True,
                   points=[[round(p[0], 2), round(p[1], 2)] for p in path],
                   points_gltf=[gl(p) for p in path]),
        stops=all_stops,
        roads=roads,
        signalised_junctions=[[X["x"], X["y"]] for X in XINGS if X["ew"].rank >= 2 and X["ns"].rank >= 2 and in_core(X["x"], X["y"])],
    )
    with open(os.path.join(OUT, MAP_NAME + "_route.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return data


def route_curve(path):
    cu = bpy.data.curves.new("BusRoute", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(path) - 1)
    for i, p in enumerate(path):
        sp.points[i].co = (p[0], p[1], 0.3, 1)
    sp.use_cyclic_u = True
    cu.bevel_depth = 0.25
    ob = bpy.data.objects.new("BusRoute_Sakuragaoka_Loop", cu)
    m = bpy.data.materials.new("route_overlay")
    m.diffuse_color = (1, 0.3, 0, 1)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (1, 0.3, 0, 1)
    b.inputs["Emission Color"].default_value = (1, 0.3, 0, 1)
    b.inputs["Emission Strength"].default_value = 3
    cu.materials.append(m)
    coll("BusRoute (helper)").objects.link(ob)
    ob.hide_render = True
    return ob


# ------------------------------------------------------------- finalise
def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def flush_batches(mats):
    objs = []
    for (cname, mat, cx, cy), b in sorted(BATCHES.items()):
        if not b.f:
            continue
        name = f"{cname}_{mat}_{cx}_{cy}"
        me = bpy.data.meshes.new(name)
        me.from_pydata(b.v, [], b.f)
        uvl = me.uv_layers.new(name="UVMap")
        flat = [uv for fu in b.uv for uv in fu]
        uvl.data.foreach_set("uv", [c for uv in flat for c in uv])
        me.materials.append(mats[mat])
        me.polygons.foreach_set("use_smooth", b.sm)
        if any(b.sm):
            # weld so smooth faces share vertices (UVs live on loops, so seams survive)
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
            bm.to_mesh(me)
            bm.free()
        me.validate()
        ob = bpy.data.objects.new(name, me)
        ob["nbs_collision"] = cname in ("Roads", "Sidewalks", "Buildings", "Station", "Railway", "Terrain")
        ob["nbs_surface"] = {"Roads": "asphalt", "Sidewalks": "curb", "Terrain": "ground"}.get(cname, "")
        coll(cname).objects.link(ob)
        objs.append(ob)
    return objs


def ground_plane(mats):
    poly("Terrain", "ground", [(WORLD[0], WORLD[1], -0.03), (WORLD[2], WORLD[1], -0.03), (WORLD[2], WORLD[3], -0.03), (WORLD[0], WORLD[3], -0.03)])
    # distant flat ring (Kanto plain) so the horizon never shows the void
    F = 6000.0
    ring = [((-F, -F), (F, -F), (F, WORLD[1]), (-F, WORLD[1])), ((-F, WORLD[3]), (F, WORLD[3]), (F, F), (-F, F)),
            ((-F, WORLD[1]), (WORLD[0], WORLD[1]), (WORLD[0], WORLD[3]), (-F, WORLD[3])),
            ((WORLD[2], WORLD[1]), (F, WORLD[1]), (F, WORLD[3]), (WORLD[2], WORLD[3]))]
    for q in ring:
        face("Backdrop", "far_ground", [(x, y, -0.2) for x, y in q], [(x / 60, y / 60) for x, y in q], ref=(0, 0))


def setup_world():
    sc = bpy.context.scene
    w = bpy.data.worlds.new("Sky")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    sky = nt.nodes.new("ShaderNodeTexSky")
    types = [i.identifier for i in sky.bl_rna.properties["sky_type"].enum_items]
    pick = next((t for t in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "PREETHAM") if t in types), types[0])
    sky.sky_type = pick
    for attr, val in (("sun_disc", False), ("sun_elevation", math.radians(38)), ("sun_rotation", math.radians(140)),
                      ("altitude", 40.0), ("air_density", 1.0), ("dust_density", 1.6), ("ozone_density", 1.0)):
        try:
            setattr(sky, attr, val)
        except Exception:
            pass
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.35 if pick in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING") else 1.0
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 4.2
    sun_d.angle = math.radians(1.2)
    sun_d.color = (1.0, 0.96, 0.9)
    sun = bpy.data.objects.new("Sun", sun_d)
    sun.rotation_euler = (math.radians(52), 0, math.radians(140 + 90))
    coll("Lighting").objects.link(sun)
    sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    sc.unit_settings.system = "METRIC"


def add_camera(name, loc, target, lens=28, ortho=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_end = 3000
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    ob = bpy.data.objects.new(name, cd)
    ob.location = loc
    d = np.subtract(target, loc)
    yaw = math.atan2(d[1], d[0])
    pitch = math.atan2(d[2], math.hypot(d[0], d[1]))
    ob.rotation_euler = (math.pi / 2 + pitch, 0, yaw - math.pi / 2)
    coll("Cameras").objects.link(ob)
    return ob


def setup_cameras():
    cams = [
        add_camera("Cam_Aerial", (-260, -330, 230), (10, 60, 0), 30),
        add_camera("Cam_StationRotary", (-38, 162, 3.0), (20, 205, 4), 22),
        add_camera("Cam_BusDriver_Arterial", (-120, -5.7, 2.6), (60, -2.0, 4), 24),
        add_camera("Cam_Residential_Lane", (-141.0, -238, 1.7), (-139.5, -180, 4), 24),
        add_camera("Cam_Ekimae_Street", (100, 147.5, 2.6), (-40, 154, 6), 24),
        add_camera("Cam_Shrine", (-105, -110, 2.0), (-105, -60, 5), 26),
        add_camera("Cam_TopDown", (0, 40, 600), (0, 40.001, 0), 50, ortho=780),
    ]
    bpy.context.scene.camera = cams[0]
    return cams


def render_previews(samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    pv = os.path.join(OUT, "previews")
    os.makedirs(pv, exist_ok=True)
    rc = coll("BusRoute (helper)")
    only = _arg("--only")
    for cam in [o for o in bpy.data.objects if o.type == "CAMERA"]:
        if only and only not in cam.name:
            continue
        sc.camera = cam
        top = cam.name == "Cam_TopDown"
        sc.render.resolution_x, sc.render.resolution_y = (2048, 2048) if top else (1600, 900)
        sc.cycles.samples = max(8, samples // 3) if top else samples
        sc.render.filepath = os.path.join(pv, cam.name.replace("Cam_", "").lower() + ".jpg")
        print("rendering", cam.name, flush=True)
        bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = build_materials()
    connect_roads()
    build_station()           # sets plaza sidewalk gaps before roads are built
    build_roads()
    build_railway()
    build_konbini()
    build_gas_station()
    build_shrine()
    build_park()
    stops = build_bus_stops()
    build_signals()
    build_direction_sign()
    plan_utility_poles()
    # buildings: arterial frontages first, then streets, then lanes
    for rank in (3, 2, 1):
        for r in ROADS:
            if r.rank == rank:
                for side in (1, -1):
                    place_frontage(r, side)
    fill_interiors()
    build_street_furniture()
    build_utility_poles()
    # cars on the street + taxis at the rotary
    for k in range(4):
        car(-20 + k * 6.5, PLAZA["y0"] + 1.6, math.pi, taxi=True)
    ground_plane(mats)
    print("faces:", STATS["faces"], "batches:", len(BATCHES), flush=True)
    reference_bus(-26.0, PLAZA["y1"] - 1.6, 0.0)
    flush_batches(mats)
    path = bus_route()
    data = write_route_json(stops, path)
    route_curve(path)
    setup_world()
    setup_cameras()
    for c in ("ReferenceBus", "BusRoute (helper)", "Cameras", "Lighting"):
        coll(c)
    if not _arg("--no-glb"):
        export_glb()
    blend = os.path.join(OUT, MAP_NAME + ".blend")
    try:
        bpy.ops.file.pack_all()
    except Exception as e:
        print("pack failed:", e)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print("saved", blend, "route length", data["route"]["length_m"], "m", flush=True)
    if _arg("--render"):
        render_previews(int(_arg("--samples", 48)))


def export_glb():
    keep = {"Roads", "Sidewalks", "Markings", "Buildings", "Station", "Railway", "Terrain", "Vegetation", "Props", "Wires", "Vehicles", "Backdrop"}
    for ob in bpy.data.objects:
        ob.select_set(False)
    sel = [ob for c in bpy.data.collections if c.name in keep for ob in c.objects if ob.type == "MESH"]
    vl = bpy.context.view_layer
    for ob in sel:
        ob.select_set(True)
    vl.objects.active = sel[0]
    path = os.path.join(OUT, MAP_NAME + ".glb")
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=False, export_extras=True,
              export_image_format="AUTO", export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        kw.pop("export_image_format")
        bpy.ops.export_scene.gltf(**kw)
    for ob in sel:
        ob.select_set(False)
    print("exported", path, os.path.getsize(path) // 1024, "KB", flush=True)


if __name__ == "__main__":
    main()
