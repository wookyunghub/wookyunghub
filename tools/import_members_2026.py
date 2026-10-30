# -*- coding: utf-8 -*-
"""원본 PDF 전사 정보를 기존 회원과 병합; 기존 비어 있지 않은 관리자 수정값 우선."""
import json, datetime, shutil, sys
from pathlib import Path
base=Path(__file__).resolve().parents[1]
src=base/'imports/members_2026_from_book.json'; dest=base/'data/members.json'
if not (base/'server.py').exists():sys.exit('프로젝트 최상위 폴더에서 적용하세요.')
source=json.loads(src.read_text(encoding='utf-8'))['members']
obj=json.loads(dest.read_text(encoding='utf-8')) if dest.exists() else {'schema_version':1,'members':[]}
existing=obj.setdefault('members',[])
if not isinstance(existing,list):sys.exit('members.json 구조 오류')
if dest.exists():
 backup=dest.with_name('members.backup_'+datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')+'.json');shutil.copy2(dest,backup);print('백업:',backup)
added=filled=0
for row in source:
 match=next((x for x in existing if x.get('id')==row['id']),None)
 if match is None:
  match=next((x for x in existing if x.get('status')!='deleted' and x.get('name')==row['name'] and x.get('birth_date')==row['birth_date']),None)
 if match is None:existing.append(dict(row));added+=1;continue
 for k,v in row.items():
  if k in ('id','public','status','created_at','updated_at'):continue
  if k=='notes' and match.get('notes','').startswith('운영책자 회원명부 PDF'):match[k]=v;filled+=1;continue
  if (match.get(k) is None or match.get(k)=='') and v not in ('',None):match[k]=v;filled+=1
# atomic write
dest.parent.mkdir(parents=True,exist_ok=True)
tmp=dest.with_suffix('.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');tmp.replace(dest)
print(f'완료: 새 회원 {added}명, 누락 항목 보충 {filled}개, 전체 {len(existing)}명')
