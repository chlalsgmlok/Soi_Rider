"""Modelling kit for the `vehicles_thai` group (tuk-tuk, bus, songthaew, BTS car).

Builds geometry directly with bmesh so silhouettes stay round for few triangles:
  fillet()  rounded 2D polygons        prism()  extrude a 2D outline along an axis
  lathe()   revolve a profile          tube()   sweep a round tube along a polyline (chrome rails)
  rpanel()  rounded-rect slab          quad()   flat quad with 0..1 UVs (Sign_Face / plates)
  toy_wheel(), round_lamp(), mirror_pod()
Conventions follow docs/ASSET_SPEC.md (Z-up, metres, vehicles face -Y, model LEFT = +X).
"""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix
from .shapes import _activate


# ---------------------------------------------------------------- basics
def _link(bm, name):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _uv_project(bm):
    """Cheap box projection so every mesh carries a UV map (keeps glTF attribute sets uniform)."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co[a] * 0.5, co[b] * 0.5)


def _set_mats(obj, mats):
    # NB: materials.clear() also resets every face's material_index to 0, so only clear when slots exist
    if len(obj.data.materials):
        obj.data.materials.clear()
    for m in mats:
        obj.data.materials.append(m)


def finish(obj, mats, bevel=0.0, segments=1, angle=30, smooth=35):
    """Assign material(s); optional angle-limited bevel (applied); smooth shading by angle."""
    if not isinstance(mats, (list, tuple)):
        mats = [mats]
    _set_mats(obj, [m for m in mats if m is not None])
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(angle)
        mod.use_clamp_overlap = True
        mod.harden_normals = False
        _activate(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth is not None:
        _activate(obj)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    return obj


def basis(normal, up_hint=(0, 0, 1)):
    """Rotation matrix mapping local X->right, Y->up, Z->normal (as seen by a viewer facing the surface)."""
    n = Vector(normal).normalized()
    up = Vector(up_hint)
    if abs(n.dot(up)) > 0.95:
        up = Vector((0, 1, 0)) if abs(n.y) < 0.95 else Vector((0, 0, 1))
    right = (-n).cross(up).normalized()      # viewer looks along -n; right = forward x up
    upv = n.cross(right).normalized()        # right x up = n  -> proper rotation
    m = Matrix((right, upv, n)).transposed()
    return m.to_4x4()


def place(obj, loc=(0, 0, 0), normal=(0, 0, 1), up_hint=(0, 0, 1)):
    """Transform mesh data built around the origin with its axis along local +Z."""
    M = Matrix.Translation(Vector(loc)) @ basis(normal, up_hint)
    obj.data.transform(M)
    obj.data.update()
    return obj


def move(obj, offset):
    obj.data.transform(Matrix.Translation(Vector(offset)))
    obj.data.update()
    return obj


def mirror_x(obj, name):
    """Duplicate a mesh object mirrored across X (normals fixed)."""
    me = obj.data.copy()
    me.name = name
    dup = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(dup)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.scale(bm, vec=(-1, 1, 1), verts=bm.verts)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    return dup


# ---------------------------------------------------------------- 2D outlines
def _dedupe(pts, eps=1e-5):
    out = []
    for p in pts:
        if not out or (abs(out[-1][0] - p[0]) > eps or abs(out[-1][1] - p[1]) > eps):
            out.append(p)
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) <= eps and abs(out[0][1] - out[-1][1]) <= eps:
        out.pop()
    return out


def fillet(pts, radii, n=3):
    """Round the corners of a closed 2D polygon. radii: float or per-corner list. n = points per arc."""
    N = len(pts)
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * N
    out = []
    for i in range(N):
        p = Vector(pts[i])
        a = Vector(pts[i - 1])
        b = Vector(pts[(i + 1) % N])
        r = radii[i]
        d1, d2 = a - p, b - p
        l1, l2 = d1.length, d2.length
        if r <= 0 or n < 2 or l1 < 1e-6 or l2 < 1e-6:
            out.append((p.x, p.y))
            continue
        d1.normalize()
        d2.normalize()
        ang = math.acos(max(-1.0, min(1.0, d1.dot(d2))))
        if ang < 1e-3 or abs(ang - math.pi) < 1e-3:
            out.append((p.x, p.y))
            continue
        t = r / math.tan(ang / 2)
        tmax = min(l1, l2) * 0.5
        if t > tmax:
            t = tmax
            r = t * math.tan(ang / 2)
        p1, p2 = p + d1 * t, p + d2 * t
        c = p + (d1 + d2).normalized() * (r / math.sin(ang / 2))
        a1 = math.atan2(p1.y - c.y, p1.x - c.x)
        a2 = math.atan2(p2.y - c.y, p2.x - c.x)
        da = a2 - a1
        while da > math.pi:
            da -= 2 * math.pi
        while da < -math.pi:
            da += 2 * math.pi
        for k in range(n):
            tt = a1 + da * k / (n - 1)
            out.append((c.x + r * math.cos(tt), c.y + r * math.sin(tt)))
    return _dedupe(out)


def rrect(w, h, r, n=3, cx=0.0, cy=0.0):
    pts = [(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)]
    return fillet(pts, r, n)


def ellipse(rx, ry, n=16, cx=0.0, cy=0.0):
    return [(cx + rx * math.cos(2 * math.pi * k / n), cy + ry * math.sin(2 * math.pi * k / n)) for k in range(n)]


# ---------------------------------------------------------------- solids
def superellipse(hw, hh, n=20, p_top=2.6, p_bot=6.0, cx=0.0, cy=0.0, flat=0.0):
    """Pillowy closed outline with a FIXED point count (safe for lofting).

    Top half uses exponent p_top (2 = ellipse, higher = boxier), bottom half p_bot.
    flat > 0 pushes the bottom edge towards a straight line.
    """
    out = []
    for k in range(n):
        t = 2 * math.pi * k / n
        c, s = math.cos(t), math.sin(t)
        p = p_top if s >= 0 else p_bot
        x = hw * math.copysign(abs(c) ** (2 / p), c)
        y = hh * math.copysign(abs(s) ** (2 / p), s)
        if s < 0 and flat > 0:
            y = y * (1 - flat) - hh * flat
        out.append((cx + x, cy + y))
    return out


def ring_band(name, outer, inner, z0, z1, mats=None, smooth=35):
    """Hollow vertical band between two closed (x,y) outlines with equal point counts."""
    bm = bmesh.new()
    n = len(outer)
    ob = [bm.verts.new((x, y, z0)) for x, y in outer]
    ot = [bm.verts.new((x, y, z1)) for x, y in outer]
    ib = [bm.verts.new((x, y, z0)) for x, y in inner]
    it = [bm.verts.new((x, y, z1)) for x, y in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([ob[i], ob[j], ot[j], ot[i]])
        bm.faces.new([it[i], it[j], ib[j], ib[i]])
        bm.faces.new([ot[i], ot[j], it[j], it[i]])
        bm.faces.new([ib[i], ib[j], ob[j], ob[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    _uv_project(bm)
    obj = _link(bm, name)
    return finish(obj, mats or [], smooth=smooth)


def _P(axis, u, v, w):
    if axis == 'X':
        return (w, u, v)
    if axis == 'Y':
        return (u, w, v)
    return (u, v, w)


def prism(name, pts, depth, axis='X', center=0.0, mats=None, bevel=0.0, segments=1, angle=30, smooth=35, taper=1.0):
    """Extrude a closed 2D outline along an axis. axis 'X': pts are (y,z); 'Y': (x,z); 'Z': (x,y).

    taper scales the +side cap about the outline centroid (1 = straight prism).
    """
    pts = _dedupe(list(pts))
    bm = bmesh.new()
    h = depth / 2
    cu = sum(p[0] for p in pts) / len(pts)
    cv = sum(p[1] for p in pts) / len(pts)
    hi = [bm.verts.new(_P(axis, cu + (u - cu) * taper, cv + (v - cv) * taper, center + h)) for u, v in pts]
    lo = [bm.verts.new(_P(axis, u, v, center - h)) for u, v in pts]
    bm.faces.new(hi)
    bm.faces.new(list(reversed(lo)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    _uv_project(bm)
    obj = _link(bm, name)
    return finish(obj, mats or [], bevel, segments, angle, smooth)


def loft(name, sections, mats=None, bevel=0.0, segments=1, angle=30, smooth=35, caps=True, mat_fn=None, cap_mats=(0, 0)):
    """Skin a list of closed 3D sections (same point count each) into a solid.

    mat_fn(face_centre: Vector) -> material index colours side faces (e.g. two-tone bands by height);
    cap_mats sets the indices of the first/last cap.
    """
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in sec] for sec in sections]
    n = len(sections[0])
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new([a[i], a[j], b[j], b[i]])
            if mat_fn is not None:
                f.material_index = mat_fn(f.calc_center_median())
    if caps:
        bm.faces.new(rings[0]).material_index = cap_mats[0]
        bm.faces.new(list(reversed(rings[-1]))).material_index = cap_mats[1]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    _uv_project(bm)
    obj = _link(bm, name)
    return finish(obj, mats or [], bevel, segments, angle, smooth)


def lathe(name, profile, segs=16, mats=None, mat_idx=None, sharp=(), phase=0.0, loc=(0, 0, 0), normal=(0, 0, 1),
          caps=True):
    """Revolve [(r, a), ...] around local Z (a = height). r≈0 points become poles; open ends get caps
    (caps=False leaves them open — for rings whose ends are buried or covered, saves triangles).

    mat_idx: material index per profile segment. sharp: profile indices whose ring edges stay hard.
    """
    bm = bmesh.new()
    rings = []
    for r, a in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, a))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / segs + phase),
                                        r * math.sin(2 * math.pi * k / segs + phase), a)) for k in range(segs)])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        mi = mat_idx[i] if mat_idx else 0
        if len(A) == 1 and len(B) == 1:
            continue
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(A) == 1:
                f = bm.faces.new([A[0], B[k], B[k2]])
            elif len(B) == 1:
                f = bm.faces.new([A[k], A[k2], B[0]])
            else:
                f = bm.faces.new([A[k], A[k2], B[k2], B[k]])
            f.material_index = mi
    if caps and len(rings[0]) > 1:
        f = bm.faces.new(rings[0])
        f.material_index = mat_idx[0] if mat_idx else 0
    if caps and len(rings[-1]) > 1:
        f = bm.faces.new(list(reversed(rings[-1])))
        f.material_index = mat_idx[-1] if mat_idx else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    sharp_verts = set()
    for i in sharp:
        if 0 <= i < len(rings) and len(rings[i]) > 1:
            sharp_verts.update(rings[i])
    for e in bm.edges:
        if e.verts[0] in sharp_verts and e.verts[1] in sharp_verts:
            e.smooth = False
    bm.normal_update()
    _uv_project(bm)
    obj = _link(bm, name)
    finish(obj, mats or [], smooth=None)
    return place(obj, loc, normal)


def tube(name, pts, radius, sides=6, mats=None, caps=True, closed=False):
    """Round tube swept along a 3D polyline (parallel-transport frames)."""
    P = [Vector(p) for p in pts]
    n = len(P)
    tang = []
    for i in range(n):
        if closed:
            t = (P[(i + 1) % n] - P[i]).normalized() + (P[i] - P[i - 1]).normalized()
        elif i == 0:
            t = P[1] - P[0]
        elif i == n - 1:
            t = P[-1] - P[-2]
        else:
            t = (P[i + 1] - P[i]).normalized() + (P[i] - P[i - 1]).normalized()
        tang.append(t.normalized())
    ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = tang[0].cross(ref).normalized()
    bm = bmesh.new()
    rings = []
    for i in range(n):
        t = tang[i]
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bn = t.cross(nrm)
        rings.append([bm.verts.new(P[i] + (nrm * math.cos(2 * math.pi * k / sides) +
                                           bn * math.sin(2 * math.pi * k / sides)) * radius) for k in range(sides)])
    pairs = list(zip(rings[:-1], rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    for a, b in pairs:
        for k in range(sides):
            k2 = (k + 1) % sides
            bm.faces.new([a[k], a[k2], b[k2], b[k]])
    if caps and not closed:
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    for ring in (rings[0], rings[-1]) if caps and not closed else ():
        rs = set(ring)
        for e in bm.edges:
            if e.verts[0] in rs and e.verts[1] in rs:
                e.smooth = False
    bm.normal_update()
    _uv_project(bm)
    obj = _link(bm, name)
    return finish(obj, mats or [], smooth=None)


def arc(center, radius, a0, a1, n, plane='YZ'):
    """Points on a circular arc (degrees) in a coordinate plane through `center`."""
    cx, cy, cz = center
    out = []
    for k in range(n):
        t = math.radians(a0 + (a1 - a0) * k / (n - 1))
        c, s = math.cos(t) * radius, math.sin(t) * radius
        if plane == 'YZ':
            out.append((cx, cy + c, cz + s))
        elif plane == 'XZ':
            out.append((cx + c, cy, cz + s))
        else:
            out.append((cx + c, cy + s, cz))
    return out


def rpanel(name, w, h, depth, r, loc, normal=(0, -1, 0), mats=None, n=3, bevel=0.0, segments=1, smooth=35, taper=1.0,
           angle=60):
    """Rounded-rectangle slab: w = width along the viewer's right, h = height, depth along `normal`.

    The bevel only catches the ~90 deg cap edges (angle limit 60) so rounded corners stay cheap.
    """
    obj = prism(name, rrect(w, h, r, n), depth, axis='Z', center=0.0, mats=mats, bevel=bevel,
                segments=segments, angle=angle, smooth=smooth, taper=taper)
    return place(obj, loc, normal)


def quad(name, w, h, loc, normal=(0, -1, 0), mats=None):
    """Flat quad with 0..1 UVs: u to the viewer's right, v up (Blender convention, exporter flips for glTF)."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.verify()
    for lp, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = co
    obj = _link(bm, name)
    finish(obj, mats or [], smooth=None)
    return place(obj, loc, normal)


# ---------------------------------------------------------------- vehicle parts
def toy_wheel(name, R, W, tire, hub, side=1, segs=16, cap=0.36, simple=False):
    """Chunky cartoon wheel centred at the origin, axle along X.

    side=+1: detailed hub faces +X (model left), -1 faces -X, 0 both faces detailed.
    Materials: [tire, hub]. Profile = puffy sidewall, flat tread, dished rim, domed hub cap
    (simple=True drops the separate hub-cap ring).
    """
    outer = [(R, 0.28), (0.86 * R, 0.50), (0.64 * R, 0.46), (0.58 * R, 0.34), (cap * R, 0.40), (0.0, 0.52)]
    outer_m = [0, 0, 1, 1, 1]          # segment materials after the tread
    if simple:
        outer = [(R, 0.28), (0.86 * R, 0.50), (0.64 * R, 0.46), (0.58 * R, 0.34), (0.0, 0.44)]
        outer_m = [0, 0, 1, 1]
    k = len(outer)
    if side == 0:
        inner = [(r, -a) for r, a in reversed(outer)]
        prof = inner + outer
        midx = list(reversed(outer_m)) + [0] + outer_m
        sharp = (k - 4, k - 3, len(prof) - (k - 2), len(prof) - (k - 3))
    else:
        inner = [(0.0, -0.40), (0.60 * R, -0.46), (0.86 * R, -0.50), (R, -0.28)]
        prof = inner + outer
        midx = [1, 0, 0] + [0] + outer_m
        sharp = (1, 6, 7)
    prof = [(r, a * W) for r, a in prof]
    obj = lathe(name, prof, segs=segs, mats=[tire, hub], mat_idx=midx, sharp=sharp)
    rot = Matrix.Rotation(math.radians(-90 if side < 0 else 90), 4, 'Y')   # local +Z -> +X (or -X)
    obj.data.transform(rot)
    obj.data.update()
    return obj


def round_lamp(name, r, loc, normal, lens_mat, bezel_mat, segs=12, depth=None, bezel=True, lens_only=False):
    """Round lamp = chrome bezel cup + domed lens. Returns (bezel_obj or None, lens_obj)."""
    d = depth if depth is not None else r * 0.6
    lens = lathe(name + '_lens', [(0.0, d * 0.95), (r * 0.55, d * 0.85), (r * 0.82, d * 0.55), (r * 0.82, d * 0.2), (0.0, d * 0.2)],
                 segs=segs, mats=[lens_mat], sharp=(3,), loc=loc, normal=normal)
    bz = None
    if bezel and not lens_only:
        bz = lathe(name + '_bezel', [(0.0, 0.0), (r * 1.0, 0.0), (r * 1.06, d * 0.35), (r * 0.98, d * 0.62),
                                     (r * 0.84, d * 0.5), (r * 0.8, d * 0.3), (0.0, d * 0.3)],
                   segs=segs, mats=[bezel_mat], sharp=(1, 4), loc=loc, normal=normal)
    return bz, lens


def ring_lamp(name, r, loc, normal, lens_mat, bezel_mat, segs=10, d=None):
    """Toy lamp: proud chrome ring (bezel) with a domed lens inside. Returns (bezel_obj, lens_obj).

    Both lathes are open-ended: the bezel's back is buried in the body and its hole is plugged by the lens.
    """
    d = d if d is not None else r * 0.9
    lens = lathe(name + '_lens', [(0.0, d * 1.08), (r * 0.6, d * 0.98), (r * 0.94, d * 0.6)],
                 segs=segs, mats=[lens_mat], loc=loc, normal=normal, caps=False)
    bez = lathe(name + '_bezel', [(r * 1.02, 0.0), (r * 1.2, d * 0.35), (r * 1.12, d * 0.78), (r * 0.9, d * 0.72)],
                segs=segs, mats=[bezel_mat], sharp=(0, 3), loc=loc, normal=normal, caps=False)
    return bez, lens


def mirror_pod(name, hinge, head, head_size, stalk_r, frame_mat, glass_mat, stalk_mat=None, face=(0, 1, 0), segs=10):
    """Round/oval mirror on a stalk. Object origin should be set to the hinge (rotating about Z folds it).

    head_size=(w, h, d). One lathe = domed back shell (frame_mat) + flat glass face (glass_mat) facing `face`.
    """
    hx, hy, hz = head
    w, h, d = head_size
    stalk = tube(name + '_stalk', [hinge, ((hinge[0] + hx) / 2, (hinge[1] + hy) / 2, hz + 0.02), (hx, hy, hz)],
                 stalk_r, sides=6, mats=[stalk_mat or frame_mat], caps=False)
    r = h / 2
    prof = [(0.0, d * 0.45), (0.84 * r, d * 0.45), (r, d * 0.25), (0.9 * r, -d * 0.35), (0.45 * r, -d * 0.55), (0.0, -d * 0.58)]
    shell = lathe(name + '_head', prof, segs=segs, mats=[glass_mat, frame_mat], mat_idx=[0, 1, 1, 1, 1], sharp=(1,))
    shell.data.transform(Matrix.Diagonal((w / h, 1.0, 1.0, 1.0)))
    place(shell, (hx, hy, hz), face)
    return stalk, shell


def report(groups):
    """Print triangle counts per part, grouped by label, heaviest first (budget tuning aid)."""
    from .shapes import tri_count
    rows = []
    for label, objs in groups.items():
        for o in objs:
            rows.append((tri_count([o]), label, o.name))
    rows.sort(reverse=True)
    total = sum(r[0] for r in rows)
    print(f'[tris] total={total}')
    for t, label, name in rows[:80]:
        print(f'[tris] {t:5d} {label:10s} {name}')
    return total


def flat_poly(name, pts, axis='X', center=0.0, mats=None):
    """Single n-gon (zero thickness) in a coordinate plane; relies on glTF doubleSided materials."""
    bm = bmesh.new()
    vs = [bm.verts.new(_P(axis, u, v, center)) for u, v in _dedupe(list(pts))]
    bm.faces.new(vs)
    bm.normal_update()
    _uv_project(bm)
    obj = _link(bm, name)
    return finish(obj, mats or [], smooth=None)


def bounds(objs):
    """World-space (min, max) Vectors over the vertices of mesh objects."""
    bpy.context.view_layer.update()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    return lo, hi


def fit_y(objs, length, rigid=()):
    """Scale along Y about the footprint centre so the model is exactly `length` long and centred.

    Objects in `rigid` (wheels) are only moved, never squashed. Call BEFORE parenting.
    """
    lo, hi = bounds(objs)
    s = length / (hi.y - lo.y)
    mid = (lo.y + hi.y) / 2
    for o in objs:
        if o.type == 'MESH' and o not in rigid:
            o.data.transform(Matrix.Diagonal((1.0, s, 1.0, 1.0)))
            o.data.update()
        o.location.y = (o.location.y - mid) * s
    print(f'[fit_y] {hi.y - lo.y:.3f} m -> {length} m (s={s:.3f}, shift={-mid:.3f})')
    return s


def bake_location(objs):
    """Move static meshes' object offsets into their mesh data so their nodes sit exactly at the model origin."""
    for o in objs:
        if o.type == 'MESH' and o.location.length > 1e-6:
            o.data.transform(Matrix.Translation(o.location.copy()))
            o.data.update()
            o.location = (0.0, 0.0, 0.0)
