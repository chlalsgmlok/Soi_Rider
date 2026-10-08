"""Street trees: prop_palm (coconut palm, h ~7) and prop_raintree (wide-canopy rain tree, h ~9). Budget <= 1500.

Toy-diorama trees: the palm trunk is a stack of flared rings (Trunk / Trunk2 bands), the crown is serrated
two-tone fronds (Leaf lit side, Leaf2 shaded side) with yellow-green coconuts. The rain tree is a stout
flared trunk splitting into five limbs under a flat-bottomed cloud canopy (Leaf2 underside, Leaf sunlit top)
with scalloped puffs around the rim so the silhouette reads from a high 3/4 camera.

Rebuild: node blender/run-blender.mjs blender/assets/props_street/trees.py [--no-preview] [--only prop_palm]
"""
import math
import os
import random
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from mathutils import Vector

from lib.bootstrap import start
from lib.props_street_kit import M, tube, leaf, blob, finish, run_assets, lumpy
from lib.props_street_parts import ball

ctx = start()
GOLDEN = math.pi * (3 - math.sqrt(5))


def bezier(p0, p1, p2, t):
    a, b, c = Vector(p0), Vector(p1), Vector(p2)
    return a * (1 - t) ** 2 + b * 2 * t * (1 - t) + c * t * t


# ------------------------------------------------------------------------------------------- palm
def build_palm():
    trunk = M('Trunk', 'trunk', roughness=0.85)
    trunk2 = M('Trunk2', '#A88A6C', roughness=0.85)
    leaf_m = M('Leaf', 'leaf', double=True, roughness=0.55)
    leaf2 = M('Leaf2', 'leaf_dark', double=True, roughness=0.6)
    coco = M('Coconut', '#A9C23F', roughness=0.45)
    rng = random.Random(4)
    top_z = 6.1
    c0, c1, c2 = (0, 0, 0), (0.05, 0, 3.3), (0.95, 0, top_z)
    rings = 11
    pts, radii, bands = [], [], []
    pts += [tuple(bezier(c0, c1, c2, 0.0)), tuple(bezier(c0, c1, c2, 0.025))]
    radii += [0.46, 0.34]
    bands += [0, 0]
    for k in range(rings):
        t0 = 0.04 + 0.95 * k / rings
        t1 = 0.04 + 0.95 * (k + 0.82) / rings
        r = 0.32 - 0.10 * (k / rings)
        pts += [tuple(bezier(c0, c1, c2, t0)), tuple(bezier(c0, c1, c2, t1))]
        radii += [r * 0.9, r * 1.1]
        bands += [0, 1]
    tip = bezier(c0, c1, c2, 1.0)
    pts.append(tuple(tip))
    radii.append(0.19)
    p = [tube('trunk', pts, radii, [trunk, trunk2], segs=7, cap_start=False, band_mat=bands, smooth_angle=70)]
    crown = tip + Vector((0, 0, 0.05))
    p.append(blob('crown', 0.32, tuple(crown), leaf2, scale=(1, 1, 1.15), subdiv=1, jitter=0.08, seed=2))
    # fronds: drooping serrated two-tone fans, plus three young ones standing up
    for i in range(12):
        yaw = i * GOLDEN + 0.2
        young = i >= 9
        length = rng.uniform(2.9, 3.3) * (0.7 if young else 1.0)
        base = crown + Vector((0.16 * math.cos(yaw), 0.16 * math.sin(yaw), 0.08))
        p.append(leaf('frond', tuple(base), yaw, length, rng.uniform(0.95, 1.08) * (0.8 if young else 1.0),
                      [leaf_m, leaf2], segs=10, rise=(1.15 if young else rng.uniform(0.25, 0.75)),
                      droop=(0.35 if young else rng.uniform(0.55, 0.8)), fold=0.35, shape='frond', serrate=0.5,
                      two_tone=True, roll=rng.uniform(-0.2, 0.2), seed=i))
    # coconut cluster under the crown
    for i in range(5):
        a = i * 2 * math.pi / 5 + 0.4
        c = crown + Vector((0.26 * math.cos(a), 0.26 * math.sin(a), -0.26 - 0.07 * (i % 2)))
        p.append(ball('coco', 0.16, tuple(c), coco, segs=7, scale=(1, 1, 1.1)))
    return finish(p, 'prop_palm')


# ------------------------------------------------------------------------------------------- rain tree
def build_raintree():
    bark = M('Trunk', 'trunk', roughness=0.85)
    leaf_m = M('Leaf', 'leaf', roughness=0.7)
    leaf2 = M('Leaf2', 'leaf_dark', roughness=0.75)
    rng = random.Random(9)
    p = [tube('trunk', [(0, 0, 0), (0, 0, 0.35), (0.04, 0.02, 1.3), (0.08, 0.0, 2.3), (0.1, 0.0, 2.75)],
              [0.86, 0.62, 0.55, 0.52, 0.45], bark, segs=9, cap_start=False, smooth_angle=70)]
    # root flare: four buttress roots sliding into the ground
    for i in range(3):
        a = i * 2 * math.pi / 3 + 0.5
        d = Vector((math.cos(a), math.sin(a), 0))
        p.append(tube('root', [tuple(d * 0.25 + Vector((0, 0, 0.45))), tuple(d * 0.7 + Vector((0, 0, 0.12))),
                               tuple(d * 1.25 + Vector((0, 0, -0.02)))], [0.27, 0.17, 0.05], bark, segs=5,
                      cap_start=False, smooth_angle=70))
    # four limbs spreading up and out into the canopy
    for i in range(4):
        a = i * 2 * math.pi / 4 + 0.3 + rng.uniform(-0.2, 0.2)
        d = Vector((math.cos(a), math.sin(a), 0))
        b = Vector((0.1, 0.0, 2.45))
        reach = rng.uniform(2.4, 3.0)
        p.append(tube('limb', [tuple(b + d * 0.1), tuple(b + d * reach * 0.35 + Vector((0, 0, 1.1))),
                               tuple(b + d * reach * 0.75 + Vector((0, 0, 2.3))),
                               tuple(b + d * reach + Vector((0, 0, 3.4)))], [0.38, 0.27, 0.18, 0.1], bark,
                      segs=6, cap_start=False, smooth_angle=70))
    # canopy: dark flat-bottomed dome + sunlit clumps on top and scalloped clumps around the rim.
    # One colour per clump (no per-triangle patches) keeps the read clean and toy-like.
    cx, cz = 0.1, 6.6
    p.append(lumpy('canopy', 3.6, (cx, 0.0, cz), [leaf2], scale=(1.25, 1.15, 0.45), subdiv=3, lump=0.08, freq=1.8,
                   seed=3, flat_bottom=-1.1))
    tops = [(0.0, 0.0, 1.55, 8.0)] + [(2.35 * math.cos(a), 2.15 * math.sin(a), 1.3, 7.7)
                                      for a in (0.5, 0.5 + 1.57, 0.5 + 3.14, 0.5 + 4.71)]
    for i, (x, y, r, z) in enumerate(tops):
        p.append(lumpy('clump', r, (cx + x, y, z), [leaf_m], scale=(1.2, 1.2, 0.66), subdiv=2, lump=0.1, seed=20 + i,
                       flat_bottom=-0.5))
    for i in range(5):
        a = i * 2 * math.pi / 5 + 1.2
        c = (cx + 4.0 * math.cos(a) * 1.05, 3.9 * math.sin(a), rng.uniform(6.2, 6.6))
        p.append(lumpy('rim', rng.uniform(1.15, 1.35), c, [leaf_m], scale=(1.15, 1.15, 0.7), subdiv=2, lump=0.1,
                       seed=40 + i, flat_bottom=-0.6))
    return finish(p, 'prop_raintree')


run_assets(ctx, [
    ('prop_palm', build_palm, 1500),
    ('prop_raintree', build_raintree, 1500),
], preview_views={'prop_raintree': {'view': (1.0, -1.3, 1.0)}, 'prop_palm': {'view': (1.0, -1.35, 0.7)}})
print('[trees] OK')
