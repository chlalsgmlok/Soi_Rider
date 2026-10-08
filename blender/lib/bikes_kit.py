"""Bikes-group geometry kit: bmesh lathes, lofts, swept tubes, profile slabs, UV quads and
pivot/parent helpers for the bike node contract (docs/ASSET_SPEC.md).

Every builder writes geometry in WORLD coordinates and leaves the object at the identity
transform; `set_frame()` later moves the pivot (and optional rotation) without moving geometry.
All builders produce closed meshes so `recalc_face_normals` orients them outward reliably
(three.js renders glTF materials single-sided, so flipped faces would vanish).
"""
import math
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

V = Vector
TAU = math.tau


# ----------------------------------------------------------------------------- basics
def activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def _mk(name, bm, material, recalc=True):
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if material is not None:
        me.materials.append(material)
    return obj


def finish(obj, smooth=50, bevel=0.0, segs=2, limit=30):
    """Optional angle-limited bevel (applied) + smooth-by-angle shading (smooth=None -> flat)."""
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(limit)
        activate(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    activate(obj)
    if smooth is None:
        bpy.ops.object.shade_flat()
    else:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    return obj


def add_material(obj, material):
    """Append a material slot (if missing) and return its index."""
    mats = obj.data.materials
    for i, m in enumerate(mats):
        if m == material:
            return i
    mats.append(material)
    return len(mats) - 1


def paint_faces(obj, material, pred):
    """Assign `material` to faces whose (centre, normal) satisfy pred(c, n)."""
    idx = add_material(obj, material)
    for p in obj.data.polygons:
        if pred(V(p.center), V(p.normal)):
            p.material_index = idx
    return obj


def recolor(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return obj


# ----------------------------------------------------------------------------- rings & paths
def sring(c, hw, ht, hb=None, n=16, p=2.5, pb=None, plane='XZ', phase=0.0):
    """Superellipse ring around centre c.

    plane 'XZ': ring at fixed y (lofts along Y): a->x, b->z.
    plane 'YZ': ring at fixed x (lofts along X): a->y, b->z.
    plane 'XY': ring at fixed z (lofts along Z): a->x, b->y.
    hw = half extent on a; ht / hb = half extent on +b / -b; p / pb = exponents (+b / -b halves).
    """
    hb = ht if hb is None else hb
    pb = p if pb is None else pb
    an, ap = (hw if isinstance(hw, (tuple, list)) else (hw, hw))
    c = V(c)
    pts = []
    for i in range(n):
        t = TAU * i / n + phase
        ct, st = math.cos(t), math.sin(t)
        e = p if st >= 0 else pb
        a = math.copysign(abs(ct) ** (2.0 / e), ct) * (ap if ct >= 0 else an)
        b = math.copysign(abs(st) ** (2.0 / e), st) * (ht if st >= 0 else hb)
        if plane == 'XZ':
            pts.append(V((c.x + a, c.y, c.z + b)))
        elif plane == 'YZ':
            pts.append(V((c.x, c.y + a, c.z + b)))
        else:
            pts.append(V((c.x + a, c.y + b, c.z)))
    return pts


def arc(cx, cy, r, a0, a1, steps):
    """2D arc points (degrees), inclusive."""
    out = []
    for k in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return out


def rrect(w, h, r, steps=2, cx=0.0, cy=0.0):
    """Rounded rectangle polygon (2D, CCW) centred at (cx, cy)."""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    for (ox, oy, a0) in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                         (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        pts += arc(cx + ox, cy + oy, r, a0, a0 + 90, steps)
    return pts


def fillet_path(pts, radius, steps=3):
    """Polyline with every interior corner replaced by a quadratic-bezier fillet."""
    pts = [V(p) for p in pts]
    if radius <= 0 or len(pts) < 3:
        return pts
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        p0, p1, p2 = pts[i - 1], pts[i], pts[i + 1]
        d0 = p0 - p1
        d1 = p2 - p1
        l0, l1 = d0.length, d1.length
        d0.normalize()
        d1.normalize()
        ang = d0.angle(d1)
        if ang > math.pi - 1e-3:
            out.append(p1)
            continue
        td = min(radius / math.tan(ang / 2), l0 * 0.49, l1 * 0.49)
        a, b = p1 + d0 * td, p1 + d1 * td
        for k in range(steps + 1):
            t = k / steps
            out.append((1 - t) ** 2 * a + 2 * (1 - t) * t * p1 + t * t * b)
    out.append(pts[-1])
    return out


# ----------------------------------------------------------------------------- builders
def lathe(name, prof, material=None, seg=16, axis=(1, 0, 0), center=(0, 0, 0), up=None,
          smooth=60, closed=False, phase=None):
    """Revolve a profile [(radius, axial)] about `axis` through `center`.

    radius 0 -> pole vertex. Open ends get ngon caps. closed=True joins last ring to first.
    """
    a = V(axis).normalized()
    ref = V(up) if up is not None else (V((0, 0, 1)) if abs(a.z) < 0.9 else V((0, 1, 0)))
    u = (ref - a * ref.dot(a)).normalized()
    v = a.cross(u)
    c = V(center)
    ph = (math.pi / seg) if phase is None else phase
    bm = bmesh.new()
    rings = []
    for r, t in prof:
        if r < 1e-6:
            rings.append([bm.verts.new(c + a * t)])
        else:
            rings.append([bm.verts.new(c + a * t + (u * math.cos(ph + TAU * i / seg)
                                                    + v * math.sin(ph + TAU * i / seg)) * r)
                          for i in range(seg)])
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    for A, B in pairs:
        if len(A) == 1 and len(B) == 1:
            continue
        for i in range(seg):
            j = (i + 1) % seg
            if len(A) == 1:
                bm.faces.new((A[0], B[j], B[i]))
            elif len(B) == 1:
                bm.faces.new((A[i], A[j], B[0]))
            else:
                bm.faces.new((A[i], A[j], B[j], B[i]))
    if not closed:
        if len(rings[0]) > 1:
            bm.faces.new(rings[0])
        if len(rings[-1]) > 1:
            bm.faces.new(list(reversed(rings[-1])))
    return finish(_mk(name, bm, material), smooth)


def loft(name, rings, material=None, cap=True, smooth=55, fan=None, paint=None):
    """Skin consecutive rings (equal vertex count). fan=(d0, d1): cap ends with a centre vertex
    pushed d0 / d1 metres outward along the loft direction (rounded dome ends) instead of ngons.
    paint=[(material, fn(seg, i) -> bool)]: per-face material for side face i of segment seg
    (face i spans ring vertices i..i+1), e.g. clean stripes that follow the body surface."""
    bm = bmesh.new()
    vr = [[bm.verts.new(V(p)) for p in ring] for ring in rings]
    n = len(rings[0])
    for A, B in zip(vr, vr[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], A[j], B[j], B[i]))
    side_faces = (len(rings) - 1) * n
    if cap:
        if fan is None:
            bm.faces.new(vr[0])
            bm.faces.new(list(reversed(vr[-1])))
        else:
            for ring, nxt, d in ((rings[0], rings[1], fan[0]), (rings[-1], rings[-2], fan[1])):
                cen = sum((V(p) for p in ring), V()) / n
                cn = sum((V(p) for p in nxt), V()) / n
                axis = (cen - cn).normalized()
                pole = bm.verts.new(cen + axis * d)
                vv = vr[0] if ring is rings[0] else vr[-1]
                for i in range(n):
                    bm.faces.new((vv[i], vv[(i + 1) % n], pole))
    obj = _mk(name, bm, material)
    for m, fn in (paint or []):
        idx = add_material(obj, m)
        polys = obj.data.polygons
        for f in range(side_faces):
            if fn(f // n, f % n):
                polys[f].material_index = idx
    return finish(obj, smooth)


def fender(name, center, radius, phi0, phi1, steps, hw, ht, material=None, n=10, p=3.0, smooth=55,
           x=0.0, fan=(0.004, 0.004), paint=None, phase=0.0):
    """Arc loft around an axle along X (wheel hugger / mudguard).

    phi measured from +Z toward -Y (front): 0 = top, +90 = front, -90 = back.
    Cross-section: half width hw (x), half thickness ht (radial), superellipse p.
    """
    c = V(center)
    rings = []
    for k in range(steps + 1):
        f = math.radians(phi0 + (phi1 - phi0) * k / steps)
        rhat = V((0, -math.sin(f), math.cos(f)))
        mid = c + rhat * radius + V((x, 0, 0))
        ring = []
        for i in range(n):
            t = TAU * i / n + phase
            ct, st = math.cos(t), math.sin(t)
            a = math.copysign(abs(ct) ** (2.0 / p), ct) * hw
            b = math.copysign(abs(st) ** (2.0 / p), st) * ht
            ring.append(mid + V((a, 0, 0)) + rhat * b)
        rings.append(ring)
    return loft(name, rings, material, cap=True, smooth=smooth, fan=fan, paint=paint)


def tube(name, pts, radius, material=None, sides=8, fillet=0.0, steps=3, cap=True, smooth=60,
         twist=0.0, ref=None):
    """Sweep a circle along a polyline (corners filleted). radius: number, (r0, r1) or f(t)."""
    path = fillet_path(pts, fillet, steps) if fillet > 0 else [V(p) for p in pts]
    n = len(path)
    lens = [0.0]
    for i in range(1, n):
        lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1] or 1.0
    if callable(radius):
        rf = radius
    elif isinstance(radius, (tuple, list)):
        rf = (lambda t, r0=radius[0], r1=radius[1]: r0 + (r1 - r0) * t)
    else:
        rf = (lambda t, r=radius: r)
    tans = []
    for i in range(n):
        if i == 0:
            t = path[1] - path[0]
        elif i == n - 1:
            t = path[-1] - path[-2]
        else:
            t = (path[i + 1] - path[i]).normalized() + (path[i] - path[i - 1]).normalized()
        tans.append(t.normalized())
    r0 = V(ref) if ref is not None else (V((0, 0, 1)) if abs(tans[0].z) < 0.9 else V((1, 0, 0)))
    nrm = (r0 - tans[0] * r0.dot(tans[0])).normalized()
    bm = bmesh.new()
    rings = []
    for i in range(n):
        if i > 0:
            q = tans[i - 1].rotation_difference(tans[i])
            nrm = q @ nrm
            nrm = (nrm - tans[i] * nrm.dot(tans[i])).normalized()
        bi = tans[i].cross(nrm)
        r = rf(lens[i] / total)
        rings.append([bm.verts.new(path[i] + (nrm * math.cos(TAU * k / sides + twist)
                                              + bi * math.sin(TAU * k / sides + twist)) * r)
                      for k in range(sides)])
    for A, B in zip(rings, rings[1:]):
        for k in range(sides):
            j = (k + 1) % sides
            bm.faces.new((A[k], A[j], B[j], B[k]))
    if cap:
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
    return finish(_mk(name, bm, material), smooth)


def slab(name, prof, w0, w1, material=None, axis='X', bevel=0.0, segs=2, smooth=40, limit=30):
    """Extrude a 2D polygon between w0..w1 along `axis`.

    axis 'X': prof is (y, z); axis 'Y': prof is (x, z); axis 'Z': prof is (x, y).
    """
    def P(a, b, w):
        if axis == 'X':
            return V((w, a, b))
        if axis == 'Y':
            return V((a, w, b))
        return V((a, b, w))
    bm = bmesh.new()
    A = [bm.verts.new(P(a, b, w0)) for a, b in prof]
    B = [bm.verts.new(P(a, b, w1)) for a, b in prof]
    n = len(prof)
    bm.faces.new(A)
    bm.faces.new(list(reversed(B)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((A[i], A[j], B[j], B[i]))
    return finish(_mk(name, bm, material), smooth, bevel, segs, limit)


def block(name, size, loc, material=None, rot=(0, 0, 0), bevel=0.0, segs=1, smooth=40):
    """Cheap box (12 tris without bevel), rotated by Euler `rot` about its centre."""
    sx, sy, sz = (s / 2 for s in size)
    bm = bmesh.new()
    vs = [bm.verts.new(V((x, y, z))) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        bm.faces.new([vs[i] for i in f])
    obj = _mk(name, bm, material)
    obj.data.transform(Matrix.Translation(V(loc)) @ Euler(rot).to_matrix().to_4x4())
    return finish(obj, smooth, bevel, segs)


def quad(name, corners, material=None):
    """Flat quad bl, br, tr, tl (counter-clockwise as seen from the visible side) with 0..1 UVs."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(V(c)) for c in corners], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name='UVMap')
    for li, (u, v) in zip(me.polygons[0].loop_indices, ((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[li].uv = (u, v)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if material is not None:
        me.materials.append(material)
    return obj


def planar_uv(obj, origin, u_axis, v_axis, size_u, size_v):
    """Planar UVs: uv = ((p-origin).u / size_u + .5, (p-origin).v / size_v + .5)."""
    me = obj.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    o, ua, va = V(origin), V(u_axis).normalized(), V(v_axis).normalized()
    for poly in me.polygons:
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((p - o).dot(ua) / size_u + 0.5, (p - o).dot(va) / size_v + 0.5)
    return obj


# ----------------------------------------------------------------------------- object ops
def transform(obj, matrix):
    obj.data.transform(matrix)
    return obj


def rot_about(obj, pivot, euler):
    """Rotate mesh data about a world pivot."""
    p = V(pivot)
    M = Matrix.Translation(p) @ Euler(euler).to_matrix().to_4x4() @ Matrix.Translation(-p)
    obj.data.transform(M)
    return obj


def mirror_x(obj, name=None):
    """Copy of `obj` mirrored across world x=0 (normals fixed)."""
    new = obj.copy()
    new.data = obj.data.copy()
    new.name = name or (obj.name + '_mx')
    bpy.context.scene.collection.objects.link(new)
    new.data.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    bm = bmesh.new()
    bm.from_mesh(new.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(new.data)
    bm.free()
    new.data.update()
    return new


def sym(obj):
    """[obj, mirrored copy] for symmetric parts."""
    return [obj, mirror_x(obj)]


def join(objs, name):
    objs = [o for o in objs if o is not None]
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name
    return obj


def set_frame(obj, origin, rot=(0, 0, 0)):
    """Place the object's pivot at `origin` with rotation `rot` (Euler XYZ) keeping geometry in place."""
    M = Matrix.Translation(V(origin)) @ Euler(rot).to_matrix().to_4x4()
    if obj.type == 'MESH':
        obj.data.transform(M.inverted() @ obj.matrix_world)
    obj.matrix_world = M
    bpy.context.view_layer.update()
    return obj


def parent(child, par):
    """Parent keeping the child's world transform (explicit local basis, identity parent-inverse)."""
    bpy.context.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_parent_inverse = Matrix.Identity(4)
    child.matrix_basis = par.matrix_world.inverted() @ mw
    bpy.context.view_layer.update()
    return child


def node(name, loc, par=None, size=0.06):
    """World-aligned empty (attach point / light origin) parented with world transform kept."""
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = size
    obj.empty_display_type = 'PLAIN_AXES'
    bpy.context.scene.collection.objects.link(obj)
    obj.matrix_world = Matrix.Translation(V(loc))
    if par is not None:
        parent(obj, par)
    return obj


def tris_of(obj):
    if obj.type != 'MESH':
        return 0
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def report(objs, label=''):
    total = 0
    for o in objs:
        t = tris_of(o)
        total += t
        print(f'[tris] {label}{o.name:<22} {t}')
    print(f'[tris] {label}TOTAL {total}')
    return total
