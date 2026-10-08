"""prop_spirit_house: san phra phum (ศาลพระภูมิ) on a pillar, front (-Y) toward the street.

White stepped pillar with gold rings flaring into a red deck with a little gold balustrade; gold-walled shrine
with red door/porch, two stacked steep red Thai gables with gold pediments, gold bargeboards ending in
upturned hang-hong curls and chofa horns, a gold spire on top. Marigold swag along the deck front, a jasmine
swag across the porch, red soda bottles with straws, an incense bowl and two little dancer figurines.
Single static node `body`.
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.props_infra_kit import lathe, tube, extrude, uv_quad, catenary, report
from lib.props_infra_preview import previews

NAME = 'prop_spirit_house'
ctx = start()

WHITE = mat('Shrine_White', 'temple_white', roughness=0.45)
GOLD = mat('Gold', 'temple_gold', roughness=0.3, metallic=0.35)
RED = mat('Shrine_Red', 'temple_red', roughness=0.45)
ROOF = mat('Shrine_Roof', 'awning_red', roughness=0.4)
DARK = mat('Shrine_Door', 'ink', roughness=0.6)
MARIGOLD = mat('Garland_Marigold', 'taxi_orange', roughness=0.7)
JASMINE = mat('Garland_Jasmine', 'cream', roughness=0.7)
SODA = mat('Soda_Red', 'neon_red', roughness=0.2)
STRAW = mat('Straw', 'neon_pink', roughness=0.4)

SQ = math.sqrt(2)
DECK = 1.27
parts = []

# pillar: stepped plinth -> column with gold rings -> flared gold bracket -> red deck (square lathe)
prof = [(0.36, 0.0), (0.36, 0.1), (0.28, 0.13), (0.28, 0.2), (0.18, 0.23), (0.18, 0.29), (0.155, 0.31),
        (0.145, 1.0), (0.18, 1.02), (0.18, 1.1), (0.46, 1.2), (0.46, DECK)]
W_, G_, R_ = 0, 1, 2
pillar = lathe('pillar', [(hw * SQ, z) for hw, z in prof], segs=4, phase=math.pi / 4, mats=[WHITE, GOLD, RED],
               seg_mats=[W_, W_, W_, W_, G_, G_, W_, G_, G_, G_, R_], cap_bottom=False, smooth=30)
parts.append(pillar)

# balustrade: gold corner posts + rail on the sides and back (front left open for offerings)
C = 0.42
for x in (-C, C):
    for y in (-C, C):
        parts.append(box(f'cpost{x:+.1f}{y:+.1f}', (0.06, 0.06, 0.13), (x, y, DECK + 0.065), GOLD, bevel=0.0))
parts.append(tube('rail', [(C, -C, DECK + 0.1), (C, C, DECK + 0.1), (-C, C, DECK + 0.1), (-C, -C, DECK + 0.1)],
                  0.014, segs=4, material=GOLD, caps=False))

# shrine body: gold walls on a gold base band, red porch with gold columns, dark door in a red frame
BY = 0.06
parts.append(box('base_band', (0.58, 0.52, 0.05), (0, BY, DECK + 0.025), RED, bevel=0.0))
parts.append(box('walls', (0.5, 0.44, 0.4), (0, BY, DECK + 0.25), GOLD, bevel=0.02, segments=1))
FRONT = BY - 0.22
parts.append(box('door_frame', (0.22, 0.02, 0.3), (0, FRONT - 0.008, DECK + 0.21), RED, bevel=0.0))
parts.append(uv_quad('door', 0.14, 0.24, (0, FRONT - 0.02, DECK + 0.2), DARK))
for s in (-1, 1):
    parts.append(uv_quad(f'win{s}', 0.12, 0.14, (s * 0.252, BY, DECK + 0.26), RED, facing='+X' if s > 0 else '-X'))
    parts.append(tube(f'col{s}', [(s * 0.21, FRONT - 0.07, DECK + 0.05), (s * 0.21, FRONT - 0.07, DECK + 0.47)],
                      0.028, segs=6, material=GOLD, caps=False))


def gable(name, base_z, half_w, h, depth, cy, bargeboard_back=False):
    """Steep Thai gable: red prism with gold pediments, gold bargeboards with hang-hong curls + chofa horn."""
    tri = [(-half_w, 0.0), (half_w, 0.0), (0.0, h)]
    parts.append(extrude(name, tri, depth, center=(0, cy, base_z), material=ROOF, cap_mat=GOLD,
                         bevel=0.025, segments=1, limit=50))
    sides = (-1, 1) if bargeboard_back else (-1,)
    for s in sides:
        y = cy + s * (depth / 2 + 0.012)
        pts = [(-half_w - 0.05, y, base_z + 0.08), (-half_w - 0.01, y, base_z - 0.01), (0, y, base_z + h + 0.01),
               (half_w + 0.01, y, base_z - 0.01), (half_w + 0.05, y, base_z + 0.08)]
        parts.append(tube(f'{name}_barge{s}', pts, 0.02, segs=4, material=GOLD, caps=False))
        horn = [(0, y, base_z + h), (0, y + s * 0.03, base_z + h + 0.09), (0, y + s * 0.09, base_z + h + 0.13)]
        parts.append(tube(f'{name}_chofa{s}', horn, 0.022, segs=4, material=GOLD, radii=[0.024, 0.02, 0.01]))


R1 = DECK + 0.45
gable('roof1', R1, 0.45, 0.46, 0.74, BY - 0.02, bargeboard_back=True)
parts.append(box('clerestory', (0.3, 0.36, 0.2), (0, BY, R1 + 0.3), GOLD, bevel=0.0))
R2 = R1 + 0.27
gable('roof2', R2, 0.3, 0.36, 0.5, BY + 0.02)

# gold spire on the upper ridge
spire = [(0.075, 0.0), (0.075, 0.04), (0.05, 0.065), (0.05, 0.1), (0.032, 0.13), (0.016, 0.3), (0.0, 0.4)]
parts.append(lathe('spire', spire, segs=6, loc=(0, BY + 0.02, R2 + 0.3), material=GOLD, cap_bottom=False,
                   smooth=50))

# garlands: marigold swag along the deck front, jasmine swag across the porch
parts.append(tube('swag_front', catenary((-C, -C - 0.04, DECK + 0.1), (C, -C - 0.04, DECK + 0.1), 0.17, 6),
                  0.032, segs=4, material=MARIGOLD))
parts.append(tube('swag_porch', catenary((-0.21, FRONT - 0.09, DECK + 0.45), (0.21, FRONT - 0.09, DECK + 0.45),
                                         0.1, 4), 0.022, segs=5, material=JASMINE))
for s in (-1, 1):
    parts.append(tube(f'tail{s}', [(s * C, -C - 0.04, DECK + 0.1), (s * (C + 0.01), -C - 0.05, DECK - 0.1)],
                      0.026, segs=5, material=MARIGOLD, radii=[0.03, 0.018]))

# offerings on the deck: red soda bottles with straws, incense bowl, two dancer figurines
for k, (x, y) in enumerate(((0.3, -0.3), (0.21, -0.36))):
    parts.append(lathe(f'soda{k}', [(0.03, 0.0), (0.03, 0.09), (0.014, 0.125), (0.012, 0.14)], segs=5,
                       loc=(x, y, DECK), material=SODA, cap_bottom=False, smooth=60))
    parts.append(tube(f'straw{k}', [(x, y, DECK + 0.13), (x - 0.02, y - 0.01, DECK + 0.2)], 0.007, segs=3,
                      material=STRAW, caps=False))
parts.append(lathe('bowl', [(0.05, 0.0), (0.075, 0.05), (0.07, 0.065), (0.0, 0.06)], segs=5,
                   loc=(-0.26, -0.32, DECK), material=GOLD, cap_bottom=False, smooth=60))
for k, (dx, ang) in enumerate(((-0.02, -0.18), (0.0, 0.0), (0.02, 0.18))):
    parts.append(box(f'incense{k}', (0.01, 0.01, 0.2), (-0.26 + dx + math.sin(ang) * 0.1, -0.32, DECK + 0.15),
                     RED, bevel=0.0, rot=(0, ang, 0)))
for s in (-1, 1):
    parts.append(lathe(f'dancer{s}', [(0.035, 0.0), (0.02, 0.1), (0.012, 0.12), (0.022, 0.135), (0.0, 0.17)],
                       segs=4, loc=(s * 0.35, -0.12, DECK), material=WHITE, cap_bottom=False, smooth=60))

report(parts, NAME)
body = join(parts, 'body')
set_origin(body, (0, 0, 0))
root = empty(NAME)
set_parent(body, root)
export_glb(ctx, NAME, [root], max_tris=900)
previews(ctx, NAME, view=(0.8, -1.3, 0.75), pad=1.05,
         extra_views=[(0.0, -1.0, 0.2), (-1.0, -0.6, 0.6), ((0.6, -1.0, 0.5), ((-0.5, -0.55, 1.15), (0.5, 0.4, 2.0)))])
print('[done]', NAME)
