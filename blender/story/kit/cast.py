"""Story characters: the game's char_body with its head / torso attachments (zero-offset parenting, the runtime
contract), posed by rotating the joint objects. Signs (Blender eulers, XYZ, model faces -Y, model LEFT = +X):
torso/head +x lean forward; thigh -x swings forward; shin +x bends the knee; arm -x reaches forward;
arm_L -y raises the arm sideways (mirror the sign for _R); arm z turns a forward-pointing arm (-z = inwards for _L).
"""
import math
import bpy
from mathutils import Vector
from story.kit.assets import load, attach
from story.kit.stage import smat

STAND_HIPS = 0.92
SLEEVES = {'sleeve_upper_L': 'arm_L', 'sleeve_upper_R': 'arm_R',
           'sleeve_lower_L': 'forearm_L', 'sleeve_lower_R': 'forearm_R'}

# the hero (NONG) everywhere: mockup-03 look-dev rider (src/engine/lookdev/lookdev-scene.ts) on the mint Kitti 125
HERO_LOOK = {'Skin': 'skin_2', 'Hands': 'skin_2', 'Shirt': '#f3f1ec', 'Pants': 'denim', 'Shoes': 'shoe_dark',
             'Hair': 'hair_black', 'Helmet_Paint': '#f2f2f0'}
HERO_BIKE = {'Paint': '#7fe0b8'}
SPARE_HELMET = ('helmet_half', '#f3eee2')   # src/player/rig/passenger.ts: the helmet a win rider hands over


class Person:
    def __init__(self, body, items):
        self.body = body
        self.items = items
        self.nodes = dict(body.nodes)
        self.hips = body.node('hips')
        self.yaw = 0.0
        self.objs = list(body.objs)
        for it in items.values():
            self.objs += it.objs

    def mats(self, mat_base):
        out = list(self.body.materials(mat_base))
        for it in self.items.values():
            out += [m for m in it.materials(mat_base) if m not in out]
        return out

    def color(self, mat_base, color):
        self.body.color(mat_base, color)
        for it in self.items.values():
            it.color(mat_base, color)
        return self

    def pose(self, rot, mirror=False):
        full = dict(rot)
        if mirror:
            for k, (x, y, z) in rot.items():
                if k.endswith('_L'):
                    full.setdefault(k[:-2] + '_R', (x, -y, -z))
        for k, (x, y, z) in full.items():
            o = self.nodes.get(k)
            if o is None:
                continue
            o.rotation_mode = 'XYZ'
            o.rotation_euler = (x, y, self.yaw + z) if k == 'hips' else (x, y, z)
        bpy.context.view_layer.update()
        return self

    def place(self, loc, yaw=0.0):
        self.yaw = math.radians(yaw)
        self.hips.location = Vector(loc)
        r = self.hips.rotation_euler
        self.hips.rotation_euler = (r.x, r.y, self.yaw)
        bpy.context.view_layer.update()
        return self

    def stand(self, x, y, ground=0.0, yaw=0.0):
        return self.place((x, y, ground + STAND_HIPS), yaw)

    def sit(self, seat_world, yaw=0.0, lift=0.045):
        return self.place(Vector(seat_world) + Vector((0, 0, lift)), yaw)

    def morph(self, item, key, value):
        for o in self.items[item].meshes():
            sk = o.data.shape_keys
            if sk and key in sk.key_blocks:
                sk.key_blocks[key].value = value
        return self

    def hold(self, inst_root, side='R', loc=(0, 0, 0), rot=(0, 0, 0)):
        """Parent a prop to hand_<side> with a local offset (metres / radians, hand space)."""
        return attach(inst_root, self.nodes['hand_' + side], loc, rot)

    def thumb_up(self, side='R'):
        """Mitten hands have no free thumb: add a small skin-coloured thumb pointing up out of the fist."""
        hand = self.nodes['hand_' + side]
        skin = self.body.materials('Hands')
        mat = skin[0] if skin else smat('St_Thumb', 'skin_2')
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.03)
        th = bpy.context.active_object
        th.name = 'thumb_' + side
        th.scale = (0.8, 1.9, 0.8)  # long axis = hand-local -Y: points up when the forearm reaches forward
        th.data.materials.append(mat)
        bpy.ops.object.shade_smooth()
        attach(th, hand, (0.0, -0.06, -0.05), (0, 0, 0))
        return th


def person(head=(), torso=(), colors=None):
    """char_body + attachments. head/torso: GLB names, or (name, {mat: color}) tuples for per-item colours."""
    body = load('char_body')
    items = {}
    for socket, names in (('head', head), ('torso', torso)):
        for entry in names:
            name, cols = entry if isinstance(entry, tuple) else (entry, {})
            it = load(name, colors=cols)
            attach(it.root, body.node(socket))
            items[name] = it
            if name in ('outfit_hood', 'outfit_jacket'):
                for sleeve, joint in SLEEVES.items():
                    if sleeve in it.nodes:
                        attach(it.nodes[sleeve], body.node(joint))
    p = Person(body, items)
    for mat_base, col in (colors or {}).items():
        p.color(mat_base, col)
    return p


def hero():
    """NONG: white open-face helmet, the orange win (motorcycle-taxi) vest over a white tee, denim — the vest keeps
    him readable in warm light, where a coral tee melted into the skin tone."""
    head = [('helmet_open', {'Helmet_Paint': HERO_LOOK['Helmet_Paint']})]
    torso = [('outfit_vest', {'Outfit_Paint': '#ff8a2a'})]
    return person(head=head, torso=torso, colors={k: v for k, v in HERO_LOOK.items() if k != 'Helmet_Paint'})


def hero_bike(loc=(0, 0, 0), yaw=0.0):
    """NONG's mint Kitti 125 scooter."""
    return load('bike_scooter', loc, yaw, colors=HERO_BIKE)
