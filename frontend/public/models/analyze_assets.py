import struct
import json
import re
import os

def parse_glb(filepath):
    print(f"\n--- Parsing {filepath} ---")
    with open(filepath, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF':
            print("Not a valid GLB file")
            return
        version, = struct.unpack('<I', f.read(4))
        length, = struct.unpack('<I', f.read(4))
        
        chunk0_length, = struct.unpack('<I', f.read(4))
        chunk0_type = f.read(4)
        if chunk0_type != b'JSON':
            print("First chunk is not JSON")
            return
            
        json_data = f.read(chunk0_length).decode('utf-8')
        gltf = json.loads(json_data)
        
        # 1. Bones
        print("BONES:")
        bones = []
        if 'nodes' in gltf:
            for i, node in enumerate(gltf['nodes']):
                name = node.get('name', f'Node_{i}')
                bones.append(name)
        
        # Look for the roots and spine
        spine_nodes = [n for n in bones if any(x in n for x in ['Spine', 'Hips', 'Armature', 'mixamorig'])]
        print("Spine/Hips/Armature Nodes:", spine_nodes)
        
        # Look for Morph Targets
        print("\nMORPH TARGETS:")
        morph_targets_info = []
        if 'meshes' in gltf:
            for mesh in gltf['meshes']:
                mesh_name = mesh.get('name', 'Unnamed Mesh')
                
                # Check for extras -> targetNames
                if 'extras' in mesh and 'targetNames' in mesh['extras']:
                    targets = mesh['extras']['targetNames']
                    print(f"Mesh: {mesh_name}, Extras TargetNames: {len(targets)}")
                    morph_targets_info.append({"mesh": mesh_name, "targets": targets})
                    continue
                    
                # Check primitives -> extras -> targetNames
                targets = []
                for prim in mesh.get('primitives', []):
                    if 'extras' in prim and 'targetNames' in prim['extras']:
                        targets.extend(prim['extras']['targetNames'])
                
                if targets:
                    print(f"Mesh: {mesh_name}, Primitive Targets Count: {len(targets)}")
                    morph_targets_info.append({"mesh": mesh_name, "targets": targets})
                else:
                    print(f"Mesh: {mesh_name}, No targets found.")
                    
def parse_fbx(filepath):
    print(f"\n--- Parsing {filepath} ---")
    with open(filepath, 'rb') as f:
        data = f.read()
        
    # Search for anything containing typical bone names like 'Spine', 'Hips', 'mixamorig'
    # We will search for strings of length >= 4 with only letters, digits, _, :, |
    matches = re.findall(b'[a-zA-Z0-9_\\|:]+', data)
    
    unique_matches = list(set([m.decode('utf-8', errors='ignore') for m in matches]))
    
    bone_keywords = ['Spine', 'Hips', 'Armature', 'mixamorig']
    bones = []
    for m in unique_matches:
        if any(kw in m for kw in bone_keywords):
            bones.append(m)
            
    print("Detected Bone Strings in FBX:", bones)

if __name__ == '__main__':
    base_dir = r'D:\A\Projects\VirtAI-Project\frontend\public\models'
    glb_path = os.path.join(base_dir, 'avatar1.glb')
    idle_path = os.path.join(base_dir, 'animations', 'Idle', 'Idle.fbx')
    
    parse_glb(glb_path)
    parse_fbx(idle_path)
