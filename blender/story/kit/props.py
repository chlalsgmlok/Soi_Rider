"""Small story-only props: sign text in the game's display font (Kanit, Thai + Latin runs), sagging power wires,
a hanging bulb, the glowing gram phone and Aunt Lek's apron.
"""
import math
import os
import bpy
from mathutils import Vector
from lib import characters_rig as R
from story.kit.assets import rgba
from story.kit.stage import smat

_FONTS = {}
FALLBACK_FONT = 'C:/Windows/Fonts/LeelaUIb.ttf'


def font(root, script, weight=700):
    key = (script, weight)
    if key not in _FONTS:
        path = os.path.join(root, 'node_modules', '@fontsource', 'kanit', 'files',
                            f'kanit-{script}-{weight}-normal.woff')
        _FONTS[key] = bpy.data.fonts.load(path if os.path.exists(path) else FALLBACK_FONT)
    return _FONTS[key]


def _is_thai(ch):
    return '\u0e00' <= ch <= '\u0e7f'


def _runs(body):
    runs = []
    for ch in body:
        script = 'thai' if _is_thai(ch) else 'latin'
        if runs and runs[-1][0] == script:
            runs[-1][1] += ch
        else:
            runs.append([script, ch])
    return runs


def text(root, body, size, loc, rot=(90, 0, 0), mat=None, extrude=0.004, weight=700, align='CENTER', name='St_Text'):
    """Mixed Thai/Latin line laid out run by run (the fontsource subsets split the scripts).
    rot degrees: (90, 0, yaw) stands the text up facing -Y rotated by yaw. Returns the parent empty."""
    holder = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(holder)
    parts, x = [], 0.0
    for script, chunk in _runs(body):
        lead = len(chunk) - len(chunk.lstrip(' '))
        trail = len(chunk) - len(chunk.rstrip(' '))
        x += lead * size * 0.28
        word = chunk.strip(' ')
        if word:
            cu = bpy.data.curves.new(name, 'FONT')
            cu.body = word
            cu.font = font(root, script, weight)
            cu.size = size
            cu.extrude = extrude
            cu.align_x = 'LEFT'
            cu.align_y = 'CENTER'
            ob = bpy.data.objects.new(name, cu)
            bpy.context.scene.collection.objects.link(ob)
            if mat is not None:
                cu.materials.append(mat)
            bpy.context.view_layer.update()
            ob.location = (x, 0, 0)
            ob.parent = holder
            parts.append(ob)
            x += ob.dimensions.x
        x += trail * size * 0.28
    shift = {'CENTER': -x / 2, 'LEFT': 0.0, 'RIGHT': -x}[align]
    for ob in parts:
        ob.location.x += shift
    holder.location = Vector(loc)
    holder.rotation_euler = tuple(math.radians(a) for a in rot)
    bpy.context.view_layer.update()
    return holder


def wire(p0, p1, sag=0.45, radius=0.012, mat=None, segs=14, name='St_Wire'):
    p0, p1 = Vector(p0), Vector(p1)
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 1
    sp = cu.splines.new('POLY')
    sp.points.add(segs)
    for i in range(segs + 1):
        t = i / segs
        p = p0.lerp(p1, t) - Vector((0, 0, 4 * sag * t * (1 - t)))
        sp.points[i].co = (p.x, p.y, p.z, 1)
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(mat or smat(name + '_Mat', '#1d1f24', rough=0.5))
    return ob


def bulb(top, drop=0.6, color='#FFC27A', strength=30.0, watts=45.0, name='St_Bulb'):
    """A bare bulb hanging from `top` on a cable: emissive glass + a point light."""
    top = Vector(top)
    end = top - Vector((0, 0, drop))
    cable = wire(top, end + Vector((0, 0, 0.06)), sag=0.0, radius=0.006, name=name + '_Cable')
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.028, depth=0.07, location=end + Vector((0, 0, 0.05)))
    sock = bpy.context.active_object
    sock.name = name + '_Socket'
    sock.data.materials.append(smat(name + '_SocketMat', '#2a2c31', rough=0.4))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.055, location=end - Vector((0, 0, 0.03)))
    glass = bpy.context.active_object
    glass.name = name + '_Glass'
    glass.scale = (1, 1, 1.25)
    glass.data.materials.append(smat(name + '_Glow', color, rough=0.2, emission=strength))
    glass.visible_shadow = False
    bpy.ops.object.shade_smooth()
    d = bpy.data.lights.new(name + '_Light', 'POINT')
    d.energy = watts
    d.color = rgba(color)[:3]
    d.shadow_soft_size = 0.05
    lo = bpy.data.objects.new(name + '_Light', d)
    lo.location = end - Vector((0, 0, 0.03))
    bpy.context.scene.collection.objects.link(lo)
    return [cable, sock, glass, lo]


def phone(screen_strength=3.0, name='St_Phone'):
    """gram phone: an empty at the origin (screen facing its +Z) holding a dark body, the cyan app header, a cream
    job card with a coral pin and the accept button. Move / rotate / scale the returned empty."""
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)

    def slab(n, size, y, z, mat, bevel=0.0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, z))
        o = bpy.context.active_object
        o.name = n
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(mat)
        if bevel:
            mod = o.modifiers.new('Bevel', 'BEVEL')
            mod.width, mod.segments = bevel, 2
        o.parent = root
        return o

    s = screen_strength
    slab(name + '_Body', (0.072, 0.145, 0.009), 0, 0, smat(name + '_BodyMat', 'ink', rough=0.35), bevel=0.0035)
    slab(name + '_Screen', (0.064, 0.134, 0.001), 0, 0.0048, smat(name + '_ScreenMat', '#EAF7F4', rough=0.2, emission=s))
    slab(name + '_Head', (0.064, 0.03, 0.001), 0.052, 0.0054, smat(name + '_HeadMat', 'gram_cyan', rough=0.2,
                                                                emission=s * 1.3))
    slab(name + '_Card', (0.054, 0.05, 0.001), -0.005, 0.0054, smat(name + '_CardMat', 'cream', rough=0.2,
                                                                 emission=s * 0.9))
    slab(name + '_Pin', (0.014, 0.014, 0.0012), -0.004, 0.006, smat(name + '_PinMat', 'pin_coral', rough=0.2,
                                                                  emission=s * 1.4), bevel=0.003)
    slab(name + '_Btn', (0.05, 0.016, 0.0012), -0.05, 0.0058, smat(name + '_BtnMat', 'gram_cyan_deep', rough=0.2,
                                                                 emission=s * 1.2), bevel=0.003)
    return root


def apron(color='cream', trim='pin_coral', name='St_Apron'):
    """Bib apron in char_body rest space: bib on the torso, skirt over the hips/thighs. Returns (bib, skirt);
    parent bib to `torso`, skirt to `hips` with ZERO offset (their meshes are relative to those joints)."""
    cloth = smat(name + '_Cloth', color, rough=0.75)
    edge = smat(name + '_Trim', trim, rough=0.6)

    def panel(n, rows, joint, hem, xs=9):
        """rows: (z, half_width, y_of(x)) top -> bottom; the last face row gets the trim when `hem`."""
        verts, faces = [], []
        for z, half_w, y_of in rows:
            for i in range(xs):
                x = (-1 + 2 * i / (xs - 1)) * half_w
                verts.append((x, y_of(x), z))
        for r in range(len(rows) - 1):
            for i in range(xs - 1):
                a = r * xs + i
                faces.append((a, a + 1, a + 1 + xs, a + xs))
        me = bpy.data.meshes.new(n)
        me.from_pydata([tuple(Vector(v) - joint) for v in verts], [], faces)
        me.materials.append(cloth)
        me.materials.append(edge)
        last = (len(rows) - 2) * (xs - 1)
        for p in me.polygons:
            p.use_smooth = True
            p.material_index = 1 if hem and p.index >= last else 0
        ob = bpy.data.objects.new(n, me)
        bpy.context.scene.collection.objects.link(ob)
        sol = ob.modifiers.new('Solid', 'SOLIDIFY')
        sol.thickness = 0.012
        sol.offset = -1.0  # faces are wound towards the body: grow the cloth outwards
        sub = ob.modifiers.new('Smooth', 'SUBSURF')
        sub.levels = sub.render_levels = 1
        return ob

    def hug(z, gap):
        rx, ry, cy = R.torso_at(z)
        return lambda x: cy - ry * math.sqrt(max(0.0, 1 - min(abs(x) / rx, 0.93) ** 2)) - gap

    rows_bib = [(z, 0.10 + (1.30 - z) * 0.17, hug(z, 0.008)) for z in (1.31, 1.25, 1.18, 1.10, 1.02, 0.97)]
    bib = panel(name + '_Bib', rows_bib, R.TORSO, hem=False)

    def drape(y0, k):
        return lambda x: y0 + k * x * x

    rows_skirt = [(1.03, 0.17, drape(-0.150, 1.6)), (0.93, 0.19, drape(-0.160, 1.5)), (0.80, 0.205, drape(-0.168, 1.4)),
                  (0.68, 0.215, drape(-0.172, 1.3)), (0.60, 0.218, drape(-0.174, 1.3)), (0.565, 0.22, drape(-0.175, 1.3))]
    skirt = panel(name + '_Skirt', rows_skirt, R.HIPS, hem=True)
    return bib, skirt
