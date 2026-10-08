"""Street ground for the story dioramas, matching the city view (src/world/build): asphalt carriageway at z=0,
raised tiled sidewalks (0.15 m) behind red/white striped curbs (1 m stripes), white lane dashes, double yellow
centre lines, zebra crossings and stop lines. Everything here is axis-aligned and built in world coordinates.

Story-only materials are prefixed `St_` so they never collide with the runtime material contract names.
"""
import bpy
from story.kit.assets import rgba

SIDEWALK_H = 0.15


def smat(name, color, rough=0.6, metal=0.0, emission=0.0, emission_color=None, alpha=1.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = rgba(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    if emission > 0:
        b.inputs['Emission Color'].default_value = rgba(emission_color or color)
        b.inputs['Emission Strength'].default_value = emission
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
    m.diffuse_color = rgba(color)
    return m


class Batch:
    """Many boxes in one mesh object (one material), bevelled by a modifier."""

    def __init__(self, name, material, bevel=0.0):
        self.name, self.material, self.bevel = name, material, bevel
        self.verts, self.faces = [], []

    def box(self, x0, x1, y0, y1, z0, z1):
        i = len(self.verts)
        for z in (z0, z1):
            self.verts += [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
        self.faces += [(i, i + 3, i + 2, i + 1), (i + 4, i + 5, i + 6, i + 7), (i, i + 1, i + 5, i + 4),
                       (i + 1, i + 2, i + 6, i + 5), (i + 2, i + 3, i + 7, i + 6), (i + 3, i, i + 4, i + 7)]
        return self

    def quad(self, pts):
        i = len(self.verts)
        self.verts += [tuple(p) for p in pts]
        self.faces.append(tuple(range(i, i + len(pts))))
        return self

    def build(self):
        if not self.faces:
            return None
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(self.verts, [], self.faces)
        me.materials.append(self.material)
        me.validate()
        obj = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(obj)
        if self.bevel > 0:
            mod = obj.modifiers.new('Bevel', 'BEVEL')
            mod.width = self.bevel
            mod.segments = 2
            mod.limit_method = 'ANGLE'
        for p in me.polygons:
            p.use_smooth = False
        return obj


def asphalt_mat(name='St_Asphalt', color='asphalt', wet=0.0, scale=0.35):
    """Asphalt with low-frequency tone patches; wet > 0 darkens it, lowers roughness and adds mirror puddles."""
    m = smat(name, color, rough=0.82)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 4.0
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    tone = nt.nodes.new('ShaderNodeValToRGB')
    base = rgba(color)
    dark = tuple(c * (0.55 if wet else 0.86) for c in base[:3]) + (1.0,)
    lite = tuple(c * (0.75 if wet else 1.06) for c in base[:3]) + (1.0,)
    tone.color_ramp.elements[0].color = dark
    tone.color_ramp.elements[1].color = lite
    tone.color_ramp.elements[0].position, tone.color_ramp.elements[1].position = 0.35, 0.65
    nt.links.new(noise.outputs['Fac'], tone.inputs['Fac'])
    nt.links.new(tone.outputs['Color'], b.inputs['Base Color'])
    if wet > 0:
        puddle = nt.nodes.new('ShaderNodeValToRGB')
        puddle.color_ramp.elements[0].position = 0.56
        puddle.color_ramp.elements[1].position = 0.6
        puddle.color_ramp.elements[0].color = (0.32 - 0.2 * wet,) * 3 + (1,)
        puddle.color_ramp.elements[1].color = (0.03,) * 3 + (1,)
        nt.links.new(noise.outputs['Fac'], puddle.inputs['Fac'])
        nt.links.new(puddle.outputs['Color'], b.inputs['Roughness'])
    return m


def tile_mat(name='St_Sidewalk', color='sidewalk', tile=0.42, wet=0.0):
    m = smat(name, color, rough=0.7 - 0.45 * wet)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.offset = 0.0
    c = rgba(color)
    brick.inputs['Color1'].default_value = c
    brick.inputs['Color2'].default_value = tuple(v * 0.93 for v in c[:3]) + (1,)
    brick.inputs['Mortar'].default_value = tuple(v * 0.72 for v in c[:3]) + (1,)
    brick.inputs['Scale'].default_value = 1.0
    brick.inputs['Mortar Size'].default_value = 0.012
    brick.inputs['Brick Width'].default_value = tile
    brick.inputs['Row Height'].default_value = tile
    nt.links.new(tc.outputs['Object'], brick.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], b.inputs['Base Color'])
    return m


class Ground:
    """Collects the street pieces of one diorama; call build() once at the end."""

    def __init__(self, wet=0.0, asphalt='asphalt', sidewalk='sidewalk'):
        self.road = Batch('St_Road', asphalt_mat(color=asphalt, wet=wet))
        self.walk = Batch('St_Walk', tile_mat(color=sidewalk, wet=wet), bevel=0.02)
        self.curb_r = Batch('St_CurbRed', smat('St_CurbRed', 'curb_red', rough=0.55 - 0.4 * wet), bevel=0.035)
        self.curb_w = Batch('St_CurbWhite', smat('St_CurbWhite', 'curb_white', rough=0.55 - 0.4 * wet), bevel=0.035)
        self.white = Batch('St_LineWhite', smat('St_LineWhite', 'lane_white', rough=0.5 - 0.35 * wet))
        self.yellow = Batch('St_LineYellow', smat('St_LineYellow', 'lane_yellow', rough=0.5 - 0.35 * wet))

    def carriageway(self, x0, x1, y0, y1):
        self.road.box(x0, x1, y0, y1, -0.05, 0.0)
        return self

    def sidewalk(self, x0, x1, y0, y1, h=SIDEWALK_H):
        self.walk.box(x0, x1, y0, y1, -0.05, h)
        return self

    def curb(self, a, b, fixed, axis='y', width=0.22, stripe=1.0, h=SIDEWALK_H + 0.01):
        """Curb from a to b along `axis` ('y' or 'x'); `fixed` = centre line of the curb on the other axis."""
        lo, hi = min(a, b), max(a, b)
        n = max(1, int(round((hi - lo) / stripe)))
        step = (hi - lo) / n
        for i in range(n):
            s0, s1 = lo + i * step, lo + (i + 1) * step - 0.01
            batch = self.curb_r if i % 2 == 0 else self.curb_w
            if axis == 'y':
                batch.box(fixed - width / 2, fixed + width / 2, s0, s1, -0.02, h)
            else:
                batch.box(s0, s1, fixed - width / 2, fixed + width / 2, -0.02, h)
        return self

    def dashes(self, fixed, a, b, axis='y', dash=3.0, gap=3.0, w=0.14, color='white'):
        batch = self.white if color == 'white' else self.yellow
        s = min(a, b)
        while s < max(a, b):
            e = min(s + dash, max(a, b))
            self._line(batch, fixed, s, e, axis, w)
            s += dash + gap
        return self

    def solid(self, fixed, a, b, axis='y', w=0.14, color='white'):
        self._line(self.white if color == 'white' else self.yellow, fixed, min(a, b), max(a, b), axis, w)
        return self

    def double_yellow(self, fixed, a, b, axis='y', w=0.12, sep=0.14):
        self.solid(fixed - sep, a, b, axis, w, 'yellow')
        self.solid(fixed + sep, a, b, axis, w, 'yellow')
        return self

    def zebra(self, a, b, c0, c1, axis='x', stripe=0.5, gap=0.55):
        """Zebra crossing: stripes repeat along `axis` from a to b, each spanning c0..c1 on the other axis."""
        s = min(a, b)
        while s + stripe <= max(a, b) + 1e-6:
            self._line(self.white, (c0 + c1) / 2, s, s + stripe, axis, abs(c1 - c0))
            s += stripe + gap
        return self

    @staticmethod
    def _line(batch, fixed, s0, s1, axis, w):
        if axis == 'y':
            batch.box(fixed - w / 2, fixed + w / 2, s0, s1, 0.0, 0.006)
        else:
            batch.box(s0, s1, fixed - w / 2, fixed + w / 2, 0.0, 0.006)

    def build(self):
        return [b.build() for b in (self.road, self.walk, self.curb_r, self.curb_w, self.white, self.yellow)]
