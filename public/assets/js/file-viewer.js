(()=>{
 const C = window.CenterHubCommon;
 const documentFile = u => /\.(hwp|hwpx|doc|docx|pdf)$/i.test(u.pathname);
 const imageFile = u => /\.(jpe?g|png|gif|webp|bmp)$/i.test(u.pathname);

 function download(url, filename = '') {
  if (!confirm('원본 파일을 다운로드하시겠습니까?')) return;
  const u = new URL(url, location.href);
  u.searchParams.set('download', '1');
  const a = document.createElement('a');
  a.dataset.bypassViewer = '1';
  a.href = u.href;
  a.download = filename || '';
  const container = document.querySelector('dialog[open]') || document.body;
  container.append(a);
  a.click();
  setTimeout(() => a.remove(), 150);
 }

 async function lookup(url) {
  const status = await C.apiStatus();
  const isAdmin = !!(status && status.authenticated) || (C && typeof C.isAdminSession === 'function' && C.isAdminSession());
  const data = await C.api(isAdmin ? 'api/admin/files' : 'api/public/resources', null);
  if (!data) throw new Error('자료 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return ['documents', 'photos', 'receipts'].flatMap(k => data[k] || []).find(x => x.url && new URL(x.url, location.origin).pathname === url.pathname);
 }

 // Global Unified Photo & Document Viewer Modal with Zoom, Rotate, Reset controls
 function openImageViewer(src, title = '사진 상세보기', sub = '') {
  const existing = document.getElementById('global-photo-viewer');
  if (existing) existing.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'global-photo-viewer';
  dialog.className = 'photo-viewer global-photo-dialog';

  dialog.innerHTML = `
    <div class="photo-viewer-head global-photo-head">
      <div>
        <strong class="global-photo-title">${title}</strong>
      </div>
      <div class="photo-viewer-actions global-photo-actions">
        <a class="btn" href="${src}" target="_blank" rel="noopener">새 창 열기</a>
        <button type="button" class="btn" data-action="download">원본 다운로드</button>
        <button type="button" class="btn" data-action="close">닫기</button>
      </div>
    </div>
    <div class="photo-viewer-toolbar">
      <button type="button" class="btn" data-action="zoom-out">축소</button>
      <button type="button" class="btn" data-action="zoom-in">확대</button>
      <button type="button" class="btn" data-action="rotate-left">왼쪽 회전</button>
      <button type="button" class="btn" data-action="rotate-right">오른쪽 회전</button>
      <button type="button" class="btn" data-action="reset">원래 크기</button>
    </div>
    <div class="photo-viewer-stage global-photo-stage">
      <img src="${src}" alt="${title} 크게 보기" class="global-photo-img" loading="lazy">
    </div>
    <div class="photo-viewer-help global-photo-foot">
      <span>${sub || '마우스 휠 또는 상단 버튼으로 확대/축소하고, 회전 버튼으로 방향을 조정할 수 있습니다.'}</span>
    </div>
  `;

  document.body.append(dialog);

  const img = dialog.querySelector('.global-photo-img');
  let scale = 1, rotate = 0;
  const applyTransform = () => { img.style.transform = `translateZ(0) scale(${scale}) rotate(${rotate}deg)`; };
  const resetTransform = () => { scale = 1; rotate = 0; applyTransform(); };
  const close = () => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.remove();
  };

  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });

  dialog.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    if (act === 'close') close();
    else if (act === 'download') download(src);
    else if (act === 'zoom-in') { scale = Math.min(4, Number((scale + 0.2).toFixed(2))); applyTransform(); }
    else if (act === 'zoom-out') { scale = Math.max(0.4, Number((scale - 0.2).toFixed(2))); applyTransform(); }
    else if (act === 'rotate-left') { rotate -= 90; applyTransform(); }
    else if (act === 'rotate-right') { rotate += 90; applyTransform(); }
    else if (act === 'reset') resetTransform();
  });

  img.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.max(0.4, Math.min(4, Number((scale + delta).toFixed(2))));
    applyTransform();
  }, { passive: false });

  document.addEventListener('keydown', e => {
    if (!dialog.hasAttribute('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') { scale = Math.min(4, Number((scale + 0.2).toFixed(2))); applyTransform(); }
    else if (e.key === '-') { scale = Math.max(0.4, Number((scale - 0.2).toFixed(2))); applyTransform(); }
    else if (e.key === '[') { rotate -= 90; applyTransform(); }
    else if (e.key === ']') { rotate += 90; applyTransform(); }
  });

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', 'open');
 }

 function view(x, url) {
  const pdf = x?.pdf?.url || (typeof x?.pdf === 'string' ? x.pdf : null) || (/\.pdf$/i.test(url.pathname) ? url.href : null);
  const filename = x?.name || '';
  if (!pdf) { download(url, filename); return; }
  const dialog = document.createElement('dialog'); dialog.style.cssText = 'width:min(1000px,94vw);max-width:94vw;padding:16px;border:1px solid #cbb8aa;border-radius:12px';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap'; const title = document.createElement('strong'); title.textContent = x?.title || x?.name || '문서 보기'; title.style.flex = '1';
  const dl = document.createElement('button'); dl.className = 'btn'; dl.textContent = '원본 다운로드'; dl.onclick = () => download(url, filename);
  const close = document.createElement('button'); close.className = 'btn'; close.textContent = '닫기'; close.onclick = () => dialog.close(); bar.append(title, dl, close);
  const frame = document.createElement('iframe'); frame.src = pdf; frame.title = 'PDF 열람'; frame.style.cssText = 'display:block;width:100%;height:72vh;border:0'; dialog.append(bar, frame); dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
 }

 document.addEventListener('click', async event => {
  const a = event.target.closest('a[href]');
  if (!a || a.dataset.bypassViewer === '1') return;
  const u = new URL(a.href, location.href);

  // If clicked an image link anywhere inside /media/ or with image file extension
  if (imageFile(u) && !a.hasAttribute('data-file-download') && u.searchParams.get('download') !== '1') {
    event.preventDefault();
    event.stopImmediatePropagation();
    const title = a.getAttribute('title') || a.querySelector('img')?.getAttribute('alt') || a.textContent.trim() || '사진 상세보기';
    openImageViewer(u.href, title);
    return;
  }

  if (u.origin !== location.origin || !u.pathname.startsWith('/media/')) return;
  const isExplicitDownload = a.hasAttribute('data-file-download') || a.hasAttribute('download') || u.searchParams.get('download') === '1';
  if (!documentFile(u) && !isExplicitDownload) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const attrName = (a.getAttribute('download') || '').trim();
  if (isExplicitDownload) { download(u, attrName); return; }
  try { const x = await lookup(u); view(x, u); } catch (error) { alert(error.message); }
 }, true);

 window.CenterHubFiles = { download, openImageViewer };
})();
