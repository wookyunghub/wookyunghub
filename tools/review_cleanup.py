"""CenterHub conservative audit. Default: report only. --archive: move reviewed artifacts.
Never modifies records, members, resources, publication settings or source contents.
"""
import argparse
import collections
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket

# Exact hashes populated from the uploaded baseline; changed files are retained.
REVIEWED = {'DATA_MODEL.md': {'sha256': 'db7e8aececc2ae1f5f9b36ba9ff9110f8cbf492236cdbbfe061e5a6d1d3151c4', 'type': 'history'}, 'FINAL_VERIFICATION_20261020.md': {'sha256': 'e6f024cbd2e3752df758b5080ab123830ac928084c96ed5dcd1fad69580644c6', 'type': 'history'}, 'ARCHITECTURE.md': {'sha256': 'fd097646bdb7be908aae48d4d9cb7caa70adfca67daee8b3a3c2732e1891cd11', 'type': 'history'}, 'CHANGELOG_NEWS_UNIFIED_20261020.md': {'sha256': '45c54208545db72f5fafdd22c57aa1fd0cdcfc4aa7f1c01c2a37ec170f6a8c8c', 'type': 'history'}, 'FINAL_UPDATE_20261020.md': {'sha256': '6d73ec98e1e7fc41960f2193482764b42a71af469913ffe67d58bf399c5afb3a', 'type': 'history'}, 'OFFICER_ADMIN_AND_PREVIEW_FIX_1.3.md': {'sha256': '04a0c3ced4bc7cbc783df3b1237d7f89451aa0e066ad6777c51fa5ade7dc2237', 'type': 'history'}, 'HISTORY_LATEST_FIX_1.1.md': {'sha256': '9c894cf78b2b6c5aaeac7ec060cec3f3d207f9a51ec2b16aee6d4cf716a303e5', 'type': 'history'}, 'CENTERHUB_PROJECT_MASTER.md': {'sha256': '2cb2c1a9de0e42039981ab5d00e3b5b29509ce4559f86d27341233fcc2bf8c59', 'type': 'history'}, 'MIGRATION_NOTES.md': {'sha256': 'eb4eeaf1ae0dd37547a93ab65fb90d7f204eaa2684fb7c4fc57f6c657c1edbf4', 'type': 'history'}, 'ORGANIZATION_CHART_1.2.md': {'sha256': '79f30631075275bf8c6af67b77429623d0bad722c542d84961448c5e41a7e78d', 'type': 'history'}, 'PROJECT_REFERENCE.md': {'sha256': 'c757b1b12fea3926bd8b2096db6c4abef590ebfcd2b05005af3c4cb6b1771fbe', 'type': 'history'}, 'MEMBER_AND_RECORD_UPGRADE_1.3.3.md': {'sha256': 'a32a36875a99fa57d9228c603e26b8ec9258700b9330e8abe30673b201d4f8e5', 'type': 'history'}, 'CENTERHUB_NAMING.md': {'sha256': 'f48cb520dfb84e6e2a08914431e47298f13504fb5257eb69d3c6fea563a82076', 'type': 'history'}, 'data/backups/records.before-v3.8-20261021-194809-564995.json': {'sha256': '5db20580e8fdf2db5b87dd54aca4e67f29341fd61132ae0a8d59a1c01476d45c', 'type': 'old_backup'}, 'data/backups/records.before-meeting-import-20261019-213642-815088.json': {'sha256': '43c9e075db3d71cac75a6cf1df2e6cbf1921dbef64abd0d4565d1cb66c9e337f', 'type': 'old_backup'}, 'data/backups/members.before-public-20261019-183114-697997.json': {'sha256': 'ca770c686254bccca9dc0b06d40928006e6798c93793408e20119317ca782971', 'type': 'old_backup'}, 'data/backups/records.before-v3.7-20261021-194749-437409.json': {'sha256': 'f46cd13006916c48ecfdc535a11587e4f5dbe37ec4df890c68367e94346de5b5', 'type': 'old_backup'}, 'data/members.backup_20261019_164215_635885.json': {'sha256': 'c3f4b35ecbd4824d28c61e0bb5d6b53771808025b5b5c6dbb860cb90542b1626', 'type': 'old_backup'}, 'data/members.backup_20261019_173938_604208.json': {'sha256': 'ca770c686254bccca9dc0b06d40928006e6798c93793408e20119317ca782971', 'type': 'old_backup'}, 'data/members.backup_20261019_162914_984410.json': {'sha256': '805d3892d76751335979fa54cf89d4e35fae13727d2e51cb96409e267d11e1d9', 'type': 'old_backup'}, 'public/assets/js/news.js': {'sha256': 'b48fd97c6f4f473ce7f476c0a3bd342dcc28d3f5de8c020cb7fd4617c417fcb6', 'type': 'legacy_js'}, 'public/assets/js/news-unified.js': {'sha256': '4e50e6aff25077157f1552b83c14bb9e7d9063332f86aaf803691320b9d76aee', 'type': 'legacy_js'}}
SKIP_DIRS = {'.venv','venv','.git','node_modules','.idea','.vscode'}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def walk(root):
    for parent, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (Path(parent)/d).is_symlink()]
        for name in files:
            p = Path(parent)/name
            if not p.is_symlink():yield p

def read_json(path, default):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.is_file() else default

def inspect(root):
    allfiles=list(walk(root))
    public_text={p:p.read_text(encoding='utf-8',errors='replace') for p in allfiles
                 if p.is_relative_to(root/'public') and p.suffix in {'.html','.js','.css','.json'}}
    readme=(root/'README.md').read_text(encoding='utf-8-sig') if (root/'README.md').exists() else ''
    consolidated='CenterHub' in readme and '## v5.14' in readme
    candidates=[];retained=[]
    for p in allfiles:
        rel=p.relative_to(root).as_posix()
        reason=None
        if '__pycache__' in p.relative_to(root).parts and p.suffix=='.pyc':reason='Python bytecode cache'
        elif rel in REVIEWED:
            expected=REVIEWED[rel]
            if sha(p)!=expected['sha256']:
                retained.append({'path':rel,'reason':'Changed since review; keep for manual inspection'});continue
            if expected['type']=='history' and not consolidated:
                retained.append({'path':rel,'reason':'Latest consolidated README not detected'});continue
            if expected['type']=='legacy_js':
                refs=[str(q.relative_to(root)) for q,text in public_text.items() if q!=p and p.name in text]
                if refs:
                    retained.append({'path':rel,'reason':'Still referenced','references':refs});continue
            reason=expected['type']
        if reason:candidates.append({'path':rel,'reason':reason,'bytes':p.stat().st_size,'sha256':sha(p)})
    recorddb=read_json(root/'data/records.json',{'records':[]})
    records=recorddb.get('records',[])
    resources=read_json(root/'storage/resources.json',{})
    attachments={v for r in records for v in (r.get('attachments') or []) if isinstance(v,str)}
    active_refs={v for r in records if r.get('status')!='deleted' for v in (r.get('attachments') or []) if isinstance(v,str)}
    index={};indexed_paths=set();missing=[];unlinked=[];unsafe=[]
    for kind in ('documents','photos','receipts'):
        for f in resources.get(kind,[]):
            key=kind+':'+str(f.get('id',''));index[key]=f
            rel=f.get('path','');p=(root/'storage'/str(rel)).resolve()
            if not rel or not p.is_relative_to((root/'storage').resolve()):unsafe.append(key);continue
            indexed_paths.add(p)
            if not p.is_file():missing.append(key)
            if key not in attachments:unlinked.append(key)
    orphan_files=[]
    for scope in ('public','private'):
        for kind in ('documents','photos','receipts'):
            folder=root/'storage'/scope/kind
            if folder.exists():
                orphan_files.extend(p.relative_to(root).as_posix() for p in walk(folder) if p.resolve() not in indexed_paths)
    duplicate_groups=collections.defaultdict(list)
    for r in records:
        if r.get('status')=='deleted':continue
        # Same date/title/module may still be distinct records. Report only.
        key=(r.get('module',''),r.get('date',''),re.sub(r'\s+','',r.get('title','')))
        duplicate_groups[key].append(r.get('id',''))
    duplicates=[ids for ids in duplicate_groups.values() if len(ids)>1]
    cross_module=[]
    live=[r for r in records if r.get('status')!='deleted']
    canon=lambda v:re.sub(r'회의록|개최|기록|\s+','',str(v or ''))
    for schedule in live:
        if schedule.get('module')!='event_schedule':continue
        a=canon(schedule.get('title'));month=str(schedule.get('date',''))[:7]
        for event in live:
            if event.get('module') not in ('meeting','event') or str(event.get('date',''))[:7]!=month:continue
            b=canon(event.get('title'))
            if a and b and (a in b or b in a):cross_module.append([schedule.get('id'),event.get('id')])
    protected_dirs=('data','storage','config','editions')
    return {'project':str(root),'generated_at':datetime.datetime.now().isoformat(timespec='seconds'),
        'mode':'preview','reviewed_baseline':'CenterHub 261022.zip plus patches through v5.14; runtime data must be audited locally',
        'candidates':candidates,'retained_reviewed_files':retained,
        'records':{'total':len(records),'status_counts':dict(collections.Counter(r.get('status','active') for r in records)),
            'module_counts':dict(collections.Counter(r.get('module','') for r in records)),
            'book_include_true':sum(bool(r.get('book_include')) for r in records),
            'duplicate_candidate_ids':duplicates,'schedule_record_candidate_pairs_keep':cross_module},
        'resources':{'counts':{k:len(resources.get(k,[])) for k in ('documents','photos','receipts')},
            'unlinked_resource_ids_keep':unlinked,'missing_file_ids':missing,'invalid_storage_paths':unsafe,
            'dangling_attachment_ids':sorted(active_refs-index.keys()),'unindexed_uploads_keep':orphan_files},
        'protected_fingerprints':{p.relative_to(root).as_posix():sha(p) for p in allfiles
            if p.relative_to(root).parts[0] in protected_dirs and not any(c['path']==p.relative_to(root).as_posix() for c in candidates)},
        'notes':['Unlinked attachments are not unused: retained as standalone materials.',
                 'Records/attendees/publication flags are never modified.',
                 'Source references are literal checks; unknown files are never automatically archived.']}

def save_report(path,report):
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--archive',action='store_true',help='Move reviewed disposable files; do not delete')
    ap.add_argument('--port',type=int,default=9010,help='Server port to check before archiving')
    args=ap.parse_args();root=args.root.resolve()
    if not (root/'server.py').is_file() or not (root/'public').is_dir():ap.error('Not a CenterHub project root')
    if args.archive:
        try:
            with socket.create_connection(('127.0.0.1',args.port),timeout=.5):pass
        except OSError:pass
        else:ap.error('Server port is active. Stop CenterHub first (or specify its actual --port).')
    report=inspect(root)
    stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    output=root.parent/'_CenterHub_maintenance'/stamp
    output.mkdir(parents=True,exist_ok=False)
    report_path=output/'report.json'
    report.update({'archive_directory':str(output/'files'),'moved':[]})
    save_report(report_path,report)
    try:
        if args.archive:
            report['mode']='archive'
            for item in report['candidates']:
                src=root/item['path'];dest=output/'files'/item['path']
                if src.is_symlink() or not src.is_file() or sha(src)!=item['sha256']:
                    raise RuntimeError('Candidate changed after audit; stopped: '+item['path'])
                if not src.resolve().is_relative_to(root):raise RuntimeError('Unsafe candidate')
                dest.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(src,dest)
                if sha(dest)!=item['sha256']:raise RuntimeError('Archive verification failed')
                # Persist the recovery record before removing the source copy.
                report['moved'].append(item);save_report(report_path,report)
                src.unlink()
            for rel,digest in report['protected_fingerprints'].items():
                if not (root/rel).is_file() or sha(root/rel)!=digest:raise RuntimeError('Protected data changed: '+rel)
        report['status']='completed';save_report(report_path,report)
    except Exception as exc:
        report['status']='stopped';report['error']=str(exc);save_report(report_path,report);raise
    print('Mode:',report['mode'])
    print('Records preserved:',report['records']['total'])
    print('Reviewed candidates:',len(report['candidates']),'Moved:',len(report['moved']))
    print('Manual review: duplicates',len(report['records']['duplicate_candidate_ids']),
          'unlinked resources',len(report['resources']['unlinked_resource_ids_keep']),
          'missing files',len(report['resources']['missing_file_ids']))
    print('Report:',report_path)

if __name__=='__main__':main()
