"""QA only (exports nothing): imports the exported bike + gear GLBs, mounts each gear on the bike's
`gear_mount` empty exactly like the runtime does (offset zero) and renders combined previews:
  blender/previews/bike_cub_gear.png      (cub + gear_rack)
  blender/previews/bike_scooter_gear.png  (scooter + gear_bag)
  blender/previews/bike_sport_gear.png    (sport + gear_topbox)
  blender/previews/bikes_gear_lineup.png  (all three, diorama-like rear-high view)
Run after the bike/gear scripts: node blender/run-blender.mjs blender/assets/bikes/preview_gear.py
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy
from mathutils import Matrix, Vector

from lib.bootstrap import start
from lib import bikes_kit as K
from lib import bikes_parts as P

ctx = start()
PAIRS = (('bike_cub', 'gear_rack'), ('bike_scooter', 'gear_bag'), ('bike_sport', 'gear_topbox'))
GAP = 1.25


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ctx.models_dir, name + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None or o.parent not in new]
    return new, roots[0]


def find(objs, base):
    for o in objs:
        if o.name.split('.')[0] == base:
            return o
    raise RuntimeError(f'node {base} missing')


groups = []
for i, (bike, gear) in enumerate(PAIRS):
    bobjs, broot = load(bike)
    gobjs, groot = load(gear)
    bpy.context.view_layer.update()
    mount = find(bobjs, 'gear_mount')
    groot.matrix_world = mount.matrix_world.copy()
    K.parent(groot, mount)
    print(f'[gear] {gear} on {bike}.gear_mount at {tuple(round(c, 3) for c in mount.matrix_world.translation)}')
    groups.append((bike, broot, bobjs + gobjs))


def only(visible):
    for _, _, objs in groups:
        for o in objs:
            o.hide_render = o not in visible


# individual shots (each bike at the origin): rear-high 3/4 like the diorama camera, and front 3/4
for bike, broot, objs in groups:
    only(set(objs))
    broot.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    P.shot(ctx, bike + '_gear', (2.4, 3.9, 3.3), (0, 0.1, 0.6), lens=50, res=(720, 540), samples=24)
    P.shot(ctx, bike + '_gear_front', (-2.6, -3.4, 2.0), (0, 0.0, 0.62), lens=50, res=(720, 540), samples=24)

# lineup
only(set(o for _, _, objs in groups for o in objs))
for i, (bike, broot, objs) in enumerate(groups):
    broot.matrix_world = Matrix.Translation(Vector(((i - 1) * GAP, 0, 0)))
bpy.context.view_layer.update()
P.shot(ctx, 'bikes_gear_lineup', (3.6, 6.4, 5.6), (0, 0.15, 0.55), lens=45, res=(960, 600), samples=24)
print('[preview_gear] OK')
