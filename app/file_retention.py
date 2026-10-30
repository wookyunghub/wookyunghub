"""Internal recovery copies for deleted resources; no administrator workflow."""
import json
import logging
import math
import os
from pathlib import Path
import secrets
import shutil
import time

RETENTION_SECONDS = 30 * 24 * 60 * 60

def _write_manifest(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temporary, path)

def retain_deleted_resource(storage, kind, item, commit, now=None):
    """Move both files and retain metadata; roll back if commit fails."""
    storage = Path(storage).resolve()
    now = time.time() if now is None else now
    folder = storage / 'trash' / secrets.token_hex(16)
    folder.mkdir(parents=True)
    moved = []
    manifest = {'schema_version': 1, 'state': 'pending', 'kind': kind,
                'deleted_at': now, 'expires_at': now + RETENTION_SECONDS,
                'item': item, 'files': []}
    try:
        for part in [item] + ([item['pdf']] if item.get('pdf') else []):
            relative = part.get('path', '')
            if not relative:
                raise ValueError('파일 저장 경로가 없습니다.')
            source = (storage / relative).resolve()
            if not source.is_relative_to(storage) or source == storage:
                raise ValueError('잘못된 파일 경로입니다.')
            if source.exists() and not source.is_file():
                raise ValueError('파일 경로가 올바르지 않습니다.')
            target = folder / source.name
            manifest['files'].append({'original_path': relative, 'retained_name': source.name,
                                      'missing': not source.exists()})
            if source.exists():
                if target.exists():
                    raise ValueError('보관할 파일명이 중복됩니다.')
                shutil.move(str(source), str(target))
                moved.append((target, source))
        _write_manifest(folder / 'metadata.json', manifest)
        commit()
    except Exception:
        for source, target in reversed(moved):
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(target))
        shutil.rmtree(folder)
        raise
    # If marking fails, keep the pending copy indefinitely rather than lose data.
    manifest['state'] = 'committed'
    try:
        _write_manifest(folder / 'metadata.json', manifest)
    except OSError:
        logging.exception('삭제 자료 보관 완료 표시에 실패했습니다: %s', folder)
    return folder

def cleanup_retained_resources(storage, now=None):
    """Only expire explicitly committed recovery folders; leave legacy files alone."""
    now = time.time() if now is None else now
    trash = Path(storage) / 'trash'
    if not trash.is_dir() or trash.is_symlink():
        return 0
    removed = 0
    for folder in trash.iterdir():
        if folder.is_symlink() or not folder.is_dir():
            continue
        metadata = folder / 'metadata.json'
        if metadata.is_symlink():
            continue
        try:
            data = json.loads(metadata.read_text(encoding='utf-8'))
            deleted = data.get('deleted_at')
            expires = data.get('expires_at')
            if (data.get('schema_version') != 1 or data.get('state') != 'committed'
                    or not isinstance(deleted, (int, float)) or isinstance(deleted, bool)
                    or not isinstance(expires, (int, float)) or isinstance(expires, bool)
                    or not math.isfinite(deleted) or not math.isfinite(expires)
                    or expires < deleted + RETENTION_SECONDS or now < expires):
                continue
            shutil.rmtree(folder)
            removed += 1
        except FileNotFoundError:
            continue
        except (OSError, ValueError, TypeError, AttributeError):
            logging.exception('삭제 자료 자동 정리에 실패했습니다: %s', folder)
    return removed

def retention_worker(storage, stop):
    while not stop.is_set():
        try:
            cleanup_retained_resources(storage)
        except OSError:
            logging.exception('삭제 자료 자동 정리 점검에 실패했습니다.')
        stop.wait(3600)
