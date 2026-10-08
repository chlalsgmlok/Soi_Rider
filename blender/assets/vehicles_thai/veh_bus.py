"""veh_bus — Bangkok BMTA city bus (red lower / cream upper, the '511' of mockup 02). 11.5 x 2.5 x 3.2 m, faces -Y.

Budget <= 5000 tris. Nodes: veh_bus(root) > body, wheel_FL, wheel_FR, wheel_RL, wheel_RR, mirror_L, mirror_R
(origin = hinge on the body), brake_lights (Light_Brake), head_lights (Light_Head), route_board (flat quad,
Sign_Face, UV 0..1 with u = viewer's right, v = up).
Doors are on the model LEFT (+X) = kerb side for Thailand's left-hand traffic.
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
    'paint': mat('Paint', 'bus_red', roughness=0.35),
    'paint2': mat('Paint2', 'bus_cream', roughness=0.4),
    'trim': mat('Trim', 'metal_dark', roughness=0.6),
    'chrome': mat('Chrome', 'chrome', roughness=0.28, metallic=0.5),
    'glass': mat('Glass', 'glass', roughness=0.12),
    'tire': mat('Tire', 'tire', roughness=0.85),
    'head': mat('Light_Head', 'light_head', roughness=0.2, emission=2.5),
    'brake': mat('Light_Brake', 'light_tail', roughness=0.25),
    'tail': mat('Light_Tail', 'light_tail', roughness=0.25, emission=0.6),
    'ind': mat('Light_Indicator', 'light_amber', roughness=0.3),
    'plate': mat('Plate', 'plate_white', roughness=0.45),
    'sign': mat('Sign_Face', 'trim_white', roughness=0.5),
}

L2, HW = 5.75, 1.225           # half length / half width
AX_F, AX_R = -3.35, 2.55       # axle positions (y)
R_W, W_W = 0.59, 0.34          # wheel radius / width
X_W = 1.04                     # wheel centre x
BELT, WIN0, WIN1, STRIPE0, STRIPE1 = 1.40, 1.58, 2.50, 2.60, 2.72
SHELL0, SKIRT1 = 1.20, 1.36     # shell bottom / skirt top: the skirt overlaps the shell and sits 15 mm proud (no z-fight)
ARCH = 0.65                    # wheel-arch cut radius (top 1.24 stays inside the skirt outline)
DOORS_Y = (-4.95, 0.0)         # kerb-side (+X) door centres


# ---------------------------------------------------------------- body shell
def section(y, sx=1.0, sz=1.0):
    poly = [(-HW, SHELL0), (HW, SHELL0), (HW, BELT), (HW, STRIPE0), (HW, STRIPE1), (HW, 2.86), (1.06, 3.15),
            (-1.06, 3.15), (-HW, 2.86), (-HW, STRIPE1), (-HW, STRIPE0), (-HW, BELT)]
    radii = [0.05, 0.05, 0, 0, 0, 0.2, 0.55, 0.55, 0.2, 0, 0, 0]
    return [(x * sx, y, SHELL0 + (z - SHELL0) * sz) for x, z in K.fillet(poly, radii, n=3)]


def band(c):
    z = c.z
    if z < BELT - 0.01:
        return 0
    if STRIPE0 < z < STRIPE1:
        return 0
    return 1


def shell():
    secs = [section(-L2, 0.935, 0.975), section(-L2 + 0.045, 0.985, 0.993), section(-L2 + 0.15),
            section(L2 - 0.15), section(L2 - 0.045, 0.985, 0.993), section(L2, 0.935, 0.975)]
    body = K.loft('shell', secs, mats=[M['paint'], M['paint2']], smooth=50, mat_fn=band, cap_mats=(0, 1))
    return [body]


def wheel_arc(axle, r, n):
    lo = math.degrees(math.asin((0.40 - R_W) / r))
    angs = [180 - lo] + [180 - lo + (2 * lo - 180) * k / (n - 1) for k in range(1, n - 1)] + [lo]
    return [(axle + r * math.cos(math.radians(a)), R_W + r * math.sin(math.radians(a))) for a in angs]


def skirts():
    parts = []
    outline = [(-L2 + 0.05, 0.40)] + wheel_arc(AX_F, ARCH, 7) + wheel_arc(AX_R, ARCH, 7) + \
              [(L2 - 0.05, 0.40), (L2 - 0.05, SKIRT1), (-L2 + 0.05, SKIRT1)]
    radii = [0.10] + [0] * 14 + [0.10, 0, 0]
    pts = K.fillet(outline, radii, n=3)
    for sx in (-1, 1):
        parts.append(K.prism('skirt', pts, 0.10, axis='X', center=sx * (HW - 0.035), mats=[M['paint']], bevel=0.025, segments=1))
        # black rubber arch lips
        for ax in (AX_F, AX_R):
            parts.append(arch_lip(sx * (HW + 0.02), ax))
        # rub strip (black) and cream waist stripe, both broken around the wheels / kerb-side doors
        x = sx * (HW + 0.025)
        rub_spans = [(-L2 + 0.4, AX_F - 0.78), (AX_F + 0.78, AX_R - 0.78), (AX_R + 0.78, L2 - 0.4)]
        stripe_spans = [(-L2 + 0.25, L2 - 0.25)]
        if sx > 0:
            rub_spans = cut_spans(rub_spans, DOORS_Y, 0.56)
            stripe_spans = cut_spans(stripe_spans, DOORS_Y, 0.56)
        for y0, y1 in rub_spans:
            parts.append(K.tube('rub', [(x, y0, 0.78), (x, y1, 0.78)], 0.025, sides=4, mats=[M['trim']]))
        for y0, y1 in stripe_spans:
            parts.append(K.rpanel('waist_stripe', y1 - y0, 0.06, 0.012, 0.025, (sx * (HW + 0.016), (y0 + y1) / 2, 1.31),
                                  normal=(sx, 0, 0), mats=[M['paint2']], n=2))
    parts.append(K.prism('apron_f', K.rrect(2.44, 0.90, 0.10, n=3, cy=0.83), 0.10, axis='Y', center=-L2 + 0.04,
                         mats=[M['paint']], bevel=0.03, segments=1))
    parts.append(K.prism('apron_r', K.rrect(2.36, 1.04, 0.10, n=3, cy=0.90), 0.08, axis='Y', center=L2 + 0.012,
                         mats=[M['paint']], bevel=0.025, segments=1))
    parts.append(box('underbody', (1.60, 10.6, 0.80), (0, 0, 0.80), M['trim'], bevel=0.0))
    return parts


def cut_spans(spans, centres, half):
    """Remove [c - half, c + half] intervals from a list of (y0, y1) spans."""
    out = list(spans)
    for c in centres:
        nxt = []
        for y0, y1 in out:
            if c + half <= y0 or c - half >= y1:
                nxt.append((y0, y1))
                continue
            if c - half - y0 > 0.2:
                nxt.append((y0, c - half))
            if y1 - (c + half) > 0.2:
                nxt.append((c + half, y1))
        out = nxt
    return out


def arch_lip(x, axle):
    sec = K.superellipse(0.03, 0.04, n=6, p_top=2.5, p_bot=2.5)
    rl = ARCH + 0.03
    lo = math.degrees(math.asin((0.40 - R_W) / rl))
    secs = []
    for k in range(6):
        a = math.radians(180 - lo + (2 * lo - 180) * k / 5)
        secs.append([(x + u, axle + (rl + t) * math.cos(a), R_W + (rl + t) * math.sin(a)) for u, t in sec])
    return K.loft('arch_lip', secs, mats=[M['trim']], smooth=70)


# ---------------------------------------------------------------- glazing & doors
def pane(x, y, w, z0=WIN0, z1=WIN1, r=0.08):
    return K.rpanel('pane', w, z1 - z0, 0.03, r, (x, y, (z0 + z1) / 2), normal=(1 if x > 0 else -1, 0, 0),
                    mats=[M['glass']], n=2)


def windows():
    parts = []
    xr, xl = -(HW + 0.004), HW + 0.004
    # right (driver) side: driver window + 11 panes
    parts.append(pane(xr, -5.05, 0.68, z0=1.50))
    n, a, b = 11, -4.58, 5.42
    pitch = (b - a) / n
    for i in range(n):
        parts.append(pane(xr, a + pitch * (i + 0.5), pitch - 0.08))
    # left (kerb) side: front door, 4 panes, middle door, 5 panes
    for y0, y1, n in ((-4.32, -0.62, 4), (0.62, 5.42, 5)):
        pitch = (y1 - y0) / n
        for i in range(n):
            parts.append(pane(xl, y0 + pitch * (i + 0.5), pitch - 0.08))
    for yc in DOORS_Y:
        parts.append(K.rpanel('door', 0.96, 2.12, 0.03, 0.08, (HW + 0.006, yc, 1.52), normal=(1, 0, 0), mats=[M['trim']], n=2))
        parts.append(K.rpanel('door_glass', 0.38, 1.70, 0.03, 0.06, (HW + 0.016, yc - 0.215, 1.62), normal=(1, 0, 0),
                              mats=[M['glass']], n=2))
        parts.append(K.rpanel('door_glass', 0.38, 1.70, 0.03, 0.06, (HW + 0.016, yc + 0.215, 1.62), normal=(1, 0, 0),
                              mats=[M['glass']], n=2))
    # front
    parts.append(K.rpanel('windscreen', 2.18, 1.22, 0.04, 0.14, (0, -L2 - 0.01, 2.06), normal=(0, -1, 0.04),
                          mats=[M['glass']], n=3))
    parts.append(box('ws_pillar', (0.07, 0.05, 1.20), (0, -L2 - 0.035, 2.06), M['trim'], bevel=0.0))
    for sx in (-1, 1):
        parts.append(K.tube('wiper', [(sx * 0.10, -L2 - 0.04, 1.50), (sx * 0.62, -L2 - 0.045, 1.95)], 0.014, sides=4,
                            mats=[M['trim']]))
    # rear
    parts.append(K.rpanel('rear_window', 1.90, 0.86, 0.04, 0.12, (0, L2 + 0.01, 2.24), normal=(0, 1, 0), mats=[M['glass']], n=3))
    return parts


# ---------------------------------------------------------------- front / rear dressing
def front_rear():
    parts = []
    parts.append(K.rpanel('board_frame', 2.00, 0.38, 0.06, 0.06, (0, -L2 - 0.005, 2.89), normal=(0, -1, 0),
                          mats=[M['trim']], n=2))
    parts.append(K.rpanel('bumper_f', 2.46, 0.30, 0.18, 0.08, (0, -L2 - 0.06, 0.52), normal=(0, -1, 0), mats=[M['trim']], n=2,
                          bevel=0.04, segments=1))
    parts.append(K.rpanel('plate_f', 0.44, 0.15, 0.02, 0.02, (0, -L2 - 0.16, 0.52), normal=(0, -1, 0), mats=[M['plate']], n=2))
    parts.append(K.rpanel('grille', 0.92, 0.30, 0.03, 0.06, (0, -L2 - 0.015, 0.88), normal=(0, -1, 0), mats=[M['trim']], n=2))
    for z in (0.82, 0.94):
        parts.append(K.tube('grille_bar', [(-0.40, -L2 - 0.035, z), (0.40, -L2 - 0.035, z)], 0.016, sides=4, mats=[M['chrome']]))
    for sx in (-1, 1):
        parts.append(K.rpanel('lamp_bezel', 0.46, 0.22, 0.04, 0.09, (sx * 0.80, -L2 - 0.015, 0.88), normal=(0, -1, 0),
                              mats=[M['chrome']], n=2))
        parts.append(K.rpanel('indicator', 0.10, 0.13, 0.04, 0.03, (sx * 1.10, -L2 - 0.02, 0.88), normal=(0, -1, 0),
                              mats=[M['ind']], n=2))
    # rear
    parts.append(K.rpanel('bumper_r', 2.40, 0.26, 0.16, 0.08, (0, L2 + 0.07, 0.50), normal=(0, 1, 0), mats=[M['trim']], n=2,
                          bevel=0.035, segments=1))
    parts.append(K.rpanel('plate_r', 0.44, 0.15, 0.02, 0.02, (0, L2 + 0.04, 0.80), normal=(0, 1, 0), mats=[M['plate']], n=2))
    parts.append(K.rpanel('engine_grille', 1.20, 0.30, 0.03, 0.06, (0, L2 + 0.03, 1.12), normal=(0, 1, 0), mats=[M['trim']], n=2))
    for z in (1.07, 1.17):
        parts.append(K.tube('engine_slat', [(-0.52, L2 + 0.05, z), (0.52, L2 + 0.05, z)], 0.014, sides=4, mats=[M['chrome']]))
    for sx in (-1, 1):
        parts.append(K.rpanel('brake_bezel', 0.22, 0.50, 0.03, 0.07, (sx * 0.98, L2 + 0.025, 1.04), normal=(0, 1, 0),
                              mats=[M['chrome']], n=2))
        parts.append(K.lathe('tail', [(0.0, 0.03), (0.05, 0.025), (0.055, 0.0), (0.0, 0.0)], segs=8, mats=[M['tail']],
                             loc=(sx * 0.98, L2 + 0.035, 0.70), normal=(0, 1, 0)))
    # roof hatches, roof ribs + gutters
    for sx in (-1, 1):
        parts.append(K.rpanel('roof_rib', 0.10, 10.2, 0.05, 0.04, (sx * 0.64, 0.0, 3.135), normal=(0, 0, 1),
                              mats=[M['paint2']], n=2))
    parts.append(K.rpanel('emblem', 0.30, 0.14, 0.025, 0.07, (0, -L2 - 0.012, 1.33), normal=(0, -1, 0), mats=[M['chrome']],
                          n=3))
    for y in (-3.3, -0.3, 2.8):
        parts.append(K.rpanel('hatch', 0.84, 0.95, 0.08, 0.12, (0, y, 3.155), normal=(0, 0, 1), mats=[M['paint2']], n=2,
                              bevel=0.03, segments=1, smooth=50))
        parts.append(K.rpanel('hatch_vent', 0.60, 0.10, 0.03, 0.03, (0, y - 0.30, 3.19), normal=(0, 0, 1), mats=[M['trim']], n=2))
    for sx in (-1, 1):
        parts.append(K.tube('gutter', [(sx * 1.235, -L2 + 0.25, 2.92), (sx * 1.235, L2 - 0.25, 2.92)], 0.025, sides=4,
                            mats=[M['paint']]))
    return parts


def lights():
    head = []
    for sx in (-1, 1):
        for dx in (-0.11, 0.11):
            head.append(K.lathe('headlamp', [(0.0, 0.05), (0.05, 0.04), (0.075, 0.01), (0.0, 0.01)], segs=10, mats=[M['head']],
                                loc=(sx * 0.80 + dx, -L2 - 0.035, 0.88), normal=(0, -1, 0)))
    brake = [K.rpanel('brake', 0.16, 0.42, 0.04, 0.06, (sx * 0.98, L2 + 0.045, 1.04), normal=(0, 1, 0), mats=[M['brake']], n=2,
                      taper=0.9) for sx in (-1, 1)]
    return head, brake


def wheels():
    out = {}
    for name, sx, y in (('wheel_FL', 1, AX_F), ('wheel_FR', -1, AX_F), ('wheel_RL', 1, AX_R), ('wheel_RR', -1, AX_R)):
        w = K.toy_wheel(name, R_W, W_W, M['tire'], M['chrome'], side=sx, segs=16, simple=True)
        w.location = (sx * X_W, y, R_W)
        out[name] = w
    return out


def mirrors():
    out = {}
    for name, sx in (('mirror_L', 1), ('mirror_R', -1)):
        hinge = (sx * (HW - 0.01), -5.12, 2.64)
        arm = K.tube(name + '_arm', [hinge, (sx * 1.32, -5.30, 2.70), (sx * 1.37, -5.40, 2.52), (sx * 1.36, -5.40, 2.26)],
                     0.022, sides=6, mats=[M['trim']], caps=False)
        _, head = K.mirror_pod(name, (sx * 1.36, -5.40, 2.26), (sx * 1.35, -5.40, 2.10), (0.20, 0.32, 0.08), 0.02,
                               M['trim'], M['glass'], segs=10)
        bpy_obj = join([head, arm, _], name)
        set_origin(bpy_obj, hinge)
        out[name] = bpy_obj
    return out


root = empty('veh_bus')
w = wheels()
head, brake = lights()
mr = mirrors()
groups = {'shell': shell(), 'skirts': skirts(), 'glass': windows(), 'dress': front_rear(), 'head': head, 'brake': brake,
          'wheels': list(w.values()), 'mirrors': list(mr.values())}
board = K.quad('route_board', 1.88, 0.28, (0, -L2 - 0.04, 2.89), normal=(0, -1, 0), mats=[M['sign']])
K.report(groups)
body = join([o for k in ('shell', 'skirts', 'glass', 'dress') for o in groups[k]], 'body')
set_origin(body, (0, 0, 0))
hl = join(head, 'head_lights')
bl = join(brake, 'brake_lights')
statics = [body, hl, bl, board] + list(mr.values())
K.fit_y(statics + list(w.values()), 11.5, rigid=list(w.values()))
K.bake_location([body, hl, bl, board])
lo, hi = K.bounds([body, hl, bl, board] + list(w.values()))
print(f'[bounds] no-mirror size = {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f}')
for o in statics + list(w.values()):
    set_parent(o, root)

export_glb(ctx, 'veh_bus', [root], max_tris=5000)
render_preview(ctx, 'veh_bus')
render_preview(ctx, 'veh_bus_rear', view=(-0.9, 1.3, 0.6))
render_preview(ctx, 'veh_bus_kerb', view=(1.0, -0.12, 0.22))
print('[veh_bus] OK')
