(function() {
  const STORAGE_KEY = 'centerhub_facility_inventory_v3';
  const PHOTO_VERSION = '20261031_v3';

  function getPhotoUrl(p) {
    if (!p) return '';
    if (p.startsWith('data:') || p.startsWith('http')) return p;
    const clean = p.split('?')[0];
    return `../${clean}?v=${PHOTO_VERSION}`;
  }

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

  const catSelect = document.getElementById('inv-cat');
  const idInput = document.getElementById('inv-id');

  // Photo preview & dialog
  const photoFileInput = document.getElementById('inv-photo-file');
  const photoValInput = document.getElementById('inv-photo-val');
  const previewWrap = document.getElementById('inv-preview-wrap');
  const previewImg = document.getElementById('inv-preview-img');
  const photoDelBtn = document.getElementById('inv-photo-del');

  const photoDialog = document.getElementById('inv-admin-photo-dialog');
  const dialogImg = document.getElementById('inv-admin-photo-img');
  const dialogTitle = document.getElementById('inv-admin-photo-title');
  const dialogClose = document.getElementById('inv-admin-photo-close');

  const CAT_START_ID = {
    energy: 1101,
    comm: 2101,
    kitchen: 3101,
    health: 4101,
    safety: 5101,
    storage: 6101
  };

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Calculate next available ID for category
  function getNextId(cat) {
    const existing = items
      .filter(it => it.cat === cat)
      .map(it => {
        const num = parseInt(String(it.id).replace(/[^0-9]/g, ''), 10);
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num > 0);

    const base = CAT_START_ID[cat] || 1101;
    let nextNum = existing.length > 0 ? Math.max(...existing) + 1 : base;

    // Ensure uniqueness across all items
    while (items.some(it => String(it.id) === String(nextNum))) {
      nextNum++;
    }
    return String(nextNum);
  }

  function updateAutoId() {
    if (editingId === null && idInput && catSelect) {
      idInput.value = getNextId(catSelect.value);
    }
  }

  async function loadData() {
    try {
      const res = await fetch('../data/facility-inventory.json?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        items = data.items || [];
        saveData();
      } else {
        throw new Error('Failed to load JSON');
      }
    } catch (e) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= 115) {
            items = parsed;
          }
        } catch (err) {}
      }
    }

    updateAutoId();
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
      container.innerHTML = '<div style="text-align:center;padding:30px 10px;color:#8a796a;font-size:13px">해당 조건의 비품이 없습니다.</div>';
      return;
    }

    container.innerHTML = filtered.map(it => {
      const photoSrc = it.photo ? getPhotoUrl(it.photo) : '';
      return `
        <div class="inv-item-card" data-id="${esc(it.id)}">
          <div class="inv-thumb" data-photo="${photoSrc}" data-title="${esc(it.name)} (${esc(it.id)})">
            ${photoSrc ? `<img src="${photoSrc}" alt="${esc(it.name)}" loading="lazy">` : '<span class="inv-thumb-placeholder">📷</span>'}
          </div>
          <div class="inv-card-main">
            <div class="inv-card-title-line">
              <span class="inv-code">${esc(it.id)}</span>
              <strong class="inv-title">${esc(it.name)}</strong>
              <span class="inv-badge-status inv-status-${esc(it.status || '사용')}">${esc(it.status || '사용')}</span>
            </div>
            ${it.spec ? `<div class="inv-card-spec">${esc(it.spec)}</div>` : ''}
            <div class="inv-card-meta">
              <span>수량: <b>${esc(it.qty)}${esc(it.unit || '개')}</b></span>
              <span>· 취득: ${esc(it.acquire || '-')}</span>
              ${it.group ? `<span>· ${esc(it.group)}</span>` : ''}
              ${it.note ? `<span>· 비고: ${esc(it.note)}</span>` : ''}
            </div>
          </div>
          <div class="inv-actions">
            <button type="button" class="btn small inv-edit-btn" data-id="${esc(it.id)}">수정</button>
            <button type="button" class="btn small inv-del-btn" style="color:#b2352b;border-color:#f1c2be;" data-id="${esc(it.id)}">삭제</button>
          </div>
        </div>
      `;
    }).join('');

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

    // Lock Category & ID during edit
    catSelect.value = item.cat || 'energy';
    catSelect.disabled = true;
    idInput.value = item.id;
    idInput.readOnly = true;

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
      previewImg.src = getPhotoUrl(item.photo);
      previewWrap.style.display = 'block';
    } else {
      previewWrap.style.display = 'none';
    }

    if (form.style.display === 'none') {
      form.style.display = 'flex';
      formToggle.textContent = '등록 양식 접기';
    }

    form.scrollIntoView({ behavior: 'smooth' });
    msgEl.textContent = `[${item.id}] ${item.name} 수정 중입니다. (대분류/관리번호 변경 시 삭제 후 재등록)`;
    msgEl.style.color = '#734f31';
  }

  function resetForm() {
    editingId = null;
    form.reset();
    formTitle.textContent = '시설·비품 신규 등록';
    submitBtn.textContent = '비품 등록하기';

    // Unlock Category
    catSelect.disabled = false;
    updateAutoId();

    photoValInput.value = '';
    photoFileInput.value = '';
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

  // Handle category change -> auto recalculate next ID in registration mode
  catSelect.addEventListener('change', () => {
    if (editingId === null) {
      updateAutoId();
    }
  });

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

  // Photo delete button
  if (photoDelBtn) {
    photoDelBtn.addEventListener('click', e => {
      e.preventDefault();
      photoValInput.value = '';
      photoFileInput.value = '';
      previewWrap.style.display = 'none';
      previewImg.src = '';
    });
  }

  // Handle form submission
  form.addEventListener('submit', e => {
    e.preventDefault();

    const cat = catSelect.value;
    const name = document.getElementById('inv-name').value.trim();
    const group = document.getElementById('inv-group').value.trim() || '기타';
    const spec = document.getElementById('inv-spec').value.trim();
    const qty = parseInt(document.getElementById('inv-qty').value, 10) || 1;
    const unit = document.getElementById('inv-unit').value.trim() || '개';
    const acquire = document.getElementById('inv-acquire').value.trim();
    const status = document.getElementById('inv-status').value;
    const note = document.getElementById('inv-note').value.trim();
    const photo = photoValInput.value || '';

    if (!name) {
      alert('품명을 입력해 주세요.');
      return;
    }

    if (editingId !== null) {
      // Update existing item (ID and Category remain strictly unchanged)
      const idx = items.findIndex(x => String(x.id) === String(editingId));
      if (idx !== -1) {
        items[idx] = {
          ...items[idx],
          name,
          group,
          spec,
          qty,
          unit,
          acquire,
          status,
          note,
          photo: photo !== '' ? photo : items[idx].photo
        };
      }
      msgEl.textContent = `비품 [${editingId}] ${name} 수정 완료!`;
      msgEl.style.color = '#2e6924';
    } else {
      // New item registration: auto assign ID
      const assignedId = getNextId(cat);

      // Strict duplicate prevention
      if (items.some(x => String(x.id) === String(assignedId))) {
        alert(`오류: 관리번호 [${assignedId}]가 이미 존재합니다. 다시 시도해 주세요.`);
        return;
      }

      const newItem = {
        cat,
        id: assignedId,
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
      msgEl.textContent = `신규 비품 [${assignedId}] ${name} 등록 완료!`;
      msgEl.style.color = '#2e6924';
    }

    saveData();
    renderList();
    resetForm();
  });

  resetBtn.addEventListener('click', resetForm);

  // Form toggle
  formToggle.addEventListener('click', () => {
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'flex' : 'none';
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
