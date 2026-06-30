#!/usr/bin/env python3
"""
VirtAI Cleanup Utility
A professional, cross-platform Python-based cleanup utility for development caches, logs, build artifacts, and report directories.
"""

import os
import sys
import shutil
import time
import argparse
from pathlib import Path

# Paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
os.chdir(BACKEND_DIR)

# Exclude lists - patterns/directories that MUST NEVER be removed
NEVER_REMOVE_DIRS = {
    ".git",
    ".github",
    ".vscode",
    ".idea",
    "app",
    "tests",
    "load_tests",
    "alembic",
    "docs",
    "venv",
    ".venv",
}

NEVER_REMOVE_FILES = {
    ".env",
    ".env.example",
    ".env.prod",
    ".env.prod.example",
    "pyproject.toml",
    "alembic.ini",
    "Dockerfile",
    "entrypoint.sh",
    "docker-compose.yml",
    "docker-compose.dev.yml",
    "docker-compose.prod.yml",
    ".gitignore",
    ".dockerignore",
    "README.md",
}

# Cleanup sets
DEFAULT_CACHE_DIRS = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".ipynb_checkpoints", ".tox", ".nox"}
DEFAULT_CACHE_FILES_EXT = {".pyc", ".pyo", ".pyd"}

FULL_EXTRA_DIRS = {"build", "dist", "quality_reports", "test_reports"}
FULL_EXTRA_FILES_EXT = {".log", ".tmp"}

# Global stats counters
dirs_removed = []
files_removed = []
skipped_items = []

def should_keep(path: Path) -> bool:
    """Check if path is protected and should not be deleted."""
    # Check parent chain for exclusions
    for parent in [path] + list(path.parents):
        # Resolve path relative to backend dir
        try:
            rel = parent.resolve().relative_to(BACKEND_DIR)
        except ValueError:
            continue
        parts = rel.parts
        if parts:
            first_part = parts[0]
            if first_part in NEVER_REMOVE_DIRS:
                return True
            if len(parts) == 1 and first_part in NEVER_REMOVE_FILES:
                return True
    return False

def clean_item(path: Path, dry_run: bool = False):
    """Attempt to delete a file or directory with safety checks."""
    if should_keep(path):
        try:
            skipped_items.append(str(path.relative_to(BACKEND_DIR)))
        except ValueError:
            skipped_items.append(str(path))
        return

    try:
        rel_path_str = str(path.relative_to(BACKEND_DIR))
    except ValueError:
        rel_path_str = str(path)

    if dry_run:
        if path.is_dir():
            dirs_removed.append(rel_path_str)
        else:
            files_removed.append(rel_path_str)
        return

    try:
        if path.is_dir():
            # Strip read-only attributes on Windows before rmtree
            if sys.platform == "win32":
                import stat
                for root, dirs, files in os.walk(path):
                    for name in files + dirs:
                        p = Path(root) / name
                        try:
                            p.chmod(stat.S_IWRITE)
                        except Exception:
                            pass
            shutil.rmtree(path)
            dirs_removed.append(rel_path_str)
        else:
            if sys.platform == "win32":
                import stat
                try:
                    path.chmod(stat.S_IWRITE)
                except Exception:
                    pass
            path.unlink()
            files_removed.append(rel_path_str)
    except Exception as e:
        skipped_items.append(f"{rel_path_str} (Error: {e})")

def perform_cleanup(mode: str, dry_run: bool = False):
    """Walk directories and clean items based on the selected mode."""
    # 1. Identify directories/files to clean
    for root, dirs, files in os.walk(BACKEND_DIR, topdown=False):
        root_path = Path(root)

        # Check files
        for name in files:
            file_path = root_path / name
            ext = file_path.suffix.lower()

            # Determine if file should be cleaned
            is_cache = ext in DEFAULT_CACHE_FILES_EXT
            is_temp = ext in FULL_EXTRA_FILES_EXT or name == ".coverage"

            if mode == "nuclear":
                # Nuclear mode cleans anything not in the exclusions list
                if not should_keep(file_path):
                    clean_item(file_path, dry_run)
            elif mode == "full":
                if is_cache or is_temp:
                    clean_item(file_path, dry_run)
            else: # default mode
                if is_cache:
                    clean_item(file_path, dry_run)

        # Check directories
        for name in dirs:
            dir_path = root_path / name

            if mode == "nuclear":
                if not should_keep(dir_path):
                    clean_item(dir_path, dry_run)
            elif mode == "full":
                if name in DEFAULT_CACHE_DIRS or name in FULL_EXTRA_DIRS or name.endswith(".egg-info"):
                    clean_item(dir_path, dry_run)
            else: # default mode
                if name in DEFAULT_CACHE_DIRS or name.endswith(".egg-info"):
                    clean_item(dir_path, dry_run)

def main():
    parser = argparse.ArgumentParser(description="VirtAI Production-Grade Cleanup Utility")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without modifying files")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--full", action="store_true", help="Clean caches, build artifacts, logs, and report directories")
    group.add_argument("--nuclear", action="store_true", help="Wipe all untracked files/folders except sources and configuration files")

    args = parser.parse_args()

    mode = "default"
    if args.full:
        mode = "full"
    elif args.nuclear:
        mode = "nuclear"

    start_time = time.perf_counter()

    print("========================================")
    print(f" Starting VirtAI Cleanup ({mode.upper()} mode)")
    if args.dry_run:
        print(" *** DRY RUN - No files will be deleted ***")
    print(f" Working Directory: {BACKEND_DIR}")
    print("========================================")

    perform_cleanup(mode, args.dry_run)

    elapsed = time.perf_counter() - start_time

    print("\n========================================")
    print(" Cleanup Summary")
    print("========================================")
    print(f" Directories Removed: {len(dirs_removed)}")
    if dirs_removed:
        for d in sorted(dirs_removed)[:10]:
            print(f"   - {d}")
        if len(dirs_removed) > 10:
            print(f"   ... and {len(dirs_removed) - 10} more")

    print(f" Files Removed:       {len(files_removed)}")
    if files_removed:
        for f in sorted(files_removed)[:10]:
            print(f"   - {f}")
        if len(files_removed) > 10:
            print(f"   ... and {len(files_removed) - 10} more")

    print(f" Skipped/Protected:   {len(skipped_items)}")
    if skipped_items and mode == "nuclear":
        for s in sorted(skipped_items)[:10]:
            print(f"   - {s}")
        if len(skipped_items) > 10:
            print(f"   ... and {len(skipped_items) - 10} more")

    print(f" Time Elapsed:        {elapsed:.4f} seconds")
    print("========================================")

if __name__ == "__main__":
    main()
