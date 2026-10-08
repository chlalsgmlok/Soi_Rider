"""Pillion seat gear (뒷자리): gear_cushion (tufted cushion), gear_backrest (seat pad + padded backrest on a chrome
support frame) and gear_throne (the golden throne: velvet seat + back, gold frame, scroll armrests, Thai-style crest,
jewels).

Contract: like the other gear (docs/ASSET_SPEC.md › Bikes / Gear) but mounted on the bike's `seat_pillion` instead of
`gear_mount`: origin = top of the pillion seat (bottom centre of the item), front -Y, rear +Y, `Gear_Paint` = runtime
colour (cushion / pad / velvet). The rack sits ~0.25 m behind and ~0.06 m below the origin on every bike.
Run: node blender/run-blender.mjs blender/assets/bikes/gear_seats.py [--no-preview]
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start, clear_scene
from lib import bikes_kit as K
from lib import bikes_gear as G
from lib.palette import mat
from lib.export import export_glb
from lib.preview import render_preview

ctx = start()


def cushion_rows(z0, h, hx, hy, bulge=0.012):
    """puffy cushion profile: tight bottom, swollen middle, soft domed top"""
    return [
        (z0, hx - 0.012, hy - 0.012),
        (z0 + h * 0.25, hx + bulge * 0.6, hy + bulge * 0.6),
        (z0 + h * 0.55, hx + bulge, hy + bulge),
        (z0 + h * 0.85, hx, hy),
        (z0 + h, hx - 0.03, hy - 0.03),
    ]


def tufts(z, xs, ys, material, r=0.011):
    return [K.lathe(f'tuft{x}{y}', [(0, 0.0), (r, 0.0), (r * 0.8, r * 0.6), (0, r * 0.75)], material, seg=8,
                    axis=(0, 0, 1), center=(x, y, z - 0.004)) for x in xs for y in ys]


def back_pad(name, y0, y1, zc, hx, hz, material, p=3.2, n=18):
    """a padded panel standing at y0..y1 (rings in the XZ plane lofted along +Y, domed both faces)"""
    rings = [K.sring((0, y, zc), hx * k, hz * k, n=n, p=p, plane='XZ') for y, k in
             ((y0, 0.9), (y0 + (y1 - y0) * 0.3, 1.0), (y1 - (y1 - y0) * 0.3, 1.0), (y1, 0.9))]
    return K.loft(name, rings, material, fan=(0.012, 0.012), smooth=55)


def build_cushion():
    M = G.gear_mats('bougainvillea', roughness=0.7)
    gold = mat('Gold', 'temple_gold', roughness=0.32, metallic=0.55)
    pad = G.stack('pad', cushion_rows(0.0, 0.055, 0.19, 0.16), M['paint'], n=20, p=3.6, fan=(0.0, 0.01),
                  paint=[(M['trim'], lambda s: s == 0)])
    parts = [pad] + tufts(0.058, (-0.075, 0.075), (-0.06, 0.06), gold)
    # little gold tassels at the four corners (Thai cushion charm): bead + short fringe
    for x in (-0.18, 0.18):
        for y in (-0.145, 0.145):
            parts.append(K.lathe(f'tassel{x}{y}', [(0, 0.012), (0.011, 0.006), (0.009, -0.004), (0.006, -0.016),
                                                     (0, -0.018)], gold, seg=6, axis=(0, 0, 1), center=(x, y, 0.034)))
    K.report(parts, 'cushion ')
    root, _ = G.assemble('gear_cushion', 'cushion', parts)
    export_glb(ctx, 'gear_cushion', [root], max_tris=800)
    render_preview(ctx, 'gear_cushion', view=(-0.9, -1.2, 0.9))


def build_backrest():
    M = G.gear_mats('gram_cyan', roughness=0.6)
    seat = G.stack('seat', cushion_rows(0.0, 0.035, 0.18, 0.15, bulge=0.008), M['paint'], n=18, p=3.6,
                   fan=(0.0, 0.006), paint=[(M['trim'], lambda s: s == 0)])
    pad = back_pad('pad', 0.17, 0.23, 0.31, 0.16, 0.12, M['paint'])
    parts = [seat, pad]
    # chrome support frame ("지지대"): two uprights from the rack up behind the pad, joined by a top bar
    for x in (-0.12, 0.12):
        parts.append(K.tube(f'post{x}', [(x, 0.29, -0.06), (x, 0.27, 0.12), (x, 0.245, 0.42)], 0.013, M['chrome'],
                            sides=8, fillet=0.05, steps=3))
    parts.append(K.tube('top', [(-0.12, 0.245, 0.42), (0.12, 0.245, 0.42)], 0.013, M['chrome'], sides=8))
    parts.append(K.block('plate', (0.2, 0.012, 0.06), (0, 0.255, 0.16), M['trim'], bevel=0.004))
    K.report(parts, 'backrest ')
    root, _ = G.assemble('gear_backrest', 'backrest', parts)
    export_glb(ctx, 'gear_backrest', [root], max_tris=800)
    render_preview(ctx, 'gear_backrest', view=(-0.9, -1.2, 0.8))


def crest_profile(z0):
    """pointed Thai crest (a flame arch) in the XZ plane standing on z0"""
    flame = [(0.17, 0.05), (0.13, 0.11), (0.09, 0.09), (0.05, 0.17), (0.0, 0.26),
             (-0.05, 0.17), (-0.09, 0.09), (-0.13, 0.11), (-0.17, 0.05)]
    return [(x, z0 + z) for x, z in [(-0.19, 0.0), (0.19, 0.0)] + flame]


def build_throne():
    M = G.gear_mats('car_maroon', roughness=0.75)
    gold = mat('Gold', 'temple_gold', roughness=0.32, metallic=0.55)
    ruby = mat('Jewel_Red', 'neon_red', roughness=0.18, emission=0.35)
    jade = mat('Jewel_Green', '#2bd47d', roughness=0.18, emission=0.25)
    parts = []
    # gold plinth + plush velvet seat with gold tufts
    parts.append(G.stack('plinth', [(0.0, 0.235, 0.205), (0.022, 0.24, 0.21), (0.035, 0.228, 0.198)], gold, n=20, p=4.0,
                         fan=None))
    parts.append(G.stack('seat', cushion_rows(0.03, 0.07, 0.205, 0.175, bulge=0.014), M['paint'], n=20, p=3.6,
                         fan=(0.0, 0.012)))
    parts += tufts(0.105, (-0.08, 0.0, 0.08), (-0.065, 0.065), gold, r=0.012)
    # velvet back in a gold frame
    parts.append(back_pad('back', 0.19, 0.25, 0.37, 0.185, 0.25, M['paint'], p=3.0))
    frame = [(-0.215, 0.255, 0.1), (-0.215, 0.255, 0.5), (-0.15, 0.255, 0.62), (0.0, 0.255, 0.66),
             (0.15, 0.255, 0.62), (0.215, 0.255, 0.5), (0.215, 0.255, 0.1)]
    parts.append(K.tube('frame', frame, 0.022, gold, sides=8, fillet=0.06, steps=3))
    # Thai crest + three finials + jewels
    parts.append(K.slab('crest', crest_profile(0.62), 0.24, 0.27, gold, axis='Y', bevel=0.006))
    for i, (x, z, s) in enumerate(((0.0, 0.92, 1.0), (-0.13, 0.78, 0.7), (0.13, 0.78, 0.7))):
        parts.append(K.lathe(f'finial{i}', [(0, 0.0), (0.03 * s, 0.0), (0.022 * s, 0.03 * s), (0.012 * s, 0.07 * s),
                                             (0, 0.1 * s)], gold, seg=8, axis=(0, 0, 1), center=(x, 0.255, z - 0.03)))
    parts.append(K.lathe('ruby', [(0, 0.0), (0.03, 0.012), (0.026, 0.028), (0, 0.036)], ruby, seg=10, axis=(0, -1, 0),
                         center=(0, 0.235, 0.78)))
    for x in (-0.07, 0.07):
        parts.append(K.lathe(f'jade{x}', [(0, 0.0), (0.017, 0.008), (0.014, 0.018), (0, 0.022)], jade, seg=8,
                             axis=(0, -1, 0), center=(x, 0.238, 0.7)))
    # scroll armrests on gold posts
    for side in (-1, 1):
        x = 0.235 * side
        parts.append(K.tube(f'arm{side}', [(x, 0.2, 0.3), (x, 0.12, 0.23), (x, -0.08, 0.23), (x * 1.02, -0.15, 0.2),
                                           (x * 1.02, -0.13, 0.165)], 0.019, gold, sides=8, fillet=0.04, steps=3))
        parts.append(K.lathe(f'scroll{side}', [(0, -0.018), (0.032, -0.012), (0.034, 0.012), (0, 0.018)], gold, seg=10,
                             axis=(1, 0, 0), center=(x * 1.02, -0.13, 0.19)))
        parts.append(K.tube(f'post{side}', [(x, -0.06, 0.03), (x, -0.06, 0.23)], 0.016, gold, sides=8))
        parts.append(K.lathe(f'armjewel{side}', [(0, 0.0), (0.013, 0.006), (0.011, 0.014), (0, 0.017)], ruby, seg=8,
                             axis=(side, 0, 0), center=(x * 1.02 + 0.03 * side, -0.13, 0.19)))
    K.report(parts, 'throne ')
    root, _ = G.assemble('gear_throne', 'throne', parts)
    export_glb(ctx, 'gear_throne', [root], max_tris=2400)  # hero item: only ever on the player's bike
    render_preview(ctx, 'gear_throne', view=(-0.9, -1.25, 0.75))


build_cushion()
clear_scene()
build_backrest()
clear_scene()
build_throne()
print('[gear_seats] OK')
