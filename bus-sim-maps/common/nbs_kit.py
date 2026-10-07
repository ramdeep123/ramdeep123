"""Shared Blender toolkit for NammaBusSim map generators.

Geometry is accumulated per (collection, material, 200 m chunk) and turned into
real meshes once at the end, which keeps a city of ~1M faces fast to build.
Curved-road helpers use shapely (pip install shapely into Blender's Python).
"""
import math
import os
import random

import bpy
import bmesh
import numpy as np

CFG = dict(world=(-1000, -1000, 1000, 1000), chunk=200.0, mats={}, tex="")
R = random.Random(1)
BATCHES = {}
STATS = {"faces": 0}


def configure(world, mats, tex_dir, seed=1, chunk=200.0):
    CFG.update(world=world, mats=mats, tex=tex_dir, chunk=chunk)
    R.seed(seed)
    BATCHES.clear()
    STATS["faces"] = 0


def srgb(*c):
    return tuple(((v / 255) / 12.92) if v / 255 <= 0.04045 else (((v / 255) + 0.055) / 1.055) ** 2.4 for v in c)


# ------------------------------------------------------------- materials
def build_materials():
    out = {}
    for name, spec in CFG["mats"].items():
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        bsdf.inputs["Roughness"].default_value = spec.get("rough", 0.8)
        bsdf.inputs["Metallic"].default_value = spec.get("metal", 0.0)
        if "img" in spec:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(os.path.join(CFG["tex"], spec["img"]), check_existing=True)
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
        if spec.get("transmission"):
            bsdf.inputs["Transmission Weight"].default_value = spec["transmission"]
        m.diffuse_color = (*spec.get("color", (0.6, 0.6, 0.6)), 1.0)
        out[name] = m
    return out


# ------------------------------------------------------- mesh accumulator
class Batch:
    __slots__ = ("v", "f", "uv", "sm")

    def __init__(self):
        self.v, self.f, self.uv, self.sm = [], [], [], []


def face(coll, mat, pts, uvs, ref=None, smooth=False):
    w = CFG["world"]
    ref = ref or pts[0]
    key = (coll, mat, int((ref[0] - w[0]) // CFG["chunk"]), int((ref[1] - w[1]) // CFG["chunk"]))
    b = BATCHES.get(key)
    if b is None:
        b = BATCHES[key] = Batch()
    i0 = len(b.v)
    b.v.extend(pts)
    b.f.append(tuple(range(i0, i0 + len(pts))))
    b.uv.append(uvs)
    b.sm.append(smooth)
    STATS["faces"] += 1


def normal(pts):
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
    nx, ny, nz = normal(pts)
    if abs(nz) > 0.7:
        return [(p[0] / T, p[1] / T) for p in pts]
    rx, ry = -ny, nx
    l = math.hypot(rx, ry) or 1.0
    return [((p[0] * rx + p[1] * ry) / l / T, p[2] / T) for p in pts]


def uv_facade(pts, tw, th, z0, u0=0.0):
    nx, ny, nz = normal(pts)
    rx, ry = -ny, nx
    l = math.hypot(rx, ry) or 1.0
    rx, ry = rx / l, ry / l
    base = min(p[0] * rx + p[1] * ry for p in pts)
    return [((p[0] * rx + p[1] * ry - base) / tw + u0, (p[2] - z0) / th) for p in pts]


def auto_uv(mat, pts, z0=0.0, u0=0.0):
    spec = CFG["mats"][mat]
    if "T" in spec:
        return uv_world(pts, spec["T"])
    if "tw" in spec:
        return uv_facade(pts, spec["tw"], spec["th"], z0, u0)
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
    x0, x1 = min(x0, x1), max(x0, x1)
    y0, y1 = min(y0, y1), max(y0, y1)
    ref = ((x0 + x1) / 2, (y0 + y1) / 2)
    for fk, fn in BOX_FACES.items():
        if fk in skip:
            continue
        m = mat.get(fk, mat.get("*")) if isinstance(mat, dict) else mat
        if m is None:
            continue
        pts = fn(x0, y0, z0, x1, y1, z1)
        face(coll, m, pts, (uv(fk, pts, m) if uv else None) or auto_uv(m, pts), ref)


def obox(coll, cx, cy, z0, sx, sy, sz, yaw, mat, skip=("bottom",), uv=None, zuv=None, u0=0.0):
    """Box centred on (cx, cy), local size sx (along yaw) x sy, z0..z0+sz.
    Local faces: 's' = -y side, 'n' = +y, 'e' = +x, 'w' = -x."""
    c, s = math.cos(yaw), math.sin(yaw)
    hx, hy = sx / 2, sy / 2
    for fk, fn in BOX_FACES.items():
        if fk in skip:
            continue
        m = mat.get(fk, mat.get("*")) if isinstance(mat, dict) else mat
        if m is None:
            continue
        pts = [(cx + p[0] * c - p[1] * s, cy + p[0] * s + p[1] * c, p[2]) for p in fn(-hx, -hy, z0, hx, hy, z0 + sz)]
        uvs = uv(fk, pts, m) if uv else None
        face(coll, m, pts, uvs or auto_uv(m, pts, z0 if zuv is None else zuv, u0), (cx, cy))


def local(cx, cy, yaw, lx, ly):
    c, s = math.cos(yaw), math.sin(yaw)
    return cx + lx * c - ly * s, cy + lx * s + ly * c


def cyl(coll, cx, cy, z0, z1, r0, r1, mat, seg=8, cap=True):
    ring0 = [(cx + r0 * math.cos(2 * math.pi * i / seg), cy + r0 * math.sin(2 * math.pi * i / seg), z0) for i in range(seg)]
    ring1 = [(cx + r1 * math.cos(2 * math.pi * i / seg), cy + r1 * math.sin(2 * math.pi * i / seg), z1) for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        face(coll, mat, [ring0[i], ring0[j], ring1[j], ring1[i]],
             [(i / seg, z0), ((i + 1) / seg, z0), ((i + 1) / seg, z1), (i / seg, z1)], (cx, cy), smooth=True)
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
    rings = [[tuple(np.add(p, r * (math.cos(2 * math.pi * i / seg) * u + math.sin(2 * math.pi * i / seg) * v))) for i in range(seg)] for p in (p0, p1)]
    for i in range(seg):
        j = (i + 1) % seg
        face(coll, mat, [rings[0][i], rings[0][j], rings[1][j], rings[1][i]],
             [(i / seg, 0), ((i + 1) / seg, 0), ((i + 1) / seg, L), (i / seg, L)], ref or p0, smooth=seg > 4)
    if cap:
        face(coll, mat, rings[1], [(0.5, 0.5)] * seg, ref or p0)
        face(coll, mat, rings[0][::-1], [(0.5, 0.5)] * seg, ref or p0)


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
    T = CFG["mats"][mat].get("T", 3.0)
    for f in faces:
        pts = [P[i] for i in f]
        face(coll, mat, pts, [((p[0] + p[1]) / T, p[2] / T) for p in pts], (cx, cy), smooth=True)


def crown(coll, mat, cx, cy, cz, rx, ry, rz, n):
    blob(coll, mat, cx, cy, cz, rx * 0.72, ry * 0.72, rz * 0.72, rough=0.08)
    for _ in range(n):
        a = R.uniform(0, 2 * math.pi)
        e = R.uniform(-0.6, 0.9)
        d = R.uniform(0.45, 0.75)
        k = math.sqrt(1 - e * e)
        rr = R.uniform(0.38, 0.55)
        blob(coll, mat, cx + math.cos(a) * k * rx * d, cy + math.sin(a) * k * ry * d, cz + e * rz * d,
             rx * rr, ry * rr, rz * rr * 0.9, rough=0.1, level=1)


# ---------------------------------------------------- curved-road helpers
def catmull_rom(points, step=2.0):
    """Centripetal Catmull-Rom through points, resampled roughly every `step` m."""
    P = [np.array(p, float) for p in points]
    if len(P) == 2:
        L = np.linalg.norm(P[1] - P[0])
        n = max(1, int(L / step))
        return [tuple(P[0] + (P[1] - P[0]) * i / n) for i in range(n + 1)]
    P = [2 * P[0] - P[1]] + P + [2 * P[-1] - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-6) ** 0.5
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-6) ** 0.5
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-6) ** 0.5
        n = max(2, int(np.linalg.norm(p2 - p1) / step))
        for k in range(n):
            t = t1 + (t2 - t1) * k / n
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append(tuple((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2))
    out.append(tuple(P[-2]))
    return out


def _polys(geom):
    if geom is None or geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom]
    if hasattr(geom, "geoms"):
        return [g for sub in geom.geoms for g in _polys(sub)]
    return []


def tri_area(coll, mat, geom, z, T=None, uvs_fn=None):
    """Triangulate a shapely (Multi)Polygon (constrained Delaunay) into flat faces at height z."""
    import shapely
    T = T or CFG["mats"][mat].get("T", 4.0)
    for pg in _polys(geom):
        tris = shapely.constrained_delaunay_triangles(pg)
        for t in getattr(tris, "geoms", []):
            c = list(t.exterior.coords)[:3]
            pts = [(x, y, z) for x, y in c]
            if normal(pts)[2] < 0:
                pts = pts[::-1]
            cx, cy = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3
            face(coll, mat, pts, uvs_fn(pts) if uvs_fn else [(p[0] / T, p[1] / T) for p in pts], (cx, cy))


def ring_walls(coll, geom, z0, z1, mat_fn, step_uv=1.0):
    """Vertical walls along every ring of a (Multi)Polygon, facing outward from the polygon.
    mat_fn(midpoint_outside_xy) -> material name or None."""
    for pg in _polys(geom):
        rings = [(pg.exterior, True)] + [(r, False) for r in pg.interiors]
        for ring, is_ext in rings:
            cs = list(ring.coords)
            ccw = ring.is_ccw
            outward_ccw = (ccw == is_ext)     # walk direction where outside is on the right
            run = 0.0
            for a, b in zip(cs, cs[1:]):
                L = math.dist(a, b)
                if L < 1e-4:
                    continue
                dx, dy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                ox, oy = (dy, -dx) if outward_ccw else (-dy, dx)
                mid = ((a[0] + b[0]) / 2 + ox * 0.3, (a[1] + b[1]) / 2 + oy * 0.3)
                m = mat_fn(mid)
                if m:
                    p, q = (a, b) if outward_ccw else (b, a)
                    pts = [(p[0], p[1], z0), (q[0], q[1], z0), (q[0], q[1], z1), (p[0], p[1], z1)]
                    face(coll, m, pts, [(run / step_uv, 0), ((run + L) / step_uv, 0), ((run + L) / step_uv, 1), (run / step_uv, 1)], mid)
                run += L


def ribbon(coll, mat, pts, w, z, uv_len=None, ref=None):
    """Flat strip of width w following a 2D polyline."""
    if len(pts) < 2:
        return
    P = np.array(pts, float)
    tang = np.gradient(P, axis=0)
    tang /= (np.linalg.norm(tang, axis=1)[:, None] + 1e-9)
    nrm = np.stack([-tang[:, 1], tang[:, 0]], 1)
    L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    left, right = P + nrm * w / 2, P - nrm * w / 2
    for i in range(len(P) - 1):
        q = [(right[i][0], right[i][1], z), (right[i + 1][0], right[i + 1][1], z), (left[i + 1][0], left[i + 1][1], z), (left[i][0], left[i][1], z)]
        u0, u1 = (L[i] / uv_len, L[i + 1] / uv_len) if uv_len else (0, 0)
        face(coll, mat, q, [(0, u0), (0, u1), (1, u1), (1, u0)], ref or (P[i][0], P[i][1]))


def sweep_box(coll, mat_top, mat_side, pts, w, z0, z1, mat_bottom=None, uvT=4.0):
    """Box section swept along a 2D polyline (viaduct decks, walls)."""
    P = np.array(pts, float)
    tang = np.gradient(P, axis=0)
    tang /= (np.linalg.norm(tang, axis=1)[:, None] + 1e-9)
    nrm = np.stack([-tang[:, 1], tang[:, 0]], 1)
    L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    lf, rt = P + nrm * w / 2, P - nrm * w / 2
    for i in range(len(P) - 1):
        a, b = i, i + 1
        ref = (P[i][0], P[i][1])
        u0, u1 = L[a] / uvT, L[b] / uvT
        face(coll, mat_top, [(*rt[a], z1), (*rt[b], z1), (*lf[b], z1), (*lf[a], z1)], [(0, u0), (0, u1), (w / uvT, u1), (w / uvT, u0)], ref)
        if mat_bottom:
            face(coll, mat_bottom, [(*lf[a], z0), (*lf[b], z0), (*rt[b], z0), (*rt[a], z0)], [(0, u0), (0, u1), (1, u1), (1, u0)], ref)
        h = (z1 - z0) / uvT
        face(coll, mat_side, [(*rt[b], z0), (*rt[a], z0), (*rt[a], z1), (*rt[b], z1)], [(u1, 0), (u0, 0), (u0, h), (u1, h)], ref)
        face(coll, mat_side, [(*lf[a], z0), (*lf[b], z0), (*lf[b], z1), (*lf[a], z1)], [(u0, 0), (u1, 0), (u1, h), (u0, h)], ref)


# -------------------------------------------------------------- output
def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def flush(mats, collision=(), surfaces=None):
    surfaces = surfaces or {}
    for (cname, mat, cx, cy), b in sorted(BATCHES.items()):
        if not b.f:
            continue
        name = f"{cname}_{mat}_{cx}_{cy}"
        me = bpy.data.meshes.new(name)
        me.from_pydata(b.v, [], b.f)
        uvl = me.uv_layers.new(name="UVMap")
        uvl.data.foreach_set("uv", [c for fu in b.uv for uv in fu for c in uv])
        me.materials.append(mats[mat])
        me.polygons.foreach_set("use_smooth", b.sm)
        bm = bmesh.new()                     # weld coincident verts (UVs live on loops)
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        bm.to_mesh(me)
        bm.free()
        me.validate()
        ob = bpy.data.objects.new(name, me)
        ob["nbs_collision"] = cname in collision
        ob["nbs_surface"] = surfaces.get(cname, "")
        coll(cname).objects.link(ob)
    BATCHES.clear()


def setup_world(sun_elev=40, sun_az=140, sun_energy=4.2, sky_strength=0.35, dust=1.6):
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
    for attr, val in (("sun_disc", False), ("sun_elevation", math.radians(sun_elev)), ("sun_rotation", math.radians(sun_az)),
                      ("altitude", 40.0), ("air_density", 1.0), ("dust_density", dust), ("ozone_density", 1.0)):
        try:
            setattr(sky, attr, val)
        except Exception:
            pass
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = sky_strength if pick != "PREETHAM" else 1.0
    sd = bpy.data.lights.new("Sun", "SUN")
    sd.energy = sun_energy
    sd.angle = math.radians(1.2)
    sd.color = (1.0, 0.95, 0.88)
    sun = bpy.data.objects.new("Sun", sd)
    sun.rotation_euler = (math.radians(90 - sun_elev), 0, math.radians(sun_az + 90))
    coll("Lighting").objects.link(sun)
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    sc.unit_settings.system = "METRIC"


def add_camera(name, loc, target, lens=28, ortho=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_end = 60000
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    ob = bpy.data.objects.new(name, cd)
    ob.location = loc
    d = np.subtract(target, loc)
    ob.rotation_euler = (math.pi / 2 + math.atan2(d[2], math.hypot(d[0], d[1])), 0, math.atan2(d[1], d[0]) - math.pi / 2)
    coll("Cameras").objects.link(ob)
    return ob


def export_glb(path, keep):
    for ob in bpy.data.objects:
        ob.select_set(False)
    sel = [ob for c in bpy.data.collections if c.name in keep for ob in c.objects if ob.type == "MESH"]
    for ob in sel:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = sel[0]
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
              export_extras=True, export_image_format="AUTO", export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        kw.pop("export_image_format")
        bpy.ops.export_scene.gltf(**kw)
    for ob in sel:
        ob.select_set(False)
    print("exported", path, os.path.getsize(path) // 1024, "KB", flush=True)


def save_blend(path):
    try:
        bpy.ops.file.pack_all()
    except Exception as e:
        print("pack failed:", e)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)


def render_previews(outdir, samples, only=None, topdown="Cam_TopDown"):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    os.makedirs(outdir, exist_ok=True)
    for cam in [o for o in bpy.data.objects if o.type == "CAMERA"]:
        if only and only not in cam.name:
            continue
        top = cam.name == topdown
        sc.camera = cam
        sc.render.resolution_x, sc.render.resolution_y = (2048, 2048) if top else (1600, 900)
        sc.cycles.samples = max(8, samples // 3) if top else samples
        sc.render.filepath = os.path.join(outdir, cam.name.replace("Cam_", "").lower() + ".jpg")
        print("rendering", cam.name, flush=True)
        bpy.ops.render.render(write_still=True)
