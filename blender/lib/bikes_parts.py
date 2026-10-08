"""Shared bike components for SOI RIDER (bike_cub / bike_scooter / bike_sport + gear).

Facing -Y, model LEFT = +X, metres, origin on the ground at the footprint centre.
Contract (docs/ASSET_SPEC.md): frame, steer(-> wheel_F, mirror_L/R, dash, grip_L/R, headlight),
wheel_R, seat_rider, seat_pillion, foot_L, foot_R, gear_mount.
"""
import math
import os
import bpy
import bmesh
from mathutils import Matrix, Vector

from .palette import mat
from . import bikes_kit as K

V = Vector


# ----------------------------------------------------------------------------- materials
def bike_mats(paint, paint2, seat='seat_black', trim='canopy_black', rim='steel'):
    """Contract materials + a few fixed-colour extras (unique non-contract names)."""
    return {
        'paint': mat('Paint', paint, roughness=0.34),
        'paint2': mat('Paint2', paint2, roughness=0.38),
        'trim': mat('Trim', trim, roughness=0.62),
        'seat': mat('Seat', seat, roughness=0.78),
        'chrome': mat('Chrome', 'chrome', roughness=0.24, metallic=0.4),
        'tire': mat('Tire', 'tire', roughness=0.88),
        'head': mat('Light_Head', 'light_head', roughness=0.2, emission=1.2),
        'tail': mat('Light_Tail', 'light_tail', roughness=0.3, emission=0.6),
        'brake': mat('Light_Brake', 'bus_red', roughness=0.25),
        'glass': mat('Glass', 'glass_light', roughness=0.12),
        'dash': mat('Dash_Screen', 'gram_cyan_deep', roughness=0.3, emission=0.45),
        'plate': mat('Plate', 'plate_white', roughness=0.5),
        # fixed colours (non-contract names)
        'rim': mat('Rim', rim, roughness=0.34, metallic=0.25),
        'engine': mat('Engine', 'metal_dark', roughness=0.5, metallic=0.15),
        'metal': mat('Metal', 'steel', roughness=0.38, metallic=0.25),
        'amber': mat('Indicator', 'light_amber', roughness=0.25, emission=0.15),
        'button': mat('Button', 'pin_coral', roughness=0.35),
        'ink': mat('Ink', 'ink', roughness=0.5),
    }


# ----------------------------------------------------------------------------- wheel
def wheel(name, center, R, Ri, W, M, seg=16, hub=0.78, dish=(True, True)):
    """Chunky toy wheel as ONE closed lathe (axle along X): domed hub -> dished rim -> fat tyre.
    10-point profile x 16 segments = 256 tris. dish=(+X side, -X side): False drops that side's dish
    ring (-32 tris) where a brake disc / sprocket / swingarm hides the hub anyway."""
    hw = W / 2
    cr = min(hw * 0.6, (R - Ri) * 0.5)

    def half(on):
        pts = [(0, hw * hub)] + ([(Ri - 0.012, hw * 0.3)] if on else [])
        return pts + [(Ri, hw * 0.86), (R - cr, hw), (R, hw - cr)]
    prof = half(dish[0]) + [(r, -t) for r, t in reversed(half(dish[1]))]
    w = K.lathe(name, prof, M['tire'], seg=seg, axis=(1, 0, 0), center=center, smooth=50)
    c = V(center)
    K.paint_faces(w, M['rim'], lambda p, n: math.hypot(p.y - c.y, p.z - c.z) < Ri - 0.003)
    return w


# ----------------------------------------------------------------------------- controls
def grip(name, p_in, p_out, r, M, seg=8):
    """Rubber grip with flange + chrome bar-end, p_in (inboard) -> p_out (outboard). 80 tris."""
    p_in, p_out = V(p_in), V(p_out)
    ax = p_out - p_in
    L = ax.length
    prof = [(0, 0), (r * 1.42, 0), (r * 1.42, 0.01), (r * 1.1, 0.5 * L), (r, L), (r * 0.92, L + 0.016),
            (0, L + 0.016)]
    g = K.lathe(name, prof, M['trim'], seg=seg, axis=ax, center=p_in, smooth=60)
    axn = ax.normalized()
    K.paint_faces(g, M['chrome'], lambda p, n: (p - p_in).dot(axn) > L + 0.001)
    return g


def lever(name, pts, M, material=None, r=0.0065):
    """Hand lever: thin bent tube (4 sides). ~28 tris."""
    return K.tube(name, pts, r, material or M['chrome'], sides=4, fillet=0.03, steps=1, twist=math.pi / 4)


def switch_pod(name, center, M, side, button='button', w=0.042, r=0.025):
    """Round switch pod on the bar (axis X) + one coloured button facing the rider. 44 tris."""
    c = V(center)
    pod = K.lathe(name, [(0, -w / 2), (r, -w / 2 + 0.007), (r, w / 2 - 0.007), (0, w / 2)], M['trim'], seg=6,
                  axis=(1, 0, 0), center=c)
    btn = K.block(name + '_btn', (w * 0.42, 0.012, r * 0.62), (c.x - side * w * 0.05, c.y + r * 0.92, c.z + r * 0.25),
                  M[button])
    return K.join([pod, btn], name)


def disc(name, center, normal, r, material, seg=16, up=(0, 0, 1)):
    """Flat ngon disc facing `normal` (single face, explicit winding)."""
    a = V(normal).normalized()
    ref = V(up)
    u = (ref - a * ref.dot(a)).normalized()
    v = a.cross(u)
    c = V(center)
    bm = bmesh.new()
    ring = [bm.verts.new(c + (u * math.cos(math.tau * i / seg) + v * math.sin(math.tau * i / seg)) * r)
            for i in range(seg)]
    bm.faces.new(ring)
    obj = K._mk(name, bm, material, recalc=False)
    return K.finish(obj, 60)


def mirror(name, base, head, r, M, side, stem_mat=None, stem_via=None, depth=0.04, stem_r=0.0095,
           eye=(0, 0.06, 1.42), oval=1.0, seg=16):
    """Mirror geometry: tapered stem (base -> head) + domed housing + Glass face (0..1 UVs). ~156 tris.

    side = +1 for mirror_L (+X), -1 for mirror_R. The glass normal bisects 'to the rider's eye' and
    'straight back'. The node pivot goes on the stem base.
    """
    base, head = V(base), V(head)
    n = ((V(eye) - head).normalized() + V((0, 1, 0))).normalized()
    up = V((0, 0, 1))
    prof = [(0, -depth), (r, -depth * 0.3), (r * 0.86, 0.0), (0, -0.003)]
    shell = K.lathe(name + '_shell', prof, M['trim'], seg=seg, axis=n, center=head, up=up, smooth=55)
    glass = disc(name + '_glass', head + n * -0.0012, n, r * 0.86, M['glass'], seg=seg, up=up)
    right = n.cross(up).normalized()
    if right.x > 0:
        right = -right
    K.planar_uv(glass, head, right, up, r * 1.72 * oval, r * 1.72)
    parts = [shell, glass]
    if oval != 1.0:
        for o in parts:
            o.data.transform(Matrix.Translation(head) @ Matrix.Scale(oval, 4, (1, 0, 0)) @ Matrix.Translation(-head))
    attach = head - n * depth * 0.5 + V((-side * r * 0.2 * oval, 0, -r * 0.5))
    pts = [base] + ([V(p) for p in stem_via] if stem_via else []) + [attach]
    stem = K.tube(name + '_stem', pts, (stem_r * 1.45, stem_r * 0.9), stem_mat or M['chrome'], sides=5,
                  fillet=0.04, steps=1)
    return K.join([shell, glass, stem], name)


def dash(name, center, w, h, tilt_deg, M, bezel=0.012, hood=True, depth=0.03):
    """Instrument: Trim bezel + sun hood (returned as the housing, for the steer mesh) and the `dash` quad
    (Dash_Screen, UV 0..1). tilt_deg: 0 = screen faces straight up, 90 = faces the rider.
    UV u runs left->right and v bottom->top as the rider sees it (runtime CanvasTexture: flipY=false)."""
    a = math.radians(tilt_deg)
    xl = V((-1, 0, 0))
    yl = V((0, -math.cos(a), math.sin(a)))
    zl = V((0, math.sin(a), math.cos(a)))
    Rm = Matrix(((xl.x, yl.x, zl.x), (xl.y, yl.y, zl.y), (xl.z, yl.z, zl.z))).to_4x4()
    T = Matrix.Translation(V(center)) @ Rm
    bz = K.slab(name + '_bezel', K.rrect(w + 2 * bezel, h + 2 * bezel, min(w, h) * 0.3, 1), -depth, 0.0,
                M['trim'], axis='Z', smooth=30)
    bz.data.transform(T)
    parts = [bz]
    if hood:
        hp = K.arc(0, 0, 1, 0, 180, 3)
        outer = [((w / 2 + bezel) * x, h / 2 + bezel * 0.5 + 0.024 * y) for x, y in hp]
        inner = [((w / 2 + bezel) * x * 0.92, h / 2 + bezel * 0.5 + 0.024 * y - 0.007) for x, y in reversed(hp)]
        hd = K.slab(name + '_hood', outer + inner, -0.004, 0.024, M['trim'], axis='Z', smooth=40)
        hd.data.transform(T)
        parts.append(hd)
    housing = K.join(parts, name + '_housing')
    q = K.quad(name, [T @ V((-w / 2, -h / 2, 0.0016)), T @ V((w / 2, -h / 2, 0.0016)),
                      T @ V((w / 2, h / 2, 0.0016)), T @ V((-w / 2, h / 2, 0.0016))], M['dash'])
    return housing, q


# ----------------------------------------------------------------------------- lamps & plate
def lamp(name, center, w, h, depth, M, face=-1, lens='head', bezel_mat='chrome', bezel=0.011, n=12, p=3.2,
         bulge=0.012):
    """Lamp facing +-Y (face=-1 front, +1 rear): bezel ring + domed lens, one loft. ~94 tris (n=12).
    w == h with p=2 gives a round lamp."""
    c = V(center)
    s = 1 if face > 0 else -1
    y0, y1 = c.y - s * depth / 2, c.y + s * depth / 2
    ow, oh = w / 2 + bezel, h / 2 + bezel
    rings = [K.sring((c.x, y0, c.z), ow * 0.9, oh * 0.9, n=n, p=p, plane='XZ'),
             K.sring((c.x, y1, c.z), ow, oh, n=n, p=p, plane='XZ'),
             K.sring((c.x, y1 + s * 0.002, c.z), w / 2, h / 2, n=n, p=p, plane='XZ'),
             K.sring((c.x, y1 + s * bulge * 0.55, c.z), w / 2 * 0.86, h / 2 * 0.8, n=n, p=p, plane='XZ')]
    return K.loft(name, rings, M[lens], fan=(0.0, bulge * 0.45), smooth=60,
                  paint=[(M[bezel_mat], lambda sg, i: sg < 2)])


def plate(name, center, w, h, M, tilt_deg=8):
    """Thai bike plate facing +Y (white + dark number bars), tilted up a little. ~52 tris."""
    c = V(center)
    p = K.slab(name, K.rrect(w, h, 0.014, 1, c.x, c.z), c.y, c.y + 0.008, M['plate'], axis='Y', smooth=30)
    t = K.block(name + '_txt', (w * 0.7, 0.003, h * 0.34), (c.x, c.y + 0.009, c.z - h * 0.08), M['ink'])
    obj = K.join([p, t], name)
    K.rot_about(obj, c, (math.radians(-tilt_deg), 0, 0))
    return obj


def indicator(name, center, r, M, axis=(0, -1, 0), stalk=0.0, side=1):
    """Amber turn-signal blob (24 tris), optionally on a short stalk pointing outward."""
    c = V(center)
    parts = [K.lathe(name, [(0, r * 1.15), (r, r * 0.15), (r * 0.78, -r * 0.8), (0, -r * 0.9)],
                     M['amber'], seg=6, axis=axis, center=c, smooth=70)]
    if stalk > 0:
        parts.append(K.tube(name + '_stalk', [c + V((-side * stalk, 0, 0)), c], r * 0.34, M['trim'], sides=4))
    return K.join(parts, name)


# ----------------------------------------------------------------------------- chassis bits
def peg(name, center, L, r, M, side):
    """Rubber foot peg pointing outward (+X for side=+1). 24 tris."""
    return K.lathe(name, [(0, -L / 2), (r, -L / 2 + 0.006), (r * 1.06, L / 2 - 0.006), (0, L / 2)], M['trim'],
                   seg=6, axis=(side, 0, 0), center=center, smooth=60)


def shock(name, p0, p1, M, r=0.024, spring='button'):
    """Rear shock: chunky spring with one waist + chrome rod, eye points p0 (low) -> p1 (high). 72 tris."""
    p0, p1 = V(p0), V(p1)
    ax = p1 - p0
    L = ax.length
    axn = ax.normalized()
    prof = [(0, 0), (r * 0.8, 0.06 * L), (r, 0.76 * L), (r * 0.45, 0.8 * L), (r * 0.45, L), (0, L)]
    o = K.lathe(name, prof, M[spring], seg=6, axis=ax, center=p0, smooth=45)
    K.paint_faces(o, M['chrome'], lambda p, n: (p - p0).dot(axn) > 0.78 * L)
    K.paint_faces(o, M['trim'], lambda p, n: (p - p0).dot(axn) < 0.05 * L)
    return o


def rack(name, y0, y1, z, w, M, material='chrome', r=0.011, legs=(), bars=1, fillet=0.05):
    """Flat tubular rack (rounded-rect loop + cross bars, square-ish tubes) at height z."""
    xs = w / 2
    loop = [(0, y0, z), (xs, y0, z), (xs, y1, z), (-xs, y1, z), (-xs, y0, z), (0, y0, z)]
    parts = [K.tube(name, loop, r, M[material], sides=4, fillet=fillet, steps=1, twist=math.pi / 4)]
    for k in range(bars):
        y = y0 + (y1 - y0) * (k + 1) / (bars + 1)
        parts.append(K.tube(name + f'_bar{k}', [(xs, y, z), (-xs, y, z)], r * 0.8, M[material], sides=4,
                            twist=math.pi / 4))
    for i, (a, b) in enumerate(legs):
        parts.append(K.tube(name + f'_leg{i}', [a, b], r * 0.95, M[material], sides=4, twist=math.pi / 4))
    return K.join(parts, name)


# ----------------------------------------------------------------------------- assembly
def assemble(name, frame_parts, steer_parts, wf, af, wr, ar, ml, ml_base, mr, mr_base, dash_q, dash_c,
             pivot, rake_deg, empties, extras=None):
    """Build the contract hierarchy. Returns the root empty.

    root(name) -> frame, steer(pivot, tilted -rake about X so local up = steering axis)
                  -> wheel_F, mirror_L, mirror_R, dash, grip_L, grip_R, headlight
               -> wheel_R, seat_rider, seat_pillion, foot_L, foot_R, gear_mount
    """
    root = K.node(name, (0, 0, 0), size=0.3)
    frame = K.join(frame_parts, 'frame')
    K.set_frame(frame, (0, 0, 0))
    K.parent(frame, root)
    steer = K.join(steer_parts, 'steer')
    K.set_frame(steer, pivot, (math.radians(-rake_deg), 0, 0))
    K.parent(steer, root)
    steer['rake_deg'] = float(rake_deg)
    steer['steer_axis'] = 'local +Y (three.js) is the steering axis: rotate steer.rotation.y'
    K.set_frame(wf, af)
    wf.name = wf.data.name = 'wheel_F'
    K.parent(wf, steer)
    K.set_frame(wr, ar)
    wr.name = wr.data.name = 'wheel_R'
    K.parent(wr, root)
    for obj, base, nm in ((ml, ml_base, 'mirror_L'), (mr, mr_base, 'mirror_R')):
        K.set_frame(obj, base)
        obj.name = obj.data.name = nm
        K.parent(obj, steer)
    K.set_frame(dash_q, dash_c)
    dash_q.name = dash_q.data.name = 'dash'
    K.parent(dash_q, steer)
    for nm, loc in empties.items():
        par = steer if nm in ('grip_L', 'grip_R', 'headlight') else root
        K.node(nm, loc, par)
    for k, v in (extras or {}).items():
        root[k] = v
    return root


def _cam(scene, loc, look, lens=None, fov=None):
    data = bpy.data.cameras.new('BikeCam')
    if fov is not None:  # vertical FOV, like THREE.PerspectiveCamera
        data.sensor_fit = 'VERTICAL'
        data.angle_y = math.radians(fov)
    else:
        data.lens = lens or 50
    cam = bpy.data.objects.new('BikeCam', data)
    scene.collection.objects.link(cam)
    cam.location = V(loc)
    cam.rotation_euler = (V(look) - V(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    return cam


def shot(ctx, name, loc, look, fov=None, lens=None, res=(720, 540), samples=24, ground=True):
    """Cycles QA render from an explicit camera (same light rig as lib.preview)."""
    if not ctx.want_preview():
        return None
    from .preview import _world, _cycles
    scene = bpy.context.scene
    temp = []
    if ground:
        bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
        plane = bpy.context.active_object
        gm = bpy.data.materials.get('PreviewGround') or bpy.data.materials.new('PreviewGround')
        gm.use_nodes = True
        gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.36, 0.31, 0.28, 1)
        plane.data.materials.append(gm)
        temp.append(plane)
    cam = _cam(scene, loc, look, lens=lens, fov=fov)
    sd = bpy.data.lights.new('BikeSun', 'SUN')
    sd.energy = 3.2
    sd.color = (1.0, 0.86, 0.68)
    sd.angle = math.radians(6)
    sun = bpy.data.objects.new('BikeSun', sd)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    scene.collection.objects.link(sun)
    temp += [cam, sun]
    _world(scene)
    _cycles(scene, samples)
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.render.resolution_x, scene.render.resolution_y = res
    os.makedirs(ctx.previews_dir, exist_ok=True)
    path = os.path.join(ctx.previews_dir, name + '.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in temp:
        bpy.data.objects.remove(o, do_unlink=True)
    print(f'[shot] {path}')
    return path


def qa(ctx, name, eye, look=None, rear=((2.3, 3.6, 3.0), (0, 0.05, 0.55)), side_x=-4.8):
    """Standard QA renders: front 3/4 (lib preview), rear-high 3/4 (diorama-like), side, POV.
    Flag --only=rear,pov limits the set; --fast lowers samples/resolution while iterating."""
    from .preview import render_preview
    only = None
    for f in ctx.flags:
        if f.startswith('--only='):
            only = set(f[7:].split(','))
    fast = '--fast' in ctx.flags
    kw = dict(samples=12, res=(560, 420)) if fast else {}
    want = (lambda k: only is None or k in only)
    if want('main'):
        render_preview(ctx, name, samples=16 if fast else 32, res=(560, 420) if fast else (720, 540))
    if want('rear'):
        shot(ctx, name + '_rear', rear[0], rear[1], lens=50, **kw)
    if want('side'):
        shot(ctx, name + '_side', (side_x, 0.0, 0.75), (0, 0, 0.55), lens=55, **kw)
    if want('pov'):
        shot(ctx, name + '_pov', eye, look or (eye[0], eye[1] - 3.0, eye[2] - 1.1), fov=72, **kw)
