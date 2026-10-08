"""Low-poly modelling helpers. Conventions (see docs/ASSET_SPEC.md):

- Blender Z-up, 1 unit = 1 metre, origin on the ground (z=0) at the footprint centre.
- Vehicles/characters FACE -Y in Blender (the glTF exporter turns that into +Z forward in three.js).
- Every visible part gets a small bevel so the toon lighting catches soft highlights.
"""
import math
import bpy


def _link(obj):
    bpy.context.scene.collection.objects.link(obj) if obj.name not in bpy.context.scene.collection.objects else None
    return obj


def _activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def _finish(obj, material, bevel, segments, smooth_angle=40):
    if material is not None:
        obj.data.materials.clear()
        obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.harden_normals = False
        _activate(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    _activate(obj)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    return obj


def box(name, size, loc=(0, 0, 0), material=None, bevel=0.03, segments=2, rot=(0, 0, 0)):
    """Axis-aligned box. size=(x,y,z) full extents, loc = centre."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    _activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, material, min(bevel, min(size) * 0.45), segments)


def cyl(name, radius, depth, loc=(0, 0, 0), material=None, rot=(0, 0, 0), verts=16, bevel=0.01, segments=1):
    """Cylinder along local Z (rotate with rot=(math.pi/2,0,0) to lie along Y)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return _finish(obj, material, min(bevel, radius * 0.4, depth * 0.4), segments)


def cone(name, r1, r2, depth, loc=(0, 0, 0), material=None, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return _finish(obj, material, 0, 1)


def sphere(name, radius, loc=(0, 0, 0), material=None, scale=(1, 1, 1), segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    _activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, material, 0, 1, smooth_angle=80)


def torus(name, major, minor, loc=(0, 0, 0), material=None, rot=(0, 0, 0), major_seg=20, minor_seg=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=major_seg,
                                     minor_segments=minor_seg, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return _finish(obj, material, 0, 1, smooth_angle=80)


def wheel(name, radius, width, loc, tire_mat, hub_mat, rot=(0, math.pi / 2, 0)):
    """Tyre (torus-ish cylinder) + hub, joined. Axle along X by default."""
    t = cyl(name + '_tire', radius, width, loc, tire_mat, rot=rot, verts=20, bevel=width * 0.35, segments=2)
    h = cyl(name + '_hub', radius * 0.55, width * 1.04, loc, hub_mat, rot=rot, verts=12, bevel=0.005)
    return join([t, h], name)


def empty(name, loc=(0, 0, 0), parent=None):
    """Attach point / pivot. Node names are a runtime contract (docs/ASSET_SPEC.md)."""
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.1
    obj.location = loc
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        set_parent(obj, parent)
    return obj


def join(objs, name):
    objs = [o for o in objs if o is not None]
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    return obj


def set_origin(obj, point):
    """Move the object's origin (pivot) to a world-space point without moving geometry."""
    _activate(obj)
    saved = tuple(bpy.context.scene.cursor.location)
    bpy.context.scene.cursor.location = point
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.context.scene.cursor.location = saved
    return obj


def set_parent(child, parent):
    """Parent while keeping the child's world transform."""
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = mw
    return child


def tri_count(objs=None):
    objs = objs or [o for o in bpy.context.scene.objects if o.type == 'MESH']
    total = 0
    for o in objs:
        if o.type != 'MESH':
            continue
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total
