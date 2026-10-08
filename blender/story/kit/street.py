"""Street dressing for the story dioramas: shophouses with recoloured walls / awnings and lettered signboards,
power-pole lines with sagging (messy, Bangkok-style) wire bundles, and NPC riders on bikes.
"""
import math
import random
import bpy
from mathutils import Vector
from story.kit.assets import load
from story.kit.cast import person
from story.kit.props import text, wire
from story.kit.stage import smat
from lib.characters_pose import RIDER

# wall / wall2 pairs and awning colours seen across the city view
WALLS = [('wall_cream', 'wall_salmon'), ('wall_mint', 'wall_white'), ('wall_lemon', 'wall_cream'),
         ('wall_powder', 'wall_white'), ('wall_pink', 'wall_cream'), ('wall_salmon', 'wall_white'),
         ('wall_white', 'wall_mint')]
AWNINGS = ['awning_red', 'awning_green', 'awning_blue', 'awning_red', 'taxi_orange']
SHOP_SIGNS = ['ข้าวมันไก่', 'ก๋วยเตี๋ยว', 'กาแฟ', 'ร้านทอง', 'นวดแผนไทย', 'ซ่อมรถ', 'ส้มตำ', 'ร้านขายยา', 'โจ๊ก',
              'ผลไม้', 'หมูปิ้ง', 'ชาไทย']
SIGN_STYLES = [('ink', 'cream'), ('cream', 'awning_red'), ('sign_blue', 'cream'), ('cream', 'sign_green'),
               ('#7A2A35', 'temple_gold'), ('wall_white', 'ink')]


def facing(yaw):
    a = math.radians(yaw)
    return Vector((math.sin(a), -math.cos(a), 0))


def letter_sign(root, inst, words, board, ink, size=0.5, node='signboard', depth=0.012, glow=0.0):
    """Recolour a signboard quad and letter it (text centred on the quad, facing the model's front).
    glow > 0 makes the lettering emissive (neon / back-lit sign)."""
    sign = inst.nodes.get(node)
    if sign is None:
        return None
    inst.color('Sign_Face', board)
    bpy.context.view_layer.update()
    pts = [sign.matrix_world @ Vector(c) for c in sign.bound_box]
    centre = sum(pts, Vector()) / 8
    yaw = math.degrees(inst.root.rotation_euler.z)
    loc = centre + facing(yaw) * depth
    ink_mat = smat('St_SignInk', ink, rough=0.45, emission=glow)
    return text(root, words, size, loc, (90, 0, yaw), ink_mat, extrude=0.006)


def shophouse(root, kind, loc, yaw, seed, words=None, night=0.0):
    rnd = random.Random(seed)
    wall, wall2 = WALLS[seed % len(WALLS)]
    inst = load(kind, loc, yaw, colors={'Wall': wall, 'Wall2': wall2, 'Awning_A': AWNINGS[seed % len(AWNINGS)]})
    board, ink = SIGN_STYLES[rnd.randrange(len(SIGN_STYLES))]
    if words is not False:
        letter_sign(root, inst, words or SHOP_SIGNS[seed % len(SHOP_SIGNS)], board, ink)
    if night > 0:
        inst.glow('Window', 1.6 * night, '#FFC47A')
        inst.glow('Interior_Light', 2.4 + 2.5 * night)
        inst.glow('Lamp_Glow', 3.0 + 4.0 * night)
    return inst


def shophouse_row(root, start, step, count, yaw, seed=0, kinds=('bld_shophouse_3f', 'bld_shophouse_2f',
                                                                   'bld_shophouse_4f', 'bld_shophouse_3f'),
                  words=None, night=0.0):
    """count shophouses from `start` every `step` (a Vector, ~4 m) all facing `yaw`."""
    out = []
    for i in range(count):
        p = Vector(start) + Vector(step) * i
        w = words[i] if words and i < len(words) else None
        out.append(shophouse(root, kinds[(seed + i) % len(kinds)], p, yaw, seed + i, w, night))
    return out


def pole_line(points, yaw=0.0, seed=4, extra=4, sag=0.55):
    """Power poles at `points` with the four insulator wires plus `extra` loose cable bundles per span."""
    rnd = random.Random(seed)
    cable = smat('St_Cable', '#1b1d22', rough=0.55)
    poles = [load('prop_power_pole', p, yaw) for p in points]
    for a, b in zip(poles, poles[1:]):
        for k in range(4):
            wire(a.world(f'wire_{k}'), b.world(f'wire_{k}'), sag=sag * rnd.uniform(0.8, 1.2), radius=0.011, mat=cable)
        top_a, top_b = a.world('wire_2'), b.world('wire_2')
        for _ in range(extra):
            off_a = Vector((rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), rnd.uniform(-1.4, -0.5)))
            off_b = Vector((rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), rnd.uniform(-1.4, -0.5)))
            wire(top_a + off_a, top_b + off_b, sag=sag * rnd.uniform(1.0, 2.0), radius=rnd.uniform(0.012, 0.03),
                 mat=cable)
    return poles


NPC_HELMETS = [('helmet_full', 'taxi_red'), ('helmet_open', 'cloth_green'), ('helmet_half', 'car_white'),
               ('helmet_full', 'ink'), ('helmet_open', 'taxi_blue'), ('helmet_half', 'taxi_yellow'),
               ('helmet_cat', 'bougainvillea')]
NPC_SHIRTS = ['cloth_white', 'cloth_blue', 'cloth_green', 'cloth_red', 'cloth_khaki', 'wall_powder', 'taxi_orange']
NPC_BIKES = [('bike_cub', 'taxi_red'), ('bike_scooter', 'car_black'), ('bike_cub', 'taxi_blue'),
             ('bike_sport', 'car_white'), ('bike_scooter', 'car_silver'), ('bike_cub', 'car_navy')]


def npc_rider(loc, yaw, seed, vest=False, lights=0.0):
    """A traffic moto: random bike + rider in RIDER pose (win vest on some)."""
    rnd = random.Random(seed)
    bike_name, paint = NPC_BIKES[seed % len(NPC_BIKES)]
    bike = load(bike_name, loc, yaw, colors={'Paint': paint})
    helm, hcol = NPC_HELMETS[seed % len(NPC_HELMETS)]
    torso = [('outfit_vest', {})] if vest else []
    skin = ['skin_2', 'skin_3', 'skin_4', 'skin_1'][rnd.randrange(4)]
    rider = person(head=[(helm, {'Helmet_Paint': hcol})], torso=torso,
                   colors={'Shirt': NPC_SHIRTS[seed % len(NPC_SHIRTS)], 'Pants': ['denim', 'ink', 'cloth_khaki'][seed % 3],
                           'Skin': skin, 'Hands': skin})
    rider.sit(bike.world('seat_rider'), yaw)
    rider.pose(RIDER, mirror=True)
    if lights > 0:
        bike.glow('Light_Tail', lights * 3.0)
        bike.glow('Light_Head', lights * 2.5)
    return bike, rider
