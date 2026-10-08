"""BTS skytrain structure kit (pillar / deck / station share these dimensions so they assemble exactly).

Line runs along Y. Pillar top (crossbeam top) = deck bottom = 9.5 m; deck top slab 10.6 m; parapet top 11.0 m;
rail top 10.88 m; track centres at x = +-2.0 (gauge 1.435).
"""
from lib.palette import mat
from lib.shapes import sphere, cyl
from lib.buildings_kit import rbx, prism

Z_DECK = 9.5
Z_SLAB = 10.6
Z_RAIL = 10.88
TRACK_X = 2.0
GAUGE = 1.435


def bts_materials():
    return {
        'concrete': mat('Bld_Concrete', '#CFC8BD', roughness=0.85),
        'concrete2': mat('Bld_ConcreteLight', 'wall_white', roughness=0.8),
        'slab': mat('Bld_TrackSlab', 'plastic_gray', roughness=0.9),
        'rail': mat('Bld_Rail', 'steel', roughness=0.35, metallic=0.4),
        'hazard': mat('Bld_Hazard', 'lane_yellow', roughness=0.6),
        'ink': mat('Bld_Dark', 'ink', roughness=0.8),
        'curb_r': mat('Bld_CurbRed', 'curb_red', roughness=0.7),
        'curb_w': mat('Bld_CurbWhite', 'curb_white', roughness=0.7),
        'soil': mat('Bld_Soil', 'soil', roughness=0.95),
        'leaf': mat('Leaf', 'leaf', roughness=0.7),
        'paint': mat('Paint', 'taxi_green', roughness=0.5),
    }


def column(P, B, x, y, z0, z1, hx=0.8, hy=0.9, r=0.34, hazard=True):
    """Rounded concrete column (pill-ish section) with a yellow/black hazard collar near the ground."""
    P.add(rbx('col', x - hx, x + hx, y - hy, y + hy, z0, z1, B['concrete'], bevel=r, seg=3, open=('-z', '+z')))
    if hazard:
        for k, (a, b) in enumerate(((0.35, 0.75), (0.75, 1.15), (1.15, 1.55))):
            m = B['hazard'] if k % 2 == 0 else B['ink']
            P.add(rbx('col_band', x - hx - 0.03, x + hx + 0.03, y - hy - 0.03, y + hy + 0.03, z0 + a, z0 + b, m,
                      bevel=r + 0.03, seg=3, open=('-z', '+z')))


def hammerhead(P, B, x, y, half_w, z_top, depth=1.9, hy=1.0, neck=1.2):
    """Tapered crossbeam: narrow at the column, full width at the top (deck seat)."""
    zb = z_top - depth
    prof = [(-neck, zb), (neck, zb), (half_w, z_top - 0.75), (half_w, z_top), (-half_w, z_top), (-half_w, z_top - 0.75)]
    prof = [(x + u, v) for u, v in prof]
    P.add(prism('cap', prof, y - hy, y + hy, 'Y', B['concrete'], bevel=0.07, seg=2))
    P.add(rbx('cap_lip', x - half_w - 0.03, x + half_w + 0.03, y - hy - 0.03, y + hy + 0.03, z_top - 0.16, z_top,
              B['concrete2'], bevel=0.03, open=('+z',)))


def median_planter(P, B, x, y, hx=1.5, hy=1.9):
    """Red/white striped median curb box with soil and shrubs around the pillar foot."""
    n = 6
    w = 2 * hy / n
    for i in range(n):
        m = B['curb_r'] if i % 2 == 0 else B['curb_w']
        for s in (-1, 1):
            P.add(rbx('curb', x + s * hx - 0.12, x + s * hx + 0.12, y - hy + i * w, y - hy + (i + 1) * w, 0.0, 0.3, m,
                      bevel=0.03, open=('-z',), flat=('-y', '+y')))
    for s in (-1, 1):
        P.add(rbx('curb_end', x - hx - 0.12, x + hx + 0.12, y + s * hy - 0.12, y + s * hy + 0.12, 0.0, 0.3,
                  B['curb_w'], bevel=0.03, open=('-z',)))
    P.add(rbx('soil', x - hx + 0.12, x + hx - 0.12, y - hy + 0.12, y + hy - 0.12, 0.0, 0.24, B['soil'], bevel=0, open=('-z',)))
    for dx, dy, s in ((-0.95, -1.25, 0.42), (0.95, 1.2, 0.38), (1.0, -1.3, 0.3), (-1.0, 1.25, 0.33)):
        P.add(sphere('shrub', s, (x + dx, y + dy, 0.24 + s * 0.6), B['leaf'], scale=(1, 1, 0.8), segments=8, rings=4))
