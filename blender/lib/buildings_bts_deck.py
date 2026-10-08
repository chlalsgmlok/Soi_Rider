"""BTS viaduct deck pieces (used by bts_deck and, for the matching track look, bts_station).

Cross-section (x, z) of the twin-track box girder: chunky rounded soffit sitting on the pillar crossbeam at z 9.5,
wings out to +-4.5, slab top 10.6, parapets to 11.0. Everything is extruded along Y with SHARP flat ends so 40 m
segments butt together seamlessly (rounded look comes from arc points in the profile, not from end-cap bevels).
"""
from lib.buildings_kit import rbx, prism, arc, rod
from lib.shapes import cyl
from lib.buildings_bts import Z_DECK, Z_SLAB, Z_RAIL, TRACK_X, GAUGE

HALF_W = 4.5
SOFFIT_X = 3.25       # flat soffit half width (bearings sit under it)
PARAPET_T = 0.3
Z_TOP = 11.0
BEARING_X = (-2.5, -0.85, 0.85, 2.5)


def girder_profile():
    """Closed (x, z) outline, counter-clockwise seen from +Y."""
    right = [(SOFFIT_X, Z_DECK)]
    right += arc(SOFFIT_X, Z_DECK + 0.45, 0.45, -90, -25, 3)[1:]          # rounded soffit corner
    right += [(4.22, 10.24), (4.38, 10.3)]                                   # web -> wing underside
    right += arc(4.38, 10.42, 0.12, -90, 0, 2)[1:]                         # rounded wing nose
    right += [(HALF_W, Z_SLAB)]
    left = [(-x, z) for x, z in reversed(right)]
    # right side bottom->top, top edge across, left side top->bottom (closes along the flat soffit)
    return right + left


def girder(P, B, y0, y1):
    prof = girder_profile()
    P.add(prism('deck_girder', prof, y0, y1, 'Y', B['concrete'], smooth=40))


def parapets(P, B, y0, y1):
    for s in (-1, 1):
        xo = s * HALF_W
        xi = s * (HALF_W - PARAPET_T)
        P.add(rbx('parapet', min(xo, xi), max(xo, xi), y0, y1, Z_SLAB - 0.01, Z_TOP - 0.06, B['concrete2'], bevel=0.05,
                  open=('-z',), flat=('-y', '+y')))
        a, b = min(xo, xi) - (0.04 if s < 0 else 0.0), max(xo, xi) + (0.04 if s > 0 else 0.0)
        P.add(rbx('parapet_cap', a, b, y0, y1, Z_TOP - 0.08, Z_TOP, B['concrete2'], bevel=0.035, open=('-z',),
                  flat=('-y', '+y')))
        # accent band on the outer face of the wing (reads as one long line from the street)
        P.add(rbx('wing_band', s * (HALF_W + 0.025) - 0.025, s * (HALF_W + 0.025) + 0.025, y0, y1, Z_SLAB - 0.17,
                  Z_SLAB + 0.12, B['paint'], bevel=0.02, open=(('-x',) if s > 0 else ('+x',)), flat=('-y', '+y')))


def track(P, B, y0, y1, xc, n_plinth=8):
    """Slab track: plinth blocks under each rail (gaps every few metres), rails, cable trough on the outside."""
    L = (y1 - y0) / n_plinth
    zp = Z_RAIL - 0.14
    for r in (-1, 1):
        xr = xc + r * GAUGE / 2
        for k in range(n_plinth):
            a, b = y0 + k * L + 0.12, y0 + (k + 1) * L - 0.12
            P.add(rbx('plinth', xr - 0.3, xr + 0.3, a, b, Z_SLAB - 0.01, zp, B['slab'], bevel=0.03, open=('-z',)))
        P.add(rbx('rail', xr - 0.04, xr + 0.04, y0, y1, zp, Z_RAIL, B['rail'], bevel=0.015, open=('-z',),
                  flat=('-y', '+y')))
    side = 1 if xc > 0 else -1
    xt = xc + side * 1.45
    P.add(rbx('trough', xt - 0.28, xt + 0.28, y0, y1, Z_SLAB - 0.01, Z_SLAB + 0.16, B['concrete2'], bevel=0.03,
              open=('-z',), flat=('-y', '+y')))


def drains(P, B, ys):
    """Little drain spouts poking out under the wings + down pipes are skipped (pillars carry them)."""
    for y in ys:
        for s in (-1, 1):
            P.add(rod('spout', (s * 4.2, y, 10.32), (s * 4.75, y, 10.22), 0.07, B['slab'], verts=6))


def bearings(P, B, y_centres, hy=0.35):
    for y in y_centres:
        for x in BEARING_X:
            P.add(rbx('bearing_pad', x - 0.32, x + 0.32, y - hy, y + hy, Z_DECK - 0.07, Z_DECK + 0.01, B['ink'],
                      bevel=0, open=('+z',)))
