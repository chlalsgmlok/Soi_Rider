"""prop_win_stand (HERO): Bangkok motorcycle-taxi stand ("win" / วินมอเตอร์ไซค์), open toward the street (-Y).

Story: NONG waits here for gram calls (GAME_DESIGN §3). Chunky toy shelter on a little concrete slab:
a thick, round-edged blue roof (white corrugation ribs, orange bumper lip) with an orange crest sign, dark posts,
a wooden bench with a backrest, four orange rider vests on hangers (wide flat shoulders, shallow neck: they read
as vests, not cat faces) with big cream number bibs and bold modelled pixel digits (1-4), a fifth vest (7) on the
front-right post for the high camera, a chalk-black queue board with numbered tags on the model's right side (-X),
a fare board on the left (+X), a red Thai plastic stool (round rolled-rim seat, flared skirt with four arched
cut-outs = four splayed legs, `Plastic`), a helmet on the bench and a gram sticker on the front-left post.
Nodes: `body` + `sign_face` (crest sign quad facing -Y, `Sign_Face`, UV 0..1, cream base -> runtime draws "วิน").
Footprint ~3.0 x 1.8 m (asset-footprints keep [2.9, 1.8]).
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
from lib.props_infra_kit import lathe, tube, extrude, uv_quad, arc, ground_cull, drop_faces, report
from lib.props_infra_nodes import verify_glb_nodes
from lib.props_infra_stand_parts import vest, hanger, thai_stool, VEST_H
from lib.props_infra_preview import previews

NAME = 'prop_win_stand'
ctx = start()

SLAB = mat('Concrete', 'concrete', roughness=0.9)
POST = mat('Metal_Dark', 'metal_dark', roughness=0.45)
ROOF = mat('Roof_Blue', 'awning_blue', roughness=0.4)
RIB = mat('Roof_Rib', 'trim_white', roughness=0.4)
ORANGE = mat('Win_Orange', 'cloth_orange', roughness=0.45)
VEST = mat('Vest_Orange', 'taxi_orange', roughness=0.6)
PATCH = mat('Vest_Patch', 'cream', roughness=0.5)
WOOD = mat('Bench_Wood', 'wood_light', roughness=0.6)
WOOD_D = mat('Wood_Dark', 'wood', roughness=0.65)
BOARD = mat('Board_Chalk', 'canopy_black', roughness=0.7)
TAG_A = mat('Tag_Cream', 'cream', roughness=0.5)
TAG_B = mat('Tag_Yellow', 'neon_yellow', roughness=0.5)
STOOL = mat('Plastic', 'cloth_red', roughness=0.35)
HELMET = mat('Helmet_Prop', 'gram_cyan', roughness=0.3)
CORAL = mat('Ad_Pin', 'pin_coral', roughness=0.35)
FACE = mat('Sign_Face', 'cream', roughness=0.45)
INK = mat('Ink', 'ink', roughness=0.5)
LINE_G = mat('Line_Green', 'taxi_green', roughness=0.5)

GAP = 0.005                               # stand-off of flat stickers / quads from their surface
PX, PYF, PYB, PR = 1.25, -0.62, 0.62, 0.1  # post x, front y, back y, radius
PITCH = math.radians(-6)                  # front edge higher (sign side)
RZ, RT, RB = 2.5, 0.24, 0.105             # roof slab centre z, thickness, edge rounding
RW, RD, RY = 3.0, 1.76, 0.02              # roof width (X), depth (Y), centre y
FY = RY - RD / 2                          # roof front edge y


def roof_under(y):
    return RZ - RT / 2 + (y - RY) * math.sin(PITCH)


def roof_top(y):
    return RZ + RT / 2 + (y - RY) * math.sin(PITCH)


parts = []

slab = box('slab', (2.9, 1.8, 0.08), (0, 0, 0.04), SLAB, bevel=0.03, segments=1)
ground_cull(slab)
parts.append(slab)

# posts: 6-sided (smooth-shaded) with a flat face toward the street (the gram sticker sits on it), open ends hidden
for x in (-PX, PX):
    for y in (PYF, PYB):
        parts.append(lathe(f'post{x:+.0f}{y:+.0f}', [(PR, 0.08), (PR, roof_under(y) + 0.03)], segs=6,
                           phase=0.0, loc=(x, y, 0), material=POST, cap_bottom=False, cap_top=False,
                           smooth=65))
# side rail carrying the fare board (+X); the queue board (-X) spans post to post
parts.append(tube('side_rail', [(PX, PYF, 1.45), (PX, PYB, 1.45)], 0.025, segs=5, material=POST, caps=False))

# thick pitched roof slab with well-rounded edges (toy canopy) + raised corrugation ribs on the flat top
parts.append(box('roof', (RW, RD, RT), (0, RY, RZ), ROOF, bevel=RB, segments=2, rot=(PITCH, 0, 0)))
CRY = FY + RB + 0.05                     # crest sign centre y (on the flat top, behind the rounded nose)
rib_y0, rib_y1 = CRY + 0.06, RY + RD / 2 - RB
for i in range(5):
    x = -1.2 + i * 0.6
    ym = (rib_y0 + rib_y1) / 2
    rib = box(f'rib{i}', (0.09, rib_y1 - rib_y0, 0.05), (x, ym, roof_top(ym) + 0.015), RIB, bevel=0.0,
              rot=(PITCH, 0, 0))
    drop_faces(rib, lambda c, n: n.z < -0.9)
    parts.append(rib)
# orange bumper lip wrapping the rounded front nose
parts.append(tube('lip', [(-RW / 2 + 0.06, FY + 0.05, roof_under(FY) + RT / 2),
                          (RW / 2 - 0.06, FY + 0.05, roof_under(FY) + RT / 2)], 0.085, segs=8, material=ORANGE))

# crest sign standing on the roof's flat top (rounded top corners)
CW, CH, CR, CT = 2.0, 0.62, 0.16, 0.09
CZ = roof_top(CRY) + CH / 2 - 0.1
crest = [(CW / 2, -CH / 2)] + arc(CW / 2 - CR, CH / 2 - CR, CR, 0, 90, 2) + \
    arc(-CW / 2 + CR, CH / 2 - CR, CR, 90, 180, 2) + [(-CW / 2, -CH / 2)]
parts.append(extrude('crest', crest, CT, center=(0, CRY, CZ), material=ORANGE, bevel=0.025, segments=1, limit=50))

# bench with backrest between the back posts
parts.append(box('seat', (2.3, 0.42, 0.08), (0, 0.36, 0.48), WOOD, bevel=0.03, segments=1))
for x in (-0.95, 0.95):
    leg = box(f'leg{x:+.0f}', (0.07, 0.34, 0.4), (x, 0.36, 0.28), POST, bevel=0.0)
    drop_faces(leg, lambda c, n: n.z < -0.9)          # bottom sits on the slab
    parts.append(leg)
parts.append(box('backrest', (2.5, 0.05, 0.16), (0, PYB - 0.07, 0.86), WOOD, bevel=0.0))

# vest rail + four hanging rider vests (number side to the street) + a fifth vest on the front-right post
RAIL_Z = 1.90          # review round 2: 0.22 m lower so the bibs clear the roof fascia from the diorama camera
RAIL_Y = PYB - 0.04
parts.append(tube('rail', [(-PX, RAIL_Y, RAIL_Z), (PX, RAIL_Y, RAIL_Z)], 0.022, segs=5, material=POST,
                  caps=False))


def hang(k, digit, x, y, z_top, yaw, hook):
    M = Matrix.Translation((x, y, z_top - VEST_H)) @ Matrix.Rotation(yaw, 4, 'Z')
    parts.extend(vest(k, digit, M, VEST, PATCH, INK))
    parts.append(hanger(k, M, hook, POST))


for k, (digit, x, yaw) in enumerate(((1, -0.84, 0.1), (2, -0.28, -0.06), (3, 0.28, 0.08), (4, 0.84, -0.12))):
    hang(k, digit, x, RAIL_Y - 0.05, RAIL_Z - 0.12, yaw, (x, RAIL_Y, RAIL_Z + 0.01))
hang(4, 7, -PX + 0.03, PYF - PR - 0.07, 2.0, 0.14, (-PX, PYF - PR + 0.01, 2.13))

# queue board on the model's right side (-X), post to post, chalk-black with numbered tags
BX = -PX - 0.04
FRAME_OUT = BX - 0.025
parts.append(box('board_frame', (0.05, 2 * PYB, 0.86), (BX, 0, 1.45), WOOD_D, bevel=0.0))
parts.append(uv_quad('board', 1.1, 0.72, (FRAME_OUT - GAP, 0, 1.42), BOARD, facing='-X'))
parts.append(uv_quad('board_head', 1.1, 0.12, (FRAME_OUT - 2 * GAP, 0, 1.79), ORANGE, facing='-X'))
for r in range(3):
    for c in range(4):
        m = TAG_B if (r + c) % 3 == 0 else TAG_A
        parts.append(uv_quad(f'tag{r}{c}', 0.17, 0.13, (FRAME_OUT - 2 * GAP, -0.39 + c * 0.26, 1.58 - r * 0.2), m,
                             facing='-X'))

# fare board on the model's left side (+X): white plate with coloured route lines
FX = PX + 0.045
parts.append(box('fare', (0.04, 0.9, 0.62), (FX, 0, 1.5), PATCH, bevel=0.0))
parts.append(uv_quad('fare_head', 0.84, 0.11, (FX + 0.02 + GAP, 0, 1.73), ORANGE, facing='+X'))
for k, (m, z) in enumerate(((ROOF, 1.57), (STOOL, 1.45), (LINE_G, 1.33))):
    parts.append(uv_quad(f'fare_line{k}', 0.66, 0.05, (FX + 0.02 + GAP, 0.04 * k - 0.04, z), m, facing='+X'))

# red Thai plastic stool at the front-left, cyan helmet resting on the bench
parts.extend(thai_stool('stool', (0.82, -0.22, 0.08), STOOL))
parts.append(lathe('helmet', [(0.14, 0.0), (0.135, 0.07), (0.085, 0.14), (0.0, 0.165)], segs=6,
                   loc=(0.55, 0.36, 0.52), material=HELMET, cap_bottom=False, smooth=60))   # rests on the bench

# gram sticker on the front-left post's street-facing flat face
POST_FACE = PYF - PR * math.cos(math.pi / 6)
parts.append(uv_quad('sticker', 0.072, 0.12, (PX, POST_FACE - GAP, 1.55), HELMET))
parts.append(uv_quad('sticker_pin', 0.04, 0.045, (PX, POST_FACE - 2 * GAP, 1.565), CORAL))

report(parts, NAME)
body = join(parts, 'body')
set_origin(body, (0, 0, 0))
SZ = CZ - 0.02
SY = CRY - CT / 2 - GAP
sign_face = uv_quad('sign_face', CW - 0.26, CH - 0.2, (0, SY, SZ), FACE, facing='-Y')
set_origin(sign_face, (0, SY, SZ))
root = empty(NAME)
set_parent(body, root)
set_parent(sign_face, root)
glb = export_glb(ctx, NAME, [root], max_tris=900)
verify_glb_nodes(glb, {'sign_face': (0, SY, SZ)})
previews(ctx, NAME, view=(-0.9, -1.3, 0.8),
         extra_views=[(1.0, -1.2, 0.6), (-1.0, -0.2, 0.3), (0.0, -1.0, 0.15),
                      ((0.0, -1.0, 0.1), ((-1.2, 0.3, 1.3), (1.2, 0.8, 2.2))),
                      ((1.0, -0.25, 0.45), ((0.55, -0.5, 0.0), (1.1, 0.05, 0.6)))])
print('[done]', NAME)
