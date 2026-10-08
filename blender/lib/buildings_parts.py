"""Reusable street-architecture parts for SOI RIDER buildings (shophouse kit, also used by minimart/mall).

All parts take a `Parts` collector `P` and the material dict `M` from buildings_kit.materials().
Facade plane is y=0, street side is -Y. Units are metres.
"""
import math
from lib.shapes import cyl, sphere, cone
from lib.buildings_kit import rbx, bx, prism, frame_ring, rod, arc, mesh_obj, quad_uv, finish


# ----------------------------------------------------------------------------------------------- awning
def awning(P, M, x0, x1, z_wall, depth, drop, n, K=3, bulge=0.07, thick=0.05, valance=0.14, scallop=0.11, struts=True):
    """Striped sloped canopy over the pavement: one closed grid mesh (stripes = Awning_A/Awning_B faces),
    rolled front edge and a scalloped valance (one scallop per stripe)."""
    w = (x1 - x0) / n
    prof = [(-depth * k / K, z_wall - drop * k / K + bulge * math.sin(math.pi * k / K)) for k in range(K + 1)]
    NT = (n + 1) * (K + 1)

    def T(i, k):
        return i * (K + 1) + k

    def B(i, k):
        return NT + T(i, k)
    verts = [(x0 + i * w, y, z) for i in range(n + 1) for (y, z) in prof]
    verts += [(x0 + i * w, y, z - thick) for i in range(n + 1) for (y, z) in prof]
    faces, fm = [], []
    for i in range(n):
        mi = i % 2
        for k in range(K):
            faces += [[T(i, k), T(i + 1, k), T(i + 1, k + 1), T(i, k + 1)], [B(i, k), B(i, k + 1), B(i + 1, k + 1), B(i + 1, k)]]
            fm += [mi, mi]
        faces += [[T(i, 0), B(i, 0), B(i + 1, 0), T(i + 1, 0)], [T(i, K), T(i + 1, K), B(i + 1, K), B(i, K)]]
        fm += [mi, mi]
    for i, mi in ((0, 0), (n, (n - 1) % 2)):
        for k in range(K):
            faces.append([T(i, k), T(i, k + 1), B(i, k + 1), B(i, k)])
            fm.append(mi)
    P.add(finish(mesh_obj('awn_sheet', verts, faces, [M['awn_a'], M['awn_b']], fm), 0, 1, 40))
    zf, yf = prof[-1][1], prof[-1][0]
    for i in range(n):
        m = M['awn_a'] if i % 2 == 0 else M['awn_b']
        xa, xb = x0 + i * w, x0 + (i + 1) * w
        xc = (xa + xb) / 2
        sc = [(xc + (w / 2) * math.cos(math.radians(a)), zf - valance + scallop * math.sin(math.radians(a)))
              for a in (180, 225, 270, 315, 360)]
        P.add(prism(f'awn_v{i}', [(xa, zf)] + sc + [(xb, zf)], yf - 0.03, yf + 0.015, 'Y', m, smooth=40))
    P.add(rod('awn_roll', (x0 - 0.02, yf - 0.005, zf - 0.005), (x1 + 0.02, yf - 0.005, zf - 0.005), 0.05, M['awn_a'], verts=8))
    if struts:
        for x in (x0 + 0.18, x1 - 0.18):
            P.add(rod('awn_strut', (x, 0, z_wall - 0.75), (x, yf * 0.8, zf + drop * 0.18), 0.022, M['metal'], verts=5))
    return zf


# ----------------------------------------------------------------------------------------------- shop front
def roller_shutter(P, M, x0, x1, z_bot, z_top, y, ribs=9):
    """Corrugated roller shutter pulled half down (ribbed band + bottom bar + handles + guide rails)."""
    h = (z_top - z_bot) / ribs
    prof = []
    for i in range(ribs + 1):
        z = z_bot + i * h
        prof.append((y - 0.035, z))
        if i < ribs:
            prof.append((y, z + h * 0.5))
    prof = prof + [(y + 0.05, z_top), (y + 0.05, z_bot)]
    P.add(prism('shutter', prof, x0, x1, 'X', M['shutter'], smooth=60))
    P.add(bx('shutter_bar', x0, x1, y - 0.06, y + 0.04, z_bot - 0.08, z_bot + 0.02, M['metal'], bevel=0.02))
    for x in (x0 + 0.5, x1 - 0.5):
        P.add(bx('shutter_handle', x - 0.08, x + 0.08, y - 0.1, y - 0.06, z_bot - 0.06, z_bot - 0.01, M['chrome'], bevel=0))
    for x in (x0, x1):
        P.add(bx('shutter_rail', x - 0.05, x + 0.05, y - 0.05, y + 0.08, 0.0, z_top, M['metal'], bevel=0))


def shop_interior(P, M, x0, x1, y0, y1, z_top, flavour=0):
    """Warm-lit shop interior seen under the half-open shutter: glowing back wall, shelves with goods, counter."""
    P.add(rbx('int_back', x0, x1, y1 - 0.06, y1, 0.0, z_top, M['interior'], bevel=0, open=('+y', '-z')))
    P.add(rbx('int_floor', x0, x1, y0, y1, 0.0, 0.1, M['floor'], bevel=0, open=('-z',)))
    sx0, sx1 = (x0 + 0.15, x0 + 1.75) if flavour % 2 == 0 else (x1 - 1.75, x1 - 0.15)
    P.add(rbx('int_shelf', sx0, sx1, y1 - 0.42, y1 - 0.06, 0.1, 2.15, M['wood'], bevel=0.02, open=('+y', '-z')))
    goods = [M['goods1'], M['goods2'], M['awn_a'], M['wall2'], M['goods1']]
    for r, z in enumerate((0.6, 1.15)):
        P.add(rbx('int_board', sx0 + 0.06, sx1 - 0.06, y1 - 0.44, y1 - 0.3, z - 0.04, z, M['wood_l'], bevel=0, open=('+y',)))
        n = 3
        w = (sx1 - sx0 - 0.2) / n
        for i in range(n):
            gx = sx0 + 0.1 + i * w
            hh = 0.28 + 0.1 * ((i + r) % 3)
            P.add(rbx('int_goods', gx + 0.03, gx + w - 0.05, y1 - 0.4, y1 - 0.2, z, z + hh, goods[(i + r) % len(goods)], bevel=0, open=('+y', '-z')))
    cx0, cx1 = (x1 - 1.35, x1 - 0.15) if flavour % 2 == 0 else (x0 + 0.15, x0 + 1.35)
    P.add(rbx('int_counter', cx0, cx1, y0 + 0.55, y0 + 1.05, 0.1, 0.95, M['wall2'], bevel=0.04, open=('-z',)))
    P.add(bx('int_counter_top', cx0 - 0.04, cx1 + 0.04, y0 + 0.5, y0 + 1.1, 0.95, 1.02, M['wood_l'], bevel=0))
    P.add(bx('int_case', cx0 + 0.1, cx1 - 0.1, y0 + 0.62, y0 + 0.98, 1.02, 1.32, M['glass'], bevel=0))
    P.add(cyl('int_pot', 0.16, 0.22, ((cx0 + cx1) / 2 + 0.25, y0 + 0.8, 1.13), M['chrome'], verts=8, bevel=0))
    P.add(cone('int_shade', 0.05, 0.2, 0.14, ((x0 + x1) / 2, y0 + 0.6, z_top - 0.45), M['lamp'], verts=8))
    P.add(rod('int_cord', ((x0 + x1) / 2, y0 + 0.6, z_top - 0.38), ((x0 + x1) / 2, y0 + 0.6, z_top), 0.01, M['dark'], verts=4))


def sign_board(P, M, x0, x1, z0, z1, depth=0.12, material=None, y=0.0):
    """Chunky board frame whose back sits at `y`; returns the sign face rect (x0,x1,z0,z1,y) for quad_uv."""
    P.add(rbx('sign_frame', x0, x1, y - depth, y, z0, z1, material or M['trim'], bevel=0.045, seg=2, open=('+y',)))
    m = 0.08
    return (x0 + m, x1 - m, z0 + m, z1 - m, y - depth - 0.006)


# ----------------------------------------------------------------------------------------------- windows
def window(P, M, x0, x1, z0, z1, mull=1, transom=0.72, sill=True, hood=None, shutters=None, grille=0, frame=None, depth=0.08,
           curtain=0.0):
    """Framed window standing proud of the wall: glass (Window), ring frame, mullions, sill, optional eyebrow hood,
    open louvre shutters (material) and security grille bars."""
    fm = frame or M['trim']
    if curtain:
        cw = (x1 - x0) * abs(curtain)
        cx0, cx1 = (x0, x0 + cw) if curtain > 0 else (x1 - cw, x1)
        P.add(mesh_obj('win_curtain', [(cx0, -0.016, z0 + 0.05), (cx1, -0.016, z0 + 0.05), (cx1, -0.016, z1), (cx0, -0.016, z1)],
                       [(0, 1, 2, 3)], [M['curtain']]))
    P.add(mesh_obj('win_glass', [(x0, -0.012, z0), (x1, -0.012, z0), (x1, -0.012, z1), (x0, -0.012, z1)], [(0, 1, 2, 3)],
                   [M['window']]))
    P.add(frame_ring('win_frame', x0 - 0.02, x1 + 0.02, z0 - 0.02, z1 + 0.02, -depth, 0.0, 0.085, fm, bevel=0.012))
    for k in range(1, mull + 1):
        x = x0 + (x1 - x0) * k / (mull + 1)
        P.add(rbx('win_mull', x - 0.028, x + 0.028, -depth + 0.02, -0.01, z0, z1, fm, bevel=0, open=('+y',)))
    if transom:
        z = z0 + (z1 - z0) * transom
        P.add(rbx('win_tran', x0, x1, -depth + 0.02, -0.01, z - 0.028, z + 0.028, fm, bevel=0, open=('+y',)))
    if sill:
        P.add(rbx('win_sill', x0 - 0.1, x1 + 0.1, -0.17, 0.0, z0 - 0.12, z0 - 0.02, fm, bevel=0.025, open=('+y',)))
    if hood:
        prof = [(0.0, z1 + 0.06), (0.0, z1 + 0.3), (-0.26, z1 + 0.14), (-0.26, z1 + 0.06)]
        P.add(prism('win_hood', prof, x0 - 0.14, x1 + 0.14, 'X', hood))
    if shutters:
        w = (x1 - x0) / 2
        for a, b in ((x0 - w - 0.03, x0 - 0.03), (x1 + 0.03, x1 + w + 0.03)):
            P.add(rbx('win_leaf', a, b, -0.06, -0.005, z0 + 0.02, z1 - 0.02, shutters, bevel=0.018, open=('+y',)))
            P.add(rbx('win_leaf_in', a + 0.06, b - 0.06, -0.075, -0.05, z0 + 0.12, z1 - 0.12, M['wood'], bevel=0, open=('+y',)))
    if grille:
        for k in range(grille):
            x = x0 + 0.06 + (x1 - x0 - 0.12) * k / max(grille - 1, 1)
            P.add(rbx('win_bar', x - 0.016, x + 0.016, -0.15, -0.12, z0, z1, M['metal'], bevel=0, open=('-z', '+z')))
        for z in (z0 + 0.12, (z0 + z1) / 2, z1 - 0.12):
            P.add(rbx('win_bar_h', x0, x1, -0.16, -0.12, z - 0.02, z + 0.02, M['metal'], bevel=0, open=('-x', '+x')))


def ac_unit(P, M, cx, cz, y=0.0, side=1):
    """Wall-hung AC compressor on brackets (white box, dark fan disc, refrigerant pipe)."""
    w, h, d = 0.78, 0.55, 0.3
    P.add(rbx('ac_box', cx - w / 2, cx + w / 2, y - d - 0.05, y - 0.05, cz, cz + h, M['ac'], bevel=0.05, open=('+y',)))
    fx = cx - 0.1 * side
    P.add(cyl('ac_fan', 0.19, 0.03, (fx, y - d - 0.06, cz + h / 2), M['dark'], rot=(math.pi / 2, 0, 0), verts=12, bevel=0))
    P.add(cyl('ac_hub', 0.05, 0.03, (fx, y - d - 0.075, cz + h / 2), M['ac'], rot=(math.pi / 2, 0, 0), verts=6, bevel=0))
    P.add(bx('ac_vent', cx + 0.17 * side - 0.08, cx + 0.17 * side + 0.08, y - d - 0.07, y - d - 0.04, cz + 0.1, cz + h - 0.1, M['metal'], bevel=0))
    for x in (cx - w / 2 + 0.1, cx + w / 2 - 0.1):
        prof = [(y, cz - 0.02), (y - d - 0.08, cz - 0.02), (y - d - 0.08, cz - 0.07), (y - 0.05, cz - 0.32), (y, cz - 0.32)]
        P.add(prism('ac_bracket', prof, x - 0.02, x + 0.02, 'X', M['metal']))
    px = cx + (w / 2 - 0.08) * side
    P.add(rod('ac_pipe', (px, y - 0.1, cz + 0.15), (px, y - 0.05, cz - 0.9), 0.025, M['ac'], verts=5))


# ----------------------------------------------------------------------------------------------- roof kit
def water_tank(P, M, x, y, z, r=0.5, h=1.0):
    """Stainless rooftop water tank on a steel stand (very Bangkok)."""
    st = 0.45
    P.add(bx('tank_deck', x - r - 0.05, x + r + 0.05, y - r - 0.05, y + r + 0.05, z + st - 0.06, z + st, M['metal'], bevel=0))
    for dx in (-1, 1):
        for dy in (-1, 1):
            P.add(bx('tank_leg', x + dx * r * 0.75 - 0.04, x + dx * r * 0.75 + 0.04, y + dy * r * 0.75 - 0.04, y + dy * r * 0.75 + 0.04,
                     z, z + st, M['metal'], bevel=0))
    P.add(cyl('tank', r, h, (x, y, z + st + h / 2), M['steel'], verts=12, bevel=0.06, segments=1))
    P.add(cyl('tank_band', r + 0.015, 0.06, (x, y, z + st + h * 0.33), M['metal'], verts=12, bevel=0))
    P.add(cone('tank_cap', r * 0.35, r * 0.15, 0.12, (x, y, z + st + h + 0.06), M['steel'], verts=8))
    P.add(rod('tank_pipe', (x + r * 0.7, y - r * 0.7, z + st + 0.1), (x + r * 0.7, y - r * 0.7 - 0.6, z + 0.05), 0.035, M['ac'], verts=5))


def potted_plant(P, M, x, y, z, s=1.0, flowers=False):
    """Terracotta pot with a puffy shrub (+ bougainvillea blossom blobs)."""
    P.add(cone('pot', 0.16 * s, 0.21 * s, 0.26 * s, (x, y, z + 0.13 * s), M['pot'], verts=8))
    P.add(sphere('shrub', 0.3 * s, (x, y, z + 0.48 * s), M['leaf'], scale=(1, 1, 0.85), segments=8, rings=4))
    if flowers:
        P.add(sphere('bloom', 0.2 * s, (x + 0.14 * s, y - 0.12 * s, z + 0.62 * s), M['flower'], scale=(1.1, 1, 0.8), segments=8, rings=4))


def roof_shed(P, M, x0, x1, y0, y1, z, h=2.1):
    """Rooftop stair hut with a corrugated mono-pitch sheet roof."""
    P.add(rbx('shed_wall', x0, x1, y0, y1, z, z + h, M['wall'], bevel=0.05, seg=2, open=('-z',)))
    P.add(rbx('shed_door', (x0 + x1) / 2 - 0.4, (x0 + x1) / 2 + 0.4, y0 - 0.04, y0 + 0.02, z, z + 1.8, M['wood'], bevel=0.02, open=('+y',)))
    ribs = 7
    prof = []
    for i in range(ribs * 2 + 1):
        u = x0 - 0.2 + (x1 - x0 + 0.4) * i / (ribs * 2)
        prof.append((u, 0.035 if i % 2 else 0.0))
    prof = prof + [(x1 + 0.2, -0.03), (x0 - 0.2, -0.03)]
    sheet = prism('shed_roof', prof, y0 - 0.35, y1 + 0.25, 'Y', M['sheet'], smooth=70)
    # tilt the sheet: low at the front (y0), high at the back
    for v in sheet.data.vertices:
        t = (v.co.y - (y0 - 0.35)) / (y1 + 0.25 - (y0 - 0.35))
        v.co.z += z + h - 0.15 + 0.4 * t
    P.add(sheet)


def laundry_line(P, M, x0, x1, y, z, items=4):
    """Rooftop washing line with a few colourful garments (reads great from the high camera)."""
    for x in (x0, x1):
        P.add(bx('line_post', x - 0.03, x + 0.03, y - 0.03, y + 0.03, z, z + 1.5, M['metal'], bevel=0))
    P.add(rod('line_wire', (x0, y, z + 1.45), (x1, y, z + 1.45), 0.008, M['dark'], verts=3))
    cols = [M['goods2'], M['awn_a'], M['goods1'], M['curtain'], M['flower']]
    span = (x1 - x0) / items
    for i in range(items):
        cx = x0 + span * (i + 0.5)
        w, h = 0.32 + 0.08 * (i % 2), 0.45 + 0.15 * ((i + 1) % 2)
        P.add(bx('line_cloth', cx - w / 2, cx + w / 2, y - 0.012, y + 0.012, z + 1.45 - h, z + 1.45, cols[i % len(cols)], bevel=0))


def roof_hatch(P, M, x, y, z):
    P.add(rbx('hatch', x - 0.4, x + 0.4, y - 0.4, y + 0.4, z, z + 0.35, M['wall'], bevel=0.04, open=('-z',)))
    P.add(bx('hatch_lid', x - 0.45, x + 0.45, y - 0.45, y + 0.45, z + 0.35, z + 0.42, M['metal'], bevel=0.02))
