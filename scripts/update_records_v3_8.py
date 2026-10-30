#!/usr/bin/env python3
"""CenterHub v3.8: 본편2 15쪽의 전체 행사기록부 누락 보완 및 임시총회 중복 정리.

기존 records.json 전체를 교체하지 않고 정확한 ID에만 적용합니다.
기본은 미리보기이며 --apply 시에만 백업 후 저장합니다.
"""
import argparse
import json
import os
import shutil
from datetime import datetime
from pathlib import Path

NEW = [
    {
        'id': 'book2-2025-0121-ledger-publication',
        'module': 'activity',
        'date': '2025-01-21',
        'title': '2024 경로당 운영관리대장 회원공개용 발간',
        'body': '2024 경로당운영관리대장(우경경로당) 회원공개용 발간.',
        'public': True,
        'book_include': True,
        'edition_period': '2025-2026',
        'status': 'active',
        'tags': ['운영책자', '본책2', '행사·회의기록부'],
        'source': '2025-26 운영대장 본책2 PDF 15쪽',
        'extra': {},
        'attachments': [],
    },
    {
        'id': 'book2-2025-0205-yoga-training',
        'module': 'event',
        'date': '2025-02-05',
        'title': '경로당 실버체조 요가 인지훈련',
        'body': '2025년 2월 5일부터 3월 26일까지 매주 수요일 13:00~14:00에 경로당 실버체조 요가 인지훈련을 실시함. 강사 노혜성.',
        'public': True,
        'book_include': True,
        'edition_period': '2025-2026',
        'status': 'active',
        'tags': ['운영책자', '본책2', '행사·회의기록부'],
        'source': '2025-26 운영대장 본책2 PDF 15쪽',
        'extra': {'end_date': '2025-03-26', 'time': '매주 수요일 13:00~14:00'},
        'attachments': [],
    },
    {
        'id': 'book2-2025-0409-yoga-training',
        'module': 'event',
        'date': '2025-04-09',
        'title': '경로당 실버체조 요가 인지훈련 (2차)',
        'body': '2025년 4월 9일부터 5월 28일까지 주 1회(수요일) 13:00~14:00 실버체조·요가·인지훈련을 실시함. 강사 황은정.',
        'public': True,
        'book_include': True,
        'edition_period': '2025-2026',
        'status': 'active',
        'tags': ['운영책자', '본책2', '행사·회의기록부'],
        'source': '2025-26 운영대장 본책2 PDF 15쪽',
        'extra': {'end_date': '2025-05-28', 'time': '주 1회(수요일) 13:00~14:00'},
        'attachments': [],
    },
    {
        'id': 'book2-2025-0412-wildfire-donation',
        'module': 'activity',
        'date': '2025-04-12',
        'title': '산불피해지역 돕기 모금 지출',
        'body': '산불피해지역 돕기 모금 30,000원 지출.',
        'public': True,
        'book_include': True,
        'edition_period': '2025-2026',
        'status': 'active',
        'tags': ['운영책자', '본책2', '행사·회의기록부'],
        'source': '2025-26 운영대장 본책2 PDF 15쪽',
        'extra': {},
        'attachments': [],
    },
    {
        'id': 'book2-2025-0604-line-dance',
        'module': 'event',
        'date': '2025-06-04',
        'title': '실버체조 요가 인지훈련 라인댄스',
        'body': '2025년 6월 4일부터 7월 29일까지 주 1회(수요일) 13:00~14:00 라인댄스 프로그램을 실시함. 강사 신혜진.',
        'public': True,
        'book_include': True,
        'edition_period': '2025-2026',
        'status': 'active',
        'tags': ['운영책자', '본책2', '행사·회의기록부'],
        'source': '2025-26 운영대장 본책2 PDF 15쪽',
        'extra': {'end_date': '2025-07-29', 'time': '주 1회(수요일) 13:00~14:00'},
        'attachments': [],
    },
    {
        'id': 'book2-2025-0806-yoga-training',
        'module': 'event',
        'date': '2025-08-06',
        'title': '경로당 실버체조 요가 인지훈련 (3차)',
        'body': '2025년 8월 6일부터 9월 24일까지 주 1회(수요일) 13:00~14:00 실버체조·요가·인지훈련을 실시함. 강사 이나연.',
        'public': True,
        'book_include': True,
        'edition_period': '2025-2026',
        'status': 'active',
        'tags': ['운영책자', '본책2', '행사·회의기록부'],
        'source': '2025-26 운영대장 본책2 PDF 15쪽',
        'extra': {'end_date': '2025-09-24', 'time': '주 1회(수요일) 13:00~14:00'},
        'attachments': [],
    },
    {
        'id': 'book2-2025-1015-yoga-training',
        'module': 'event',
        'date': '2025-10-15',
        'title': '경로당 실버체조 요가 인지훈련 (4차)',
        'body': '2025년 10월 15일부터 12월 5일까지 주 1회(수요일) 13:00~14:00 실버체조·요가·인지훈련을 실시함. 강사 이현주.',
        'public': True,
        'book_include': True,
        'edition_period': '2025-2026',
        'status': 'active',
        'tags': ['운영책자', '본책2', '행사·회의기록부'],
        'source': '2025-26 운영대장 본책2 PDF 15쪽',
        'extra': {'end_date': '2025-12-05', 'time': '주 1회(수요일) 13:00~14:00'},
        'attachments': [],
    },
]

# 모두 같은 2025-12-31 임시총회에 대한 일정/행사/활동 중복 기록.
DUPLICATE_IDS = {
    'book2-2025-1231-schedule',
    'book2-2025-1231-event',
    'book2-2025-1231-activity',
}
MEETING_ID = 'book2-2025-1231-meeting'


def update_records(path: Path, apply: bool = False):
    if not path.is_file():
        raise FileNotFoundError(f'운영 기록 파일을 찾을 수 없습니다: {path}')
    db = json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(db, dict) or not isinstance(db.get('records'), list):
        raise ValueError('records.json 구조가 예상과 다릅니다. 수정하지 않았습니다.')
    rows = db['records']
    ids = [str(x.get('id')) for x in rows]
    if len(ids) != len(set(ids)):
        raise ValueError('중복된 기록 ID가 있습니다. 자동 수정하지 않았습니다.')
    by_id = {x['id']: x for x in rows}
    if MEETING_ID not in by_id:
        raise ValueError('대표 임시총회 회의록을 찾지 못해 중복 정리를 중단합니다.')
    if not (by_id[MEETING_ID].get('module') == 'meeting' and by_id[MEETING_ID].get('date') == '2025-12-31'):
        raise ValueError('대표 임시총회 기록이 예상과 달라 중단합니다.')

    changes = []
    for payload in NEW:
        if payload['id'] in by_id:
            changes.append(f"유지(기존 ID): {payload['date']} {payload['title']}")
        elif any(r.get('date') == payload['date'] and r.get('title') == payload['title'] and r.get('status') != 'deleted' for r in rows):
            changes.append(f"유지(같은 날짜·제목): {payload['date']} {payload['title']}")
        else:
            record = dict(payload)
            now = datetime.now().isoformat(timespec='seconds')
            record.update(created_at=now, updated_at=now)
            rows.append(record)
            changes.append(f"추가: {payload['date']} {payload['title']}")

    for rid in sorted(DUPLICATE_IDS):
        rec = by_id.get(rid)
        if rec is None:
            changes.append(f'중복 기록 없음: {rid}')
            continue
        if rec.get('date') != '2025-12-31' or not any(k in str(rec.get('title', '')) for k in ('임시총회', '운영규정')):
            raise ValueError(f'기록 내용이 예상과 달라 수정하지 않았습니다: {rid}')
        if rec.get('status') == 'deleted':
            changes.append(f'이미 보관 처리: {rid}')
        else:
            rec['status'] = 'deleted'
            rec['updated_at'] = datetime.now().isoformat(timespec='seconds')
            changes.append(f'중복 보관 처리: {rid}')

    # 기존 회의록 자체는 어떤 필드도 변경하지 않습니다.
    changed = any(x.startswith(('추가:', '중복 보관 처리:')) for x in changes)
    for c in changes:
        print(' - ' + c)
    if not apply:
        print('미리보기입니다. 적용하려면 --apply 옵션을 지정하세요.')
        return changed
    if not changed:
        print('변경할 기록이 없어 파일을 수정하지 않았습니다.')
        return False
    backup_dir = path.parent / 'backups'
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / f"records.before-v3.8-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.json"
    shutil.copy2(path, backup)
    db['updated'] = datetime.now().date().isoformat()
    tmp = path.with_suffix('.json.v38tmp')
    try:
        with tmp.open('w', encoding='utf-8') as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
            f.write('\n')
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)
    print(f'적용 완료. 백업: {backup}')
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1], help='CenterHub 프로젝트 루트')
    ap.add_argument('--apply', action='store_true', help='파일 백업 후 실제로 수정')
    args = ap.parse_args()
    update_records(args.root / 'data' / 'records.json', args.apply)

if __name__ == '__main__':
    main()
