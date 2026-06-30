import struct, json, sys

def parse_glb(file_path):
    try:
        with open(file_path, 'rb') as f:
            magic, version, length = struct.unpack('<4sII', f.read(12))
            chunk_len, chunk_type = struct.unpack('<II', f.read(8))
            json_data = f.read(chunk_len)
            data = json.loads(json_data.decode('utf-8'))
            
            print("=== MESHES & MORPH TARGETS ===")
            for i, mesh in enumerate(data.get('meshes', [])):
                name = mesh.get('name', f'Mesh_{i}')
                
                # Check mesh extras
                targets = []
                if 'extras' in mesh and 'targetNames' in mesh['extras']:
                    targets = mesh['extras']['targetNames']
                
                # Check primitive extras
                primitives = mesh.get('primitives', [])
                if not targets and primitives and 'extras' in primitives[0] and 'targetNames' in primitives[0]['extras']:
                    targets = primitives[0]['extras']['targetNames']
                
                if targets:
                    print(f"- {name} has {len(targets)} targets. First 5: {targets[:5]}... Includes viseme_aa? {'viseme_aa' in targets}")
                else:
                    has_targets = any('targets' in p for p in primitives)
                    if has_targets:
                        print(f"- {name} has targets but NO names found in extras.")
                    else:
                        pass
            
            print("\n=== RAW NODE NAMES FOR BONES ===")
            all_node_names = [n.get('name') for n in data.get('nodes', []) if 'name' in n]
            
            # Print specifically the first 20 nodes to see the top-level structure
            print(f"Top nodes: {all_node_names[:20]}")
            
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

if __name__ == '__main__':
    parse_glb(sys.argv[1])
