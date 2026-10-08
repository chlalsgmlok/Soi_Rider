"""Rear-gear helpers for the bikes group (gear_topbox / gear_bag / gear_rack).

Gear contract (docs/ASSET_SPEC.md): origin = mount point at the bottom centre (z=0 sits on the bike's
`gear_mount`), front = -Y like the bikes, materials `Gear_Paint` (runtime recolour), `Gear_Logo`, `Trim`.
Each asset exports as   <name> (root empty) -> <node> (one joined mesh)   like the runtime placeholders.
"""
import math

from .palette import mat
from . import bikes_kit as K

V = K.V


def gear_mats(paint_key, roughness=0.45, metallic=0.0):
    return {
        'paint': mat('Gear_Paint', paint_key, roughness=roughness, metallic=metallic),
        'trim': mat('Trim', 'canopy_black', roughness=0.62),
        'logo': mat('Gear_Logo', 'cream', roughness=0.5),
        'tail': mat('Light_Tail', 'light_tail', roughness=0.3, emission=0.6),
        'metal': mat('Metal', 'steel', roughness=0.32, metallic=0.4),
        'chrome': mat('Chrome', 'chrome', roughness=0.24, metallic=0.4),
    }


def stack(name, rows, material, n=16, p=4.0, fan=(0.0, 0.01), paint=None, phase=None, smooth=50):
    """Loft horizontal superellipse rings stacked along Z. rows = [(z, half_x, half_y), ...].

    fan = (bottom, top) pole offsets (0 = flat triangle-fan cap, >0 = dome) or None for ngon caps.
    paint = [(material, fn(band) -> bool)] colours whole bands (lid seams, rubber bases, stripes).
    """
    ph = (math.pi / n) if phase is None else phase
    rings = [K.sring((0, 0, z), hx, hy, n=n, p=p, plane='XY', phase=ph) for (z, hx, hy) in rows]
    return K.loft(name, rings, material, fan=fan, smooth=smooth,
                  paint=[(m, (lambda s, i, f=f: f(s))) for m, f in (paint or [])])


def assemble(name, node, parts):
    """root empty `name` at the origin -> joined mesh `node`."""
    root = K.node(name, (0, 0, 0), size=0.2)
    mesh = K.join(parts, node)
    K.set_frame(mesh, (0, 0, 0))
    K.parent(mesh, root)
    return root, mesh
