"""Curved-road city engine shared by the country maps (right- or left-hand traffic).

A country script describes its roads as smooth spline control points plus a
style; this module turns them into junctions, road / footpath / median meshes
with kerbs, lane markings, a building-lot occupancy grid, a bus route that
follows the correct side of the road, and the route JSON the game reads.
Requires shapely (pip install shapely) and nbs_kit.
"""
import json
import math

import numpy as np
from PIL import Image, ImageDraw
import shapely
from shapely.geometry import LineString, Point, Polygon, box as sbox
from shapely.ops import polygonize, substring, unary_union

import nbs_kit as K
from nbs_kit import face


def lines_of(g):
    if g is None or g.is_empty:
        return []
    if g.geom_type == "LineString":
        return [g]
    return [x for x in getattr(g, "geoms", []) if x.geom_type == "LineString"]


def tangent_at(line, s):
    a = line.interpolate(max(0.0, s - 1.0))
    b = line.interpolate(min(line.length, s + 1.0))
    dx, dy = b.x - a.x, b.y - a.y
    L = math.hypot(dx, dy) or 1.0
    return dx / L, dy / L


def quad_up(pts):
    return pts if K.normal(pts)[2] >= 0 else pts[::-1]


class Road:
    def __init__(self, city, name, cls, pts, start_on=None, end_on=None, name_local="", name_en="", spline=True):
        self.name, self.cls, self.ctrl = name, cls, pts
        self.start_on, self.end_on = start_on, end_on
        self.name_local, self.name_en = name_local, name_en
        p = city.classes[cls]
        self.p = p
        self.cw = p["median"] + 2 * (p["lanes"] * p["lane_w"] + p["shoulder"])
        self.sw = p["sw"]
        self.rank = p["rank"]
        self.spline = spline
        self.line = None

    @property
    def half(self):
        return self.cw / 2 + self.sw

    def lane_offset(self, lane=0):
        """Centre of the kerb-side lane (lane 0) measured from the centreline."""
        return self.p["median"] / 2 + (self.p["lanes"] - 0.5 - lane) * self.p["lane_w"]


class City:
    def __init__(self, world, core, classes, drive="right", fp_h=0.18, res=0.5):
        self.world, self.core, self.classes = world, core, classes
        self.side = 1 if drive == "left" else -1       # +1: keep left, -1: keep right
        self.drive = drive
        self.fp_h = fp_h
        self.roads, self.rd, self.juncs, self.circles = [], {}, [], []
        self.geo = {}
        self.res = res
        self.gx, self.gy = int((world[2] - world[0]) / res), int((world[3] - world[1]) / res)
        self.occ = np.zeros((self.gy, self.gx), bool)
        self.bld = np.zeros((self.gy, self.gx), bool)
        self.crosswalks, self.signal_poles, self.stop_signs = [], [], []
        self._tree = None

    # ------------------------------------------------------------ network
    def road(self, name, cls, pts, **kw):
        r = Road(self, name, cls, pts, **kw)
        self.roads.append(r)
        self.rd[name] = r
        return r

    def circle(self, c, ri, ro, name_local="", name_en=""):
        self.circles.append(dict(c=c, ri=ri, ro=ro, name_local=name_local, name_en=name_en))

    def in_core(self, x, y, pad=0.0):
        c = self.core
        return c[0] - pad <= x <= c[2] + pad and c[1] - pad <= y <= c[3] + pad

    def build_network(self, signal_rule=None):
        for r in self.roads:
            if r.line is None:
                r.line = LineString(K.catmull_rom(r.ctrl, 2.0)) if r.spline else LineString(r.ctrl).segmentize(2.0)
        for _ in range(2):
            for r in self.roads:
                cs = list(r.line.coords)
                if r.start_on:
                    o = self.rd[r.start_on].line
                    cs[0] = o.interpolate(o.project(Point(cs[0]))).coords[0]
                if r.end_on:
                    o = self.rd[r.end_on].line
                    cs[-1] = o.interpolate(o.project(Point(cs[-1]))).coords[0]
                r.line = LineString(cs)
        self.find_junctions(signal_rule)

    def grid_in_region(self, boundary_roads, inside_pt, origin, angle_deg, offs_a, offs_b, cls_a, cls_b, wiggle=5.0,
                       min_len=50, exclude=None, prefix="G", names=None):
        """Skewed, gently curved grid clipped to the block bounded by `boundary_roads`."""
        region = next(p for p in polygonize(unary_union([self.rd[n].line for n in boundary_roads])) if p.contains(Point(inside_pt)))
        if exclude is not None:
            region = region.difference(exclude)
        a = math.radians(angle_deg)
        u, v = np.array((math.cos(a), math.sin(a))), np.array((-math.sin(a), math.cos(a)))
        o = np.array(origin, float)
        made = []
        for k, off in enumerate(offs_a):
            pts = [tuple(o + v * off + u * t + v * wiggle * math.sin(t / 90 + k)) for t in range(-900, 901, 30)]
            for piece in lines_of(LineString(pts).intersection(region)):
                if piece.length > min_len:
                    nm = f"{prefix}A{len(made)}"
                    made.append(self.road(nm, cls_a(k) if callable(cls_a) else cls_a, list(piece.coords), spline=False,
                                          **(names(nm, "a", k) if names else {})))
        for k, off in enumerate(offs_b):
            pts = [tuple(o + u * off + v * t + u * wiggle * 0.7 * math.sin(t / 70 + k)) for t in range(-900, 901, 30)]
            for piece in lines_of(LineString(pts).intersection(region)):
                if piece.length > min_len:
                    nm = f"{prefix}B{len(made)}"
                    made.append(self.road(nm, cls_b(k) if callable(cls_b) else cls_b, list(piece.coords), spline=False,
                                          **(names(nm, "b", k) if names else {})))
        for r in made:
            r.line = LineString(r.ctrl).segmentize(2.0)
        return made

    def find_junctions(self, signal_rule=None):
        raw = []
        for i, a in enumerate(self.roads):
            for b in self.roads[i + 1:]:
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
        circ_j = [dict(pos=c["c"], roads=set(), circle=c) for c in self.circles]
        for pos, names in raw:
            hit = next((cj for cj in circ_j if math.dist(pos, cj["pos"]) < cj["circle"]["ro"] + 6), None)
            if hit:
                hit["roads"] |= names
                continue
            for j in self.juncs:
                if math.dist(j["pos"], pos) < 7:
                    j["roads"] |= names
                    break
            else:
                self.juncs.append(dict(pos=pos, roads=set(names), circle=None))
        self.juncs += circ_j
        for j in self.juncs:
            rs = [self.rd[n] for n in j["roads"]]
            j["r"] = j["circle"]["ro"] + 2 if j["circle"] else max(r.cw for r in rs) / 2 + 3.0
            ranks = sorted((r.rank for r in rs), reverse=True)
            if signal_rule:
                j["signal"] = (not j["circle"]) and signal_rule(j, rs) and self.in_core(*j["pos"])
            else:
                j["signal"] = (not j["circle"]) and len(ranks) >= 2 and ranks[1] >= 3 and self.in_core(*j["pos"])

    def juncs_of(self, r):
        return [j for j in self.juncs if r.name in j["roads"]]

    def junction(self, a, b):
        for j in self.juncs:
            if a in j["roads"] and b in j["roads"]:
                return j
        raise KeyError((a, b))

    def pieces(self, r, extra=0.0):
        ds = [Point(*j["pos"]).buffer(j["r"] + extra, 24) for j in self.juncs_of(r)]
        g = r.line.difference(unary_union(ds)) if ds else r.line
        return [p for p in lines_of(g) if p.length > 2.0]

    # ------------------------------------------------------------ surfaces
    def build_surfaces(self, asphalt="asphalt", footpath="sidewalk", kerb_road="curb", kerb_back="curb", median_top="concrete",
                       median_kerb="curb", median_h=0.2, island="grass", corner_r=5.0, extra_road=None, extra_foot=None,
                       footpath_uv=None, median_fn=None):
        carr = [r.line.buffer(r.cw / 2, cap_style="flat", join_style="round") for r in self.roads]
        carr += [Point(*c["c"]).buffer(c["ro"], 48) for c in self.circles]
        if extra_road is not None:
            carr.append(extra_road)
        road = unary_union(carr).buffer(corner_r, 16).buffer(-corner_r, 16)
        islands = unary_union([Point(*c["c"]).buffer(c["ri"], 48) for c in self.circles]) if self.circles else Polygon()
        road = road.difference(islands).simplify(0.03)
        outer = [r.line.buffer(r.cw / 2 + r.sw, cap_style="flat", join_style="round") for r in self.roads if r.sw > 0]
        outer += [Point(*c["c"]).buffer(c["ro"] + 3.0, 48) for c in self.circles]
        if extra_foot is not None:
            outer.append(extra_foot)
        foot = unary_union(outer).buffer(3.0, 12).buffer(-3.0, 12).difference(road).difference(islands).simplify(0.03)
        discs = unary_union([Point(*j["pos"]).buffer(j["r"] + 5.5, 24) for j in self.juncs])
        meds = [r.line.buffer(r.p["median"] / 2, cap_style="flat") for r in self.roads if r.p["median"] > 0 and not r.p.get("painted")]
        median = unary_union(meds).difference(discs).intersection(road).simplify(0.03) if meds else Polygon()
        road_top = road.difference(median)
        self.geo.update(road=road, foot=foot, median=median, islands=islands, discs=discs, road_top=road_top)
        K.tri_area("Roads", asphalt, road_top, 0.0)
        K.tri_area("Footpaths", footpath, foot, self.fp_h, uvs_fn=footpath_uv)
        if not median.is_empty:
            if median_fn:
                median_fn(median)
            else:
                K.tri_area("Roads", median_top, median, median_h)
                K.ring_walls("Roads", median, 0.0, median_h, lambda m: median_kerb)
        if not islands.is_empty:
            K.tri_area("Islands", island, islands, 0.3)
            K.ring_walls("Islands", islands, 0.0, 0.3, lambda m: median_kerb)
        rb = road.buffer(0.05)
        shapely.prepare(rb)
        K.ring_walls("Footpaths", foot, 0.0, self.fp_h, lambda m: kerb_road if rb.contains(Point(m)) else kerb_back)
        self.occ[:] = self.raster(unary_union([road, foot, median, islands.buffer(1)]))

    # ------------------------------------------------------------ markings
    def paint(self, pts, w, mat, z=0.014):
        K.ribbon("Markings", mat, pts, w, z)

    def dashed(self, line, w, on, off, mat):
        s = 0.0
        while s < line.length:
            seg = substring(line, s, min(s + on, line.length))
            if seg.length > 0.3:
                self.paint(list(seg.coords), w, mat)
            s += on + off

    def bar(self, cx, cy, tx, ty, along, across, mat="paint_white", z=0.014):
        nx, ny = -ty, tx
        pts = [(cx - tx * along / 2 - nx * across / 2, cy - ty * along / 2 - ny * across / 2, z),
               (cx + tx * along / 2 - nx * across / 2, cy + ty * along / 2 - ny * across / 2, z),
               (cx + tx * along / 2 + nx * across / 2, cy + ty * along / 2 + ny * across / 2, z),
               (cx - tx * along / 2 + nx * across / 2, cy - ty * along / 2 + ny * across / 2, z)]
        face("Markings", mat, quad_up(pts), [(0, 0)] * 4)

    def decal(self, mat, cx, cy, hx, hy, length, width, z=0.016):
        """Road text read by a driver heading (hx, hy); image top = far end."""
        lx, ly = -hy, hx
        nb = (cx - hx * length / 2, cy - hy * length / 2)
        fb = (cx + hx * length / 2, cy + hy * length / 2)
        pts = [(nb[0] + lx * width / 2, nb[1] + ly * width / 2, z), (nb[0] - lx * width / 2, nb[1] - ly * width / 2, z),
               (fb[0] - lx * width / 2, fb[1] - ly * width / 2, z), (fb[0] + lx * width / 2, fb[1] + ly * width / 2, z)]
        face("Markings", mat, pts, [(0, 0), (1, 0), (1, 1), (0, 1)])

    def kerb_vec(self, hx, hy):
        """Unit vector from the lane toward the kerb the traffic keeps to."""
        return (-hy * self.side, hx * self.side)

    def build_markings(self, styles, crosswalk_rule=None, stop_rule=None, crosswalk="zebra", white="paint_white", yellow="paint_yellow"):
        """styles[cls] = dict(center=None|'yellow_double'|'yellow_solid'|'white_dashed'|'twltl',
                               edge=True, divider=(on, off) or None, bike=0.0)"""
        for r in self.roads:
            st = styles.get(r.cls, {})
            p = r.p
            for pc in self.pieces(r, 6.5):
                mid = pc.interpolate(0.5, normalized=True)
                if not self.in_core(mid.x, mid.y, 60):
                    continue
                if st.get("edge"):
                    for sgn in (-1, 1):
                        for e in lines_of(pc.offset_curve(sgn * (r.cw / 2 - 0.35))):
                            self.paint(list(e.coords), 0.15, white)
                if st.get("bike"):
                    bw = st["bike"]
                    for sgn in (-1, 1):
                        for e in lines_of(pc.offset_curve(sgn * (r.cw / 2 - bw / 2 - 0.1))):
                            self.paint(list(e.coords), bw, st.get("bike_mat", "paint_bike"), z=0.012)
                        for e in lines_of(pc.offset_curve(sgn * (r.cw / 2 - bw - 0.2))):
                            self.paint(list(e.coords), 0.15, white)
                if st.get("divider"):
                    on, off = st["divider"]
                    for sgn in (-1, 1):
                        for k in range(1, p["lanes"]):
                            for e in lines_of(pc.offset_curve(sgn * (p["median"] / 2 + k * p["lane_w"]))):
                                self.dashed(e, 0.15, on, off, white)
                c = st.get("center")
                if c and (p["median"] == 0 or p.get("painted")):
                    if c == "yellow_double":
                        for o in (-0.15, 0.15):
                            for e in lines_of(pc.offset_curve(o)):
                                self.paint(list(e.coords), 0.12, yellow)
                    elif c == "yellow_solid":
                        self.paint(list(pc.coords), 0.15, yellow)
                    elif c == "white_dashed":
                        self.dashed(pc, 0.12, *st.get("center_dash", (3.0, 6.0)), white)
                    elif c == "white_solid":
                        self.paint(list(pc.coords), 0.12, white)
                    elif c == "twltl":    # two-way left-turn lane: solid outer + dashed inner yellow pairs
                        tw = st.get("twltl_w", p["median"] or 3.6) / 2
                        for sgn in (-1, 1):
                            for e in lines_of(pc.offset_curve(sgn * tw)):
                                self.paint(list(e.coords), 0.12, yellow)
                            for e in lines_of(pc.offset_curve(sgn * (tw - 0.3))):
                                self.dashed(e, 0.12, 3.0, 6.0, yellow)
            # crossings and stop lines
            for j in self.juncs_of(r):
                if not self.in_core(*j["pos"], 20):
                    continue
                cw_ok = crosswalk_rule(j, r) if crosswalk_rule else (j["signal"] or bool(j["circle"]))
                stop_ok = stop_rule(j, r) if stop_rule else cw_ok
                if not (cw_ok or stop_ok):
                    continue
                sj = r.line.project(Point(*j["pos"]))
                for dirn in (-1, 1):
                    sc = sj + dirn * (j["r"] + 2.0)
                    if not (0 < sc < r.line.length):
                        continue
                    c = r.line.interpolate(sc)
                    tx, ty = tangent_at(r.line, sc)
                    nx, ny = -ty, tx
                    if cw_ok:
                        if crosswalk in ("zebra", "continental"):
                            t = -r.cw / 2 + 0.6
                            while t < r.cw / 2 - 0.6:
                                self.bar(c.x + nx * t, c.y + ny * t, tx, ty, 3.0, 0.5, white)
                                t += 1.0
                        elif crosswalk == "ladder":
                            for o in (-1.6, 1.6):
                                self.bar(c.x + tx * o, c.y + ty * o, tx, ty, 0.3, r.cw - 0.8, white)
                            t = -r.cw / 2 + 0.8
                            while t < r.cw / 2 - 0.6:
                                self.bar(c.x + nx * t, c.y + ny * t, tx, ty, 3.0, 0.45, white)
                                t += 1.2
                        elif crosswalk == "lines":
                            for o in (-1.6, 1.6):
                                self.bar(c.x + tx * o, c.y + ty * o, tx, ty, 0.3, r.cw - 0.8, white)
                        self.crosswalks.append((c.x, c.y))
                    if stop_ok:
                        ss = sj + dirn * (j["r"] + (4.6 if cw_ok else 1.0))
                        if 0 < ss < r.line.length:
                            q = r.line.interpolate(ss)
                            hx, hy = tangent_at(r.line, ss)
                            hx, hy = -dirn * hx, -dirn * hy          # traffic approaching the junction
                            kx, ky = self.kerb_vec(hx, hy)
                            a0, a1 = p["median"] / 2 + 0.1, r.cw / 2 - 0.35
                            self.bar(q.x + kx * (a0 + a1) / 2, q.y + ky * (a0 + a1) / 2, hx, hy, 0.5, a1 - a0, white)
                            pole = (q.x + kx * (r.cw / 2 + max(0.6, r.sw * 0.4)), q.y + ky * (r.cw / 2 + max(0.6, r.sw * 0.4)))
                            if j["signal"]:
                                self.signal_poles.append((j, pole[0], pole[1], hx, hy, r))
                            elif not j["circle"]:
                                self.stop_signs.append((j, pole[0], pole[1], hx, hy, r))

    # ----------------------------------------------------------- occupancy
    def raster(self, geom):
        img = Image.new("L", (self.gx, self.gy), 0)
        d = ImageDraw.Draw(img)
        w0, w1, res = self.world[0], self.world[1], self.res

        def pix(cs):
            return [((x - w0) / res, (y - w1) / res) for x, y in cs]
        for pg in K._polys(geom):
            d.polygon(pix(pg.exterior.coords), fill=1)
            for h in pg.interiors:
                d.polygon(pix(h.coords), fill=0)
        return np.asarray(img, bool)

    def mark_poly(self, geom, building=False):
        m = self.raster(geom)
        self.occ |= m
        if building:
            self.bld |= m

    def rcells(self, cx, cy, yaw, w, d):
        c, s = math.cos(yaw), math.sin(yaw)
        ex, ey = abs(w / 2 * c) + abs(d / 2 * s), abs(w / 2 * s) + abs(d / 2 * c)
        W, res = self.world, self.res
        i0, i1 = int((cx - ex - W[0]) / res), int((cx + ex - W[0]) / res) + 1
        j0, j1 = int((cy - ey - W[1]) / res), int((cy + ey - W[1]) / res) + 1
        if i0 < 0 or j0 < 0 or i1 > self.gx or j1 > self.gy:
            return None
        xs = W[0] + (np.arange(i0, i1) + 0.5) * res
        ys = W[1] + (np.arange(j0, j1) + 0.5) * res
        X, Y = np.meshgrid(xs - cx, ys - cy)
        lx, ly = X * c + Y * s, -X * s + Y * c
        return j0, j1, i0, i1, (np.abs(lx) <= w / 2) & (np.abs(ly) <= d / 2)

    def rfree(self, cx, cy, yaw, w, d, pad=0.5):
        a, b = self.rcells(cx, cy, yaw, w, d), self.rcells(cx, cy, yaw, w + 2 * pad, d + 2 * pad)
        if a is None or b is None:
            return False
        j0, j1, i0, i1, m = a
        if (self.occ[j0:j1, i0:i1] & m).any():
            return False
        j0, j1, i0, i1, m = b
        return not (self.bld[j0:j1, i0:i1] & m).any()

    def rmark(self, cx, cy, yaw, w, d, building=True):
        a = self.rcells(cx, cy, yaw, w, d)
        if a is None:
            return
        j0, j1, i0, i1, m = a
        self.occ[j0:j1, i0:i1] |= m
        if building:
            self.bld[j0:j1, i0:i1] |= m

    def frontage(self, r, pick, build, min_w=4.5, extra=4.0):
        """Walk both sides of road r placing lots facing it.
        pick(r, x, y) -> dict(kind, zone, w, d, setback, gap, tight) or None; build(lot dict)."""
        fs = r.cw / 2 + r.sw
        for pc in self.pieces(r, extra):
            for side in (1, -1):
                s = K.R.uniform(0.0, 2.0)
                while s < pc.length - 5:
                    c0 = pc.interpolate(s)
                    spec = pick(r, c0.x, c0.y)
                    if spec is None:
                        s += 6.0
                        continue
                    w = min(spec["w"], pc.length - s)
                    if w < min_w:
                        break
                    sc = s + w / 2
                    cp = pc.interpolate(sc)
                    tx, ty = tangent_at(pc, sc)
                    nx, ny = -ty * side, tx * side
                    yaw = math.atan2(ny, nx) - math.pi / 2
                    placed = False
                    dd = spec["d"]
                    tight = spec.get("tight", False)
                    while dd >= max(6.0, spec["d"] * 0.6):
                        off = fs + spec["setback"] + dd / 2
                        cx, cy = cp.x + nx * off, cp.y + ny * off
                        if self.rfree(cx, cy, yaw, w - (0.8 if tight else 0.0), dd, 0.0 if tight else spec.get("pad", 0.6)):
                            build(dict(spec, cx=cx, cy=cy, yaw=yaw, w=w, d=dd, road=r, detail=self.in_core(cx, cy, 30)))
                            self.rmark(cx, cy, yaw, w, dd)
                            placed = True
                            break
                        dd -= 1.5
                    s += (w + spec.get("gap", 1.0)) if placed else 1.5

    def nearest_dir(self, x, y):
        if self._tree is None:
            self._tree = shapely.STRtree([r.line for r in self.roads])
        i = self._tree.nearest(Point(x, y))
        ln = self.roads[int(i)].line
        s = ln.project(Point(x, y))
        tx, ty = tangent_at(ln, s)
        q = ln.interpolate(s)
        return tx, ty, (x - q.x, y - q.y), self.roads[int(i)]

    def fill_interiors(self, sizes, build, step=3.0, pad=0.4, orient="road", where=None):
        W = self.world
        for y in np.arange(W[1] + 8, W[3] - 8, step):
            for x in np.arange(W[0] + 8, W[2] - 8, step):
                j, i = int((y - W[1]) / self.res), int((x - W[0]) / self.res)
                if self.occ[j, i] or self.bld[j, i] or (where and not where(x, y)):
                    continue
                if orient == "south":
                    yaw = 0.0
                else:
                    tx, ty, away, _ = self.nearest_dir(x, y)
                    nx, ny = -ty, tx
                    if nx * away[0] + ny * away[1] < 0:
                        nx, ny = -nx, -ny
                    yaw = math.atan2(ny, nx) - math.pi / 2
                for w, d in sizes:
                    if self.rfree(x, y, yaw, w, d, pad):
                        build(dict(cx=x, cy=y, yaw=yaw, w=w, d=d, detail=self.in_core(x, y, 20)))
                        self.rmark(x, y, yaw, w, d)
                        break

    # --------------------------------------------------------------- route
    def lane_leg(self, road, a, b, trim_a=0.0, trim_b=0.0, lane=0):
        r = self.rd[road] if isinstance(road, str) else road
        ln = r.line
        sa, sb = ln.project(Point(a)), ln.project(Point(b))
        fwd = sb > sa
        sa += trim_a if fwd else -trim_a
        sb -= trim_b if fwd else -trim_b
        seg = substring(ln, sa, sb)
        if seg.length < 1:
            return []
        off = seg.offset_curve(self.side * r.lane_offset(lane))
        if off.geom_type != "LineString":
            from shapely.ops import linemerge
            off = linemerge(off)
            if off.geom_type != "LineString":
                off = max(lines_of(off), key=lambda g: g.length)
        pts = list(off.coords)
        # offset_curve keeps the direction, but make sure we start near `a`
        if math.dist(pts[0], ln.interpolate(sa).coords[0]) > math.dist(pts[-1], ln.interpolate(sa).coords[0]):
            pts = pts[::-1]
        return pts

    @staticmethod
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

    @staticmethod
    def _tan(pts, end):
        a, b = (pts[-2], pts[-1]) if end else (pts[0], pts[1])
        L = math.dist(a, b) or 1.0
        return ((b[0] - a[0]) / L, (b[1] - a[1]) / L)

    def join(self, legs, step=2.0):
        legs = [l for l in legs if len(l) >= 2]
        path = list(legs[0])
        for leg in legs[1:]:
            path += self.bezier(path[-1], self._tan(path, True), leg[0], self._tan(leg, False))
            path += leg
        ls = LineString(path)
        n = int(ls.length / step)
        return [ls.interpolate(i * ls.length / n).coords[0] for i in range(n)]

    def arm_angle(self, circle, road):
        cx, cy = circle["c"]
        ln = self.rd[road].line
        s = ln.project(Point(cx, cy))
        q = ln.interpolate(s + (circle["ro"] + 8) * (1 if s < 1 else -1))
        return math.atan2(q.y - cy, q.x - cx)

    def circle_arc(self, circle, a_in, a_out, r):
        """Around the roundabout: clockwise when keeping left, counter-clockwise when keeping right."""
        cx, cy = circle["c"]
        if self.side > 0:
            if a_out > a_in:
                a_out -= 2 * math.pi
        else:
            if a_out < a_in:
                a_out += 2 * math.pi
        n = max(6, int(abs(a_in - a_out) * r / 2))
        return [(cx + r * math.cos(a_in + (a_out - a_in) * k / n), cy + r * math.sin(a_in + (a_out - a_in) * k / n)) for k in range(n + 1)]

    def circle_leg(self, circle, road_in, road_out, ring_r=None):
        ring_r = ring_r or (circle["ri"] + (circle["ro"] - circle["ri"]) * 0.6)
        da = -self.side * 0.18      # small lead-in/out so the bezier joins are smooth
        return self.circle_arc(circle, self.arm_angle(circle, road_in) + da, self.arm_angle(circle, road_out) - da, ring_r)

    def stop_at(self, road, near, toward, kerb_extra=0.55, ahead=3.0):
        """Kerb-side stop geometry on `road` near `near` for traffic heading toward `toward`."""
        r = self.rd[road]
        ln = r.line
        s = ln.project(Point(near))
        dirn = 1 if ln.project(Point(toward)) > s else -1
        c = ln.interpolate(s)
        tx, ty = tangent_at(ln, s)
        hx, hy = tx * dirn, ty * dirn
        kx, ky = self.kerb_vec(hx, hy)
        lo = r.lane_offset()
        off = r.cw / 2 + max(0.8, r.sw * kerb_extra)
        return dict(road=r, s=s, hx=hx, hy=hy, kx=kx, ky=ky, x=c.x + kx * off, y=c.y + ky * off,
                    lane=(c.x + kx * lo, c.y + ky * lo), stop=(c.x + kx * lo + hx * ahead, c.y + ky * lo + hy * ahead))

    def lane_cam(self, name, road, near, toward, back=0.0, h=2.8, look=80.0, lens=22, look_h=None):
        r = self.rd[road]
        ln = r.line
        s = ln.project(Point(near))
        dirn = 1 if ln.project(Point(toward)) > s else -1
        s -= dirn * back
        c = ln.interpolate(s)
        tx, ty = tangent_at(ln, s)
        hx, hy = tx * dirn, ty * dirn
        kx, ky = self.kerb_vec(hx, hy)
        lo = r.lane_offset()
        x, y = c.x + kx * lo, c.y + ky * lo
        q = ln.interpolate(min(ln.length, max(0.0, s + dirn * look)))
        return K.add_camera(name, (x, y, h), (q.x + kx * lo * 0.3, q.y + ky * lo * 0.3, look_h if look_h is not None else h + 1.0), lens)

    # ---------------------------------------------------------------- json
    def write_json(self, path, meta, path_pts, stops, spawn, extra=None):
        def gl(p):
            return [round(p[0], 3), 0.0, round(-p[1], 3)]
        cum = [0.0]
        for a, b in zip(path_pts, path_pts[1:]):
            cum.append(cum[-1] + math.dist(a, b))
        for st in stops:
            i = min(range(len(path_pts)), key=lambda k: math.dist(path_pts[k], st["stop_point"]))
            st["route_index"], st["route_distance_m"] = i, round(cum[i], 1)
            st["stop_point_gltf"] = gl(st["stop_point"])
            st.setdefault("door_side", "left" if self.side > 0 else "right")
        stops.sort(key=lambda s: s["route_distance_m"])
        roads = [dict(id=r.name, name_local=r.name_local, name_en=r.name_en, cls=r.cls, carriageway_m=r.cw, footpath_m=r.sw,
                      median_m=r.p["median"], lanes_per_direction=r.p["lanes"], lane_width_m=r.p["lane_w"],
                      speed_kmh=r.p.get("speed", 50), centerline=[[round(x, 2), round(y, 2)] for x, y in r.line.simplify(0.5).coords])
                 for r in self.roads]
        data = dict(meta, units="metres", traffic=f"{self.drive}-hand",
                    coordinate_systems=dict(blender="+X east, +Y north, +Z up", gltf="+X east, +Y up, -Z north (gltf = [x, z, -y])"),
                    drivable_bounds_blender=dict(xmin=self.core[0], ymin=self.core[1], xmax=self.core[2], ymax=self.core[3]),
                    spawn=dict(spawn, position_gltf=gl(spawn["position"])),
                    route=dict(meta.get("route", {}), loop=True, length_m=round(cum[-1] + math.dist(path_pts[-1], path_pts[0]), 1),
                               points=[[round(x, 2), round(y, 2)] for x, y in path_pts], points_gltf=[gl(p) for p in path_pts]),
                    stops=stops,
                    roundabouts=[dict(center=list(c["c"]), island_radius_m=c["ri"], outer_radius_m=c["ro"],
                                      direction="clockwise" if self.side > 0 else "counter-clockwise",
                                      name_local=c["name_local"], name_en=c["name_en"]) for c in self.circles],
                    signalised_junctions=[[round(j["pos"][0], 2), round(j["pos"][1], 2)] for j in self.juncs if j["signal"]],
                    roads=roads)
        if extra:
            data.update(extra)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        return data


def plate(mat, cx, cy, cz, hx, hy, w, h, back="metal_light", coll="Props", uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
    """Vertical sign plate read by someone looking along (hx, hy)."""
    rx, ry = hy, -hx
    cx, cy = cx - hx * 0.03, cy - hy * 0.03
    pts = [(cx - rx * w / 2, cy - ry * w / 2, cz - h / 2), (cx + rx * w / 2, cy + ry * w / 2, cz - h / 2),
           (cx + rx * w / 2, cy + ry * w / 2, cz + h / 2), (cx - rx * w / 2, cy - ry * w / 2, cz + h / 2)]
    face(coll, mat, pts, list(uvs))
    if back:
        face(coll, back, [(p[0] + hx * 0.01, p[1] + hy * 0.01, p[2]) for p in pts[::-1]], [(0, 0)] * 4)


def ground(world, mat, far_mat, hole=None, z=-0.03):
    g = sbox(*world)
    if hole is not None:
        g = g.difference(hole)
    K.tri_area("Terrain", mat, g, z)
    F = 6000.0
    W = world
    for q in (((-F, -F), (F, -F), (F, W[1]), (-F, W[1])), ((-F, W[3]), (F, W[3]), (F, F), (-F, F)),
              ((-F, W[1]), (W[0], W[1]), (W[0], W[3]), (-F, W[3])), ((W[2], W[1]), (F, W[1]), (F, W[3]), (W[2], W[3]))):
        face("Backdrop", far_mat, [(x, y, -0.2) for x, y in q], [(x / 80, y / 80) for x, y in q], ref=(0, 0))


def route_curve(bpy, path, name):
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
    ob = bpy.data.objects.new(name, cu)
    ob.hide_render = True
    K.coll("BusRoute (helper)").objects.link(ob)
