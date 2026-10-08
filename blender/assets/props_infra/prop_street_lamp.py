"""prop_street_lamp: 8 m Bangkok street lamp, swan-neck arm reaching over the road (model forward = -Y).

Nodes: `body` (all static geometry, glowing lens included) + empty `lamp` 4 cm under the lens bowl (light origin),
three.js (0, 7.72, 2.05); placed with props_infra_nodes.anchor() and re-checked in the GLB after export.
Lens material `Lamp_Glow` (warm emissive; runtime toggles it with lampsOn). Details: concrete footing,
access door, yellow/black reflective bands, decorative scroll brace, cobra-head housing with a glowing rim band
(readable from the high diorama camera) and a lens bowl bulging below it.
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.props_infra_kit import lathe, tube, ground_cull, report
from lib.props_infra_nodes import anchor, verify_glb_nodes
from lib.props_infra_preview import previews

NAME = 'prop_street_lamp'
ctx = start()

STEEL = mat('Steel', 'steel', roughness=0.4, metallic=0.25)
DARK = mat('Metal_Dark', 'metal_dark', roughness=0.5)
CONC = mat('Concrete', 'concrete', roughness=0.9)
YEL = mat('Stripe_Yellow', 'lane_yellow', roughness=0.4)
BLK = mat('Stripe_Black', 'ink', roughness=0.5)
HOUSING = mat('Lamp_Housing', 'car_silver', roughness=0.35)
GLOW = mat('Lamp_Glow', 'light_head', roughness=0.2, emission=1.2)

HEAD = (0.0, -2.05, 7.92)    # lamp head centre
parts = []

footing = box('footing', (0.8, 0.8, 0.32), (0, 0, 0.16), CONC, bevel=0.07, segments=1)
ground_cull(footing)
parts.append(footing)

S, D, Y, B = 0, 1, 2, 3
prof = [(0.29, 0.32), (0.29, 0.40), (0.245, 0.46), (0.235, 0.98), (0.22, 1.01),        # dark base sleeve
        (0.218, 1.12), (0.216, 1.27), (0.214, 1.42), (0.212, 1.57),                 # y / b / y bands
        (0.165, 6.95), (0.195, 6.98), (0.195, 7.08), (0.115, 7.14), (0.0, 7.16)]    # top collar + cap
seg_mats = [D, D, D, D, S, Y, B, Y, S, D, D, D, D]
parts.append(lathe('pole', prof, segs=12, mats=[STEEL, DARK, YEL, BLK], seg_mats=seg_mats,
                   cap_bottom=False, smooth=50))
parts.append(box('door', (0.17, 0.03, 0.34), (0, -0.24, 0.72), DARK, bevel=0.012, segments=1))

# swan-neck arm, tapering toward the head
arm_pts = [(0, 0, 6.9), (0, 0, 7.42), (0, -0.15, 7.72), (0, -0.45, 7.92), (0, -0.88, 8.02),
           (0, -1.34, 8.03), (0, -1.68, 7.98)]
parts.append(tube('arm', arm_pts, 0.08, segs=8, radii=[0.15, 0.135, 0.12, 0.108, 0.1, 0.095, 0.092],
                  material=STEEL))

# decorative scroll brace under the arm
brace = [(0, -0.08, 6.2), (0, -0.3, 6.45), (0, -0.55, 6.85), (0, -0.74, 7.35), (0, -0.82, 7.75),
         (0, -0.8, 7.95)]
parts.append(tube('brace', brace, 0.052, segs=6, material=STEEL))

# cobra head: squashed dome housing; a glowing rim band (flares out, then tucks in so its upper face is seen from
# the high diorama camera), a dark lip, and a glowing lens bowl bulging below the rim
hx, hy, hz = HEAD
dome = [(1.07, -0.06), (1.11, -0.01), (1.08, 0.035), (1.0, 0.055), (0.96, 0.13), (0.82, 0.22), (0.5, 0.28),
        (0.0, 0.295)]
parts.append(lathe('housing', [(r, hz + z) for r, z in dome], segs=14, loc=(hx, hy, 0), sx=0.37, sy=0.62,
                   mats=[DARK, HOUSING, GLOW], seg_mats=[2, 2, 0, 1, 1, 1, 1], cap_bottom=False, smooth=70))
lens = [(0.0, -0.16), (0.55, -0.145), (0.92, -0.1), (1.07, -0.06)]
parts.append(lathe('lens', [(r, hz + z) for r, z in lens], segs=14, loc=(hx, hy, 0), sx=0.37, sy=0.62,
                   material=GLOW, cap_top=False, smooth=70))
report(parts, NAME)
body = join(parts, 'body')
set_origin(body, (0, 0, 0))
LAMP = (hx, hy, hz - 0.2)     # light origin 4 cm under the lens bowl
root = empty(NAME)
set_parent(body, root)
anchor('lamp', LAMP, root)
glb = export_glb(ctx, NAME, [root], max_tris=900)
verify_glb_nodes(glb, {'lamp': LAMP})
previews(ctx, NAME, view=(1.0, -0.9, 0.55), extra_views=[(1.0, 0.1, 0.05), (0.6, -1.0, -0.15)], pad=1.45)
print('[done]', NAME)
