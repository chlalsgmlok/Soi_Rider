"""story_arrival — night drop-off on a neon-lit soi: the passenger waves goodbye in front of her hostel (the coral gram
pin still hovering over the door), baht coins and notes pop into the air, and NONG answers with a thumbs up.

    node blender/run-blender.mjs blender/story/story_arrival.py [--draft --tag=d1]
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from mathutils import Vector
from lib.bootstrap import start
from story.kit import look
from story.kit.assets import load, use_models
from story.kit.cast import SPARE_HELMET, hero, hero_bike, person
from story.kit.fx import coins, notes, pin, ring
from story.kit.post import output, post
from story.kit.stage import Ground, SIDEWALK_H
from story.kit.street import letter_sign, npc_rider, shophouse

ctx = start()
use_models(ctx.models_dir)
opts = look.setup(ctx, samples=96, exposure=0.1)
W = SIDEWALK_H

g = Ground(wet=0.15)
g.sidewalk(-30, 30, -4.0, 0.2)
g.curb(-30, 30, -4.11, axis='x')
g.carriageway(-60, 60, -30, -4.0)
g.dashes(-7.4, -60, 60, axis='x')
g.build()

# the soi at night: lit shopfronts, neon lettering on the signboards, the destination hostel in the middle
row = [('bld_shophouse_3f', -8.4, 'ส้มตำ', 'neon_yellow'), ('bld_shophouse_2f', -4.2, 'บาร์', 'neon_pink'),
       ('bld_shophouse_4f', 0.0, 'HOSTEL 23', 'neon_cyan'), ('bld_shophouse_3f', 4.2, 'นวดแผนไทย', 'neon_pink'),
       ('bld_shophouse_2f', 8.4, 'กาแฟ', 'neon_yellow'), ('bld_shophouse_3f', 12.6, 'โจ๊ก', 'neon_red')]
for i, (kind, x, words, neon) in enumerate(row):
    s = shophouse(ctx.root, kind, (x, 0, W), 0, i + 3, words=False, night=1.0)
    letter_sign(ctx.root, s, words, '#141826', neon, size=0.46, glow=9.0)
    look.area((x, -1.0, 4.4), (x, -2.5, 0.0), 3.0, neon, 60.0, size_y=0.6, shape='RECTANGLE', name='NeonSpill')

# the drop-off: passenger on the pavement waving goodbye, NONG at the kerb with a thumbs up
bike = hero_bike((-0.75, -5.05, 0), yaw=45)
bike.glow('Light_Head', 4.0).glow('Light_Tail', 3.0).glow('Dash_Screen', 2.0)
spare = load(SPARE_HELMET[0], colors={'Helmet_Paint': SPARE_HELMET[1]})
spare.place(bike.world('seat_pillion') + Vector((0, 0, 0.03)), yaw=150, pitch=-10)
nong = hero()
nong.sit(bike.world('seat_rider'), yaw=45)
nong.pose({'torso': (0.04, 0.0, 0.35), 'head': (-0.1, 0.0, 0.3),
           'thigh_L': (-1.25, -0.12, 0), 'shin_L': (1.15, 0, 0), 'foot_L': (0.1, 0, 0),
           'thigh_R': (-1.25, 0.12, 0), 'shin_R': (1.15, 0, 0), 'foot_R': (0.1, 0, 0),
           'arm_R': (-1.0, 0, 0.5), 'forearm_R': (-0.45, 0, 0),
           'arm_L': (-0.45, -0.6, 0.75), 'forearm_L': (-1.2, 0, 0), 'hand_L': (0, 0, 0)})
nong.thumb_up('L')
guest = person(head=[('hair_long', {'Hair': 'hair_brown'})],
               colors={'Skin': 'skin_1', 'Hands': 'skin_1', 'Shirt': 'wall_mint', 'Pants': 'cloth_khaki',
                       'Shoes': 'cloth_white'})
guest.stand(0.5, -3.0, W, yaw=-12)
guest.pose({'arm_R': (-0.25, 1.9, 0), 'forearm_R': (-0.2, 0.7, 0), 'hand_R': (0, 0, -0.3),
            'arm_L': (-0.2, -0.1, 0), 'forearm_L': (-0.5, 0, 0), 'torso': (0.0, 0.05, -0.05), 'head': (0.05, -0.04, 0.0)})

# the job is done: coral pin over the hostel door, gold baht coins and notes arcing from her towards NONG
pin((0.4, -2.35, W + 2.45), scale=0.4, strength=2.5)
ring((0.5, -3.0, W + 0.01), radius=0.7, tube=0.03, color='pin_coral', strength=4.0, name='St_PinRing')
src = guest.nodes['hand_R'].matrix_world @ Vector((0, 0, -0.08))
dst = nong.nodes['head'].matrix_world @ Vector((0, -0.1, 0.32))
arc = [src.lerp(dst, t) + Vector((0, 0, 0.28 * math.sin(math.pi * t))) for t in (0.16, 0.3, 0.44, 0.58, 0.72, 0.86)]
jit = [(0.05, -0.08, 0.06), (-0.1, 0.06, -0.04), (0.08, 0.1, 0.05), (-0.06, -0.1, -0.06), (0.1, 0.04, 0.08),
       (-0.08, 0.08, -0.03)]
coins([(p + Vector(j), 20 + 23 * i) for i, (p, j) in enumerate(zip(arc, jit))] +
      [(arc[1] + Vector((0.12, -0.2, 0.22)), 70), (arc[3] + Vector((-0.15, 0.22, 0.25)), 35),
       (arc[4] + Vector((0.18, -0.12, -0.2)), 55)], radius=0.11, glow=0.8)
notes([(arc[2] + Vector((-0.25, 0.25, 0.3)), (25, 10, 30), '#2E8B57'),
       (arc[4] + Vector((0.25, -0.2, 0.32)), (-20, 15, -40), '#C0392B'),
       (arc[0] + Vector((0.1, -0.3, 0.2)), (40, -10, 10), '#6C3FA0')])

# background life
npc_rider((-9.5, -6.0, 0), 90, seed=2, lights=2.0)
taxi = load('veh_taxi', (-15.0, -9.0, 0), -90, colors={'Paint': 'taxi_pink', 'Paint2': 'taxi_pink'})
taxi.glow('Light_Head', 5.0).glow('Sign_Taxi', 3.0)
tuk = load('veh_tuktuk', (11.0, -9.4, 0), -90)
tuk.glow('Light_Head', 5.0).glow('Light_Deco', 5.0)
for x in (-10.0, 10.0):
    lamp = load('prop_street_lamp', (x, -3.75, W), 0)
    lamp.glow('Lamp_Glow', 10.0, '#FFB766')
    look.point(lamp.world('lamp') + Vector((0, 0, -0.3)), '#FF9C4A', 600.0, radius=0.3, name='Sodium')
load('prop_pot_plant', (-1.75, -0.6, W), 0)
load('prop_bougainvillea', (2.4, -0.9, W), 0)

# night: deep blue sky, warm shop key on the characters, cool moon rim
look.world_sky(zenith='#070B1A', horizon='#1E2448', ground='#0B0D15', strength=0.3)
look.sun(azimuth=200, elevation=35, color='#93A8FF', energy=0.12, angle=1.0, name='Moon')
look.area((0.4, -1.4, 3.0), (0.0, -3.8, 1.2), 2.4, '#FFC487', 140.0, name='DoorKey')
look.area((4.5, -9.0, 3.5), (0.0, -4.0, 1.3), 3.0, '#6F8BFF', 90.0, name='StreetFill')

cam = look.camera((2.8, -9.0, 1.55), (-0.25, -3.6, 1.95), lens=31, fstop=2.2, focus=Vector((-0.2, -4.1, 1.75)))
post(haze_color='#141A33', mist_start=8.0, mist_depth=50.0, haze=0.3, bloom=1.1, bloom_threshold=0.8,
     vignette=0.3)
output(opts, 'story_arrival')
print('[story_arrival] OK')
