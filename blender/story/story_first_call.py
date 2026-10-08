"""story_first_call — morning at the Soi 23 win stand: NONG sits on his mint scooter, eyes on the gram phone that just
lit up with his first call, while Aunt Lek waves from her khao-man-gai cart.

    node blender/run-blender.mjs blender/story/story_first_call.py [--draft --tag=d1]
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from mathutils import Vector
from lib.bootstrap import start
from lib.characters_pose import STOOL
from story.kit import look
from story.kit.assets import attach, load, use_models
from story.kit.cast import hero, hero_bike, person
from story.kit.fx import callout, ping, puffs
from story.kit.post import output, post
from story.kit.props import apron, phone, text
from story.kit.stage import Ground, SIDEWALK_H, smat
from story.kit.street import letter_sign, pole_line, shophouse

ctx = start()
use_models(ctx.models_dir)
opts = look.setup(ctx, samples=96, exposure=0.1)
W = SIDEWALK_H

g = Ground()
g.sidewalk(-16, 16, -4.0, 0.2)
g.curb(-16, 16, -4.11, axis='x')
g.carriageway(-40, 40, -40, -4.0)
g.dashes(-7.4, -40, 40, axis='x')
g.build()

# street wall: Aunt Lek's shophouse in the middle, neighbours either side
shophouse(ctx.root, 'bld_shophouse_2f', (-4.2, 0, W), 0, 3, 'กาแฟ')
shophouse(ctx.root, 'bld_shophouse_3f', (0.0, 0, W), 0, 0, 'ข้าวมันไก่ ซอย 23')
shophouse(ctx.root, 'bld_shophouse_4f', (4.2, 0, W), 0, 5, 'ร้านขายยา')
shophouse(ctx.root, 'bld_shophouse_3f', (8.4, 0, W), 0, 2, 'ผลไม้')
shophouse(ctx.root, 'bld_shophouse_2f', (-8.4, 0, W), 0, 6, 'ส้มตำ')

# the win stand ("วิน 23") with a veteran rider on the bench
stand = load('prop_win_stand', (-3.2, -0.95, W), 0)
letter_sign(ctx.root, stand, 'วิน 23', 'taxi_orange', 'cream', size=0.24, node='sign_face')
vet = person(head=['hair_short'], torso=['outfit_vest'],
             colors={'Skin': 'skin_3', 'Hands': 'skin_3', 'Shirt': 'cloth_white', 'Pants': 'ink', 'Hair': 'hair_black'})
vet.place((-3.85, -0.78, W + 0.47 + 0.155), yaw=-25)
vet.pose(STOOL, mirror=True)
vet.pose({'head': (0.12, 0, 0.25)})

# NONG perched side-saddle on the mint scooter (bike in profile, nose towards Aunt Lek), the phone in his lap
bike = hero_bike((-1.25, -2.45, W), yaw=90)
nong = hero()
nong.sit(bike.world('seat_rider'), yaw=8, lift=0.05)
nong.pose({'torso': (0.12, 0, 0), 'head': (0.2, 0, 0.06),
           'thigh_L': (-0.48, -0.1, 0), 'shin_L': (0.42, 0, 0), 'foot_L': (0.08, 0, 0),
           'thigh_R': (-0.62, 0.05, 0), 'shin_R': (0.62, 0, 0), 'foot_R': (0.0, 0, 0),
           'arm_L': (-0.5, 0, -0.36), 'forearm_L': (-1.5, 0, 0), 'hand_L': (0, 0, 0.25),
           'arm_R': (-0.5, 0, 0.36), 'forearm_R': (-1.5, 0, 0), 'hand_R': (0, 0, -0.25)})
hands = [nong.nodes['hand_' + s].matrix_world @ Vector((0, -0.01, -0.075)) for s in 'LR']
eyes = nong.nodes['head'].matrix_world @ Vector((0, -0.12, 0.2))
ph = phone(screen_strength=4.0)
ph.scale = (1.3, 1.3, 1.3)
ph.location = (hands[0] + hands[1]) / 2 + Vector((0, 0, 0.03))
ph.rotation_mode = 'QUATERNION'
ph.rotation_quaternion = (eyes - ph.location).to_track_quat('Z', 'Y')
look.point(ph.location + (eyes - ph.location) * 0.4, '#BFF7EF', 6.0, radius=0.06, name='PhoneGlow')

# Aunt Lek at the end of her khao-man-gai cart, waving at him
cart = load('prop_food_cart', (2.55, -1.45, W), -15)
text(ctx.root, 'ข้าวมันไก่', 0.12, cart.root.matrix_world @ Vector((0.0, -0.37, 1.69)), (90, 0, -15),
     smat('St_CartInk', 'awning_red', rough=0.5), extrude=0.003)
pot = cart.root.matrix_world @ Vector((0.45, 0.05, 1.3))
puffs([(pot + Vector((0.0, 0.0, 0.12)), 0.09, 0.9), (pot + Vector((0.05, 0.02, 0.32)), 0.12, 0.95),
       (pot + Vector((-0.02, 0.03, 0.55)), 0.14, 1.0)], color=(0.9, 0.9, 0.9), alpha=0.35, name='St_Steam')
lek = person(head=[('hair_bun', {'Hair': '#2B2422'})],
             colors={'Skin': 'skin_2', 'Hands': 'skin_2', 'Shirt': 'bougainvillea', 'Pants': 'car_maroon',
                     'Shoes': 'wood'})
bib, skirt = apron(color='cream', trim='awning_red')
attach(bib, lek.nodes['torso'])
attach(skirt, lek.nodes['hips'])
lek.stand(1.2, -1.95, W, yaw=-68)
lek.pose({'arm_R': (-0.25, 1.9, 0), 'forearm_R': (-0.2, 0.7, 0), 'hand_R': (0, 0, -0.3)})
lek.pose({'torso': (0.04, 0.05, -0.1), 'head': (-0.05, -0.06, -0.12), 'arm_L': (-0.45, -0.05, -0.1),
          'forearm_L': (-0.75, 0, 0)})

# neighbourhood: a customer on a stool, the soi sign, plants, a power pole with wires
load('prop_table', (4.45, -2.3, W), 10)
cust = person(head=['hat_cap'], colors={'Skin': 'skin_4', 'Hands': 'skin_4', 'Shirt': 'cloth_blue', 'Pants': 'cloth_khaki',
                                        'Hat': 'cloth_red'})
load('prop_stool', (4.9, -1.95, W), 0, colors={'Plastic': 'taxi_red'})
cust.place((4.9, -1.95, W + 0.44 + 0.155), yaw=125)
cust.pose(STOOL, mirror=True)
load('prop_stool', (4.05, -2.9, W), 30, colors={'Plastic': 'taxi_blue'})
sign = load('prop_soi_sign', (-5.0, -3.55, W), 0)
letter_sign(ctx.root, sign, 'ซอยสุขุมวิท 23', 'sign_blue', 'cream', size=0.13, node='sign_face', depth=0.06)
load('prop_bougainvillea', (-6.2, -0.8, W), 0)
load('prop_bougainvillea', (-3.55, -4.05, W), 30)
load('prop_pot_plant', (0.65, -0.6, W), 0)
load('prop_banana', (6.1, -0.9, W), 120)
pole_line([(6.6, -3.6, W), (-14, -3.6, W)], yaw=0, extra=3)

# morning light: low warm sun from the east, pale blue sky fill, soft haze
look.world_sky(zenith='#7DB0E6', horizon='#F7E6CF', ground='#BBA996', strength=0.9)
look.sun(azimuth=78, elevation=24, color='#FFE2BC', energy=4.2, angle=2.5)
look.area((0.0, -9.0, 4.0), (0.0, -2.0, 1.2), 6.0, '#CFE3FF', 160.0, name='SkyFill')

cam = look.camera((-0.1, -6.5, 2.35), (-0.05, -2.1, 1.45), lens=33, fstop=2.0, focus=ph.location)
post(haze_color='#EFE7DC', mist_start=10.0, mist_depth=60.0, haze=0.35, bloom=0.5, bloom_threshold=1.2,
     vignette=0.22)
side = (cam.location - ph.location).cross(Vector((0, 0, 1))).normalized()
for s in (1, -1):
    ping(ph.location + Vector((0, 0, 0.02)), side * s, cam.location, radii=(0.1, 0.15, 0.2), spread=70)
callout((-0.5, -2.6, 2.12), cam.location, tail_to=ph.location, width=0.6, height=0.37)
output(opts, 'story_first_call')
print('[story_first_call] OK')
