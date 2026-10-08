"""vehicles_cars kit: pickup-specific parts (open load bed, fender flares, running boards, sport bar).

Facing -Y, model LEFT = +X (docs/ASSET_SPEC.md). All builders add to caller-owned bmeshes in world space.
"""
import math
import bmesh
from mathutils import Vector
from .vehicles_cars_mesh import rbox, set_mat
from .vehicles_cars_parts import patch


def carve_bed(bm, M, y0, y1, depth, wall=0.07, z_min=1.0, liner='trim'):
    """Hollow the flat tub top between y0..y1 into an open load bed (rim `wall` thick, `depth` deep)."""
    bm.normal_update()
    top = [f for f in bm.faces if f.normal.z > 0.97 and y0 < f.calc_center_median().y < y1
           and f.calc_center_median().z > z_min]
    bmesh.ops.inset_region(bm, faces=top, thickness=wall, depth=0.0, use_even_offset=True)
    ext = bmesh.ops.extrude_face_region(bm, geom=top)
    new_verts = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0.0, 0.0, -depth), verts=new_verts)
    bmesh.ops.delete(bm, geom=top, context='FACES_ONLY')  # extrude keeps the old lid: remove it
    cavity = {f for v in new_verts for f in v.link_faces}
    set_mat(cavity, M[liner])
    # orient explicitly (a global recalc can flip the whole cavity): floor up, walls facing the bed centre
    centre = sum((v.co for v in new_verts), Vector()) / max(1, len(new_verts))
    for f in cavity:
        f.normal_update()
        c = f.calc_center_median()
        inward = Vector((centre.x - c.x, centre.y - c.y, 0.0))
        if abs(f.normal.z) > 0.9:
            if f.normal.z < 0:
                f.normal_flip()
        elif f.normal.dot(inward) < 0:
            f.normal_flip()
    bm.normal_update()
    return cavity


def arch_flare(bm, M, surf, ya, za, ra, sign, z_sill, width=0.09, lift=0.035, mat='trim', n=8):
    """Chunky over-fender following a wheel arch on the +X (sign=1) or -X flank."""
    a = math.asin(max(-1.0, min(1.0, (z_sill + 0.02 - za) / (ra + width))))
    t0, t1 = math.pi - a, a

    def cast(t, r):
        return surf.side(ya + r * math.cos(t), za + r * math.sin(t), sign)
    return patch(bm, M, cast, (t0, t1), (ra + 0.012, ra + width), mat, lift=lift, wall=0.02, nu=n, nv=1)


def sport_bar(bm, M, y, z0, z1, half_w, mat='trim', r=0.04, brace=0.5):
    """Roll bar behind the cab: two posts, a rounded top rail and two braces raking back to the bed rails."""
    for s in (1, -1):
        rbox(bm, (r * 2, r * 2, z1 - z0), (s * half_w, y, (z0 + z1) / 2), 0.0, 0, M[mat])
        length = math.hypot(brace, z1 - z0)
        rbox(bm, (r * 1.6, r * 1.6, length), (s * half_w, y + brace / 2, (z0 + z1) / 2), 0.0, 0, M[mat],
             rot=(math.atan2(brace, z1 - z0), 0, 0))
    rbox(bm, (half_w * 2 + r * 2, r * 2.2, r * 2.2), (0, y, z1), r * 0.9, 1, M[mat])
