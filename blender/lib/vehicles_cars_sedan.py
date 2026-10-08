"""vehicles_cars kit: parametric three-box sedan shared by veh_taxi and veh_sedan.

A Spec (attribute dict) drives the side profiles of the lower tub and the greenhouse, wheel/arch placement
and where the stuck-on details go. Scripts add their own extras (taxi roof sign, vacant light, ...).
Facing -Y, model LEFT = +X (docs/ASSET_SPEC.md).
"""
import bmesh
from .vehicles_cars_mesh import fillet, arch_points, quad
from .vehicles_cars_body import tub, greenhouse, Surface
from .vehicles_cars_parts import wheel, stick, plate, seam, side_seam, top_seam, mirror, patch, face_cast


class Spec(dict):
    """dict with attribute access (S.yf instead of S['yf'])."""
    __getattr__ = dict.__getitem__


def tub_profile(S):
    n, t, b = S.nose, S.tail, S.belt
    pts = [(n + 0.13, 0.30, 0.07)]
    pts += arch_points(S.yf, S.r, S.ar, S.sill)
    pts += arch_points(S.yr, S.r, S.ar, S.sill)
    pts += [(t - 0.14, 0.30, 0.07), (t - 0.01, 0.40, 0.10), (t, 0.65, 0.2), (t - 0.12, S.deck_z, 0.2),
            (S.deck_y, S.get('belt_rear', b), 0.0), (S.cowl_y, b, 0.0), (S.hood_mid[0], S.hood_mid[1], 0.4),
            (n + 0.13, S.hood_z, 0.22), (n, 0.59, 0.2), (n + 0.03, 0.37, 0.07)]
    return fillet(pts, S.get('fillet_step', 25))


def shell(M, S):
    """Lower tub + greenhouse bmeshes and a Surface for sticking details on."""
    tub_bm = tub(M, tub_profile(S), S.hw, bevel=S.tub_bevel, segs=S.segs, small=0.03, big_z=S.r + S.ar + 0.02,
                 plan_reach=S.plan_reach, plan_inset=S.plan_inset, split_z=S.split, upper=S.tub_upper,
                 arches=[(S.yf, S.r, S.ar), (S.yr, S.r, S.ar)], sill_z=S.sill, plan_cuts=(0.35, 1.0),
                 tumble=S.tumble)
    gh_bm = greenhouse(M, fillet(S.gh_profile, 25), S.gh_half, top_scale=S.gh_top, z_base=S.gh_zbase,
                       z_glass=S.gh_zglass, bevel=S.gh_bevel, segs=3, inset=0.036, depth=0.014,
                       pillars=S.pillars, ring=S.get('ring'))
    return tub_bm, gh_bm, Surface([tub_bm, gh_bm])


def side_details(d, M, surf, S):
    """Door shut lines, handles, rubbing strip, side repeaters, chrome belt line under the side glass."""
    for s in (1, -1):
        side_seam(d, M, surf, S.door_front_y, 0.34, S.belt - 0.02, s)
        side_seam(d, M, surf, S.door_mid_y, 0.31, S.belt - 0.02, s)
        side_seam(d, M, surf, S.door_rear_y, 0.62, S.belt - 0.02, s, n=4)
        for y in S.handle_ys:
            stick(d, M, surf.side(y, S.handle_z, s), (0.14, 0.03, 0.04), 'chrome', segs=0, out=0.022)
        if S.get('strip'):
            stick(d, M, surf.side(S.strip[0], S.strip[2], s), (S.strip[1], 0.024, 0.05), 'trim', segs=0, out=0.012)
        stick(d, M, surf.side(S.nose + 0.30, S.handle_z - 0.02, s), (0.08, 0.02, 0.035), 'amber', segs=0, out=0.012)
        seam(d, M, surf, [((s * 5, y, S.gh_zglass + 0.012), (-s, 0, 0)) for y in S.belt_ys], half_w=0.01,
             lift=0.006, mat='chrome')


def top_details(d, M, surf, S):
    """Hood and boot shut lines + wipers (they read well from the high diorama camera)."""
    hx, hy0, hy1 = S.hood_seam
    st = S.get('seam_step', 0.12)
    top_seam(d, M, surf, step=st, pts_xy=[(-hx + 0.02, hy0), (-hx, (hy0 + hy1) / 2), (-hx, hy1), (0.0, hy1 + 0.01), (hx, hy1),
                          (hx, (hy0 + hy1) / 2), (hx - 0.02, hy0)])
    bx, by0, by1 = S.boot_seam
    top_seam(d, M, surf, step=st, pts_xy=[(-bx, by1), (-bx, (by0 + by1) / 2), (-bx, by0), (0.0, by0 - 0.01), (bx, by0),
                          (bx, (by0 + by1) / 2), (bx, by1)])
    for x in (0.27, -0.33):
        stick(d, M, surf.top(x, S.wiper_y), (0.52, 0.02, 0.03), 'trim', segs=0, out=0.018)


def grille(d, M, surf, S):
    """'bar' = taxi chrome-bar grille; 'trapezoid' = wide modern grille with chrome surround."""
    gz = S.grille_z
    if S.grille == 'bar':
        stick(d, M, surf.front(0, gz), (S.grille_w, 0.06, 0.14), 'trim', radius=0.04, out=0.008)
        stick(d, M, surf.front(0, gz + 0.045), (S.grille_w + 0.04, 0.04, 0.035), 'chrome', segs=0, out=0.022)
    else:
        stick(d, M, surf.front(0, gz), (S.grille_w + 0.08, 0.07, 0.15), 'chrome', radius=0.05, out=0.010,
              front=(0.9, 1.0))
        stick(d, M, surf.front(0, gz), (S.grille_w, 0.07, 0.11), 'trim', radius=0.04, out=0.016, front=(0.9, 1.0))
    stick(d, M, surf.front(0, gz + 0.005), (0.10, 0.04, 0.07), 'chrome', segs=0, out=0.03, front=(0.8, 0.8))


def front_details(d, M, surf, S):
    """Grille, lower intake, plate, wrap-around headlamp surrounds."""
    FR = face_cast(surf, 'front')
    grille(d, M, surf, S)
    stick(d, M, surf.front(0, 0.40), (S.intake_w, 0.06, 0.12), 'trim', radius=0.04, out=0.010, front=(0.88, 1.0))
    plate(d, M, surf.front(0, 0.47), out=0.035)
    x0, x1, z0, z1 = S.head
    for s in (1, -1):
        patch(d, M, FR, (s * (x0 - 0.03), s * (x1 + 0.03)), (z0 - 0.025, z1 + 0.025), S.head_surround, lift=0.010,
              nu=5)


def rear_details(d, M, surf, S):
    """Wrap-around tail lamps (+ amber corner), reflectors, bumper lip, plate, boot chrome."""
    RR = face_cast(surf, 'rear')
    x0, x1, z0, z1 = S.tail_lamp
    xa = S.get('tail_amber')
    for s in (1, -1):
        patch(d, M, RR, (s * x0, s * (xa or x1)), (z0, z1), 'tail', lift=0.012, nu=4)
        if xa:
            patch(d, M, RR, (s * xa, s * x1), (z0, z1), 'amber', lift=0.012, nu=2)
        h = surf.rear(s * 0.62, 0.43)
        quad(d, h[0], h[1], 0.11, 0.035, M['tail'], lift=0.006)
    stick(d, M, surf.rear(0, 0.35), (S.intake_w + 0.20, 0.05, 0.08), 'trim', radius=0.03, out=0.012)
    plate(d, M, surf.rear(0, z0 - 0.06), out=0.012)
    stick(d, M, surf.rear(0, (z0 + z1) / 2), (2 * x0 - 0.12, 0.04, 0.035), 'chrome', segs=0, out=0.012)


def lights(M, surf, S):
    """head_lights (Light_Head) and brake_lights (Light_Brake) nodes, lenses hugging the body corners."""
    FR, RR = face_cast(surf, 'front'), face_cast(surf, 'rear')
    hl, bl = bmesh.new(), bmesh.new()
    x0, x1, z0, z1 = S.head
    t0, t1, u0, u1 = S.tail_lamp
    for s in (1, -1):
        patch(hl, M, FR, (s * (x0 + 0.01), s * x1), (z0, z1), 'head', lift=0.022, nu=5)
        patch(hl, M, FR, (s * 0.60, s * 0.70), (0.39, 0.44), 'head', lift=0.016, nu=1, nv=1)
        patch(bl, M, RR, (s * (t0 + 0.05), s * (t0 + 0.24)), (u0 + 0.03, u1 - 0.03), 'brake', lift=0.024, nu=3, nv=1)
    stick(bl, M, surf.rear(0, S.third_brake_z), (0.28, 0.03, 0.035), 'brake', segs=0, out=0.01)
    head = M.obj('head_lights', hl, origin=(0, S.nose + 0.05, (z0 + z1) / 2))
    brake = M.obj('brake_lights', bl, origin=(0, S.tail - 0.05, (u0 + u1) / 2))
    return head, brake


def mirrors(M, surf, S, housing='paint2'):
    out = []
    my, mz = S.mirror
    for s, nm in ((1, 'mirror_L'), (-1, 'mirror_R')):
        hinge = surf.side(my, mz, s)[0]
        out.append(mirror(M, nm, s, hinge, s * S.mirror_tip, (my, mz + 0.05), S.mirror_size, housing=housing))
    return out


def wheels(M, S):
    out = []
    for nm, s, y in (('wheel_FL', 1, S.yf), ('wheel_FR', -1, S.yf), ('wheel_RL', 1, S.yr), ('wheel_RR', -1, S.yr)):
        out.append(wheel(M, nm, (s * S.wheel_x, y, S.r), S.r, S.tw, s))
    return out
