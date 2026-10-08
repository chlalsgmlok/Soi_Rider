"""Thai shophouse module shell shared by bld_shophouse_2f / _3f / _4f.

Module = 4.0 m wide (x -2..2) x 10 m deep (y 0..10), facade plane y=0 facing -Y (street).
Floor lines are identical for every module (ground floor 4.0 m, upper floors 3.0 m, parapet 0.5 m) so mixed
rows line up: string courses, awnings, signboards and pilasters continue across neighbours. Party-wall pilasters
are half-width (0.2 m) at each edge, so two neighbours form one 0.4 m column.
"""
import math
from lib.shapes import cyl, cone, sphere
from lib.buildings_kit import rbx, bx, quad_uv, quad_x, mesh_obj, rod
from lib.buildings_parts import awning, roller_shutter, shop_interior, sign_board

HW = 2.0          # half width
D = 10.0          # depth
G = 4.0           # ground-floor storey height (first floor slab line)
F = 3.0           # upper storey height
PARAPET = 0.5
OPEN_X = 1.72     # half width of the shop opening
OPEN_Z = 2.75     # shop opening height
SHOP_D = 1.7      # visible shop depth behind the facade
AWN_Z = 3.08      # awning attachment height on the wall
SIGN_Z = (3.2, 3.96)


def height(floors):
    return G + F * (floors - 1) + PARAPET


def floor_lines(floors):
    """z of each upper-floor slab line (string course bottom)."""
    return [G + F * i for i in range(floors - 1)]


def shell(P, M, floors, flavour=0, awning_n=8, front_parapet=True, wall_sign=True):
    """Masses, pilasters, string courses, cornice, parapets, roof deck, ground-floor shop, awning, back windows.

    Returns (H, z_roof, sign_rect) where sign_rect = (x0, x1, z0, z1, y) for the `signboard` quad (None when
    wall_sign=False: the module then mounts its own sign, e.g. on a balcony fascia that would hide a wall sign)."""
    H = height(floors)
    zr = H - PARAPET
    # --- masses (upper block over the shop opening, rear block, two side piers)
    P.add(bx('mass_upper', -HW, HW, 0.0, D, OPEN_Z, zr, M['wall'], bevel=0.14, seg=2))
    P.add(rbx('mass_rear', -HW, HW, SHOP_D, D, 0.0, OPEN_Z + 0.01, M['wall'], bevel=0.04, open=('-z', '+z', '-y')))
    for a, b in ((-HW, -OPEN_X), (OPEN_X, HW)):
        P.add(rbx('pier', a, b, 0.0, SHOP_D + 0.01, 0.0, OPEN_Z + 0.01, M['wall'], bevel=0, open=('-z', '+z')))
    # --- half pilasters on the party walls (+ plinth)
    for a, b in ((-HW, -HW + 0.2), (HW - 0.2, HW)):
        P.add(rbx('pilaster', a, b, -0.1, 0.0, 0.0, zr, M['wall2'], bevel=0.06, open=('+y', '-z')))
        P.add(rbx('plinth', a, b, -0.14, 0.0, 0.0, 0.45, M['trim'], bevel=0, open=('+y', '-z')))
    # --- string courses and top cornice
    for z in floor_lines(floors):
        P.add(rbx('band', -HW, HW, -0.17, 0.0, z, z + 0.2, M['trim'], bevel=0.07, seg=2, open=('+y',)))
    P.add(rbx('cornice', -HW, HW, -0.27, 0.0, zr - 0.14, zr + 0.06, M['trim'], bevel=0.09, seg=2, open=('+y',)))
    # --- parapets + roof deck
    if front_parapet:
        P.add(rbx('parapet_f', -HW, HW, -0.12, 0.22, zr, H, M['wall2'], bevel=0.05, open=('-z',)))
        P.add(rbx('parapet_cap', -HW, HW, -0.17, 0.27, H - 0.06, H + 0.02, M['trim'], bevel=0.03, open=('-z',)))
    for a, b in ((-HW, -HW + 0.16), (HW - 0.16, HW)):
        P.add(rbx('parapet_s', a, b, 0.2, D, zr - 0.16, H - 0.12, M['wall'], bevel=0.03, open=('-z',)))
    P.add(rbx('parapet_b', -HW, HW, D - 0.16, D, zr - 0.16, H - 0.12, M['wall'], bevel=0.03, open=('-z',)))
    P.add(rbx('roof_deck', -HW + 0.16, HW - 0.16, 0.2, D - 0.16, zr - 0.02, zr + 0.03, M['roof'], bevel=0, open=('-z',)))
    # --- ground floor shop
    P.add(rbx('lintel', -OPEN_X - 0.04, OPEN_X + 0.04, -0.08, 0.02, OPEN_Z - 0.02, OPEN_Z + 0.2, M['trim'], bevel=0.03, open=('+y',)))
    roller_shutter(P, M, -OPEN_X, OPEN_X, 1.8, OPEN_Z, 0.16, ribs=8)
    shop_interior(P, M, -OPEN_X, OPEN_X, 0.0, SHOP_D, OPEN_Z, flavour)
    awning(P, M, -HW + 0.06, HW - 0.06, AWN_Z, 1.55, 0.5, awning_n)
    awning_bulbs(P, M)
    sign = sign_board(P, M, -1.84, 1.84, SIGN_Z[0], SIGN_Z[1]) if wall_sign else None
    # --- back facade: door + one window per upper floor (cheap, faces +Y)
    back_opening(P, M, -0.55, 0.45, 0.0, 2.2, M['wood'])
    for z in floor_lines(floors):
        back_opening(P, M, -0.7, 0.7, z + 0.9, z + 2.2, M['window'])
    return H, zr, sign


def back_opening(P, M, x0, x1, z0, z1, fill):
    P.add(mesh_obj('back_fill', [(x1, D + 0.012, z0), (x0, D + 0.012, z0), (x0, D + 0.012, z1), (x1, D + 0.012, z1)],
                   [(0, 1, 2, 3)], [fill]))
    P.add(rbx('back_hood', x0 - 0.1, x1 + 0.1, D, D + 0.12, z1, z1 + 0.12, M['trim'], bevel=0, open=('-y',)))


def awning_bulbs(P, M, xs=(-1.05, 1.05), y=-1.28):
    """Bare warm bulbs hanging on cords under the awning (mockup 03 shopfront glow; Lamp_Glow lights up at night)."""
    for x in xs:
        P.add(rod('bulb_cord', (x, y, 2.68), (x, y, 2.2), 0.012, M['dark'], verts=3))
        P.add(cone('bulb_cap', 0.06, 0.035, 0.08, (x, y, 2.19), M['metal'], verts=6))
        P.add(sphere('bulb', 0.1, (x, y, 2.07), M['lamp'], segments=6, rings=3))


def side_dressing(P, M, zr, ad_side=0, ad_mats=None):
    """Party-wall details that only show where a taller module rises above a lower neighbour (kept above the 2f
    roof line, z > 7.6, so they hide inside taller neighbours): rear downpipes, small vents, optional painted ad."""
    for s in (-1, 1):
        P.add(rod('side_pipe', (s * 2.06, 9.55, zr + 0.1), (s * 2.06, 9.55, 7.25), 0.05, M['steel'], verts=5))
        for y in (5.2, 6.4):
            a, b = sorted((s * 2.0, s * 2.04))
            P.add(rbx('side_vent', a, b, y - 0.22, y + 0.22, zr - 1.2, zr - 0.8, M['dark'], bevel=0,
                      open=(('-x',) if s > 0 else ('+x',))))
    if ad_side and ad_mats:
        s = ad_side
        a, b = sorted((s * 2.0, s * 2.035))
        P.add(rbx('ad_border', a, b, 1.3, 8.5, 8.1, zr - 0.35, M['trim'], bevel=0, open=(('-x',) if s > 0 else ('+x',))))
        P.add(quad_x('ad_panel', 1.48, 8.32, 8.28, zr - 0.53, s * 2.04, ad_mats[0], facing=s))
        P.add(cyl('ad_disc', 1.15, 0.03, (s * 2.05, 3.4, (8.28 + zr - 0.53) / 2), ad_mats[1], rot=(0, math.pi / 2, 0),
                  verts=10, bevel=0))
        a, b = sorted((s * 2.04, s * 2.065))
        P.add(rbx('ad_bar', a, b, 5.0, 7.9, (8.28 + zr - 0.53) / 2 - 0.25, (8.28 + zr - 0.53) / 2 + 0.25, ad_mats[1], bevel=0,
                  open=(('-x',) if s > 0 else ('+x',))))


def signboard(sign, M):
    """Runtime node `signboard`: flat quad, material Sign_Face, UV 0..1 (u → +X, v → +Z), facing the street."""
    x0, x1, z0, z1, y = sign
    return quad_uv('signboard', x0, x1, z0, z1, y, M['sign'])
