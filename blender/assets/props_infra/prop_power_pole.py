"""prop_power_pole: 9 m tapered square concrete pole, the backbone of Bangkok's overhead "spaghetti".

Crossarms run along Y (across the street) so runtime catenary wires between neighbouring poles run along X.
Nodes: `body` + empties `wire_0`..`wire_3` in the insulator head grooves (placed with props_infra_nodes.anchor(),
re-checked in the written GLB): three.js (-0.26, 8.85, +-0.88) upper arm, (-0.27, 7.99, +-0.62) lower arm.
  wire_0 / wire_1 = upper arm, street side (-Y) / building side (+Y); wire_2 / wire_3 = lower arm, same order.
Details: black/white base bands, step pegs, yellow pole-number plate, pole-mounted transformer tank with
fins + bushings + drop leads, telecom junction box with conduit, fat spare cable coil hung on the pole.
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from mathutils import Matrix
from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, torus, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.props_infra_kit import lathe, tube, finish, bake, catenary, uv_quad, report
from lib.props_infra_nodes import anchor, verify_glb_nodes
from lib.props_infra_preview import previews

NAME = 'prop_power_pole'
ctx = start()

POLE = mat('Pole_Concrete', '#A8A39B', roughness=0.85)    # light warm concrete (was dark asphalt grey-brown)
WHITE = mat('Stripe_White', 'curb_white', roughness=0.6)
BLACK = mat('Stripe_Black', 'ink', roughness=0.6)
STEEL = mat('Steel', 'steel', roughness=0.45, metallic=0.25)
PORC = mat('Porcelain', 'cream', roughness=0.25)
TANK = mat('Transformer', 'car_silver', roughness=0.45)
CABLE = mat('Cable', 'ink', roughness=0.5)
BOXG = mat('Box_Gray', 'plastic_gray', roughness=0.6)
PLATE = mat('Plate_Yellow', 'plate_yellow', roughness=0.4)

H = 9.0
parts = []


def sq(hw):
    """lathe radius for a square of half-width hw (segs=4, phase=pi/4)."""
    return hw * math.sqrt(2)


def hw_at(z):
    """half-width of the tapered square pole at height z."""
    return 0.27 - 0.11 * z / H


# tapered square pole with black/white base bands
P, W, B = 0, 1, 2
zs = [0.0, 0.5, 0.75, 1.0, 1.25, 1.5, H]
hws = [hw_at(z) for z in zs]
prof = [(sq(hw), z) for hw, z in zip(hws, zs)] + [(sq(0.12), H + 0.05), (0.0, H + 0.06)]
pole = lathe('pole', prof, segs=4, phase=math.pi / 4, mats=[POLE, WHITE, BLACK],
             seg_mats=[P, W, B, W, B, P, P, P], cap_bottom=False, smooth=30)
finish(pole, bevel=0.055, segments=1, smooth=50, limit=40)
parts.append(pole)


# crossarms (along Y) + diagonal braces
UP_Z, LO_Z = 8.5, 7.65
for nm, z, ln in (('arm_up', UP_Z, 2.0), ('arm_lo', LO_Z, 1.5)):
    parts.append(box(nm, (0.19, ln, 0.19), (-hw_at(z) - 0.095, 0, z), STEEL, bevel=0.045, segments=1))
    for s in (-1, 1):
        x = -hw_at(z) - 0.08
        parts.append(tube(f'{nm}_brace{s}', [(x, s * ln * 0.36, z - 0.08), (x, s * 0.14, z - 0.6)], 0.03,
                          segs=4, material=STEEL, caps=False))

# pin insulators (porcelain) on the arms, empties at their tips
ins = [(-0.88, UP_Z), (0.88, UP_Z), (-0.62, LO_Z), (0.62, LO_Z)]
iprof = [(r * 1.4, z * 1.4) for r, z in ((0.05, 0.0), (0.11, 0.05), (0.098, 0.125), (0.045, 0.185), (0.0, 0.2))]
tips = []
for i, (y, z) in enumerate(ins):
    x = -hw_at(z) - 0.095
    parts.append(lathe(f'ins{i}', iprof, segs=6, loc=(x, y, z + 0.095), material=PORC, cap_bottom=False, smooth=60))
    tips.append((x, y, z + 0.095 + 0.25))    # in the head groove, 3 cm under the dome top

# step pegs, alternating sides
for k in range(4):
    z = 2.9 + k * 1.0
    s = 1 if k % 2 else -1
    peg = lathe(f'peg{k}', [(0.026, 0.0), (0.026, 0.2), (0.0, 0.215)], segs=4, phase=math.pi / 4, material=STEEL,
                cap_bottom=False, smooth=60)
    bake(peg, Matrix.Translation((0, s * (hw_at(z) - 0.02), z)) @ Matrix.Rotation(-s * math.pi / 2, 4, 'X'))
    parts.append(peg)

# pole number plate (street side)
parts.append(uv_quad('plate', 0.19, 0.26, (0, -hw_at(2.3) - 0.005, 2.3), PLATE))
parts.append(uv_quad('plate_band', 0.14, 0.055, (0, -hw_at(2.3) - 0.01, 2.34), BLACK))

# transformer tank on the +X side
TX, TZ = hw_at(5.9) + 0.33, 5.55
tank = [(r * 1.22, z * 1.22) for r, z in ((0.25, 0.0), (0.26, 0.04), (0.26, 0.62), (0.235, 0.67), (0.18, 0.71),
                                       (0.0, 0.725))]
parts.append(lathe('tank', tank, segs=8, loc=(TX, 0, TZ), material=TANK, cap_bottom=True, smooth=50))
for k, a in enumerate((-50, 0, 50)):
    r = math.radians(a)
    parts.append(box(f'fin{k}', (0.14, 0.035, 0.58), (TX + 0.35 * math.cos(r), 0.35 * math.sin(r), TZ + 0.4),
                     TANK, bevel=0.0, rot=(0, 0, r)))
parts.append(box('strap', (0.07, 0.42, 0.08), (hw_at(6.1) + 0.035, 0, TZ + 0.55), STEEL, bevel=0.0))
parts.append(box('shelf', (0.74, 0.5, 0.06), (TX - 0.03, 0, TZ - 0.035), STEEL, bevel=0.0))
for k, y in enumerate((-0.1, 0.1)):
    parts.append(lathe(f'bush{k}', [(0.055, 0.0), (0.062, 0.06), (0.036, 0.12), (0.0, 0.135)], segs=6,
                       loc=(TX + 0.06, y * 1.2, TZ + 0.87), material=PORC, cap_bottom=False, smooth=60))
    lead = catenary((TX + 0.06, y * 1.2, TZ + 1.0), (-hw_at(LO_Z) - 0.09, y * 6.2, LO_Z + 0.25), -0.25, 3)
    parts.append(tube(f'lead{k}', lead, 0.018, segs=4, material=CABLE, caps=False))

# telecom junction box + conduit on the -X side, spare cable coil above it
JX = -hw_at(3.2) - 0.09
parts.append(box('jbox', (0.18, 0.3, 0.38), (JX, 0, 3.2), BOXG, bevel=0.03, segments=1))
parts.append(tube('conduit', [(JX + 0.02, 0.0, 0.0), (JX + 0.02, 0.0, 3.03)], 0.03, segs=5, material=BOXG,
                  caps=False))
parts.append(tube('riser', [(JX + 0.02, 0.06, 3.37), (JX + 0.03, 0.06, 4.6), (JX - 0.02, 0.05, 6.3)], 0.022,
                  segs=4, material=CABLE, caps=False))
coil = torus('coil', 0.24, 0.065, (-hw_at(5.2) - 0.075, 0, 5.05), CABLE, rot=(0, math.pi / 2, 0),
             major_seg=10, minor_seg=5)
parts.append(coil)
parts.append(box('tie', (0.06, 0.1, 0.1), (-hw_at(5.3) - 0.02, 0, 5.3), CABLE, bevel=0.0))

report(parts, NAME)
body = join(parts, 'body')
set_origin(body, (0, 0, 0))
root = empty(NAME)
set_parent(body, root)
for i, t in enumerate(tips):
    anchor(f'wire_{i}', t, root)
glb = export_glb(ctx, NAME, [root], max_tris=900)
verify_glb_nodes(glb, {f'wire_{i}': t for i, t in enumerate(tips)})
previews(ctx, NAME, view=(-1.0, -0.9, 0.6), pad=1.2,
         extra_views=[((-1.0, -0.8, 0.5), ((-1.1, -1.1, 4.6), (0.9, 1.1, 9.4))),
                      ((1.0, -0.9, 0.35), ((-1.0, -1.0, 4.6), (1.0, 1.0, 9.4))),
                      ((-0.8, -1.0, 0.45), ((-0.5, -0.5, 0.0), (0.5, 0.5, 3.6)))])
print('[done]', NAME)
