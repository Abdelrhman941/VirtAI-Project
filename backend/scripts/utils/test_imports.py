import os
import pkgutil
import importlib
import traceback
import sys
from pathlib import Path

# Ensure the backend directory is in the path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

def check_imports(package_name):
    package = importlib.import_module(package_name)
    failed = False
    for _, name, is_pkg in pkgutil.walk_packages(package.__path__, package.__name__ + '.'):
        try:
            importlib.import_module(name)
            print(f"OK: {name}")
        except Exception as e:
            print(f"FAIL: {name}")
            traceback.print_exc()
            failed = True
    if failed:
        sys.exit(1)
    else:
        print("ALL IMPORTS OK")
        sys.exit(0)

if __name__ == "__main__":
    check_imports('app')
