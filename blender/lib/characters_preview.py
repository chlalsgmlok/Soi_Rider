"""Character QA renders: turnaround lineups and close-ups framed for tall/small subjects.

Lighting matches blender/lib/preview.py (warm sun + sky world, Cycles CPU, AgX Punchy) so every
group's previews read alike. Output: blender/previews/<name>.png.
"""
import math
import os
import bpy
from mathutils import Vector
from lib.preview import _world, _cycles


def hierarchy(root):
    out = [root]
    for c in root.children:
        out += hierarchy(c)
    return out


def dup_hierarchy(root):
    """Linked duplicate of root + descendants; returns the new root."""
    for o in bpy.context.selected_objects:
        o.select_set(False)
    objs = hierarchy(root)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.object.duplicate(linked=True)
    new = [o for o in bpy.context.selected_objects]
    return next(o for o in new if o.parent is None or o.parent not in new)


def bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def render(ctx, name, objs=None, res=(1280, 640), elev=16.0, azim=0.0, lens=60.0, samples=28, margin=1.08,
           ground=True):
    """Frame `objs` (default: all meshes) from the front (-Y) rotated by azim (deg, + = towards +X)."""
    if not ctx.want_preview():
        return None
    scene = bpy.context.scene
    objs = objs or [o for o in scene.objects if o.type == 'MESH']
    lo, hi = bounds(objs)
    center = (lo + hi) / 2
    size = hi - lo
    temp = []
    if ground:
        bpy.ops.mesh.primitive_plane_add(size=60, location=(center.x, center.y, 0))
        plane = bpy.context.active_object
        gm = bpy.data.materials.new('PreviewGround')
        gm.use_nodes = True
        gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.36, 0.31, 0.28, 1)
        plane.data.materials.append(gm)
        temp.append(plane)
    cam_data = bpy.data.cameras.new('CharCam')
    cam_data.lens = lens
    cam = bpy.data.objects.new('CharCam', cam_data)
    scene.collection.objects.link(cam)
    a, e = math.radians(azim), math.radians(elev)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    aspect = res[0] / res[1]
    sensor = cam_data.sensor_width
    hfov = 2 * math.atan(sensor / (2 * lens))
    vfov = 2 * math.atan(math.tan(hfov / 2) / aspect)
    half_w = max(size.x * abs(math.cos(a)) + size.y * abs(math.sin(a)), 0.2) / 2
    half_h = max(size.z * math.cos(e) + max(size.y, size.x) * 0.5 * math.sin(e), 0.2) / 2
    dist = max(half_w / math.tan(hfov / 2), half_h / math.tan(vfov / 2)) * margin + max(size.x, size.y) / 2
    cam.location = center + d * dist
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    sun_data = bpy.data.lights.new('CharSun', 'SUN')
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.86, 0.68)
    sun_data.angle = math.radians(6)
    sun = bpy.data.objects.new('CharSun', sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    scene.collection.objects.link(sun)
    temp += [cam, sun]
    _world(scene)
    _cycles(scene, samples)
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = False
    os.makedirs(ctx.previews_dir, exist_ok=True)
    path = os.path.join(ctx.previews_dir, name + '.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in temp:
        bpy.data.objects.remove(o, do_unlink=True)
    print(f'[preview] {path}')
    return path


def turnaround(ctx, name, root, angles=(0, 35, 90, 180), spacing=None, frame=None, **kw):
    """Linked copies of `root` rotated about Z (deg) in a row, rendered together, then removed."""
    if not ctx.want_preview():
        return None
    lo, hi = bounds([o for o in hierarchy(root) if o.type == 'MESH'])
    step = spacing or max(hi.x - lo.x, hi.y - lo.y) * 1.25
    copies = []
    base = root.location.copy()
    for i, ang in enumerate(angles):
        r = root if i == 0 else dup_hierarchy(root)
        r.location = base + Vector(((i - (len(angles) - 1) / 2) * step, 0, 0))
        r.rotation_mode = 'XYZ'
        r.rotation_euler = (0, 0, math.radians(ang))
        copies.append(r)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and (frame is None or frame(o))]
    path = render(ctx, name, objs=objs, **kw)
    for r in copies[1:]:
        for o in hierarchy(r):
            bpy.data.objects.remove(o, do_unlink=True)
    root.location = base
    root.rotation_euler = (0, 0, 0)
    return path
