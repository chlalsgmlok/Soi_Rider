"""Preview renders for visual QA (blender/previews/<name>.png).

Warm golden-hour key light + sky fill, 3/4 view from the front-right (models face -Y).
Agents should open the PNG with their image Read tool and iterate until it matches
the reference look (cartoon diorama, saturated, soft bevel highlights).
"""
import math
import os
import bpy
from mathutils import Vector


def _bounds(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    if not pts:
        return Vector((0, 0, 0.5)), 1.0
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2, max((hi - lo).length, 0.3)


def _world(scene, color=(0.62, 0.74, 0.9), strength=0.9):
    world = bpy.data.worlds.new('PreviewWorld')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*color, 1)
    bg.inputs['Strength'].default_value = strength
    scene.world = world


def _engine(scene, samples):
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
        scene.eevee.taa_render_samples = samples
    except TypeError:
        pass


def _cycles(scene, samples):
    """EEVEE renders blank white headless on this machine (Intel Arc iGPU) -> previews use Cycles CPU."""
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4  # several agents render in parallel


def render_preview(ctx, name, objs=None, view=(1.0, -1.35, 0.85), res=(720, 540), samples=32, ground=True):
    if not ctx.want_preview():
        return None
    scene = bpy.context.scene
    objs = objs or [o for o in scene.objects if o.type == 'MESH']
    center, size = _bounds(objs)
    temp = []
    if ground:
        bpy.ops.mesh.primitive_plane_add(size=size * 8, location=(center.x, center.y, 0))
        plane = bpy.context.active_object
        gm = bpy.data.materials.new('PreviewGround')
        gm.use_nodes = True
        gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.36, 0.31, 0.28, 1)
        plane.data.materials.append(gm)
        temp.append(plane)
    cam_data = bpy.data.cameras.new('PreviewCam')
    cam_data.lens = 50
    cam = bpy.data.objects.new('PreviewCam', cam_data)
    scene.collection.objects.link(cam)
    d = Vector(view).normalized()
    cam.location = center + d * size * 1.55
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    sun_data = bpy.data.lights.new('PreviewSun', 'SUN')
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.86, 0.68)
    sun_data.angle = math.radians(6)
    sun = bpy.data.objects.new('PreviewSun', sun_data)
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
    print(f'[preview] {path} engine={scene.render.engine}')
    return path
