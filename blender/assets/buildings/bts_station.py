"""bts_station — elevated BTS station (60 x 18, h 8..17) that straddles the continuous viaduct deck.

Origin = station centre on the ground; the line runs along Y (deck |x| <= 4.5 passes straight through, tracks at
x = +-2.0, rail top 10.88). Concourse belly z 8..11.5 with a window band, side platforms (top 11.5) cantilevered to
the train, glazed platform hall (`Window` glows at night) under a chunky barrel roof with green end arches, roof
ribs and a skylight, two median T-frames (y = +-18) carrying the belly. `signboard` = station-name quad on the
-Y end fascia (Sign_Face, UV 0..1). The world generator should not place bts_pillar inside |y| < 30.

Rebuild: node blender/run-blender.mjs blender/assets/buildings/bts_station.py
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import cyl
from lib.export import export_glb
from lib.buildings_kit import Parts, rbx, prism, mesh_obj, quad_uv, rooted, preview_framed
from lib.buildings_bts import bts_materials, column

NAME = 'bts_station'
HX, HY = 9.0, 30.0
Z_BOT, Z_PLAT, Z_EAVE, Z_APEX = 8.0, 11.5, 13.9, 16.72
ctx = start()
B = bts_materials()
W = {
    'wall': mat('Wall', 'wall_white', roughness=0.75),
    'wall2': mat('Wall2', '#DCE3E8', roughness=0.7),
    'trim': mat('Trim', 'trim_white', roughness=0.6),
    'window': mat('Window', '#5F8FAE', roughness=0.18),
    'roof': mat('Bld_RoofMetal', 'car_silver', roughness=0.35, metallic=0.3),
    'floor': mat('Bld_Floor', 'curb_white', roughness=0.6),
    'lamp': mat('Lamp_Glow', 'light_head', roughness=0.3, emission=3.0),
    'sign': mat('Sign_Face', 'cream', roughness=0.5),
    'seat': mat('Bld_Bench', 'awning_blue', roughness=0.5),
}
P = Parts()

# ---------------------------------------------------------------- concourse belly + side platform blocks
for s in (-1, 1):
    a, b = sorted((s * 4.62, s * HX))
    P.add(rbx('belly_side', a, b, -HY, HY, Z_BOT, Z_PLAT - 0.2, W['wall'], bevel=0.35, seg=2,
              open=(('-x',) if s > 0 else ('+x',)), flat=('-y', '+y')))
    a, b = sorted((s * 3.62, s * (HX - 0.05)))
    P.add(rbx('platform', a, b, -HY, HY, Z_PLAT - 0.22, Z_PLAT, W['floor'], bevel=0.05, open=('-z',), flat=('-y', '+y')))
    a, b = sorted((s * 3.66, s * 4.0))
    P.add(rbx('tactile', a, b, -HY, HY, Z_PLAT - 0.01, Z_PLAT + 0.012, B['hazard'], bevel=0, open=('-z',), flat=('-y', '+y')))
P.add(rbx('belly_mid', -4.7, 4.7, -HY, HY, Z_BOT, 9.42, W['wall'], bevel=0.0, open=('+z',), flat=('-y', '+y')))
# window band + green stripe wrapping the concourse
for s in (-1, 1):
    x = s * (HX + 0.012)
    v = [(x, -HY + 1.0, 9.15), (x, HY - 1.0, 9.15), (x, HY - 1.0, 10.75), (x, -HY + 1.0, 10.75)]
    P.add(mesh_obj('conc_glass', v, [(0, 1, 2, 3)], [W['window']]))
    for k in range(13):
        y = -HY + 1.0 + k * (2 * HY - 2.0) / 12
        a, b = sorted((s * HX, s * (HX + 0.12)))
        P.add(rbx('conc_fin', a, b, y - 0.12, y + 0.12, 9.05, 10.85, W['trim'], bevel=0, open=(('-x',) if s > 0 else ('+x',))))
    a, b = sorted((s * (HX - 0.01), s * (HX + 0.06)))
    P.add(rbx('conc_sill', a, b, -HY + 0.9, HY - 0.9, 8.95, 9.1, W['trim'], bevel=0.03, open=(('-x',) if s > 0 else ('+x',))))
    P.add(rbx('stripe', a, b, -HY + 0.3, HY - 0.3, 8.35, 8.7, B['paint'], bevel=0.03, open=(('-x',) if s > 0 else ('+x',))))
# soffit downlights (seen from the road)
for s in (-1, 1):
    for k in range(6):
        y = -25.0 + k * 10.0
        P.add(rbx('soffit_lamp', s * 6.8 - 0.5, s * 6.8 + 0.5, y - 0.5, y + 0.5, Z_BOT - 0.04, Z_BOT + 0.01, W['lamp'], bevel=0, open=('+z',)))

# ---------------------------------------------------------------- median T-frames under the belly
for y in (-18.0, 18.0):
    column(P, B, 0.0, y, 0.0, 6.7, hx=0.8, hy=0.9)
    prof = [(-1.05, 5.9), (1.05, 5.9), (8.2, 7.35), (8.2, Z_BOT), (-8.2, Z_BOT), (-8.2, 7.35)]
    P.add(prism('frame_cap', prof, y - 0.95, y + 0.95, 'Y', B['concrete'], bevel=0.08, seg=2))

# ---------------------------------------------------------------- platform hall: parapet, glazing, fins, fascia
for s in (-1, 1):
    a, b = sorted((s * (HX - 0.32), s * HX))
    P.add(rbx('hall_parapet', a, b, -HY, HY, Z_PLAT, 12.55, W['wall2'], bevel=0.06, open=('-z',), flat=('-y', '+y')))
    x = s * (HX - 0.16)
    P.add(mesh_obj('hall_glass', [(x, -HY, 12.55), (x, HY, 12.55), (x, HY, 13.4), (x, -HY, 13.4)], [(0, 1, 2, 3)], [W['window']]))
    for k in range(16):
        y = -HY + 0.2 + k * (2 * HY - 0.4) / 15
        a, b = sorted((s * (HX - 0.3), s * (HX + 0.02)))
        P.add(rbx('hall_fin', a, b, y - 0.08, y + 0.08, 12.5, 13.4, W['trim'], bevel=0, open=('-z', '+z')))
    a, b = sorted((s * (HX - 0.36), s * (HX + 0.1)))
    P.add(rbx('hall_fascia', a, b, -HY, HY, 13.35, Z_EAVE, W['wall2'], bevel=0.06, open=(), flat=('-y', '+y')))
    a, b = sorted((s * (HX + 0.1), s * (HX + 0.16)))
    P.add(rbx('fascia_stripe', a, b, -HY, HY, 13.52, 13.72, B['paint'], bevel=0, open=(('-x',) if s > 0 else ('+x',)), flat=('-y', '+y')))
    # roof columns + benches on the platform
    for k in range(5):
        y = -24.0 + k * 12.0
        P.add(cyl('hall_col', 0.2, Z_EAVE - Z_PLAT, (s * 7.6, y, (Z_PLAT + Z_EAVE) / 2), W['trim'], verts=8, bevel=0))
        if k % 2 == 0:
            a, b = sorted((s * 6.2, s * 6.75))
            P.add(rbx('bench', a, b, y + 1.5, y + 3.6, Z_PLAT + 0.38, Z_PLAT + 0.48, W['seat'], bevel=0))
            P.add(rbx('bench_leg', a + 0.1, b - 0.1, y + 2.4, y + 2.7, Z_PLAT, Z_PLAT + 0.38, B['ink'], bevel=0, open=('-z',)))


# ---------------------------------------------------------------- barrel roof, ribs, end arches, skylight
def vault_z(x, x_half=9.7):
    rise = Z_APEX - Z_EAVE
    R = (x_half ** 2 + rise ** 2) / (2 * rise)
    return Z_APEX - R + math.sqrt(R * R - x * x)


def vault(r_out, thick, x_half, n=12):
    """(x, z) closed profile of a shallow barrel arch through (+-x_half, Z_EAVE) and apex Z_APEX."""
    rise = Z_APEX - Z_EAVE
    R = (x_half ** 2 + rise ** 2) / (2 * rise)
    zc = Z_APEX - R
    outer = [(x, zc + math.sqrt(R * R - x * x) + r_out) for x in (x_half * (2 * i / n - 1) for i in range(n + 1))]
    inner = [(x, z - thick) for x, z in reversed(outer)]
    return outer + inner


P.add(prism('roof', vault(0.0, 0.3, 9.7), -HY - 0.6, HY + 0.6, 'Y', W['roof'], smooth=30))
for y in (-15.0, 0.0, 15.0):
    P.add(prism('roof_rib', vault(0.07, 0.42, 9.78, n=8), y - 0.2, y + 0.2, 'Y', W['trim']))
for y in (-HY - 0.6, HY + 0.6):
    P.add(prism('end_arch', vault(0.1, 0.62, 9.85, n=10), y - 0.32, y + 0.32, 'Y', B['paint'], bevel=0.04))
P.add(rbx('skylight', -1.3, 1.3, -HY + 3.0, HY - 3.0, Z_APEX - 0.05, Z_APEX + 0.2, W['window'], bevel=0.08, open=('-z',)))

# ---------------------------------------------------------------- end fascias (sign on the -Y end) + lunettes
for sgn in (-1, 1):
    y = sgn * HY
    a, b = sorted((y, y + sgn * 0.45))
    P.add(rbx('end_beam', -4.6, 4.6, a, b, 14.85, 15.75, W['wall2'], bevel=0.08, seg=2))
    ya, yb = sorted((y + sgn * 0.05, y + sgn * 0.12))
    # glazed end walls beside the train opening (|x| 4.6..9), tops following the vault
    for s in (-1, 1):
        xs = [4.6 + (HX - 4.6) * k / 4 for k in range(5)]
        poly = [(s * 4.6, Z_PLAT), (s * HX, Z_PLAT)] + [(s * x, vault_z(x) - 0.33) for x in reversed(xs)]
        P.add(prism('end_glass', poly, ya, yb, 'Y', W['window']))
        a2, b2 = sorted((s * 4.5, s * 4.7))
        P.add(rbx('end_post', a2, b2, ya - 0.05, yb + 0.05, Z_PLAT, 14.9, W['trim'], bevel=0.03))
    lun = [(-4.6, 15.74), (4.6, 15.74)] + [(x, vault_z(x) - 0.33) for x in (4.6, 2.3, 0.0, -2.3, -4.6)]
    P.add(prism('lunette', lun, ya, yb, 'Y', W['window']))
sb = quad_uv('signboard', -4.0, 4.0, 14.92, 15.68, -HY - 0.51, W['sign'])
P.add(rbx('sign_frame', -4.18, 4.18, -HY - 0.5, -HY - 0.45, 14.85, 15.75, B['paint'], bevel=0.04, open=('+y',)))
# BTS roundels on the side fascias (green disc, white ring) - toy charm readable from the street
for s in (-1, 1):
    for y in (-14.0, 14.0):
        x = s * (HX + 0.16)
        P.add(cyl('roundel', 0.55, 0.1, (x + s * 0.05, y, 13.0), W['trim'], rot=(0, math.pi / 2, 0), verts=12, bevel=0))
        P.add(cyl('roundel_in', 0.43, 0.1, (x + s * 0.09, y, 13.0), B['paint'], rot=(0, math.pi / 2, 0), verts=12, bevel=0))

body = P.body()
root = rooted(NAME, body, [sb])
export_glb(ctx, NAME, [root], max_tris=3500)
preview_framed(ctx, NAME, (-10, -31, 0), (10, 31, 17.2), view=(0.85, -1.1, 0.7))
