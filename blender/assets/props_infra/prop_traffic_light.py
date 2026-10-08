"""prop_traffic_light: Bangkok mast-arm signal with a countdown timer.

Contract frame (matches the runtime placeholder + lookdev placements): the pole stands on the traffic's LEFT
kerb, the mast arm reaches 5 m over the road along the model's +X (three.js +X), and every signal face, lens
and the countdown faces -Y (three.js +Z) toward oncoming traffic. Geometry is authored in a convenient frame
(arm along -Y, faces -X) and baked +90 deg about Z at the end.
Nodes: `body`; `lamp_red` / `lamp_amber` / `lamp_green` (lens meshes of BOTH heads — overhead + pole-mounted —
origin at the overhead lens centre, materials Signal_Red / Signal_Amber / Signal_Green, emissive colour set,
runtime drives emissiveIntensity); `countdown` (flat quad facing -Y, `Sign_Face`, UV 0..1, dark base).
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from mathutils import Matrix, Vector
from lib.bootstrap import start
from lib.palette import mat, hex_to_linear, HEX
from lib.shapes import box, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.props_infra_kit import lathe, tube, shell, uv_quad, bake, ground_cull, recolor, report
from lib.props_infra_preview import previews

NAME = 'prop_traffic_light'
ctx = start()

STEEL = mat('Steel', 'steel', roughness=0.4, metallic=0.25)
DARK = mat('Signal_Housing', 'canopy_black', roughness=0.5)
CONC = mat('Concrete', 'concrete', roughness=0.9)
YEL = mat('Stripe_Yellow', 'lane_yellow', roughness=0.4)
BLK = mat('Stripe_Black', 'ink', roughness=0.5)
COUNT = mat('Sign_Face', 'ink', roughness=0.3)


def signal_mat(name, key):
    """Lens: dimmed base colour (reads as an unlit lens) + full-colour emission at strength 1."""
    m = mat(name, key, roughness=0.15, emission=1.0)
    r, g, b, a = hex_to_linear(HEX[key])
    return recolor(m, (r * 0.35, g * 0.35, b * 0.35, a))


RED = signal_mat('Signal_Red', 'light_tail')
AMB = signal_mat('Signal_Amber', 'light_amber')
GRN = signal_mat('Signal_Green', 'taxi_green')

ARM_Z, ARM_L = 6.0, 5.0
HEAD = (-0.02, -4.35, 5.2)            # overhead head housing centre
POLE_HEAD = (-0.36, 0.0, 2.95)        # pole-mounted repeater head centre
parts = []

footing = box('footing', (0.64, 0.64, 0.26), (0, 0, 0.13), CONC, bevel=0.05, segments=1)
ground_cull(footing)
parts.append(footing)

S, Y, B = 0, 1, 2
prof = [(0.23, 0.26), (0.23, 0.33), (0.185, 0.38), (0.18, 0.9), (0.178, 1.1), (0.176, 1.3),
        (0.14, 6.45), (0.158, 6.48), (0.158, 6.58), (0.0, 6.62)]
parts.append(lathe('pole', prof, segs=10, mats=[STEEL, YEL, BLK], seg_mats=[S, S, S, Y, B, S, S, S, S],
                   cap_bottom=False, smooth=50))
parts.append(tube('arm', [(0, 0.05, ARM_Z), (0, -ARM_L, ARM_Z + 0.12)], 0.09, segs=8, material=STEEL,
                  radii=[0.105, 0.07]))
parts.append(tube('tie', [(0, 0, 6.5), (0, -2.7, ARM_Z + 0.07)], 0.025, segs=5, material=STEEL, caps=False))
parts.append(box('clamp', (0.34, 0.34, 0.36), (0, 0, ARM_Z), STEEL, bevel=0.04, segments=1))


def head(center, scale, lamp_lists, with_count=False):
    """Signal head facing -X: housing, yellow-rimmed backplate, visors; lenses appended to lamp_lists."""
    cx, cy, cz = center
    k = scale
    parts.append(box('housing', (0.34 * k, 0.44 * k, 1.24 * k), center, DARK, bevel=0.08 * k, segments=1))
    parts.append(box('rim', (0.03, 0.72 * k, 1.52 * k), (cx + 0.19 * k, cy, cz), YEL, bevel=0.03 if k > 0.9 else 0.0,
                     segments=1))
    parts.append(box('plate', (0.02, 0.62 * k, 1.42 * k), (cx + 0.17 * k, cy, cz), DARK, bevel=0.0))
    for (mt, lst), dz in zip(lamp_lists, (0.4, 0.0, -0.4)):
        lens = lathe('lens', [(0.14 * k, 0.0), (0.12 * k, 0.045 * k), (0.06 * k, 0.07 * k), (0.0, 0.075 * k)],
                     segs=10 if k > 0.9 else 8, material=mt, cap_bottom=False, smooth=70)
        bake(lens, Matrix.Translation((cx - 0.17 * k, cy, cz + dz * k)) @ Matrix.Rotation(-math.pi / 2, 4, 'Y'))
        lst.append(lens)
        parts.append(shell('visor', 0.165 * k, 0.21 * k, -35, 215, segs=6 if k > 0.9 else 4,
                           center=(cx - 0.17 * k, cy, cz + dz * k), axis=(-1, 0, 0), material=DARK))


lamps = {'red': [], 'amber': [], 'green': []}
lists = [(RED, lamps['red']), (AMB, lamps['amber']), (GRN, lamps['green'])]
head(HEAD, 1.0, lists)
parts.append(box('hanger', (0.08, 0.08, 0.3), (HEAD[0], HEAD[1], ARM_Z - 0.06), STEEL, bevel=0.0))
head(POLE_HEAD, 0.8, lists)
parts.append(box('pole_bracket', (0.26, 0.12, 0.12), (-0.18, 0, POLE_HEAD[2]), STEEL, bevel=0.0))

# countdown timer box beside the overhead head (toward the pole)
CD = (-0.02, -3.62, 5.5)
parts.append(box('cd_box', (0.3, 0.64, 0.5), CD, DARK, bevel=0.05, segments=1))
parts.append(box('cd_hanger', (0.07, 0.07, 0.3), (CD[0], CD[1], ARM_Z - 0.15), STEEL, bevel=0.0))
countdown = uv_quad('countdown', 0.54, 0.38, (CD[0] - 0.153, CD[1], CD[2]), COUNT, facing='-X')

# pedestrian push-button box on the street side of the pole
parts.append(box('ped_box', (0.13, 0.1, 0.2), (0, -0.2, 1.2), YEL, bevel=0.0))
parts.append(box('ped_btn', (0.06, 0.03, 0.06), (0, -0.255, 1.22), BLK, bevel=0.0))

# bake the authoring frame (arm -Y, faces -X) into the contract frame (arm +X, faces -Y)
ROT = Matrix.Rotation(math.pi / 2, 4, 'Z')
for o in parts + sum(lamps.values(), []) + [countdown]:
    bake(o, ROT)


def rot(p):
    return tuple(ROT @ Vector(p))


report(parts + sum(lamps.values(), []) + [countdown], NAME)
body = join(parts, 'body')
set_origin(body, (0, 0, 0))
root = empty(NAME)
set_parent(body, root)
for key, nm in (('red', 'lamp_red'), ('amber', 'lamp_amber'), ('green', 'lamp_green')):
    obj = join(lamps[key], nm)
    dz = {'red': 0.4, 'amber': 0.0, 'green': -0.4}[key]
    set_origin(obj, rot((HEAD[0] - 0.17, HEAD[1], HEAD[2] + dz)))
    set_parent(obj, root)
set_origin(countdown, rot((CD[0] - 0.153, CD[1], CD[2])))
set_parent(countdown, root)
export_glb(ctx, NAME, [root], max_tris=900)
previews(ctx, NAME, view=(0.55, -1.0, 0.55), pad=1.1,
         extra_views=[((0.3, -1.0, 0.25), ((3.2, -0.6, 4.3), (5.0, 0.4, 6.3))),
                      ((-0.4, -1.0, 0.3), ((-0.6, -0.8, 0.0), (0.6, 0.4, 4.0))),
                      (0.6, 1.0, 0.6)])
print('[done]', NAME)
