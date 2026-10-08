"""HERO prop: prop_food_cart — Bangkok chicken-rice push cart (group props_street).

Faces -Y (customer side: glass case with hanging roast chickens + red sign board). Vendor side (+Y) has the
stock pot, chopping block and the umbrella pole (just behind the glass case). Big red-hubbed wheels at the +X
end, legs + push handle at the -X end. Everything is shaped for a 15-25 m high 3/4 camera: rounded chamfered
blocks, chunky 14-segment wheels, a pillowy 8-panel umbrella centred over the cart (bounds stay within ~1 m of
the origin); tiny props that would vanish at game distance are left out. Thin decals (panels, menu, sign face,
glyphs) are single outward quads and the wheel hubs are only modelled on the visible outer side.
Materials: Steel, Paint (recolourable panels / sign / hub caps), Accent_Cream, Glass_Case (alpha),
Food_Chicken, Wood, Tire, Canvas + Canvas_Stripe (umbrella), Lamp_Glow (bare bulb, emissive).

Rebuild: node blender/run-blender.mjs blender/assets/props_street/food_cart.py [--no-preview]
"""
import math
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from mathutils import Vector
from lib.bootstrap import start
from lib.shapes import box, cyl
from lib.props_street_kit import M, lathe, tube, finish, run_assets, mesh_obj
from lib.props_street_parts import rbox, ball
from lib.props_street_puffy import puffy_canopy, soft_normals

ctx = start()

# Umbrella: the shaft leaves the counter behind the glass case and leans 8 deg towards the customer side, the way
# vendors tilt them; the hub sits over the cart so the canopy stays on the footprint (x -0.93..0.83, y -0.74..1.0).
HUB = (-0.05, 0.13, 2.40)   # canopy rim-plane centre on the shaft: high enough that a length of shaft (and the
                            # bulb) shows between the sign board and the valance from the high diorama camera
TILT = math.radians(8.0)    # front (-Y) edge down
CANOPY_R, CANOPY_H = 0.85, 0.42


def plate(name, w, h, centre, facing, material):
    """Single outward quad (a decal panel): facing = '-y', '+x' or '-x'; w along the face, h = height."""
    x, y, z = centre
    a, b = w / 2, h / 2
    if facing == '-y':
        v = [(x - a, y, z - b), (x + a, y, z - b), (x + a, y, z + b), (x - a, y, z + b)]
    elif facing == '+x':
        v = [(x, y - a, z - b), (x, y + a, z - b), (x, y + a, z + b), (x, y - a, z + b)]
    else:
        v = [(x, y + a, z - b), (x, y - a, z - b), (x, y - a, z + b), (x, y + a, z + b)]
    return mesh_obj(name, v, [(0, 1, 2, 3)], [material], smooth_angle=None)


def wheel(name, radius, width, loc, out_sign, tire, hub):
    """Chunky tyre, 14 segments; domed red hub only on the OUTER face (the inner face hides against the cabinet)."""
    w = width / 2
    rh = radius * 0.58
    prof = [(0.0, -w * 0.6), (radius, -w * 0.6), (radius, w * 0.6), (rh, w * 0.95), (0.0, w * 1.05)]
    rot = (math.pi / 2, 0, 0) if out_sign < 0 else (-math.pi / 2, 0, 0)   # local +Z -> outward (-Y or +Y)
    return lathe(name, prof, [hub, tire], segs=14, band_mat=[1, 1, 1, 0], loc=loc, rot=rot, smooth_angle=55)


def body(steel, paint, cream):
    """Rounded steel cabinet with red front/end panels, cream stripe and a rounded counter (z 0.32..0.97)."""
    return [rbox('cabinet', (1.50, 0.68, 0.60), (0, 0, 0.62), steel, bevel=0.055),
            plate('panel', 1.36, 0.44, (0, -0.346, 0.60), '-y', paint),
            plate('band', 1.36, 0.06, (0, -0.351, 0.71), '-y', cream),
            plate('menu', 0.30, 0.20, (-0.36, -0.351, 0.53), '-y', cream),
            plate('end_panel', 0.54, 0.44, (0.756, 0, 0.60), '+x', paint),
            plate('end_panel', 0.54, 0.44, (-0.756, 0, 0.60), '-x', paint),
            rbox('counter', (1.66, 0.80, 0.05), (0, 0, 0.945), steel, bevel=0.022)]


def glass_case(steel, paint, cream, glass, chicken):
    """Display case with front posts, rounded roof, red sign board and three hanging roast chickens."""
    cx, cy, z0, h = -0.20, -0.10, 0.97, 0.54
    p = [box('glass', (1.04, 0.46, h), (cx, cy, z0 + h / 2), glass, bevel=0),
         rbox('roof', (1.12, 0.54, 0.06), (cx, cy, z0 + h + 0.03), steel, bevel=0.025)]
    for sx in (-1, 1):
        p.append(tube('post', [(cx + sx * 0.52, cy - 0.23, z0), (cx + sx * 0.52, cy - 0.23, z0 + h)], 0.022, steel, segs=4,
                      cap_start=False, cap_end=False))   # ends hidden in counter + roof
    sz = z0 + h + 0.06 + 0.12
    p.append(rbox('sign', (1.0, 0.06, 0.24), (cx, cy - 0.2, sz), paint, bevel=0.03))
    p.append(plate('sign_face', 0.88, 0.15, (cx, cy - 0.2 - 0.035, sz), '-y', cream))
    for gx, gw, gz in ((-0.2, 0.26, 0.012), (0.14, 0.30, -0.01)):
        p.append(plate('glyph', gw, 0.055, (cx + gx, cy - 0.2 - 0.040, sz + gz), '-y', paint))
    # two plump roast chickens (36 tris each): round-bottomed body tapering to the hanging neck, smooth-shaded
    hen = [(0.0, 1.12), (0.072, 1.15), (0.094, 1.235), (0.064, 1.33), (0.0, 1.40)]
    for i, hx in enumerate((-0.27, 0.0)):
        p.append(lathe('hen', hen, chicken, segs=6, loc=(cx + hx, cy - 0.03, 0), sx=1.25, phase=0.26 + 0.5 * i,
                       smooth_angle=89))
    return p


def counter_items(steel, wood):
    """Aluminium stock pot with a domed lid + round chopping block on the vendor half of the counter."""
    pot = [(0.16, 0.97), (0.165, 1.18), (0.18, 1.195), (0.105, 1.235), (0.0, 1.265)]
    return [lathe('pot', pot, steel, segs=6, loc=(0.50, -0.04, 0), smooth_angle=55),
            cyl('block', 0.15, 0.08, (0.46, 0.26, 1.01), wood, verts=6, bevel=0)]


def chassis(steel, paint, tire):
    """Two big wheels (+X end), two legs and the push handle (-X end)."""
    p = [wheel('wheel', 0.31, 0.12, (0.46, sy * 0.41, 0.31), sy, tire, paint) for sy in (-1, 1)]
    for sy in (-1, 1):
        p.append(box('leg', (0.05, 0.05, 0.33), (-0.64, sy * 0.26, 0.165), steel, bevel=0))
    hz = 0.86
    p.append(tube('handle', [(-0.74, -0.28, hz - 0.03), (-0.93, -0.28, hz), (-0.97, -0.2, hz), (-0.97, 0.2, hz),
                             (-0.93, 0.28, hz), (-0.74, 0.28, hz - 0.03)], 0.022, steel, segs=3))
    return p


def umbrella(steel, canvas, stripe, tire, glow):
    """Pillowy 8-panel scalloped umbrella on a tilted shaft rising from the counter behind the glass case (clears
    the case roof by 2 cm), centred over the cart, with a bare bulb hanging underneath."""
    hub = Vector(HUB)
    axis = Vector((0.0, -math.sin(TILT), math.cos(TILT)))               # shaft direction (up, leaning to -Y)
    base = hub - axis * ((hub.z - 0.90) / axis.z)                       # foot hidden inside the counter slab
    p = [tube('upole', [base, hub + axis * (CANOPY_H - 0.02)], 0.024, steel, segs=6, cap_start=False,
              cap_end=False)]
    can, val, _tips = puffy_canopy('canopy', CANOPY_R, CANOPY_H, 0.0, [canvas, stripe], panels=8, sub=3,
                                   valance=0.11, puff=0.09, scallop=0.04, ring_fracs=(0.25, 0.5, 0.72, 0.88),
                                   dome=2.3)
    for o in (can, val):
        o.location = hub
        o.rotation_euler = (TILT, 0, 0)
    p += [can, val]
    knot = hub + axis * 0.02
    bulb = Vector((hub.x, hub.y - 0.12, hub.z - 0.20))
    p.append(tube('cord', [knot, bulb + Vector((0, 0, 0.05))], 0.006, tire, segs=3, cap_start=False, cap_end=False))
    p.append(ball('bulb', 0.045, bulb, glow, segs=5, scale=(1, 1, 1.25)))
    return p


def build_cart():
    steel = M('Steel', '#C3CCD6', roughness=0.28)
    paint = M('Paint', 'awning_red', roughness=0.42)
    cream = M('Accent_Cream', 'cream', roughness=0.5)
    glass = M('Glass_Case', 'glass_light', roughness=0.08, alpha=0.32)
    chicken = M('Food_Chicken', 'taxi_orange', roughness=0.25)
    wood = M('Wood', 'wood_light', roughness=0.7)
    tire = M('Tire', 'tire', roughness=0.85)
    canvas = M('Canvas', 'awning_blue', double=True, roughness=0.7)
    stripe = M('Canvas_Stripe', 'cream', double=True, roughness=0.7)
    glow = M('Lamp_Glow', 'light_head', emission=2.5)
    p = (body(steel, paint, cream) + glass_case(steel, paint, cream, glass, chicken) + counter_items(steel, wood)
         + chassis(steel, paint, tire) + umbrella(steel, canvas, stripe, tire, glow))
    # canopy fabric keeps smooth normals (the kit's face-area weighted normals would facet the pillow panels)
    return soft_normals(finish(p, 'prop_food_cart'), lambda co: co.z > 1.90)


run_assets(ctx, [('prop_food_cart', build_cart, 900)],
           preview_views={'prop_food_cart': {'view': (0.9, -1.4, 0.75)}})
print('[food_cart] OK')