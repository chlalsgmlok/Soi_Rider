"""veh_songthaew — red pickup songthaew with a covered rear cabin and two side benches. 5.0 x 1.8 x 2.2 m, faces -Y.

Budget <= 3500 tris. Nodes: veh_songthaew(root) > body, wheel_FL, wheel_FR, wheel_RL, wheel_RR, mirror_L, mirror_R
(origin = door hinge), brake_lights (Light_Brake), head_lights (Light_Head), route_board (roof-front sign quad, Sign_Face,
UV 0..1 with u = viewer's right, v = up).
Materials: Paint (red body), Paint2 (rear-cabin roof; runtime sets it from config), Stripe (fixed cream side stripe),
Trim, Chrome, Glass, Seat (wooden benches), Tire, Plate, Light_Head, Light_Brake, Light_Indicator, Sign_Face.
"""
import os
import sys
import math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import box, empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.preview import render_preview
from lib import vehicles_thai_kit as K

ctx = start()

M = {
    'paint': mat('Paint', 'bus_red', roughness=0.34),
    'paint2': mat('Paint2', 'bus_cream', roughness=0.4),
    'stripe': mat('Stripe', 'cream', roughness=0.4),
    'trim': mat('Trim', 'metal_dark', roughness=0.6),
    'chrome': mat('Chrome', 'chrome', roughness=0.26, metallic=0.55),
    'glass': mat('Glass', 'glass', roughness=0.12),
    'seat': mat('Seat', 'wood_light', roughness=0.6),
    'tire': mat('Tire', 'tire', roughness=0.85),
    'plate': mat('Plate', 'plate_yellow', roughness=0.45),
    'head': mat('Light_Head', 'light_head', roughness=0.2, emission=2.5),
    'brake': mat('Light_Brake', 'light_tail', roughness=0.25),
    'sign': mat('Sign_Face', 'cream', roughness=0.5),
}

AX_F, AX_R = -1.72, 1.40      # axle y
R_W, W_W, X_W = 0.38, 0.26, 0.74
ARCH = 0.50                   # wheel-arch radius
HW = 0.88                     # body half width
Z0, BELT = 0.50, 1.14         # body bottom / belt (bed rail) height
CAB_BACK = -0.62
ROOF_Z = 2.05
HEAD = []          # headlamp lenses collected while dressing the nose


# ---------------------------------------------------------------- body
def arch_pts(axle, n=7):
    lo = math.degrees(math.asin((Z0 - R_W) / ARCH))
    return [(axle + ARCH * math.cos(math.radians(180 - lo + (2 * lo - 180) * k / (n - 1))),
             R_W + ARCH * math.sin(math.radians(180 - lo + (2 * lo - 180) * k / (n - 1)))) for k in range(n)]


def lower_body():
    """Side-profile prism (hood + cab sill + bed sides) with wheel arches; plan rounded at the nose, then bevelled."""
    a_f, a_r = arch_pts(AX_F), arch_pts(AX_R)
    outline = ([(-2.50, Z0), (-2.30, Z0)] + a_f + [(-0.40, Z0), (0.40, Z0)] + a_r + [(2.50, Z0), (2.52, BELT),
               (1.20, BELT), (CAB_BACK, BELT), (-1.20, BELT - 0.02), (-1.78, BELT - 0.04), (-2.10, BELT - 0.06),
               (-2.32, BELT - 0.09), (-2.53, 0.96), (-2.53, 0.62)])
    radii = [0.10, 0] + [0] * 7 + [0, 0] + [0] * 7 + [0.08, 0.10, 0, 0, 0, 0, 0, 0.16, 0.06, 0]
    pts = K.fillet(outline, radii, n=3)
    body = K.prism('lower_body', pts, HW * 2, axis='X', mats=[M['paint']], smooth=None)
    # round the plan view towards the nose (and a touch at the tail)
    me = body.data
    for v in me.vertices:
        y = v.co.y
        s = 1.0
        if y < -1.95:
            s = 1.0 - 0.14 * ((-1.95 - y) / 0.58) ** 2
        elif y > 2.30:
            s = 1.0 - 0.04 * ((y - 2.30) / 0.22) ** 2
        v.co.x *= s
    me.update()
    return K.finish(body, [M['paint']], bevel=0.075, segments=2, angle=30, smooth=40)


def arch_lip(x, axle):
    sec = K.superellipse(0.035, 0.04, n=4, p_top=2.0, p_bot=2.0)
    lo = math.degrees(math.asin((Z0 - R_W) / (ARCH + 0.02)))
    secs = []
    for k in range(6):
        a = math.radians(180 - lo + (2 * lo - 180) * k / 5)
        secs.append([(x + u, axle + (ARCH + 0.02 + t) * math.cos(a), R_W + (ARCH + 0.02 + t) * math.sin(a)) for u, t in sec])
    return K.loft('arch_lip', secs, mats=[M['trim']], smooth=70)


def greenhouse():
    """Cab glasshouse: loft of plan outlines up the Z axis; band between sill and roof is glass."""
    def sec(z, w, d, cy, r):
        return [(x, y, z) for x, y in K.rrect(w, d, r, n=3, cy=cy)]
    secs = [sec(1.06, 1.70, 0.96, -1.16, 0.14), sec(1.13, 1.70, 0.96, -1.16, 0.14),
            sec(1.70, 1.54, 0.50, -0.92, 0.14), sec(1.78, 1.44, 0.42, -0.92, 0.12)]

    def band(c):
        if not 1.14 < c.z < 1.69:
            return 0
        t = (c.z - 1.13) / 0.57                       # glass band: body-coloured A/C pillars at the plan corners
        cy, hd, hw = -1.16 + 0.24 * t, 0.48 - 0.23 * t, 0.85 - 0.08 * t
        return 0 if (abs(c.y - cy) > hd - 0.13 and abs(c.x) > hw - 0.13) else 1
    return K.loft('greenhouse', secs, mats=[M['paint'], M['glass']], smooth=40, mat_fn=band, cap_mats=(0, 0))


def rear_cabin():
    parts = []
    # roof: puffy rounded slab overhanging the cab, chrome luggage rail on top
    parts.append(K.rpanel('roof', 1.80, 3.62, 0.12, 0.22, (0, 0.80, ROOF_Z), normal=(0, 0, 1), mats=[M['paint2']], n=3,
                          bevel=0.045, segments=2, smooth=50))
    rack = K.rrect(1.56, 3.10, 0.18, n=2, cy=0.86)
    parts.append(K.tube('rack', [(x, y, ROOF_Z + 0.12) for x, y in rack], 0.022, sides=5, mats=[M['chrome']], closed=True))
    for y in (-0.25, 0.86, 1.97):
        parts.append(K.tube('rack_bar', [(-0.76, y, ROOF_Z + 0.12), (0.76, y, ROOF_Z + 0.12)], 0.016, sides=4,
                            mats=[M['chrome']], caps=False))
    for x, y in ((-0.70, -0.55), (0.70, -0.55), (-0.70, 2.30), (0.70, 2.30)):
        parts.append(K.tube('rack_foot', [(x, y, ROOF_Z + 0.05), (x * 1.0, y, ROOF_Z + 0.12)], 0.02, sides=4,
                            mats=[M['chrome']], caps=False))
    # header band under the roof (sides + front) and front bulkhead behind the cab
    for sx in (-1, 1):
        parts.append(box('header', (0.07, 3.08, 0.14), (sx * 0.85, 0.96, 1.93), M['paint'], bevel=0.03, segments=1))
        parts.append(K.rpanel('header_stripe', 2.90, 0.035, 0.01, 0.015, (sx * 0.888, 0.96, 1.93), normal=(sx, 0, 0),
                              mats=[M['stripe']], n=2))
    parts.append(box('bulkhead', (1.70, 0.07, 0.86), (0, CAB_BACK + 0.05, 1.55), M['paint'], bevel=0.03, segments=1))
    # posts: corner + mid, rounded square sections
    for sx in (-1, 1):
        for y in (CAB_BACK + 0.06, 0.62, 1.62, 2.44):
            parts.append(K.tube('post', [(sx * 0.845, y, 1.12), (sx * 0.845, y, 1.92)], 0.038, sides=6, mats=[M['paint']],
                                caps=False))
        parts.append(K.tube('rail', [(sx * 0.86, CAB_BACK + 0.06, 1.50), (sx * 0.86, 2.44, 1.50)], 0.02, sides=5,
                            mats=[M['chrome']], caps=False))
    # rear grab bars + step
    for sx in (-1, 1):
        parts.append(K.tube('grab', [(sx * 0.80, 2.52, 1.20), (sx * 0.80, 2.58, 1.28), (sx * 0.80, 2.58, 1.78),
                                     (sx * 0.80, 2.50, 1.86)], 0.022, sides=5, mats=[M['chrome']], caps=False))
    parts.append(K.rpanel('step', 1.30, 0.24, 0.07, 0.06, (0, 2.60, 0.42), normal=(0, 0, 1), mats=[M['trim']], n=2))
    parts.append(K.tube('step_edge', [(-0.64, 2.72, 0.44), (0.64, 2.72, 0.44)], 0.02, sides=4, mats=[M['chrome']], caps=False))
    return parts


def interior():
    parts = [K.rpanel('floor', 1.60, 3.00, 0.02, 0.06, (0, 0.94, BELT + 0.01), normal=(0, 0, 1), mats=[M['trim']], n=2)]
    for sx in (-1, 1):
        parts.append(K.rpanel('bench', 0.38, 2.90, 0.12, 0.08, (sx * 0.56, 0.92, BELT + 0.18), normal=(0, 0, 1),
                              mats=[M['seat']], n=2, bevel=0.035, segments=1, smooth=50))
        parts.append(box('bench_leg', (0.30, 2.80, 0.12), (sx * 0.58, 0.92, BELT + 0.07), M['trim'], bevel=0.0))
        parts.append(K.rpanel('backrest', 2.88, 0.26, 0.07, 0.06, (sx * 0.79, 0.92, 1.47), normal=(-sx, 0, 0.12),
                              mats=[M['seat']], n=2))
    return parts


def dressing():
    parts = []
    # side stripe, door seams, handles, fuel cap
    for sx in (-1, 1):
        x = sx * (HW + 0.004)
        parts.append(K.rpanel('stripe', 4.25, 0.07, 0.012, 0.03, (x, 0.22, 0.98), normal=(sx, 0, 0), mats=[M['stripe']], n=2))
        for y in (-1.17, -0.66):
            parts.append(K.rpanel('seam', 0.018, 0.52, 0.01, 0.006, (x, y, 0.82), normal=(sx, 0, 0), mats=[M['trim']], n=1))
        parts.append(K.rpanel('handle', 0.14, 0.04, 0.025, 0.015, (sx * (HW + 0.01), -0.82, 1.04), normal=(sx, 0, 0),
                              mats=[M['chrome']], n=2))
        parts.append(arch_lip(sx * (HW - 0.03), AX_F))
        parts.append(arch_lip(sx * (HW - 0.03), AX_R))
    # front: grille, bumper, plate, indicators
    parts.append(K.rpanel('grille', 0.82, 0.26, 0.04, 0.07, (0, -2.53, 0.80), normal=(0, -1, 0), mats=[M['trim']], n=2))
    for z in (0.75, 0.85):
        parts.append(K.tube('grille_bar', [(-0.36, -2.555, z), (0.36, -2.555, z)], 0.017, sides=4, mats=[M['chrome']]))
    parts.append(K.rpanel('emblem', 0.12, 0.07, 0.02, 0.03, (0, -2.565, 0.80), normal=(0, -1, 0), mats=[M['chrome']], n=2))
    parts.append(K.rpanel('bumper_f', 1.70, 0.17, 0.16, 0.07, (0, -2.56, 0.55), normal=(0, -1, 0), mats=[M['chrome']], n=2,
                          bevel=0.03, segments=1))
    parts.append(K.rpanel('plate_f', 0.40, 0.13, 0.02, 0.02, (0, -2.645, 0.55), normal=(0, -1, 0), mats=[M['plate']], n=2))
    for sx in (-1, 1):
        bz, lens = K.ring_lamp('headlamp', 0.095, (sx * 0.53, -2.515, 0.81), (0, -1, 0), M['head'], M['chrome'], segs=12,
                               d=0.09)
        parts.append(bz)
        HEAD.append(lens)
    # rear: bumper, plate, tailgate latch bar
    parts.append(K.rpanel('bumper_r', 1.74, 0.14, 0.12, 0.06, (0, 2.56, 0.56), normal=(0, 1, 0), mats=[M['trim']], n=2,
                          bevel=0.025, segments=1))
    parts.append(K.rpanel('plate_r', 0.38, 0.17, 0.02, 0.025, (0, 2.53, 0.80), normal=(0, 1, 0), mats=[M['plate']], n=2))
    parts.append(K.tube('latch', [(-0.40, 2.535, 1.02), (0.40, 2.535, 1.02)], 0.018, sides=4, mats=[M['chrome']]))
    for sx in (-1, 1):
        parts.append(K.rpanel('bezel_r', 0.20, 0.34, 0.03, 0.06, (sx * 0.68, 2.515, 0.86), normal=(0, 1, 0),
                              mats=[M['chrome']], n=2))
    # roof-front sign box (the route_board quad sits on its face)
    parts.append(K.rpanel('sign_box', 0.96, 0.19, 0.10, 0.05, (0, -1.00, 1.89), normal=(0, -1, 0.0),
                          mats=[M['paint']], n=2))
    parts.append(box('chassis', (1.30, 4.10, 0.22), (0, 0.10, 0.48), M['trim'], bevel=0.0))
    return parts


def lights():
    head = HEAD
    brake = [K.rpanel('brake', 0.13, 0.27, 0.04, 0.045, (sx * 0.68, 2.535, 0.86), normal=(0, 1, 0), mats=[M['brake']], n=2,
                      taper=0.9) for sx in (-1, 1)]
    return head, brake


def wheels():
    out = {}
    for name, sx, y in (('wheel_FL', 1, AX_F), ('wheel_FR', -1, AX_F), ('wheel_RL', 1, AX_R), ('wheel_RR', -1, AX_R)):
        w = K.toy_wheel(name, R_W, W_W, M['tire'], M['chrome'], side=sx, segs=12, simple=True)
        w.location = (sx * X_W, y, R_W)
        out[name] = w
    return out


def mirrors():
    out = {}
    for name, sx in (('mirror_L', 1), ('mirror_R', -1)):
        hinge = (sx * 0.84, -1.30, 1.16)
        stalk, head = K.mirror_pod(name, hinge, (sx * 0.97, -1.40, 1.22), (0.11, 0.15, 0.06), 0.015,
                                   M['trim'], M['glass'], segs=8)
        obj = join([head, stalk], name)
        set_origin(obj, hinge)
        out[name] = obj
    return out


root = empty('veh_songthaew')
w = wheels()
head, brake = lights()
mr = mirrors()
groups = {'lower': [lower_body()], 'cab': [greenhouse()], 'rear': rear_cabin(), 'inside': interior(), 'dress': dressing(),
          'head': head, 'brake': brake, 'wheels': list(w.values()), 'mirrors': list(mr.values())}
board = K.quad('route_board', 0.86, 0.13, (0, -1.056, 1.89), normal=(0, -1, 0), mats=[M['sign']])
K.report(groups)
body = join([o for k in ('lower', 'cab', 'rear', 'inside', 'dress') for o in groups[k]], 'body')
set_origin(body, (0, 0, 0))
hl = join(head, 'head_lights')
bl = join(brake, 'brake_lights')
statics = [body, hl, bl, board] + list(mr.values())
K.fit_y(statics + list(w.values()), 5.0, rigid=list(w.values()))
K.bake_location([body, hl, bl, board])
lo, hi = K.bounds([body, hl, bl, board] + list(w.values()))
print(f'[bounds] no-mirror size = {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f}')
for o in statics + list(w.values()):
    set_parent(o, root)

export_glb(ctx, 'veh_songthaew', [root], max_tris=3500)
render_preview(ctx, 'veh_songthaew')
render_preview(ctx, 'veh_songthaew_rear', view=(-0.9, 1.3, 0.75))
print('[veh_songthaew] OK')
