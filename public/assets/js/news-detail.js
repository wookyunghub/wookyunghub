(async()=>{
  const out=document.getElementById('news-detail'),back=document.getElementById('news-back'),edit=document.getElementById('record-detail-edit');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const q=new URLSearchParams(location.search),id=q.get('id')||'',fromAdmin=q.get('from')==='admin';
  back.href=fromAdmin?'admin/records.html':q.has('page')?`news-list.html?page=${encodeURIComponent(q.get('page'))}`:'news-list.html';
  back.textContent=fromAdmin?'← 통합 기록 관리':'← 목록으로';
  async function get(path){
    const clean = String(path).replace(/^\/+/,'').split('?')[0];
    if (clean.includes('admin/status')) {
      try {
        const r = await fetch(path, {credentials:'same-origin', cache:'no-store'});
        if (r.ok && (r.headers.get('content-type')||'').toLowerCase().includes('application/json')) return await r.json();
      } catch(e){}
      return { authenticated: false };
    }
    try {
      const r = await fetch(path, {credentials:'same-origin', cache:'no-store'});
      if (r.ok && (r.headers.get('content-type')||'').toLowerCase().includes('application/json')) return await r.json();
    } catch(e){}

    if (clean.includes('records')) {
      const fr = await fetch('data/records.json', {cache:'no-store'});
      if (fr.ok) return await fr.json();
    }
    if (clean.includes('resources') || clean.includes('files')) {
      const fr = await fetch('data/resources.json', {cache:'no-store'});
      if (fr.ok) return await fr.json();
    }
    throw Error('상세정보를 불러오지 못했습니다.');
  }
  try{
  const C=window.CenterHubCommon;await C.siteReady;
  let authenticated=false;try{authenticated=!!(await get('api/admin/status')).authenticated;}catch(e){if(fromAdmin)throw e;}
  edit.hidden=!authenticated;
  if(!authenticated)edit.remove();
  if(fromAdmin&&!authenticated){out.textContent='관리자 로그인이 필요합니다. 로그인 후 관리자 목록에서 다시 선택해 주세요.';return;}
  const adminMode=authenticated;
  const d=await get(adminMode?'api/admin/records':'api/public/records');
  const records=Array.isArray(d)?d:(d.records||[]);
  const x=records.find(y=>String(y.id)===id&&y.status!=='deleted'&&(adminMode||y.public===true));
  if(!x){out.textContent='해당 기록을 찾을 수 없거나 조회 권한이 없습니다.';return;}
  const labels={notice:'공지',meeting:'회의',event:'행사',event_schedule:'행사',activity:'행사',history:'기타 운영',person:'임원·회원',facility:'시설·비품',asset:'시설·비품',finance:'재정',receipt:'영수증·증빙',regulation:'규정',document:'기타 운영'};
  if(authenticated){edit.href='admin/'+(x.module==='notice'?'announcements.html':'records.html')+'?edit='+encodeURIComponent(x.id);edit.hidden=false;}
  if(fromAdmin&&x.module==='notice'){back.href='admin/announcements.html';back.textContent='← 공지사항 관리';}
  if(!fromAdmin){const type=['all','notice','records'].includes(q.get('list'))?q.get('list'):'all';const backQuery=new URLSearchParams();if(type!=='all')backQuery.set('type',type);if(q.has('page'))backQuery.set('page',q.get('page'));back.href='news-list.html'+(backQuery.size?'?'+backQuery.toString():'');back.textContent=type==='notice'?'← 공지사항':type==='records'?'← 회의·행사 기록':'← 공지 및 소식';}
  if(x.module==='notice')out.closest('.content-panel').classList.add('notice-detail-panel');
  const extra=x.extra||{},title=x.title||'',body=x.body||'';
  const recorder=String(x.recorder||x.recorded_by||extra.recorder||'').trim();
  const isMeeting=x.module!=='notice'&&(x.module==='meeting'||/총회|회의록|이사회|임시회의|정기회의|간담회/.test(title));
  const kind=String(extra.meeting_type||'').trim()||(/정기/.test(title)?'정기':/임시/.test(title)?'임시':'기타');
  const names=Array.isArray(extra.attendee_names)?extra.attendee_names.filter(n=>typeof n==='string'&&n.trim()):[];
  // Public API masks names; mask again defensively in case an older API returns plain names.
  const mask=name=>{const s=String(name).trim();if(s.includes('*'))return s;if(s.length<=1)return '*';if(s.length===2)return s[0]+'*';return s[0]+'*'.repeat(s.length-2)+s.slice(-1);};
  const attendees=[...names].sort((a,b)=>a.localeCompare(b,'ko-KR')).map(n=>adminMode?n:mask(n));
  const roster=Array.isArray(extra.attendees)?extra.attendees.filter(a=>a&&typeof a.name==='string'&&a.name.trim()):names.map(name=>({name,gender:''}));
  const members=roster.filter(a=>a.attendee_type!=='nonmember');
  const guests=roster.filter(a=>a.attendee_type==='nonmember');
  const groupPeople=gender=>members.filter(a=>(['남','여'].includes(a.gender)?a.gender:'')===gender).sort((a,b)=>a.name.localeCompare(b.name,'ko-KR'));
  const rosterBlock=(people,label,wide=false)=>`<section class="meeting-roster-group${wide?' meeting-roster-wide':''}"><h3>${label} <small>${people.length}명</small></h3><ol class="meeting-attendee-list">${[...people].sort((a,b)=>a.name.localeCompare(b.name,'ko-KR')).map(a=>`<li>${esc(adminMode?a.name:mask(a.name))}</li>`).join('')}</ol>${people.length?'':'<p class="small">참석자 없음</p>'}</section>`;
  const rosterHTML=`<div class="meeting-roster-groups">${rosterBlock(groupPeople('남'),'남성 회원')}${rosterBlock(groupPeople('여'),'여성 회원')}${groupPeople('').length?rosterBlock(groupPeople(''),'성별 미등록·구분 확인',true):''}${guests.length?rosterBlock(guests,'비회원',true):''}</div>`;
  const memberCount=roster.filter(a=>a.attendee_type==='member').length;
  const unknownCount=roster.length-memberCount-guests.length;
  const rosterSummary=`참석자 총 ${roster.length}명(회원 ${memberCount}명, 비회원 ${guests.length}명${unknownCount?', 구분 미확인 '+unknownCount+'명':''})`;
  const count=extra.participants||extra.attendance||(attendees.length?attendees.length+'명':'미기록');
  const source=String(x.source||'');const page=source.match(/PDF\s*(\d+)쪽/);
  const book=source.includes('본책1')?'book1':source.includes('본책2')?'book2':'';
  const url=page&&book?`ebook.html?ledger=2025-2026&doc=${book}&page=${page[1]}`:'';
  const sourceBlock=source?`<div class="detail-source"><b>자료 출처</b> ${esc(source)} ${url?`<a class="btn" href="${url}">운영대장 원본 ${esc(page[1])}쪽 보기 ↗</a>`:''}</div>`:'';
  const resources=await get(adminMode?'api/admin/files':'api/public/resources');
  const files=new Map();for(const kind of (adminMode?['documents','photos','receipts']:['documents','photos']))for(const f of resources[kind]||[])if((f.public&&String(f.url||'').startsWith('/media/public/'))||(adminMode&&String(f.url||'').startsWith('/media/private/')))files.set(kind+':'+f.id,f);
  const attachmentRoles={minutes:'회의록 원본',attendance:'참석명단',report:'보고자료',receipt:'영수증·증빙',other:'기타'};
  const attachments=(x.attachments||[]).map(id=>files.get(id)).filter(Boolean);
  const attachmentBlock=attachments.length?`<section class="detail-source"><b>관련 자료</b><ul>${attachments.map(f=>`<li>${esc(attachmentRoles[f.attachment_role]||'자료')} · <a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.attachment_role==='minutes'?'회의록 원본 보기':f.attachment_role==='attendance'?'참석명단 원본 보기':(f.title||f.name))}${['minutes','attendance'].includes(f.attachment_role)?' · '+esc(f.title||f.name):''}</a>${adminMode?' · '+(f.public?'공개':'관리자 전용'):''}</li>`).join('')}</ul></section>`:'';
  document.title=title+' · 우경경로당';
  if(isMeeting){
    out.innerHTML=`<article class="meeting-sheet" aria-label="회의 상세">
      <header class="meeting-sheet-head"><span class="meeting-sheet-kicker">우경경로당 · 회의기록</span><div class="meeting-title-line"><h1>${esc(title)}</h1><span class="meeting-title-recorder">기록자 ${esc(recorder||'미등록')}</span></div><span class="meeting-sheet-status">${esc(kind)} 회의</span></header>
      <div class="meeting-info-grid">
        <div class="meeting-info-item"><strong>회의일자</strong><span>${esc(x.date||'미기록')}</span></div>
        <div class="meeting-info-item"><strong>회의구분</strong><span>${esc(kind)} 회의</span></div>
        <div class="meeting-info-item"><strong>장소</strong><span>${esc(extra.place||'미기록')}</span></div>
        ${extra.chair?`<div class="meeting-info-item"><strong>의장</strong><span>${esc(extra.chair)}</span></div>`:''}
        <div class="meeting-info-item"><strong>참석인원</strong><button type="button" id="meeting-attendee-button" class="meeting-attendee-button" aria-expanded="false" aria-controls="meeting-attendee-panel">${esc(count)} · 참석명단 ${attendees.length?'보기':'확인'} ↗</button></div>
      </div>
      <section id="meeting-attendee-panel" class="meeting-attendee-panel" hidden aria-label="회의 참석명단"><div class="meeting-attendee-panel-head"><h2>참석명단</h2><button type="button" id="meeting-attendee-close" class="btn">닫기</button></div>${attendees.length?`<p class="meeting-attendee-note">${rosterSummary} · ${adminMode?'관리자 조회':'이름은 일부 가림 처리됩니다.'}</p>${rosterHTML}`:`<p class="meeting-attendee-note">이 회의는 참석인원(${esc(count)})만 기록되어 있으며, 참석자 개인별 명단은 아직 등록되지 않았습니다.</p>`}</section>
      <section class="meeting-sheet-section"><h2>회의 안건 및 논의·결의사항</h2><p>${esc(extra.decisions||'별도로 입력된 안건·결의사항이 없습니다.')}</p></section>
      <section class="meeting-sheet-section"><h2>회의 내용</h2><p class="meeting-body">${esc(body||'기록된 회의 내용이 없습니다.')}</p></section>
      ${sourceBlock}${attachmentBlock}
    </article>`;
    const button=document.getElementById('meeting-attendee-button'),panel=document.getElementById('meeting-attendee-panel');
    const toggle=show=>{panel.hidden=!show;button.setAttribute('aria-expanded',String(show));button.textContent=`${count} · 참석명단 ${show?'닫기':'확인'} ↗`;};
    button.addEventListener('click',()=>toggle(panel.hidden));
    document.getElementById('meeting-attendee-close').addEventListener('click',()=>toggle(false));
  }else{
    const fields=x.module==='notice'?[]:[['place','장소'],['attendance','참가 인원'],['outcome','행사 결과']];

    const props=fields.filter(([key])=>key==='__recorder'||extra[key]).map(([key,label])=>`<div class="detail-row"><strong>${label}</strong><span>${esc(key==='__recorder'?recorder:extra[key])}</span></div>`).join('');
    out.innerHTML=`<div class="detail-type">${esc(labels[x.module]||'기록')}</div><div class="detail-title-line"><h1>${esc(title)}</h1><span class="detail-inline-recorder">기록자 ${esc(recorder||'미등록')}</span></div><p class="detail-date">${esc(x.date||'날짜 미상')}</p>${props?`<div class="detail-fields">${props}</div>`:''}<section class="detail-body">${x.module==='notice'?'':'<h2>내용</h2>'}<p>${esc(body||'기록된 본문이 없습니다.')}</p></section>${sourceBlock}${attachmentBlock}`;
  }
  }catch(e){out.textContent=e.message||'상세정보를 불러오지 못했습니다.';edit.hidden=true;}
})();
