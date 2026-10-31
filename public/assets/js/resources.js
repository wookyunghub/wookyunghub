(async()=>{
  const C=window.CenterHubCommon;
  await C.siteReady;
  
  const d=await C.api('api/public/resources',{documents:[],photos:[]});
  const sortFn=window.CenterHubResourceOrder.newestFirst;
  const allDocs=[...(d.documents||[])].sort(sortFn);
  const allPhotos=[...(d.photos||[])].sort(sortFn);

  // Split documents into forms and general documents
  const forms = allDocs.filter(x => x.attachment_role === 'form');
  const normalDocs = allDocs.filter(x => x.attachment_role !== 'form');

  const formsCount = document.getElementById('forms-count');
  const docsCount = document.getElementById('docs-count');
  const photosCount = document.getElementById('photos-count');
  if(formsCount) formsCount.textContent = forms.length + '건';
  if(docsCount) docsCount.textContent = normalDocs.length + '건';
  if(photosCount) photosCount.textContent = allPhotos.length + '건';

  function safeFileUrl(url){
    if(!url) return '#';
    if(url.startsWith('http://')||url.startsWith('https://')) return url;
    const clean = url.startsWith('/') ? url : '/' + url;
    if(!location.hostname.includes('pythonanywhere')){
      return 'https://wookyunghub.pythonanywhere.com' + clean;
    }
    return clean;
  }

  function esc(s){
    return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderCard(x, isForm){
    const fileUrl = safeFileUrl(x.url);
    const ext = (x.url||x.name||'').split('?')[0].split('.').pop().toUpperCase().slice(0,5) || '문서';
    const isPdf = ext === 'PDF';
    const pdfUrl = x.pdf ? safeFileUrl(x.pdf) : (isPdf ? fileUrl : '');
    const title = esc(x.title || x.name || '자료');
    const filename = esc(x.name || (isForm ? '서식자료.' + ext.toLowerCase() : '문서.' + ext.toLowerCase()));
    const date = esc(x.date || '날짜 미입력');
    const desc = esc(x.description || '');

    return `<article class="res-item-card ${isForm?'form-card':''}">
      <div class="res-card-top">
        <span class="res-badge ${isForm?'res-badge-form':''}">${isForm?'📋 서식':'📄 문서'}</span>
        <span class="res-ext-badge ext-${ext.toLowerCase()}">${ext}</span>
      </div>
      <h3 class="res-card-title">${title}</h3>
      <span class="res-card-date">${date}</span>
      ${desc ? `<p class="res-card-desc">${desc}</p>` : ''}
      <div class="res-card-actions">
        ${pdfUrl && !isPdf ? `<a class="btn res-btn-view" href="${pdfUrl}" target="_blank" rel="noopener">열람본(PDF)</a>` : ''}
        ${isPdf ? `<a class="btn res-btn-view" href="${fileUrl}" target="_blank" rel="noopener">열람</a>` : ''}
        <a class="btn primary res-btn-download" href="${fileUrl}" download="${filename}" target="_blank" rel="noopener">
          <span>다운로드</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>
      </div>
    </article>`;
  }

  // Render Forms
  const formsEl = document.getElementById('resource-forms');
  if(formsEl){
    formsEl.innerHTML = forms.length ? forms.map(x=>renderCard(x, true)).join('') : '<div class="empty-state compact-empty">등록된 공개 서식자료가 없습니다.</div>';
  }

  // Render Docs
  const docsEl = document.getElementById('resource-docs');
  if(docsEl){
    docsEl.innerHTML = normalDocs.length ? normalDocs.map(x=>renderCard(x, false)).join('') : '<div class="empty-state compact-empty">등록된 공개 일반문서가 없습니다.</div>';
  }

  // Render Photos
  const photosEl = document.getElementById('resource-photos');
  if(photosEl){
    photosEl.innerHTML = allPhotos.length ? allPhotos.map(x=>{
      const url = safeFileUrl(x.url);
      return `<a class="activity-card" href="${url}" target="_blank" rel="noopener">
        <div class="activity-thumb">
          <img src="${url}" alt="${esc(x.title||x.name)}" loading="lazy" onerror="if(!this.dataset.fb&&!location.hostname.includes('pythonanywhere')){this.dataset.fb='1';this.src='https://wookyunghub.pythonanywhere.com'+(this.getAttribute('src').startsWith('/')?this.getAttribute('src'):'/'+this.getAttribute('src'));}">
        </div>
        <b>${esc(x.title||x.name)}</b>
        <small>${esc(x.date||'날짜 미입력')}</small>
      </a>`;
    }).join('') : '<div class="empty-state compact-empty">등록된 공개 사진이 없습니다.</div>';
  }

  // Tab switching logic
  const secForms = document.getElementById('section-forms');
  const secDocs = document.getElementById('section-docs');
  const secPhotos = document.getElementById('section-photos');

  function applyTab(tab){
    document.querySelectorAll('.res-nav-tab').forEach(t => {
      const active = t.dataset.tab === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    if(secForms) secForms.hidden = (tab !== 'all' && tab !== 'forms');
    if(secDocs) secDocs.hidden = (tab !== 'all' && tab !== 'docs');
    if(secPhotos) secPhotos.hidden = (tab !== 'all' && tab !== 'photos');
  }

  const initialTab = ['forms','docs','photos','all'].includes(location.hash.replace('#','')) ? location.hash.replace('#','') : 'all';
  applyTab(initialTab);

  document.querySelectorAll('.res-nav-tab').forEach(t => {
    t.onclick = () => {
      const tab = t.dataset.tab;
      try { history.replaceState(null, '', '#' + tab); } catch(e){}
      applyTab(tab);
    };
  });
})();
