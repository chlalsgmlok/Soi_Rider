"""vehicles_cars kit: reusable detail parts (wheels, door mirrors, lamps, plates, seams, stickers).

`stick()` places a rounded part onto a Surface hit so its outer face protrudes `out` metres along the
surface normal — lamps, bezels, plates, handles all follow the body curvature that way.
"""
import math
import bmesh
from mathutils import Vector
from .vehicles_cars_mesh import rbox, lathe_x, frame_from_normal, quad, ribbon


def wheel(M, name, center, R, width, side, hub='chrome', segs=13, cap='trim'):
    """Chunky tyre + domed hubcap. Pivot at the axle centre, axle along X, hub on the outer side."""
    bm = bmesh.new()
    w = width / 2
    tyre = [(R * 0.86, -w), (R, -w * 0.52), (R, w * 0.52), (R * 0.88, w), (R * 0.60, w * 0.88)]
    lathe_x(bm, tyre, segs, [M['tire']], flip=side < 0)
    hubp = [(R * 0.60, w * 0.88), (R * 0.53, w * 0.99), (R * 0.22, w * 1.07), (0.0, w * 1.11)]
    lathe_x(bm, hubp, segs, [M['tire'], M[hub], M[cap]], flip=side < 0)
    ob = M.obj(name, bm)
    ob.location = Vector(center)
    return ob


def stick(bm, M, hit, size, mat, radius=0.02, segs=1, out=0.01, up=(0, 0, 1), front=(1.0, 1.0), shift=(0, 0, 0)):
    """Rounded box glued to a surface hit (loc, normal). size = (along-surface w, depth, h)."""
    loc, nor = hit
    rot = frame_from_normal(nor, up)
    c = loc + nor * (out - size[1] / 2) + rot @ Vector(shift)
    rbox(bm, size, c, radius, segs, M[mat], rot=rot, front=front)
    return c, rot


def plate(bm, M, hit, w=0.36, h=0.16, out=0.012, text='plate_text'):
    """Thai number plate: rounded slab + embossed 'characters' + province line (flat quads)."""
    loc, nor = hit
    c, rot = stick(bm, M, hit, (w, 0.022, h), 'plate', radius=0.0, segs=0, out=out)
    face = loc + nor * (out + 0.004)
    ex = rot @ Vector((1, 0, 0))
    ez = rot @ Vector((0, 0, 1))
    quad(bm, face + ez * (h * 0.14) - ex * (w * 0.22), nor, w * 0.30, h * 0.36, M[text])
    quad(bm, face + ez * (h * 0.14) + ex * (w * 0.16), nor, w * 0.40, h * 0.36, M[text])
    quad(bm, face - ez * (h * 0.28), nor, w * 0.56, h * 0.12, M[text])
    return c


def seam(bm, M, surf, rays, half_w=0.006, lift=0.004, mat='trim'):
    """Panel-gap line following the body surface (rays = [(origin, dir), ...])."""
    pts, nors = surf.line(rays)
    return ribbon(bm, pts, nors, half_w, lift, M[mat])


def side_seam(bm, M, surf, y, z0, z1, sign, n=5, **kw):
    rays = [((sign * 5.0, y, z0 + (z1 - z0) * i / (n - 1)), (-sign, 0, 0)) for i in range(n)]
    return seam(bm, M, surf, rays, **kw)


def densify(pts, step=0.08):
    """Insert points so no polyline segment is longer than `step` (ribbons then hug convex panels)."""
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, math.ceil(math.dist(a, b) / step))
        out += [tuple(a[k] + (b[k] - a[k]) * i / n for k in range(len(a))) for i in range(1, n + 1)]
    return out


def top_seam(bm, M, surf, pts_xy, step=0.08, **kw):
    rays = [((x, y, 6.0), (0, 0, -1)) for x, y in densify(pts_xy, step)]
    return seam(bm, M, surf, rays, **kw)


def mirror(M, name, side, hinge, tip_x, head_yz, size, housing='paint', glass='chrome', arm='trim',
           sail=(0.06, 0.14, 0.11)):
    """Door mirror: sail at the hinge, arm, domed housing, glass on the rear face. Pivot = hinge.

    size = (lateral, depth, height); the housing's outer end reaches x = tip_x (side * x > 0).
    """
    sx, sy, sz = size
    hinge = Vector(hinge)
    hx = tip_x - side * sx / 2
    head = Vector((hx, head_yz[0], head_yz[1]))
    bm = bmesh.new()
    rbox(bm, sail, hinge, 0.0, 0, M[arm])
    inner = hx - side * sx * 0.32
    ax0, ax1 = hinge.x, inner
    arm_c = ((ax0 + ax1) / 2, (hinge.y + head.y) / 2 + 0.01, min(hinge.z, head.z) - 0.01)
    rbox(bm, (abs(ax1 - ax0) + 0.02, 0.06, 0.045), arm_c, 0.0, 0, M[arm])
    rbox(bm, size, head, min(sx, sy, sz) * 0.36, 2, M[housing], front=(0.84, 0.84))
    rbox(bm, (sx - 0.04, 0.022, sz - 0.04), head + Vector((0, sy / 2 - 0.004, 0)), 0.0, 0, M[glass])
    return M.obj(name, bm, origin=hinge)


def lamp_pair(bm, M, surf, x, z, face, size, mat, out=0.012, bezel=None, bezel_pad=0.025, radius=0.03,
              front=(1.0, 1.0), up=(0, 0, 1), segs=1):
    """Symmetric lamps at +-x on the front ('front') or rear ('rear') face. Returns lens centres."""
    centres = []
    for s in (1, -1):
        hit = surf.front(s * x, z) if face == 'front' else surf.rear(s * x, z)
        if bezel is not None:
            stick(bm, M, hit, (size[0] + bezel_pad * 2, size[1], size[2] + bezel_pad * 2), bezel,
                  radius=radius + 0.01, segs=segs, out=out * 0.5, up=up)
        c, _ = stick(bm, M, hit, size, mat, radius=radius, segs=segs, out=out, front=front, up=up)
        centres.append(c)
    return centres


def ring_wheel_arch(bm, M, ya, za, ra, half_w, sign, mat='trim', width=0.05, thick=0.03, n=9, z_sill=0.25):
    """Fender-flare lip around a wheel arch (pickups/vans), lying on the body side."""
    a = math.asin(max(-1.0, min(1.0, (z_sill - za) / (ra + width * 0.5))))
    t0, t1 = math.pi - a, a
    for i in range(n - 1):
        ta = t0 + (t1 - t0) * (i + 0.5) / (n - 1)
        r = ra + width * 0.5
        cy, cz = ya + r * math.cos(ta), za + r * math.sin(ta)
        seg_len = 2 * r * math.sin(abs(t1 - t0) / (n - 1) / 2) + 0.02
        rbox(bm, (thick, seg_len, width), (sign * (half_w + thick * 0.2), cy, cz), 0.012, 1, M[mat],
             rot=(ta - math.pi / 2, 0, 0))


def patch(bm, M, cast, us, vs, mat, lift=0.012, wall=0.025, nu=4, nv=2):
    """Thin slab that hugs the body (wrap-around lamps, stickers, inlays).

    cast(u, v) -> (point, normal) samples the surface on a (nu+1) x (nv+1) grid over us x vs; the outer skin sits
    `lift` above it and a short wall drops `wall` below, so the part follows curved corners without poking out.
    """
    grid = [[cast(us[0] + (us[1] - us[0]) * i / nu, vs[0] + (vs[1] - vs[0]) * j / nv) for i in range(nu + 1)]
            for j in range(nv + 1)]
    top = [[bm.verts.new(p + n * lift) for p, n in row] for row in grid]
    bot = [[bm.verts.new(p - n * wall) for p, n in row] for row in grid]
    centre = sum((v.co for row in top for v in row), Vector()) / ((nu + 1) * (nv + 1))
    faces = []

    def add(vs_, ref):
        f = bm.faces.new(vs_)
        f.normal_update()
        if f.normal.dot(ref) < 0:
            f.normal_flip()
        f.material_index = M[mat]
        faces.append(f)

    for j in range(nv):
        for i in range(nu):
            add((top[j][i], top[j][i + 1], top[j + 1][i + 1], top[j + 1][i]), grid[j][i][1] + grid[j + 1][i + 1][1])
    ring = [(0, i) for i in range(nu)] + [(j, nu) for j in range(nv)] + \
           [(nv, i) for i in range(nu, 0, -1)] + [(j, 0) for j in range(nv, 0, -1)]
    for k, (j, i) in enumerate(ring):
        j2, i2 = ring[(k + 1) % len(ring)]
        a, b = top[j][i], top[j2][i2]
        add((a, b, bot[j2][i2], bot[j][i]), (a.co + b.co) / 2 - centre)
    return faces


def face_cast(surf, face, sign=1):
    """cast(u, v) for patch(): 'front'/'rear' -> (x, z); 'side' -> (y, z) on the +X (sign=1) or -X flank."""
    if face == 'front':
        return surf.front
    if face == 'rear':
        return surf.rear
    if face == 'top':
        return surf.top
    return lambda y, z: surf.side(y, z, sign)
