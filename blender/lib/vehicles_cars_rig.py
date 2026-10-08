"""vehicles_cars kit: shared materials, modelled text, node hierarchy, export + QA previews.

Hierarchy written to the GLB (names are the runtime contract, docs/ASSET_SPEC.md):
  <asset> (empty, origin = ground centre)
    body                 static shell + details
      mirror_L/mirror_R  pivot at hinge (rotate about Z to fold)
      head_lights        Light_Head lenses
      brake_lights       Light_Brake lenses
      (taxi_sign ...)    extra attachments
    wheel_FL/FR/RL/RR    pivot at axle centre
"""
import bmesh
import bpy
from mathutils import Matrix, Vector
from .palette import mat, HEX
from .shapes import empty, set_parent, tri_count
from .export import export_glb
from .preview import render_preview
from .vehicles_cars_mesh import Mats, finish, prune_slots, rot_matrix


def car_mats(paint, paint2, plate='plate_white', trim='canopy_black', extra=()):
    entries = [
        ('paint', mat('Paint', paint, roughness=0.36)),
        ('paint2', mat('Paint2', paint2, roughness=0.36)),
        ('trim', mat('Trim', trim, roughness=0.62)),
        ('glass', mat('Glass', 'glass', roughness=0.08)),
        ('tire', mat('Tire', 'tire', roughness=0.85)),
        ('chrome', mat('Chrome', 'chrome', roughness=0.24, metallic=0.6)),
        ('head', mat('Light_Head', 'light_head', roughness=0.2, emission=0.8)),
        ('tail', mat('Light_Tail', 'light_tail', roughness=0.25, emission=0.35)),
        ('brake', mat('Light_Brake', 'bus_red', roughness=0.3)),
        ('plate', mat('Plate', plate, roughness=0.5)),
        ('amber', mat('Light_Amber', 'light_amber', roughness=0.25, emission=0.25)),
        ('plate_text', mat('Plate_Text', 'ink', roughness=0.6)),
    ]
    entries += [(k, m) for k, m in extra]
    return Mats(entries)


def text_obj(M, name, txt, size, loc, rot, mat_key, bold=0.0):
    """Flat modelled text (Blender's built-in font), facing local +Z before `rot`."""
    cu = bpy.data.curves.new(name + '_curve', 'FONT')
    cu.body = txt
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.resolution_u = 2
    cu.offset = bold
    tmp = bpy.data.objects.new(name + '_tmp', cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp, do_unlink=True)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    m = Matrix.Translation(Vector(loc)) @ rot_matrix(rot).to_4x4()
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    for f in bm.faces:
        f.material_index = M[mat_key]
    return M.obj(name, bm)


def assemble(ctx, name, body, wheels, attachments, max_tris=3500):
    root = empty(name)
    set_parent(body, root)
    for w in wheels:
        set_parent(w, root)
    for a in attachments:
        set_parent(a, body)
    parts = [body] + list(wheels) + list(attachments)
    for o in parts:
        prune_slots(o)
    for o in parts:
        print(f'[{name}] node {o.name:13s} tris={tri_count([o]):5d} mats={[m.name for m in o.data.materials]}')
    path = export_glb(ctx, name, [root], max_tris=max_tris)
    return root, path


def finish_all(objs, sharp_deg=48.0):
    for o in objs:
        finish(o, sharp_deg)


def recolor(name, hex_or_key):
    m = bpy.data.materials.get(name)
    if m is None:
        return
    from .palette import hex_to_linear
    col = hex_to_linear(HEX.get(hex_or_key, hex_or_key))
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = col
    m.diffuse_color = col


def previews(ctx, name, variants=()):
    """Front 3/4, rear 3/4 (the view the rider sees most) and optional recoloured variants."""
    render_preview(ctx, name)
    render_preview(ctx, name + '_rear', view=(-0.95, 1.25, 0.95))
    for suffix, colors in variants:
        for mname, key in colors.items():
            recolor(mname, key)
        render_preview(ctx, f'{name}_{suffix}', view=(-1.1, -1.0, 0.9))
