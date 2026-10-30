"""Canonical record categories and one-time, backed-up legacy conversion."""
from pathlib import Path
import time

RECORD_TYPES = {'notice': '공지', 'meeting': '회의', 'event': '행사',
                'facility': '시설·비품', 'document': '기타 운영'}
LEGACY_TYPES = {'행사·활동': 'event', '행사활동': 'event', '행사·활동 기록': 'event', '행사활동기록': 'event', '행사': 'event', 'activity': 'event', 'event_schedule': 'event', 'asset': 'facility',
                'history': 'document', 'person': 'document', 'finance': 'document',
                'receipt': 'document', 'regulation': 'document'}

def normalize_record_types(repo, root):
    database = repo.read('records', {'records': []})
    rows = [row for row in database.get('records', []) if row.get('module') in LEGACY_TYPES]
    if not rows:
        return 0
    source = Path(root) / 'data/records.json'
    backup = Path(root) / 'data/backups' / f'records.before-types-{time.time_ns()}.json'
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_bytes(source.read_bytes())
    for row in rows:
        row['module'] = LEGACY_TYPES[row['module']]
    repo.write('records', database)
    return len(rows)
