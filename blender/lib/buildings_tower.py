"""Tower kit for background high-rises (bld_condo, bld_office): rounded-rectangle plans, chunky chamfered floor
bands, extruded shafts. Plans are (x, y) loops; the facade line is y=0 and the tower extends to +Y.
"""
import math
from lib.buildings_kit import mesh_obj, finish, prism


def rr_plan(cx, cy, hx, hy, r, seg=2):
    """Rounded rectangle (x, y) loop, counter-clockwise from +Z. `seg` arc segments per corner."""
    pts = []
    for (qx, qy, a0) in ((1, -1, -90), (1, 1, 0), (-1, 1, 90), (-1, -1, 180)):
        ox, oy = cx + qx * (hx - r), cy + qy * (hy - r)
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def offset_plan(cx, cy, hx, hy, r, d, seg=2):
    return rr_plan(cx, cy, hx + d, hy + d, max(r + d, 0.05), seg)


def shaft(name, plan, z0, z1, material, caps=(False, True)):
    """Vertical extrusion of `plan` (no bevel). caps = (bottom, top)."""
    n = len(plan)
    verts = [(x, y, z0) for x, y in plan] + [(x, y, z1) for x, y in plan]
    faces = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    if caps[0]:
        faces.append(list(range(n))[::-1])
    if caps[1]:
        faces.append(list(range(n, 2 * n)))
    return finish(mesh_obj(name, verts, faces, [material]), 0, 1, 40, recalc=True)


def band(name, cx, cy, hx, hy, r, z0, z1, material, out=0.45, ch=0.1, seg=2, top=True, bottom=True):
    """Floor slab band around a core plan: protrudes `out`, chamfer `ch` on the outer top and bottom edges.
    Built as stacked loops (inner-bottom, outer-bottom-chamfer, outer, outer-top-chamfer, inner-top)."""
    loops = [
        (offset_plan(cx, cy, hx, hy, r, -0.02, seg), z0),
        (offset_plan(cx, cy, hx, hy, r, out - ch, seg), z0),
        (offset_plan(cx, cy, hx, hy, r, out, seg), z0 + ch),
        (offset_plan(cx, cy, hx, hy, r, out, seg), z1 - ch),
        (offset_plan(cx, cy, hx, hy, r, out - ch, seg), z1),
        (offset_plan(cx, cy, hx, hy, r, -0.02, seg), z1),
    ]
    if not bottom:
        loops = loops[1:]
        loops[0] = (offset_plan(cx, cy, hx, hy, r, out - ch, seg), z0)
    if not top:
        loops = loops[:-1]
    n = len(loops[0][0])
    verts = []
    for plan, z in loops:
        verts += [(x, y, z) for x, y in plan]
    faces = []
    for L in range(len(loops) - 1):
        a, b = L * n, (L + 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append([a + i, a + j, b + j, b + i])
    return finish(mesh_obj(name, verts, faces, [material]), 0, 1, 50, recalc=True)


def plan_prism(name, plan, z0, z1, material, bevel=0.0, seg=1):
    """Closed slab from a plan loop (caps included), optional angle-limited bevel."""
    return prism(name, plan, z0, z1, 'Z', material, bevel=bevel, seg=seg)
