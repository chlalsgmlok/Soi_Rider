"""veh_taxi — Bangkok meter taxi (Corolla-like chunky sedan), two-tone Paint (lower) / Paint2 (upper + roof).

Run: node blender/run-blender.mjs blender/assets/vehicles_cars/veh_taxi.py [--no-preview]
Facing -Y, model LEFT = +X. Contract: docs/ASSET_SPEC.md (vehicles). Mirrors, wheels and hood/boot seams come from
the shared sedan kit (lib/vehicles_cars_sedan.py); lamps, bezels, reflectors and the front/side/rear details are
fitted to this shell by lib/vehicles_cars_taxi.py (corner casts). The SHELL is the taxi's own softer toy variant:
domed hood, fat rounded nose/tail and bumpers, more tumblehome, rounder plan corners and a bubble cabin, so it
sits next to the puffy tuk-tuk of mockup 03 instead of reading angular.
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bmesh
import bpy
from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import tri_count
from lib.vehicles_cars_mesh import rbox, finish, join_objs, quad, fillet, arch_points, _activate
from lib.vehicles_cars_body import greenhouse, Surface
from lib.vehicles_cars_mesh import prism, bisect, bevel_sharp, round_plan
from lib.vehicles_cars_parts import stick
from lib.vehicles_cars_rig import car_mats, text_obj, assemble, previews
from lib import vehicles_cars_sedan as sedan
from lib import vehicles_cars_taxi as taxi

ctx = start()
NAME = 'veh_taxi'
M = car_mats('taxi_pink', 'taxi_pink', plate='plate_yellow', extra=[
    ('sign', mat('Sign_Taxi', 'cream', roughness=0.4, emission=0.6)),
    ('sign_text', mat('Sign_Text', 'ink', roughness=0.5)),
    ('vacant', mat('Vacant_Light', 'neon_red', roughness=0.3, emission=1.2)),
    ('decal', mat('Decal_White', 'cream', roughness=0.5)),
])

S = sedan.Spec(
    hw=0.88, r=0.36, tw=0.27, wheel_x=0.745, yf=-1.38, yr=1.34, ar=0.43, sill=0.28,
    nose=-2.27, tail=2.27, belt=0.92, split=0.76, tub_upper='paint2', segs=int(os.environ.get('CAR_SEGS', '3')),
    deck_z=0.87, deck_y=1.62, cowl_y=-0.98, hood_mid=(-1.52, 0.93), hood_z=0.82,
    tub_bevel=0.14, fillet_step=26, plan_reach=0.95, plan_inset=0.30, tumble=(0.46, 0.88),
    gh_profile=[(-1.12, 0.885, 0.0), (-0.40, 1.38, 0.40), (0.38, 1.46, 0.95), (1.08, 1.39, 0.42), (1.80, 0.885, 0.0)],
    gh_half=0.80, gh_top=0.75, gh_zbase=0.885, gh_zglass=0.95, gh_bevel=0.16, ring='trim',
    pillars=[(0.10, 0.13, 'trim'), (1.03, 0.16, 'paint2')], belt_ys=(-0.80, -0.2, 0.4, 0.95, 1.45),
    door_front_y=-0.91, door_mid_y=0.10, door_rear_y=0.96, handle_ys=(-0.50, 0.60), handle_z=0.72,
    strip=(0.0, 1.80, 0.47), mirror=(-0.86, 0.96), mirror_tip=1.03, mirror_size=(0.30, 0.14, 0.20),
    hood_seam=(0.50, -1.98, -1.22), boot_seam=(0.46, 1.74, 2.06), wiper_y=-1.05,
    grille='bar', grille_z=0.68, grille_w=0.60, intake_w=0.92, head=(0.38, 0.77, 0.635, 0.755), head_surround='chrome',
    tail_lamp=(0.36, 0.80, 0.64, 0.79), tail_amber=0.67, third_brake_z=1.24,
)
# taxi-fitted lamps (lib/vehicles_cars_taxi.py): u = |x| across the flat nose/tail, then xk + arc length round a
# corner of radius rk centred rk inside the nose/tail, so every lamp hugs the rounded corner (no grazing rays)
L = sedan.Spec(
    xk=0.40, rk=0.40, head_u=(0.38, 0.85), head_v=(0.635, 0.755), amber_u=(0.85, 0.93),
    fog_u=(0.39, 0.51), fog_v=(0.39, 0.445), intake_w=0.70,
    tail_u=(0.36, 0.84), tail_v=(0.64, 0.79), rear_amber_u=(0.84, 0.93), brake_u=(0.42, 0.62), brake_v=(0.67, 0.76),
    refl_u=(0.38, 0.49), refl_v=(0.415, 0.45), lip_w=0.96,
)



def taxi_profile(S):
    """Softer toy side profile than the shared sedan: crowned hood falling into a fat round nose, chunky rounded
    bumper corners front and rear, rounder boot."""
    n, t, b = S.nose, S.tail, S.belt
    pts = [(n + 0.17, 0.30, 0.11)]
    pts += arch_points(S.yf, S.r, S.ar, S.sill)
    pts += arch_points(S.yr, S.r, S.ar, S.sill)
    pts += [(t - 0.17, 0.30, 0.11), (t - 0.01, 0.43, 0.15), (t, 0.66, 0.24), (t - 0.15, S.deck_z, 0.30),
            (S.deck_y, b, 0.0), (S.cowl_y, b, 0.0), (S.hood_mid[0], S.hood_mid[1], 0.55),
            (n + 0.16, S.hood_z, 0.30), (n, 0.58, 0.24), (n + 0.03, 0.39, 0.12)]
    return fillet(pts, S.fillet_step)


def taxi_tub(M, profile, S, small=0.035, end_reach=0.38, rows=()):
    """Kit tub() steps (prism -> lean -> big/small bevels -> plan rounding -> two-tone split -> materials) with a
    BARREL flank: horizontal cuts give the side caps rows, then x shrinks with t**1.7 above tumble z0 so the
    sides curve into the shoulders (the kit's linear lean reads flat and slab-sided)."""
    bm = bmesh.new()
    prism(bm, profile, S.hw, M['paint'])
    ys = [p[0] for p in profile]
    y0, y1 = min(ys), max(ys)
    z0, scale = S.tumble
    z1 = max(p[1] for p in profile)
    for z in (z0,) + tuple(rows):
        bisect(bm, (0, 0, z), (0, 0, 1))
    for v in bm.verts:
        if v.co.z > z0:
            t = min(1.0, (v.co.z - z0) / (z1 - z0))
            v.co.x *= 1.0 - (1.0 - scale) * t ** 1.7
    bm.normal_update()
    big_z = S.r + S.ar + 0.02

    def is_big(e):
        if not any(abs(f.normal.x) > 0.9 for f in e.link_faces):
            return False
        zmin = min(v.co.z for v in e.verts)
        near_end = all(v.co.y < y0 + end_reach or v.co.y > y1 - end_reach for v in e.verts)
        return zmin > big_z or (near_end and zmin > S.sill + 0.06)

    bevel_sharp(bm, S.tub_bevel, S.segs, skip=lambda e: not is_big(e))
    bevel_sharp(bm, small, 2, min_deg=55.0)
    round_plan(bm, y0, y1, S.plan_reach, S.plan_inset, cuts=(0.35, 1.0))
    bisect(bm, (0, 0, S.split), (0, 0, 1))
    bm.normal_update()
    arches = [(S.yf, S.r, S.ar), (S.yr, S.r, S.ar)]
    for f in bm.faces:
        c, n = f.calc_center_median(), f.normal
        key = S.tub_upper if c.z > S.split else 'paint'
        if n.z < -0.55 and c.z < S.sill + 0.12:
            key = 'trim'
        for ya, za, ra in arches:
            if math.hypot(c.y - ya, c.z - za) < ra + 0.02 and abs(n.x) < 0.45 and c.z < za + ra + 0.02:
                key = 'trim'
        f.material_index = M[key]
    return bm


def taxi_shell(M, S):
    tub_bm = taxi_tub(M, taxi_profile(S), S)
    gh_bm = greenhouse(M, fillet(S.gh_profile, 22), S.gh_half, top_scale=S.gh_top, z_base=S.gh_zbase,
                       z_glass=S.gh_zglass, bevel=S.gh_bevel, segs=3, inset=0.036, depth=0.014,
                       pillars=S.pillars, ring=S.get('ring'))
    return tub_bm, gh_bm, Surface([tub_bm, gh_bm])


tub_bm, gh_bm, surf = taxi_shell(M, S)
tub_ob = M.obj('body', tub_bm)
gh_ob = M.obj('greenhouse', gh_bm)

d = bmesh.new()
taxi.front_details(d, M, surf, S, L)
taxi.side_details(d, M, surf, S)
sedan.top_details(d, M, surf, S)
taxi.rear_details(d, M, surf, S, L)
# taxi extras: red 'vacant' light behind the windscreen (passenger side), roof aerial
stick(d, M, surf.front(0.38, 1.05), (0.14, 0.03, 0.05), 'vacant', segs=0, out=0.012)
stick(d, M, surf.top(0.0, 0.95), (0.05, 0.10, 0.06), 'trim', segs=0, out=0.05, front=(0.6, 0.5))
# door decals: two white 'text' lines on each front door (company name + taxi number)
for sd in (1, -1):
    for y, z, w, h in ((-0.42, 0.625, 0.50, 0.05), (-0.48, 0.555, 0.34, 0.045)):
        loc, nor = surf.side(y, z, sd)
        quad(d, loc, nor, w, h, M['decal'], lift=0.004)
det_ob = M.obj('details', d)
print(f'[stats] tub={tri_count([tub_ob])} greenhouse={tri_count([gh_ob])} details={tri_count([det_ob])}')

head, brake = taxi.lights(M, surf, S, L)

# roof sign: cream box, 'TAXI' modelled on both long faces
SY = 0.32
roof = surf.top(0, SY)[0].z
SW, SD, SH = 0.70, 0.17, 0.17
sg = bmesh.new()
rbox(sg, (0.48, 0.12, 0.03), (0, SY, roof + 0.008), 0.0, 0, M['trim'])
rbox(sg, (SW, SD, SH), (0, SY, roof + 0.02 + SH / 2), 0.042, 2, M['sign'], top=(0.93, 0.88))
sign = M.obj('taxi_sign', sg, origin=(0, SY, roof))
zc = roof + 0.02 + SH / 2
t1 = text_obj(M, 'sign_txt_f', 'TAXI', 0.13, (0, SY - SD / 2 - 0.003, zc), (math.pi / 2, 0, 0), 'sign_text', bold=0.006)
t2 = text_obj(M, 'sign_txt_b', 'TAXI', 0.13, (0, SY + SD / 2 + 0.003, zc), (math.pi / 2, 0, math.pi), 'sign_text',
              bold=0.006)
sign = join_objs([sign, t1, t2], 'taxi_sign')

mirrors = sedan.mirrors(M, surf, S)
wheels = sedan.wheels(M, S)
body = join_objs([tub_ob, gh_ob, det_ob], 'body')


def soft_finish(obj, weight):
    """Kit finish (sharp edges by angle) but GENTLE face-area weighted normals: big panels stay readable while the
    bevels/shoulders roll softly instead of reading as hard chamfers (kit default weight 50 = angular look)."""
    finish(obj, weighted=False)
    _activate(obj)
    mod = obj.modifiers.new('WN', 'WEIGHTED_NORMAL')
    mod.mode = 'FACE_AREA'
    mod.weight = weight
    mod.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


soft_finish(body, int(os.environ.get('TAXI_WN', '20')))
for o in [head, brake, sign] + mirrors + wheels:
    finish(o)
assemble(ctx, NAME, body, wheels, mirrors + [head, brake, sign], max_tris=int(os.environ.get('MAXTRIS', '3500')))
previews(ctx, NAME, variants=[('gy', {'Paint': 'taxi_green', 'Paint2': 'taxi_yellow'})])
print('[veh_taxi] OK')
