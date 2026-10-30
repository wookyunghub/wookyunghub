"""2025~2026 운영대장 본책1 PDF 70쪽 회의록에서 판독 가능한 범위만 등록."""
from datetime import datetime
from pathlib import Path
import shutil

SOURCE='2025-26 운영대장 본책1 PDF 70쪽 (인쇄 쪽수 8)' 
ITEMS=[
    {'id':'book1-2026-general-meeting-schedule','module':'event_schedule','date':'2026-02',
     'title':'2026년 정기총회','body':'2026년 2월 우경경로당 정기총회 개최. 정확한 일자는 원본 확인 후 관리자에서 보완해 주세요.',
     'extra':{'date_precision':'month','place':'우경경로당 회의실','attendance':'30명'},
     'tags':['정기총회','운영책자'],'source':SOURCE},
    {'id':'book1-2026-general-meeting-minutes','module':'meeting','date':'2026-02',
     'title':'2026년 정기총회 회의록',
     'body':'2026년 2월 정기총회 회의록. 의장 조영기, 참석인원 30명. 감사 선임, 부회장 추천, 2025년 예산·결산서 보고, 경로당 운영관리대장 발간, 비품 불용승인 및 승인절차 등에 관한 안건을 논의함. 개별 의결 결과는 원본과 재대조 필요.',
     'extra':{'date_precision':'month','participants':'30명','decisions':'감사 선임·부회장 추천·결산보고·운영관리대장 발간·비품 불용승인 관련 안건 (의결 결과는 원본 재확인)'},
     'tags':['정기총회','회의록','운영책자'],'source':SOURCE}
]

# 본책2의 날짜 및 제목은 원본 PDF 3·9·15·19쪽에서 대조했습니다.
# 소식 페이지는 실제 행사·회의 결과(event / meeting / activity)와 일정(event_schedule)을 구별합니다.
BOOK2_ITEMS = [
    ('book2-2025-1231-meeting','meeting','2025-12-31','2025년 12월 31일 임시총회','운영규정 제30조 제2항, 시행세칙 제6조 제1항 개정, 2025년 시설·비품 불용결정, 감사 및 부회장 선임, 연혁기록 누락 보완과 시설·비품 등재에 관해 논의. 회의록에는 참석회원 34명, 의장 조영기가 기재됨.',3),
    ('book2-2025-1231-event','event','2025-12-31','우경경로당 임시총회 개최','운영규정 및 시설·비품 관련 안건을 논의한 임시총회 개최. 자세한 결의 내용은 회의록 참조.',3),
    ('book2-2025-1231-schedule','event_schedule','2025-12-31','우경경로당 임시총회 일정','우경경로당 회관에서 임시총회 개최.',3),
    ('book2-2025-0921-schedule','event_schedule','2025-09-21','추석맞이 마을 대청소 일정','추석맞이 마을 대청소 및 참가 주민 아침식사 행사.',15),
    ('book2-2025-0212-event','event','2025-02-12','우경마을 정월 대보름놀이','우경마을 주관 정월 대보름놀이(11시), 경로당 회관.',15),
    ('book2-2025-0221-meeting','meeting','2025-02-21','대한노인회 진천군지회 정기총회','2025년 제48차 대의원 정기총회. 진천군 종합사회복지관 3층에서 개최. 2024년 예산결산 및 2025년 예산승인 등의 안건 기록.',15),
    ('book2-2025-0401-event','event','2025-04-01','봄나들이 야외 마을회 행사','우경마을회 주관 봄나들이 행사. 원본 행사기록표에 2025년 4월 1일로 기재.',15),
    ('book2-2025-0921-event','event','2025-09-21','추석맞이 마을 대청소 및 식사','추석맞이 마을 대청소와 참가주민 아침식사, 사랑의 저금통 모금행사 진행. 행사사진은 본책2 PDF 19쪽.',19),
    ('book2-2025-0930-event','event','2025-09-30','사랑의 모금행사 지원','사랑의 모금행사 모금액 205,720원을 대한노인회 진천군지회에 지원함.',15),
    ('book2-2025-1231-activity','activity','2025-12-31','임시총회 및 운영규정 개정','2025년 12월 31일 임시총회에서 규정 시행세칙 개정 및 시설·비품 불용 관련 사항을 처리. 본책2 PDF 3쪽 회의록 참조.',3),
]
for ident,mod,day,title,body,page in BOOK2_ITEMS:
    ITEMS.append({'id':ident,'module':mod,'date':day,'title':title,'body':body,
                  'extra':({'date_precision':'month'} if len(day)==7 else {}),
                  'tags':['운영책자','본책2'],'source':f'2025-26 운영대장 본책2 PDF {page}쪽'})

def import_2026_meeting(repo,root:Path,dry_run=True):
    db=repo.read('records',{'records':[]});existing={x.get('id') for x in db.get('records',[])}
    duplicates={(r.get('module'),r.get('date'),r.get('title')) for r in db.get('records',[]) if r.get('status')!='deleted'}
    to_add=[x for x in ITEMS if x['id'] not in existing and (x['module'],x['date'],x['title']) not in duplicates]
    response={'ok':True,'source':'본책1 70쪽 및 본책2 3·9·15·19쪽','total':len(ITEMS),'new':len(to_add),'existing':len(ITEMS)-len(to_add),'dry_run':dry_run}
    if dry_run or not to_add:return response
    path=Path(root)/'data'/'records.json'
    if path.exists():
        backup=Path(root)/'data'/'backups';backup.mkdir(parents=True,exist_ok=True)
        dest=backup/('records.before-meeting-import-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json')
        shutil.copy2(path,dest);response['backup']=dest.name
    for x in to_add:
        repo.create_record({'id':x['id'],'module':x['module'],'date':x['date'],'title':x['title'],'body':x['body'],
                            'public':True,'book_include':True,'edition_period':'2025-2026',
                            'source':x['source'],'tags':x['tags'],'extra':x['extra']})
    return response
