/**
 * CenterHubFileStore - IndexedDB 기반 대용량 파일(PDF, HWP, 이미지) 로컬 영구 저장소
 * 서버 API 업로드 불가능한 정적 호스팅 환경에서도 등록된 원본 파일을 무손실 보존하고 다운로드/열람 보장
 */
(function(window){
  const DB_NAME = 'CenterHubFileDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'files';

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if(!db.objectStoreNames.contains(STORE_NAME)){
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
  }

  const FileStore = {
    async setFile(key, fileOrBlob, filename){
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const item = {
            key,
            blob: fileOrBlob,
            filename: filename || fileOrBlob.name || 'document',
            type: fileOrBlob.type || 'application/octet-stream',
            size: fileOrBlob.size || 0,
            updatedAt: Date.now()
          };
          const putReq = store.put(item);
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = e => reject(e.target.error);
        });
      } catch(err) {
        console.warn('[CenterHubFileStore] setFile error:', err);
        return false;
      }
    },

    async getFile(key){
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get(key);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = e => reject(e.target.error);
        });
      } catch(err) {
        console.warn('[CenterHubFileStore] getFile error:', err);
        return null;
      }
    },

    async removeFile(key){
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const delReq = store.delete(key);
          delReq.onsuccess = () => resolve(true);
          delReq.onerror = e => reject(e.target.error);
        });
      } catch(err) {
        console.warn('[CenterHubFileStore] removeFile error:', err);
        return false;
      }
    },

    /**
     * Blob 또는 URL로부터 파일 안전 다운로드 실행
     * (만약 서버 응답이 text/html(404 SPA fallback)이면 다운로드 차단)
     */
    async downloadSafe(key, fallbackUrl, defaultFileName){
      // 1) IndexedDB에서 실제 저장된 원본 Blob 조회
      const stored = await this.getFile(key);
      if(stored && stored.blob){
        const blobUrl = URL.createObjectURL(stored.blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = stored.filename || defaultFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return true;
      }

      // 2) IndexedDB에 없는 경우 서버 fallback URL로 다운로드 검증 시도
      if(!fallbackUrl){
        window.alert('등록된 원본 파일이 없습니다.\n기본 설정 > 원본 서류 관리에서 파일을 먼저 등록해 주세요.');
        return false;
      }

      try {
        const res = await fetch(fallbackUrl, { method: 'HEAD' });
        const ctype = (res.headers.get('content-type') || '').toLowerCase();
        if(!res.ok || ctype.includes('text/html')){
          window.alert('해당 원본 파일이 서버에 등록되어 있지 않습니다.\n[기본 설정 > 원본 서류 관리]에서 파일을 선택하여 저장해 주세요.');
          return false;
        }

        // 실제 파일인 경우 안전하게 다운로드
        const a = document.createElement('a');
        a.href = fallbackUrl;
        a.download = defaultFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      } catch(err){
        window.alert('파일 다운로드 중 오류가 발생했습니다.\n[기본 설정]에서 원본 파일을 다시 등록해 주세요.');
        return false;
      }
    },

    /**
     * Blob 또는 URL로부터 새 탭 열람
     */
    async viewSafe(key, fallbackUrl){
      const stored = await this.getFile(key);
      if(stored && stored.blob){
        const blobUrl = URL.createObjectURL(stored.blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return true;
      }

      if(!fallbackUrl){
        window.alert('등록된 열람용 파일이 없습니다.\n기본 설정 > 원본 서류 관리에서 파일을 먼저 등록해 주세요.');
        return false;
      }

      window.open(fallbackUrl, '_blank');
      return true;
    }
  };

  window.CenterHubFileStore = FileStore;
})(window);
