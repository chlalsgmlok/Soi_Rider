"""vehicles_cars kit: one-box shells (commuter van) — a single prism instead of tub + greenhouse.

van_shell(): full side profile -> taper above the belt -> roof / corner / small bevel passes -> rounded plan ends
             -> two-tone split -> dark arches + underbody.
glaze():     window band cut at (z0, z1) on both flanks (split into panes by pillars), windscreen, rear window.
Facing -Y, model LEFT = +X (docs/ASSET_SPEC.md).
"""
import math
import bmesh
from .vehicles_cars_mesh import prism, fillet, arch_points, bevel_sharp, bisect, taper_z, set_mat
from .vehicles_cars_body import split_pillars, flatten


def round_ends(bm, y0, y1, front, rear):
    """Pull plan corners in near the nose (front=(reach, inset)) and tail (rear=(reach, inset)), quadratic ease."""
    for (reach, inset), sign, yend in ((front, 1, y0), (rear, -1, y1)):
        if reach <= 0:
            continue
        for c in (0.35, 1.0):
            bisect(bm, (0, yend + sign * c * reach, 0), (0, 1, 0))
        for v in bm.verts:
            d = (v.co.y - yend) * sign
            if 0 <= d < reach and abs(v.co.x) > 1e-4:
                t = 1.0 - d / reach
                v.co.x -= math.copysign(inset * t * t, v.co.x)


def van_profile(V):
    pts = [(V.nose + 0.12, V.sill, 0.07)]
    pts += arch_points(V.yf, V.r, V.ar, V.sill)
    pts += arch_points(V.yr, V.r, V.ar, V.sill)
    pts += [(V.tail - 0.08, V.sill, 0.07), (V.tail, V.sill + 0.09, 0.06)]
    pts += V.upper
    pts += [(V.nose, V.sill + 0.09, 0.06)]
    return fillet(pts, 25)


def van_shell(M, V):
    bm = bmesh.new()
    prism(bm, van_profile(V), V.hw, M['paint'])
    taper_z(bm, V.taper_z, V.roof_z, V.top_scale)
    bm.normal_update()
    y0, y1 = V.nose, V.tail

    def side_edge(e):
        return any(abs(f.normal.x) > 0.85 for f in e.link_faces)

    def zmin(e):
        return min(v.co.z for v in e.verts)

    def near_end(e):
        return all(v.co.y < y0 + 0.25 or v.co.y > y1 - 0.25 for v in e.verts)

    bevel_sharp(bm, V.roof_bevel, 3, min_deg=60, skip=lambda e: not (side_edge(e) and zmin(e) > V.roof_z - 0.5))
    bevel_sharp(bm, V.mid_bevel, 2, min_deg=60,
                skip=lambda e: not (side_edge(e) and (zmin(e) > V.r + V.ar + 0.05 or (near_end(e) and zmin(e) > V.sill + 0.05))))
    bevel_sharp(bm, 0.03, 2, min_deg=55)
    round_ends(bm, y0, y1, V.front_round, V.rear_round)
    bisect(bm, (0, 0, V.split), (0, 0, 1))
    bm.normal_update()
    for z in V.win:
        # only the flanks and the tail face get the window-band cuts (the windscreen stays one pane)
        faces = [f for f in bm.faces if abs(f.normal.x) > 0.9 or f.normal.y > 0.85]
        geom = faces + list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=(0, 0, z), plane_no=(0, 0, 1))
        bm.normal_update()
    for f in bm.faces:
        c, n = f.calc_center_median(), f.normal
        key = 'paint2' if c.z > V.split else 'paint'
        if n.z < -0.55 and c.z < V.sill + 0.12:
            key = 'trim'
        for ya, za, ra in ((V.yf, V.r, V.ar), (V.yr, V.r, V.ar)):
            if math.hypot(c.y - ya, c.z - za) < ra + 0.02 and abs(n.x) < 0.45 and c.z < za + ra + 0.02:
                key = 'trim'
        f.material_index = M[key]
    return bm


def glaze(bm, M, V, inset=0.035, depth=0.014, ring='trim'):
    """Window band on both flanks (split by V.pillars), windscreen and rear window, inset with a dark rubber ring."""
    z0, z1 = V.win

    def biggest(pred):
        cands = [f for f in bm.faces if z0 < f.calc_center_median().z and pred(f)]
        return max(cands, key=lambda f: f.calc_area()) if cands else None

    panes = []
    for sgn in (1, -1):
        band = biggest(lambda f, s=sgn: f.normal.x * s > 0.9 and f.calc_center_median().z < z1)
        if band is not None:
            panes += split_pillars(bm, M, band, V.pillars, z0, z1)
    # the windscreen face has messy bevel corners (concave n-gon): it becomes a black field and the script lays a
    # clean glass patch on it (see veh_van.py)
    screen = biggest(lambda f: f.normal.y < -0.4 and f.normal.z > 0.25)
    if screen is not None:
        screen.material_index = M[ring]
    panes.append(biggest(lambda f: f.normal.y > 0.85 and f.calc_center_median().z < z1))
    flatten(panes)
    for f in panes:
        if f is None:
            continue
        res = bmesh.ops.inset_individual(bm, faces=[f], thickness=inset, depth=-depth, use_even_offset=True)
        set_mat(res['faces'], M[ring])
        f.material_index = M['glass']
    return bm
