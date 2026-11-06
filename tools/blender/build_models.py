# Builds six "Moonlit Toybox" models in Blender and exports each as a GLB.
# Usage: bvenv/bin/python build_models.py <out_dir>
# Conventions: metres; Blender Z up, model faces Blender -Y (= +Z in three.js after the glTF Y-up export).
# Material names end in a kind tag the game reads: __std, __metal, __gloss, __glass, __glow<k>.
import bpy, bmesh, math, sys, os, json
from mathutils import Vector, Euler

OUT = sys.argv[-1]
os.makedirs(OUT, exist_ok=True)

def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexcol(h):
    h = h.lstrip('#')
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)

_mats = {}
def mat(hexv, kind='std', k=1.0):
    name = f"{hexv.lstrip('#')}__{kind}{k if kind == 'glow' else ''}"
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    col = hexcol(hexv)
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = {'std': 0.8, 'metal': 0.4, 'gloss': 0.2, 'glass': 0.1}.get(kind, 0.8)
    b.inputs['Metallic'].default_value = 0.5 if kind == 'metal' else 0.0
    if kind == 'glow':
        b.inputs['Emission Color'].default_value = col
        b.inputs['Emission Strength'].default_value = k
    if kind == 'glass':
        b.inputs['Alpha'].default_value = 0.35
    _mats[name] = m
    return m

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()

def finish(o, m, smooth=True, bevel=0.0, seg=2, sub=0, angle=None):
    o.data.materials.clear(); o.data.materials.append(m)
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = seg
        bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(angle or 30)
    if sub:
        s = o.modifiers.new('sub', 'SUBSURF'); s.levels = sub; s.render_levels = sub
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o

def _place(o, loc, rot, scale):
    o.location = loc
    if rot: o.rotation_euler = Euler(rot)
    if scale is not None:
        o.scale = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
    return o

def sphere(r, loc, m, scale=None, rot=None, seg=24, rings=14, sub=0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=rings)
    o = _place(bpy.context.object, loc, rot, scale); return finish(o, m, sub=sub)

def cyl(r, depth, loc, m, rot=None, scale=None, verts=24, bevel=0.0, r2=None, smooth=True, seg=2):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts)
    else: bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts)
    o = _place(bpy.context.object, loc, rot, scale)
    finish(o, m, smooth=smooth, bevel=bevel, seg=seg)
    return o

def box(size, loc, m, rot=None, bevel=0.05, seg=3, sub=0, angle=None):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = _place(bpy.context.object, loc, rot, size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, m, bevel=bevel, seg=seg, sub=sub, angle=angle)

def torus(R, r, loc, m, rot=None, major=48, minor=12, scale=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=major, minor_segments=minor)
    o = _place(bpy.context.object, loc, rot, scale); return finish(o, m)

def lathe(profile, m, segs=48, sub=1, name='lathe'):
    """Spin a (radius, z) profile around Z."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + edges, axis=(0, 0, 1), cent=(0, 0, 0), steps=segs, angle=math.tau, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return finish(o, m, sub=sub)

def skin_body(points, edges, radii, m, sub=2, name='skin'):
    """An organic limb/torso network: vertices + edges + per-vertex radii through the Skin modifier."""
    me = bpy.data.meshes.new(name); me.from_pydata(points, edges, []); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    sk = o.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True
    for i, r in enumerate(radii):
        o.data.skin_vertices[0].data[i].radius = r if isinstance(r, (tuple, list)) else (r, r)
    o.data.skin_vertices[0].data[0].use_root = True
    s = o.modifiers.new('sub', 'SUBSURF'); s.levels = sub; s.render_levels = sub
    o.data.materials.append(m)
    return o

def arc_tube(radius, thick, a0, a1, loc, m, rot=(0, 0, 0), steps=10):
    """A curved tube (smiles, horns, tails) from a bezier arc."""
    cu = bpy.data.curves.new('arc', 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(steps)
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        sp.points[i].co = (math.cos(a) * radius, 0, math.sin(a) * radius, 1)
    cu.bevel_depth = thick; cu.bevel_resolution = 3; cu.use_fill_caps = True
    o = bpy.data.objects.new('arc', cu); bpy.context.collection.objects.link(o)
    o.location = loc; o.rotation_euler = Euler(rot)
    o.data.materials.append(m)
    return o

BUDGET = {'saucer': 7000, 'alien': 2500, 'cow': 2500, 'house': 2500, 'tank': 3500, 'civilian': 2500, 'sheep': 2000, 'pig': 2000, 'chicken': 1200}
def tri_count():
    dg = bpy.context.evaluated_depsgraph_get(); t = 0
    for o in bpy.context.scene.objects:
        if o.type in ('MESH', 'CURVE'):
            me = o.evaluated_get(dg).to_mesh(); t += sum(len(p.vertices) - 2 for p in me.polygons); o.evaluated_get(dg).to_mesh_clear()
    return t
def export(name, pivot=None):
    hero = tri_count()
    # bake every object to a plain mesh (modifiers + curves applied)
    bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
    bpy.ops.object.convert(target='MESH')
    # game-ready: decimate every part by the same ratio, never below what keeps small parts round
    ratio = min(1.0, BUDGET[name] / hero)
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH' or len(o.data.polygons) < 60: continue
        dm = o.modifiers.new('dec', 'DECIMATE'); dm.ratio = max(ratio, 60 / len(o.data.polygons))
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='dec')
    # one mesh per model (one draw per material); a pivot group (e.g. a tank turret) is its own mesh under an empty
    def join(objs, active):
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = active; bpy.ops.object.join(); return active
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if pivot:
        pname, ploc, pobjs = pivot
        pobjs = [o for o in meshes if o.name in {p.name for p in pobjs if p.name in bpy.data.objects}]
        rest = [o for o in meshes if o not in pobjs]
        join(rest, rest[0]); tur = join(pobjs, pobjs[0])
        emp = bpy.data.objects.new(pname, None); bpy.context.collection.objects.link(emp); emp.location = ploc
        bpy.context.view_layer.update()
        tur.parent = emp; tur.matrix_parent_inverse = emp.matrix_world.inverted()
    else:
        join(meshes, meshes[0])
    bpy.ops.object.select_all(action='SELECT')
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_animations=False)
    STATS[name] = {'hero_tris': hero, 'game_tris': tri_count(), 'kb': round(os.path.getsize(path) / 1024, 1), 'materials': sum(len(o.data.materials) for o in bpy.context.scene.objects if o.type == 'MESH')}
    print(name, STATS[name])

STATS = {}

# ------------------------------------------------------------------ shared: gray alien head
def gray_head(center, s, skin='#bcc4e0'):
    """Pear-shaped head: big cranium, narrow chin, huge glossy almond eyes with two catchlights, small smile."""
    cx, cy, cz = center
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=32, ring_count=20)
    h = bpy.context.object
    for v in h.data.vertices:
        x, y, z = v.co
        t = max(0.0, -z)                       # 0 at the equator, 1 at the chin
        taper = 1 - 0.62 * t ** 1.3
        v.co = Vector((x * 0.82 * taper, y * 0.78 * taper, z * (1.0 if z > 0 else 0.95)))
        if z > 0: v.co.z = z * 0.92
    h.location = (cx, cy, cz); h.scale = (s, s, s)
    finish(h, mat(skin), sub=1)
    eye = mat('#0b0620', 'gloss'); white = mat('#ffffff', 'glow', 1.2)
    for side in (-1, 1):
        ex, ey, ez = cx + 0.33 * side * s, cy - 0.62 * s, cz - 0.05 * s
        sphere(0.3 * s, (ex, ey, ez), eye, scale=(1.0, 0.45, 1.45), rot=(0.25, 0.0, -0.5 * side), seg=24, rings=14)
        sphere(0.075 * s, (ex + 0.06 * side * s, ey - 0.12 * s, ez + 0.18 * s), white, seg=10, rings=6)
        sphere(0.035 * s, (ex - 0.05 * side * s, ey - 0.13 * s, ez - 0.14 * s), white, seg=8, rings=5)
    arc_tube(0.1 * s, 0.018 * s, math.pi * 1.15, math.pi * 1.85, (cx, cy - 0.58 * s, cz - 0.5 * s), mat('#3a2f5a'), rot=(math.pi / 2 - 0.35, 0, 0))

# ------------------------------------------------------------------ 1. saucer
def build_saucer():
    reset()
    hull = [(5.3, 0.0), (5.28, 0.12), (5.0, 0.32), (4.3, 0.58), (3.4, 0.8), (2.6, 0.93), (1.2, 0.99), (0.0, 1.0)]
    lathe(hull, mat('#d9def0', 'gloss'), name='hull')
    under = [(0.0, -1.25), (1.6, -1.18), (3.2, -0.85), (4.6, -0.36), (5.25, -0.06), (5.3, 0.0)]
    lathe(under, mat('#4b3a8f', 'metal'), name='under')
    torus(5.12, 0.3, (0, 0, 0), mat('#a77bff', 'metal'), major=64, minor=14)
    # eight rounded hull panels with a slime vent line each
    for i in range(8):
        a = i / 8 * math.tau + math.pi / 8
        p = (math.cos(a) * 3.75, math.sin(a) * 3.75, 0.72)
        box((0.55, 1.3, 0.12), p, mat('#b8bedc', 'metal'), rot=(0, 0.3, a), bevel=0.05)
        box((0.1, 0.9, 0.05), (math.cos(a) * 3.75, math.sin(a) * 3.75, 0.79), mat('#9cff3f', 'glow', 1.6), rot=(0, 0.3, a), bevel=0.02)
    torus(2.7, 0.11, (0, 0, 0.86), mat('#6a3fe0', 'metal'), major=48, minor=8)
    # running lights: 14 candy bulbs in little sockets
    bulbs = ['#9cff3f', '#ff6fb5', '#ffd23f', '#5fe8ff']
    for i in range(14):
        a = i / 14 * math.tau
        p = (math.cos(a) * 5.5, math.sin(a) * 5.5, 0.05)
        cyl(0.24, 0.16, (p[0], p[1], p[2] - 0.05), mat('#4b3a8f', 'metal'), rot=(0, math.pi / 2, a), verts=12)
        sphere(0.24, p, mat(bulbs[i % 4], 'glow', 2.6), seg=12, rings=8)
    # tractor emitter: housing, ribbed ring, glowing lens
    cyl(1.75, 0.3, (0, 0, -1.32), mat('#6a3fe0', 'metal'), r2=1.35, bevel=0.06)
    torus(1.45, 0.08, (0, 0, -1.48), mat('#a77bff', 'metal'), major=40, minor=8)
    sphere(1.25, (0, 0, -1.47), mat('#9cff3f', 'glow', 2.2), scale=(1, 1, 0.18))
    # pilot seat + Zix + glass dome
    cyl(0.5, 0.45, (0, 0, 1.15), mat('#6a3fe0', 'metal'), r2=0.38, bevel=0.05)
    gray_head((0, 0, 1.95), 0.55)
    sphere(2.3, (0, 0, 0.88), mat('#8ff4ff', 'glass'), scale=(1, 1, 1), seg=40, rings=20)
    # cut the dome sphere to a half: delete verts below its centre
    dome = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context='VERTS')
    bm.to_mesh(dome.data); bm.free()
    # antenna with a slime bobble
    cyl(0.04, 0.9, (0, 0.0, 3.55), mat('#6a3fe0', 'metal'), verts=8)
    sphere(0.16, (0, 0, 4.05), mat('#9cff3f', 'glow', 2.8), seg=12, rings=8)
    export('saucer')

# ------------------------------------------------------------------ 2. gray alien clone
def build_alien():
    reset()
    skin, armour = '#bcc4e0', '#7a3cff'
    # body network: 0 pelvis, 1 chest, 2 neck, legs 3-8, arms 9-14
    P = [(0, 0, 0.95), (0, 0, 1.3), (0, 0, 1.5),
         (-0.13, 0, 0.88), (-0.14, 0, 0.48), (-0.15, -0.02, 0.1),
         (0.13, 0, 0.88), (0.14, 0, 0.48), (0.15, -0.02, 0.1),
         (-0.22, 0, 1.38), (-0.36, 0.02, 1.12), (-0.4, -0.04, 0.86),
         (0.22, 0, 1.38), (0.34, -0.12, 1.16), (0.3, -0.4, 1.06)]
    E = [(0, 1), (1, 2), (0, 3), (3, 4), (4, 5), (0, 6), (6, 7), (7, 8), (1, 9), (9, 10), (10, 11), (1, 12), (12, 13), (13, 14)]
    R = [0.17, 0.15, 0.06, 0.08, 0.065, 0.06, 0.08, 0.065, 0.06, 0.06, 0.05, 0.045, 0.06, 0.05, 0.045]
    skin_body(P, E, R, mat(skin), name='body')
    # armour vest + slime trim + belt
    cyl(0.23, 0.36, (0, 0, 1.18), mat(armour, 'metal'), r2=0.19, bevel=0.06, seg=3)
    torus(0.215, 0.035, (0, 0, 1.03), mat('#9cff3f', 'glow', 1.6), major=32, minor=6)
    for side in (-1, 1):   # shoulder pads
        sphere(0.1, (0.24 * side, 0, 1.38), mat(armour, 'metal'), scale=(1.2, 1.1, 0.75))
        sphere(0.085, (0.15 * side, -0.07, 0.07), mat('#2b1b72', 'gloss'), scale=(1, 1.6, 0.6))   # boots
    for p in ((-0.4, -0.06, 0.82), (0.3, -0.44, 1.04)):
        sphere(0.065, p, mat(skin))   # hands
    # blaster: grip, body, slime tip
    box((0.1, 0.38, 0.12), (0.3, -0.58, 1.08), mat('#2b1b72', 'metal'), bevel=0.03)
    cyl(0.045, 0.12, (0.3, -0.8, 1.08), mat('#a77bff', 'metal'), rot=(math.pi / 2, 0, 0), verts=12)
    sphere(0.06, (0.3, -0.88, 1.08), mat('#9cff3f', 'glow', 2.8), seg=12, rings=8)
    gray_head((0, 0, 2.02), 0.52)
    export('alien')

# ------------------------------------------------------------------ 3. cow
def build_cow():
    reset()
    cow, spot, snout, horn = '#fff8ee', '#2a1f3f', '#ff9fb0', '#ffe6b0'
    box((1.15, 2.1, 1.0), (0, 0.1, 1.2), mat(cow), bevel=0.32, seg=4, sub=1)
    # spots hugging the flanks and back
    for (x, y, z, sy, sz) in [(0.58, -0.2, 1.3, 0.34, 0.26), (-0.58, 0.45, 1.12, 0.4, 0.24), (0.58, 0.65, 1.05, 0.22, 0.2), (-0.58, -0.4, 1.38, 0.2, 0.16)]:
        sphere(1, (x, y, z), mat(spot), scale=(0.06, sy, sz))
    sphere(1, (0.1, 0.3, 1.71), mat(spot), scale=(0.3, 0.38, 0.05))
    # head
    box((0.7, 0.62, 0.66), (0, -1.2, 1.62), mat(cow), bevel=0.22, seg=4, sub=1)
    sphere(1, (0.18, -1.12, 1.9), mat(spot), scale=(0.2, 0.18, 0.05))
    box((0.72, 0.36, 0.42), (0, -1.55, 1.42), mat(snout), bevel=0.15, seg=4, sub=1)
    for side in (-1, 1):
        sphere(0.06, (0.15 * side, -1.73, 1.47), mat(spot), scale=(1, 0.4, 1.3))                  # nostrils
        sphere(0.17, (0.17 * side, -1.48, 1.84), mat('#ffffff'))                                     # googly eye
        sphere(0.085, (0.17 * side + 0.02 * side, -1.62, 1.82), mat('#0b0620', 'gloss'))             # pupil
        sphere(0.025, (0.17 * side + 0.05 * side, -1.69, 1.86), mat('#ffffff', 'glow', 1.2), seg=8, rings=5)
        sphere(1, (0.45 * side, -1.15, 1.78), mat(cow), scale=(0.2, 0.08, 0.1), rot=(0, 0.3 * side, 0))  # ears
        sphere(1, (0.47 * side, -1.19, 1.78), mat(snout), scale=(0.14, 0.04, 0.06), rot=(0, 0.3 * side, 0))
        arc_tube(0.2, 0.05, 0, 1.2, (0.2 * side, -1.15, 1.9), mat(horn), rot=(0, 0, 0 if side > 0 else math.pi))
        for y in (-0.65, 0.8):
            cyl(0.13, 0.72, (0.35 * side, y, 0.46), mat(cow), r2=0.11, bevel=0.04)
            cyl(0.15, 0.16, (0.35 * side, y, 0.08), mat(spot), bevel=0.05)                            # hooves
    # udder, collar + bell, tail
    sphere(0.22, (0, 0.5, 0.66), mat(snout), scale=(1.1, 1, 0.7))
    for dx, dy in ((-0.08, -0.07), (0.08, -0.07), (-0.08, 0.07), (0.08, 0.07)):
        cyl(0.03, 0.1, (dx, 0.5 + dy, 0.5), mat(snout), verts=8)
    torus(0.36, 0.06, (0, -0.95, 1.5), mat('#ff5a4f'), rot=(math.pi / 2 - 0.2, 0, 0), major=32, minor=8, scale=(1.05, 1, 1))
    cyl(0.12, 0.2, (0, -1.13, 1.08), mat('#ffd23f', 'metal'), r2=0.07, bevel=0.03)
    sphere(0.045, (0, -1.13, 0.97), mat('#e09a00', 'metal'), seg=8, rings=6)
    arc_tube(0.5, 0.035, math.pi * 0.15, math.pi * 0.62, (0, 1.6, 0.85), mat(cow), rot=(0, 0, -math.pi / 2))
    sphere(0.09, (0, 1.38, 0.62), mat(spot), scale=(1, 1, 1.5))
    export('cow')

def build_sheep():
    reset()
    wool, face = '#f5f0ff', '#3a2f4a'
    for (x, y, z, r) in [(0, 0.3, 1.15, 0.7), (0.32, -0.15, 1.2, 0.55), (-0.32, -0.15, 1.2, 0.55), (0.3, 0.6, 1.1, 0.5), (-0.3, 0.6, 1.1, 0.5), (0, -0.45, 1.25, 0.55), (0, 0.85, 1.15, 0.5), (0, 0.2, 1.55, 0.55)]:
        sphere(r, (x, y, z), mat(wool), seg=16, rings=10)
    box((0.42, 0.5, 0.5), (0, -0.95, 1.35), mat(face), bevel=0.16, seg=3)
    sphere(0.32, (0, -0.85, 1.62), mat(wool), seg=12, rings=8)
    for side in (-1, 1):
        sphere(0.11, (0.13 * side, -1.17, 1.45), mat('#ffffff'), seg=10, rings=6); sphere(0.055, (0.14 * side, -1.24, 1.45), mat('#0b0620', 'gloss'), seg=8, rings=5)
        sphere(1, (0.3 * side, -0.9, 1.45), mat(face), scale=(0.16, 0.06, 0.08), rot=(0, 0.4 * side, 0))
        for y in (-0.35, 0.5): cyl(0.08, 0.7, (0.25 * side, y, 0.38), mat(face), r2=0.07)
    export('sheep')

def build_pig():
    reset()
    pink, dark = '#ff9fbf', '#c86a8a'
    sphere(1, (0, 0, 0.95), mat(pink), scale=(0.62, 0.95, 0.58), seg=24, rings=14)
    box((0.62, 0.5, 0.55), (0, -0.95, 1.05), mat(pink), bevel=0.2, seg=4, sub=1)
    cyl(0.24, 0.16, (0, -1.27, 1.0), mat('#ff7fa6'), rot=(math.pi / 2, 0, 0), bevel=0.04)
    for side in (-1, 1):
        sphere(0.05, (0.08 * side, -1.36, 1.02), mat(dark), seg=8, rings=5)
        sphere(0.11, (0.17 * side, -1.15, 1.25), mat('#ffffff'), seg=10, rings=6); sphere(0.055, (0.18 * side, -1.24, 1.25), mat('#0b0620', 'gloss'), seg=8, rings=5)
        box((0.22, 0.06, 0.26), (0.24 * side, -0.85, 1.4), mat(dark), rot=(0.5, 0, 0.4 * side), bevel=0.02)
        for y in (-0.5, 0.5): cyl(0.13, 0.5, (0.32 * side, y, 0.25), mat(pink), r2=0.11, bevel=0.03)
    arc_tube(0.15, 0.035, 0, math.pi * 1.6, (0, 0.98, 1.1), mat(dark), rot=(math.pi / 2, 0, 0))
    export('pig')

def build_chicken():
    reset()
    white, red, yellow = '#fffaf0', '#ff3b3b', '#ffb020'
    sphere(1, (0, 0.05, 0.62), mat(white), scale=(0.32, 0.42, 0.34), seg=18, rings=12)
    sphere(0.22, (0, -0.3, 0.98), mat(white), seg=14, rings=10)
    cone(0.07, 0.18, (0, -0.52, 0.96), mat(yellow), rot=(math.pi / 2, 0, 0)) if False else cyl(0.08, 0.18, (0, -0.52, 0.96), mat(yellow), r2=0.0, rot=(math.pi / 2, 0, 0), verts=8)
    for i, dz in enumerate((0, 0.07, 0.02)): sphere(0.07, (0, -0.3 + (i - 1) * 0.08, 1.2 + dz), mat(red), seg=8, rings=5)
    sphere(0.06, (0, -0.47, 0.86), mat(red), scale=(0.7, 0.7, 1.3), seg=8, rings=5)
    for side in (-1, 1):
        sphere(0.05, (0.12 * side, -0.42, 1.03), mat('#0b0620', 'gloss'), seg=8, rings=5)
        sphere(1, (0.3 * side, 0.08, 0.66), mat(white), scale=(0.08, 0.3, 0.2))
        cyl(0.025, 0.32, (0.1 * side, 0.02, 0.16), mat(yellow), verts=6)
    sphere(1, (0, 0.42, 0.85), mat(white), scale=(0.12, 0.18, 0.22), rot=(-0.5, 0, 0))
    export('chicken')

# ------------------------------------------------------------------ 4. house
def build_house():
    reset()
    w, d, h = 7.0, 6.0, 3.6
    wall, roof, trim = '#ffe3b8', '#e0533d', '#fff6e0'
    box((w + 0.3, d + 0.3, 0.4), (0, 0, 0.2), mat('#a89ac8'), bevel=0.06)            # plinth
    box((w, d, h), (0, 0, 0.4 + h / 2), mat(wall), bevel=0.08)
    top = 0.4 + h
    # gable roof: two thick slabs meeting at the ridge, overhanging every side
    rh, over = 2.3, 0.6
    slope = math.atan2(rh, w / 2); L = math.hypot(w / 2, rh) + over / math.cos(slope)
    for side in (-1, 1):
        D = Vector((side * math.cos(slope), 0, -math.sin(slope)))      # down the slope
        N = Vector((side * math.sin(slope), 0, math.cos(slope)))       # out of the roof
        R = Vector((0, 0, top + rh))
        c = R + D * (L / 2) + N * 0.12
        box((L, d + 2 * over, 0.28), tuple(c), mat(roof), rot=(0, side * slope, 0), bevel=0.1, seg=3)
        for r in range(1, 4):   # tile rows
            c = R + D * (L * r / 4) + N * 0.28
            box((0.12, d + 2 * over - 0.1, 0.07), tuple(c), mat('#c43a30'), rot=(0, side * slope, 0), bevel=0.03)
    box((0.3, d + 2 * over + 0.1, 0.3), (0, 0, top + rh + 0.03), mat('#c43a30'), bevel=0.1)         # ridge cap
    # gable ends filled with wall colour
    for y in (-d / 2, d / 2):
        me = bpy.data.meshes.new('gable'); bm = bmesh.new()
        vs = [bm.verts.new(p) for p in ((-w / 2, y, top), (w / 2, y, top), (0, y, top + rh - 0.05))]
        f = bm.faces.new(vs); bmesh.ops.solidify(bm, geom=[f], thickness=0.2); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('gable', me); bpy.context.collection.objects.link(o); finish(o, mat(wall), smooth=False)
        sphere(0.35, (0, y - 0.1 * (1 if y > 0 else -1) * -1, top + 0.9), mat(trim), scale=(1, 0.2, 1))   # round attic window frame
        sphere(0.26, (0, y + (0.13 if y > 0 else -0.13), top + 0.9), mat('#ffcf5c', 'glow', 1.3), scale=(1, 0.2, 1))
    # chimney
    box((0.8, 0.8, 2.2), (w * 0.26, d * 0.2, top + 1.6), mat('#8a5a4a'), bevel=0.06)
    box((1.0, 1.0, 0.25), (w * 0.26, d * 0.2, top + 2.75), mat('#6e463a'), bevel=0.06)
    # front (−Y): door with frame, canopy, step, knob, lamp
    fy = -d / 2
    box((1.5, 0.16, 2.45), (0, fy - 0.04, 0.4 + 1.2), mat(trim), bevel=0.05)
    box((1.1, 0.18, 2.1), (0, fy - 0.08, 0.4 + 1.05), mat('#8a4a2a'), bevel=0.06)
    for zz in (0.75, 1.35): box((0.8, 0.04, 0.45), (0, fy - 0.18, 0.4 + zz), mat('#6e3a20'), bevel=0.03)   # door panels
    sphere(0.09, (0.36, fy - 0.2, 0.4 + 1.0), mat('#ffd23f', 'metal'))
    box((2.0, 0.9, 0.12), (0, fy - 0.45, 0.4 + 2.6), mat(roof), rot=(-0.2, 0, 0), bevel=0.05)            # canopy
    box((1.8, 0.8, 0.2), (0, fy - 0.5, 0.1), mat('#a89ac8'), bevel=0.05)                                  # step
    box((0.2, 0.1, 0.25), (0.95, fy - 0.08, 0.4 + 2.3), mat('#ffcf5c', 'glow', 1.3), bevel=0.03)          # lamp
    # windows: frame, cross mullion, glass, sill; flower boxes + shutters on the front
    import random; rnd = random.Random(7)
    def window(x, y, z, ry, front=False):
        lit = rnd.random() < 0.65
        n = Vector((math.sin(ry), -math.cos(ry), 0))     # outward normal (ry=0 -> -Y)
        def at(off): return (x + n.x * off, y + n.y * off, z)
        box((1.25, 0.12, 1.3), at(0.03), mat(trim), rot=(0, 0, ry), bevel=0.04)
        box((0.95, 0.12, 1.0), at(0.07), mat('#ffcf5c', 'glow', 1.3) if lit else mat('#3a3f6e', 'gloss'), rot=(0, 0, ry), bevel=0.02)
        box((0.07, 0.1, 1.0), at(0.12), mat(trim), rot=(0, 0, ry), bevel=0.0)
        box((0.95, 0.1, 0.07), at(0.12), mat(trim), rot=(0, 0, ry), bevel=0.0)
        box((1.45, 0.3, 0.1), (x + n.x * 0.15, y + n.y * 0.15, z - 0.7), mat(trim), rot=(0, 0, ry), bevel=0.03)
        if front:
            box((1.3, 0.35, 0.3), (x + n.x * 0.28, y + n.y * 0.28, z - 0.92), mat('#8a4a2a'), rot=(0, 0, ry), bevel=0.04)
            for i in range(5):
                c = ['#ff6fb5', '#ffd23f', '#ff5a4f', '#ffffff', '#ff6fb5'][i]
                fx = -0.5 + i * 0.25
                t = Vector((math.cos(ry), math.sin(ry), 0))
                sphere(0.11, (x + t.x * fx + n.x * 0.3, y + t.y * fx + n.y * 0.3, z - 0.72), mat(c), seg=10, rings=6)
            for s in (-1, 1):
                t = Vector((math.cos(ry), math.sin(ry), 0))
                box((0.42, 0.08, 1.3), (x + t.x * s * 0.88 + n.x * 0.04, y + t.y * s * 0.88 + n.y * 0.04, z), mat('#3d7be0'), rot=(0, 0, ry), bevel=0.03)
    wz = 0.4 + h * 0.55
    for sx in (-1, 1):
        window(sx * w * 0.3, -d / 2, wz, 0, front=True)
        window(sx * w * 0.27, d / 2, wz, math.pi)
        window(w / 2, sx * d * 0.22, wz, math.pi / 2)
        window(-w / 2, sx * d * 0.22, wz, -math.pi / 2)
    export('house')

# ------------------------------------------------------------------ 5. tank
def build_tank():
    reset()
    body, light, dark, track, cream = '#77a843', '#8cbf55', '#5e8a34', '#3a3550', '#fff6e0'
    box((2.6, 5.4, 0.9), (0, 0, 0.95), mat(body), bevel=0.28, seg=4)                          # lower hull
    box((2.3, 3.6, 0.5), (0, 0.4, 1.55), mat(light), bevel=0.2, seg=3)                        # deck
    box((2.2, 1.0, 0.6), (0, -2.35, 1.2), mat(body), rot=(-0.55, 0, 0), bevel=0.2, seg=3)     # sloped glacis
    for side in (-1, 1):
        x = side * 1.55
        box((0.8, 6.2, 1.15), (x, 0, 0.62), mat(track), bevel=0.5, seg=6, angle=60)            # track belt
        for i in range(5):
            y = -2.2 + i * 1.1
            cyl(0.42, 0.18, (x + side * 0.36, y, 0.6), mat('#8a85a8', 'metal'), rot=(0, math.pi / 2, 0), bevel=0.05)
            cyl(0.15, 0.22, (x + side * 0.42, y, 0.6), mat(track, 'metal'), rot=(0, math.pi / 2, 0), bevel=0.04)
        box((1.0, 6.0, 0.14), (x, 0, 1.28), mat(dark), bevel=0.05)                               # fender
        sphere(0.17, (side * 0.85, -2.85, 1.25), mat('#ffd23f', 'glow', 2.0), scale=(1, 0.6, 1))   # headlights
        box((0.5, 0.7, 0.4), (side * 0.75, 2.3, 1.55), mat(dark), bevel=0.1)                     # rear boxes
    # turret: squashed dome, mantlet, barrel with muzzle brake, hatch, antenna (exported on its own pivot node)
    before = set(bpy.context.scene.objects)
    sphere(1.35, (0, 0.35, 1.95), mat(body), scale=(1, 1.15, 0.55), seg=32, rings=16)
    box((0.9, 0.5, 0.55), (0, -0.95, 1.95), mat(dark), bevel=0.15)
    cyl(0.17, 3.0, (0, -2.6, 2.0), mat(dark, 'metal'), rot=(math.pi / 2, 0, 0), verts=16)
    cyl(0.27, 0.5, (0, -4.05, 2.0), mat(track, 'metal'), rot=(math.pi / 2, 0, 0), verts=16, bevel=0.06)
    cyl(0.4, 0.22, (0.35, 0.75, 2.62), mat(light), bevel=0.06)
    cyl(0.03, 1.3, (-0.6, 1.2, 3.1), mat(track), verts=6)
    sphere(0.07, (-0.6, 1.2, 3.75), mat('#ff5a4f', 'glow', 2.0), seg=8, rings=6)
    # cream star on the turret top
    me = bpy.data.meshes.new('star'); bm = bmesh.new(); pts = []
    for i in range(10):
        a = i / 10 * math.tau + math.pi / 2; r = 0.55 if i % 2 == 0 else 0.23
        pts.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, 0)))
    f = bm.faces.new(pts); bmesh.ops.solidify(bm, geom=[f], thickness=0.05); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('star', me); bpy.context.collection.objects.link(o)
    o.location = (-0.35, 0.15, 2.68); o.rotation_euler = (0, 0, math.pi); finish(o, mat(cream), smooth=False)
    turret = [x for x in bpy.context.scene.objects if x not in before]
    export('tank', pivot=('Tank_Turret', (0, 0.35, 1.95), turret))

# ------------------------------------------------------------------ 6. civilian (chibi)
def build_civilian():
    reset()
    skinc, shirt, jeans, hair, shoe = '#ffcfa8', '#2fb38a', '#3d5bd6', '#7a4a2a', '#2a1f3f'
    P = [(0, 0, 0.78), (0, 0, 1.02), (0, 0, 1.18),
         (-0.22, 0, 1.12), (-0.3, 0, 0.92), (-0.33, -0.02, 0.74),
         (0.22, 0, 1.12), (0.3, 0, 0.92), (0.33, -0.02, 0.74)]
    E = [(0, 1), (1, 2), (1, 3), (3, 4), (4, 5), (1, 6), (6, 7), (7, 8)]
    R = [(0.24, 0.17), (0.25, 0.18), 0.08, 0.075, 0.065, 0.06, 0.075, 0.065, 0.06]
    skin_body(P, E, R, mat(shirt), name='torso')
    L = [(0, 0, 0.8), (-0.11, 0, 0.72), (-0.12, 0, 0.4), (-0.12, -0.01, 0.12), (0.11, 0, 0.72), (0.12, 0, 0.4), (0.12, -0.01, 0.12)]
    skin_body(L, [(0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6)], [(0.2, 0.15), 0.1, 0.09, 0.085, 0.1, 0.09, 0.085], mat(jeans), name='legs')
    for side in (-1, 1):
        sphere(0.07, (0.34 * side, -0.03, 0.66), mat(skinc))
        sphere(0.11, (0.12 * side, -0.06, 0.07), mat(shoe, 'gloss'), scale=(0.9, 1.5, 0.6))
    cyl(0.07, 0.12, (0, 0, 1.24), mat(skinc))
    hc = (0, 0, 1.62)
    sphere(0.44, hc, mat(skinc), scale=(1, 0.95, 0.98), seg=32, rings=18)
    # hair: a cap over the back/top + a side-swept fringe + bun
    sphere(0.47, (0, 0.05, 1.68), mat(hair), scale=(1, 0.98, 0.95), seg=32, rings=18)
    cap = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(cap.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.15 and v.co.z < 0.25], context='VERTS')
    bm.to_mesh(cap.data); bm.free()
    sphere(0.22, (-0.12, -0.33, 1.9), mat(hair), scale=(1.4, 0.5, 0.6), rot=(0, 0.35, 0))
    sphere(0.17, (0, 0.38, 1.98), mat(hair))
    for side in (-1, 1):
        sphere(0.06, (0.15 * side, -0.4, 1.6), mat('#1a1033', 'gloss'), scale=(0.8, 0.5, 1.25))
        sphere(0.018, (0.15 * side + 0.02, -0.44, 1.64), mat('#ffffff', 'glow', 1.2), seg=8, rings=5)
        sphere(0.06, (0.26 * side, -0.36, 1.5), mat('#ff9fb0'), scale=(1, 0.3, 0.6))      # blush
    arc_tube(0.07, 0.014, math.pi * 1.15, math.pi * 1.85, (0, -0.42, 1.48), mat('#6e2a3a'), rot=(math.pi / 2 - 0.3, 0, 0))
    export('civilian')

if __name__ == '__main__':
    fns = (build_tank, build_cow, build_sheep, build_pig, build_chicken, build_alien, build_saucer) if '--game' in sys.argv else (build_saucer, build_alien, build_cow, build_house, build_tank, build_civilian)
    for fn in fns:
        fn()
    json.dump(STATS, open(os.path.join(OUT, 'stats.json'), 'w'), indent=1)
