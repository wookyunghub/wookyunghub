"""
PythonAnywhere 서버의 최신 등록 자료(문서, 사진, 행사 기록)를 로컬 및 Cloudflare Pages 배포용으로 동기화하는 도구
사용법: python scripts/sync_from_server.py
"""
import urllib.request
import json
import os
import shutil

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PUB_DIR = os.path.join(ROOT_DIR, 'public')
STORAGE_DIR = os.path.join(ROOT_DIR, 'storage')

os.makedirs(os.path.join(PUB_DIR, 'media/public/photos'), exist_ok=True)
os.makedirs(os.path.join(PUB_DIR, 'media/public/documents'), exist_ok=True)
os.makedirs(os.path.join(PUB_DIR, 'media/private/documents'), exist_ok=True)
os.makedirs(os.path.join(STORAGE_DIR, 'public/photos'), exist_ok=True)
os.makedirs(os.path.join(STORAGE_DIR, 'public/documents'), exist_ok=True)

print('[1/3] PythonAnywhere에서 최신 자료 목록을 가져오는 중...')
req = urllib.request.Request('https://wookyunghub.pythonanywhere.com/api/public/resources', headers={'User-Agent': 'Mozilla/5.0'})
res_data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

with open(os.path.join(PUB_DIR, 'data/resources.json'), 'w', encoding='utf-8') as f:
    json.dump(res_data, f, ensure_ascii=False, indent=2)
print(' -> public/data/resources.json 업데이트 완료')

print('[2/3] PythonAnywhere에서 최신 행사/회의 기록을 가져오는 중...')
req2 = urllib.request.Request('https://wookyunghub.pythonanywhere.com/api/public/records', headers={'User-Agent': 'Mozilla/5.0'})
rec_data = json.loads(urllib.request.urlopen(req2).read().decode('utf-8'))

with open(os.path.join(PUB_DIR, 'data/records.json'), 'w', encoding='utf-8') as f:
    json.dump(rec_data, f, ensure_ascii=False, indent=2)
print(' -> public/data/records.json 업데이트 완료')

print('[3/3] 미다운로드 사진 및 문서 파일 동기화 중...')
for p in res_data.get('photos', []):
    url = 'https://wookyunghub.pythonanywhere.com' + p['url']
    target_pub = os.path.join(PUB_DIR, p['url'].lstrip('/'))
    target_storage = os.path.join(STORAGE_DIR, p['path'])
    
    os.makedirs(os.path.dirname(target_pub), exist_ok=True)
    os.makedirs(os.path.dirname(target_storage), exist_ok=True)
    
    if not os.path.exists(target_pub) or os.path.getsize(target_pub) == 0:
        print(f" -> 사진 다운로드: {p.get('name')}")
        req_img = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_img) as resp, open(target_pub, 'wb') as out_f:
            shutil.copyfileobj(resp, out_f)
            
    if not os.path.exists(target_storage) or os.path.getsize(target_storage) == 0:
        shutil.copy2(target_pub, target_storage)

for doc in res_data.get('documents', []):
    url = 'https://wookyunghub.pythonanywhere.com' + doc['url']
    target_pub = os.path.join(PUB_DIR, doc['url'].lstrip('/'))
    target_storage = os.path.join(STORAGE_DIR, doc['path'])
    
    os.makedirs(os.path.dirname(target_pub), exist_ok=True)
    os.makedirs(os.path.dirname(target_storage), exist_ok=True)
    
    if not os.path.exists(target_pub) or os.path.getsize(target_pub) == 0:
        print(f" -> 문서 다운로드: {doc.get('name')}")
        req_doc = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_doc) as resp, open(target_pub, 'wb') as out_f:
            shutil.copyfileobj(resp, out_f)
            
    if not os.path.exists(target_storage) or os.path.getsize(target_storage) == 0:
        shutil.copy2(target_pub, target_storage)

print('\n동기화가 성공적으로 완료되었습니다.')
