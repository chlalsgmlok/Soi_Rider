"""char_body — stylised chibi-ish human (1.68 m, head ~1/5.5), segmented rig, neutral A-pose.

Nodes (origin at joint, rest rotations = identity):
hips -> torso -> head ; torso -> arm_L -> forearm_L -> hand_L (same _R) ; hips -> thigh_L -> shin_L -> foot_L (same _R)
Run: node blender/run-blender.mjs blender/assets/characters/char_body.py [--no-preview]
"""
import os
import sys
import math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy
from mathutils import Vector, Matrix
from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import join, tri_count
from lib.export import export_glb
from lib.characters_preview import turnaround, render
from lib import characters_rig as R
from lib.characters_geo import loft, shell, ellipsoid, tube, band, to_pivot, rotate_about, parent_keep as set_parent

ctx = start()
M = {
    'skin': mat('Skin', 'skin_2', roughness=0.6),
    'hands': mat('Hands', 'skin_2', roughness=0.6),
    'shirt': mat('Shirt', 'cloth_blue', roughness=0.75),
    'pants': mat('Pants', 'cloth_khaki', roughness=0.8),
    'shoes': mat('Shoes', 'shoe_dark', roughness=0.6),
    'sole': mat('Sole', 'cream', roughness=0.6),
    'eye': mat('Eye', 'ink', roughness=0.25),
    'shine': mat('Eye_Shine', 'trim_white', roughness=0.3),
    'blush': mat('Blush', 'pin_coral', roughness=0.8),
    'hair': mat('Hair', 'hair_black', roughness=0.6),
}


# ---------------------------------------------------------------- head (Skin + face)
def build_head():
    def pf(lon, lat, _ri):
        return R.head_point(R.head_dir(lon, lat))
    lats = [72, 54, 36, 18, 0, -18, -36, -54, -72]
    parts = [shell('head_skin', lats, 16, [M['skin']], pf, pole_top=True, pole_bottom=True)]
    parts.append(loft('neck', [(1.335, 0.054, 0.052), (1.44, 0.050, 0.048)], 8,
                      [M['skin']], cap_bottom=False, cap_top=False))
    for s in (1, -1):
        ear_c = R.head_point(R.head_dir(s * 90, -4), -0.006)
        parts.append(ellipsoid(f'ear{s}', ear_c, (0.020, 0.030, 0.040), M['skin'], segs=6, rings=4))
        eye_c = R.head_point(R.head_dir(s * 21, -4), -0.004)
        parts.append(ellipsoid(f'eye{s}', eye_c, (0.0185, 0.011, 0.028), M['eye'], segs=8, rings=4,
                               rot=(0, 0, math.radians(s * 21))))
        sh = R.head_point(R.head_dir(s * 21 + s * 4, 0.5), 0.004)
        parts.append(ellipsoid(f'shine{s}', sh, (0.006, 0.004, 0.007), M['shine'], segs=6, rings=3,
                               rot=(0, 0, math.radians(s * 25))))
        brow = [R.head_point(R.head_dir(s * a, b), 0.002) for a, b in ((10, 15.5), (20, 17.5), (30, 15))]
        parts.append(tube(f'brow{s}', brow, [0.0045, 0.0062, 0.0042], M['hair'], segs=5, smooth_angle=None))
        bl = R.head_point(R.head_dir(s * 40, -20), -0.003)
        parts.append(ellipsoid(f'blush{s}', bl, (0.020, 0.006, 0.012), M['blush'], segs=6, rings=3,
                               rot=(0, 0, math.radians(s * 40))))
    parts.append(ellipsoid('nose', R.head_point(R.head_dir(0, -14), -0.008), (0.020, 0.020, 0.017), M['skin'],
                           segs=6, rings=4))
    mouth = [R.head_point(R.head_dir(a, b), 0.0) for a, b in ((-9, -30), (0, -33), (9, -30))]
    parts.append(tube('mouth', mouth, 0.0048, M['eye'], segs=4))
    return join(parts, 'head')


# ---------------------------------------------------------------- torso / hips (Shirt / Pants)
def build_torso():
    # top ring (1.382) is hidden inside the collar/neck: drop it to pay for the pocket; ring 1.160 lies within
    # 0.7 mm of the 1.070..1.240 interpolation, drop it to pay for the rounder pelvis
    t = loft('torso', [r for r in R.TORSO_RINGS[:-1] if r[0] != 1.160], 12, [M['shirt']])
    collar = loft('collar', [(1.352, 0.070, 0.066, 0.004), (1.372, 0.077, 0.072, 0.004), (1.392, 0.064, 0.060, 0.006)],
                  12, [M['shirt']], cap_bottom=False, cap_top=False)
    # chest pocket on the model's LEFT (+X): thin raised panel, crisp edges so it reads under toon light
    pts, nrm = [], []
    for z in (1.262, 1.180):
        rx, ry, cy = R.torso_at(z)
        a = math.radians(30)
        pts.append(Vector((rx * math.sin(a), cy - ry * math.cos(a), z)))
        nrm.append(Vector((math.sin(a), -math.cos(a), 0.0)))
    pocket = band('pocket', pts, nrm, 0.072, 0.007, M['shirt'], lift=-0.002, smooth_angle=30)
    return join([t, collar, pocket], 'torso')


# pelvis = soft rounded box (Pants) that fully swallows both thigh ball-caps: the thighs leave it through its
# underside (standing) or its front (seated) at steep angles, so the junction is one clean crease, never a
# grazing zig-zag. Widest at the hip joints (z 0.855), 1.5 cm outside the thigh tops; the seat sits 6 mm back.
PELVIS_RINGS = [(0.966, 0.154, 0.104, 0.001), (0.905, 0.186, 0.122, 0.004), (0.862, 0.195, 0.125, 0.006),
                (0.832, 0.194, 0.124, 0.007), (0.808, 0.187, 0.119, 0.007), (0.790, 0.172, 0.109, 0.006),
                (0.777, 0.143, 0.092, 0.005), (0.768, 0.096, 0.066, 0.004), (0.762, 0, 0, 0.004)]


def build_hips():
    # loft wants rings bottom -> top; the open top sits inside the shirt (closed hem cap at z 0.935)
    return loft('hips', list(reversed(PELVIS_RINGS)), 14, [M['pants']], cap_top=False)


# ---------------------------------------------------------------- limbs (built along -Z from the joint at 0)
def limb(name, rings, segs, material, joint, rot_y=0.0):
    obj = loft(name, rings, segs, [material])
    obj.data.flip_normals()  # rings run top -> bottom, so the loft winds inwards: flip to outward faces
    rotate_about(obj, (0, 0, 0), (0, rot_y, 0))
    obj.data.transform(Matrix.Translation(joint))
    return obj


def build_arm(side):
    ry = -side * R.A_POSE
    sfx = 'L' if side > 0 else 'R'
    up = limb(f'arm_{sfx}', [(0.060, 0, 0), (0.042, 0.045, 0.043), (0.0, 0.062, 0.060), (-0.11, 0.059, 0.057),
                              (-0.21, 0.055, 0.053), (-0.258, 0.048, 0.046), (-0.288, 0, 0)],
              8, M['shirt'], R.shoulder(side), ry)
    fo = limb(f'forearm_{sfx}', [(0.048, 0, 0), (0.0, 0.054, 0.052), (-0.12, 0.051, 0.049), (-0.186, 0.048, 0.046),
                                  (-0.196, 0.057, 0.055), (-0.230, 0.057, 0.055), (-0.243, 0.043, 0.041), (-0.25, 0, 0)],
              8, M['shirt'], R.elbow(side), ry)
    # chunky toy mitten: palm faces the body, thumb forward (-Y) and slightly inward
    palm = ellipsoid(f'palm_{sfx}', (0, 0.004, -0.078), (0.041, 0.060, 0.077), M['hands'], segs=8, rings=5)
    thumb = ellipsoid(f'thumb_{sfx}', (-side * 0.011, -0.050, -0.050), (0.022, 0.023, 0.038), M['hands'], segs=6,
                      rings=4, rot=(math.radians(-25), 0, 0))
    hand = join([palm, thumb], f'hand_{sfx}')
    rotate_about(hand, (0, 0, 0), (0, ry, 0))
    hand.data.transform(Matrix.Translation(R.wrist(side)))
    return up, fo, hand


THIGH_R, THIGH_RY = 0.085, 0.082


def thigh_rings():
    """Ball cap = true hemisphere centred on the hip joint (rotation-invariant: it stays inside the pelvis in
    every pose), then a gently tapering pant leg down to the knee."""
    cap = [(THIGH_R * math.sin(math.radians(la)), THIGH_R * math.cos(math.radians(la)),
            THIGH_RY * math.cos(math.radians(la))) for la in (90, 58, 28, 0)]
    cap[0] = (cap[0][0], 0, 0)
    return cap + [(-0.15, 0.083, 0.080), (-0.30, 0.075, 0.072), (-0.372, 0.068, 0.066), (-0.418, 0, 0)]


def build_leg(side):
    sfx = 'L' if side > 0 else 'R'
    th = limb(f'thigh_{sfx}', thigh_rings(), 10, M['pants'], R.hip_joint(side))
    sh = limb(f'shin_{sfx}', [(0.064, 0, 0), (0.032, 0.064, 0.062), (0.0, 0.071, 0.069), (-0.13, 0.068, 0.066),
                               (-0.262, 0.061, 0.059), (-0.300, 0.069, 0.067), (-0.322, 0.070, 0.068), (-0.334, 0, 0)],
              10, M['pants'], R.knee(side))  # same segment count as the thigh: clean knee ring
    return th, sh, build_shoe(side)


def build_shoe(side):
    sfx = 'L' if side > 0 else 'R'
    # loft along +Z then rotate +90deg about X: loft z -> forward (-Y), loft +y -> up (+Z)
    upper = loft('shoe_up', [(-0.090, 0, 0, -0.030), (-0.078, 0.048, 0.047, -0.034), (-0.035, 0.057, 0.066, -0.018),
                             (0.025, 0.062, 0.052, -0.033), (0.095, 0.062, 0.040, -0.044), (0.150, 0.054, 0.034, -0.050),
                             (0.182, 0, 0, -0.054)], 8, [M['shoes']])
    sole = loft('sole', [(-0.094, 0, 0, -0.072), (-0.084, 0.052, 0.013, -0.072), (0.02, 0.066, 0.013, -0.072),
                         (0.15, 0.060, 0.013, -0.072), (0.187, 0, 0, -0.072)], 8, [M['sole']])
    toe = ellipsoid('toe', (0, -0.040, 0.150), (0.050, 0.026, 0.034), M['sole'], segs=6, rings=4)
    shoe = join([upper, sole, toe], f'foot_{sfx}')
    rotate_about(shoe, (0, 0, 0), (math.radians(90), 0, 0))
    shoe.data.transform(Matrix.Diagonal((1.1, 1.1, 1.0, 1.0)))  # chunkier toy sneakers, sole stays on z=0
    shoe.data.transform(Matrix.Translation(R.ankle(side)))
    return shoe


# ---------------------------------------------------------------- assemble the rig
head = build_head()
torso = build_torso()
hips = build_hips()
to_pivot(hips, R.HIPS)
to_pivot(torso, R.TORSO)
to_pivot(head, R.HEAD)
set_parent(torso, hips)
set_parent(head, torso)
for side in (1, -1):
    up, fo, hand = build_arm(side)
    to_pivot(up, R.shoulder(side))
    to_pivot(fo, R.elbow(side))
    to_pivot(hand, R.wrist(side))
    set_parent(up, torso)
    set_parent(fo, up)
    set_parent(hand, fo)
    th, sh, ft = build_leg(side)
    to_pivot(th, R.hip_joint(side))
    to_pivot(sh, R.knee(side))
    to_pivot(ft, R.ankle(side))
    set_parent(th, hips)
    set_parent(sh, th)
    set_parent(ft, sh)

for o in sorted([o for o in bpy.context.scene.objects if o.type == 'MESH'], key=lambda o: o.name):
    print(f'[part] {o.name:12s} tris={tri_count([o]):5d} loc={tuple(round(v, 3) for v in o.location)}')
export_glb(ctx, 'char_body', [hips], max_tris=2500)
turnaround(ctx, 'char_body', hips, angles=(0, 40, 90, 180), res=(1280, 560), elev=10)
render(ctx, 'char_body__diorama', res=(720, 720), elev=42, azim=-30, lens=70)
print('[char_body] OK')
