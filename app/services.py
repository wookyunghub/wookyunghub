from pathlib import Path
import json, os, time, copy

class PublicationService:
    def __init__(self,root,repo):
        self.root=Path(root);self.repo=repo

    def create_snapshot(self,period,cutoff=''):
        period=(period or '').strip()
        if not period:raise ValueError('발간연도를 입력해 주세요.')
        records=[]
        for r in self.repo.list_records(book_only=True):
            if cutoff and r.get('date') and r.get('date')>cutoff:continue
            records.append(r)
        org=copy.deepcopy(self.repo.organization_data())
        # 운영대장 발간 스냅샷에는 '책자 포함'으로 선택한 임원/이사회 행만 수록합니다.
        chart=org.get('organization_chart') or {}
        for kind in ('officers','board'):
            if kind in chart:chart[kind]=[x for x in chart.get(kind,[]) if x.get('book_include',True)]
        pubs=self.repo.read('publications',{'publications':[]})
        publication=next((x for x in pubs.get('publications',[]) if x.get('period')==period or x.get('id')==period),None)
        out={'schema_version':1,'period':period,'cutoff':cutoff,'created_at':time.strftime('%Y-%m-%dT%H:%M:%S'),'organization':org,'records':records,'publication':publication or {}}
        folder=self.root/'editions'/period;folder.mkdir(parents=True,exist_ok=True)
        p=folder/'snapshot.json';tmp=p.with_suffix('.json.tmp');tmp.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(tmp,p)
        return {'ok':True,'period':period,'records':len(records),'path':str(p.relative_to(self.root))}
