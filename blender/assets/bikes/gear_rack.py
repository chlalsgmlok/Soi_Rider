"""gear_rack - tapered wire basket on a tubular carrier: base rack loop + cross bars, three basket loops,
vertical wires, floor grid, rubber rim guard on the top edge, small red reflector on the back.

Contract: docs/ASSET_SPEC.md (Bikes / Gear). Origin = mount point at the bottom centre, front -Y,
material Gear_Paint (runtime recolour) + Trim + Light_Tail. Budget <= 800 tris.
Run: node blender/run-blender.mjs blender/assets/bikes/gear_rack.py [--no-preview]
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib import bikes_kit as K
from lib import bikes_gear as G
from lib.export import export_glb
from lib.preview import render_preview

ctx = start()
M = G.gear_mats('steel', roughness=0.3, metallic=0.45)
Q = math.pi / 4


def loop(name, hx, hy, z, r, material, fillet=0.035):
    path = [(0, -hy, z), (hx, -hy, z), (hx, hy, z), (-hx, hy, z), (-hx, -hy, z), (0, -hy, z)]
    return K.tube(name, path, r, material, sides=4, fillet=fillet, steps=1, twist=Q)


def wire(name, a, b, r=0.0055):
    return K.tube(name, [a, b], r, M['paint'], sides=4, cap=False, twist=Q)


# basket geometry: tapered (wider at the top)
ZB, ZT = 0.035, 0.25
B = (0.148, 0.138)
T = (0.182, 0.17)


def at(u, v, z):
    """Point on the basket wall: u, v in -1..1 across the half extents interpolated by height."""
    k = (z - ZB) / (ZT - ZB)
    return (u * (B[0] + (T[0] - B[0]) * k), v * (B[1] + (T[1] - B[1]) * k), z)


parts = [
    loop('rack', 0.15, 0.14, 0.012, 0.012, M['paint'], fillet=0.04),
    loop('loop_b', B[0], B[1], ZB, 0.008, M['paint']),
    loop('loop_m', *at(1, 1, 0.145)[:2], 0.145, 0.0065, M['paint']),
    loop('rim', T[0], T[1], ZT, 0.012, M['trim'], fillet=0.045),
]
for x in (-0.075, 0.075):
    parts.append(K.tube(f'rack_x{x}', [(x, -0.14, 0.012), (x, 0.14, 0.012)], 0.01, M['paint'], sides=4, cap=False,
                        twist=Q))
# walls: vertical wires on front/back (along x) and sides (along y), plus the four corners
for i, u in enumerate((-0.66, -0.33, 0.0, 0.33, 0.66)):
    for v in (-1, 1):
        parts.append(wire(f'w_fb{i}{v}', at(u, v, ZB), at(u, v, ZT)))
for i, v in enumerate((-0.5, 0.0, 0.5)):
    for u in (-1, 1):
        parts.append(wire(f'w_s{i}{u}', at(u, v, ZB), at(u, v, ZT)))
for u in (-0.93, 0.93):
    for v in (-0.93, 0.93):
        parts.append(wire(f'w_c{u}{v}', at(u, v, ZB), at(u, v, ZT)))
# floor grid
for i, u in enumerate((-0.5, 0.0, 0.5)):
    parts.append(wire(f'f_y{i}', at(u, -1, ZB), at(u, 1, ZB)))
for i, v in enumerate((-0.5, 0.5)):
    parts.append(wire(f'f_x{i}', at(-1, v, ZB), at(1, v, ZB)))
# red reflector clipped to the back wall
parts.append(K.slab('reflector', K.rrect(0.09, 0.03, 0.01, 1, 0.0, 0.2), at(0, 1, 0.2)[1] - 0.004,
                    at(0, 1, 0.2)[1] + 0.008, M['tail'], axis='Y'))
K.report(parts, 'rack ')

root, _ = G.assemble('gear_rack', 'rack', parts)
export_glb(ctx, 'gear_rack', [root], max_tris=800)
render_preview(ctx, 'gear_rack', view=(-0.9, 1.3, 1.1))
print('[gear_rack] OK')
