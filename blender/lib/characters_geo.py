"""Organic low-poly builders for the characters group (rounded toy shapes, outward-wound faces).

All builders return a linked mesh object in WORLD space with smooth shading; `smooth_angle`
(degrees) re-introduces crisp edges where the toon look needs them (bands, plates).
"""
import math
import bpy
from mathutils import Vector, Matrix, Euler


def _activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def make_obj(name, verts, faces, mats, face_mats=None, smooth_angle=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    for m in mats:
        me.materials.append(m)
    if face_mats:
        for poly, mi in zip(me.polygons, face_mats):
            poly.material_index = mi
    me.validate()
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    smooth(obj, smooth_angle)
    return obj


def smooth(obj, angle=None):
    obj.data.shade_smooth()
    if angle is not None:
        _activate(obj)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle), keep_sharp_edges=True)
    return obj


def _ring(z, rx, ry, cy=0.0, cx=0.0, segs=12):
    return [Vector((cx + rx * math.sin(2 * math.pi * k / segs), cy - ry * math.cos(2 * math.pi * k / segs), z))
            for k in range(segs)]


def loft(name, rings, segs, mats, band_mats=None, cap_bottom=True, cap_top=True, vfn=None, smooth_angle=None):
    """Stack of ellipse rings along +Z. ring = (z, rx, ry[, cy[, cx]]); rx=ry=0 -> pole vertex.
    k=0 is the front (-Y), k increases towards model LEFT (+X). band_mats[i] = material index between ring i, i+1.
    vfn(v, ring_index, k) -> Vector lets callers sculpt (V-necks, drapes)."""
    verts, faces, fm, idx = [], [], [], []
    for ri, r in enumerate(rings):
        z, rx, ry = r[0], r[1], r[2]
        cy = r[3] if len(r) > 3 else 0.0
        cx = r[4] if len(r) > 4 else 0.0
        if rx == 0 and ry == 0:
            pts = [Vector((cx, cy, z))]
        else:
            pts = _ring(z, rx, ry, cy, cx, segs)
        if vfn:
            pts = [vfn(p, ri, k) for k, p in enumerate(pts)]
        idx.append(list(range(len(verts), len(verts) + len(pts))))
        verts += pts
    for i in range(len(rings) - 1):
        a, b = idx[i], idx[i + 1]
        mi = band_mats[i] if band_mats else 0
        for k in range(segs):
            k1 = (k + 1) % segs
            if len(a) == 1:
                faces.append((a[0], b[k1], b[k]))
            elif len(b) == 1:
                faces.append((a[k], a[k1], b[0]))
            else:
                faces.append((a[k], a[k1], b[k1], b[k]))
            fm.append(mi)
    if cap_bottom and len(idx[0]) > 1:
        faces.append(tuple(reversed(idx[0])))
        fm.append(band_mats[0] if band_mats else 0)
    if cap_top and len(idx[-1]) > 1:
        faces.append(tuple(idx[-1]))
        fm.append(band_mats[-1] if band_mats else 0)
    return make_obj(name, verts, faces, mats, fm, smooth_angle)


def shell(name, lats, segs, mats, point_fn, pole_top=True, pole_bottom=False, keep=None, face_mat=None,
          smooth_angle=None):
    """UV-sphere-like shell. lats: list (top->bottom) of degrees or callables lat(lon_deg).
    point_fn(lon_deg, lat_deg, ring_index) -> Vector. keep(ring_i, k) -> bool drops quads (openings).
    face_mat(ring_i, k) -> material index."""
    verts, faces, fm, idx = [], [], [], []
    rows = []
    if pole_top:
        rows.append(('pole', 90.0))
    rows += [('ring', la) for la in lats]
    if pole_bottom:
        rows.append(('pole', -90.0))
    for ri, (kind, la) in enumerate(rows):
        if kind == 'pole':
            pts = [point_fn(0.0, la, ri)]
        else:
            pts = []
            for k in range(segs):
                lon = 360.0 * k / segs
                lon = lon - 360.0 if lon > 180.0 else lon
                lat = la(lon) if callable(la) else la
                pts.append(point_fn(lon, lat, ri))
        idx.append(list(range(len(verts), len(verts) + len(pts))))
        verts += pts
    for i in range(len(rows) - 1):
        up, lo = idx[i], idx[i + 1]
        for k in range(segs):
            if keep is not None and not keep(i, k):
                continue
            k1 = (k + 1) % segs
            if len(up) == 1:
                faces.append((lo[k], lo[k1], up[0]))
            elif len(lo) == 1:
                faces.append((lo[0], up[k1], up[k]))
            else:
                faces.append((lo[k], lo[k1], up[k1], up[k]))
            fm.append(face_mat(i, k) if face_mat else 0)
    obj = make_obj(name, verts, faces, mats, fm, smooth_angle)
    _drop_loose(obj)
    return obj


def _drop_loose(obj):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
        bm.to_mesh(obj.data)
    bm.free()


def ellipsoid(name, center, radii, mat, segs=12, rings=8, rot=(0, 0, 0)):
    c, r = Vector(center), Vector(radii)
    rm = rot.to_3x3() if isinstance(rot, Matrix) else Euler(rot).to_matrix()
    lats = [90.0 - 180.0 * i / rings for i in range(1, rings)]

    def pf(lon, lat, _ri):
        lo, la = math.radians(lon), math.radians(lat)
        p = Vector((r.x * math.cos(la) * math.sin(lo), -r.y * math.cos(la) * math.cos(lo), r.z * math.sin(la)))
        return c + rm @ p
    return shell(name, lats, segs, [mat], pf, pole_top=True, pole_bottom=True)


def _frames(pts, closed, normals=None, up=(0, 0, 1)):
    n_pts = len(pts)
    out = []
    for i in range(n_pts):
        if closed:
            t = pts[(i + 1) % n_pts] - pts[i - 1]
        else:
            t = pts[min(i + 1, n_pts - 1)] - pts[max(i - 1, 0)]
        t.normalize()
        ref = Vector(normals[i]) if normals else Vector(up)
        n = ref - t * ref.dot(t)
        if n.length < 1e-6:
            n = Vector((1, 0, 0)) - t * t.x
        n.normalize()
        out.append((t, n, t.cross(n)))
    return out


def _sweep(name, pts, profile, closed, caps, mats, normals=None, up=(0, 0, 1), smooth_angle=None):
    """profile(i, n, b) -> list of ring offsets (ordered n -> b -> -n -> -b)."""
    pts = [Vector(p) for p in pts]
    fr = _frames(pts, closed, normals, up)
    verts, faces, idx = [], [], []
    for i, p in enumerate(pts):
        t, n, b = fr[i]
        ring = [p + o for o in profile(i, n, b)]
        idx.append(list(range(len(verts), len(verts) + len(ring))))
        verts += ring
    m = len(idx[0])
    seg_count = len(pts) if closed else len(pts) - 1
    for i in range(seg_count):
        a, c = idx[i], idx[(i + 1) % len(pts)]
        for k in range(m):
            k1 = (k + 1) % m
            faces.append((a[k], a[k1], c[k1], c[k]))
    if caps and not closed:
        faces.append(tuple(reversed(idx[0])))
        faces.append(tuple(idx[-1]))
    return make_obj(name, verts, faces, mats, None, smooth_angle)


def tube(name, pts, radius, mat, segs=6, closed=False, caps=True, up=(0, 0, 1), smooth_angle=None):
    """Round tube along a polyline. radius: float or list per point."""
    radii = radius if isinstance(radius, (list, tuple)) else [radius] * len(pts)

    def prof(i, n, b):
        return [(n * math.cos(2 * math.pi * k / segs) + b * math.sin(2 * math.pi * k / segs)) * radii[i]
                for k in range(segs)]
    return _sweep(name, pts, prof, closed, caps, [mat], up=up, smooth_angle=smooth_angle)


def band(name, pts, normals, width, thickness, mat, closed=False, lift=0.0, smooth_angle=35):
    """Flat strip lying on a surface (stripes, straps, piping). normals = surface normals per point."""
    widths = width if isinstance(width, (list, tuple)) else [width] * len(pts)

    def prof(i, n, b):
        w = widths[i] * 0.5
        o, inn = n * (lift + thickness), n * lift
        return [o - b * w, o + b * w, inn + b * w, inn - b * w]
    return _sweep(name, pts, prof, closed, True, [mat], normals=normals, smooth_angle=smooth_angle)


def solidify(obj, thickness, offset=-1.0, mat_offset=0, rim_offset=0):
    mod = obj.modifiers.new('Solidify', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = offset
    mod.use_even_offset = True
    mod.use_rim = True
    mod.material_offset = mat_offset
    mod.material_offset_rim = rim_offset
    _activate(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def text_mesh(name, body, size, depth, loc, rot, mat, resolution=2, bold=0.0):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = depth
    cu.offset = bold
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.resolution_u = resolution
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    _activate(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.active_object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return smooth(obj, 30)


def transform(obj, matrix):
    obj.data.transform(matrix, shape_keys=bool(obj.data.shape_keys))
    obj.data.update()
    return obj


def rotate_about(obj, pivot, euler):
    p = Vector(pivot)
    return transform(obj, Matrix.Translation(p) @ Euler(euler).to_matrix().to_4x4() @ Matrix.Translation(-p))


def to_pivot(obj, pivot):
    """Re-express world-space mesh data relative to `pivot` and put the object AT the pivot."""
    p = Vector(pivot)
    transform(obj, Matrix.Translation(-p))
    obj.location = p
    bpy.context.view_layer.update()
    return obj


def parent_keep(child, parent):
    """Parent keeping the world transform (forces a depsgraph update first so matrix_world is fresh)."""
    bpy.context.view_layer.update()
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse.identity()
    child.matrix_world = mw
    bpy.context.view_layer.update()
    return child


def at_zero(obj, pivot):
    """Attachment export: mesh data relative to `pivot`, object at the origin (zero-offset parenting)."""
    to_pivot(obj, pivot)
    obj.location = (0, 0, 0)
    return obj


def frame_matrix(z_axis, y_hint):
    """3x3 rotation whose local Z = z_axis and local Y ~ y_hint (orthogonalised)."""
    z = Vector(z_axis).normalized()
    y = Vector(y_hint) - z * Vector(y_hint).dot(z)
    y.normalize()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


def tuft(name, root, tip, width, thick, mat, out, segs=6, profile=(0.75, 1.0, 0.8, 0.45)):
    """Teardrop hair lock from `root` to `tip`; `out` = outward direction (thickness axis -Y faces it)."""
    root, tip = Vector(root), Vector(tip)
    length = (tip - root).length
    n = len(profile)
    rings = [(-0.06 * length, 0, 0)]
    for i, s in enumerate(profile):
        rings.append((length * (i + 0.5) / (n + 0.5), width * 0.5 * s, thick * 0.5 * s))
    rings.append((length, 0, 0))
    obj = loft(name, rings, segs, [mat])
    rm = frame_matrix(tip - root, -Vector(out))
    transform(obj, Matrix.Translation(root) @ rm.to_4x4())
    return obj
