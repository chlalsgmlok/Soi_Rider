"""Potted street plants: prop_pot_plant, prop_banana, prop_bougainvillea (group props_street).

All sit in terracotta pots (material `Pot`) with `Soil`; foliage uses the contract materials `Leaf` / `Leaf2`
(leaves are two-tone: lit half Leaf, shaded half Leaf2) and `Flower` for the bougainvillea bracts.

Rebuild: node blender/run-blender.mjs blender/assets/props_street/plants.py [--no-preview] [--only prop_banana]
"""
import math
import os
import random
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree
from lib.bootstrap import start
from lib.props_street_kit import M, lathe, tube, leaf, blob, finish, run_assets, lumpy, mesh_obj
from lib.props_street_parts import ball
from lib.props_street_puffy import soft_normals

ctx = start()
GOLDEN = math.pi * (3 - math.sqrt(5))


def pot(r_bot, r_top, h, segs=10, rim=0.035, soil_drop=0.05):
    """Terracotta pot with a rolled rim and a soil top. Returns the lathe object."""
    terracotta = M('Pot', 'pot_terracotta', roughness=0.75)
    soil = M('Soil', 'soil', roughness=0.95)
    rh = rim * 1.5
    prof = [(r_bot, 0.0), (r_bot + (r_top - r_bot) * 0.15, 0.03), (r_top, h - rh), (r_top + rim, h - rh + 0.008),
            (r_top + rim, h - 0.008), (r_top + rim * 0.4, h), (r_top - 0.012, h - 0.01),
            (r_top - 0.02, h - soil_drop), (0.0, h - soil_drop + 0.012)]
    bands = [0] * (len(prof) - 2) + [1]
    return lathe('pot', prof, [terracotta, soil], segs=segs, band_mat=bands, smooth_angle=50)


# ------------------------------------------------------------------------------------------- pot plant
def build_pot_plant():
    """Lush dracaena / peace-lily tuft: three tiers of broad arching two-tone leaves in a terracotta pot."""
    leaf_m = M('Leaf', 'leaf', double=True, roughness=0.55)
    leaf2 = M('Leaf2', 'leaf_dark', double=True, roughness=0.6)
    rng = random.Random(11)
    h = 0.40
    parts = [pot(0.16, 0.23, h, segs=10)]
    parts.append(blob('filler', 0.13, (0, 0, h), leaf2, scale=(1.2, 1.2, 0.7), subdiv=1, jitter=0.1, seed=3))
    tiers = ((8, 0.60, 0.17, 0.55, 0.85), (7, 0.55, 0.16, 0.95, 0.55), (5, 0.45, 0.14, 1.25, 0.32))
    n = 0
    for count, length, width, rise, droop in tiers:
        for i in range(count):
            yaw = i * 2 * math.pi / count + rng.uniform(-0.2, 0.2) + n * 0.45
            base = (0.03 * math.cos(yaw), 0.03 * math.sin(yaw), h - 0.01 + 0.02 * n)
            parts.append(leaf('leaf', base, yaw, length * rng.uniform(0.9, 1.1), width, [leaf_m, leaf2], segs=5,
                              rise=rise + rng.uniform(-0.1, 0.1), droop=droop, fold=0.4, two_tone=True,
                              roll=rng.uniform(-0.3, 0.3)))
        n += 1
    return finish(parts, 'prop_pot_plant')


# ------------------------------------------------------------------------------------------- banana
def build_banana():
    """Banana plant in a big pot: main pseudostem with 9 ragged paddle leaves, a sucker, a bunch + purple heart."""
    leaf_m = M('Leaf', 'banana', double=True, roughness=0.5)
    leaf2 = M('Leaf2', 'leaf_dark', double=True, roughness=0.55)
    stem_m = M('Stem', '#8FA84A', roughness=0.7)
    fruit = M('Accent_Yellow', 'plate_yellow', roughness=0.45)
    heart = M('Banana_Heart', 'car_maroon', roughness=0.5)
    rng = random.Random(7)
    h = 0.50
    parts = [pot(0.22, 0.31, h, segs=12)]
    top = (0.03, -0.02, 1.70)
    parts.append(tube('stem', [(0, 0, h - 0.06), (0.0, 0.0, 0.95), (0.02, -0.01, 1.38), top],
                      [0.13, 0.11, 0.09, 0.07], stem_m, segs=6, cap_start=False))
    s_top = (0.20, 0.12, 1.05)
    parts.append(tube('sucker', [(0.15, 0.09, h - 0.06), (0.18, 0.10, 0.78), s_top], [0.07, 0.05, 0.035], stem_m,
                      segs=5, cap_start=False))
    for i in range(9):
        yaw = i * GOLDEN + 0.3
        young = i >= 7
        old = i < 3
        parts.append(leaf('bleaf', (top[0], top[1], top[2] - 0.035 * (i % 4)), yaw,
                          rng.uniform(1.55, 1.8) * (0.75 if young else 1.0), rng.uniform(0.56, 0.64),
                          [leaf_m, leaf2], segs=6,
                          rise=(1.3 if young else (rng.uniform(0.5, 0.65) if old else rng.uniform(0.8, 1.05))),
                          droop=(0.3 if young else (rng.uniform(0.7, 0.8) if old else rng.uniform(0.6, 0.8))),
                          fold=0.2, shape='paddle', ragged=0.0 if young else 0.4, two_tone=True,
                          roll=rng.uniform(-0.25, 0.25), seed=i))
    parts.append(tube('cigar', [top, (top[0], top[1], top[2] + 0.45)], [0.035, 0.0], leaf_m, segs=4, cap_start=False))
    for i in range(3):
        yaw = 2.3 + i * 2.0
        parts.append(leaf('sleaf', s_top, yaw, rng.uniform(0.62, 0.8), 0.24, [leaf_m, leaf2], segs=4, rise=0.9,
                          droop=0.6, fold=0.2, shape='paddle', two_tone=True, seed=10 + i))
    # fruit: curved stalk out of the crown, bunch of bananas, maroon heart at the tip
    b0 = (top[0] - 0.05, top[1] - 0.05, top[2] - 0.05)
    b1 = (b0[0] - 0.22, b0[1] - 0.18, b0[2] - 0.05)
    parts.append(tube('stalk', [b0, (b0[0] - 0.14, b0[1] - 0.12, b0[2] + 0.03), b1], 0.022, stem_m, segs=4))
    bunch = [(0.0, 0.0), (0.12, 0.05), (0.16, 0.17), (0.13, 0.29), (0.06, 0.37), (0.0, 0.39)]
    parts.append(lathe('bunch', bunch, fruit, segs=6, loc=(b1[0], b1[1], b1[2] - 0.39),
                       wobble=lambda i, k: ((0.025 if (k + i) % 2 else -0.01), 0.0), smooth_angle=60))
    parts.append(lathe('heart', [(0.0, 0.0), (0.065, 0.09), (0.05, 0.19), (0.0, 0.24)], heart, segs=6,
                       loc=(b1[0], b1[1], b1[2] - 0.64), smooth_angle=70))
    return finish(parts, 'prop_banana')


# ------------------------------------------------------------------------------------------- bougainvillea
def bract_dome(name, base, normal, r, mat, seed, segs=7, squash=0.72):
    """One spray of bracts: a low lumpy dome standing on a foliage surface point (`base`, outward `normal`). Its
    centre sits 0.3 r under the surface and the skirt ring tucks below the equator, so it swells OUT of the mass
    with no visible rim. 5 * segs tris; the rings are staggered half a step so the outline stays round."""
    n = Vector(normal).normalized()
    t = n.orthogonal().normalized()
    b = n.cross(t)
    off = Vector((seed * 1.7 + 0.3, seed * 0.9 + 1.1, seed * 2.3 + 0.7))
    c = Vector(base) - n * (0.30 * r)
    verts = [c + n * r * squash * (1.0 + 0.08 * noise.noise(n * 3.1 + off))]
    for k, deg in enumerate((40.0, 78.0, 114.0)):
        pa = math.radians(deg)
        for i in range(segs):
            az = 2 * math.pi * (i + 0.5 * k) / segs
            d = (t * math.cos(az) + b * math.sin(az)) * math.sin(pa) + n * (math.cos(pa) * squash)
            verts.append(c + d * r * (1.0 + 0.15 * noise.noise(d * 2.6 + off)))
    faces = [(0, 1 + i, 1 + (i + 1) % segs) for i in range(segs)]
    for k in range(2):
        a0, a1 = 1 + k * segs, 1 + (k + 1) * segs
        for i in range(segs):
            j = (i + 1) % segs
            faces += [(a0 + i, a1 + i, a0 + j), (a0 + j, a1 + i, a1 + j)]
    out = []
    for f in faces:                                   # wind every triangle outward (away from the dome centre)
        p0, p1, p2 = (verts[i] for i in f)
        nf = (p1 - p0).cross(p2 - p0)
        out.append(f if nf.dot((p0 + p1 + p2) / 3 - c) > 0 else (f[0], f[2], f[1]))
    obj = mesh_obj(name, verts, out, [mat], smooth_angle=None)
    obj.data.polygons.foreach_set('use_smooth', [True] * len(obj.data.polygons))   # soft puff, not a gem
    return obj


def surface_hit(tree, centre, direction):
    """Outermost point of the foliage mass along `direction` from its centre: (point, normal)."""
    d = Vector(direction).normalized()
    loc, nor, _i, _dist = tree.ray_cast(Vector(centre) + d * 3.0, -d, 6.0)
    return loc, (nor if nor.dot(d) > 0 else -nor)


def build_bougainvillea():
    """Big pink bougainvillea bush spilling over a wide terracotta pot (very visible in mockup 03).

    Rain-tree language: ONE soft noise-displaced foliage mass (Leaf) studded with many smaller magenta Flower
    sprays (low lumpy domes ray-cast onto the real mass surface, so none float or hide), plus three sprays that
    spill over the front rim of the pot. One colour per mass, smooth normals, no faceted 'gem' balls.
    """
    leaf_m = M('Leaf', 'leaf', roughness=0.78)
    flower = M('Flower', '#E650B0', roughness=0.75)
    trunk = M('Trunk', 'trunk', roughness=0.8)
    h = 0.46
    parts = [pot(0.25, 0.34, h, segs=10)]
    for i in range(3):
        a = i * 2.1 + 0.4
        parts.append(tube('wood', [(0.05 * math.cos(a), 0.05 * math.sin(a), h - 0.06),
                                   (0.16 * math.cos(a), 0.16 * math.sin(a), h + 0.25)], [0.035, 0.022], trunk,
                          segs=4, cap_start=False))
    cz, rx, ry, rz = h + 0.42, 0.62, 0.58, 0.46
    centre = Vector((0.0, 0.02, cz))
    bush = lumpy('bush', 0.50, tuple(centre), [leaf_m], scale=(rx / 0.5, ry / 0.5, rz / 0.5), subdiv=3,
                 lump=0.17, freq=2.1, seed=7, flat_bottom=-0.30)
    parts.append(bush)
    world = [bush.location + v.co for v in bush.data.vertices]
    tree = BVHTree.FromPolygons(world, [tuple(p.vertices) for p in bush.data.polygons])
    # eight sprays (azimuth, elevation, radius), overlapping into clumps; most face the street (-Y, azimuth ~4.7)
    # and the top, which is what the high 3/4 camera sees
    crown = ((4.7, 0.95, 0.22), (4.0, 0.60, 0.20), (5.4, 0.55, 0.20), (4.75, 0.25, 0.19), (3.3, 0.75, 0.21),
             (1.6, 1.15, 0.21), (0.4, 0.70, 0.19), (2.4, 0.50, 0.19))
    for i, (a, el, r) in enumerate(crown):
        d = (math.cos(el) * math.cos(a), math.cos(el) * math.sin(a), math.sin(el))
        p, nrm = surface_hit(tree, centre, d)
        parts.append(bract_dome('bract', p, nrm, r, flower, 30 + i))
    # sprays tumbling over the front rim (base on the rim, bulging out and down over the terracotta)
    for i, (x, y, z, nrm, r) in enumerate(((-0.08, -0.40, h + 0.03, (-0.05, -0.75, -0.65), 0.18),
                                           (0.22, -0.32, h, (0.5, -0.6, -0.6), 0.15),
                                           (-0.32, -0.25, h + 0.05, (-0.7, -0.5, -0.5), 0.15))):
        parts.append(bract_dome('cascade', (x, y, z), nrm, r, flower, 50 + i, segs=6, squash=1.0))
    return soft_normals(finish(parts, 'prop_bougainvillea'), lambda co: co.z > h - 0.20)


run_assets(ctx, [
    ('prop_pot_plant', build_pot_plant, 900),
    ('prop_banana', build_banana, 900),
    ('prop_bougainvillea', build_bougainvillea, 900),
])
print('[plants] OK')
