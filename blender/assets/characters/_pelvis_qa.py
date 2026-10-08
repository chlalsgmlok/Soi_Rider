"""QA renders for the char_body hip/thigh junction (no export).

Imports public/assets/models/char_body.glb and renders close-ups of the pelvis standing (front, back, high 3/4
garage-turntable angle) and in the seated STOOL / RIDER poses, so interpenetration seams are easy to spot.
  blender/previews/char_body__pelvis.png        standing: front / 3/4 / side / back close-ups
  blender/previews/char_body__pelvis_seated.png seated: STOOL + RIDER from the front 3/4, side and back
Run (after char_body): node blender/run-blender.mjs blender/assets/characters/_pelvis_qa.py
"""
import os
import sys
import math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy
from mathutils import Vector
from lib.bootstrap import start
from lib.characters_attach import import_glb, base
from lib.characters_preview import render, hierarchy
from lib.characters_pose import RIDER, STOOL, apply_pose

ctx = start()


def body(loc, yaw, pose=None, hips_dz=0.0):
    new, _ = import_glb(os.path.join(ctx.models_dir, 'char_body.glb'))
    nodes = {base(o.name): o for o in new}
    hips = nodes['hips']
    for o in new:
        o.rotation_mode = 'XYZ'
    if pose:
        apply_pose(nodes, pose)
    hips.location = Vector(loc) + Vector((0, 0, hips_dz))
    hips.rotation_euler = (0, 0, math.radians(yaw))
    bpy.context.view_layer.update()
    return nodes


def frame_parts(nodes, keys):
    return [nodes[k] for k in keys if k in nodes]


# ---------------------------------------------------------------- standing close-ups (four yaw angles in a row)
PELVIS = ('hips', 'thigh_L', 'thigh_R', 'torso')
row = []
for i, yaw in enumerate((0, 35, 90, 180)):
    n = body(((i - 1.5) * 0.62, 0, 0), yaw)
    row += frame_parts(n, ('hips', 'thigh_L', 'thigh_R'))
render(ctx, 'char_body__pelvis', objs=row, res=(1400, 460), elev=12, azim=0, lens=85, margin=1.05, ground=False)

# ---------------------------------------------------------------- seated poses
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
objs = []
for i, (pose, yaw, dz) in enumerate(((STOOL, -35, -0.30), (STOOL, 90, -0.30), (RIDER, 145, -0.12), (RIDER, -150, -0.12))):
    n = body(((i - 1.5) * 0.75, 0, 0), yaw, pose, dz)
    objs += frame_parts(n, ('hips', 'thigh_L', 'thigh_R'))
render(ctx, 'char_body__pelvis_seated', objs=objs, res=(1400, 440), elev=24, azim=0, lens=85, margin=1.02,
       ground=False)
print('[pelvis_qa] OK')
