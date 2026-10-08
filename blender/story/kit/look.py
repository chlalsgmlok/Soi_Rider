"""Render look for the story key art: Cycles CPU (EEVEE renders white headless here), AgX Punchy, a sky gradient
world, key / fill / bounce lights and a tilt-shift-ish DOF camera (compositor + file output: kit/post.py).

Draft  (`--draft`): 480x270, 16 samples -> blender/story/drafts/<name>__<tag>.png
Final  (default):   1600x900, scene samples -> public/assets/story/<name>.webp (quality 88) + <name>_s.webp 640x360
"""
import math
import sys
import bpy
from mathutils import Vector
from story.kit.assets import rgba

FINAL_RES = (1600, 900)
DRAFT_RES = (480, 270)
THUMB_RES = (640, 360)
THREADS = 6


class Opts:
    def __init__(self, ctx):
        self.ctx = ctx
        self.draft = '--draft' in ctx.flags
        tags = [f.split('=', 1)[1] for f in ctx.flags if f.startswith('--tag=')]
        self.tag = tags[0] if tags else 'd'
        samples = [int(f.split('=', 1)[1]) for f in ctx.flags if f.startswith('--samples=')]
        self.samples = samples[0] if samples else None


def setup(ctx, samples=96, exposure=0.0, look='AgX - Punchy'):
    """Cycles CPU + colour management; returns Opts (draft flag, tag)."""
    opts = Opts(ctx)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    cy = scene.cycles
    cy.device = 'CPU'
    cy.samples = opts.samples or (16 if opts.draft else samples)
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.05 if opts.draft else 0.02
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.max_bounces = 6
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 3
    cy.transmission_bounces = 6
    cy.transparent_max_bounces = 32
    cy.volume_bounces = 0
    cy.sample_clamp_indirect = 6.0
    cy.blur_glossy = 1.0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = THREADS
    res = DRAFT_RES if opts.draft else FINAL_RES
    over = [f.split('=', 1)[1] for f in ctx.flags if f.startswith('--res=')]   # QA: --res=960x540 (drafts only)
    if over and opts.draft:
        res = tuple(int(v) for v in over[0].split('x'))
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = look
    scene.view_settings.exposure = exposure
    print(f'[look] draft={opts.draft} res={res} samples={cy.samples}')
    return opts


def world_sky(zenith, horizon, ground, strength=1.0, horizon_band=0.18):
    """Sky gradient by view direction: ground below the horizon, horizon -> zenith above it."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new('StorySky')
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    coord = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    span = nt.nodes.new('ShaderNodeMapRange')  # view direction z (-1..1) -> 0..1, horizon at 0.5
    span.inputs['From Min'].default_value = -1.0
    nt.links.new(coord.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], span.inputs['Value'])
    nt.links.new(span.outputs['Result'], ramp.inputs['Fac'])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.40, rgba(ground)
    els[1].position, els[1].color = 1.0, rgba(zenith)
    e = els.new(0.5)
    e.color = rgba(horizon)
    e2 = els.new(0.5 + horizon_band * 0.5)
    e2.color = tuple(0.5 * (a + b) for a, b in zip(rgba(horizon), rgba(zenith)))
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    scene.world = world
    return world


def _obj(name, data, loc):
    o = bpy.data.objects.new(name, data)
    o.location = Vector(loc)
    bpy.context.scene.collection.objects.link(o)
    return o


def aim(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return obj


def sun(azimuth, elevation, color, energy, angle=3.0, name='Sun'):
    """azimuth: compass deg the light COMES FROM (0 = +Y north, 90 = +X east); elevation deg above the horizon."""
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = energy
    d.color = rgba(color)[:3]
    d.angle = math.radians(angle)
    o = _obj(name, d, (0, 0, 50))
    a, e = math.radians(azimuth), math.radians(elevation)
    src = Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    o.rotation_euler = (-src).to_track_quat('-Z', 'Y').to_euler()
    return o


def area(loc, target, size, color, energy, size_y=None, shape='DISK', name='Area', spread=180.0):
    d = bpy.data.lights.new(name, 'AREA')
    d.shape = shape if size_y is None else ('ELLIPSE' if shape == 'DISK' else 'RECTANGLE')
    d.size = size
    if size_y is not None:
        d.size_y = size_y
    d.energy = energy
    d.color = rgba(color)[:3]
    d.spread = math.radians(spread)
    return aim(_obj(name, d, loc), target)


def point(loc, color, energy, radius=0.1, name='Point'):
    d = bpy.data.lights.new(name, 'POINT')
    d.energy = energy
    d.color = rgba(color)[:3]
    d.shadow_soft_size = radius
    return _obj(name, d, loc)


def spot(loc, target, color, energy, angle=60.0, blend=0.6, radius=0.1, name='Spot'):
    d = bpy.data.lights.new(name, 'SPOT')
    d.energy = energy
    d.color = rgba(color)[:3]
    d.spot_size = math.radians(angle)
    d.spot_blend = blend
    d.shadow_soft_size = radius
    return aim(_obj(name, d, loc), target)


def camera(loc, target, lens=50.0, fstop=None, focus=None, shift=(0.0, 0.0), name='StoryCam'):
    """focus: a world point (Vector/tuple) or an object; fstop None disables DOF.
    QA override: `--cam=x,y,z,tx,ty,tz,lens` on the command line re-aims the camera (pose / detail checks)."""
    over = [a.split('=', 1)[1] for a in sys.argv if a.startswith('--cam=')]
    if over:
        v = [float(t) for t in over[0].split(',')]
        loc, target, lens = v[0:3], v[3:6], (v[6] if len(v) > 6 else lens)
    d = bpy.data.cameras.new(name)
    d.lens = lens
    d.sensor_width = 36.0
    d.shift_x, d.shift_y = shift
    d.clip_start = 0.1
    d.clip_end = 600.0
    cam = aim(_obj(name, d, loc), target)
    if fstop is not None:
        d.dof.use_dof = True
        d.dof.aperture_fstop = fstop
        d.dof.aperture_blades = 7
        if isinstance(focus, bpy.types.Object):
            d.dof.focus_object = focus
        else:
            fp = Vector(focus if focus is not None else target)
            d.dof.focus_distance = (fp - cam.location).length
    bpy.context.scene.camera = cam
    return cam
