"""story_haze — hazy noon gridlock: the city bus ahead puffs a cloud of exhaust over the bike, the passenger coughs into
her hand and NONG turns round to offer her a mask. Towers dissolve into the brown PM2.5 haze behind.

    node blender/run-blender.mjs blender/story/story_haze.py [--draft --tag=d1]
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from mathutils import Vector
from lib.bootstrap import start
from story.kit import look
from story.kit.assets import load, use_models
from story.kit.cast import SPARE_HELMET, hero, hero_bike, person
from story.kit.fx import puffs
from story.kit.post import output, post
from story.kit.stage import Ground, SIDEWALK_H
from story.kit.street import npc_rider, shophouse_row

ctx = start()
use_models(ctx.models_dir)
opts = look.setup(ctx, samples=96, exposure=0.0)
W = SIDEWALK_H

g = Ground()
g.sidewalk(-60, 60, -4.0, 0.2)
g.curb(-60, 60, -4.11, axis='x')
g.sidewalk(-60, 60, -24.0, -17.6)
g.curb(-60, 60, -17.49, axis='x')
g.carriageway(-80, 80, -17.6, -4.0)
g.dashes(-7.4, -60, 60, axis='x')
g.double_yellow(-10.8, -60, 60, axis='x')
g.dashes(-14.2, -60, 60, axis='x')
g.build()

# far side of the road: shophouses, towers behind them melting into the haze
shophouse_row(ctx.root, (-25.2, -17.6, W), (4.2, 0, 0), 13, 180, seed=4)
for x, y, kind in ((-22.0, -36.0, 'bld_condo'), (6.0, -40.0, 'bld_office'), (30.0, -34.0, 'bld_condo'),
                   (-48.0, -44.0, 'bld_office')):
    load(kind, (x, y, 0), 180)

# gridlock: the bus ahead (exhaust side towards the bike), traffic all round
bus = load('veh_bus', (4.6, -7.6, 0), 90)
bus.glow('Light_Brake', 4.0)
load('veh_taxi', (-6.0, -9.5, 0), 90, colors={'Paint': 'taxi_green', 'Paint2': 'taxi_yellow'})
load('veh_tuktuk', (3.2, -9.7, 0), 90)
load('veh_van', (-14.0, -7.5, 0), 90)
npc_rider((-8.8, -6.0, 0), 90, seed=5)
npc_rider((1.3, -10.3, 0), 90, seed=1, vest=True)
load('veh_sedan', (2.0, -13.2, 0), -90, colors={'Paint': 'car_white'})
load('veh_songthaew', (-9.0, -14.0, 0), -90, colors={'Paint': 'taxi_red'})

# NONG stopped behind the bus, twisting round with a mask; the passenger coughing into her hand
bike = hero_bike((-3.1, -7.75, 0), yaw=90)
nong = hero()
nong.sit(bike.world('seat_rider'), yaw=90)
nong.pose({'torso': (0.04, 0.0, 0.5), 'head': (-0.04, 0.0, 0.85),
           'thigh_L': (-1.25, -0.12, 0), 'shin_L': (1.15, 0, 0), 'foot_L': (0.1, 0, 0),
           'thigh_R': (-1.25, 0.12, 0), 'shin_R': (1.15, 0, 0), 'foot_R': (0.1, 0, 0),
           'arm_R': (-1.0, 0, 0.5), 'forearm_R': (-0.45, 0, 0),
           'arm_L': (0.0, -1.5, 0.42), 'forearm_L': (-0.45, 0, 0), 'hand_L': (0, 0, 0)})
pas = person(head=[('hair_bun', {'Hair': 'hair_brown'}), (SPARE_HELMET[0], {'Helmet_Paint': SPARE_HELMET[1]})],
             colors={'Skin': 'skin_2', 'Hands': 'skin_2', 'Shirt': 'wall_lemon', 'Pants': 'denim',
                     'Shoes': 'cloth_white'})
pas.sit(bike.world('seat_pillion'), yaw=90, lift=0.05)
pas.pose({'torso': (-0.06, 0.3, 0.55), 'head': (0.16, 0.0, 0.45),
          'thigh_L': (-1.3, -0.22, 0), 'shin_L': (1.25, 0, 0), 'foot_L': (0.05, 0, 0),
          'thigh_R': (-1.3, 0.22, 0), 'shin_R': (1.25, 0, 0), 'foot_R': (0.05, 0, 0),
          'arm_R': (-0.6, 0.1, 0.3), 'forearm_R': (-0.6, 0, 0),
          'arm_L': (-0.65, 0.0, -0.45), 'forearm_L': (-2.15, 0, 0), 'hand_L': (0, 0, 0)})
hand = nong.nodes['hand_L'].matrix_world @ Vector((0, -0.02, -0.1))
mask = load('acc_mask')
mask.place((0, 0, 0), yaw=-142, pitch=8)
mask.place(hand - mask.root.matrix_world.to_3x3() @ Vector((0.0, -0.07, 0.19)), yaw=-142, pitch=8)

# exhaust: dark puffs out of the bus tail pipe (near side), rolling back under the bike and lightening as they rise
pipe = bus.root.matrix_world @ Vector((0.85, 5.85, 0.42))
# a low plume (offsets from the pipe; the bike's near side is dy ~0, its far side dy < -1.2) rolls into the front
# wheel and on past the bike's far side, rising as it thins; a thin wisp curls up between the wheels
stream = [((-0.2, 0.0, 0.0), 0.12, 0.0), ((-0.5, 0.05, 0.04), 0.17, 0.04), ((-0.85, 0.0, 0.08), 0.21, 0.1),
          ((-1.2, 0.05, 0.12), 0.24, 0.16), ((-1.55, -0.05, 0.18), 0.25, 0.22), ((-1.9, -0.15, 0.22), 0.24, 0.28),
          ((-1.9, -1.2, 0.35), 0.3, 0.3), ((-2.5, -1.4, 0.6), 0.34, 0.38), ((-3.1, -1.5, 0.9), 0.38, 0.48),
          ((-3.7, -1.4, 1.25), 0.4, 0.58), ((-4.3, -1.2, 1.65), 0.42, 0.7),
          ((-1.7, -0.9, 0.42), 0.12, 0.4)]
puffs([(pipe + Vector(o), r, k) for o, r, k in stream], color=(0.2, 0.19, 0.18), alpha=0.9)
head = pas.nodes['head'].matrix_world
mouth, front = head @ Vector((0.0, -0.14, 0.11)), (head.to_3x3() @ Vector((0, -1, 0))).normalized()
side = Vector((-1.0, 0.25, 0.0))  # cough puffs drift off to her side (away from NONG's face)
puffs([(mouth + front * 0.06 + side * 0.06, 0.05, 0.85), (mouth + side * 0.16 + Vector((0, 0, 0.05)), 0.045, 0.95),
       (mouth + side * 0.25 + Vector((0, 0, 0.11)), 0.035, 1.0)], color=(0.6, 0.58, 0.55), alpha=0.8, seed=4,
      name='St_Cough')

# hazy noon: high pale sun, beige sky, thick brown-grey aerial haze
look.world_sky(zenith='#CFC5AC', horizon='#E9DCC0', ground='#9B8F7E', strength=1.3)
look.sun(azimuth=185, elevation=68, color='#FFE9C4', energy=3.0, angle=9.0)
look.area((-6.5, -3.0, 3.5), (-3.2, -7.6, 1.4), 4.0, '#FFF1DA', 120.0, name='Bounce')

cam = look.camera((-3.75, -4.3, 1.72), (-2.65, -7.8, 1.3), lens=34, fstop=2.4, focus=hand)
post(haze_color='#C8B28A', mist_start=4.0, mist_depth=22.0, haze=1.0, bloom=0.3, bloom_threshold=1.4,
     vignette=0.28, falloff='LINEAR')
output(opts, 'story_haze')
print('[story_haze] OK')
