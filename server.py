#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
import argparse, hashlib, json, mimetypes, os, re, secrets, shutil, subprocess, threading, time, urllib.request, webbrowser
from app.repository import JsonRepository
from app.services import PublicationService
from datetime import date as calendar_date
from app.member_import import import_members
from app.record_types import RECORD_TYPES, normalize_record_types
from app.file_retention import retain_deleted_resource, retention_worker

ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT/'public'; STORAGE=ROOT/'storage'
REPO=JsonRepository(ROOT); PUBSVC=PublicationService(ROOT,REPO)
UPLOAD_LOCK=threading.Lock()
MUTATION_LOCK=threading.RLock()
APP_VERSION='1.4'
RUN_MODE='production'
SESSIONS={}; SESSION_SECONDS=4*60*60
mimetypes.add_type('image/bmp','.bmp')
LOGIN_ATTEMPTS={}; LOGIN_WINDOW=300; LOGIN_LIMIT=8
UPLOAD_EXTENSIONS={'.pdf','.hwp','.hwpx','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.jpg','.jpeg','.png','.bmp','.webp','.gif','.mp4','.mov','.zip'}

ATTACHMENT_ROLES={'minutes':'회의록 원본','attendance':'참석명단','report':'보고자료','receipt':'영수증·증빙','other':'기타'}
PRIVATE_ATTACHMENT_ROLES={'receipt'}

def resource_policy(kind, role, public):
    if role and role not in ATTACHMENT_ROLES:raise ValueError('지원하지 않는 첨부 유형입니다.')
    if role=='receipt':kind='receipts'
    elif role:kind='documents'
    return kind, bool(public) and kind!='receipts' and role not in PRIVATE_ATTACHMENT_ROLES

def validate_resource_date(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):
        raise ValueError('자료 날짜를 달력에서 선택해 주세요.')
    try:calendar_date.fromisoformat(value)
    except ValueError:raise ValueError('올바른 자료 날짜를 선택해 주세요.')
    return value

def resource_links(kind, file_id):
    key=f'{kind}:{file_id}'
    return [{'id':r['id'],'title':r.get('title',''),'date':r.get('date','')} for r in REPO.list_records() if key in (r.get('attachments') or [])]

def resources_for_admin():
    out=read_json(STORAGE/'resources.json',{'documents':[],'photos':[],'receipts':[]})
    for kind in ('documents','photos','receipts'):
        out[kind]=[{**x,'linked_records':resource_links(kind,x.get('id',''))} for x in out.get(kind,[])]
    return out

def move_resource_file(item, public):
    # 공개 여부와 실제 파일 경로를 함께 변경합니다.
    source=(STORAGE/item.get('path','')).resolve()
    if not source.is_relative_to(STORAGE.resolve()) or not source.is_file():raise ValueError('원본 파일을 찾을 수 없습니다.')
    parts=Path(item['path']).parts
    if len(parts)!=3 or parts[0] not in ('public','private'):raise ValueError('지원하지 않는 저장 경로입니다.')
    scope='public' if public else 'private';relative=Path(scope)/parts[1]/parts[2];dest=STORAGE/relative
    if source!=dest.resolve():
        if dest.exists():raise ValueError('이동할 위치에 같은 파일이 있습니다.')
        dest.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(source),str(dest))
    item.update({'public':public,'path':relative.as_posix(),'url':'/media/'+relative.as_posix()})

def set_resource_public(item, public):
    original=dict(item);pdf=dict(item.get('pdf') or {})
    move_resource_file(item,public)
    try:
        if pdf:move_resource_file(pdf,public);item['pdf']=pdf
    except (ValueError,OSError):
        move_resource_file(item,original['public'])
        raise

FINANCE_CATEGORIES={'own':'자체경비','operation':'운영비','heating':'냉난방비'}
FINANCE_FILE=STORAGE/'finance_summaries.json'
SENSITIVE_BOOK1_PAGES=set(range(47,61))  # 결산서·금품수납부 및 거래별 원본 페이지 (47~60)

def published_finance():
    raw=read_json(FINANCE_FILE,{'rows':[]})
    return {'rows':[{'year':r['year'],'kind':r['kind'],'label':FINANCE_CATEGORIES[r['kind']],
                     'opening':r['opening'],'income':r['income'],'expense':r['expense'],'closing':r['closing']}
                    for r in raw.get('rows',[]) if r.get('published') and r.get('kind') in FINANCE_CATEGORIES]}

MODULES=set(RECORD_TYPES)

def read_json(p,fallback):
    try:return json.loads(Path(p).read_text(encoding='utf-8'))
    except Exception:return fallback

def write_json(p,obj):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(tmp,p)

def human(n):
    for u in ['B','KB','MB','GB']:
        if n<1024:return f'{n:.0f} {u}' if u=='B' else f'{n:.1f} {u}'
        n/=1024
    return f'{n:.1f} TB'

def find_cloudflared():
    names=['cloudflared.exe','cloudflared-windows-amd64.exe']
    candidates=[*(ROOT.parent/'TOOLS'/n for n in names),*(ROOT/'tools'/n for n in names),*(Path.home()/'Downloads'/n for n in names)]
    for c in candidates:
        if c.exists():print(f'[cloudflared] 사용 파일: {c}');return str(c)
    return shutil.which('cloudflared') or ''

def public_organization(org=None):
    """Return only fields that are safe for the public homepage.

    Detailed officer fields (birth date, phone, address, notes) stay in data/organization.json
    and are available only through the authenticated admin API / publication snapshot.
    """
    org=REPO.organization_data(org if isinstance(org,dict) else None)
    out={}
    for k in ('basic','officers_note','facilities','access','history_source','updated'):
        if k in org:out[k]=org[k]
    chart=org.get('organization_chart') or {}
    pubchart={'source':chart.get('source') or {},'officers':[],'board':[]}
    for kind in ('officers','board'):
        for x in chart.get(kind,[]) or []:
            if x.get('public',True) is False:continue
            pubchart[kind].append({'id':x.get('id',''),'position':x.get('position',''),'name':x.get('name',''),'public':True})
    out['organization_chart']=pubchart
    return out

def sync_public_organization(org=None):
    write_json(PUBLIC/'data/organization.json',public_organization(org))


# 회원 원본 정보는 data/members.json에만 보관하며 정적 public 경로에 복사하지 않습니다.
def member_list():
    db=REPO.read('members',{'members':[]})
    return db.get('members',[]) if isinstance(db,dict) else []

def _member_age(birth):
    from datetime import date
    try:
        born=date.fromisoformat(str(birth).strip())
        today=date.today()
        age=today.year-born.year-((today.month,today.day)<(born.month,born.day))
        return age if 0<=age<=125 else None
    except (ValueError,TypeError):return None

def _masked_name(name):
    name=str(name or '').strip()
    if len(name)<=1:return '*' if name else ''
    if len(name)==2:return name[0]+'*'
    return name[0]+'*'*(len(name)-2)+name[-1]

def public_members():
    # 민감한 생년월일, 연락처, 주소, 고유 ID는 API로 반환하지 않습니다.
    rows=[]
    for x in member_list():
        if x.get('status','active')!='active' or x.get('public',True) is False:continue
        rows.append({'name':_masked_name(x.get('name')),
                     'member_type':x.get('member_type',''),
                     'gender':x.get('gender',''),
                     'age':_member_age(x.get('birth_date'))})
    return {'members':rows,'updated':time.strftime('%Y-%m-%d')}

def validate_member(d):
    if not isinstance(d,dict):raise ValueError('잘못된 데이터입니다.')
    name=str(d.get('name','')).strip()
    if not name or len(name)>100:raise ValueError('이름을 확인해 주세요.')
    if len(str(d.get('notes','')))>3000:raise ValueError('비고는 3000자 이내로 입력해 주세요.')
    safe={k:str(d.get(k,'')).strip()[:3000 if k=='notes' else 200] for k in ('name','member_type','gender','birth_date','phone','home_phone','mobile_phone','address','joined_date','notes')}
    if 'status' in d:
        if d['status'] not in ('active','deceased','withdrawn'):raise ValueError('회원 상태를 확인해 주세요.')
        safe['status']=d['status']
    for key in ('status_date','status_reason'):
        if key in d:safe[key]=str(d[key]).strip()[:500]
    if safe.get('status_date'):
        try:calendar_date.fromisoformat(safe['status_date'])
        except ValueError:raise ValueError('상태 처리일을 확인해 주세요.')
    safe['public']=d.get('public',True) is True
    return safe

def attendee_snapshot(extra, previous=None):
    members=[m for m in member_list() if m.get('status','active')!='deleted']
    by_id={m.get('id'):m for m in members if m.get('id')}
    by_name={}
    for member in members:by_name.setdefault(member.get('name',''),[]).append(member)
    prior={a.get('id'):a for a in (previous or []) if isinstance(a,dict) and a.get('id')}
    prior_names={}
    for a in (previous or []):
        if isinstance(a,dict) and not a.get('id'):prior_names.setdefault(a.get('name'),[]).append(a)
    result=[]
    manual=set(extra.get('attendee_manual_names') or [])
    ids=extra.get('attendee_ids') or []
    names=extra.get('attendee_names') or []
    for index,name in enumerate(names):
        mid=ids[index] if index<len(ids) else ''
        old=prior.get(mid) if mid else (prior_names.get(name,[None])[0] if len(prior_names.get(name,[]))==1 else None)
        if old and old.get('name')==name:
            saved=dict(old)
            member=by_id.get(mid)
            if saved.get('gender') not in ('남','여') and member and member.get('gender') in ('남','여'):saved['gender']=member['gender']
            saved['attendee_type']='member' if mid else ('nonmember' if name in manual else saved.get('attendee_type','unknown'))
            result.append(saved);continue
        member=by_id.get(mid) if mid else None
        if not member and name not in manual and len(by_name.get(name,[]))==1:member=by_name[name][0]
        gender=member.get('gender','') if member else ''
        result.append({'id':mid,'name':name,'gender':gender if gender in ('남','여') else '',
                       'attendee_type':'member' if mid or member else ('nonmember' if name in manual else 'unknown')})
    return result

def migrate_attendee_snapshots():
    db=REPO.read('records',{'records':[]});changed=0
    for record in db.get('records',[]):
        extra=record.get('extra') or {}
        if record.get('module') in ('meeting','event') and extra.get('attendee_names') :
            repaired=attendee_snapshot(extra,extra.get('attendees'))
            if extra.get('attendees')!=repaired:
                extra['attendees']=repaired
                record['extra']=extra;changed+=1
    if changed:
        source=ROOT/'data/records.json';backup=ROOT/'data/backups'/f'records.before-attendee-gender-{time.time_ns()}.json'
        backup.parent.mkdir(parents=True,exist_ok=True);backup.write_bytes(source.read_bytes());REPO.write('records',db)

def normalize_meeting_attendees(payload):
    """Validate member IDs and manually entered meeting guests before persisting."""
    if payload.get('module') not in ('meeting', 'event'):
        return payload
    extra = dict(payload.get('extra') or {})
    if 'attendee_ids' not in extra and 'attendee_manual_names' not in extra:
        return payload
    ids = extra.get('attendee_ids', [])
    manual = extra.get('attendee_manual_names', [])
    if not isinstance(ids, list) or len(ids) > 500 or any(not isinstance(i, str) for i in ids) or len(ids) != len(set(ids)):
        raise ValueError('참석자 선택 정보가 올바르지 않습니다.')
    if not isinstance(manual, list) or len(manual) > 100 or any(not isinstance(n, str) or not n.strip() or len(n.strip()) > 30 for n in manual):
        raise ValueError('명부 외 참석자 이름이 올바르지 않습니다.')
    manual = [n.strip() for n in manual]
    if len(manual) != len(set(manual)):
        raise ValueError('명부 외 참석자가 중복 입력되었습니다.')
    members = {m['id']: m for m in member_list() if m.get('id') and m.get('status', 'active') != 'deleted'}
    if any(i not in members for i in ids):
        raise ValueError('회원명부에 없는 참석자 ID가 포함되어 있습니다.')
    member_names = [members[i].get('name', '') for i in ids]
    if any(n in set(member_names) for n in manual):
        raise ValueError('회원 선택과 직접 입력에 동일한 이름이 중복되었습니다.')
    extra['attendee_ids'] = ids
    extra['attendee_manual_names'] = manual
    extra['attendee_names'] = member_names + manual
    extra['attendees'] = attendee_snapshot(extra)
    extra['participants'] = f'{len(ids) + len(manual)}명' if ids or manual else ''
    payload = dict(payload)
    payload['extra'] = extra
    return payload

def admin_recorder_title():
    # 공용 PIN 로그인에는 사용자별 신원이 없습니다. 설정된 직함을 기본값으로 사용합니다.
    cfg=REPO.read_config('admin',{})
    title=str(cfg.get('recorder_title') or '관리자').strip()
    return title[:50] or '관리자'

def normalize_recorder(payload,existing=None):
    if payload.get('module') not in ('notice','meeting','event','activity','event_schedule'):
        return payload
    payload=dict(payload)
    value=payload.get('recorder', None)
    if value is None: value=(existing or {}).get('recorder') or admin_recorder_title()
    value=str(value).strip()
    if len(value)>50:raise ValueError('기록자는 50자 이내로 입력해 주세요.')
    payload['recorder']=value or (existing or {}).get('recorder') or admin_recorder_title()
    return payload

def public_news_record(record):
    """Publish only attendee names deliberately selected for this meeting, never member IDs."""
    result = dict(record)
    extra = dict(result.get('extra') or {})
    extra.pop('attendee_ids',None)
    extra.pop('attendee_manual_names',None)
    # 관리자에는 실명 유지; 공개 회의록에서만 기존 회원명부와 동일하게 마스킹합니다.
    if isinstance(extra.get('attendee_names'),list):
        extra['attendee_names'] = [_masked_name(name) for name in extra['attendee_names'] if isinstance(name,str) and name.strip()]
    if isinstance(extra.get('attendees'),list):
        extra['attendees']=[{'name':_masked_name(a.get('name','')),'gender':a.get('gender','') if a.get('gender') in ('남','여') else '', 'attendee_type':a.get('attendee_type') if a.get('attendee_type') in ('member','nonmember') else 'unknown'} for a in extra['attendees'] if isinstance(a,dict) and isinstance(a.get('name'),str) and a['name'].strip()]
    result['extra'] = extra
    return result

def open_browser_when_ready(port):
    url=f'http://127.0.0.1:{port}/'
    for _ in range(80):
        try:
            with urllib.request.urlopen(url,timeout=1) as r:
                if r.status < 500:
                    opened=webbrowser.open(url,new=2)
                    if not opened and os.name=='nt':
                        try:os.startfile(url)
                        except Exception:pass
                    print(f'[브라우저] 홈페이지 자동 열기: {url}')
                    return
        except Exception:
            time.sleep(0.15)
    print(f'[안내] 브라우저 자동 열기에 실패했습니다. 직접 접속해 주세요: {url}')

class Handler(SimpleHTTPRequestHandler):
    server_version='CenterHub/'+APP_VERSION
    def translate_path(self,path):
        # Prevent URL-encoded and parent-directory traversal outside public/.
        rel=unquote(urlparse(path).path).lstrip('/') or 'index.html'
        target=(PUBLIC/rel).resolve()
        if not target.is_relative_to(PUBLIC.resolve()):
            return str(PUBLIC/'__not_found__')
        return str(target)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','strict-origin-when-cross-origin')
        self.send_header('X-Frame-Options','SAMEORIGIN')
        super().end_headers()
    def json(self,obj,status=200):
        b=json.dumps(obj,ensure_ascii=False).encode('utf-8');self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.end_headers();
        if self.command!='HEAD':self.wfile.write(b)
    def body_json(self):
        n=int(self.headers.get('Content-Length','0') or 0)
        if n<0 or n>2*1024*1024:raise ValueError('요청 데이터 크기 제한(2MB)을 초과했습니다.')
        return json.loads(self.rfile.read(n) or b'{}')
    def session(self):
        m=re.search(r'centerhub_session=([^;]+)',self.headers.get('Cookie',''));sid=m.group(1) if m else ''
        if sid and sid in SESSIONS and time.time()-SESSIONS[sid]<SESSION_SECONDS:return sid
        if sid:SESSIONS.pop(sid,None)
        return ''
    def need_admin(self):
        if self.session():return True
        self.json({'error':'관리자 로그인이 필요합니다.'},401);return False
    def need_publication_management(self):
        if not self.need_admin():return False
        if RUN_MODE!='development':
            self.json({'error':'운영대장·발간 관리는 개발용 실행에서만 사용할 수 있습니다.'},403)
            return False
        return True
    def publication_page(self):
        return Path(self.translate_path(self.path)).resolve()==(PUBLIC/'admin/ledgers.html').resolve()
    def sensitive_book_page(self):
        """Authorize by the resolved file, so alternate URL spellings cannot bypass it."""
        target=Path(self.translate_path(self.path)).resolve()
        book=(PUBLIC/'assets/docs/book1').resolve()
        if not target.is_relative_to(book):return False
        m=re.fullmatch(r'p(\d{3})\.webp',target.name,re.I)
        return bool(m and int(m.group(1)) in SENSITIVE_BOOK1_PAGES)
    def do_HEAD(self):
        if self.publication_page() and not self.need_publication_management():return
        if self.sensitive_book_page() and not self.session():
            return self.json({'error':'이 페이지는 관리자 전용입니다.'},403)
        return super().do_HEAD()
    def public_news(self):
        # Unified public feed; retain legacy fields for older clients.
        notices=[public_news_record(r) for r in REPO.list_records('notice',public_only=True)]
        events=[public_news_record(r) for r in REPO.list_records('event_schedule',public_only=True)]
        activities=[public_news_record(r) for module in ('activity','meeting','event') for r in REPO.list_records(module,public_only=True)]
        activities=sorted(activities+events,key=lambda x:(REPO._date_key(x.get('date')),x.get('updated_at','')),reverse=True)
        feed=sorted(notices+activities,key=lambda x:(REPO._date_key(x.get('date')),x.get('updated_at','')),reverse=True)
        return {'feed':feed,'notices':notices,'events':events,'activities':activities,'updated':time.strftime('%Y-%m-%d')}
    def public_publications(self):
        d=REPO.read('publications',{'publications':[]});pubs=d.get('publications',[]);cur=next((x for x in pubs if x.get('status')=='current'),pubs[0] if pubs else None);arc=[x for x in pubs if x is not cur];return {'current':cur,'archives':arc,'publications':pubs,'ebook_settings':d.get('ebook_settings',{})}
    def do_GET(self):
        p=urlparse(self.path);path=p.path;q=parse_qs(p.query)
        if self.publication_page() and not self.need_publication_management():return
        # Security boundary: scan images include names, transactions, financial and receipt details.
        # A hidden menu or JavaScript watermark is NOT access control.
        if self.sensitive_book_page() and not self.session():
            return self.json({'error':'이 페이지는 관리자 전용입니다.'},403)
        if path=='/api/public/finance-summary':return self.json(published_finance())
        if path=='/api/admin/finance-summary':
            if not self.need_admin():return
            return self.json(read_json(FINANCE_FILE,{'rows':[]}))
        if path=='/api/public/members':return self.json(public_members())
        if path=='/api/public/site':return self.json(REPO.read('site',{}))
        if path=='/api/public/organization':return self.json(public_organization())
        if path=='/api/public/news':return self.json(self.public_news())
        if path=='/api/public/publications':return self.json(self.public_publications())
        if path=='/api/public/history':
            return self.json({'records':[public_news_record(r) for r in REPO.list_records(public_only=True) if r.get('module')!='notice' and r.get('history_excluded') is not True]})
        if path=='/api/public/records':
            module=q.get('module',[''])[0];mods=[m for m in module.split(',') if m]
            if not mods:return self.json([public_news_record(r) for r in REPO.list_records(public_only=True)])
            rows=[]
            for m in mods:rows.extend(REPO.list_records(m,public_only=True))
            rows.sort(key=lambda x:x.get('date',''),reverse=True);return self.json({'records':[public_news_record(r) for r in rows]})
        if path=='/api/public/resources':
            d=read_json(STORAGE/'resources.json',{'documents':[],'photos':[],'receipts':[]});return self.json({'documents':[x for x in d.get('documents',[]) if x.get('public')],'photos':[x for x in d.get('photos',[]) if x.get('public')]})
        if path=='/api/admin/members':
            if not self.need_admin():return
            return self.json({'members':[x for x in member_list() if x.get('status','active')!='deleted'], 'total':len([x for x in member_list() if x.get('status','active')!='deleted'])})
        if path=='/api/admin/status':return self.json({'authenticated':bool(self.session()),'app_version':APP_VERSION,'record_editor_version':APP_VERSION,'environment':RUN_MODE,'features':{'publication_management':RUN_MODE=='development','record_save':True,'resolved_private_page_guard':True},**({'recorder_title':admin_recorder_title()} if self.session() else {})})
        if path=='/api/admin/records':
            if not self.need_admin():return
            module=q.get('module',[''])[0] or None;return self.json({'records':REPO.list_records(module=module,include_deleted=False)})
        if path=='/api/admin/publications':
            if not self.need_publication_management():return
            return self.json(self.public_publications())
        if path=='/api/admin/data':
            if not self.need_admin():return
            name=q.get('name',[''])[0]
            if name=='site':return self.json(REPO.read('site',{}))
            if name in ('about','organization'):return self.json(REPO.read('organization',{}))
            if name in ('ledgers','publications'):
                if not self.need_publication_management():return
                return self.json(self.public_publications())
            if name=='news':return self.json(self.public_news())
            return self.json({'error':'지원하지 않는 데이터입니다.'},400)
        if path=='/api/admin/files':
            if not self.need_admin():return
            return self.json(resources_for_admin())
        if path=='/api/admin/originals':
            if not self.need_admin():return
            files=[{'name':f.name,'size':f.stat().st_size,'size_text':human(f.stat().st_size)} for f in sorted((STORAGE/'private/originals').glob('*.pdf'))];return self.json({'files':files})
        if path=='/api/admin/original':
            if not self.need_admin():return
            name=Path(q.get('name',[''])[0]).name;f=STORAGE/'private/originals'/name
            if not f.exists():return self.send_error(404)
            return self.stream_file(f,True)
        if path.startswith('/media/public/'):
            f=(STORAGE/'public'/path[len('/media/public/'):]).resolve()
            if not f.is_relative_to((STORAGE/'public').resolve()) or not f.is_file():return self.send_error(404)
            return self.stream_file(f,q.get('download',[''])[0]=='1')
        if path.startswith('/media/private/'):
            if not self.need_admin():return
            f=(STORAGE/'private'/path[len('/media/private/'):]).resolve()
            if not f.is_relative_to((STORAGE/'private').resolve()) or not f.is_file():return self.send_error(404)
            return self.stream_file(f,q.get('download',[''])[0]=='1')
        if path.startswith('/api/'):
            return self.json({'error':'현재 실행 서버가 지원하지 않는 API입니다. 서버 재시작과 실행 폴더를 확인해 주세요.','app_version':APP_VERSION},404)
        return super().do_GET()
    def stream_file(self,f,attachment=False):
        attachment=attachment or f.suffix.lower() in ('.hwp','.hwpx','.doc','.docx')
        filename=f.name
        if attachment:
            resources=read_json(STORAGE/'resources.json',{})
            for kind in ('documents','photos','receipts'):
                for item in resources.get(kind,[]):
                    for part in [item]+([item['pdf']] if item.get('pdf') else []):
                        if part.get('path') and (STORAGE/part['path']).resolve()==f.resolve():filename=part.get('name') or filename
        from urllib.parse import quote
        c=mimetypes.guess_type(f.name)[0] or 'application/octet-stream';self.send_response(200);self.send_header('Content-Type',c);self.send_header('Content-Length',str(f.stat().st_size));self.send_header('Content-Disposition',f"{'attachment' if attachment else 'inline'}; filename*=UTF-8''{quote(filename,safe='')}");self.end_headers()
        with f.open('rb') as x:shutil.copyfileobj(x,self.wfile)
    def do_POST(self):
        with MUTATION_LOCK:return self._do_POST()
    def _do_POST(self):
        path=urlparse(self.path).path
        if path=='/api/admin/login':
            ip=self.client_address[0];now=time.time()
            attempts=[t for t in LOGIN_ATTEMPTS.get(ip,[]) if now-t<LOGIN_WINDOW]
            if len(attempts)>=LOGIN_LIMIT:return self.json({'error':'로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.'},429)
            d=self.body_json();cfg=REPO.read_config('admin',{});h=hashlib.sha256((d.get('pin') or '').encode()).hexdigest()
            if not secrets.compare_digest(h,cfg.get('preview_pin_sha256','')):
                LOGIN_ATTEMPTS[ip]=attempts+[now]
                return self.json({'error':'관리 PIN이 올바르지 않습니다.'},403)
            LOGIN_ATTEMPTS.pop(ip,None)
            sid=secrets.token_urlsafe(24);SESSIONS[sid]=time.time();b=b'{"ok":true}';self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Set-Cookie',f'centerhub_session={sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age={SESSION_SECONDS}');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
        if path=='/api/admin/logout':
            sid=self.session();SESSIONS.pop(sid,None);b=b'{"ok":true}';self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Set-Cookie','centerhub_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
        if path=='/api/admin/change-pin':
            if not self.need_admin():return
            d=self.body_json();cfg=REPO.read_config('admin',{});old=hashlib.sha256((d.get('old_pin') or '').encode()).hexdigest()
            if not secrets.compare_digest(old,cfg.get('preview_pin_sha256','')):return self.json({'error':'현재 PIN이 올바르지 않습니다.'},400)
            new=d.get('new_pin') or ''
            if len(new)<6:return self.json({'error':'새 PIN은 6자 이상으로 입력해 주세요.'},400)
            cfg['preview_pin_sha256']=hashlib.sha256(new.encode()).hexdigest();REPO.write_config('admin',cfg);return self.json({'ok':True})
        if path=='/api/admin/members/import':
            if not self.need_admin():return
            try:
                request=self.body_json()
                if not isinstance(request,dict) or request.get('action') not in ('preview','import'):
                    return self.json({'error':'가져오기 요청이 올바르지 않습니다.'},400)
                return self.json(import_members(ROOT,preview=request['action']=='preview'))
            except (ValueError, OSError, json.JSONDecodeError) as e:
                return self.json({'error':str(e)},400)
        if path=='/api/admin/members/publish-active':
            if not self.need_admin():return
            d=self.body_json()
            if d.get('confirm') is not True:return self.json({'error':'공개 전환 확인이 필요합니다.'},400)
            db=REPO.read('members',{'members':[]})
            candidates=[m for m in db.get('members',[]) if m.get('status','active')=='active' and m.get('public',True) is False]
            if candidates:
                import shutil
                from datetime import datetime
                source=ROOT/'data/members.json'
                if source.exists():
                    backup=ROOT/'data/backups';backup.mkdir(parents=True,exist_ok=True)
                    shutil.copy2(source,backup/('members.before-public-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json'))
                for m in candidates:m['public']=True
                REPO.write('members',db)
            return self.json({'ok':True,'updated':len(candidates)})
        if path=='/api/admin/members':
            if not self.need_admin():return
            try:item=validate_member(self.body_json())
            except ValueError as e:return self.json({'error':str(e)},400)
            db=REPO.read('members',{'members':[]});db.setdefault('members',[])
            item.update({'id':'member-'+secrets.token_hex(8),'status':'active','created_at':time.strftime('%Y-%m-%dT%H:%M:%S')})
            db['members'].append(item);REPO.write('members',db)
            return self.json({'ok':True,'item':item})
        if path=='/api/admin/import/meeting-2026':
            if not self.need_admin():return
            from app.meeting_import import import_2026_meeting
            try:
                dry_run=bool(self.body_json().get('dry_run',True))
                result=import_2026_meeting(REPO,ROOT,dry_run=dry_run)
                if not dry_run:normalize_record_types(REPO,ROOT)
                return self.json(result)
            except (OSError,ValueError) as e:return self.json({'error':str(e)},400)
        if path=='/api/admin/records':
            if not self.need_admin():return
            d=self.body_json();module=d.get('module','')
            if 'history_excluded' in d and type(d['history_excluded']) is not bool:return self.json({'error':'연혁 제외값이 올바르지 않습니다.'},400)
            if module not in MODULES:return self.json({'error':'지원하지 않는 자료구분입니다.'},400)
            if not (d.get('title') or '').strip():return self.json({'error':'제목을 입력해 주세요.'},400)
            
            try:
                d=normalize_recorder(d)
                d=normalize_meeting_attendees(d)
            except ValueError as e:return self.json({'error':str(e)},400)
            return self.json({'ok':True,'item':REPO.create_record(d)})
        if path=='/api/admin/finance-summary':
            if not self.need_admin():return
            try:
                d=self.body_json();year=str(d.get('year','')).strip();kind=d.get('kind')
                if not re.fullmatch(r'20\d{2}',year) or kind not in FINANCE_CATEGORIES:
                    raise ValueError('결산연도와 항목을 확인해 주세요.')
                row={'year':year,'kind':kind,'published':d.get('published') is True}
                for key in ('opening','income','expense','closing'):
                    v=d.get(key)
                    if type(v) is not int or not 0<=v<=1_000_000_000_000:
                        raise ValueError('금액은 0 이상인 정수(원)로 입력해 주세요.')
                    row[key]=v
                obj=read_json(FINANCE_FILE,{'rows':[]});rows=obj.get('rows',[])
                rows=[x for x in rows if not (x.get('year')==year and x.get('kind')==kind)]
                rows.append(row);rows.sort(key=lambda x:(x['year'],x['kind']),reverse=True)
                write_json(FINANCE_FILE,{'rows':rows});return self.json({'ok':True,'item':row})
            except (ValueError,TypeError) as e:return self.json({'error':str(e)},400)
        if path=='/api/admin/publication/snapshot':
            if not self.need_publication_management():return
            try:return self.json(PUBSVC.create_snapshot(**self.body_json()))
            except Exception as e:return self.json({'error':str(e)},400)
        if path=='/api/admin/data':
            if not self.need_admin():return
            d=self.body_json();name=d.get('name');obj=d.get('data',{})
            if name=='site':
                if not isinstance(obj,dict):return self.json({'error':'기본설정 형식이 올바르지 않습니다.'},400)
                for key,limit in (('organization_name',100),('parent_organization',200),('branch_name',100)):
                    value=obj.get(key,'')
                    if not isinstance(value,str) or len(value.strip())>limit:return self.json({'error':'조직명/소속 입력을 확인해 주세요.'},400)
                    obj[key]=value.strip()
                if not obj['organization_name']:return self.json({'error':'조직명을 입력해 주세요.'},400)
                REPO.write('site',obj);sync_public_organization(REPO.organization_data());return self.json({'ok':True})
            if name in ('about','organization'):
                REPO.write('organization',obj);sync_public_organization(obj);return self.json({'ok':True})
            return self.json({'error':'이 데이터는 통합 기록 관리에서 수정해 주세요.'},400)
        if path=='/api/admin/upload':
            if not self.need_admin():return
            return self.handle_upload()
        return self.send_error(404)
    def do_PATCH(self):
        with MUTATION_LOCK:return self._do_PATCH()
    def _do_PATCH(self):
        with UPLOAD_LOCK:return self._do_PATCH()
    def _do_PATCH(self):
        path=urlparse(self.path).path
        if path=='/api/admin/member':
            if not self.need_admin():return
            d=self.body_json();mid=d.get('id');db=REPO.read('members',{'members':[]})
            item=next((x for x in db.get('members',[]) if x.get('id')==mid and x.get('status','active')!='deleted'),None)
            if not item:return self.json({'error':'회원을 찾을 수 없습니다.'},404)
            try:clean=validate_member(d)
            except ValueError as e:return self.json({'error':str(e)},400)
            item.update(clean);item['updated_at']=time.strftime('%Y-%m-%dT%H:%M:%S');REPO.write('members',db)
            return self.json({'ok':True})
        if path=='/api/admin/record':
            if not self.need_admin():return
            d=self.body_json()
            current=next((r for r in REPO.list_records() if r.get('id')==d.get('id')),None)
            if 'history_excluded' in d and type(d['history_excluded']) is not bool:return self.json({'error':'연혁 제외값이 올바르지 않습니다.'},400)
            if current:
                try:
                    module=d.get('module',current.get('module'))
                    if module!=current.get('module'):
                        if current.get('module')=='notice' or module not in {'meeting','event','facility','document'}:
                            raise ValueError('자료구분 변경은 회의·행사·시설/비품·기타 운영 중에서 선택해 주세요.')
                    d=normalize_recorder({**d,'module':module},current)
                    if module in ('meeting','event'):
                        old_extra=current.get('extra') or {};new_extra=d.get('extra') or {}
                        roster_changed=any(new_extra.get(k,[])!=old_extra.get(k,[]) for k in ('attendee_ids','attendee_manual_names'))
                        if roster_changed:
                            d=normalize_meeting_attendees(d)
                            prior={a.get('id'):a for a in old_extra.get('attendees',[]) if a.get('id')}
                            ids=d['extra'].get('attendee_ids',[])
                            d['extra']['attendee_names']=[prior[i]['name'] if i in prior else d['extra']['attendee_names'][n] for n,i in enumerate(ids)]+d['extra'].get('attendee_manual_names',[])
                            d['extra']['attendees']=attendee_snapshot(d['extra'],old_extra.get('attendees'))
                        else:
                            # The browser cannot replace historical names/gender during unrelated edits.
                            for key in ('attendee_ids','attendee_manual_names','attendee_names','attendees'):
                                if key in old_extra:new_extra[key]=old_extra[key]
                            if new_extra.get('attendee_names'):new_extra['attendees']=attendee_snapshot(new_extra,old_extra.get('attendees'))
                            d['extra']=new_extra
                except ValueError as e:return self.json({'error':str(e)},400)
            item=REPO.update_record(d.get('id',''),d)
            return self.json({'ok':True,'item':item}) if item else self.json({'error':'자료를 찾을 수 없습니다.'},404)
        if path=='/api/admin/file':
            if not self.need_admin():return
            d=self.body_json();kind,id=d.get('kind'),d.get('id');idx=read_json(STORAGE/'resources.json',{'documents':[],'photos':[],'receipts':[]});item=next((x for x in idx.get(kind,[]) if x.get('id')==id),None)
            if not item:return self.json({'error':'자료를 찾을 수 없습니다.'},404)
            try:resource_date=validate_resource_date(d.get('date',item.get('date')))
            except ValueError as error:return self.json({'error':str(error)},400)
            if 'public' in d:
                if type(d['public']) is not bool:return self.json({'error':'공개 여부가 올바르지 않습니다.'},400)
                _,pub=resource_policy(kind,item.get('attachment_role',''),d['public'])
                try:set_resource_public(item,pub)
                except (ValueError,OSError) as e:return self.json({'error':str(e)},400)
            item['date']=resource_date
            for k in ('title','description'):
                if k in d:item[k]=d[k]
            write_json(STORAGE/'resources.json',idx);self.sync_public_resources(idx);return self.json({'ok':True})
        return self.send_error(404)
    def do_DELETE(self):
        with MUTATION_LOCK:return self._do_DELETE()
    def _do_DELETE(self):
        with UPLOAD_LOCK:return self._do_DELETE()
    def _do_DELETE(self):
        path=urlparse(self.path).path
        if path=='/api/admin/member':
            if not self.need_admin():return
            mid=self.body_json().get('id');db=REPO.read('members',{'members':[]})
            item=next((x for x in db.get('members',[]) if x.get('id')==mid and x.get('status','active')!='deleted'),None)
            if not item:return self.json({'error':'회원을 찾을 수 없습니다.'},404)
            item['status']='deleted';item['deleted_at']=time.strftime('%Y-%m-%dT%H:%M:%S');REPO.write('members',db)
            return self.json({'ok':True})
        if path=='/api/admin/record':
            if not self.need_admin():return
            item=REPO.soft_delete_record(self.body_json().get('id',''));return self.json({'ok':True}) if item else self.json({'error':'자료를 찾을 수 없습니다.'},404)
        if path=='/api/admin/file':
            if not self.need_admin():return
            d=self.body_json();kind,id=d.get('kind'),d.get('id');idx=read_json(STORAGE/'resources.json',{'documents':[],'photos':[],'receipts':[]});arr=idx.get(kind,[]);item=next((x for x in arr if x.get('id')==id),None)
            if not item:return self.json({'error':'자료를 찾을 수 없습니다.'},404)
            links=resource_links(kind,id)
            if links:return self.json({'error':'다음 기록에서 사용 중인 자료입니다. 기록의 관련자료 관리에서 제거한 뒤 삭제해 주세요.\n'+'\n'.join(x['title'] for x in links)},409)
            def commit_delete():
                idx[kind]=[x for x in arr if x.get('id')!=id]
                write_json(STORAGE/'resources.json',idx)
            try:retain_deleted_resource(STORAGE,kind,item,commit_delete)
            except (ValueError,OSError) as error:
                return self.json({'error':'삭제하지 못했습니다: '+str(error)},400)
            self.sync_public_resources(idx)
            return self.json({'ok':True})
        return self.send_error(404)
    def parse_multipart(self):
        n=int(self.headers.get('Content-Length','0') or 0)
        if n<=0:raise ValueError('업로드 데이터가 없습니다.')
        if n>60*1024*1024:raise ValueError('파일이 너무 큽니다. 최대 60MB입니다.')
        ct=self.headers.get('Content-Type','');m=re.search(r'boundary=(?:"([^"]+)"|([^;]+))',ct,re.I);boundary=(m.group(1) or m.group(2)).strip() if m else ''
        if not boundary:raise ValueError('multipart boundary가 없습니다.')
        body=self.rfile.read(n);marker=b'--'+boundary.encode();out={}
        for part in body.split(marker):
            if part.startswith(b'\r\n'):part=part[2:]
            if part.endswith(b'\r\n'):part=part[:-2]
            if not part or b'\r\n\r\n' not in part:continue
            head,payload=part.split(b'\r\n\r\n',1);hs=head.decode('utf-8','replace');nm=re.search(r'name="([^"]+)"',hs);fm=re.search(r'filename="([^"]*)"',hs);tm=re.search(r'Content-Type:\s*([^\r\n]+)',hs,re.I)
            if not nm:continue
            name=nm.group(1)
            if fm:out[name]={'filename':fm.group(1),'content':payload,'content_type':tm.group(1).strip() if tm else 'application/octet-stream'}
            else:out[name]=payload.decode('utf-8','replace')
        return out
    def handle_upload(self):
        with UPLOAD_LOCK:return self._handle_upload()
    def resource_sha256(self, item):
        """Hash a registered original; missing files and paths outside storage are not candidates."""
        relative=item.get('path')
        if not isinstance(relative,str) or not relative:return ''
        path=(STORAGE/relative).resolve()
        if not path.is_relative_to(STORAGE.resolve()) or not path.is_file():return ''
        digest=hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
        return digest.hexdigest()
    def resource_matches(self, item, content, digest):
        # Hash selects candidates; compare actual bytes before declaring exact identity.
        if self.resource_sha256(item)!=digest:return False
        path=(STORAGE/item['path']).resolve()
        with path.open('rb') as stream:
            offset=0
            while True:
                chunk=stream.read(1024*1024)
                if not chunk:return offset==len(content)
                if chunk!=content[offset:offset+len(chunk)]:return False
                offset+=len(chunk)
    def _handle_upload(self):
        try:d=self.parse_multipart();kind=d.get('kind','documents');pub=d.get('public','true').lower()=='true';file=d.get('file')
        except Exception as e:return self.json({'error':str(e)},400)
        if kind not in ('documents','photos','receipts') or not isinstance(file,dict):return self.json({'error':'잘못된 자료입니다.'},400)
        try:validate_resource_date(d.get('date'))
        except ValueError as error:return self.json({'error':str(error)},400)
        role=d.get('attachment_role','')
        try:kind,pub=resource_policy(kind,role,pub)
        except ValueError as e:return self.json({'error':str(e)},400)
        original_name=Path(str(file.get('filename','')).replace('\\','/')).name
        extension=Path(original_name).suffix.lower()
        if extension not in UPLOAD_EXTENSIONS:return self.json({'error':'허용되지 않는 파일 형식입니다.'},400)
        if len(file['content'])>60*1024*1024:return self.json({'error':'파일 크기가 제한을 초과했습니다.'},400)
        pdf=d.get('pdf_file')
        if pdf is not None:
            if extension not in ('.hwp','.hwpx','.doc','.docx') or not isinstance(pdf,dict) or Path(str(pdf.get('filename',''))).suffix.lower()!='.pdf' or not pdf.get('content',b'').startswith(b'%PDF-'):
                return self.json({'error':'PDF 열람본은 HWP·Word 원본과 함께 올바른 PDF 파일로 등록해 주세요.'},400)
        upload_token=str(d.get('upload_token',''))
        if upload_token and not re.fullmatch(r'[A-Za-z0-9-]{16,100}',upload_token):return self.json({'error':'파일 등록 요청 ID가 올바르지 않습니다.'},400)
        content_sha256=hashlib.sha256(file['content']).hexdigest()
        resources=read_json(STORAGE/'resources.json',{'documents':[],'photos':[],'receipts':[]})
        try:
            if upload_token:
                prior=next((x for x in resources.get(kind,[]) if x.get('upload_token')==upload_token),None)
                if prior:
                    same_original=prior.get('name')==original_name and self.resource_matches(prior,file['content'],content_sha256)
                    same_pdf=bool(pdf)==bool(prior.get('pdf')) and (not pdf or self.resource_matches(prior['pdf'],pdf['content'],hashlib.sha256(pdf['content']).hexdigest()))
                    if not same_original or not same_pdf:
                        return self.json({'error':'파일 등록 요청 ID가 다른 파일에 사용되었습니다.'},409)
                    return self.json({'ok':True,'item':prior})
            # Registered originals across all categories and public/private scopes share one rule.
            # Do not scan trash, publication originals, or the optional PDF viewing copies.
            for registered_kind in ('documents','photos','receipts'):
                for existing in resources.get(registered_kind,[]):
                    relative=existing.get('path')
                    if not isinstance(relative,str) or not relative:continue
                    path=(STORAGE/relative).resolve()
                    if not path.is_relative_to(STORAGE.resolve()) or not path.is_file():continue
                    if path.stat().st_size!=len(file['content']):continue
                    if self.resource_matches(existing,file['content'],content_sha256):
                        return self.json({'error':'동일한 내용의 파일이 이미 등록되어 있습니다. 파일명이 달라도 내용이 같으면 중복입니다. 기존 자료: '+str(existing.get('title') or existing.get('name') or existing.get('id'))+' · 자료·첨부 관리에서 확인하거나 기록의 등록자료에서 선택해 주세요.',
                                          'code':'duplicate_file'},409)
        except OSError:
            return self.json({'error':'기존 파일을 확인하지 못했습니다. 파일 접근 권한을 확인한 후 다시 등록해 주세요.'},500)
        fid=secrets.token_hex(8);orig=original_name;ext=extension;safe=f'{fid}{ext}';scope='public' if pub else 'private';sub='photos' if kind=='photos' else ('receipts' if kind=='receipts' else 'documents');dest=STORAGE/scope/sub/safe;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(file['content']);url=f'/media/{scope}/{sub}/{safe}'
        item={'id':fid,'name':orig,'title':d.get('title') or orig,'description':d.get('description',''),'date':d.get('date',''),'public':pub,'book_include':d.get('book_include','true').lower()=='true','url':url,'path':f'{scope}/{sub}/{safe}','size':len(file['content']),'attachment_role':role}
        if pdf:
            pdfname=fid+'-view.pdf';pdfdest=dest.parent/pdfname
            try:pdfdest.write_bytes(pdf['content'])
            except OSError:
                dest.unlink(missing_ok=True)
                return self.json({'error':'PDF 저장에 실패했습니다. 다시 시도해 주세요.'},500)
            item['pdf']={'name':Path(str(pdf['filename']).replace('\\','/')).name,'path':f'{scope}/{sub}/{pdfname}','url':f'/media/{scope}/{sub}/{pdfname}','size':len(pdf['content'])}
        if upload_token:item['upload_token']=upload_token
        idx=resources;idx.setdefault(kind,[]).insert(0,item);idx['updated']=time.strftime('%Y-%m-%d');write_json(STORAGE/'resources.json',idx);self.sync_public_resources(idx);return self.json({'ok':True,'item':item})
    def sync_public_resources(self,idx):
        out={'documents':[x for x in idx.get('documents',[]) if x.get('public')],'photos':[x for x in idx.get('photos',[]) if x.get('public')],'updated':idx.get('updated','')};write_json(PUBLIC/'data/resources.json',out)
        for kind in ('documents','photos','receipts'):
            for item in idx.get(kind,[]):
                src = STORAGE / item.get('path','')
                if src.is_file():
                    dest = PUBLIC / 'media' / item.get('path','')
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    if not dest.exists() or dest.stat().st_size != src.stat().st_size:
                        shutil.copy2(str(src), str(dest))

def run_tunnel(port):
    exe=find_cloudflared()
    if not exe:print('[안내] cloudflared를 찾지 못했습니다. 로컬 서버만 실행합니다.');return
    runtime=PUBLIC/'data/runtime-preview.json';write_json(runtime,{'preview_url':'','status':'starting','verified':False})
    p=subprocess.Popen([exe,'tunnel','--url',f'http://127.0.0.1:{port}'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
    url=''
    try:
        for line in p.stdout:
            print('[cloudflared]',line.rstrip());m=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',line)
            if m and not url:
                url=m.group(0);verified=False
                for _ in range(15):
                    try:
                        with urllib.request.urlopen(url+'/',timeout=4) as response:verified=200<=response.status<400
                        if verified:break
                    except Exception:time.sleep(1)
                status='ready' if verified else 'unverified'
                write_json(runtime,{'preview_url':url,'status':status,'verified':verified,'updated':time.strftime('%Y-%m-%d %H:%M:%S')})
                print(f'\n[개발 미리보기 URL] {url} ({"접속 확인" if verified else "접속 미확인"})\n')
    finally:
        if url:write_json(runtime,{'preview_url':'','status':'stopped','verified':False,'updated':time.strftime('%Y-%m-%d %H:%M:%S')})

if __name__=='__main__':
    default_port = int(os.environ.get('PORT', 9010))
    ap=argparse.ArgumentParser();ap.add_argument('--port',type=int,default=default_port);ap.add_argument('--tunnel',action='store_true');ap.add_argument('--open-browser',action='store_true');ap.add_argument('--mode',choices=('production','development'),default=os.environ.get('CENTERHUB_MODE','production'));args=ap.parse_args();
    if args.mode not in ('production','development'):ap.error('CENTERHUB_MODE must be production or development')
    RUN_MODE=args.mode
    os.chdir(PUBLIC)
    try:httpd=ThreadingHTTPServer(('0.0.0.0',args.port),Handler)
    except OSError as error:
        print(f'[실행 실패] 포트 {args.port}를 열 수 없습니다. 기존 CenterHub 또는 같은 포트를 사용하는 프로그램을 확인해 주세요. ({error})')
        raise SystemExit(1)
    print(f'[실행 파일] {Path(__file__).resolve()}')
    normalize_record_types(REPO,ROOT)
    migrate_attendee_snapshots()
    sync_public_organization()
    threading.Thread(target=retention_worker,args=(STORAGE,threading.Event()),daemon=True).start()
    if args.tunnel:threading.Thread(target=run_tunnel,args=(args.port,),daemon=True).start()
    if args.open_browser:threading.Thread(target=open_browser_when_ready,args=(args.port,),daemon=True).start()
    print(f'CenterHub {APP_VERSION} [{RUN_MODE}]: http://127.0.0.1:{args.port}/')
    httpd.serve_forever()
