"""prop_bus_stop: Bangkok BMTA-style shelter on a paving slab, open toward the street (-Y).

Curved white canopy with a blue fascia, blue frame, glass back panel with a route map, wooden bench,
backlit gram app ad (cyan + coral pin), and a bus-stop flag pole at the model's right end (-X) whose
plates face along the street (+-X) so approaching riders read them.
Nodes: `body` + `sign_face` (route-number plate under the bus pictogram, both sides, `Sign_Face`, UV 0..1).
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, sphere, empty, join, set_origin, set_parent
from lib.export import export_glb
from mathutils import Matrix
from lib.props_infra_kit import lathe, tube, extrude, uv_quad, arc, bake, ground_cull, report
from lib.props_infra_preview import previews

NAME = 'prop_bus_stop'
ctx = start()

SLAB = mat('Paving', 'sidewalk', roughness=0.9)
FRAME = mat('Frame_Blue', 'awning_blue', roughness=0.4)
ROOF = mat('Roof_White', 'trim_white', roughness=0.45)
GLASS = mat('Glass_Panel', 'glass_light', roughness=0.12)
WOOD = mat('Bench_Wood', 'wood_light', roughness=0.6)
STEEL = mat('Steel', 'steel', roughness=0.4, metallic=0.25)
AD = mat('Ad_Cyan', 'gram_cyan', roughness=0.35, emission=0.35)
PIN = mat('Ad_Pin', 'pin_coral', roughness=0.35)
WHITE = mat('Sign_White', 'plate_white', roughness=0.4)
BLUE = mat('Sign_Blue', 'sign_blue', roughness=0.45)
FACE = mat('Sign_Face', 'plate_white', roughness=0.45)
INK = mat('Ink', 'ink', roughness=0.5)
LINE_R = mat('Map_Red', 'bus_red', roughness=0.5)
LINE_G = mat('Map_Green', 'taxi_green', roughness=0.5)

W = 3.9
parts = []

slab = box('slab', (4.3, 1.9, 0.1), (0, -0.05, 0.05), SLAB, bevel=0.03, segments=1)
ground_cull(slab)
parts.append(slab)

# rear posts
for x in (-1.7, 1.7):
    parts.append(tube(f'post{x:+.0f}', [(x, 0.62, 0.1), (x, 0.62, 2.45)], 0.06, segs=10, material=FRAME, caps=False))

# curved canopy: band between two arcs (y, z) extruded along X
CY, CZ, R0, R1 = -0.1, 1.38, 1.32, 1.25
outer = arc(CY, CZ, R0, 47, 133, 9)
inner = arc(CY, CZ, R1, 133, 47, 9)
parts.append(extrude('roof', outer + inner, W, u=(0, 1, 0), v=(0, 0, 1), material=ROOF, smooth=35))
for nm, a in (('lip_front', 133), ('lip_back', 47)):
    y, z = CY + (R0 + R1) / 2 * math.cos(math.radians(a)), CZ + (R0 + R1) / 2 * math.sin(math.radians(a))
    parts.append(tube(nm, [(-W / 2 - 0.02, y, z), (W / 2 + 0.02, y, z)], 0.055, segs=8, material=FRAME))
# ribs under the canopy, from the post tops out to the front lip
for x in (-1.7, 1.7):
    rib = [(x, y, z) for y, z in arc(CY, CZ, R1 - 0.04, 52, 128, 4)]
    parts.append(tube(f'rib{x:+.0f}', [(x, 0.62, 2.45)] + rib[1:], 0.04, segs=4, material=FRAME, caps=False))

# glass back panel with top/bottom rails and a route map
parts.append(box('glass', (2.25, 0.03, 1.5), (-0.575, 0.62, 1.35), GLASS, bevel=0.0))
for z in (0.58, 2.12):
    parts.append(tube(f'rail{z}', [(-1.7, 0.62, z), (1.7, 0.62, z)], 0.035, segs=6, material=FRAME, caps=False))
parts.append(box('map', (0.7, 0.02, 0.5), (-1.05, 0.6, 1.55), WHITE, bevel=0.0))
for k, (m, z) in enumerate(((LINE_R, 1.66), (BLUE, 1.55), (LINE_G, 1.44))):
    parts.append(box(f'line{k}', (0.56, 0.012, 0.035), (-1.05 + 0.03 * k, 0.588, z), m, bevel=0.0))

# bench
parts.append(box('seat', (2.3, 0.44, 0.07), (-0.4, 0.32, 0.47), WOOD, bevel=0.03, segments=1))
for x in (-1.35, 0.55):
    parts.append(box(f'leg{x:+.1f}', (0.07, 0.34, 0.37), (x, 0.32, 0.27), STEEL, bevel=0.0))

# gram ad lightbox at the model's left end
parts.append(box('adbox', (1.1, 0.14, 1.62), (1.1, 0.6, 1.25), FRAME, bevel=0.035, segments=1))
parts.append(box('adface', (0.94, 0.02, 1.44), (1.1, 0.525, 1.25), AD, bevel=0.0))
parts.append(sphere('pin_head', 0.17, (1.1, 0.5, 1.45), PIN, segments=10, rings=5))
parts.append(lathe('pin_tip', [(0.0, -0.2), (0.12, 0.0)], segs=10, loc=(1.1, 0.5, 1.37), material=PIN,
                   cap_bottom=False, cap_top=True))
parts.append(lathe('pin_dot', [(0.0, 0.0), (0.065, 0.0), (0.065, 0.02), (0.0, 0.025)], segs=8, loc=(0, 0, 0),
                   material=WHITE, smooth=40))
bake(parts[-1], Matrix.Translation((1.1, 0.345, 1.47)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
parts.append(box('ad_bar', (0.62, 0.02, 0.1), (1.1, 0.515, 0.88), WHITE, bevel=0.0))

# bus-stop flag pole: pictogram plate + route plate, both facing +-X
PX, PY = -2.35, -0.55
parts.append(tube('flag_pole', [(PX, PY, 0.0), (PX, PY, 3.0)], 0.05, segs=8, material=STEEL))
parts.append(box('flag_plate', (0.05, 0.66, 0.6), (PX, PY - 0.0, 2.68), WHITE, bevel=0.03, segments=1))
for s in (-1, 1):
    parts.append(box(f'flag_blue{s}', (0.012, 0.56, 0.5), (PX + s * 0.028, PY, 2.68), BLUE, bevel=0.0))
    parts.append(box(f'bus{s}', (0.012, 0.36, 0.2), (PX + s * 0.036, PY, 2.7), WHITE, bevel=0.0))
    for dy in (-0.11, 0.11):
        parts.append(box(f'wheel{s}{dy}', (0.012, 0.07, 0.07), (PX + s * 0.04, PY + dy, 2.58), INK, bevel=0.0))
parts.append(box('route_plate', (0.05, 0.66, 0.42), (PX, PY, 2.14), BLUE, bevel=0.03, segments=1))

report(parts, NAME)
body = join(parts, 'body')
set_origin(body, (0, 0, 0))
qf = uv_quad('route_front', 0.58, 0.34, (PX - 0.028, PY, 2.14), FACE, facing='-X')
qb = uv_quad('route_back', 0.58, 0.34, (PX + 0.028, PY, 2.14), FACE, facing='+X')
sign_face = join([qf, qb], 'sign_face')
set_origin(sign_face, (PX, PY, 2.14))
root = empty(NAME)
set_parent(body, root)
set_parent(sign_face, root)
export_glb(ctx, NAME, [root], max_tris=900)
previews(ctx, NAME, view=(0.75, -1.3, 0.75),
         extra_views=[(-1.0, -1.1, 0.5), (0.0, -1.0, 0.25), ((-1.0, -0.3, 0.3), ((-2.6, -1.0, 1.7), (-2.1, 0.0, 3.1)))])
print('[done]', NAME)
