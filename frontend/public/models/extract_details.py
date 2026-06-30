import struct
import json
import re
import os

def extract(filepath):
    print(f"\n--- Extracting {filepath} ---")
    with open(filepath, 'rb') as f:
        magic = f.read(4)
        version, = struct.unpack('<I', f.read(4))
        length, = struct.unpack('<I', f.read(4))
        
        chunk0_length, = struct.unpack('<I', f.read(4))
        chunk0_type = f.read(4)
        json_data = f.read(chunk0_length).decode('utf-8')
        gltf = json.loads(json_data)
        
        # 1. All bones
        bones = []
        if 'nodes' in gltf:
            for i, node in enumerate(gltf['nodes']):
                name = node.get('name', f'Node_{i}')
                bones.append(name)
        print("\nALL BONES:", bones)
        
        # 2. Morph Targets Array
        if 'meshes' in gltf:
            for mesh in gltf['meshes']:
                mesh_name = mesh.get('name', 'Unnamed Mesh')
                if 'extras' in mesh and 'targetNames' in mesh['extras']:
                    print(f"\nMesh: {mesh_name}")
                    print(f"Target Keys: {mesh['extras']['targetNames']}")

def check_fbx(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    matches = re.findall(b'(.{0,10}Spine.{0,10})', data)
    print(f"\nFBX Spine Context in {filepath}:")
    unique_matches = list(set([m.decode('utf-8', errors='ignore') for m in matches]))
    for m in unique_matches[:10]:
        print(repr(m))

if __name__ == '__main__':
    base_dir = r'D:\A\Projects\VirtAI-Project\frontend\public\models'
    glb_path = os.path.join(base_dir, 'avatar1.glb')
    extract(glb_path)
    check_fbx(os.path.join(base_dir, 'animations', 'Idle', 'Idle.fbx'))
