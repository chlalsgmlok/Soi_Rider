"""story_rain — a sudden downpour at dusk: NONG has pulled up under a striped shophouse awning and turns round to
hand his passenger a yellow rain poncho, while the traffic hisses past on the wet, mirror-bright road.

    node blender/run-blender.mjs blender/story/story_rain.py [--draft --tag=d1]
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from mathutils import Vector
from lib.bootstrap import start
from story.kit import look
from story.kit.assets import load, use_models
from story.kit.cast import SPARE_HELMET, hero, hero_bike, person
from story.kit.fx import rain, ripples
from story.kit.post import output, post
from story.kit.stage import Ground, SIDEWALK_H
from story.kit.street import npc_rider, shophouse_row

ctx = start()
use_models(ctx.models_dir)
opts = look.setup(ctx, samples=128, exposure=0.2)
W = SIDEWALK_H

g = Ground(wet=1.0)
g.sidewalk(-30, 30, -4.0, 0.2)
g.curb(-30, 30, -4.11, axis='x')
g.carriageway(-60, 60, -40, -4.0)
g.dashes(-7.4, -60, 60, axis='x')
g.double_yellow(-10.8, -60, 60, axis='x')
g.dashes(-14.2, -60, 60, axis='x')
g.build()

shops = shophouse_row(ctx.root, (-18.9, 0, W), (4.2, 0, 0), 9, 0, seed=2, night=0.8,
                      words=['ส้มตำ', 'กาแฟ', 'ร้านทอง', 'ก๋วยเตี๋ยว', 'ร้านขายยา', 'ซ่อมรถ', 'นวดแผนไทย', 'โจ๊ก', 'ผลไม้'])
shelter = shops[4]                                   # the red-and-white awning the bike stops under (x = -2.1)
shelter.color('Awning_A', 'awning_red')
shelter.glow('Lamp_Glow', 9.0)

# NONG under the awning edge, twisting round with the poncho; the passenger reaching for it
bike = hero_bike((-1.75, -1.0, W), yaw=-90)
bike.glow('Light_Tail', 4.0)
nong = hero()
nong.sit(bike.world('seat_rider'), yaw=-90)
nong.pose({'torso': (0.04, 0.0, 0.55), 'head': (-0.08, 0.0, 0.62),
           'thigh_L': (-1.25, -0.12, 0), 'shin_L': (1.15, 0, 0), 'foot_L': (0.1, 0, 0),
           'thigh_R': (-1.25, 0.12, 0), 'shin_R': (1.15, 0, 0), 'foot_R': (0.1, 0, 0),
           'arm_R': (-1.0, 0, 0.5), 'forearm_R': (-0.45, 0, 0),
           'arm_L': (0.0, -1.62, 0.42), 'forearm_L': (-0.3, 0, 0), 'hand_L': (0, 0, 0)})
pas = person(head=[('hair_long', {'Hair': 'hair_black'}), (SPARE_HELMET[0], {'Helmet_Paint': SPARE_HELMET[1]})],
             colors={'Skin': 'skin_1', 'Hands': 'skin_1', 'Shirt': 'cloth_white', 'Pants': 'car_navy',
                     'Shoes': 'cloth_red'})
pas.sit(bike.world('seat_pillion'), yaw=-90, lift=0.05)
pas.pose({'torso': (0.08, -0.04, 0.3), 'head': (-0.15, 0, 0.42),
          'thigh_L': (-1.3, -0.22, 0), 'shin_L': (1.25, 0, 0), 'foot_L': (0.05, 0, 0),
          'thigh_R': (-1.3, 0.22, 0), 'shin_R': (1.25, 0, 0), 'foot_R': (0.05, 0, 0),
          'arm_L': (-1.15, -0.35, 0.55), 'forearm_L': (-0.35, 0, 0),
          'arm_R': (-1.3, 0.0, 0.75), 'forearm_R': (-0.4, 0, 0)})
grip = nong.nodes['hand_L'].matrix_world @ Vector((0, -0.01, -0.09))
poncho = load('outfit_poncho', (0, 0, 0))
poncho.place(grip - Vector((0, 0, 0.41)), yaw=-47, pitch=-6, roll=-10)

# traffic in the rain: eastbound on the near lanes, driving away from the camera (tail lights on the wet road)
taxi = load('veh_taxi', (4.6, -6.1, 0), 90, colors={'Paint': 'taxi_pink', 'Paint2': 'taxi_pink'})
taxi.glow('Light_Tail', 10.0).glow('Light_Brake', 8.0).glow('Sign_Taxi', 3.0)
tuk = load('veh_tuktuk', (11.5, -5.6, 0), 90)
tuk.glow('Light_Tail', 10.0).glow('Light_Brake', 8.0).glow('Light_Deco', 4.0)
bus = load('veh_bus', (24.0, -8.4, 0), 90)
bus.glow('Light_Tail', 9.0).glow('Light_Brake', 6.0)
moto, _rider = npc_rider((1.2, -5.1, 0), 90, seed=3, lights=3.0)
van = load('veh_van', (21.0, -13.4, 0), -90)
van.glow('Light_Head', 7.0)
for x in (-12.0, 6.0, 24.0):
    lamp = load('prop_street_lamp', (x, -3.75, W), 0)
    lamp.glow('Lamp_Glow', 12.0, '#FFB766')
    look.point(lamp.world('lamp') + Vector((0, 0, -0.3)), '#FF9C4A', 900.0, radius=0.3, name='Sodium')

# rain: streaks over the road and pavement, a curtain dripping off the awning, ripples on the wet asphalt
cam_loc = Vector((-11.0, -7.6, 1.9))
rain((6.0, -6.5, 3.0), (40.0, 13.0, 6.5), 9500, cam_loc, seed=1)
rain((-2.1, -1.68, 1.25), (4.0, 0.12, 2.4), 220, cam_loc, length=(0.12, 0.3), width=0.007, wind=(0.0, 0.0),
     strength=1.3, alpha=0.6, seed=2, name='St_Drips')
ripples((-14, 30, -17, -4.3), 1100, r=(0.03, 0.1), seed=4, strength=0.12)
ripples((-8, 12, -3.9, -1.75), 160, r=(0.03, 0.08), z=W + 0.004, seed=5, strength=0.1)

# dusk storm light: dark blue sky, warm shop light (key on the characters), cool rim from the street
look.world_sky(zenith='#1E2740', horizon='#4D5574', ground='#191C26', strength=0.45)
look.sun(azimuth=250, elevation=8, color='#FFB27A', energy=0.25, angle=4.0, name='LastLight')
look.area((-1.8, -0.4, 2.2), (-1.8, -1.2, 1.3), 1.6, '#FFC487', 90.0, name='AwningKey')
look.area((-6.0, -6.0, 3.0), (-1.8, -1.0, 1.4), 3.0, '#7F9DFF', 120.0, name='StreetFill')
look.area((4.0, -2.5, 2.8), (-1.6, -1.0, 1.4), 2.0, '#9FB4FF', 110.0, name='Rim')

cam = look.camera(cam_loc, (2.0, -3.0, 1.15), lens=45, fstop=2.0, focus=grip)
post(haze_color='#3C4766', mist_start=6.0, mist_depth=45.0, haze=0.5, bloom=1.0, bloom_threshold=0.9,
     vignette=0.32)
output(opts, 'story_rain')
print('[story_rain] OK')
