"""Bundled 2026 membership register importer; callable only from authenticated server handler."""
import datetime
import json
import os
import shutil
import threading
from pathlib import Path

_LOCK = threading.RLock()

def _matches(existing, row):
    for item in existing:
        if item.get('id') == row.get('id'):
            return item
    for item in existing:
        if (item.get('status') != 'deleted' and item.get('name') == row.get('name')
                and item.get('birth_date') == row.get('birth_date')):
            return item
    return None

def import_members(root, preview=False):
    """Safely merge immutable bundled register. Never change existing populated fields/status/public."""
    root = Path(root)
    source_path = root/'imports'/'members_2026_from_book.json'
    dest = root/'data'/'members.json'
    if not source_path.is_file():
        raise ValueError('원본 명부 파일이 없습니다: imports/members_2026_from_book.json')
    source = json.loads(source_path.read_text(encoding='utf-8'))
    rows = source.get('members', [])
    if not isinstance(rows, list) or not rows or len(rows) > 5000:
        raise ValueError('명부 원본 형식이 올바르지 않습니다.')
    with _LOCK:
        current = json.loads(dest.read_text(encoding='utf-8')) if dest.is_file() else {'schema_version':1, 'members':[]}
        existing = current.get('members')
        if not isinstance(existing, list):
            raise ValueError('기존 회원 데이터 형식이 올바르지 않습니다.')
        added = 0
        filled = 0
        matched = 0
        for row in rows:
            if not isinstance(row, dict) or not row.get('id') or not row.get('name'):
                raise ValueError('명부 원본에 올바르지 않은 회원 항목이 있습니다.')
            match = _matches(existing, row)
            if match is None:
                new = dict(row)
                new['public'] = new.get('status', 'active') == 'active'
                # 기존 회원의 공개 여부는 변경하지 않음
                existing.append(new)
                added += 1
            else:
                matched += 1
                for key, value in row.items():
                    if key in ('id','public','status','created_at','updated_at','notes'):
                        continue
                    if (match.get(key) is None or match.get(key) == '') and value not in ('', None):
                        match[key] = value
                        filled += 1
        result = {'ok':True, 'preview':bool(preview), 'source_total':len(rows),
                  'added':added, 'matched':matched, 'filled':filled, 'total':len(existing)}
        if not preview:
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists():
                stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                backup = dest.with_name('members.backup_'+stamp+'.json')
                shutil.copy2(dest, backup)
                result['backup'] = backup.name
            temp = dest.with_name('members.import.tmp')
            try:
                temp.write_text(json.dumps(current, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
                os.replace(temp,dest)
            finally:
                if temp.exists():temp.unlink()
        return result
