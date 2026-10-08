"""Design-system colour tokens shared with src/ui/styles/tokens.css (sRGB hex).

Material NAMES are a runtime contract: the game recolours meshes by material name
(see docs/ASSET_SPEC.md). Always create materials through `mat(name, color_key)`.
"""
import bpy

HEX = {
    # brand / ui
    'gram_cyan': '#3EE6D4', 'gram_cyan_deep': '#12B5A6', 'pin_coral': '#FF4D5E',
    'ink': '#151821', 'cream': '#FFF6E8', 'sun': '#FFC46B',
    # vehicle paints
    'taxi_pink': '#F2559A', 'taxi_green': '#34B04A', 'taxi_yellow': '#F7C928',
    'taxi_blue': '#2F6FD6', 'taxi_orange': '#FF8A2A', 'taxi_red': '#E23C3C',
    'tuktuk_blue': '#2C56B8', 'canopy_black': '#2A2F3A', 'van_white': '#F3F0E8',
    'bus_red': '#D8343A', 'bus_cream': '#F1E6CF',
    'car_silver': '#C9CDD3', 'car_black': '#2A2C31', 'car_white': '#F2F2F0',
    'car_beige': '#D9C7A5', 'car_navy': '#2B3A5C', 'car_maroon': '#7A2A35',
    # generic materials
    'glass': '#2B3A48', 'glass_light': '#9CC9E0', 'tire': '#25272B', 'chrome': '#D7DCE2',
    'steel': '#9AA3AD', 'metal_dark': '#3B3F46', 'seat_black': '#1F2125', 'plastic_gray': '#5B6068',
    'light_head': '#FFF3C9', 'light_tail': '#FF2B2B', 'light_amber': '#FFAA2B',
    'plate_white': '#F5F3EC', 'plate_yellow': '#F6D23A',
    # environment
    'asphalt': '#6E6762', 'lane_white': '#F4F1E8', 'lane_yellow': '#F2C230',
    'curb_red': '#D9473E', 'curb_white': '#F3EEE3', 'sidewalk': '#CDBFAE', 'concrete': '#B9B2A8',
    'wall_cream': '#EED9B2', 'wall_salmon': '#F2B8A0', 'wall_mint': '#9FD3C7', 'wall_lemon': '#F4E27A',
    'wall_powder': '#C9D6E8', 'wall_pink': '#E7C1D8', 'wall_white': '#F4F0E8',
    'trim_white': '#FFFFFF', 'wood': '#8C5A3C', 'wood_light': '#C08A5B', 'roof_terracotta': '#C8573E',
    'shutter': '#A9B0B6', 'awning_red': '#E24B3B', 'awning_green': '#3E9D5A', 'awning_blue': '#3F7FD0',
    'leaf': '#4FA33F', 'leaf_dark': '#2F7A35', 'bougainvillea': '#EC4F9C', 'banana': '#6DBB3C',
    'trunk': '#7A5A40', 'soil': '#6B4A35', 'pot_terracotta': '#C76B45',
    'temple_gold': '#E8B640', 'temple_red': '#C33A2E', 'temple_white': '#F7F2E6',
    'sign_blue': '#2457A6', 'sign_green': '#1F8A4C', 'neon_pink': '#FF4FA3', 'neon_cyan': '#3EE6D4',
    'neon_yellow': '#FFE14D', 'neon_red': '#FF3B3B',
    # characters
    'skin_1': '#F1C9A5', 'skin_2': '#D9A47A', 'skin_3': '#B9805A', 'skin_4': '#8D5A3B',
    'hair_black': '#1E1B1A', 'hair_brown': '#5A3A28', 'cloth_white': '#F3F1EC', 'cloth_blue': '#3C6FD1',
    'cloth_orange': '#FF8A2A', 'cloth_green': '#3E9D5A', 'cloth_red': '#E24B3B', 'cloth_khaki': '#B9A57C',
    'denim': '#3A4F78', 'shoe_dark': '#2A2A2E', 'glove_black': '#1D1F24', 'visor_smoke': '#2F3640',
    'poncho_yellow': '#F7D33A', 'poncho_clear': '#CFE8F2',
}


def hex_to_linear(hex_str):
    h = hex_str.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(srgb[0]), lin(srgb[1]), lin(srgb[2]), 1.0)


def mat(name, color_key, roughness=0.55, metallic=0.0, emission=0.0, alpha=1.0):
    """Get-or-create a Principled material. `name` is the runtime contract name.

    color_key is a key of HEX or a raw '#RRGGBB' string.
    """
    m = bpy.data.materials.get(name)
    if m is not None:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    color = hex_to_linear(HEX.get(color_key, color_key))
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission > 0:
        bsdf.inputs['Emission Color'].default_value = color
        bsdf.inputs['Emission Strength'].default_value = emission
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.diffuse_color = color
    return m
