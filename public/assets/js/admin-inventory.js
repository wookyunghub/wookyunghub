(function() {
  const STORAGE_KEY = 'centerhub_facility_inventory';

  let items = [];
  let activeCat = 'all';
  let editingId = null;

  // DOM elements
  const form = document.getElementById('inv-form');
  const formTitle = document.getElementById('inv-form-title');
  const formToggle = document.getElementById('inv-form-toggle');
  const submitBtn = document.getElementById('inv-submit-btn');
  const resetBtn = document.getElementById('inv-reset-btn');
  const msgEl = document.getElementById('inv-msg');
  const container = document.getElementById('inv-items-container');
  const searchInput = document.getElementById('inv-admin-search');
  const listHeading = document.getElementById('inv-list-heading');
  const tabs = document.querySelectorAll('#inv-admin-tabs .inv-tab-btn');

  // Photo preview & dialog
  const photoFileInput = document.getElementById('inv-photo-file');
  const photoValInput = document.getElementById('inv-photo-val');
  const previewWrap = document.getElementById('inv-preview-wrap');
  const previewImg = document.getElementById('inv-preview-img');

  const photoDialog = document.getElementById('inv-admin-photo-dialog');
  const dialogImg = document.getElementById('inv-admin-photo-img');
  const dialogTitle = document.getElementById('inv-admin-photo-title');
  const dialogClose = document.getElementById('inv-admin-photo-close');

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        items = JSON.parse(saved);
        renderList();
        return;
      } catch (e) {}
    }

    try {
      const res = await fetch('../data/facility-inventory.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        items = data.items || [];
      }
    } catch (e) {
      items = [];
    }
    renderList();
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function renderList() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const filtered = items.filter(it => {
      if (activeCat !== 'all' && it.cat !== activeCat) return false;
      if (!query) return true;
      return (it.name && it.name.toLowerCase().includes(query)) ||
             (it.id && it.id.toLowerCase().includes(query)) ||
             (it.spec && it.spec.toLowerCase().includes(query)) ||
             (it.group && it.group.toLowerCase().includes(query)) ||
             (it.note && it.note.toLowerCase().includes(query));
    });

    listHeading.textContent = `등록 비품 목록 (총 ${filtered.length}건 / 전체 ${items.length}건)`;

    if (!filtered.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#8a796a;font-size:14px">해당 조건의 비품이 없습니다.</div>';
      return;
    }

    container.innerHTML = filtered.map(it => `
      <div class="inv-item-card" data-id="${esc(it.id)}">
        <div class="inv-thumb" data-photo="${it.photo ? (it.photo.startsWith('data:') || it.photo.startsWith('http') ? it.photo : '../' + it.photo) : ''}" data-title="${esc(it.name)} (${esc(it.id)})">
          ${it.photo ? `<img src="${it.photo.startsWith('data:') || it.photo.startsWith('http') ? it.photo : '../' + it.photo}" alt="${esc(it.name)}" loading="lazy">` : '<span class="inv-thumb-placeholder">📷</span>'}
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:700;color:#7a6859;font-size:13px">${esc(it.id)}</span>
            <strong style="font-size:15px;color:#3c281b">${esc(it.name)}</strong>
            <span class="inv-badge-status inv-status-${esc(it.status || '사용')}">${esc(it.status || '사용')}</span>
          </div>
          ${it.spec ? `<div style="font-size:13px;color:#5a493c;margin-top:2px">${esc(it.spec)}</div>` : ''}
          <div class="inv-meta-line">
            <span>수량: <b>${esc(it.qty)}${esc(it.unit || '개')}</b></span>
            <span>· 취득: ${esc(it.acquire || '-')}</span>
            ${it.group ? `<span>· 그룹: ${esc(it.group)}</span>` : ''}
            ${it.note ? `<span>· 비고: ${esc(it.note)}</span>` : ''}
          </div>
        </div>
        <div class="inv-actions">
          <button type="button" class="btn small inv-edit-btn" data-id="${esc(it.id)}">수정</button>
          <button type="button" class="btn small inv-del-btn" style="color:#b2352b;border-color:#f1c2be;" data-id="${esc(it.id)}">삭제</button>
        </div>
      </div>
    `).join('');

    // Attach card handlers
    container.querySelectorAll('.inv-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const p = thumb.getAttribute('data-photo');
        const t = thumb.getAttribute('data-title');
        if (p && photoDialog) {
          dialogImg.src = p;
          dialogTitle.textContent = t;
          if (typeof photoDialog.showModal === 'function') photoDialog.showModal();
          else photoDialog.setAttribute('open', 'open');
        }
      });
    });

    container.querySelectorAll('.inv-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        startEdit(id);
      });
    });

    container.querySelectorAll('.inv-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteItem(id);
      });
    });
  }

  function startEdit(id) {
    const item = items.find(x => String(x.id) === String(id));
    if (!item) return;

    editingId = id;
    formTitle.textContent = `시설·비품 수정 (관리번호: ${item.id})`;
    submitBtn.textContent = '수정 완료하기';

    document.getElementById('inv-cat').value = item.cat || 'energy';
    document.getElementById('inv-id').value = item.id || '';
    document.getElementById('inv-name').value = item.name || '';
    document.getElementById('inv-group').value = item.group || '';
    document.getElementById('inv-spec').value = item.spec || '';
    document.getElementById('inv-qty').value = item.qty || 1;
    document.getElementById('inv-unit').value = item.unit || '개';
    document.getElementById('inv-acquire').value = item.acquire || '';
    document.getElementById('inv-status').value = item.status || '사용';
    document.getElementById('inv-note').value = item.note || '';

    photoValInput.value = item.photo || '';
    if (item.photo) {
      previewImg.src = item.photo.startsWith('data:') || item.photo.startsWith('http') ? item.photo : '../' + item.photo;
      previewWrap.style.display = 'block';
    } else {
      previewWrap.style.display = 'none';
    }

    form.scrollIntoView({ behavior: 'smooth' });
    msgEl.textContent = '수정할 항목의 내용을 변경한 후 [수정 완료하기]를 눌러주세요.';
    msgEl.style.color = '#734f31';
  }

  function resetForm() {
    editingId = null;
    form.reset();
    formTitle.textContent = '시설·비품 신규 등록';
    submitBtn.textContent = '비품 등록하기';
    photoValInput.value = '';
    previewWrap.style.display = 'none';
    msgEl.textContent = '';
  }

  function deleteItem(id) {
    const it = items.find(x => String(x.id) === String(id));
    if (!it) return;
    if (!confirm(`[${it.id}] ${it.name} 비품을 대장에서 삭제하시겠습니까?`)) return;

    items = items.filter(x => String(x.id) !== String(id));
    saveData();
    renderList();
    if (editingId === id) resetForm();
    msgEl.textContent = `비품 [${id}]이 삭제되었습니다.`;
    msgEl.style.color = '#b2352b';
  }

  // Handle photo file selection
  photoFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      photoValInput.value = ev.target.result;
      previewImg.src = ev.target.result;
      previewWrap.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  // Handle form submission
  form.addEventListener('submit', e => {
    e.preventDefault();

    const cat = document.getElementById('inv-cat').value;
    const id = document.getElementById('inv-id').value.trim();
    const name = document.getElementById('inv-name').value.trim();
    const group = document.getElementById('inv-group').value.trim() || '기타 비품';
    const spec = document.getElementById('inv-spec').value.trim();
    const qty = parseInt(document.getElementById('inv-qty').value, 10) || 1;
    const unit = document.getElementById('inv-unit').value.trim() || '개';
    const acquire = document.getElementById('inv-acquire').value.trim();
    const status = document.getElementById('inv-status').value;
    const note = document.getElementById('inv-note').value.trim();
    const photo = photoValInput.value || '';

    if (!id || !name) {
      alert('관리번호와 품명을 입력해 주세요.');
      return;
    }

    if (editingId !== null) {
      // Update existing
      const idx = items.findIndex(x => String(x.id) === String(editingId));
      if (idx !== -1) {
        items[idx] = {
          ...items[idx],
          cat,
          id,
          name,
          group,
          spec,
          qty,
          unit,
          acquire,
          status,
          note,
          photo: photo || items[idx].photo
        };
      }
      msgEl.textContent = `비품 [${id}] ${name} 수정이 완료되었습니다.`;
      msgEl.style.color = '#2e6924';
    } else {
      // Check duplicate ID
      if (items.some(x => String(x.id) === String(id))) {
        if (!confirm(`관리번호 [${id}]가 이미 존재합니다. 계속 등록하시겠습니까?`)) {
          return;
        }
      }

      const newItem = {
        cat,
        id,
        name,
        group,
        spec,
        qty,
        unit,
        acquire,
        status,
        note,
        photo
      };
      items.unshift(newItem);
      msgEl.textContent = `신규 비품 [${id}] ${name} 등록이 완료되었습니다.`;
      msgEl.style.color = '#2e6924';
    }

    saveData();
    renderList();
    resetForm();
  });

  resetBtn.addEventListener('click', resetForm);

  // Form toggle
  formToggle.addEventListener('click', () => {
    const isHidden = form.hidden;
    form.hidden = !isHidden;
    formToggle.textContent = isHidden ? '등록 양식 접기' : '등록 양식 펼치기';
    formToggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  // Category filter tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCat = tab.dataset.cat || 'all';
      renderList();
    });
  });

  // Search input
  searchInput.addEventListener('input', () => {
    renderList();
  });

  // Photo dialog close
  if (dialogClose) {
    dialogClose.addEventListener('click', () => {
      if (typeof photoDialog.close === 'function') photoDialog.close();
      else photoDialog.removeAttribute('open');
    });
  }
  if (photoDialog) {
    photoDialog.addEventListener('click', e => {
      if (e.target === photoDialog) {
        if (typeof photoDialog.close === 'function') photoDialog.close();
        else photoDialog.removeAttribute('open');
      }
    });
  }

  // Initialize
  loadData();
})();
