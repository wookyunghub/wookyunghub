(async()=>{
  const C = window.CenterHubCommon;
  await C.siteReady;

  async function fetchJsonSafe(url){
    try{
      const r = await fetch(url, {cache:'no-store'});
      if(r.ok && (r.headers.get('content-type')||'').toLowerCase().includes('application/json')) return await r.json();
    }catch(e){}
    return null;
  }

  const [apiData, staticData, remoteData] = await Promise.all([
    C.api('api/public/resources', null),
    fetchJsonSafe('data/resources.json'),
    fetchJsonSafe('https://wookyunghub.pythonanywhere.com/api/public/resources')
  ]);

  const merged = { documents: [], photos: [] };
  for (const k of ['documents', 'photos']) {
    const seen = new Set();
    for (const src of [apiData, staticData, remoteData]) {
      if (!src || !Array.isArray(src[k])) continue;
      for (const item of src[k]) {
        if (item && item.id && !seen.has(String(item.id))) {
          merged[k].push(item);
          seen.add(String(item.id));
        }
      }
    }
  }

  // 정렬 기준:
  // 1. 서식자료: 이름순 (가나다/한글 자모순)
  // 2. 일반문서 / 사진: 날짜 최신순 + 연도별 그룹
  const sortDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');
  const sortNameKo = (a, b) => {
    const nameA = a.title || a.name || '';
    const nameB = b.title || b.name || '';
    return nameA.localeCompare(nameB, 'ko', { numeric: true, sensitivity: 'base' });
  };

  const allDocs = [...(merged.documents || [])].filter(x => x.public !== false);
  const forms = allDocs.filter(x => x.attachment_role === 'form').sort(sortNameKo);
  const normalDocs = allDocs.filter(x => x.attachment_role !== 'form').sort(sortDateDesc);
  const allPhotos = [...(merged.photos || [])].filter(x => x.public !== false).sort(sortDateDesc);

  let currentSearch = '';

  function filterBySearch(items, q){
    if(!q) return items;
    return items.filter(x => {
      const t = (x.title || '').toLowerCase();
      const n = (x.name || '').toLowerCase();
      const d = (x.description || '').toLowerCase();
      const dt = (x.date || '');
      return t.includes(q) || n.includes(q) || d.includes(q) || dt.includes(q);
    });
  }

  // 연도별 그룹핑 헬퍼 함수
  function groupByYear(items) {
    const groups = {};
    for (const item of items) {
      const year = (item.date || '').slice(0, 4) || '기타';
      if (!groups[year]) groups[year] = [];
      groups[year].push(item);
    }
    const sortedYears = Object.keys(groups).sort((a, b) => {
      if (a === '기타') return 1;
      if (b === '기타') return -1;
      return b.localeCompare(a);
    });
    return sortedYears.map(yr => ({ year: yr, items: groups[yr] }));
  }

  const formsCount = document.getElementById('forms-count');
  const docsCount = document.getElementById('docs-count');
  const photosCount = document.getElementById('photos-count');

  function toMediaUrl(url){
    if(!url) return '#';
    if(url.startsWith('http://') || url.startsWith('https://')){
      try {
        const u = new URL(url);
        if(u.pathname.startsWith('/media/')){
          return u.pathname + u.search;
        }
      } catch(e){}
      return url;
    }
    return url.startsWith('/') ? url : '/' + url;
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderCard(x, isForm){
    const fileUrl = toMediaUrl(x.url);
    const ext = (x.url || x.name || '').split('?')[0].split('.').pop().toUpperCase().slice(0, 5) || '파일';
    const isPdf = ext === 'PDF';
    const rawPdf = x.pdf ? (typeof x.pdf === 'object' ? x.pdf.url : x.pdf) : '';
    const pdfUrl = rawPdf ? toMediaUrl(rawPdf) : (isPdf ? fileUrl : '');
    const title = esc(x.title || x.name || '자료명');
    const filename = esc(x.name || (isForm ? '서식자료.' + ext.toLowerCase() : '문서.' + ext.toLowerCase()));
    const date = esc(x.date || '날짜 미입력');
    const desc = esc(x.description || '');

    const badgeClass = ext === 'HWP' ? 'hwp' : (ext === 'PDF' ? 'pdf' : 'etc');

    return `<article class="res-item-card ${isForm ? 'form-card' : ''}">
      <div class="res-card-main">
        <div class="res-file-icon-box ${badgeClass}">
          <span>${ext}</span>
        </div>
        <div class="res-card-info">
          <h3>${title}</h3>
          <div class="res-card-meta">
            <span>${filename}</span>
            ${!isForm && x.date ? `<span>📅 ${date}</span>` : ''}
          </div>
          ${desc ? `<p class="res-card-desc">${desc}</p>` : ''}
        </div>
      </div>
      <div class="res-card-actions">
        ${pdfUrl ? `
          <a class="btn res-btn-view" href="${pdfUrl}" target="_blank" rel="noopener" title="${title} 열람">
            <span>열람 ↗</span>
          </a>
        ` : ''}
        <a class="btn primary res-btn-download" href="${fileUrl}" download="${filename}" data-file-download="true" title="${title} 다운로드">
          <span>다운로드</span>
        </a>
      </div>
    </article>`;
  }

  function renderForms(list){
    const formsEl = document.getElementById('resource-forms');
    if(!formsEl) return;
    if(!list.length){
      formsEl.innerHTML = currentSearch
        ? `<div class="empty-state compact-empty">'${esc(currentSearch)}' 검색어와 일치하는 서식이 없습니다.</div>`
        : '<div class="empty-state compact-empty">등록된 공개 서식자료가 없습니다.</div>';
      return;
    }
    formsEl.innerHTML = list.map(x => renderCard(x, true)).join('');
  }

  function renderDocs(list){
    const docsEl = document.getElementById('resource-docs');
    if(!docsEl) return;
    if(!list.length){
      docsEl.innerHTML = currentSearch
        ? `<div class="empty-state compact-empty">'${esc(currentSearch)}' 검색어와 일치하는 일반문서가 없습니다.</div>`
        : '<div class="empty-state compact-empty">등록된 공개 일반문서가 없습니다.</div>';
      return;
    }
    const docGroups = groupByYear(list);
    docsEl.innerHTML = docGroups.map(g => `
      <div class="res-year-group">
        <div class="res-year-header">
          <span class="res-year-badge">📁 ${esc(g.year)}년</span>
          <span class="res-year-count">${g.items.length}건</span>
        </div>
        <div class="resource-grid">
          ${g.items.map(x => renderCard(x, false)).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderPhotos(list){
    const photosEl = document.getElementById('resource-photos');
    if(!photosEl) return;
    if(!list.length){
      photosEl.innerHTML = currentSearch
        ? `<div class="empty-state compact-empty">'${esc(currentSearch)}' 검색어와 일치하는 사진이 없습니다.</div>`
        : '<div class="empty-state compact-empty">등록된 공개 사진자료가 없습니다.</div>';
      return;
    }
    const photoGroups = groupByYear(list);
    photosEl.innerHTML = photoGroups.map(g => `
      <div class="res-year-group">
        <div class="res-year-header">
          <span class="res-year-badge">📷 ${esc(g.year)}년</span>
          <span class="res-year-count">${g.items.length}건</span>
        </div>
        <div class="res-photo-grid">
          ${g.items.map((x, idx) => {
            const fileUrl = toMediaUrl(x.url);
            const thumbUrl = x.thumb ? toMediaUrl(x.thumb) : fileUrl;
            const title = esc(x.title || x.name || '활동 사진');
            const date = esc(x.date || '날짜 미입력');
            const desc = esc(x.description || '');
            return `<article class="res-photo-card" data-photo-id="${esc(x.id || idx)}" data-photo-url="${fileUrl}" data-photo-title="${title}" data-photo-date="${date}" data-photo-desc="${desc}">
              <div class="res-photo-thumb-wrap">
                <img src="${thumbUrl}" alt="${title}" loading="lazy" class="res-photo-img" onerror="this.src='assets/img/building.jpg'">
              </div>
              <div class="res-photo-info">
                <div class="res-photo-title">${title}</div>
                <div class="res-photo-date">📅 ${date}</div>
              </div>
            </article>`;
          }).join('')}
        </div>
      </div>
    `).join('');

    bindPhotoClick();
  }

  function renderAll(){
    const q = currentSearch.toLowerCase().trim();
    const filteredForms = filterBySearch(forms, q);
    const filteredDocs = filterBySearch(normalDocs, q);
    const filteredPhotos = filterBySearch(allPhotos, q);

    if(formsCount){
      formsCount.textContent = q ? `${filteredForms.length}건 / ${forms.length}건` : `${forms.length}건`;
    }
    if(docsCount){
      docsCount.textContent = q ? `${filteredDocs.length}건 / ${normalDocs.length}건` : `${normalDocs.length}건`;
    }
    if(photosCount){
      photosCount.textContent = q ? `${filteredPhotos.length}건 / ${allPhotos.length}건` : `${allPhotos.length}건`;
    }

    renderForms(filteredForms);
    renderDocs(filteredDocs);
    renderPhotos(filteredPhotos);
  }

  // 검색창 바인딩 (버튼 클릭 또는 엔터 키로 검색 실행)
  const searchInput = document.getElementById('res-search-input');
  const searchClear = document.getElementById('res-search-clear');
  const searchSubmit = document.getElementById('res-search-submit');

  function doSearch(){
    if(!searchInput) return;
    currentSearch = searchInput.value.trim();
    if(searchClear) searchClear.hidden = !currentSearch;
    renderAll();
  }

  if(searchInput){
    searchInput.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        doSearch();
      }
    });
    // 검색창 비웠을 때 자동으로 초기화
    searchInput.addEventListener('input', e => {
      if(!e.target.value.trim() && currentSearch){
        currentSearch = '';
        if(searchClear) searchClear.hidden = true;
        renderAll();
      } else if(searchClear){
        searchClear.hidden = !e.target.value.trim();
      }
    });
  }

  if(searchSubmit){
    searchSubmit.addEventListener('click', e => {
      e.preventDefault();
      doSearch();
    });
  }

  if(searchClear){
    searchClear.addEventListener('click', () => {
      currentSearch = '';
      if(searchInput){
        searchInput.value = '';
        searchInput.focus();
      }
      searchClear.hidden = true;
      renderAll();
    });
  }

  // 4. 분류 탭 전환 로직 (전체 / 서식 / 문서 / 사진)
  const navTabs = document.querySelectorAll('.res-nav-tab');
  const sections = {
    forms: document.getElementById('section-forms'),
    docs: document.getElementById('section-docs'),
    photos: document.getElementById('section-photos')
  };

  function switchTab(tabKey) {
    navTabs.forEach(t => {
      const active = t.dataset.tab === tabKey;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });

    if(tabKey === 'all') {
      Object.values(sections).forEach(sec => { if(sec) sec.style.display = ''; });
    } else {
      Object.entries(sections).forEach(([key, sec]) => {
        if(!sec) return;
        sec.style.display = (key === tabKey) ? '' : 'none';
      });
    }
  }

  navTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      switchTab(target);
      if(location.hash !== '#' + target) {
        history.replaceState(null, '', '#' + target);
      }
    });
  });

  const initialHash = (location.hash || '').replace('#', '');
  if (['forms', 'docs', 'photos', 'all'].includes(initialHash)) {
    switchTab(initialHash);
  } else {
    switchTab('all');
  }

  // 5. 사진 상세보기 모달 다이얼로그 바인딩
  const dialog = document.getElementById('photo-dialog');
  const dialogImg = document.getElementById('photo-dialog-img');
  const dialogTitle = document.getElementById('photo-dialog-title');
  const dialogMeta = document.getElementById('photo-dialog-meta');
  const dialogDesc = document.getElementById('photo-dialog-desc');
  const dialogDownload = document.getElementById('photo-dialog-download');
  const dialogClose = document.getElementById('photo-dialog-close');

  let currentScale = 1;
  let currentRotation = 0;

  function updateTransform() {
    if(!dialogImg) return;
    dialogImg.style.transform = `scale(${currentScale}) rotate(${currentRotation}deg)`;
  }

  function resetTransform() {
    currentScale = 1;
    currentRotation = 0;
    updateTransform();
  }

  function bindPhotoClick(){
    document.querySelectorAll('.res-photo-card').forEach(card => {
      card.onclick = () => {
        if(!dialog || !dialogImg) return;
        const url = card.dataset.photoUrl;
        const title = card.dataset.photoTitle || '사진 미리보기';
        const date = card.dataset.photoDate || '';
        const desc = card.dataset.photoDesc || '';

        dialogImg.src = url;
        dialogImg.alt = title;
        if(dialogTitle) dialogTitle.textContent = title;
        if(dialogMeta) dialogMeta.textContent = date ? `촬영·등록일: ${date}` : '';
        if(dialogDesc) {
          dialogDesc.textContent = desc;
          dialogDesc.style.display = desc ? 'block' : 'none';
        }
        if(dialogDownload) {
          dialogDownload.href = url;
          dialogDownload.download = title + '.jpg';
        }
        resetTransform();
        if(typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      };
    });
  }

  if(dialogClose && dialog) {
    dialogClose.addEventListener('click', () => {
      if(typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    });
    dialog.addEventListener('click', e => {
      if(e.target === dialog) {
        if(typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    });
  }

  const btnZoomIn = document.getElementById('photo-zoom-in');
  const btnZoomOut = document.getElementById('photo-zoom-out');
  const btnRotLeft = document.getElementById('photo-rotate-left');
  const btnRotRight = document.getElementById('photo-rotate-right');
  const btnReset = document.getElementById('photo-reset');

  if(btnZoomIn) btnZoomIn.onclick = () => { currentScale = Math.min(3, currentScale + 0.25); updateTransform(); };
  if(btnZoomOut) btnZoomOut.onclick = () => { currentScale = Math.max(0.5, currentScale - 0.25); updateTransform(); };
  if(btnRotLeft) btnRotLeft.onclick = () => { currentRotation = (currentRotation - 90) % 360; updateTransform(); };
  if(btnRotRight) btnRotRight.onclick = () => { currentRotation = (currentRotation + 90) % 360; updateTransform(); };
  if(btnReset) btnReset.onclick = resetTransform;

  // 초기 전체 렌더링
  renderAll();
})();
