"""prop_barrier: red/white water-filled plastic road barrier (Jersey profile), long axis along X.

Body colour uses the shared `Paint` material so the runtime can alternate red / white units in a row.
Modelled details: fork-pocket arches through the base, raised reflective strips (`Reflector`) on both slopes,
hand-grip slot through the ridge, fill cap, interlocking knuckles at both ends (`Trim` = dark plastic).
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from lib.bootstrap import start
from lib.palette import mat
from lib.shapes import empty, join, set_origin, set_parent
from lib.export import export_glb
from lib.props_infra_kit import lathe, extrude, ground_cull, arc, report
from lib.props_infra_preview import previews

NAME = 'prop_barrier'
ctx = start()

PAINT = mat('Paint', 'curb_red', roughness=0.38)
REFL = mat('Reflector', 'curb_white', roughness=0.25)
TRIM = mat('Trim', 'metal_dark', roughness=0.6)

L = 1.4      # length along X
HW = 0.26    # half width at the base
parts = []

# Jersey body: cross-section in (y, z) extruded along X
prof = [(-HW, 0.0), (HW, 0.0), (HW, 0.2), (0.17, 0.34), (0.125, 0.70), (0.1, 0.775), (0.045, 0.815),
        (-0.045, 0.815), (-0.1, 0.775), (-0.125, 0.70), (-0.17, 0.34), (-HW, 0.2)]
jersey = extrude('jersey', prof, L, u=(0, 1, 0), v=(0, 0, 1), material=PAINT,
                 bevel=0.05, segments=1, limit=25, smooth=50)
ground_cull(jersey)
parts.append(jersey)

# fork pockets: dark arches on both long faces of the base (read as openings from the street)
for s in (-1, 1):
    for cx in (-0.3, 0.3):
        pocket = [(cx - 0.15, 0.045), (cx + 0.15, 0.045)] + \
            [(x, 0.045 + z * 0.8) for x, z in arc(cx, 0.0, 0.15, 0, 180, 5)][1:-1]
        parts.append(extrude(f'pocket{s}{cx:+.1f}', pocket, 0.016, center=(0, s * HW, 0), material=TRIM))


def hw(z):
    return 0.17 - 0.045 * (z - 0.34) / 0.36


# reflective strips on both slopes (separate thin pieces)
for s in (1, -1):
    z0, z1, t = 0.44, 0.56, 0.008
    pts = [(hw(z0), z0), (hw(z0) + t, z0), (hw(z1) + t, z1), (hw(z1), z1)]
    if s < 0:
        pts = [(-y, z) for y, z in reversed(pts)]
    parts.append(extrude(f'strip{s}', pts, L - 0.22, u=(0, 1, 0), v=(0, 0, 1), material=REFL))

# hand-grip slot through the ridge (dark stadium reads as an opening on both faces)
slot = [(x, 0.70 + z) for x, z in arc(0.12, 0.0, 0.032, -90, 90, 4)] + \
       [(x, 0.70 + z) for x, z in arc(-0.12, 0.0, 0.032, 90, 270, 4)]
parts.append(extrude('slot', slot, 0.262, center=(0, 0, 0), material=TRIM))

# fill cap on the ridge
parts.append(lathe('cap', [(0.07, 0.0), (0.07, 0.03), (0.055, 0.045), (0.0, 0.047)], segs=10,
                   loc=(-0.42, 0, 0.8), material=TRIM, cap_bottom=False))

# interlocking knuckles: +X end low, -X end high (so neighbours stack)
for x, z0 in ((L / 2 + 0.02, 0.22), (-L / 2 - 0.02, 0.46)):
    parts.append(lathe(f'knuckle{x:+.1f}', [(0.055, 0.0), (0.055, 0.2), (0.03, 0.215), (0.0, 0.215)],
                       segs=8, loc=(x, 0, z0), material=PAINT, smooth=60))
    parts.append(lathe(f'pin{x:+.1f}', [(0.022, 0.0), (0.022, 0.03), (0.0, 0.03)], segs=6,
                       loc=(x, 0, z0 + 0.212), material=TRIM, cap_bottom=False))

report(parts, NAME)
model = join(parts, 'body')
set_origin(model, (0, 0, 0))
root = empty(NAME)
set_parent(model, root)
export_glb(ctx, NAME, [root], max_tris=900)
previews(ctx, NAME, extra_views=[(-0.3, -1.0, 0.25), (-1.0, 0.8, 0.9)])
print('[done]', NAME)
