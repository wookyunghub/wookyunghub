(async()=>{
  const C=window.CenterHubCommon,site=await C.siteReady;
  const fallbackOrg=await C.loadJson('data/organization.json',{basic:{},facilities:[],access:{},organization_chart:{officers:[],board:[]}});
  const [d,hist]=await Promise.all([
    C.api('api/public/organization',fallbackOrg),
    window.CenterHubHistory.load()
  ]);
  const b={...(d.basic||{}),name:site.organization_name||(d.basic||{}).name,parent_organization:site.parent_organization??(d.basic||{}).parent_organization,branch_name:site.branch_name??(d.basic||{}).branch_name},esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const basic=document.getElementById('about-basic');
  const basicCell=(label,value,unit='',badges=[])=>`<div class="fact-card"><small>${esc(label)}</small><div class="fact-main"><strong>${esc(value)}${esc(unit)}</strong>${badges.length?`<span class="fact-badges">${badges.filter(x=>x.value!==undefined&&x.value!==null&&x.value!=='').map(x=>`<span class="fact-badge">${esc(x.label)} ${esc(x.value)}${esc(x.unit||'')}</span>`).join('')}</span>`:''}</div></div>`;
  const cells=[];
  for(const [key,label] of [['name','경로당명'],['address','주소'],['phone','전화']])if(b[key]!==undefined&&b[key]!=='')cells.push(basicCell(label,b[key]));
  if(b.members_total!==undefined&&b.members_total!=='')cells.push(basicCell('회원수',b.members_total,'명',[{label:'남',value:b.members_male,unit:'명'},{label:'여',value:b.members_female,unit:'명'}]));
  if(b.building_area!==undefined&&b.building_area!=='')cells.push(basicCell('건물면적',b.building_area,'',[{label:'방',value:b.rooms,unit:'개'},{label:'화장실',value:b.restrooms,unit:'개'},{label:'주방',value:b.kitchen,unit:'개'}]));
  const affiliation=[b.parent_organization,b.branch_name].map(v=>String(v||'').trim()).filter(Boolean).join(' ');if(affiliation)cells.splice(b.name?1:0,0,basicCell('소속',affiliation));
  basic.innerHTML=cells.join('');
  const historyNote=document.getElementById('history-note');if(historyNote)historyNote.textContent='공지 외 공개 기록 중 최근 10건을 표시합니다.';
  const H=window.CenterHubHistory,h=document.getElementById('about-history'),rows=hist.records||[],visible=rows.slice(0,10);
  h.innerHTML=visible.length?visible.map(x=>`<div class="history-item"><time>${esc(H.formatDate(x.date))}</time><div class="history-copy"><strong>${esc(x.title||'')}</strong></div></div>`).join(''):`<div class="empty-state compact-empty" style="display:block;width:100%;text-align:left">${hist.error?'기록을 불러오지 못했습니다. 서버 연결을 확인한 후 새로고침해 주세요.':'표시할 공개 기록이 없습니다.'}</div>`;
  const actions=document.getElementById('history-actions'),more=document.getElementById('history-more');
  if(actions&&more){actions.hidden=!rows.length;more.href='history.html';more.textContent=`전체 연혁 보기 (${rows.length}건)`;more.removeAttribute('aria-expanded');}

  const chart=d.organization_chart||{},officers=(chart.officers||[]).filter(x=>x.public!==false),board=(chart.board||[]).filter(x=>x.public!==false);
  const name=x=>esc(x.name||'공석');
  const node=(x,cls='')=>`<div class="org-node ${cls} ${x.name?'':'vacant'}"><span>${esc(x.position||'')}</span><strong>${name(x)}</strong></div>`;
  const officerEl=document.getElementById('officer-chart');
  if(officerEl){
    if(!officers.length)officerEl.innerHTML='<div class="empty-state compact-empty">공개 가능한 임원 정보가 없습니다.</div>';
    else{
      const chair=officers.filter(x=>x.position==='회장');
      const vice=officers.filter(x=>x.position.startsWith('부회장'));
      const rest=officers.filter(x=>x.position!=='회장'&&!x.position.startsWith('부회장'));
      officerEl.innerHTML=`<div class="org-level org-level-top">${chair.map(x=>node(x,'org-primary')).join('')}</div>${vice.length?`<div class="org-connector"></div><div class="org-level">${vice.map(x=>node(x)).join('')}</div>`:''}${rest.length?`<div class="org-connector"></div><div class="org-level">${rest.map(x=>node(x)).join('')}</div>`:''}`;
    }
  }
  const boardEl=document.getElementById('board-chart');
  if(boardEl){
    if(!board.length)boardEl.innerHTML='<div class="empty-state compact-empty">공개 가능한 이사회 정보가 없습니다.</div>';
    else{
      const chair=board.filter(x=>x.position==='회장'),vice=board.filter(x=>x.position==='부회장'),directors=board.filter(x=>!['회장','부회장'].includes(x.position));
      boardEl.innerHTML=`<div class="org-level org-level-top">${chair.map(x=>node(x,'org-primary')).join('')}</div>${vice.length?`<div class="org-connector"></div><div class="org-level">${vice.map(x=>node(x)).join('')}</div>`:''}${directors.length?`<div class="org-connector"></div><div class="org-level org-directors">${directors.map(x=>node(x)).join('')}</div>`:''}`;
    }
  }
  document.getElementById('facility-list').innerHTML=(d.facilities||[]).map(x=>`<span>${esc(x)}</span>`).join('');
  document.getElementById('access-address').textContent=d.access?.address||b.address||'';document.getElementById('access-note').textContent=d.access?.map_note||'';


  const floorplanThumb=document.getElementById("floorplan-thumb");
  const floorplanViewer=document.getElementById("floorplan-viewer");
  const floorplanImage=document.getElementById("floorplan-image");
  if(floorplanThumb&&floorplanViewer&&floorplanImage){
    let scale=1,rotate=0;
    const applyTransform=()=>{floorplanImage.style.transform=`translateZ(0) scale(${scale}) rotate(${rotate}deg)`;};
    const resetTransform=()=>{scale=1;rotate=0;applyTransform();};
    const openViewer=()=>{resetTransform();if(typeof floorplanViewer.showModal==='function')floorplanViewer.showModal();else floorplanViewer.setAttribute('open','open');};
    const closeViewer=()=>{if(typeof floorplanViewer.close==='function')floorplanViewer.close();else floorplanViewer.removeAttribute('open');};
    floorplanThumb.addEventListener('click',openViewer);
    document.getElementById('floorplan-close')?.addEventListener('click',closeViewer);
    document.getElementById('floorplan-zoom-in')?.addEventListener('click',()=>{scale=Math.min(4,Number((scale+0.2).toFixed(2)));applyTransform();});
    document.getElementById('floorplan-zoom-out')?.addEventListener('click',()=>{scale=Math.max(0.4,Number((scale-0.2).toFixed(2)));applyTransform();});
    document.getElementById('floorplan-rotate-left')?.addEventListener('click',()=>{rotate-=90;applyTransform();});
    document.getElementById('floorplan-rotate-right')?.addEventListener('click',()=>{rotate+=90;applyTransform();});
    document.getElementById('floorplan-reset')?.addEventListener('click',resetTransform);
    floorplanViewer.addEventListener('click',e=>{if(e.target===floorplanViewer)closeViewer();});
    floorplanViewer.addEventListener('cancel',e=>{e.preventDefault();closeViewer();});
    floorplanViewer.addEventListener('close',resetTransform);
    floorplanImage.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY<0?0.1:-0.1;scale=Math.max(0.4,Math.min(4,Number((scale+delta).toFixed(2))));applyTransform();},{passive:false});
    document.addEventListener('keydown',e=>{if(!floorplanViewer.hasAttribute('open'))return;if(e.key==='Escape'){closeViewer();}else if(e.key==='+'||e.key==='='){scale=Math.min(4,Number((scale+0.2).toFixed(2)));applyTransform();}else if(e.key==='-'){scale=Math.max(0.4,Number((scale-0.2).toFixed(2)));applyTransform();}else if(e.key==='['){rotate-=90;applyTransform();}else if(e.key===']'){rotate+=90;applyTransform();}});
  }

  // --- 시설·비품 대장 조회 모달 기능 ---
  const invDialog = document.getElementById('inventory-dialog');
  const btnInv = document.getElementById('btn-facility-inventory');
  const btnInvHeader = document.getElementById('btn-facility-inventory-header');
  const invList = document.getElementById('inventory-list');
  const invSearch = document.getElementById('inventory-search');
  const invCountText = document.getElementById('inventory-count-text');
  let inventoryData = null;
  let activeCat = 'all';

  async function loadInventory() {
    if (inventoryData) return inventoryData;
    try {
      const res = await fetch('data/facility-inventory.json', { cache: 'no-store' });
      if (res.ok) {
        inventoryData = await res.json();
        return inventoryData;
      }
    } catch (e) {}
    try {
      const res = await fetch('../data/facility-inventory.json', { cache: 'no-store' });
      if (res.ok) {
        inventoryData = await res.json();
        return inventoryData;
      }
    } catch (e) {}
    return { items: [] };
  }

  function renderInventory() {
    if (!invList || !inventoryData) return;
    const items = inventoryData.items || [];
    const query = (invSearch?.value || '').trim().toLowerCase();

    const filtered = items.filter(x => {
      if (activeCat !== 'all' && x.cat !== activeCat) return false;
      if (!query) return true;
      return (x.name && x.name.toLowerCase().includes(query)) ||
             (x.spec && x.spec.toLowerCase().includes(query)) ||
             (x.group && x.group.toLowerCase().includes(query)) ||
             (x.id && x.id.toLowerCase().includes(query)) ||
             (x.note && x.note.toLowerCase().includes(query));
    });

    if (invCountText) {
      invCountText.textContent = `조회 결과: 총 ${filtered.length}개 품목 (전체 ${items.length}개)`;
    }

    if (!filtered.length) {
      invList.innerHTML = '<div style="text-align:center;padding:40px 10px;color:#8c7565;font-size:14px">검색 결과에 해당하는 시설·비품이 없습니다.</div>';
      return;
    }

    const groups = {};
    filtered.forEach(item => {
      const g = item.group || '기타';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });

    let html = '';
    for (const [groupName, groupItems] of Object.entries(groups)) {
      html += `
        <div class="inv-group-title">
          <span>${esc(groupName)}</span>
          <span class="inv-group-count">${groupItems.length}종</span>
        </div>
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width:75px">관리번호</th>
              <th>품명 및 규격·모델</th>
              <th style="width:65px;text-align:center">수량</th>
              <th style="width:90px;text-align:center">취득구분</th>
              <th style="width:70px;text-align:center">상태</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            ${groupItems.map(item => `
              <tr>
                <td style="color:#7a6859;font-weight:600">${esc(item.id)}</td>
                <td>
                  <strong style="color:#3c281b">${esc(item.name)}</strong>
                  ${item.spec ? `<div style="font-size:12px;color:#6d5b4e;margin-top:2px">${esc(item.spec)}</div>` : ''}
                </td>
                <td style="text-align:center;font-weight:700;color:#2c4028">${esc(item.qty)}${esc(item.unit || '개')}</td>
                <td style="text-align:center;font-size:12px;color:#5a493c">${esc(item.acquire || '-')}</td>
                <td style="text-align:center">
                  <span class="inv-status-badge inv-status-${esc(item.status || '사용')}">${esc(item.status || '사용')}</span>
                </td>
                <td style="font-size:12px;color:#7a6859">${esc(item.note || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    invList.innerHTML = html;
  }

  async function openInventory() {
    if (!invDialog) return;
    await loadInventory();
    renderInventory();
    if (typeof invDialog.showModal === 'function') invDialog.showModal();
    else invDialog.setAttribute('open', 'open');
  }

  function closeInventory() {
    if (!invDialog) return;
    if (typeof invDialog.close === 'function') invDialog.close();
    else invDialog.removeAttribute('open');
  }

  if (btnInv) btnInv.addEventListener('click', openInventory);
  if (btnInvHeader) btnInvHeader.addEventListener('click', openInventory);
  document.getElementById('inventory-close-btn')?.addEventListener('click', closeInventory);
  document.getElementById('inventory-foot-close-btn')?.addEventListener('click', closeInventory);
  document.getElementById('inventory-print-btn')?.addEventListener('click', () => window.print());

  if (invDialog) {
    invDialog.addEventListener('click', e => {
      if (e.target === invDialog) closeInventory();
    });
    invDialog.addEventListener('cancel', e => {
      e.preventDefault();
      closeInventory();
    });
  }

  document.querySelectorAll('.inv-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.inv-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeCat = pill.dataset.cat || 'all';
      renderInventory();
    });
  });

  if (invSearch) {
    invSearch.addEventListener('input', () => {
      renderInventory();
    });
  }
})();
