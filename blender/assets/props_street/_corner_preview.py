"""Group preview: a Bangkok street-food corner built from the EXPORTED props_street GLBs.

Imports public/assets/models/prop_*.glb (so the render shows exactly what ships), arranges cart + umbrella +
table + 4 stools (red/blue Plastic recolours, like the runtime does) + plants + clutter on a sidewalk slab with
a red/white curb, and renders blender/previews/props_street_corner.png (Cycles). Exports nothing.

Run after the asset scripts: node blender/run-blender.mjs blender/assets/props_street/_corner_preview.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy

from lib.bootstrap import start
from lib.palette import mat, hex_to_linear
from lib.shapes import box
from lib.preview import render_preview

ctx = start()
SLAB_H = 0.12

# (asset, x, y, yaw degrees, Plastic recolour hex or None)
LAYOUT = [
    ('prop_food_cart', -0.6, 0.2, 0, None),
    ('prop_umbrella', 2.1, 0.55, 0, None),
    ('prop_table', 2.1, 0.55, 0, None),
    ('prop_stool', 1.45, 0.55, 0, '#E24B3B'),
    ('prop_stool', 2.75, 0.55, 30, '#3F7FD0'),
    ('prop_stool', 2.1, -0.05, 15, '#E24B3B'),
    ('prop_stool', 2.1, 1.15, 50, '#F7C928'),
    ('prop_bougainvillea', -2.9, 1.2, 0, None),
    ('prop_pot_plant', -3.55, 0.35, 40, None),
    ('prop_banana', 3.7, 1.7, 0, None),
    ('prop_crates', 3.55, -0.75, -20, None),
    ('prop_ice_box', 0.75, -0.75, 10, None),
    ('prop_bin', -2.7, -0.6, 20, None),
]


def import_glb(name):
    path = os.path.join(ctx.models_dir, name + '.glb')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    return [o for o in new if o.parent is None], [o for o in new if o.type == 'MESH']


def recolour_plastic(meshes, hex_str):
    for o in meshes:
        for slot in o.material_slots:
            m = slot.material
            if m is not None and m.name.split('.')[0] == 'Plastic':
                m2 = m.copy()
                bsdf = m2.node_tree.nodes.get('Principled BSDF')
                if bsdf is not None:
                    bsdf.inputs['Base Color'].default_value = hex_to_linear(hex_str)
                slot.material = m2


def sidewalk():
    """Sidewalk slab (z 0..SLAB_H) with a red/white curb along the front (-Y) edge; road = preview ground."""
    walk = mat('Preview_Sidewalk', 'sidewalk', roughness=0.9)
    red = mat('Preview_CurbRed', 'curb_red', roughness=0.7)
    white = mat('Preview_CurbWhite', 'curb_white', roughness=0.7)
    w, d = 8.4, 4.6
    parts = [box('slab', (w, d, SLAB_H), (0.2, 0.35, SLAB_H / 2), walk, bevel=0.02)]
    n = 14
    for i in range(n):
        x = 0.2 - w / 2 + (i + 0.5) * w / n
        parts.append(box('curb', (w / n - 0.01, 0.2, SLAB_H + 0.04), (x, 0.35 - d / 2 + 0.1, (SLAB_H + 0.04) / 2),
                         red if i % 2 == 0 else white, bevel=0.015))
    return parts


meshes = sidewalk()
for name, x, y, yaw, plastic in LAYOUT:
    roots, ms = import_glb(name)
    for r in roots:
        r.location = (x, y, SLAB_H)
        r.rotation_mode = 'XYZ'
        r.rotation_euler = (0, 0, math.radians(yaw))
    if plastic:
        recolour_plastic(ms, plastic)
    meshes += ms
    print(f'[corner] placed {name} at ({x}, {y}) yaw {yaw}')

bpy.context.view_layer.update()
render_preview(ctx, 'props_street_corner', meshes, view=(0.8, -1.45, 0.85), res=(1280, 720), samples=40)
print('[corner] OK')
