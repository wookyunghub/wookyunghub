(async()=>{
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // 1. 임원 데이터 로드
  let data = null;
  try {
    const r = await fetch('../api/admin/data?name=organization', {cache:'no-store', credentials:'same-origin'});
    if(r.ok) data = await r.json();
  } catch(e){}
  if(!data){
    try {
      const r = await fetch('../data/organization.json', {cache:'no-store'});
      if(r.ok) data = await r.json();
    } catch(e){}
  }
  if(!data){
    $('officers-msg').textContent = '임원 정보를 불러오지 못했습니다.';
    return;
  }

  data.organization_chart = data.organization_chart || {officers: [], board: [], history: []};
  data.organization_chart.officers = data.organization_chart.officers || [];
  data.organization_chart.board = data.organization_chart.board || [];
  data.organization_chart.history = data.organization_chart.history || [];

  // 2. 회원명부 데이터 로드 (연계용)
  let memberList = [];
  try {
    const mr = await fetch('../api/admin/members', {cache:'no-store', credentials:'same-origin'});
    if(mr.ok){
      const md = await mr.json();
      memberList = Array.isArray(md) ? md : (md.members || []);
    }
  } catch(e){}
  if(!memberList.length){
    try {
      const mr2 = await fetch('../data/members.json', {cache:'no-store'});
      if(mr2.ok){
        const md2 = await mr2.json();
        memberList = Array.isArray(md2) ? md2 : (md2.members || []);
      }
    } catch(e){}
  }

  const makeId = prefix => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  function rows(kind){ return data.organization_chart[kind] || (data.organization_chart[kind] = []); }

  function inputCell(x, field, placeholder='', width=''){
    const style = width ? `style="width:${width};"` : '';
    return `<td><input type="text" data-field="${field}" value="${esc(x[field]||'')}" placeholder="${esc(placeholder)}" autocomplete="off" ${style}></td>`;
  }

  // 3. 임원 테이블 렌더링
  function render(kind){
    const body = $(kind === 'officers' ? 'officer-table' : 'board-table');
    const arr = rows(kind);
    body.innerHTML = '';

    arr.forEach((x, i) => {
      if(x.book_include === undefined) x.book_include = true;
      if(x.public === undefined) x.public = true;
      if(x.is_current === undefined) x.is_current = true;

      // 회원 선택 select 옵션 생성
      let memberOptions = '<option value="">-- 직접입력(외부) --</option>';
      memberList.forEach(m => {
        const isSel = x.member_id === m.id || (!x.member_id && x.name && (x.name === m.name || (x.name === '연순녀' && m.name === '연순년')));
        const birthShort = (m.birth_date || '').slice(2).replace(/-/g, '.');
        memberOptions += `<option value="${esc(m.id)}" ${isSel ? 'selected' : ''}>${esc(m.name)}${birthShort ? ` (${birthShort})` : ''}</option>`;
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        ${inputCell(x, 'position', '직위', '85px')}
        <td>
          <select class="admin-member-select" style="max-width:140px;padding:6px;border-radius:6px;border:1px solid #bdc8d2;font-size:12.5px;">
            ${memberOptions}
          </select>
        </td>
        ${inputCell(x, 'name', '성명 또는 공석', '95px')}
        <td>
          <div style="display:flex;gap:3px;align-items:center;">
            <input type="text" data-field="term_start" value="${esc(x.term_start||'')}" placeholder="시작" style="width:78px;font-size:12px;padding:5px;">
            <span style="color:#888;">~</span>
            <input type="text" data-field="term_end" value="${esc(x.term_end||'')}" placeholder="만료" style="width:78px;font-size:12px;padding:5px;">
          </div>
        </td>
        ${inputCell(x, 'birth_date', 'YYYY-MM-DD', '95px')}
        ${inputCell(x, 'phone', '010-0000-0000', '115px')}
        ${inputCell(x, 'address', '주소', '130px')}
        ${inputCell(x, 'note', '비고', '90px')}
        <td class="center"><input type="checkbox" data-field="public" ${x.public === false ? '' : 'checked'} aria-label="홈페이지 공개"></td>
        <td class="center"><input type="checkbox" data-field="book_include" ${x.book_include === false ? '' : 'checked'} aria-label="책자 포함"></td>
        <td>
          <div class="admin-row-actions">
            <button type="button" class="btn" data-act="up" title="위로">↑</button>
            <button type="button" class="btn" data-act="down" title="아래로">↓</button>
            <button type="button" class="btn" data-act="retire" title="퇴임하여 역대 이력으로 전환" style="color:#a6561e;background:#fdf5ed;border-color:#e4c7a8;font-size:11.5px;padding:4px 6px;">퇴임</button>
            <button type="button" class="btn danger" data-act="delete" title="완전 삭제">삭제</button>
          </div>
        </td>
      `;

      // 회원 선택 change 이벤트 핸들러
      const selEl = tr.querySelector('.admin-member-select');
      selEl.addEventListener('change', () => {
        const selId = selEl.value;
        x.member_id = selId;
        if(selId){
          const m = memberList.find(item => item.id === selId);
          if(m){
            x.name = m.name;
            if(m.birth_date) x.birth_date = m.birth_date;
            if(m.phone) x.phone = m.phone;
            if(m.address) x.address = m.address;
            render(kind);
          }
        }
      });

      // 일반 input/checkbox 이벤트 바인딩
      tr.querySelectorAll('input').forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
        const f = el.dataset.field;
        x[f] = el.type === 'checkbox' ? el.checked : el.value;
      }));

      tr.querySelector('[data-act="up"]').onclick = () => {
        if(i > 0){ [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; render(kind); }
      };
      tr.querySelector('[data-act="down"]').onclick = () => {
        if(i < arr.length - 1){ [arr[i+1], arr[i]] = [arr[i], arr[i+1]]; render(kind); }
      };
      tr.querySelector('[data-act="retire"]').onclick = () => {
        if(confirm(`[${x.position || '임원'} ${x.name || ''}] 님을 퇴임 처리하여 역대 임원진 이력으로 전환하시겠습니까?`)){
          const retired = {...x, category: kind, retired_date: new Date().toISOString().slice(0, 10), is_current: false};
          data.organization_chart.history = data.organization_chart.history || [];
          data.organization_chart.history.push(retired);
          arr.splice(i, 1);
          render(kind);
          renderHistory();
        }
      };
      tr.querySelector('[data-act="delete"]').onclick = () => {
        if(confirm('이 행을 현재 임원명부에서 삭제하시겠습니까?')){
          arr.splice(i, 1);
          render(kind);
        }
      };
      body.appendChild(tr);
    });

    if(!arr.length){
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="11" class="small" style="text-align:center;padding:14px;color:#888;">등록된 임원이 없습니다. "+ 행 추가"를 눌러 입력하세요.</td>';
      body.appendChild(tr);
    }
  }

  // 4. 역대 임원진 이력 테이블 렌더링
  function renderHistory(){
    const histTable = $('history-table');
    if(!histTable) return;
    const hList = data.organization_chart.history || [];
    histTable.innerHTML = '';

    hList.forEach((h, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge" style="font-size:11px;">${h.category === 'board' ? '이사회' : '경로당 임원'}</span></td>
        <td><strong>${esc(h.position || '')}</strong></td>
        <td>${esc(h.name || '')}</td>
        <td>${esc([h.term_start, h.term_end].filter(Boolean).join(' ~ ') || '-')}</td>
        <td>${esc(h.note || '-')}</td>
        <td>
          <div class="admin-row-actions">
            <button type="button" class="btn" data-act="restore" style="font-size:11.5px;padding:4px 8px;background:#eef5ed;color:#2a5823;border-color:#b4d6ac;">현직 복원</button>
            <button type="button" class="btn danger" data-act="hist-del" style="font-size:11.5px;padding:4px 8px;">삭제</button>
          </div>
        </td>
      `;
      tr.querySelector('[data-act="restore"]').onclick = () => {
        if(confirm(`[${h.position} ${h.name}] 님을 다시 현직 임원으로 복원하시겠습니까?`)){
          const targetKind = h.category === 'board' ? 'board' : 'officers';
          delete h.retired_date;
          h.is_current = true;
          rows(targetKind).push(h);
          hList.splice(idx, 1);
          render(targetKind);
          renderHistory();
        }
      };
      tr.querySelector('[data-act="hist-del"]').onclick = () => {
        if(confirm('이 이력 항목을 완전히 삭제하시겠습니까?')){
          hList.splice(idx, 1);
          renderHistory();
        }
      };
      histTable.appendChild(tr);
    });

    if(!hList.length){
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="small" style="text-align:center;padding:14px;color:#888;">퇴임 또는 보관된 역대 임원 이력이 없습니다.</td>';
      histTable.appendChild(tr);
    }
  }

  const blank = prefix => ({
    id: makeId(prefix),
    position: '',
    name: '',
    member_id: '',
    term_start: new Date().getFullYear() + '-01-01',
    term_end: (new Date().getFullYear() + 4) + '-12-31',
    birth_date: '',
    phone: '',
    address: '',
    note: '',
    public: true,
    book_include: true,
    is_current: true
  });

  $('add-officer').onclick = () => { rows('officers').push(blank('officer')); render('officers'); };
  $('add-board').onclick = () => { rows('board').push(blank('board')); render('board'); };

  // 5. 저장 처리
  $('save-officers').onclick = async () => {
    const msg = $('officers-msg');
    msg.textContent = '저장 중...';
    data.updated = new Date().toISOString().slice(0, 10);
    const res = await fetch('../api/admin/data', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'same-origin',
      body: JSON.stringify({name: 'organization', data})
    });
    if(res.ok){
      msg.textContent = '저장했습니다. 홈페이지에는 직위·성명만 반영되고, 회원명부 연계 정보 및 이력은 관리자/책자용으로 안전하게 보관됩니다.';
    } else {
      let e = {};
      try { e = await res.json(); } catch(_){}
      msg.textContent = e.error || '저장하지 못했습니다.';
    }
  };

  render('officers');
  render('board');
  renderHistory();
})();
