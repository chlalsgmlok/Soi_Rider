"""Compositor + output for the story key art.

post():   mist-pass haze (aerial perspective tinted per scene), bloom on emissive highlights, soft vignette.
output(): renders, then writes the draft PNG or the final WEBP + 640x360 thumbnail, logging the render time.
"""
import os
import time
import bpy
from story.kit.assets import rgba
from story.kit.look import THUMB_RES


def post(haze_color=(0.8, 0.7, 0.6), mist_start=8.0, mist_depth=80.0, haze=0.35, bloom=0.6, bloom_threshold=1.0,
         vignette=0.25, falloff='QUADRATIC', tint=None):
    """tint: optional linear (r, g, b) multiplier applied before bloom (a gentle colour grade)."""
    scene = bpy.context.scene
    vl = scene.view_layers[0]
    vl.use_pass_mist = True
    ms = scene.world.mist_settings
    ms.start, ms.depth, ms.falloff = mist_start, mist_depth, falloff
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    comp = nt.nodes.new('CompositorNodeComposite')
    img = rl.outputs['Image']

    if haze > 0:
        k = nt.nodes.new('CompositorNodeMath')
        k.operation = 'MULTIPLY'
        k.inputs[1].default_value = haze
        nt.links.new(rl.outputs['Mist'], k.inputs[0])
        mix = nt.nodes.new('CompositorNodeMixRGB')
        mix.blend_type = 'MIX'
        mix.inputs[2].default_value = rgba(haze_color)
        nt.links.new(k.outputs[0], mix.inputs['Fac'])
        nt.links.new(img, mix.inputs[1])
        img = mix.outputs['Image']

    if tint is not None:
        grade = nt.nodes.new('CompositorNodeMixRGB')
        grade.blend_type = 'MULTIPLY'
        grade.inputs['Fac'].default_value = 1.0
        grade.inputs[2].default_value = (*tint, 1.0)
        nt.links.new(img, grade.inputs[1])
        img = grade.outputs['Image']

    if bloom > 0:  # Blender 4.5 Glare: settings are input sockets, quality is a property
        g = nt.nodes.new('CompositorNodeGlare')
        g.glare_type = 'BLOOM'
        g.quality = 'MEDIUM'
        g.inputs['Threshold'].default_value = bloom_threshold
        g.inputs['Strength'].default_value = bloom
        g.inputs['Size'].default_value = 0.55
        nt.links.new(img, g.inputs['Image'])
        img = g.outputs['Image']

    if vignette > 0:
        res_x = scene.render.resolution_x
        mask = nt.nodes.new('CompositorNodeEllipseMask')
        mask.inputs['Size'].default_value = (0.92, 0.92)
        blur = nt.nodes.new('CompositorNodeBlur')
        blur.filter_type = 'GAUSS'
        blur.inputs['Size'].default_value = (res_x * 0.2, res_x * 0.2)
        nt.links.new(mask.outputs['Mask'], blur.inputs['Image'])
        mul = nt.nodes.new('CompositorNodeMixRGB')
        mul.blend_type = 'MULTIPLY'
        mul.inputs['Fac'].default_value = vignette
        nt.links.new(img, mul.inputs[1])
        nt.links.new(blur.outputs['Image'], mul.inputs[2])
        img = mul.outputs['Image']

    nt.links.new(img, comp.inputs['Image'])
    return nt


def output(opts, name):
    ctx = opts.ctx
    scene = bpy.context.scene
    settings = scene.render.image_settings
    if opts.draft:
        out_dir = os.path.join(ctx.root, 'blender', 'story', 'drafts')
        path = os.path.join(out_dir, f'{name}__{opts.tag}.png')
        settings.file_format = 'PNG'
        settings.color_mode = 'RGB'
    else:
        out_dir = ctx.story_dir
        path = os.path.join(out_dir, f'{name}.webp')
        settings.file_format = 'WEBP'
        settings.color_mode = 'RGB'
        settings.quality = 88
    os.makedirs(out_dir, exist_ok=True)
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    secs = time.time() - t0
    print(f'[render] {path} {scene.render.resolution_x}x{scene.render.resolution_y} '
          f'samples={scene.cycles.samples} in {secs:.1f}s')
    if not opts.draft:
        thumb = os.path.join(out_dir, f'{name}_s.webp')
        im = bpy.data.images.load(path)
        im.scale(*THUMB_RES)
        im.file_format = 'WEBP'
        im.save(filepath=thumb, quality=88)
        print(f'[render] thumb {thumb} {THUMB_RES[0]}x{THUMB_RES[1]}')
    return path
