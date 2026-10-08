"""story_garage — NONG's mint scooter parked at night in front of a half-open shophouse shutter under a warm bulb
(garage screen backdrop alt / loading art). The bike sits in the LEFT ~55% of the frame: the garage UI panel docks
right (docs/briefs/app-scenes.md).

    node blender/run-blender.mjs blender/story/story_garage.py [--draft --tag=d1]
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from mathutils import Vector
from lib.bootstrap import start
from story.kit import look
from story.kit.assets import load, use_models
from story.kit.cast import HERO_LOOK, hero_bike
from story.kit.post import output, post
from story.kit.props import bulb
from story.kit.stage import Ground, SIDEWALK_H
from story.kit.street import letter_sign

ctx = start()
use_models(ctx.models_dir)
opts = look.setup(ctx, samples=96, exposure=0.0)
W = SIDEWALK_H

# ground: tiled shop apron in front of the facade (y < 0), curb + road towards the camera
g = Ground(wet=0.25)
g.sidewalk(-14, 14, -4.0, 0.2)
g.curb(-14, 14, -4.11, axis='x')
g.carriageway(-30, 30, -30, -4.0)
g.dashes(-8.5, -14, 14, axis='x', color='white')
g.build()

# the garage: a 3-floor shophouse, shutter half open with the warm interior showing, plus its neighbours
shop = load('bld_shophouse_3f', (0, 0, W), 0, colors={'Wall': 'wall_mint', 'Wall2': 'wall_white',
                                                       'Awning_A': 'awning_blue', 'Shutter': 'shutter'})
shop.glow('Interior_Light', 3.2)
shop.glow('Lamp_Glow', 5.0)
shop.glow('Window', 0.9, '#FFC47A')
letter_sign(ctx.root, shop, 'อู่ NONG', 'ink', 'gram_cyan', size=0.5, glow=6.0)
for x, kind, wall, aw in ((-4.3, 'bld_shophouse_2f', ('wall_salmon', 'wall_cream'), 'awning_red'),
                          (4.3, 'bld_shophouse_4f', ('wall_lemon', 'wall_white'), 'awning_green')):
    n = load(kind, (x, 0, W), 0, colors={'Wall': wall[0], 'Wall2': wall[1], 'Awning_A': aw})
    n.glow('Interior_Light', 0.8)
    n.glow('Window', 0.35, '#FFC47A')
    n.glow('Lamp_Glow', 1.5)

# the hero's bike, helmet resting on the seat, the win vest hung on the pilaster, shop-front clutter
bike = hero_bike((-0.8, -1.75, W), yaw=-18)
helmet = load('helmet_open', colors={'Helmet_Paint': HERO_LOOK['Helmet_Paint']})
seat = bike.world('seat_rider')
helmet.place(seat + Vector((0.0, 0.0, 0.05)), yaw=-55, pitch=-6)
load('outfit_vest', (1.93, -0.36, W + 1.38), yaw=-4)
load('prop_stool', (1.25, -0.55, W), 20, colors={'Plastic': 'taxi_red'})
load('prop_stool', (1.62, -0.85, W), -30, colors={'Plastic': 'taxi_blue'})
load('prop_crates', (-1.55, -0.45, W), 8)
load('prop_pot_plant', (-2.5, -0.65, W), 0)
load('prop_pot_plant', (2.55, -0.6, W), 50)
load('prop_banana', (-3.1, -1.25, W), 40)
load('prop_spirit_house', (-4.4, -1.6, W), 25)
load('prop_bougainvillea', (4.3, -1.15, W), 0)

# lights: warm bulb (key) over the bike, neon accent, cool moon fill, blue rim from the street
bulb((-0.55, -1.4, W + 2.45), drop=0.4, watts=75.0, strength=45.0)
look.world_sky(zenith='#090E1E', horizon='#232A4A', ground='#0E1119', strength=0.25)
look.sun(azimuth=210, elevation=40, color='#9DB4FF', energy=0.10, angle=1.0, name='Moon')
look.point((-4.6, -6.4, 4.0), '#FF9E57', 1100.0, radius=0.5, name='StreetLamp')
look.area((4.2, -3.0, 2.6), (-0.6, -1.4, 0.9), 2.5, '#5C7CFF', 70.0, name='Rim')
look.area((1.0, -7.5, 0.6), (-0.6, -1.4, 0.7), 3.0, '#FFB46B', 18.0, name='Bounce')

cam = look.camera((1.75, -7.5, 1.85), (0.35, -1.2, 1.95), lens=29, fstop=2.0, focus=bike.world('seat_rider'))
post(haze_color='#1C2340', mist_start=6.0, mist_depth=40.0, haze=0.25, bloom=0.9, bloom_threshold=0.9,
     vignette=0.35)
output(opts, 'story_garage')
print('[story_garage] OK')
