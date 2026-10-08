"""Geometry kit for the `buildings` group (architecture-friendly helpers on top of lib.shapes).

Conventions (docs/ASSET_SPEC.md): Blender Z-up, metres, facade faces -Y, origin = bottom-centre of the facade line
(facade plane y=0, the building body extends to +Y, street furniture such as awnings/signs protrudes into -Y).
Everything static is joined into one `body` mesh per asset; only runtime nodes (signboard / screen) stay separate.
"""
import math
import bpy
import bmesh
from mathutils import Vector

from lib.palette import mat
from lib.shapes import box, cyl, join, empty, set_parent, tri_count


# ----------------------------------------------------------------------------------------------- materials
def materials(**overrides):
    """Contract + fixed materials used by buildings. `overrides` maps a key to a palette key / hex for the default
    colour of the recolourable contract materials (Wall, Wall2, Trim, Awning_A, Awning_B, Shutter, Paint, Paint2)."""
    c = {
        'wall': 'wall_cream', 'wall2': 'wall_salmon', 'trim': 'trim_white', 'awn_a': 'awning_red',
        'awn_b': 'trim_white', 'shutter': 'shutter', 'paint': 'taxi_green', 'paint2': 'taxi_orange',
        'window': '#5F8FAE',
    }
    c.update(overrides)
    return {
        'wall': mat('Wall', c['wall'], roughness=0.8),
        'wall2': mat('Wall2', c['wall2'], roughness=0.75),
        'trim': mat('Trim', c['trim'], roughness=0.6),
        'window': mat('Window', c['window'], roughness=0.18),
        'shutter': mat('Shutter', c['shutter'], roughness=0.45, metallic=0.35),
        'awn_a': mat('Awning_A', c['awn_a'], roughness=0.7),
        'awn_b': mat('Awning_B', c['awn_b'], roughness=0.7),
        'sign': mat('Sign_Face', 'cream', roughness=0.5),
        'interior': mat('Interior_Light', 'sun', roughness=0.8, emission=2.4),
        'lamp': mat('Lamp_Glow', 'light_head', roughness=0.3, emission=3.0),
        'glass': mat('Glass', 'glass_light', roughness=0.08, metallic=0.1),
        'chrome': mat('Chrome', 'chrome', roughness=0.22, metallic=0.85),
        'leaf': mat('Leaf', 'leaf', roughness=0.7),
        'flower': mat('Flower', 'bougainvillea', roughness=0.6),
        'paint': mat('Paint', c['paint'], roughness=0.5),
        'paint2': mat('Paint2', c['paint2'], roughness=0.5),
        # fixed (non-contract) colours
        'roof': mat('Bld_Roof', 'concrete', roughness=0.9),
        'metal': mat('Bld_Metal', 'metal_dark', roughness=0.45, metallic=0.5),
        'ac': mat('Bld_AC', 'van_white', roughness=0.5),
        'wood': mat('Bld_Wood', 'wood', roughness=0.7),
        'wood_l': mat('Bld_WoodLight', 'wood_light', roughness=0.7),
        'floor': mat('Bld_Floor', 'curb_white', roughness=0.6),
        'pot': mat('Bld_Pot', 'pot_terracotta', roughness=0.8),
        'sheet': mat('Bld_RoofSheet', 'roof_terracotta', roughness=0.6, metallic=0.2),
        'dark': mat('Bld_Dark', 'ink', roughness=0.8),
        'goods1': mat('Bld_Goods1', 'neon_yellow', roughness=0.6),
        'goods2': mat('Bld_Goods2', 'awning_blue', roughness=0.6),
        'steel': mat('Bld_Steel', 'car_silver', roughness=0.3, metallic=0.25),
        'curtain': mat('Bld_Curtain', 'cream', roughness=0.85),
    }


# ----------------------------------------------------------------------------------------------- object finish
def _activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def finish(obj, bevel=0.0, segments=1, smooth_angle=35, recalc=True):
    """Optional angle-limited bevel + smooth-by-angle shading (same look as lib.shapes)."""
    if recalc:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(50)
        _activate(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    _activate(obj)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    return obj


def mesh_obj(name, verts, faces, mats, face_mat=None, uvs=None):
    """Raw mesh. `mats` list of materials; `face_mat` per-face index list (default 0). `uvs` per-face loop uvs."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    for m in mats:
        me.materials.append(m)
    if face_mat:
        for p, i in zip(me.polygons, face_mat):
            p.material_index = i
    layer = me.uv_layers.new(name='UVMap')
    if uvs:
        for p, fuv in zip(me.polygons, uvs):
            for li, uv in zip(p.loop_indices, fuv):
                layer.data[li].uv = uv
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ----------------------------------------------------------------------------------------------- primitives
def bx(name, x0, x1, y0, y1, z0, z1, material, bevel=0.03, seg=1):
    """Box by extents (architects think in extents, not centres)."""
    size = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    loc = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    return box(name, size, loc, material, bevel=bevel, segments=seg)


def prism(name, profile, a0, a1, axis, material, bevel=0.0, seg=1, smooth=35, face_mats=None, mats=None):
    """Extrude a closed 2D `profile` [(u,v),...] between a0..a1 along `axis`.

    axis 'X': (u,v)=(y,z); 'Y': (u,v)=(x,z); 'Z': (u,v)=(x,y). Caps are n-gons (glTF triangulates them)."""
    n = len(profile)

    def P(a, u, v):
        if axis == 'X':
            return (a, u, v)
        if axis == 'Y':
            return (u, a, v)
        return (u, v, a)
    verts = [P(a0, u, v) for u, v in profile] + [P(a1, u, v) for u, v in profile]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    obj = mesh_obj(name, verts, faces, mats or [material], face_mats)
    return finish(obj, bevel, seg, smooth)


def quad_uv(name, x0, x1, z0, z1, y, material):
    """Flat quad facing -Y (street) with UV 0..1 (u → +X = viewer's right, v → +Z). Runtime canvas target."""
    verts = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    obj = mesh_obj(name, verts, [(0, 1, 2, 3)], [material], uvs=[[(0, 0), (1, 0), (1, 1), (0, 1)]])
    _activate(obj)
    return obj


def quad_x(name, y0, y1, z0, z1, x, material, facing=1):
    """Flat quad in a YZ plane facing +X (facing=1) or -X (facing=-1), UV 0..1 left-to-right as seen by the viewer."""
    if facing > 0:   # viewer at +X: right hand = +Y
        verts = [(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)]
    else:            # viewer at -X: right hand = -Y
        verts = [(x, y1, z0), (x, y0, z0), (x, y0, z1), (x, y1, z1)]
    return mesh_obj(name, verts, [(0, 1, 2, 3)], [material], uvs=[[(0, 0), (1, 0), (1, 1), (0, 1)]])


def frame_ring(name, x0, x1, z0, z1, y0, y1, t, material, bevel=0.0):
    """Rectangular picture-frame ring (outer x0..x1/z0..z1, bar thickness t) between y0 (front) .. y1 (wall).
    The wall-side face is dropped; only the front outer/inner rims are bevelled (cheap chunky highlight)."""
    o = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    i = [(x0 + t, z0 + t), (x1 - t, z0 + t), (x1 - t, z1 - t), (x0 + t, z1 - t)]
    verts = [(x, y0, z) for x, z in o] + [(x, y0, z) for x, z in i] + [(x, y1, z) for x, z in o] + [(x, y1, z) for x, z in i]
    faces = []
    for k in range(4):
        n = (k + 1) % 4
        faces.append([k, n, 4 + n, 4 + k])            # front
        faces.append([k, 8 + k, 8 + n, n])            # outer side
        faces.append([4 + k, 4 + n, 12 + n, 12 + k])  # inner side
    obj = mesh_obj(name, verts, faces, [material])  # windings above are outward-correct (front faces -Y)
    if bevel > 0:
        _bevel_where(obj, lambda e: all(abs(v.co.y - y0) < 1e-5 for v in e.verts), bevel, 1)
    return finish(obj, 0, 1, 35, recalc=False)


def _bevel_where(obj, pred, width, seg):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edges = [e for e in bm.edges if pred(e)]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type='OFFSET', segments=seg, profile=0.5,
                        affect='EDGES', clamp_overlap=True)
    bm.to_mesh(obj.data)
    bm.free()


_FACE_AXES = {'-x': (0, -1), '+x': (0, 1), '-y': (1, -1), '+y': (1, 1), '-z': (2, -1), '+z': (2, 1)}


def rbx(name, x0, x1, y0, y1, z0, z1, material, bevel=0.03, seg=1, open=('+y',), flat=()):
    """Box by extents with hidden faces removed (`open`: '+y' = wall side, '-z' = floor side ...) and only the
    exposed edges bevelled. Same look as bx() for a fraction of the triangles on wall-mounted parts.
    `flat` faces are kept but their edges stay sharp (segment ends that must tile seamlessly)."""
    lo = (min(x0, x1), min(y0, y1), min(z0, z1))
    hi = (max(x0, x1), max(y0, y1), max(z0, z1))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(tuple(hi[i] if v.co[i] > 0 else lo[i] for i in range(3)))
    bm.normal_update()

    def on_open_plane(f, keys=None):
        for key in (open if keys is None else keys):
            ax, sg = _FACE_AXES[key]
            plane = hi[ax] if sg > 0 else lo[ax]
            if f.normal[ax] * sg > 0.9 and all(abs(v.co[ax] - plane) < 1e-5 for v in f.verts):
                return True
        return False
    bw = min(bevel, min(hi[i] - lo[i] for i in range(3)) * 0.45)
    if bw > 0:
        open_faces = [f for f in bm.faces if on_open_plane(f, tuple(open) + tuple(flat))]
        skip = set(e for f in open_faces for e in f.edges)
        edges = [e for e in bm.edges if e not in skip]
        bmesh.ops.bevel(bm, geom=edges, offset=bw, offset_type='OFFSET', segments=seg, profile=0.5,
                        affect='EDGES', clamp_overlap=True)
        bm.normal_update()
    dead = [f for f in bm.faces if on_open_plane(f)]
    bmesh.ops.delete(bm, geom=dead, context='FACES_ONLY')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    me.uv_layers.new(name='UVMap')
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return finish(obj, 0, 1, 35, recalc=False)


def rod(name, p0, p1, r, material, verts=6):
    """Cylinder between two points."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    obj = cyl(name, r, d.length, (a + b) / 2, material, verts=verts, bevel=0)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = d.normalized().to_track_quat('Z', 'Y')
    _activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def arc(cx, cz, r, a0, a1, n):
    """Points on a circle arc in the (u,v) plane, angles in degrees, inclusive."""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cz + r * math.sin(math.radians(a0 + (a1 - a0) * k / n)))
            for k in range(n + 1)]


# ----------------------------------------------------------------------------------------------- assembly
class Parts:
    """Collects static pieces; `.body()` joins them into one mesh named `body`."""

    def __init__(self):
        self.items = []

    def add(self, *objs):
        for o in objs:
            if o is None:
                continue
            if isinstance(o, (list, tuple)):
                self.add(*o)
            else:
                self.items.append(o)
        return objs[0] if len(objs) == 1 else objs

    def report(self, top=80):
        """Print triangle cost grouped by part name (name without Blender's .001 suffix)."""
        agg = {}
        for o in self.items:
            key = o.name.split('.')[0]
            n, t = agg.get(key, (0, 0))
            agg[key] = (n + 1, t + tri_count([o]))
        rows = sorted(agg.items(), key=lambda kv: -kv[1][1])[:top]
        print('[kit] tri cost: ' + ', '.join(f'{k} x{n}={t}' for k, (n, t) in rows))

    def body(self, name='body'):
        self.report()
        obj = join(self.items, name)
        set_origin_world(obj, (0, 0, 0))
        return obj


def set_origin_world(obj, point):
    _activate(obj)
    saved = tuple(bpy.context.scene.cursor.location)
    bpy.context.scene.cursor.location = point
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.context.scene.cursor.location = saved
    return obj


def rooted(asset_name, body_obj, extra=()):
    """Root empty named after the asset at the origin; body + runtime nodes as children."""
    root = empty(asset_name, (0, 0, 0))
    set_parent(body_obj, root)
    for e in extra:
        set_parent(e, root)
    print(f'[kit] {asset_name}: tris={tri_count()} nodes={[o.name for o in bpy.context.scene.objects]}')
    return root


def mirror_x(objs):
    """Duplicate objects mirrored across x=0 (geometry baked)."""
    out = []
    for o in objs:
        c = o.copy()
        c.data = o.data.copy()
        bpy.context.scene.collection.objects.link(c)
        c.location.x = -o.location.x
        c.scale.x = -o.scale.x
        _activate(c)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bm = bmesh.new()
        bm.from_mesh(c.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(c.data)
        bm.free()
        out.append(c)
    return out


def preview_framed(ctx, name, lo, hi, view=(0.55, -1.3, 0.6), res=(720, 540), samples=24):
    """render_preview framed on an explicit box (lo..hi) instead of the whole model bounds."""
    from lib.preview import render_preview
    if not ctx.want_preview():
        return None
    lo, hi = Vector(lo), Vector(hi)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(lo + hi) / 2)
    fr = bpy.context.active_object
    fr.name = '_frame'
    fr.scale = hi - lo
    fr.hide_render = True
    bpy.context.view_layer.update()
    path = render_preview(ctx, name, objs=[fr], view=view, res=res, samples=samples)
    bpy.data.objects.remove(fr, do_unlink=True)
    return path
