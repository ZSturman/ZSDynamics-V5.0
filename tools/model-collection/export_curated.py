"""Export an explicit reviewed object/assembly selection, never a whole scene."""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import os

import bpy
from mathutils import Vector

TOOL_DIR = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MODEL_COLLECTION_ROOT', Path(__file__).resolve().parents[3] / '_Collections' / '3D Models Collection')).expanduser().resolve()
parser = argparse.ArgumentParser()
parser.add_argument('--id', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
spec = next(m for m in json.loads((ROOT/'catalog/models.json').read_text())['models'] if m['id']==args.id)
out = ROOT/'docs/inspection'/spec['id']
out.mkdir(parents=True, exist_ok=True)
sources = spec.get('sources', [spec['source']])
if sources[0].lower().endswith('.blend'):
    if len(sources) != 1 or not spec.get('objects'):
        raise ValueError('Blender exports require an explicit object allowlist')
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/sources[0]), load_ui=False, use_scripts=False)
    missing = set(spec['objects'])-set(bpy.data.objects.keys())
    if missing:
        raise ValueError(f'Selected objects missing: {missing}')
    chosen = [bpy.data.objects[name] for name in spec['objects']]
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    chosen = []
    for filename in sources:
        before = set(bpy.data.objects)
        bpy.ops.wm.stl_import(filepath=str(ROOT/filename))
        added = list(set(bpy.data.objects)-before)
        if len(added)!=1:
            raise ValueError(f'Expected one STL mesh: {filename}')
        added[0].name = Path(filename).stem
        chosen.extend(added)

scene = bpy.context.scene
for obj in chosen:
    if obj.name in spec.get('display_offsets', {}):
        obj.location += Vector(spec['display_offsets'][obj.name])
# Include only necessary ancestors for transforms and skeletal deformation.
for obj in list(chosen):
    parent = obj.parent
    while parent:
        if parent not in chosen:
            chosen.append(parent)
        parent = parent.parent
for collection in bpy.data.collections:
    collection.hide_render = False
    collection.hide_viewport = False
def enable_layers(layer):
    layer.exclude = False
    layer.hide_viewport = False
    for child in layer.children:
        enable_layers(child)
enable_layers(bpy.context.view_layer.layer_collection)

def isolate():
    for obj in scene.objects:
        keep = obj in chosen
        obj.hide_render = not keep
        obj.hide_viewport = False
        obj.hide_set(not keep)
        obj.select_set(keep)
isolate()
geometry = [obj for obj in chosen if obj.type in {'MESH','CURVE','FONT','SURFACE','META'}]
if not geometry:
    raise ValueError('Selection has no geometry')
for obj in chosen:
    for modifier in obj.modifiers:
        if modifier.type in {'SOFT_BODY','CLOTH'} and spec.get('kind')=='functional':
            modifier.show_viewport = modifier.show_render = False
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks:
            track.mute = True
        obj.animation_data.action = None
action_spec = spec.get('action')
if action_spec:
    owner = bpy.data.objects[action_spec['object']]
    if owner not in chosen:
        raise ValueError('Animation owner is not selected')
    action = bpy.data.actions[action_spec['name']]
    owner.animation_data_create()
    owner.animation_data.action = action
    if action.slots:
        owner.animation_data.action_slot = action.slots[0]
    start, end = action_spec.get('frames', list(action.frame_range))
    scene.frame_start,scene.frame_end = math.ceil(start),math.floor(end)
else:
    scene.frame_start=scene.frame_end=spec.get('frame',1)

def points_at(frame):
    scene.frame_set(frame)
    graph=bpy.context.evaluated_depsgraph_get()
    return [obj.matrix_world @ Vector(corner) for original in geometry
            for obj in [original.evaluated_get(graph)] for corner in obj.bound_box]
frames = list(range(scene.frame_start, scene.frame_end+1)) if action_spec else [scene.frame_start]
points = [point for frame in frames for point in points_at(frame)]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)))
high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
center=(low+high)/2
span=max(high-low)
if span<=0 or not math.isfinite(span):
    raise ValueError('Invalid selected bounds')
scene.frame_set(spec.get('render_frame',round((scene.frame_start+scene.frame_end)/2)))
for obj in geometry:
    for slot in obj.material_slots:
        material=slot.material
        if material and material.use_nodes:
            shader=next((node for node in material.node_tree.nodes if node.type=='BSDF_PRINCIPLED'),None)
            if shader and not shader.inputs['Base Color'].is_linked:
                material.diffuse_color=shader.inputs['Base Color'].default_value

camera_data=bpy.data.cameras.new('CuratedCamera')
camera=bpy.data.objects.new('CuratedCamera',camera_data)
scene.collection.objects.link(camera)
direction=Vector(spec.get('view_direction',[1.4,-1.8,1.1])).normalized()
camera.location=center+direction*max(span*3,1)
camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=max(span*spec.get('camera_margin',1.35),.001)
camera_data.clip_start=max(span/10000,.000001)
camera_data.clip_end=max(span*100,1000)
scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=scene.render.resolution_y=960
scene.render.resolution_percentage=100
scene.render.film_transparent=False
scene.render.use_compositing=scene.render.use_sequencer=False
scene.render.image_settings.file_format='PNG'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.display.shading.cavity_type='BOTH'
scene.display.shading.background_type='WORLD'
scene.world=bpy.data.worlds.new('CuratedWorld')
scene.world.color=(.035,.045,.065)
scene.render.filepath=str(out/'preview.png')
bpy.ops.render.render(write_still=True)
if action_spec:
    for i,frame in enumerate(sorted({scene.frame_start,scene.frame_start+(scene.frame_end-scene.frame_start)//4,
                                   (scene.frame_start+scene.frame_end)//2,
                                   scene.frame_end-(scene.frame_end-scene.frame_start)//4,scene.frame_end})):
        scene.frame_set(frame)
        scene.render.filepath=str(out/f'motion-{i+1:02}.png')
        bpy.ops.render.render(write_still=True)

used_materials={slot.material for obj in geometry for slot in obj.material_slots if slot.material}
used_images={node.image for material in used_materials if material.use_nodes for node in material.node_tree.nodes
             if node.type=='TEX_IMAGE' and node.image}
missing_images=[im.filepath for im in used_images if im.source=='FILE' and not im.packed_file and im.filepath
                and not Path(bpy.path.abspath(im.filepath)).exists()]
report={'source':str(ROOT/sources[0]),'sources':[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()} for p in sources],
        'selection':[o.name for o in chosen],'geometry':[o.name for o in geometry],
        'selection_reason':spec['selection_reason'],'action':action_spec,
        'spec_sha256':hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest(),
        'display_offsets':spec.get('display_offsets', {}),
        'frame_range':[scene.frame_start,scene.frame_end], 'fps':scene.render.fps/scene.render.fps_base,
        'source_bounds':[list(low),list(high)],'missing_images':missing_images,
        'display_export':{'normalized_max_dimension':2.5,'printing_units':False},
        'tool_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}

if not spec.get('image_only'):
    neutral=bpy.data.materials.new('NeutralPreview')
    neutral.use_nodes=True
    shader=neutral.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(.48,.58,.68,1)
    shader.inputs['Metallic'].default_value=0
    shader.inputs['Roughness'].default_value=.65
    for obj in geometry:
        if not obj.data.materials:
            obj.data.materials.append(neutral)
        elif spec.get('neutral_material'):
            for i in range(len(obj.data.materials)):
                obj.data.materials[i]=neutral
    display=bpy.data.objects.new('DisplayTransform',None)
    scene.collection.objects.link(display)
    roots=[o for o in chosen if o.parent not in chosen]
    for obj in roots:
        world=obj.matrix_world.copy()
        obj.parent=display
        obj.matrix_world=world
    scale=2.5/span
    display.scale=(scale,scale,scale)
    display.location=-center*scale
    bpy.context.view_layer.update()
    isolate()
    display.hide_set(False)
    display.hide_render=False
    display.select_set(True)
    scene.frame_set(scene.frame_start)
    bpy.context.view_layer.objects.active=geometry[0]
    bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'),export_format='GLB',
                              use_selection=True,use_visible=False,use_renderable=False,use_active_scene=True,
                              export_cameras=False,export_lights=False,export_animations=bool(action_spec),
                              export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,
                              export_anim_scene_split_object=False,export_anim_slide_to_zero=True,
                              export_nla_strips_merged_animation_name=action_spec['name'] if action_spec else 'Static')
(out/'inspection.json').write_text(json.dumps(report,indent=2)+'\n')
print('CURATED_OK',spec['id'],report['geometry'],action_spec,flush=True)
