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
})();
