"""prop_soi_sign: Bangkok blue street-name sign on a decorative dark post (mockup 03, top-left corner).

Nodes: `body` (post, white rim plate, brackets, flyers) + `sign_face` (two quads, front -Y and back +Y,
material `Sign_Face`, UV 0..1 reading left-to-right from either side, base colour = sign blue).
The plate spans X and faces the model's forward axis; rotate the placement 90 deg to face traffic.
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, sphere, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.props_infra_kit import lathe, uv_quad, ground_cull, report
from lib.props_infra_preview import previews

NAME = 'prop_soi_sign'
ctx = start()

POST = mat('Post_Dark', 'canopy_black', roughness=0.45)
GOLD = mat('Gold', 'temple_gold', roughness=0.35, metallic=0.25)
RIM = mat('Sign_Rim', 'trim_white', roughness=0.4)
FACE = mat('Sign_Face', 'sign_blue', roughness=0.45)
PAPER_A = mat('Flyer_A', 'neon_yellow', roughness=0.7)
PAPER_B = mat('Flyer_B', 'cream', roughness=0.7)

PW, PH, PT = 1.3, 0.46, 0.1      # plate width / height / thickness
PZ = 2.74                         # plate centre height
D, G = 0, 1
prof = [
    (0.21, 0.0), (0.21, 0.1), (0.165, 0.14), (0.165, 0.25), (0.125, 0.29),                # stepped plinth
    (0.1, 0.42), (0.074, 0.52), (0.07, 0.62),
    (0.064, 1.2), (0.08, 1.22), (0.08, 1.27), (0.062, 1.29),                              # gold mid ring
    (0.058, 2.3), (0.08, 2.33), (0.08, 2.41), (0.035, 2.45),                              # gold collar
    (0.035, 3.0), (0.07, 3.0), (0.07, 3.06), (0.0, 3.08),                                 # cap above plate
]
seg_mats = [D, D, D, D, D, D, D, D, G, G, G, D, G, G, G, D, G, G, G]
post = lathe('post', prof, segs=12, mats=[POST, GOLD], seg_mats=seg_mats, cap_bottom=False, smooth=50)
parts = [post]
parts.append(sphere('finial', 0.075, (0, 0, 3.14), GOLD, segments=8, rings=6))
parts.append(lathe('spike', [(0.022, 0.0), (0.0, 0.09)], segs=6, loc=(0, 0, 3.2), material=GOLD, cap_bottom=False))

# white rim plate + clamp brackets
parts.append(box('plate', (PW, PT, PH), (0, 0, PZ), RIM, bevel=0.045, segments=2))
for z in (PZ - PH / 2 - 0.035, PZ + PH / 2 + 0.035):
    parts.append(box(f'clamp{z:.2f}', (0.15, 0.13, 0.06), (0, 0, z), POST, bevel=0.015, segments=1))

# sticker flyers on the post (Bangkok poles are always papered)
parts.append(box('flyer_a', (0.12, 0.012, 0.17), (0.0, -0.066, 1.6), PAPER_A, bevel=0.0, rot=(0, 0, 0.0)))
parts.append(box('flyer_b', (0.1, 0.012, 0.13), (0.045, -0.05, 0.95), PAPER_B, bevel=0.0, rot=(0, 0, 0.6)))
ground_cull(post)

report(parts, NAME)
body = join(parts, 'body')
set_origin(body, (0, 0, 0))

face_f = uv_quad('face_front', PW - 0.11, PH - 0.1, (0, -PT / 2 - 0.004, PZ), FACE, facing='-Y')
face_b = uv_quad('face_back', PW - 0.11, PH - 0.1, (0, PT / 2 + 0.004, PZ), FACE, facing='+Y')
sign_face = join([face_f, face_b], 'sign_face')
set_origin(sign_face, (0, 0, PZ))

root = empty(NAME)
set_parent(body, root)
set_parent(sign_face, root)
export_glb(ctx, NAME, [root], max_tris=900)
previews(ctx, NAME, view=(0.8, -1.4, 0.7), extra_views=[(-0.9, 1.2, 0.6), (0.0, -1.0, 0.1)])
print('[done]', NAME)
