"""veh_taxi lamps and details that hug the taxi's own rounded toy shell (asset-polish, review round 2).

The shared sedan kit (vehicles_cars_sedan.py) samples every lamp with straight +-Y rays. On the taxi's rounder plan
corners and barrel flanks those rays graze the corner and land far back on the fender: bezels spiked back to the
wheel arch, the outer lamp columns lifted off, flat chips sat half-buried in the bumper corners. Here every corner
part is sampled with a CORNER cast: straight +-Y rays across the flat middle (|x| <= xk), then rays that swing round
a vertical axis at (xk, yk), so each hit is near-normal to the corner and neighbouring samples stay neighbours on the
surface. The parameter u is |x| on the flat part and xk + arc length (radius rk) round the corner.

Facing -Y, model LEFT = +X (docs/ASSET_SPEC.md). Only veh_taxi uses this module.
"""
import math
import bmesh
from mathutils import Vector
from .vehicles_cars_parts import stick, plate, seam, side_seam
from .vehicles_cars_sedan import grille


def corner_cast(surf, end, side, xk=0.40, yk=1.75, rk=0.40):
    """cast(u, z) -> (point, normal) on the front ('front') or rear ('rear') corner of side `side` (+1 = +X)."""
    fy = -1.0 if end == 'front' else 1.0

    def cast(u, z):
        if u <= xk:
            return surf.cast(Vector((side * u, fy * 10.0, z)), Vector((0.0, -fy, 0.0)))
        a = (u - xk) / rk
        d = Vector((side * math.sin(a), fy * math.cos(a), 0.0))
        return surf.cast(Vector((side * xk, fy * yk, z)) + d * 6.0, -d)
    return cast


def rounded(cast, us, vs, r=0.65, p=3.0):
    """Wrap `cast` so a patch over us x vs gets rounded ends: the v half-height eases to (1 - r) at the u ends
    (superellipse, exponent p). Sub-ranges of `us` keep the same rounding, so split lamps stay one shape."""
    vc, hv = (vs[0] + vs[1]) / 2, (vs[1] - vs[0]) / 2

    def c(u, v):
        e = min(1.0, abs(2.0 * (u - us[0]) / (us[1] - us[0]) - 1.0))
        k = max(1.0 - r, (1.0 - e ** p) ** (1.0 / p))
        return cast(u, vc + (v - vc) * k)
    return c


def slab(bm, M, cast, us, vs, mat, lift, wall=0.025, nu=4, nv=2):
    """Kit patch() (a thin slab hugging the body: skin `lift` above the surface, walls `wall` below it) without the
    bottom wall: that edge faces the road and is never seen from the diorama / chase / POV cameras (all above lamp
    height), so the triangles go into denser sampling instead."""
    grid = [[cast(us[0] + (us[1] - us[0]) * i / nu, vs[0] + (vs[1] - vs[0]) * j / nv) for i in range(nu + 1)]
            for j in range(nv + 1)]
    top = [[bm.verts.new(p + n * lift) for p, n in row] for row in grid]
    bot = [[bm.verts.new(p - n * wall) for p, n in row] for row in grid]
    centre = sum((v.co for row in top for v in row), Vector()) / ((nu + 1) * (nv + 1))

    def add(vs_, ref):
        f = bm.faces.new(vs_)
        f.normal_update()
        if f.normal.dot(ref) < 0:
            f.normal_flip()
        f.material_index = M[mat]

    for j in range(nv):
        for i in range(nu):
            add((top[j][i], top[j][i + 1], top[j + 1][i + 1], top[j + 1][i]), grid[j][i][1] + grid[j + 1][i + 1][1])
    # right, top, left edges (the bottom row j = 0 stays open)
    ring = [(j, nu) for j in range(nv + 1)] + [(nv, i) for i in range(nu - 1, -1, -1)] + [(j, 0) for j in range(nv - 1, -1, -1)]
    for (j, i), (j2, i2) in zip(ring, ring[1:]):
        a, b = top[j][i], top[j2][i2]
        add((a, b, bot[j2][i2], bot[j][i]), (a.co + b.co) / 2 - centre)


def lamp(bm, M, cast, us, vs, mat, lift, nu, nv=2, r=0.65, within=None):
    """Conformal rounded lamp slab over us x vs; `within` = (us, vs) of the whole lamp it is a piece of."""
    shape_us, shape_vs = within or (us, vs)
    slab(bm, M, rounded(cast, shape_us, shape_vs, r), us, vs, mat, lift=lift, nu=nu, nv=nv)


def front_details(d, M, surf, S, L):
    """Grille, narrower lower intake (room for the fog lamps), plate, wrap-around headlamp bezels + amber corner."""
    grille(d, M, surf, S)
    stick(d, M, surf.front(0, 0.40), (L.intake_w, 0.06, 0.12), 'trim', radius=0.04, out=0.010, front=(0.88, 1.0))
    plate(d, M, surf.front(0, 0.47), out=0.035)
    hu, hv = L.head_u, L.head_v
    for s in (1, -1):
        F = corner_cast(surf, 'front', s, L.xk, -S.nose - L.rk, L.rk)
        bez_u, bez_v = (hu[0] - 0.03, L.amber_u[1] + 0.03), (hv[0] - 0.025, hv[1] + 0.025)
        lamp(d, M, F, bez_u, bez_v, S.head_surround, lift=0.010, nu=8, r=0.55)
        lamp(d, M, F, L.amber_u, hv, 'amber', lift=0.022, nu=2, nv=1, within=((hu[0], L.amber_u[1]), hv))


def side_details(d, M, surf, S):
    """Kit side details minus the amber repeater (it sat inside the headlamp wrap): the indicator now caps the
    wrap-around headlamp instead (front_details)."""
    for s in (1, -1):
        side_seam(d, M, surf, S.door_front_y, 0.34, S.belt - 0.02, s)
        side_seam(d, M, surf, S.door_mid_y, 0.31, S.belt - 0.02, s)
        side_seam(d, M, surf, S.door_rear_y, 0.62, S.belt - 0.02, s, n=4)
        for y in S.handle_ys:
            stick(d, M, surf.side(y, S.handle_z, s), (0.14, 0.03, 0.04), 'chrome', segs=0, out=0.022)
        stick(d, M, surf.side(S.strip[0], S.strip[2], s), (S.strip[1], 0.024, 0.05), 'trim', segs=0, out=0.012)
        seam(d, M, surf, [((s * 5, y, S.gh_zglass + 0.012), (-s, 0, 0)) for y in S.belt_ys], half_w=0.01,
             lift=0.006, mat='chrome')


def rear_details(d, M, surf, S, L):
    """Wrap-around tail lamps with an amber outer end, conformal reflectors, bumper lip, plate, boot chrome."""
    tu, tv = L.tail_u, L.tail_v
    whole = ((tu[0], L.rear_amber_u[1]), tv)
    for s in (1, -1):
        R = corner_cast(surf, 'rear', s, L.xk, S.tail - L.rk, L.rk)
        lamp(d, M, R, tu, tv, 'tail', lift=0.012, nu=7, within=whole)
        lamp(d, M, R, L.rear_amber_u, tv, 'amber', lift=0.012, nu=2, within=whole)
        lamp(d, M, R, L.refl_u, L.refl_v, 'tail', lift=0.008, nu=3, nv=1, r=0.5)
    stick(d, M, surf.rear(0, 0.35), (L.lip_w, 0.05, 0.08), 'trim', radius=0.03, out=0.012)
    plate(d, M, surf.rear(0, tv[0] - 0.06), out=0.012)
    stick(d, M, surf.rear(0, (tv[0] + tv[1]) / 2), (2 * tu[0] - 0.12, 0.04, 0.035), 'chrome', segs=0, out=0.012)


def lights(M, surf, S, L):
    """head_lights (Light_Head: wrap-around lenses + fog lamps) and brake_lights (Light_Brake: lenses inside the
    tail lamps + third brake light). Pivots as the kit: (0, nose + 0.05, head mid z) / (0, tail - 0.05, tail mid z)."""
    hl, bl = bmesh.new(), bmesh.new()
    hu, hv = L.head_u, L.head_v
    for s in (1, -1):
        F = corner_cast(surf, 'front', s, L.xk, -S.nose - L.rk, L.rk)
        R = corner_cast(surf, 'rear', s, L.xk, S.tail - L.rk, L.rk)
        lamp(hl, M, F, hu, hv, 'head', lift=0.022, nu=8, nv=1, within=((hu[0], L.amber_u[1]), hv))
        lamp(hl, M, F, L.fog_u, L.fog_v, 'head', lift=0.016, nu=3, nv=1, r=0.5)
        lamp(bl, M, R, L.brake_u, L.brake_v, 'brake', lift=0.021, nu=6, nv=1, r=0.5)
    stick(bl, M, surf.rear(0, S.third_brake_z), (0.28, 0.03, 0.035), 'brake', segs=0, out=0.01)
    head = M.obj('head_lights', hl, origin=(0, S.nose + 0.05, (hv[0] + hv[1]) / 2))
    brake = M.obj('brake_lights', bl, origin=(0, S.tail - 0.05, (L.tail_v[0] + L.tail_v[1]) / 2))
    return head, brake
