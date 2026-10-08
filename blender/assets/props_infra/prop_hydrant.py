"""prop_hydrant: chunky Bangkok pillar hydrant on a little concrete pad.

Red barrel with a white reflective band, yellow dome cap + pentagon nut, steel outlet caps on chains,
bolted base flange. Pumper outlet faces the street (-Y). Single static node `body`.
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from mathutils import Matrix
from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.props_infra_kit import lathe, tube, bake, ground_cull, catenary, report
from lib.props_infra_preview import previews

NAME = 'prop_hydrant'
ctx = start()

RED = mat('Hydrant_Red', 'awning_red', roughness=0.42)
CAP = mat('Hydrant_Cap', 'lane_yellow', roughness=0.42)
BAND = mat('Reflector', 'curb_white', roughness=0.3)
STEEL = mat('Steel', 'steel', roughness=0.35, metallic=0.3)
CONC = mat('Concrete', 'concrete', roughness=0.9)

parts = []

# concrete pad
pad = box('pad', (0.5, 0.5, 0.07), (0, 0, 0.035), CONC, bevel=0.025, segments=1)
ground_cull(pad)
parts.append(pad)

Z0 = 0.07
R, Y, W = 0, 1, 2
profile = [
    (0.19, 0.00), (0.19, 0.045), (0.15, 0.075), (0.125, 0.09),        # flange
    (0.12, 0.20), (0.127, 0.205), (0.127, 0.255), (0.12, 0.26),       # reflective band (raised lip)
    (0.12, 0.47), (0.152, 0.49), (0.152, 0.535), (0.13, 0.55),        # upper collar
    (0.142, 0.565), (0.136, 0.63), (0.108, 0.695), (0.058, 0.735), (0.0, 0.745),  # yellow dome
]
seg_mats = [R, R, R, R, W, W, W, R, R, R, R, Y, Y, Y, Y, Y]
body = lathe('barrel', [(r, z + Z0) for r, z in profile], segs=12, mats=[RED, CAP, BAND],
             seg_mats=seg_mats, cap_bottom=False)
parts.append(body)

# pentagon operating nut on the dome
parts.append(lathe('nut', [(0.04, 0.0), (0.04, 0.045), (0.028, 0.06), (0.0, 0.062)],
                   segs=5, loc=(0, 0, Z0 + 0.735), material=STEEL, cap_bottom=False, smooth=30))

# bolts around the flange
for i in range(6):
    a = math.radians(30 + 60 * i)
    parts.append(lathe(f'bolt{i}', [(0.016, 0.0), (0.016, 0.03), (0.0, 0.032)], segs=6,
                       loc=(0.165 * math.cos(a), 0.165 * math.sin(a), Z0 + 0.05), material=STEEL,
                       cap_bottom=False, smooth=30))


def outlet(name, r, reach, z, yaw):
    """Horizontal outlet: nozzle + cap + nut, built along +Z then rotated to point along yaw (0 = -Y)."""
    prof = [(r * 0.85, 0.0), (r * 0.85, 0.07), (r * 1.25, 0.075), (r * 1.25, 0.14),
            (r * 0.6, 0.165), (0.0, 0.175)]
    o = lathe(name, prof, segs=8, material=STEEL, cap_bottom=False, smooth=50)
    o.data.materials.clear()
    o.data.materials.append(RED)
    o.data.materials.append(STEEL)
    for f in o.data.polygons:
        f.material_index = 0 if f.center.z < 0.072 else 1
    # +Z -> -Y (street), then yaw about Z, then lift
    M = Matrix.Translation((0, 0, z)) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Translation((0, -reach, 0)) \
        @ Matrix.Rotation(math.pi / 2, 4, 'X')
    return bake(o, M)


parts.append(outlet('pumper', 0.06, 0.1, Z0 + 0.38, 0.0))
parts.append(outlet('side_L', 0.045, 0.1, Z0 + 0.40, math.pi / 2))
parts.append(outlet('side_R', 0.045, 0.1, Z0 + 0.40, -math.pi / 2))

# little chains from the side caps down to the barrel
for sx in (1, -1):
    pts = catenary((sx * 0.25, -0.02, Z0 + 0.37), (sx * 0.12, -0.06, Z0 + 0.30), 0.03, 4)
    parts.append(tube(f'chain{sx}', pts, 0.008, segs=4, material=STEEL, caps=False))

report(parts, NAME)
model = join(parts, 'body')
set_origin(model, (0, 0, 0))
root = empty(NAME)
set_parent(model, root)
export_glb(ctx, NAME, [root], max_tris=900)
previews(ctx, NAME, extra_views=[(-0.2, -1.0, 0.35), (-1.0, 0.6, 0.9)])
print('[done]', NAME)
