from pathlib import Path
import json, os, secrets, time, re

class JsonRepository:
    def __init__(self, root: Path):
        self.root=Path(root)
        self.data=self.root/'data'
        self.config=self.root/'config'
        self.editions=self.root/'editions'
        self.data.mkdir(parents=True,exist_ok=True)
        self.migrate_history_category()

    def migrate_history_category(self):
        """One-time category correction; retain IDs and all other record fields."""
        path=self.data/'records.json'
        if not path.exists():return
        original=path.read_bytes()
        db=json.loads(original.decode('utf-8-sig'))
        rows=db.get('records',[])
        old=[r for r in rows if r.get('module')=='history']
        if not old:return
        backups=self.data/'backups';backups.mkdir(parents=True,exist_ok=True)
        backup=backups/('records.before-history-category-'+str(time.time_ns())+'.json')
        with backup.open('xb') as stream:stream.write(original)
        for row in old:row['module']='document'
        self.write('records',db)
        print(f'[자료구분 정리] 연혁 {len(old)}건 → 기타 운영기록 (백업: {backup.name})')

    def read(self,name,fallback=None):
        p=self.data/f'{name}.json'
        try:return json.loads(p.read_text(encoding='utf-8'))
        except Exception:return fallback if fallback is not None else {}

    def write(self,name,obj):
        p=self.data/f'{name}.json';p.parent.mkdir(parents=True,exist_ok=True)
        tmp=p.with_suffix('.json.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(tmp,p)
        pub_p=self.root/'public/data'/f'{name}.json'
        if pub_p.parent.exists():
            pub_tmp=pub_p.with_suffix('.json.tmp')
            try:
                pub_tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
                os.replace(pub_tmp,pub_p)
            except Exception:
                pass

    def organization_data(self,organization=None):
        org=dict(organization if organization is not None else self.read('organization',{}))
        basic=dict(org.get('basic') or {});site=self.read('site',{})
        basic['name']=site.get('organization_name') or basic.get('name','')
        basic['parent_organization']=site.get('parent_organization','')
        basic['branch_name']=site.get('branch_name','')
        org['basic']=basic
        return org

    def read_config(self,name,fallback=None):
        p=self.config/f'{name}.json'
        try:return json.loads(p.read_text(encoding='utf-8'))
        except Exception:return fallback if fallback is not None else {}

    def write_config(self,name,obj):
        p=self.config/f'{name}.json';p.parent.mkdir(parents=True,exist_ok=True)
        tmp=p.with_suffix('.json.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(tmp,p)

    @staticmethod
    def _date_key(value):
        """Sort mixed Korean/date strings chronologically (YYYY.MM.DD, YYYY-MM-DD, YYYY년, YYYY.MM)."""
        nums=[int(x) for x in re.findall(r"\d+", str(value or ""))[:3]]
        nums += [0] * (3-len(nums))
        return tuple(nums)

    def list_records(self,module=None,public_only=False,book_only=False,include_deleted=False):
        db=self.read('records',{'records':[]});rows=[]
        for r in db.get('records',[]):
            if not include_deleted and r.get('status')=='deleted':continue
            if module and r.get('module')!=module:continue
            if public_only and not r.get('public'):continue
            if book_only and not r.get('book_include'):continue
            rows.append(r)
        rows.sort(key=lambda x:(self._date_key(x.get('date','')),x.get('updated_at','')),reverse=True)
        return rows

    def create_record(self,payload):
        db=self.read('records',{'schema_version':1,'records':[]})
        now=time.strftime('%Y-%m-%dT%H:%M:%S')
        module=(payload.get('module') or 'document').strip()
        item={
            'id':payload.get('id') or f"{module}-{secrets.token_hex(6)}",
            'module':module,'date':payload.get('date',''),'title':payload.get('title','').strip(),
            'body':payload.get('body','').strip(),'public':bool(payload.get('public',False)),
            'book_include':bool(payload.get('book_include',False)),'edition_period':payload.get('edition_period',''),
            'status':'active','history_excluded':payload.get('history_excluded') is True,'tags':payload.get('tags') or [],'source':payload.get('source') or '관리자 등록',
            'extra':payload.get('extra') or {},'attachments':payload.get('attachments') or [],
            'recorder':payload.get('recorder',''),
            'created_at':now,'updated_at':now
        }
        db.setdefault('records',[]).insert(0,item);db['updated']=time.strftime('%Y-%m-%d');self.write('records',db);return item

    def update_record(self,record_id,changes):
        db=self.read('records',{'records':[]});item=None
        for r in db.get('records',[]):
            if r.get('id')==record_id:
                item=r;break
        if not item:return None
        allowed={'module','date','title','body','public','book_include','edition_period','tags','source','extra','attachments','status','recorder','history_excluded'}
        for k,v in changes.items():
            if k in allowed:item[k]=v
        item['updated_at']=time.strftime('%Y-%m-%dT%H:%M:%S');db['updated']=time.strftime('%Y-%m-%d');self.write('records',db);return item

    def soft_delete_record(self,record_id):
        return self.update_record(record_id,{'status':'deleted'})
