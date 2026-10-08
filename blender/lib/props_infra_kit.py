"""props_infra modelling kit: tri-efficient bmesh builders used by blender/assets/props_infra/*.py.

All builders return a mesh object whose mesh data is already in WORLD coordinates (object at the origin),
so parts can be joined / transformed freely. Profiles follow one rule: walk around the solid counter-clockwise
in its 2D plane (solid on the left) and normals come out pointing outward.

- lathe(): surface of revolution around +Z from an (r, z) profile; seg_mats colours profile segments.
- tube(): circle swept along a polyline (parallel-transport frames) for arms, braces, garlands, cables.
- extrude(): 2D polygon in a (u, v) plane pushed along u x v; cap_mat colours the two caps.
- shell(): open partial cylinder (no thickness) for visors/hoods; relies on double-sided materials.
- uv_quad(): flat quad with 0..1 UVs (u -> viewer's right, v -> up) for Sign_Face canvas targets.
"""
import math
import bpy
import bmesh
from mathutils import Matrix, Vector


def activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def _new_obj(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for m in mats:
        if m is not None:
            me.materials.append(m)
    return obj


def finish(obj, bevel=0.0, segments=1, smooth=40, limit=30):
    """Optional angle-limited bevel, then smooth-by-angle shading (edges sharper than `smooth` stay hard)."""
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(limit)
        mod.use_clamp_overlap = True
        mod.harden_normals = False
        activate(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    activate(obj)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    return obj


def lathe(name, profile, segs=12, loc=(0, 0, 0), material=None, seg_mats=None, mats=None,
          cap_bottom=True, cap_top=True, phase=0.0, sx=1.0, sy=1.0, smooth=55):
    """profile: [(r, z), ...] bottom -> outward -> up -> inward (r == 0 makes a pole vertex).

    seg_mats: per-profile-segment material index into `mats` (len = len(profile) - 1).
    sx/sy squash the revolution into an ellipse; phase rotates the ring (use pi/4 with segs=4 for squares).
    """
    bm = bmesh.new()
    ox, oy, oz = loc
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((ox, oy, oz + z))])
        else:
            ring = []
            for i in range(segs):
                a = phase + 2 * math.pi * i / segs
                ring.append(bm.verts.new((ox + r * math.cos(a) * sx, oy + r * math.sin(a) * sy, oz + z)))
            rings.append(ring)
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        mi = seg_mats[k] if seg_mats else 0
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(segs):
            j = (i + 1) % segs
            if len(a) == 1:
                f = bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                f = bm.faces.new((a[i], a[j], b[0]))
            else:
                f = bm.faces.new((a[i], a[j], b[j], b[i]))
            f.material_index = mi
    if cap_bottom and len(rings[0]) > 1:
        f = bm.faces.new(list(reversed(rings[0])))
        f.material_index = seg_mats[0] if seg_mats else 0
    if cap_top and len(rings[-1]) > 1:
        f = bm.faces.new(rings[-1])
        f.material_index = seg_mats[-1] if seg_mats else 0
    obj = _new_obj(name, bm, mats if mats else [material])
    return finish(obj, smooth=smooth)


def _frames(pts):
    tangents = []
    n = len(pts)
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
        tangents.append(t.normalized())
    t0 = tangents[0]
    ref = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    nrm = t0.cross(ref).normalized()
    frames = []
    for t in tangents:
        nrm = (nrm - t * nrm.dot(t)).normalized()
        frames.append((t, nrm, t.cross(nrm)))
    return frames


def tube(name, pts, r, segs=8, material=None, caps=True, radii=None, smooth=70):
    """Round tube swept along `pts` (list of xyz). `radii` overrides r per point (tapers)."""
    pts = [Vector(p) for p in pts]
    bm = bmesh.new()
    rings = []
    for i, (p, (t, nrm, bin_)) in enumerate(zip(pts, _frames(pts))):
        rr = radii[i] if radii else r
        rings.append([bm.verts.new(p + (nrm * math.cos(2 * math.pi * k / segs) + bin_ * math.sin(2 * math.pi * k / segs)) * rr)
                      for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    obj = _new_obj(name, bm, [material])
    return finish(obj, smooth=smooth)


def extrude(name, poly, depth, center=(0, 0, 0), u=(1, 0, 0), v=(0, 0, 1), material=None, cap_mat=None,
            bevel=0.0, segments=1, smooth=40, limit=30, back_cap=True):
    """2D polygon `poly` [(pu, pv)...] counter-clockwise as seen from the front (front normal = u x v),
    extruded `depth` symmetric about `center`. Default plane XZ -> front faces -Y.
    cap_mat: optional material for the two caps (index 1)."""
    U, V = Vector(u).normalized(), Vector(v).normalized()
    N = U.cross(V).normalized()
    C = Vector(center)
    bm = bmesh.new()
    front = [bm.verts.new(C + U * pu + V * pv + N * depth / 2) for pu, pv in poly]
    back = [bm.verts.new(C + U * pu + V * pv - N * depth / 2) for pu, pv in poly]
    f = bm.faces.new(front)
    f.material_index = 1 if cap_mat else 0
    if back_cap:
        f = bm.faces.new(list(reversed(back)))
        f.material_index = 1 if cap_mat else 0
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], back[i], back[j], front[j]))
    mats = [material, cap_mat] if cap_mat else [material]
    obj = _new_obj(name, bm, mats)
    return finish(obj, bevel=bevel, segments=segments, smooth=smooth, limit=limit)


def shell(name, radius, length, a0, a1, segs=6, center=(0, 0, 0), axis=(0, -1, 0), up=(0, 0, 1), material=None):
    """Open partial cylinder surface (visor / hood). Angles in degrees measured in the plane normal to `axis`,
    0 deg = right of the viewer looking along -axis, 90 deg = `up`. Starts at `center`, extends `length` along axis."""
    A = Vector(axis).normalized()
    Up = Vector(up).normalized()
    R = Up.cross(A).normalized()  # viewer's right when looking back along -axis
    C = Vector(center)
    bm = bmesh.new()
    rows = []
    for d in (0.0, length):
        row = []
        for k in range(segs + 1):
            a = math.radians(a0 + (a1 - a0) * k / segs)
            row.append(bm.verts.new(C + A * d + (R * math.cos(a) + Up * math.sin(a)) * radius))
        rows.append(row)
    for k in range(segs):
        bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _new_obj(name, bm, [material])
    return finish(obj, smooth=70)


def uv_quad(name, w, h, center, material, facing='-Y'):
    """Flat quad, UV (0,0) bottom-left .. (1,1) top-right as seen by a viewer facing it."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    verts = [bm.verts.new((x, 0, z)) for x, z in corners]
    f = bm.faces.new(verts)
    for loop, (cu, cv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = (cu, cv)
    obj = _new_obj(name, bm, [material])
    rot = {'-Y': 0.0, '+Y': math.pi, '-X': -math.pi / 2, '+X': math.pi / 2}[facing]
    obj.data.transform(Matrix.Translation(center) @ Matrix.Rotation(rot, 4, 'Z'))
    obj.data.update()
    return obj


def bake(obj, M=None):
    """Bake object transform (optionally pre-multiplied by M) into the mesh so the object sits at identity."""
    if M is not None:
        obj.matrix_world = M @ obj.matrix_world
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def drop_faces(obj, pred):
    """Delete faces where pred(center: Vector, normal: Vector) is True (hidden bottoms / buried caps)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    kill = [f for f in bm.faces if pred(f.calc_center_median(), f.normal)]
    bmesh.ops.delete(bm, geom=kill, context='FACES_ONLY')
    bm.transform(obj.matrix_world.inverted())
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return len(kill)


def ground_cull(obj, z=0.002):
    """Remove downward faces lying on the ground plane (never visible)."""
    return drop_faces(obj, lambda c, n: c.z < z and n.z < -0.9)


def catenary(p0, p1, sag, n=6):
    """Points of a hanging curve between p0 and p1 dipping `sag` metres at mid-span."""
    a, b = Vector(p0), Vector(p1)
    return [tuple(a.lerp(b, i / n) - Vector((0, 0, sag * 4 * (i / n) * (1 - i / n)))) for i in range(n + 1)]


def arc(cx, cy, r, a0, a1, n):
    """2D arc points (degrees, counter-clockwise from a0 to a1)."""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def recolor(material, hex_or_key_rgba, strength=None):
    """Adjust a material after mat(): set a different base colour (rgba linear) and optional emission strength."""
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hex_or_key_rgba
    material.diffuse_color = hex_or_key_rgba
    if strength is not None:
        bsdf.inputs['Emission Strength'].default_value = strength
    return material


def report(parts, label=''):
    """Print triangles per part (largest first) to steer the per-asset budget."""
    rows = []
    for o in parts:
        if o is None or o.type != 'MESH':
            continue
        o.data.calc_loop_triangles()
        rows.append((len(o.data.loop_triangles), o.name))
    rows.sort(reverse=True)
    print(f'[tris] {label} total={sum(t for t, _ in rows)} :: ' + ', '.join(f'{n}={t}' for t, n in rows))
