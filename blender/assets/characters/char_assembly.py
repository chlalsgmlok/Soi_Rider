"""Assembly QA for the characters group: attachments parented to char_body with ZERO offset (runtime contract),
plus SEATED test poses that rotate thighs / shins / arms to prove every joint pivot.

Characters: rider (helmet_full + outfit_vest), passenger (hair_bun + outfit_poncho, poncho morph `seated` = 1 when
seated), pedestrian (hat_cap). Seated scene: rider + passenger on bike_scooter (seat_rider / seat_pillion empties,
if that GLB exists) and a pedestrian on prop_stool. Nothing is exported; renders only:
  blender/previews/char_assembly.png           standing lineup (front 3/4)
  blender/previews/char_assembly__seated.png   seated test (side 3/4)
  blender/previews/char_assembly__back.png     seated test from behind-left (pivots / poncho drape)
  blender/previews/char_assembly__diorama.png  everything from a high 3/4 game-like camera
Run (after char_body / hair / helmets / outfits are built):
  node blender/run-blender.mjs blender/assets/characters/char_assembly.py
"""
import os
import sys
import math
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import bpy
from mathutils import Vector
from lib.bootstrap import start
from lib.palette import hex_to_linear, HEX
from lib.characters_attach import import_glb, base, attach
from lib.characters_preview import render, hierarchy
from lib.characters_pose import RIDER, PILLION, STOOL, WAVE, apply_pose

ctx = start()
MODELS = ctx.models_dir


def model(name):
    return os.path.join(MODELS, name + '.glb')


def recolor(objs, mat_base, color_key):
    col = hex_to_linear(HEX.get(color_key, color_key))
    for o in objs:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            m = slot.material
            if m is not None and base(m.name) == mat_base and m.use_nodes:
                m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = col


def character(head_items, torso_items, colors):
    """Import a fresh char_body + attachments; returns (hips, {node: obj}, [all objects])."""
    new, _ = import_glb(model('char_body'))
    nodes = {base(o.name): o for o in new}
    objs = list(new)
    for socket, items in (('head', head_items), ('torso', torso_items)):
        for item in items:
            part_new, roots = import_glb(model(item))
            for r in roots:
                attach(r, nodes[socket])
            nodes[item] = roots[0]
            objs += part_new
    for mat_name, key in colors.items():
        recolor(objs, mat_name, key)
    for o in objs:
        o.rotation_mode = 'XYZ'
    return nodes['hips'], nodes, objs


def place(hips, loc, yaw_deg=0.0):
    hips.location = Vector(loc)
    hips.rotation_euler = (0, 0, math.radians(yaw_deg))
    bpy.context.view_layer.update()


def set_morph(obj, key, value):
    sk = obj.data.shape_keys if obj.type == 'MESH' else None
    if sk and key in sk.key_blocks:
        sk.key_blocks[key].value = value
        return True
    return False


def world(obj):
    bpy.context.view_layer.update()
    return obj.matrix_world.translation.copy()


def only(objs):
    keep = set(objs)
    for o in bpy.context.scene.objects:
        o.hide_render = o not in keep and o.type == 'MESH'


RIDER_KIT = (['helmet_full'], ['outfit_vest'], {'Shirt': 'cloth_white', 'Pants': 'denim', 'Skin': 'skin_3',
                                                'Hands': 'glove_black', 'Helmet_Paint': 'taxi_red'})
PASS_KIT = (['hair_bun'], ['outfit_poncho'], {'Shirt': 'cloth_red', 'Pants': 'ink', 'Skin': 'skin_1',
                                               'Hands': 'skin_1'})
PED_KIT = (['hat_cap'], [], {'Shirt': 'cloth_white', 'Pants': 'cloth_khaki', 'Skin': 'skin_2', 'Hands': 'skin_2'})

meshes = lambda objs: [o for o in objs if o.type == 'MESH']  # noqa: E731


def scene_standing():
    standing = []
    for i, kit in enumerate((RIDER_KIT, PASS_KIT, PED_KIT)):
        hips, nodes, objs = character(*kit)
        place(hips, (-0.75 + 0.75 * i, 0.0, hips.location.z))
        if i == 2:
            apply_pose(nodes, WAVE, mirror=False)
        standing += objs
    return standing


def scene_seated(seat_y=4.0):
    seated = []
    if os.path.exists(model('bike_scooter')):
        bike_new, bike_roots = import_glb(model('bike_scooter'))
        bike_roots[0].location = (0.0, seat_y, 0.0)
        seated += bike_new
        bnodes = {base(o.name): o for o in bike_new}
        seat_r, seat_p = world(bnodes['seat_rider']), world(bnodes['seat_pillion'])
    else:
        print('[assembly] bike_scooter.glb missing -> box seats')
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, seat_y + 0.35, 0.44))
        bench = bpy.context.active_object
        bench.scale = (0.3, 1.1, 0.88)
        seated.append(bench)
        seat_r, seat_p = Vector((0, seat_y + 0.14, 0.88)), Vector((0, seat_y + 0.56, 0.89))

    hips, nodes, objs = character(*RIDER_KIT)
    place(hips, seat_r + Vector((0, 0, 0.04)))
    apply_pose(nodes, RIDER)
    seated += objs

    hips, nodes, objs = character(*PASS_KIT)
    place(hips, seat_p + Vector((0, 0, 0.05)))
    apply_pose(nodes, PILLION)
    print(f"[assembly] poncho seated morph: {set_morph(nodes['outfit_poncho'], 'seated', 1.0)}")
    seated += objs

    stool_pos = Vector((1.25, seat_y + 0.1, 0.0))
    if os.path.exists(model('prop_stool')):
        st_new, st_roots = import_glb(model('prop_stool'))
        st_roots[0].location = stool_pos
        seated += st_new
    hips, nodes, objs = character(*PED_KIT)
    place(hips, stool_pos + Vector((0, 0, 0.44 + 0.155)), yaw_deg=-20)
    apply_pose(nodes, STOOL)
    seated += objs
    return seated


def poke_through(hair, helmet, tol=0.002):
    """Hair vertices that stick OUT of the helmet's outer surface (both meshes are head-joint relative).
    Ray from the head centre through each vertex: 1st hit = liner, 2nd hit = outer shell. No hit = uncovered
    region (face opening / below the rim) which is allowed."""
    from mathutils.bvhtree import BVHTree
    hm = helmet.data
    bvh = BVHTree.FromPolygons([v.co for v in hm.vertices], [p.vertices[:] for p in hm.polygons])
    c = R_HEAD_C
    bad = 0
    for v in hair.data.vertices:
        d = v.co - c
        dist = d.length
        d.normalize()
        hit, _n, _i, t1 = bvh.ray_cast(c, d)
        if hit is None or t1 > dist:
            continue
        hit2, _n, _i, t2 = bvh.ray_cast(hit + d * 0.001, d)
        outer = t1 + 0.001 + t2 if hit2 is not None else t1
        if dist > outer + tol:
            bad += 1
    return bad


def scene_fit(y=-3.0):
    """Helmet-over-hair fit: numeric poke-through table + a close-up of four combos."""
    helmets = ['helmet_open', 'helmet_full', 'helmet_half', 'helmet_cat']
    hairs = ['hair_short', 'hair_long', 'hair_bun']
    probe = {}
    for n in helmets + hairs:
        new, roots = import_glb(model(n))
        probe[n] = roots[0]
    for hm in helmets:
        row = ', '.join(f'{hr}={poke_through(probe[hr], probe[hm])}' for hr in hairs)
        print(f'[fit] {hm}: hair verts outside the shell -> {row}')
    for o in probe.values():
        bpy.data.objects.remove(o, do_unlink=True)
    combos = [('helmet_open', 'hair_short'), ('helmet_full', 'hair_long'), ('helmet_half', 'hair_bun'),
              ('helmet_cat', 'hair_long')]
    objs = []
    for i, (hm, hr) in enumerate(combos):
        hips, nodes, o = character([hr, hm], [], {'Skin': ['skin_1', 'skin_2', 'skin_3', 'skin_4'][i]})
        place(hips, (-0.75 + 0.5 * i, y, hips.location.z), yaw_deg=[-25, 30, 150, -60][i])
        objs += [x for x in o if base(x.name) in ('head', 'torso', hm, hr)]
    return objs


R_HEAD_C = None


def main():
    global R_HEAD_C
    from lib import characters_rig as R
    R_HEAD_C = R.HEAD_C - R.HEAD
    fit_only = '--fit' in ctx.flags
    fit = scene_fit()
    bpy.context.view_layer.update()
    only(fit)
    render(ctx, 'char_assembly__helmet_fit', objs=meshes(fit), res=(1200, 420), elev=10, azim=0, lens=70)
    if fit_only:
        return
    standing = scene_standing()
    seated = scene_seated()
    bpy.context.view_layer.update()
    for o in standing + seated:
        if o.type == 'MESH' and base(o.name) in ('hips', 'foot_L', 'hand_L', 'head'):
            print(f'[assembly] {o.name:16s} world={tuple(round(v, 3) for v in o.matrix_world.translation)}')
    only(standing)
    render(ctx, 'char_assembly', objs=meshes(standing), res=(1200, 700), elev=12, azim=-28, lens=60)
    only(seated)
    render(ctx, 'char_assembly__seated', objs=meshes(seated), res=(1200, 700), elev=14, azim=-62, lens=60)
    render(ctx, 'char_assembly__back', objs=meshes(seated), res=(1200, 700), elev=26, azim=140, lens=60)
    only(standing + seated)
    render(ctx, 'char_assembly__diorama', objs=meshes(standing + seated), res=(1000, 750), elev=42, azim=-32,
           lens=55)


main()
print('[char_assembly] OK')