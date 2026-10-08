"""Game-model instancing for the story dioramas.

Every `load()` imports a fresh copy of a game GLB from public/assets/models, so each instance owns its materials
(the glTF importer creates new ones per import) and can be recoloured or lit on its own, exactly like the runtime
recolours by material NAME (docs/ASSET_SPEC.md). Blender is Z-up, models face -Y; `yaw` is in degrees about +Z
(yaw 180 = facing +Y, yaw 90 = facing +X, yaw -90 = facing -X).
"""
import math
import os
import re
import bpy
from mathutils import Vector
from lib.palette import HEX, hex_to_linear

_MODELS = {'dir': None}


def use_models(models_dir):
    _MODELS['dir'] = models_dir


def base(name):
    return re.sub(r'\.\d{3}$', '', name)


def rgba(color):
    """palette key, '#RRGGBB' or an (r, g, b[, a]) linear tuple -> linear RGBA."""
    if isinstance(color, str):
        return hex_to_linear(HEX.get(color, color))
    c = tuple(color)
    return c if len(c) == 4 else (*c, 1.0)


def principled(m):
    return m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None


class Inst:
    """One imported model: `root` (top node), `objs` (every new object) and `nodes` (base name -> object)."""

    def __init__(self, name, root, objs):
        self.name = name
        self.root = root
        self.objs = objs
        self.nodes = {base(o.name): o for o in objs}

    def node(self, name):
        return self.nodes[name]

    def world(self, name):
        bpy.context.view_layer.update()
        return self.nodes[name].matrix_world.translation.copy()

    def meshes(self):
        return [o for o in self.objs if o.type == 'MESH']

    def materials(self, mat_base):
        out = []
        for o in self.meshes():
            for s in o.material_slots:
                if s.material is not None and base(s.material.name) == mat_base and s.material not in out:
                    out.append(s.material)
        return out

    def color(self, mat_base, color, roughness=None):
        for m in self.materials(mat_base):
            b = principled(m)
            if b is None:
                continue
            b.inputs['Base Color'].default_value = rgba(color)
            m.diffuse_color = rgba(color)
            if roughness is not None:
                b.inputs['Roughness'].default_value = roughness
        return self

    def glow(self, mat_base, strength, color=None):
        """Emission on a material (lamps, tail lights, windows at night). color None = keep its base colour."""
        for m in self.materials(mat_base):
            b = principled(m)
            if b is None:
                continue
            col = rgba(color) if color is not None else tuple(b.inputs['Base Color'].default_value)
            b.inputs['Emission Color'].default_value = col
            b.inputs['Emission Strength'].default_value = strength
        return self

    def finish(self, mat_base, roughness=None, metallic=None, coat=None):
        for m in self.materials(mat_base):
            b = principled(m)
            if b is None:
                continue
            if roughness is not None:
                b.inputs['Roughness'].default_value = roughness
            if metallic is not None:
                b.inputs['Metallic'].default_value = metallic
            if coat is not None:
                b.inputs['Coat Weight'].default_value = coat
        return self

    def hide(self, *names):
        for n in names:
            o = self.nodes.get(n)
            if o is not None:
                o.hide_render = True
                o.hide_viewport = True
        return self

    def place(self, loc, yaw=0.0, pitch=0.0, roll=0.0):
        self.root.location = Vector(loc)
        self.root.rotation_mode = 'XYZ'
        self.root.rotation_euler = (math.radians(pitch), math.radians(roll), math.radians(yaw))
        bpy.context.view_layer.update()
        return self


def load(name, loc=(0.0, 0.0, 0.0), yaw=0.0, colors=None, scale=1.0):
    """Import public/assets/models/<name>.glb as a new instance placed at `loc` with `yaw` degrees."""
    path = os.path.join(_MODELS['dir'], name + '.glb')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None or o.parent not in new]
    if len(roots) == 1:
        root = roots[0]
    else:
        root = bpy.data.objects.new(name + '_root', None)
        bpy.context.scene.collection.objects.link(root)
        for r in roots:
            r.parent = root
        new.append(root)
    for o in new:
        o.rotation_mode = 'XYZ'
    inst = Inst(name, root, new)
    if scale != 1.0:
        root.scale = (scale, scale, scale)
    inst.place(loc, yaw)
    for mat_base, col in (colors or {}).items():
        inst.color(mat_base, col)
    return inst


def attach(child_root, parent, loc=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0)):
    """Parent with an explicit LOCAL transform (zero = the runtime attachment contract)."""
    child_root.parent = parent
    child_root.matrix_parent_inverse.identity()
    child_root.location = Vector(loc)
    child_root.rotation_mode = 'XYZ'
    child_root.rotation_euler = rot
    bpy.context.view_layer.update()
    return child_root
