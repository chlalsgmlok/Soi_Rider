"""vehicles_cars kit: bmesh primitives + mesh finishing for chunky toy cars.

All builders add geometry to a caller-owned bmesh in WORLD space (metres, Blender Z-up,
vehicle faces -Y so its LEFT is +X). `Mats` keeps one shared material-slot list so every
piece can be joined later without slot juggling.
"""
import math
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector


class Mats:
    """Ordered material slots shared by every mesh object of one vehicle."""

    def __init__(self, entries):
        self.keys = [k for k, _ in entries]
        self.by_key = dict(entries)

    def idx(self, key):
        return self.keys.index(key)

    def __getitem__(self, key):
        return self.keys.index(key)

    def obj(self, name, bm, origin=(0.0, 0.0, 0.0)):
        """Turn a bmesh into a linked object whose pivot sits at `origin` (world)."""
        o = Vector(origin)
        if o.length > 0:
            bmesh.ops.translate(bm, vec=-o, verts=bm.verts)
        me = bpy.data.meshes.new(name)
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        for k in self.keys:
            me.materials.append(self.by_key[k])
        ob = bpy.data.objects.new(name, me)
        ob.location = o
        bpy.context.scene.collection.objects.link(ob)
        return ob


# ---------------------------------------------------------------- transforms
def rot_matrix(rot):
    if rot is None:
        return Matrix.Identity(3)
    if isinstance(rot, Matrix):
        return rot.to_3x3()
    return Euler(rot, 'XYZ').to_matrix()


def frame_from_normal(n, up=(0.0, 0.0, 1.0)):
    """3x3 rotation mapping local -Y onto normal `n`, local +Z towards `up`."""
    n = Vector(n).normalized()
    u = Vector(up)
    if abs(u.dot(n)) > 0.98:
        u = Vector((0.0, 1.0, 0.0)) if abs(n.z) > 0.9 else Vector((0.0, 0.0, 1.0))
    y_axis = -n
    z_axis = (u - u.dot(n) * n).normalized()
    x_axis = y_axis.cross(z_axis).normalized()
    return Matrix((x_axis, y_axis, z_axis)).transposed()


def xform_verts(bm, verts, loc=(0, 0, 0), rot=None):
    m = Matrix.Translation(Vector(loc)) @ rot_matrix(rot).to_4x4()
    bmesh.ops.transform(bm, matrix=m, verts=list(verts))


def set_mat(faces, idx):
    for f in faces:
        f.material_index = idx


# ---------------------------------------------------------------- primitives
def rbox(bm, size, center=(0, 0, 0), radius=0.03, segs=2, mat=0, rot=None, top=(1.0, 1.0),
         front=(1.0, 1.0)):
    """Rounded box. `top` scales the +Z cap (x, y), `front` scales the -Y cap (x, z) for wedges/domes."""
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res['verts']
    sx, sy, sz = size
    for v in verts:
        x, y, z = v.co.x * sx, v.co.y * sy, v.co.z * sz
        if z > 0:
            x *= top[0]
            y *= top[1]
        if y < 0:
            x *= front[0]
            z *= front[1]
        v.co = Vector((x, y, z))
    faces = {f for v in verts for f in v.link_faces}
    set_mat(faces, mat)
    xform_verts(bm, verts, center, rot)
    r = min(radius, min(size) * 0.48)
    if r > 1e-4 and segs > 0:
        edges = list({e for v in verts for e in v.link_edges})
        res = bmesh.ops.bevel(bm, geom=edges, offset=r, offset_type='OFFSET', segments=segs, profile=0.5,
                              affect='EDGES', clamp_overlap=True)
        set_mat(res['faces'], mat)
    return verts


def cylinder(bm, radius, depth, center=(0, 0, 0), rot=None, segs=10, mat=0, bevel=0.0, bsegs=1, r2=None):
    """Closed cylinder/cone along local Z."""
    res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radius,
                                radius2=radius if r2 is None else r2, depth=depth)
    verts = res['verts']
    set_mat({f for v in verts for f in v.link_faces}, mat)
    xform_verts(bm, verts, center, rot)
    if bevel > 0:
        edges = [e for e in {e for v in verts for e in v.link_edges}
                 if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(50)]
        res = bmesh.ops.bevel(bm, geom=edges, offset=bevel, offset_type='OFFSET', segments=bsegs, profile=0.5,
                              affect='EDGES', clamp_overlap=True)
        set_mat(res['faces'], mat)
    return verts


def lathe_x(bm, profile, segs, mats, center=(0, 0, 0), flip=False):
    """Surface of revolution around the X axis. profile = [(r, x), ...]; mats[k] for band k.

    Bands face outward when the profile runs from -x to +x over the top (see wheel()).
    flip=True mirrors x (for right-side wheels) and keeps faces outward.
    """
    sgn = -1.0 if flip else 1.0
    c = Vector(center)
    rings = []
    for r, x in profile:
        if r < 1e-6:
            rings.append([bm.verts.new(c + Vector((sgn * x, 0.0, 0.0)))])
        else:
            ring = []
            for i in range(segs):
                a = 2 * math.pi * (i + 0.5) / segs
                ring.append(bm.verts.new(c + Vector((sgn * x, r * math.cos(a), r * math.sin(a)))))
            rings.append(ring)
    faces = []
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        for i in range(segs):
            j = (i + 1) % segs
            if len(A) == 1:
                vs = (A[0], B[i], B[j])
            elif len(B) == 1:
                vs = (A[i], A[j], B[0])
            else:
                vs = (A[i], A[j], B[j], B[i])
            if flip:
                vs = tuple(reversed(vs))
            f = bm.faces.new(vs)
            f.material_index = mats[min(k, len(mats) - 1)]
            faces.append(f)
    return faces


def signed_area(pts):
    n = len(pts)
    return 0.5 * sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))


def fillet(corners, max_step_deg=22.0):
    """Closed polygon [(y, z, r), ...] -> points with corner r replaced by a tangent arc.

    Arc steps stay below the bevel threshold so profile curvature is smooth-shaded, not beveled
    (bmesh bevel clamps globally on short segments, so big radii must live in the profile).
    """
    n = len(corners)
    out = []
    for i in range(n):
        py, pz = corners[i][0], corners[i][1]
        r = corners[i][2] if len(corners[i]) > 2 else 0.0
        P = Vector((py, pz))
        if r <= 0:
            out.append((py, pz))
            continue
        A = Vector(corners[i - 1][:2])
        B = Vector(corners[(i + 1) % n][:2])
        u = A - P
        v = B - P
        la, lb = u.length, v.length
        u.normalize()
        v.normalize()
        theta = math.acos(max(-1.0, min(1.0, u.dot(v))))
        if theta < 1e-3 or theta > math.pi - 1e-3:
            out.append((py, pz))
            continue
        t = r / math.tan(theta / 2)
        t_max = 0.48 * min(la, lb)
        if t > t_max:
            t = t_max
            r = t * math.tan(theta / 2)
        T1 = P + u * t
        T2 = P + v * t
        C = P + (u + v).normalized() * (r / math.sin(theta / 2))
        a1 = math.atan2(T1.y - C.y, T1.x - C.x)
        a2 = math.atan2(T2.y - C.y, T2.x - C.x)
        da = a2 - a1
        while da > math.pi:
            da -= 2 * math.pi
        while da < -math.pi:
            da += 2 * math.pi
        steps = max(1, math.ceil(abs(math.degrees(da)) / max_step_deg))
        for k in range(steps + 1):
            a = a1 + da * k / steps
            out.append((C.x + r * math.cos(a), C.y + r * math.sin(a)))
    return out


def prism(bm, profile, half_w, mat=0):
    """Extrude a side profile [(y, z), ...] across x = -half_w..+half_w (closed, outward normals)."""
    pts = list(profile)
    if signed_area(pts) < 0:
        pts.reverse()
    L = [bm.verts.new((half_w, y, z)) for y, z in pts]
    R = [bm.verts.new((-half_w, y, z)) for y, z in pts]
    faces = [bm.faces.new(L), bm.faces.new(list(reversed(R)))]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((L[i], L[j], R[j], R[i])))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    set_mat(faces, mat)
    return faces


def arch_points(ya, za, ra, z_sill, n=9):
    """Wheel-arch notch for a profile bottom edge running front(-y) -> rear(+y)."""
    a = math.asin(max(-1.0, min(1.0, (z_sill - za) / ra)))
    t0, t1 = math.pi - a, a
    return [(ya + ra * math.cos(t0 + (t1 - t0) * i / (n - 1)), za + ra * math.sin(t0 + (t1 - t0) * i / (n - 1)))
            for i in range(n)]


def bisect(bm, co, no):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=Vector(co), plane_no=Vector(no))


def round_plan(bm, y_front, y_rear, reach, inset, cuts=(0.06, 0.16, 0.3, 0.48, 0.7, 1.0)):
    """Pull the nose/tail corners in (quadratic ease) so the car reads rounded from above."""
    for c in cuts:
        bisect(bm, (0, y_front + c * reach, 0), (0, 1, 0))
        bisect(bm, (0, y_rear - c * reach, 0), (0, 1, 0))
    for v in bm.verts:
        d = min(v.co.y - y_front, y_rear - v.co.y)
        if d < reach and abs(v.co.x) > 1e-4:
            t = 1.0 - max(0.0, d) / reach
            v.co.x -= math.copysign(inset * t * t, v.co.x)


def taper_z(bm, z0, z1, scale):
    for v in bm.verts:
        if v.co.z > z0:
            t = min(1.0, (v.co.z - z0) / (z1 - z0))
            v.co.x *= 1.0 - (1.0 - scale) * t


def bevel_sharp(bm, offset, segs=3, min_deg=28.0, skip=None, clamp=False):
    """Bevel edges sharper than min_deg. clamp=False on purpose: bmesh clamps GLOBALLY (a single short
    edge shrinks every bevel to ~1 cm), so shells are designed with room for the full offset instead."""
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(min_deg)
             and not (skip and skip(e))]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=offset, offset_type='OFFSET', segments=segs, profile=0.5,
                        affect='EDGES', clamp_overlap=clamp)


def ribbon(bm, pts, nors, half_w, lift=0.005, mat=0):
    """Thin quad ribbon lying on a surface (panel seams, pinstripes). pts/nors are world Vectors."""
    left, right = [], []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        t = (b - a).normalized()
        n = nors[i].normalized()
        side = n.cross(t).normalized()
        base = p + n * lift
        left.append(bm.verts.new(base + side * half_w))
        right.append(bm.verts.new(base - side * half_w))
    faces = []
    for i in range(len(pts) - 1):
        f = bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
        f.normal_update()
        if f.normal.dot(nors[i]) < 0:
            f.normal_flip()
        f.material_index = mat
        faces.append(f)
    return faces


def quad(bm, center, normal, w, h, mat=0, up=(0, 0, 1), lift=0.0):
    """Single-sided flat rectangle facing `normal` (plate text, stickers, reflectors)."""
    rot = frame_from_normal(normal, up)
    c = Vector(center) + Vector(normal).normalized() * lift
    ex = rot @ Vector((w / 2, 0, 0))
    ez = rot @ Vector((0, 0, h / 2))
    vs = [bm.verts.new(c - ex - ez), bm.verts.new(c + ex - ez), bm.verts.new(c + ex + ez), bm.verts.new(c - ex + ez)]
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.dot(Vector(normal)) < 0:
        f.normal_flip()
    f.material_index = mat
    return f


# ---------------------------------------------------------------- finishing
def _activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


# Flat panes (glossy glass shows every triangulation diagonal if its normals get averaged with the frame).
FLAT_MATERIALS = ('Glass',)


def finish(obj, sharp_deg=48.0, weighted=True):
    """Smooth shading with sharp edges by angle + face-area weighted normals (flat faces stay flat)."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    limit = math.radians(sharp_deg)
    flat = {i for i, m in enumerate(me.materials) if m is not None and m.name in FLAT_MATERIALS}
    for f in bm.faces:
        f.smooth = f.material_index not in flat
    for e in bm.edges:
        if len(e.link_faces) != 2:
            e.smooth = False
        else:
            a, b = (f.material_index for f in e.link_faces)
            e.smooth = e.calc_face_angle(math.pi) < limit and not ((a in flat) != (b in flat))
    bm.to_mesh(me)
    bm.free()
    if weighted:
        _activate(obj)
        mod = obj.modifiers.new('WN', 'WEIGHTED_NORMAL')
        mod.mode = 'FACE_AREA'
        mod.weight = 50
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def prune_slots(obj):
    _activate(obj)
    bpy.ops.object.material_slot_remove_unused()
    return obj


def join_objs(objs, name):
    objs = [o for o in objs if o is not None]
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob
