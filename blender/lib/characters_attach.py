"""Attachment pipeline for the characters group: build -> export -> preview ON the real char_body.glb.

Parenting in previews is done exactly like the runtime will do it: attachment root under the body node
with ZERO offset (identity local transform), which proves the pivots.
"""
import os
import re
import bpy
from lib.bootstrap import clear_scene
from lib.export import export_glb
from lib.characters_preview import turnaround, render, hierarchy


def base(name):
    return re.sub(r'\.\d{3}$', '', name)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None or o.parent not in new]
    return new, roots


def import_body(ctx):
    """Import char_body.glb; returns {base node name: object} (hips, torso, head, arm_L, ...)."""
    path = os.path.join(ctx.models_dir, 'char_body.glb')
    new, _roots = import_glb(path)
    nodes = {base(o.name): o for o in new}
    return nodes


def attach(child, parent):
    """Zero-offset parenting (runtime contract)."""
    child.parent = parent
    child.matrix_parent_inverse.identity()
    child.location = (0, 0, 0)
    child.rotation_mode = 'XYZ'
    child.rotation_euler = (0, 0, 0)
    child.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    return child


def wants(ctx, name):
    only = [f.split('=', 1)[1] for f in ctx.flags if f.startswith('--only=')]
    return not only or name in only[0].split(',')


def run_family(ctx, builders, socket, max_tris=800, close_up=True):
    """builders: {asset_name: fn() -> root object at the origin}. socket: body node to attach to."""
    for name, fn in builders.items():
        if not wants(ctx, name):
            continue
        clear_scene()
        root = fn()
        root.name = name
        export_glb(ctx, name, [root], max_tris=max_tris)
        if not ctx.want_preview():
            continue
        nodes = import_body(ctx)
        attach(root, nodes[socket])
        hips = nodes['hips']
        if close_up:
            keep = {'head', 'torso', name} if socket == 'head' else None
            turnaround(ctx, name, hips, angles=(0, 40, 100, 180), res=(1200, 420), elev=14, lens=70, spacing=0.55,
                       frame=(lambda o: base(o.name) in keep) if keep else None)
        else:
            turnaround(ctx, name, hips, angles=(0, 40, 100, 180), res=(1200, 560), elev=14, lens=70)
    return True


def tri_report(objs):
    from lib.shapes import tri_count
    for o in objs:
        for h in hierarchy(o):
            if h.type == 'MESH':
                print(f'[tris] {h.name}: {tri_count([h])}')
