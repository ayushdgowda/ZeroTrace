"""
ZeroTrace File Management Automation
Organize, rename, compress, move files and find duplicates.
"""

import os
import shutil
import hashlib
import zipfile
import re
from pathlib import Path
from datetime import datetime


# ─── File type categories ─────────────────────────────────────────────────────

FILE_CATEGORIES = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico'],
    'Videos': ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'],
    'Audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
    'Documents': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages'],
    'Spreadsheets': ['.xls', '.xlsx', '.csv', '.ods', '.numbers'],
    'Presentations': ['.ppt', '.pptx', '.odp', '.key'],
    'Code': ['.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.java', '.cpp', '.c', '.go', '.rs'],
    'Archives': ['.zip', '.rar', '.tar', '.gz', '.7z', '.bz2'],
    'Executables': ['.exe', '.msi', '.dmg', '.apk', '.deb'],
    'Data': ['.json', '.xml', '.yaml', '.yml', '.sql', '.db'],
}


def get_file_category(extension: str) -> str:
    """Get category for a file extension."""
    ext = extension.lower()
    for category, extensions in FILE_CATEGORIES.items():
        if ext in extensions:
            return category
    return 'Others'


# ─── Organize folder ──────────────────────────────────────────────────────────

def organize_folder(folder_path: str = None) -> dict:
    """
    Organize a folder by moving files into category subfolders.
    Default: user's Downloads folder.
    """
    if not folder_path:
        folder_path = str(Path.home() / 'Downloads')

    folder = Path(folder_path)
    if not folder.exists():
        return {'success': False, 'error': f'Folder not found: {folder_path}'}

    moved = {}
    skipped = []
    total = 0

    for file in folder.iterdir():
        if file.is_file():
            ext = file.suffix
            category = get_file_category(ext)

            # Create category subfolder
            dest_folder = folder / category
            dest_folder.mkdir(exist_ok=True)

            # Move file
            dest = dest_folder / file.name
            if dest.exists():
                # Add timestamp to avoid overwrite
                stem = file.stem
                suffix = file.suffix
                dest = dest_folder / f"{stem}_{int(datetime.now().timestamp())}{suffix}"

            shutil.move(str(file), str(dest))
            moved[category] = moved.get(category, 0) + 1
            total += 1

    summary = '\n'.join([f"• {cat}: {count} files" for cat, count in moved.items()])
    return {
        'success': True,
        'folder': folder_path,
        'total_moved': total,
        'categories': moved,
        'summary': f"✅ **Folder organized!**\n\n**Folder:** `{folder_path}`\n**Total files moved:** {total}\n\n{summary}",
    }


# ─── Rename files ─────────────────────────────────────────────────────────────

def rename_files(folder_path: str, pattern: str = None, prefix: str = '',
                 suffix: str = '', start_number: int = 1) -> dict:
    """
    Rename files in a folder with a pattern.
    Example: rename all .jpg files to photo_001.jpg, photo_002.jpg etc.
    """
    folder = Path(folder_path)
    if not folder.exists():
        return {'success': False, 'error': f'Folder not found: {folder_path}'}

    renamed = []
    counter = start_number

    files = sorted([f for f in folder.iterdir() if f.is_file()])

    for file in files:
        if pattern and not file.name.lower().endswith(pattern.lower()):
            continue

        new_name = f"{prefix}{str(counter).zfill(3)}{suffix}{file.suffix}"
        new_path = folder / new_name

        file.rename(new_path)
        renamed.append({'old': file.name, 'new': new_name})
        counter += 1

    return {
        'success': True,
        'renamed_count': len(renamed),
        'files': renamed[:10],  # show first 10
        'summary': f"✅ **{len(renamed)} files renamed** in `{folder_path}`",
    }


# ─── Compress folder ──────────────────────────────────────────────────────────

def compress_folder(folder_path: str, output_name: str = None) -> dict:
    """Compress a folder into a ZIP file."""
    folder = Path(folder_path)
    if not folder.exists():
        return {'success': False, 'error': f'Folder not found: {folder_path}'}

    if not output_name:
        output_name = f"{folder.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

    output_path = folder.parent / output_name

    with zipfile.ZipFile(str(output_path), 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in folder.rglob('*'):
            if file.is_file():
                zipf.write(file, file.relative_to(folder.parent))

    size_mb = round(output_path.stat().st_size / (1024 * 1024), 2)

    return {
        'success': True,
        'output_path': str(output_path),
        'size_mb': size_mb,
        'summary': f"✅ **Folder compressed!**\n\n**Output:** `{output_path}`\n**Size:** {size_mb} MB",
    }


# ─── Move files ───────────────────────────────────────────────────────────────

def move_files(source_folder: str, dest_folder: str, pattern: str = None) -> dict:
    """Move files from source to destination folder."""
    source = Path(source_folder)
    dest = Path(dest_folder)

    if not source.exists():
        return {'success': False, 'error': f'Source not found: {source_folder}'}

    dest.mkdir(parents=True, exist_ok=True)
    moved = []

    for file in source.iterdir():
        if file.is_file():
            if pattern and not file.name.lower().endswith(pattern.lower()):
                continue
            shutil.move(str(file), str(dest / file.name))
            moved.append(file.name)

    return {
        'success': True,
        'moved_count': len(moved),
        'files': moved[:10],
        'summary': f"✅ **{len(moved)} files moved** to `{dest_folder}`",
    }


# ─── Find duplicates ──────────────────────────────────────────────────────────

def find_duplicates(folder_path: str) -> dict:
    """Find duplicate files in a folder using MD5 hash."""
    folder = Path(folder_path)
    if not folder.exists():
        return {'success': False, 'error': f'Folder not found: {folder_path}'}

    hashes = {}
    duplicates = []

    for file in folder.rglob('*'):
        if file.is_file():
            try:
                with open(file, 'rb') as f:
                    file_hash = hashlib.md5(f.read()).hexdigest()

                if file_hash in hashes:
                    duplicates.append({
                        'original': str(hashes[file_hash]),
                        'duplicate': str(file),
                        'size_kb': round(file.stat().st_size / 1024, 1),
                    })
                else:
                    hashes[file_hash] = file
            except Exception:
                continue

    total_size = sum(d['size_kb'] for d in duplicates)

    return {
        'success': True,
        'duplicate_count': len(duplicates),
        'duplicates': duplicates[:10],
        'total_wasted_kb': total_size,
        'summary': f"🔍 **Found {len(duplicates)} duplicate files**\n\nWasted space: {total_size:.1f} KB\n\n" +
                   '\n'.join([f"• `{d['duplicate']}`" for d in duplicates[:5]]),
    }


# ─── Command parser ───────────────────────────────────────────────────────────

def parse_file_command(user_message: str) -> dict:
    """Parse file management command from user message."""
    msg = user_message.lower()

    if any(w in msg for w in ['organize', 'sort files', 'clean up', 'arrange']):
        folder_match = re.search(r'(?:organize|sort|clean)\s+(?:my\s+)?(\w+(?:\s+\w+)?)\s+folder', msg)
        folder_name = folder_match.group(1) if folder_match else 'downloads'
        if 'downloads' in folder_name:
            path = str(Path.home() / 'Downloads')
        elif 'desktop' in folder_name:
            path = str(Path.home() / 'Desktop')
        elif 'documents' in folder_name:
            path = str(Path.home() / 'Documents')
        else:
            path = str(Path.home() / 'Downloads')
        return {'action': 'organize', 'path': path}

    if any(w in msg for w in ['duplicate', 'duplicate files', 'find duplicates']):
        return {'action': 'duplicates', 'path': str(Path.home() / 'Downloads')}

    if any(w in msg for w in ['compress', 'zip', 'archive']):
        return {'action': 'compress', 'path': str(Path.home() / 'Downloads')}

    if any(w in msg for w in ['rename files', 'rename all']):
        return {'action': 'rename', 'path': str(Path.home() / 'Downloads')}

    return {'action': 'unknown'}


def execute_file_command(user_message: str) -> dict:
    """Execute file management command."""
    command = parse_file_command(user_message)
    action = command.get('action')
    path = command.get('path', str(Path.home() / 'Downloads'))

    if action == 'organize':
        return organize_folder(path)
    elif action == 'duplicates':
        return find_duplicates(path)
    elif action == 'compress':
        return compress_folder(path)
    elif action == 'rename':
        return rename_files(path)
    else:
        return {'success': False, 'error': 'Unknown file command', 'summary': ''}
