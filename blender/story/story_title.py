"""story_title — hero key art (mockup 03): a busy Bangkok junction at sunset from the high 3/4 diorama angle. NONG on
the mint scooter rides in his cyan ring between pink and green-yellow taxis, white vans, a blue tuk-tuk and filtering
motos, the gram route painted ahead of him curving into the soi towards the coral pin.

    node blender/run-blender.mjs blender/story/story_title.py [--draft --tag=d1]
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from mathutils import Vector
from lib.bootstrap import start
from lib.characters_pose import RIDER, STOOL
from story.kit import look
from story.kit.assets import load, use_models
from story.kit.cast import hero, hero_bike, person
from story.kit.fx import pin, ring, route
from story.kit.post import output, post
from story.kit.stage import Ground, SIDEWALK_H
from story.kit.street import letter_sign, npc_rider, pole_line, shophouse_row

ctx = start()
use_models(ctx.models_dir)
opts = look.setup(ctx, samples=80, exposure=0.3)
W = SIDEWALK_H
HALF, WALK = 6.8, 4.0            # main road half width (4 lanes), sidewalk width
SOI = (16.0, 23.0)               # cross street (y range)

# ground: main road north-south, soi east-west, sidewalks + curbs cut at the junction, markings
g = Ground(asphalt='#857A70')
g.carriageway(-60, 60, -60, 140)
for sx in (-1, 1):
    x0, x1 = sorted((sx * HALF, sx * (HALF + WALK)))
    for y0, y1 in ((-60, SOI[0]), (SOI[1], 140)):
        g.sidewalk(x0, x1, y0, y1)
        g.curb(y0, y1, sx * (HALF + 0.11), axis='y')
    far0, far1 = sorted((sx * (HALF + WALK), sx * 60))
    g.sidewalk(far0, far1, SOI[0] - WALK - 2.5, SOI[0])     # also paves the corner pocket south of the soi
    g.sidewalk(far0, far1, SOI[1], SOI[1] + WALK)
    c0, c1 = sorted((sx * (HALF + 0.22), sx * 60))
    g.curb(c0, c1, SOI[0] - 0.11, axis='x')
    g.curb(c0, c1, SOI[1] + 0.11, axis='x')
g.double_yellow(0.0, -60, 11.5)
g.double_yellow(0.0, 27.5, 140)
for x in (-3.4, 3.4):
    g.dashes(x, -60, 9.0, dash=3.0, gap=4.0)
    g.dashes(x, 30.0, 140, dash=3.0, gap=4.0)
g.solid(-3.4, 9.0, 12.0, w=0.14)
g.solid(12.1, -HALF, 0.0, axis='x', w=0.4)                          # northbound stop line
g.solid(26.9, 0.0, HALF, axis='x', w=0.4)                           # southbound stop line
g.zebra(-HALF + 0.4, HALF - 0.4, 12.7, 15.5, axis='x')              # crossing south of the junction
g.zebra(-HALF + 0.4, HALF - 0.4, 23.5, 26.3, axis='x')
g.zebra(HALF + 0.6, HALF + 3.6, SOI[0] + 0.4, SOI[1] - 0.4, axis='x')
g.dashes(19.5, HALF + 4.0, 60, axis='x', color='white')
g.build()

# street walls: shophouse rows both sides with lettered signboards, awnings, lit interiors at dusk
WEST_WORDS = ['โจ๊ก', 'ข้าวมันไก่', 'ร้านทอง', 'กาแฟ', 'ส้มตำ', 'ก๋วยเตี๋ยว', 'ผลไม้', 'นวดแผนไทย', 'หมูปิ้ง', 'ชาไทย']
EAST_WORDS = ['ร้านขายยา', 'ซ่อมรถ', 'กาแฟ', 'โจ๊ก', 'ข้าวมันไก่', 'ส้มตำ', 'ร้านทอง', 'ผลไม้', 'ก๋วยเตี๋ยว', 'ชาไทย']
X_FACADE = HALF + WALK
# main-road rows stop short of the junction (their 10 m depth would cross the soi blocks); soi rows start behind them
shophouse_row(ctx.root, (-X_FACADE, -22.0, W), (0, 4.2, 0), 8, 90, seed=1, words=WEST_WORDS, night=0.45)
shophouse_row(ctx.root, (-X_FACADE, 29.2, W), (0, 4.2, 0), 8, 90, seed=6, words=WEST_WORDS[3:], night=0.45)
shophouse_row(ctx.root, (X_FACADE, -22.0, W), (0, 4.2, 0), 8, -90, seed=3, words=EAST_WORDS, night=0.45)
shophouse_row(ctx.root, (X_FACADE, 29.2, W), (0, 4.2, 0), 8, -90, seed=8, words=EAST_WORDS[4:], night=0.45)
for sx, seeds in ((1, (2, 5)), (-1, (7, 9))):
    shophouse_row(ctx.root, (sx * 23.0, SOI[0] - WALK, W), (sx * 4.2, 0, 0), 6, 180, seed=seeds[0], night=0.45)
    shophouse_row(ctx.root, (sx * 23.0, SOI[1] + WALK, W), (sx * 4.2, 0, 0), 6, 0, seed=seeds[1], night=0.45)
for x, y, kind in ((-30, 70, 'bld_condo'), (26, 80, 'bld_office'), (-4, 100, 'bld_condo')):
    load(kind, (x, y, 0), 180)


def car(kind, x, y, north=True, colors=None, braking=0.0):
    v = load(kind, (x, y, 0), 180 if north else 0, colors=colors)
    v.glow('Light_Tail', 2.0)
    if braking:
        v.glow('Light_Brake', braking)
    return v


PINK, GREEN = {'Paint': 'taxi_pink', 'Paint2': 'taxi_pink'}, {'Paint': 'taxi_green', 'Paint2': 'taxi_yellow'}
# northbound (left-hand traffic: x < 0, facing +Y), the hero squeezing up the lane line between them
car('veh_taxi', -5.1, 2.3, colors=PINK, braking=4.0)
car('veh_van', -1.75, 5.2, braking=4.0)
car('veh_taxi', -1.7, -3.6, colors=GREEN)
car('veh_tuktuk', -5.2, 8.6, colors={'Paint': 'tuktuk_blue'}, braking=3.0)
car('veh_van', -5.2, -8.2)
car('veh_sedan', -1.75, -11.5, colors={'Paint': 'car_silver'})
for i, (x, y) in enumerate(((-6.0, 11.0), (-4.4, 10.7), (-2.8, 11.3), (-0.9, 10.9), (-5.9, -1.8), (-3.3, -6.2),
                            (-0.6, -0.8))):
    npc_rider((x, y, 0), 180, seed=10 + i, vest=i % 2 == 0, lights=1.0)
# southbound (x > 0, facing -Y)
car('veh_bus', 5.1, 34.0, north=False)
car('veh_taxi', 1.75, 30.0, north=False, colors=GREEN)
car('veh_van', 5.1, 6.5, north=False)
car('veh_taxi', 1.75, 1.0, north=False, colors=PINK)
car('veh_tuktuk', 5.2, -5.0, north=False, colors={'Paint': 'tuktuk_blue'})
car('veh_sedan', 1.8, -9.0, north=False, colors={'Paint': 'car_navy'})
for i, (x, y) in enumerate(((3.0, 13.0), (4.6, -1.5), (0.9, -13.0), (3.2, -9.5), (6.0, 20.5))):
    npc_rider((x, y, 0), 0, seed=20 + i, vest=i == 1, lights=1.0)
# cross traffic waiting in the soi
load('veh_songthaew', (13.5, 17.7, 0), -90, colors={'Paint': 'taxi_red'})
npc_rider((-12.0, 21.2, 0), -90, seed=30)

# NONG: mint scooter in the cyan ring, the gram route ahead curving right into the soi, the coral pin
bike = hero_bike((-3.35, 0.0, 0), yaw=180)
nong = hero()
nong.sit(bike.world('seat_rider'), yaw=180)
nong.pose(RIDER, mirror=True)
ring((-3.35, 0.0, 0.0), radius=1.3, tube=0.045, strength=6.0)
route([(-3.35, 1.6), (-3.35, 5.0), (-3.0, 8.5), (-2.0, 12.5), (0.2, 16.2), (3.6, 18.6), (7.0, 19.4), (10.2, 19.6)],
      width=0.3, dash=0.9, gap=0.6, chevron_every=4, strength=6.0)
pin((11.6, 19.6, 1.35), scale=1.0, strength=1.8)
ring((11.6, 19.6, 0.0), radius=1.1, tube=0.05, color='pin_coral', strength=5.0, name='St_PinRing')

# pavement life: khao-man-gai cart with diners, plants, bougainvillea, poles + wires, lamps, signals, soi sign
cart = load('prop_food_cart', (-8.3, 9.2, W), 90)
for i, (x, y, yaw) in enumerate(((-9.6, 7.4, 60), (-9.3, 5.8, 120), (-8.0, 6.4, -150))):
    load('prop_stool', (x, y, W), yaw, colors={'Plastic': ['taxi_red', 'taxi_blue', 'taxi_red'][i]})
    p = person(head=[['hair_short', 'hair_bun', 'hat_cap'][i]],
               colors={'Shirt': ['cloth_white', 'bougainvillea', 'cloth_blue'][i], 'Pants': ['denim', 'ink', 'cloth_khaki'][i],
                       'Skin': ['skin_2', 'skin_3', 'skin_1'][i], 'Hands': ['skin_2', 'skin_3', 'skin_1'][i]})
    p.place((x, y, W + 0.44 + 0.155), yaw=yaw)
    p.pose(STOOL, mirror=True)
load('prop_table', (-9.0, 6.6, W), 0)
for (x, y, kind, yaw) in ((-7.6, -2.0, 'prop_bougainvillea', 0), (-7.5, 14.6, 'prop_bougainvillea', 40),
                          (-10.2, 3.0, 'prop_pot_plant', 0), (-10.2, -6.0, 'prop_banana', 30),
                          (8.0, 13.2, 'prop_bougainvillea', 0), (10.2, 3.0, 'prop_pot_plant', 0),
                          (10.0, -4.0, 'prop_banana', 200), (8.6, -12.0, 'prop_raintree', 0),
                          (-7.6, -14.0, 'prop_bin', 90), (7.8, 30.0, 'prop_raintree', 60),
                          (15.5, 10.6, 'prop_raintree', 20), (-15.5, 10.6, 'prop_raintree', 140),
                          (-9.6, -13.5, 'prop_raintree', 75), (9.9, -9.0, 'prop_bougainvillea', 30)):
    load(kind, (x, y, W), yaw)
pole_line([(-7.45, -26.0, W), (-7.45, -6.0, W), (-7.45, 13.4, W)], yaw=90, extra=5)
pole_line([(7.45, -24.0, W), (7.45, -4.0, W), (7.45, 14.6, W)], yaw=90, extra=4)
for x, y, yaw in ((-7.5, -18.0, 90), (7.5, -16.0, -90), (-7.5, 32.0, 90), (7.5, 36.0, -90)):
    load('prop_street_lamp', (x, y, W), yaw).glow('Lamp_Glow', 6.0, '#FFC27A')
for x, y, yaw in ((-7.4, 11.8, 0), (7.4, 27.2, 180)):
    sig = load('prop_traffic_light', (x, y, W), yaw)
    sig.glow('Signal_Green', 8.0).glow('Signal_Red', 0.3).glow('Signal_Amber', 0.3)
sign = load('prop_soi_sign', (7.6, 15.4, W), -90)
letter_sign(ctx.root, sign, 'ซอยสุขุมวิท 23', 'sign_blue', 'cream', size=0.13, node='sign_face', depth=0.06)
for x, y, yaw in ((-9.2, 13.8, -90), (9.4, 10.0, 90), (-9.0, -10.0, 70), (9.1, 20.5, 120)):
    ped = person(head=[('hair_long', {'Hair': 'hair_black'})] if y > 12 else ['hat_cap'],
                 colors={'Shirt': 'wall_lemon' if x < 0 else 'cloth_red', 'Pants': 'denim', 'Skin': 'skin_2', 'Hands': 'skin_2'})
    ped.stand(x, y, W, yaw=yaw)

# sunset: low warm sun from the west raking across the road, purple-blue sky fill, warm haze down the street
look.world_sky(zenith='#8A9FE0', horizon='#FFB880', ground='#8A6E5C', strength=0.7)
look.sun(azimuth=203, elevation=30, color='#FFA055', energy=7.5, angle=1.5)
look.area((0.0, -20.0, 25.0), (0.0, 8.0, 0.0), 30.0, '#B9C4FF', 160.0, name='SkyFill')

cam = look.camera((-6.5, -24.0, 18.0), (0.8, 6.5, 0.0), lens=45, fstop=0.35, focus=bike.world('seat_rider'))
post(haze_color='#FFC79E', mist_start=24.0, mist_depth=70.0, haze=0.45, bloom=0.7, bloom_threshold=1.0,
     vignette=0.3, tint=(1.06, 0.98, 0.86))
output(opts, 'story_title')
print('[story_title] OK')
