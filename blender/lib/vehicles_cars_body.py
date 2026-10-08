"""vehicles_cars kit: body shells (lower tub + greenhouse) and ray-cast surface sampling.

tub()        side-profile prism -> rounded plan corners -> soft bevels -> two-tone split -> dark arches/underbody
greenhouse() cabin prism with tumblehome taper -> bevels (not on the base) -> inset glass panes
Surface      BVH over the shell bmeshes; detail parts are stuck onto it (lamps, plates, seams, handles).
"""
import math
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from .vehicles_cars_mesh import prism, round_plan, bevel_sharp, bisect, taper_z, set_mat


def tub(M, profile, half_w, *, bevel=0.10, segs=3, small=0.03, small_segs=2, big_z=0.78, end_reach=0.38,
        plan_reach=0.6, plan_inset=0.14, split_z=None, arches=(), sill_z=0.25, upper='paint2', lower='paint',
        plan_cuts=(0.18, 0.45, 1.0), tumble=None):
    """Lower body. arches = [(axle_y, axle_z, arch_r)], split_z = two-tone line (faces above -> `upper`).

    Two bevel passes (bmesh bevel clamps globally, so thin fender bands must not limit the shoulders):
    big  = side-cap edges above `big_z` or within `end_reach` of the nose/tail (round shoulders, corners)
    small = every other sharp edge (sills, wheel-arch lips).
    Plan rounding runs AFTER the bevels so its cut planes cannot clamp them either.
    tumble=(z0, scale) leans the flanks in above z0 (scale at the highest point) so the sides read rounded.
    """
    bm = bmesh.new()
    prism(bm, profile, half_w, M[lower])
    ys = [p[0] for p in profile]
    y0, y1 = min(ys), max(ys)
    if tumble is not None:
        bisect(bm, (0, 0, tumble[0]), (0, 0, 1))
        taper_z(bm, tumble[0], max(p[1] for p in profile), tumble[1])
        bm.normal_update()

    def is_big(e):
        if not any(abs(f.normal.x) > 0.9 for f in e.link_faces):
            return False
        zmin = min(v.co.z for v in e.verts)
        near_end = all(v.co.y < y0 + end_reach or v.co.y > y1 - end_reach for v in e.verts)
        return zmin > big_z or (near_end and zmin > sill_z + 0.06)

    bevel_sharp(bm, bevel, segs, skip=lambda e: not is_big(e))
    bevel_sharp(bm, small, small_segs, min_deg=55.0)
    if plan_reach > 0:
        round_plan(bm, y0, y1, plan_reach, plan_inset, cuts=plan_cuts)
    if split_z is not None:
        bisect(bm, (0, 0, split_z), (0, 0, 1))
    bm.normal_update()
    for f in bm.faces:
        c = f.calc_center_median()
        n = f.normal
        key = lower
        if split_z is not None and c.z > split_z:
            key = upper
        if n.z < -0.55 and c.z < sill_z + 0.12:
            key = 'trim'
        for ya, za, ra in arches:
            if math.hypot(c.y - ya, c.z - za) < ra + 0.02 and abs(n.x) < 0.45 and c.z < za + ra + 0.02:
                key = 'trim'
        f.material_index = M[key]
    return bm


def flatten(faces):
    """Project each face's verts onto its mean plane (bevel + taper can leave ~1 cm warps that crease the glass)."""
    for f in faces:
        if f is None:
            continue
        f.normal_update()
        n, c = f.normal.copy(), f.calc_center_median()
        for v in f.verts:
            v.co -= n * (v.co - c).dot(n)
        f.normal_update()


def _coplanar(bm, n0, p0, z_min, z_max=99.0):
    for f in bm.faces:
        f.normal_update()
    return [f for f in bm.faces if f.normal.dot(n0) > 0.998 and abs((f.calc_center_median() - p0).dot(n0)) < 0.004
            and z_min < f.calc_center_median().z < z_max]


def split_pillars(bm, M, face, pillars, z_min, z_max=99.0):
    """Cut one side pane at y = c +- w/2 for each pillar (c, w, mat); strips become `mat`, the rest are returned."""
    flatten([face])
    n0 = face.normal.copy()
    p0 = face.calc_center_median()
    for c, w, _ in pillars:
        for y in (c - w / 2, c + w / 2):
            faces = _coplanar(bm, n0, p0, z_min, z_max)
            geom = faces + list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts})
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=(0, y, 0), plane_no=(0, 1, 0))
    panes = []
    for f in _coplanar(bm, n0, p0, z_min, z_max):
        cy = f.calc_center_median().y
        hit = [m for c, w, m in pillars if abs(cy - c) < w / 2]
        if hit:
            f.material_index = M[hit[0]]
        elif f.calc_area() > 0.01:
            panes.append(f)
    return panes


def greenhouse(M, profile, half_w, *, top_scale, z_base, z_glass, bevel=0.09, segs=3, inset=0.04,
               depth=0.012, frame='paint2', ring=None, rear_glass=True, pillars=()):
    """Cabin. Bevel FIRST, then cut at z_glass: with clamp off, a base band thinner than the bevel would otherwise
    collapse below z_base. Faces above z_glass: the biggest side/front/rear faces become inset `glass` panes;
    pillars=[(y, width, mat)] split each side into separate windows with a solid pillar strip between them.
    ring = material of the inset frame around every pane (default: frame)."""
    bm = bmesh.new()
    prism(bm, profile, half_w, M[frame])
    z_top = max(p[1] for p in profile)
    taper_z(bm, z_base, z_top, top_scale)
    bm.normal_update()
    bevel_sharp(bm, bevel, segs, skip=lambda e: all(v.co.z < z_base + 0.02 for v in e.verts))
    bisect(bm, (0, 0, z_glass), (0, 0, 1))
    set_mat(bm.faces, M[frame])
    bm.normal_update()

    def biggest(pred):
        cands = [f for f in bm.faces if f.calc_center_median().z > z_glass and pred(f.normal)]
        return max(cands, key=lambda f: f.calc_area()) if cands else None

    panes = []
    for side in (biggest(lambda n: n.x > 0.8), biggest(lambda n: n.x < -0.8)):
        if side is not None:
            panes += split_pillars(bm, M, side, pillars, z_glass) if pillars else [side]
    panes.append(biggest(lambda n: n.y < -0.3 and n.z > 0.05))
    if rear_glass:
        panes.append(biggest(lambda n: n.y > 0.3 and n.z > -0.2))
    flatten(panes)
    for f in panes:
        if f is None:
            continue
        res = bmesh.ops.inset_individual(bm, faces=[f], thickness=inset, depth=-depth, use_even_offset=True)
        set_mat(res['faces'], M[ring or frame])
        f.material_index = M['glass']
    for f in bm.faces:
        if f.normal.z < -0.7 and f.calc_center_median().z < z_base + 0.03:
            f.material_index = M['trim']
    return bm


class Surface:
    """Ray-cast helper over one or more shell bmeshes (world space)."""

    def __init__(self, bms):
        self.trees = [BVHTree.FromBMesh(b) for b in bms]

    def cast(self, origin, direction, max_dist=20.0):
        o = Vector(origin)
        d = Vector(direction).normalized()
        best = None
        for t in self.trees:
            hit = t.ray_cast(o, d, max_dist)
            if hit[0] is not None and (best is None or hit[3] < best[3]):
                best = hit
        if best is None:
            raise RuntimeError(f'surface miss from {tuple(o)} dir {tuple(d)}')
        loc, nor = best[0], best[1].normalized()
        if nor.dot(d) > 0:
            nor = -nor
        return loc, nor

    def side(self, y, z, sign):
        return self.cast((sign * 5.0, y, z), (-sign, 0, 0))

    def top(self, x, y):
        return self.cast((x, y, 6.0), (0, 0, -1))

    def front(self, x, z):
        return self.cast((x, -10.0, z), (0, 1, 0))

    def rear(self, x, z):
        return self.cast((x, 10.0, z), (0, -1, 0))

    def line(self, rays):
        pts, nors = [], []
        for o, d in rays:
            p, n = self.cast(o, d)
            pts.append(p)
            nors.append(n)
        return pts, nors
