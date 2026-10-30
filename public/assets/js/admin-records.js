(async()=>{
const $=id=>document.getElementById(id);
const noticeMode=document.body.dataset.recordMode==='notice',recordPage=noticeMode?'announcements.html':'records.html';
const inScope=x=>noticeMode?x.module==='notice':x.module!=='notice';
const mod=$('record-module'),filter=$('record-list-filter'),date=$('record-date'),title=$('record-title'),body=$('record-body'),pub=$('record-public'),tags=$('record-tags'),list=$('record-list'),msg=$('record-msg'),extraBox=$('record-extra-fields'),att=$('record-attachments'),count=$('record-list-count');
let rows=[],editId='',defaultRecorderTitle='관리자',recordSaving=false,extraDraft={};
const recorder=$('record-recorder');$('record-editor').inert=true;
const supportsRecorder=()=>['notice','meeting','event','activity','event_schedule'].includes(mod.value);
function showRecorder(){const container=$('record-recorder-field');if(container)container.hidden=!supportsRecorder();}
async function getAdminTitle(){try{const r=await fetch('../api/admin/status',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json();if(d.authenticated&&d.recorder_title)defaultRecorderTitle=d.recorder_title;}catch(e){console.warn(e)}if(!editId)recorder.value=defaultRecorderTitle;}
// 과거의 연도/월 단위 날짜는 그대로 유지하고, 신규 날짜는 달력으로 입력합니다.
function normalizeRecordDate(value=''){
 const v=String(value||'').trim();
 if(/^\d{4}년$/.test(v))return v.slice(0,4);
 const m=v.match(/^(\d{4})[.\/-](\d{1,2})(?:[.\/-](\d{1,2}))?\.?$/)||v.match(/^(\d{4})년\s*(\d{1,2})월(?:\s*(\d{1,2})일)?$/);
 return m?m[1]+'-'+m[2].padStart(2,'0')+(m[3]?'-'+m[3].padStart(2,'0'):''):v;
}
let legacyRecordDate='';
function setRecordDate(value=''){
 const v=normalizeRecordDate(value);
 date.type='date';
 const complete=/^\d{4}-\d{2}-\d{2}$/.test(v);
 date.value=complete?v:'';legacyRecordDate=v&&!complete?v:'';
 const note=$('record-date-note');if(note){note.hidden=!legacyRecordDate;note.textContent=legacyRecordDate?'기존 날짜: '+legacyRecordDate+' · 정확한 날짜를 선택하면 변경됩니다. 미선택 시 기존 날짜를 유지합니다.':'';}
}
date.addEventListener('input',()=>{if(date.value){legacyRecordDate='';const note=$('record-date-note');if(note){note.hidden=true;note.textContent='';}}});
function setMeetingType(value=''){
 const el=extraBox.querySelector('[data-extra="meeting_type"]');if(!el)return;
 const v=String(value||'');
 if(v&&![...el.options].some(o=>o.value===v))el.add(new Option(v+' (기존 값)',v));
 el.value=v;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const recordTypes=[['meeting','회의'],['event','행사'],['facility','시설·비품'],['document','기타 운영']];
const legacyTypes={history:'document',activity:'event',event_schedule:'event',person:'document',asset:'facility',finance:'document',receipt:'document',regulation:'document'};
const recordType=value=>legacyTypes[value]||value;
const labels={notice:'공지',...Object.fromEntries(recordTypes)};
if(!noticeMode){
 mod.replaceChildren(new Option('자료구분 선택',''),...recordTypes.map(([v,t])=>new Option(t,v)));
 filter.replaceChildren(new Option('전체 기록','__all__'),...recordTypes.map(([v,t])=>new Option(t,v)));
}

const detail={meeting:[['meeting_type','회의구분 (정기/임시/기타)'],['place','회의장소'],['chair','의장'],['participants','참석인원 (명단 미등록 시 입력)'],['decisions','안건 및 논의·결의사항']],event:[['place','행사 장소'],['attendance','참석인원'],['outcome','행사 결과']],finance:[['transaction_type','수입·지출 구분'],['amount','금액(원)'],['account','계정과목']]};
const attendeePanel=$('meeting-attendee-panel'),attendeeList=$('meeting-attendee-list'),attendeeSearch=$('meeting-attendee-search'),attendeeCount=$('meeting-attendee-count'),attendeeMsg=$('meeting-attendee-message');
let memberRows=[],selectedAttendees=new Set(),manualAttendees=[],attendeeTouched=false,originalParticipantText='',editingRecord=null;
const manualInput=$('meeting-attendee-manual'),manualNamesBox=$('meeting-attendee-manual-list');
const parseManualNames=raw=>[...new Set(String(raw||'').split(/[,，;；\n]+/).map(v=>v.trim()).filter(Boolean))];
function updateManualNames(){const raw=parseManualNames(manualInput.value);const unique=new Set(memberRows.filter(m=>selectedAttendees.has(m.id)).map(m=>m.name));manualAttendees=raw.filter(n=>!unique.has(n));manualNamesBox.innerHTML=manualAttendees.map(name=>`<span class="attendee-guest-name">${esc(name)}</span>`).join('');}
manualInput.addEventListener('input',()=>{attendeeTouched=true;renderAttendees()});
const supportsAttendees=()=>mod.value==='meeting'||(mod.value==='event'&&/총회|회의|이사회|간담회/.test(title.value));
async function loadMembers(){try{const r=await fetch('../api/admin/members',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();memberRows=(d.members||[]).filter(x=>x.status!=='deleted'&&x.id&&x.name);attendeeMsg.textContent='';renderAttendees()}catch(e){attendeeMsg.textContent='회원명부를 불러오지 못했습니다. 저장 전에 다시 확인하십시오.';memberRows=[]}}
const includeInactive=document.createElement('input');includeInactive.type='checkbox';includeInactive.id='meeting-include-inactive';const inactiveLabel=document.createElement('label');inactiveLabel.className='attendee-inactive-option';inactiveLabel.append(includeInactive,document.createTextNode('사망·제적 회원 포함'));attendeeList.before(inactiveLabel);includeInactive.onchange=renderAttendees;
const koName=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ko-KR')||String(a.id).localeCompare(String(b.id));
function renderAttendees(){
 attendeePanel.hidden=!supportsAttendees();if(attendeePanel.hidden)return;
 const term=attendeeSearch.value.trim().toLocaleLowerCase();
 const matched=memberRows.filter(m=>(!m.status||m.status==='active'||includeInactive.checked||selectedAttendees.has(m.id))).filter(m=>m.name.toLocaleLowerCase().includes(term)).sort(koName);
 const group=(gender,label)=>{const people=matched.filter(m=>String(m.gender||'').trim()===gender);
  return `<section class="attendee-gender-group"><h4>${label} <small>${people.length}명</small></h4><div class="attendee-gender-items">${people.map(m=>`<label class="attendee-choice"><input type="checkbox" data-member-id="${esc(m.id)}" ${selectedAttendees.has(m.id)?'checked':''}><span>${esc(m.name)}${m.status==='deceased'?' · 사망':m.status==='withdrawn'?' · 제적':''}</span><small>${esc((m.member_type||'회원')+(m.status==='deceased'?' · 사망':m.status==='withdrawn'?' · 제적':''))}</small></label>`).join('')||'<p class="small">해당 회원이 없습니다.</p>'}</div></section>`};
 const other=matched.filter(m=>!['남','여'].includes(String(m.gender||'').trim()));
 attendeeList.innerHTML=group('남','남성')+group('여','여성')+(other.length?`<section class="attendee-gender-group attendee-other"><h4>성별 미등록 <small>${other.length}명</small></h4><div class="attendee-gender-items">${other.map(m=>`<label class="attendee-choice"><input type="checkbox" data-member-id="${esc(m.id)}" ${selectedAttendees.has(m.id)?'checked':''}><span>${esc(m.name)}${m.status==='deceased'?' · 사망':m.status==='withdrawn'?' · 제적':''}</span><small>${esc((m.member_type||'회원')+(m.status==='deceased'?' · 사망':m.status==='withdrawn'?' · 제적':''))}</small></label>`).join('')}</div></section>`:'');
 const activeSelected=[...selectedAttendees].filter(id=>memberRows.some(m=>m.id===id));
 updateManualNames(); const totalSelected=activeSelected.length+manualAttendees.length;$('meeting-attendee-summary').textContent=`참석명단 · 총 ${totalSelected}명`;
 attendeeCount.textContent=`참석자 총 ${totalSelected}명(회원 ${activeSelected.length}명, 비회원 ${manualAttendees.length}명)`;
 const participantsField=extraBox.querySelector('[data-extra="participants"]');
 if(participantsField){participantsField.readOnly=totalSelected>0;participantsField.title=totalSelected?'선택된 참석명단 기준으로 자동 계산됩니다.':'';if(totalSelected)participantsField.value=totalSelected+'명';else if(attendeeTouched)participantsField.value='';}
}

attendeeSearch.oninput=renderAttendees;
attendeeList.onchange=e=>{if(!e.target.matches('input[data-member-id]'))return;attendeeTouched=true;const id=e.target.dataset.memberId;if(e.target.checked)selectedAttendees.add(id);else selectedAttendees.delete(id);renderAttendees()};
$('meeting-attendee-clear').onclick=()=>{selectedAttendees.clear();manualInput.value='';attendeeTouched=true;renderAttendees()};
$('meeting-attendee-select-all').onclick=()=>{if(!memberRows.length){attendeeMsg.textContent='회원명부를 먼저 불러와 주세요.';return}memberRows.filter(m=>!m.status||m.status==='active'||includeInactive.checked).forEach(m=>selectedAttendees.add(m.id));attendeeTouched=true;renderAttendees()};
const dateKey=v=>{const a=String(v||'').match(/\d+/g)||[];return Number(a[0]||0)*10000+Number(a[1]||0)*100+Number(a[2]||0)};
function drawExtra(values={}){
 extraDraft={...extraDraft,...values};
 const heading=document.querySelector('.admin-compact-heading h1');if(heading&&!$('record-editor').hidden)heading.textContent=(editId?'기록 수정':'기록 등록')+(mod.value==='meeting'?' · 회의':'');
 $('record-editor').classList.toggle('meeting-editor',mod.value==='meeting');$('record-editor-heading').textContent=(editId?'기록 수정':'새 기록')+(mod.value==='meeting'?' · 회의':'');$('record-body-label').textContent=mod.value==='meeting'?'회의 내용':'내용';
 extraBox.innerHTML=(detail[mod.value]||[]).map(([key,label])=>key==='meeting_type'
  ?`<label>회의구분<select data-extra="meeting_type"><option value="">선택하세요</option>${['정기','임시','기타'].map(v=>`<option value="${v}">${v}</option>`).join('')}</select></label>`
  :key==='decisions'?`<label>${label}<textarea data-extra="${key}" rows="3">${esc(values[key]??'')}</textarea><small>이 항목은 아래 회의 내용과 별도로 저장됩니다.</small></label>`:`<label>${label}<input data-extra="${key}" value="${esc(values[key]??'')}"></label>`).join('');
 if(mod.value==='meeting')setMeetingType(values.meeting_type);
}
function getExtra(){const d={...(editingRecord?.extra||{}),...extraDraft};extraBox.querySelectorAll('[data-extra]').forEach(e=>d[e.dataset.extra]=e.value.trim());extraDraft={...d};return d}
const attachmentRoles={minutes:'회의록 원본',attendance:'참석명단',report:'보고자료',receipt:'영수증·증빙',other:'기타'};
let fileIndex=new Map(),filesLoaded=false;
function attachmentOption(kind,x){const key=kind+':'+x.id;fileIndex.set(key,x);return new Option((attachmentRoles[x.attachment_role]||({'documents':'문서','photos':'사진','receipts':'영수증'})[kind])+' · '+(x.title||x.name||'')+' · '+(x.public?'공개':'비공개'),key);}
let pendingFiles=[];
const fileTypes={document:{kind:'documents',role:'',label:'일반문서'},photo:{kind:'photos',role:'',label:'사진'},minutes:{kind:'documents',role:'minutes',label:'회의록 원본'},attendance:{kind:'documents',role:'attendance',label:'참석명단'},report:{kind:'documents',role:'report',label:'보고자료'},receipt:{kind:'receipts',role:'receipt',label:'영수증·증빙'}};
function renderPendingFiles(){
 const box=$('record-pending-files');box.replaceChildren();
 for(const entry of pendingFiles){
 const row=document.createElement('div');row.className='record-pending-row';
 const name=document.createElement('span');name.textContent='등록 예정 · '+entry.file.name;row.append(name);
 const type=document.createElement('select');type.setAttribute('aria-label',entry.file.name+' 자료유형');for(const [key,value]of Object.entries(fileTypes))type.add(new Option(value.label,key));type.value=entry.type;type.disabled=!!entry.attempted;
 const visibility=document.createElement('select');visibility.setAttribute('aria-label',entry.file.name+' 공개 여부');visibility.add(new Option('관리자만','false'));visibility.add(new Option('공개','true'));visibility.value=String(entry.public);visibility.disabled=entry.type==='receipt'||!!entry.attempted;
 type.onchange=()=>{entry.type=type.value;if(entry.type==='receipt'){entry.public=false;visibility.value='false';}visibility.disabled=entry.type==='receipt'||!!entry.attempted;};visibility.onchange=()=>{entry.public=visibility.value==='true';};
 if(/\.(hwp|hwpx|doc|docx)$/i.test(entry.file.name)){const label=document.createElement('label');label.textContent='PDF 열람본(선택)';const input=document.createElement('input');input.type='file';input.accept='.pdf,application/pdf';input.disabled=!!entry.attempted;input.onchange=()=>{entry.pdf=input.files[0]||null;};label.append(input);if(entry.pdf){const span=document.createElement('small');span.textContent=entry.pdf.name;label.append(span);}row.append(label);}
 const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='제거';remove.onclick=()=>{pendingFiles=pendingFiles.filter(x=>x!==entry);renderPendingFiles();};row.append(type,visibility,remove);box.append(row);
 }
}
$('record-file-add').onclick=()=>{if(!recordSaving)$('record-new-files').click();};
$('record-new-files').onchange=()=>{for(const file of $('record-new-files').files){if(pendingFiles.some(x=>x.file===file))continue;pendingFiles.push({file,type:/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)?'photo':'document',public:true,token:typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('')});}$('record-new-files').value='';renderPendingFiles();};
async function uploadPendingFiles(recordDate){
 if(pendingFiles.some(x=>/\.(hwp|hwpx|doc|docx)$/i.test(x.file.name)&&!x.pdf)&&!confirm('PDF 열람본이 없는 문서는 홈페이지에서 원본 다운로드로 제공합니다. 등록하시겠습니까?'))throw new Error('파일 등록을 취소했습니다.');
 while(pendingFiles.length){const entry=pendingFiles[0];entry.attempted=true;renderPendingFiles();const type=fileTypes[entry.type],fd=new FormData();for(const [key,value]of Object.entries({kind:type.kind,attachment_role:type.role,public:String(entry.public),title:entry.file.name,date:recordDate,book_include:'false',upload_token:entry.token}))fd.append(key,value);fd.append('file',entry.file,entry.file.name);if(entry.pdf)fd.append('pdf_file',entry.pdf,entry.pdf.name);
 const result=await window.CenterHubUpload.upload(fd,percent=>{msg.textContent=`${entry.file.name} 등록 중 · ${percent}%`;});const key=type.kind+':'+result.item.id;let option=[...att.options].find(o=>o.value===key);if(!option){option=attachmentOption(type.kind,result.item);att.add(option);}option.selected=true;pendingFiles.shift();renderPendingFiles();updateAttachmentPreview();
 }
}
let materialDraft=null;
function updateAttachmentPreview(){
 const box=$('record-connected-files');box.replaceChildren();
 for(const o of att.selectedOptions){const x=fileIndex.get(o.value);if(!x)continue;
 const link=document.createElement('a');link.href=x.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=o.text;box.append(link);}
 $('record-materials-summary').textContent=`관련자료 · ${att.selectedOptions.length}개`;
 if(!box.children.length)box.textContent='등록된 관련자료가 없습니다.';
 $('record-attachment-links').textContent='';
 if(materialDraft)renderFileCandidates();
}
function renderFileCandidates(){
 const box=$('record-file-candidates');box.replaceChildren();const query=$('record-files-search').value.trim().toLocaleLowerCase();
 const options=[...att.options].sort((a,b)=>Number(materialDraft.has(b.value))-Number(materialDraft.has(a.value)));
 for(const o of options){if(!o.text.toLocaleLowerCase().includes(query))continue;
 const label=document.createElement('label');label.className='record-material-option';
 const check=document.createElement('input');check.type='checkbox';check.value=o.value;check.checked=materialDraft.has(o.value);
 check.onchange=()=>{if(check.checked)materialDraft.add(o.value);else materialDraft.delete(o.value);updateMaterialCount();};
 const text=document.createElement('span');text.textContent=o.text;label.append(check,text);box.append(label);}
 if(!box.children.length)box.textContent='검색 결과가 없습니다.';updateMaterialCount();
}
function updateMaterialCount(){$('record-files-count').textContent=`선택 ${materialDraft?.size||0}개`;}
$('record-files-choose').onclick=()=>{materialDraft=new Set([...att.selectedOptions].map(o=>o.value));$('record-files-search').value='';renderFileCandidates();$('record-file-picker').showModal();loadFiles();};
$('record-files-cancel').onclick=()=>{$('record-file-picker').close();materialDraft=null;};
$('record-file-picker').addEventListener('close',()=>{materialDraft=null;});
$('record-files-search-button').onclick=renderFileCandidates;
$('record-files-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();renderFileCandidates();}};
$('record-files-add').onclick=()=>{for(const o of att.options)o.selected=materialDraft.has(o.value);$('record-file-picker').close();materialDraft=null;updateAttachmentPreview();};

async function loadFiles(){
 try{const r=await fetch('../api/admin/files',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
 const d=await r.json();fileIndex=new Map();const opts=[];
 for(const k of ['documents','photos','receipts'])for(const x of d[k]||[]){
  if(!x.id||!x.url)continue;
  const key=k+':'+x.id;fileIndex.set(key,x);
  opts.push(attachmentOption(k,x));
 }
 const selected=new Set([...att.selectedOptions].map(o=>o.value));att.replaceChildren(...opts);filesLoaded=true;[...att.options].forEach(o=>o.selected=selected.has(o.value));updateAttachmentPreview();
 }catch(e){filesLoaded=false;$('record-attachment-links').textContent='파일 목록을 불러오지 못했습니다.';console.warn(e)}
}
att.addEventListener('change',updateAttachmentPreview);
window.addEventListener('focus',()=>{if(!$('record-editor').hidden&&!recordSaving)loadFiles();});
async function load(){
 const r=await fetch('../api/admin/records',{credentials:'same-origin',cache:'no-store'});
 if(!r.ok){msg.textContent='기록 조회 실패 ('+r.status+')';return}
 const d=await r.json(),all=d.records||[];
 if(filter.value==='__news__'){
  const pr=await fetch('../api/public/news',{credentials:'same-origin',cache:'no-store'});
  if(!pr.ok){msg.textContent='공개 기록 목록을 불러오지 못했습니다.';return}
  const publicData=await pr.json();const feed=window.CenterHubFeed.all(publicData);
  const byId=new Map(all.map(x=>[String(x.id),x]));
  rows=feed.map(x=>byId.get(String(x.id))).filter(x=>x&&inScope(x));
 }else{
  rows=all.filter(inScope).filter(x=>filter.value==='__all__'||recordType(x.module)===filter.value)
   .sort((a,b)=>dateKey(b.date)-dateKey(a.date)||String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
 }
 render();
}
function render(){
 count.textContent=`조회 ${rows.length}건 · ${filter.value==='__news__'?'홈페이지 공개 목록과 동일한 기준':'관리자 전용·비공개 기록 포함 가능'}`;
 list.innerHTML=rows.length?rows.map(x=>{
  const summary=String(x.body||x.extra?.decisions||'내용 없음').replace(/\s+/g,' ').trim();
  return `<article class="record-list-row"><div class="record-list-main"><div class="record-list-title"><span class="badge">${esc(labels[recordType(x.module)]||x.module)}</span><time>${esc(x.date||'날짜 없음')}</time><a href="../news-detail.html?id=${encodeURIComponent(x.id)}&from=admin">${esc(x.title||'제목 없음')}</a></div><p class="record-list-summary" title="${esc(summary.slice(0,300))}">${esc(summary.slice(0,180))}</p><small>${x.public?'공개':'비공개'} · 첨부 ${(x.attachments||[]).length}개</small></div><div class="record-list-actions"><button class="btn" data-edit="${esc(x.id)}">수정</button><button class="btn danger" data-del="${esc(x.id)}">삭제</button></div></article>`;
 }).join(''):'<div class="empty-state compact-empty">해당 분류의 등록 기록이 없습니다.</div>';
}
function reset(){includeInactive.checked=false;pendingFiles=[];$('record-new-files').value='';renderPendingFiles();extraDraft={};if($('record-history-excluded'))$('record-history-excluded').checked=false;$('record-file-picker').close();materialDraft=null;$('record-files-search').value='';mod.value=noticeMode?'notice':'';document.querySelectorAll('#record-editor details').forEach(e=>e.open=false);recorder.value=defaultRecorderTitle;showRecorder();editingRecord=null;selectedAttendees.clear();manualAttendees=[];manualInput.value='';attendeeTouched=false;originalParticipantText='';attendeeSearch.value='';editId='';setRecordDate();title.value='';body.value='';tags.value='';drawExtra();[...att.options].forEach(o=>o.selected=false);updateAttachmentPreview();pub.value='true';msg.textContent='';renderAttendees()}
mod.onchange=()=>{const values=getExtra();drawExtra(values);showRecorder();renderAttendees();};title.addEventListener('input',renderAttendees);filter.onchange=load;$('record-new').onclick=()=>reset();
$('record-save').onclick=async()=>{if(recordSaving)return;if(!filesLoaded&&editingRecord?.attachments?.length){msg.textContent='기존 관련자료 목록을 불러오지 못했습니다. 관련자료 관리를 다시 열어 목록을 불러온 후 저장해 주세요.';return;}if((noticeMode&&mod.value!=='notice')||(!noticeMode&&mod.value==='notice')){msg.textContent='자료구분에 맞는 관리 화면에서 등록해 주세요.';return;}if(!mod.value){msg.textContent='자료구분을 선택해 주세요.';return;}if(!title.value.trim()){msg.textContent='제목을 입력해 주세요.';return}const recordDate=date.value.trim()||legacyRecordDate;if(!date.checkValidity()||!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(recordDate)){msg.textContent='달력에서 날짜를 선택해 주세요.';return}const payload={id:editId,module:mod.value,date:recordDate,title:title.value.trim(),body:body.value.trim(),public:pub.value==='true',...(!editId?{book_include:false}:{}),tags:tags.value.split(',').map(x=>x.trim()).filter(Boolean),extra:getExtra(),attachments:[...att.selectedOptions].map(x=>x.value).filter(Boolean)};if(!noticeMode)payload.history_excluded=$('record-history-excluded').checked;if(supportsRecorder())payload.recorder=recorder.value.trim()||defaultRecorderTitle;if(supportsAttendees()&&(attendeeTouched||selectedAttendees.size>0||manualAttendees.length>0)){
 if(!memberRows.length&&selectedAttendees.size){msg.textContent='회원명부를 불러오지 못했습니다.';return}
 updateManualNames();if(manualAttendees.some(n=>n.length>30)||manualAttendees.length>100){msg.textContent='직접 입력 참석자는 100명 이하, 이름은 30자 이내로 입력해 주세요.';return}payload.extra.attendee_ids=[...selectedAttendees];payload.extra.attendee_manual_names=[...manualAttendees];
}
 const wasEdit=!!editId;recordSaving=true;$('record-editor').inert=true;msg.textContent='저장 후 내용을 다시 확인하고 있습니다...';
 try{
  const statusResponse=await fetch('../api/admin/status',{credentials:'same-origin',cache:'no-store'});
  if(!statusResponse.ok)throw Error('서버 상태를 확인하지 못했습니다. 입력 내용은 유지됩니다.');
  const status=await statusResponse.json();
  if(!status.authenticated)throw Error('관리자 로그인이 만료되었습니다. 입력 내용을 보관한 뒤 다시 로그인해 주세요.');
  if(!status.features?.record_save)throw Error('기록 저장을 지원하는 최신 서버가 아닙니다. v1.4 서버 소스를 적용하고 기존 서버를 종료한 뒤 다시 시작해 주세요.');
  await uploadPendingFiles(payload.date);payload.attachments=[...att.selectedOptions].map(o=>o.value).filter(Boolean);
  msg.textContent='기록을 저장하고 있습니다...';
  const r=await fetch(wasEdit?'../api/admin/record':'../api/admin/records',{method:wasEdit?'PATCH':'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error((d.error||'저장 실패')+' (HTTP '+r.status+')');
  const id=d.item?.id;if(!id)throw Error('저장 결과에서 기록 ID를 확인하지 못했습니다. 입력 내용은 유지합니다.');if(!wasEdit){editId=id;editingRecord=d.item;}
  // 성공 응답만 믿지 않고 저장소에서 본문과 의결사항을 다시 읽어 대조합니다.
  const check=await fetch('../api/admin/records',{credentials:'same-origin',cache:'no-store'});if(!check.ok)throw Error('저장 요청 후 재조회에 실패했습니다. 목록에서 저장 여부를 확인해 주세요.');
  const db=await check.json(),saved=(db.records||[]).find(x=>String(x.id)===String(id));
  if(saved&&saved.module!==payload.module)throw Error('자료구분이 서버에 반영되지 않았습니다. server.py와 app/repository.py를 교체하고 서버를 재시작한 후 다시 저장해 주세요.');
  if(!saved||JSON.stringify([...(saved.attachments||[])].sort())!==JSON.stringify([...payload.attachments].sort())||saved.body!==payload.body||String(saved.extra?.decisions||'')!==String(payload.extra.decisions||''))throw Error('저장한 자료구분, 내용 또는 안건·의결사항이 입력값과 다릅니다. 입력을 유지했으니 내용을 확인해 주세요.');
  reset();showRecordView(false);history.replaceState(null,'',location.pathname);await load();msg.textContent=(wasEdit?'수정':'등록')+' 완료 · 본문 및 안건·의결사항 재조회 확인';$('record-list-message').textContent=msg.textContent;
 }catch(e){msg.textContent=e.message||'저장 중 오류가 발생했습니다. 입력 내용은 유지합니다.';msg.scrollIntoView({block:'center',behavior:'smooth'});}
 finally{recordSaving=false;$('record-editor').inert=false;}
};
function showRecordView(editing){const heading=document.querySelector('.admin-compact-heading h1');if(heading)heading.textContent=noticeMode?(editing?(editId?'공지 수정':'공지 등록'):'공지사항 관리'):(editing?(editId?'기록 수정':'기록 등록'):'통합 기록 관리');document.querySelector('.admin-heading-actions [href$=".html?new=1"]')?.toggleAttribute('hidden',editing);document.querySelector('.admin-heading-actions [href$=".html"]')?.toggleAttribute('hidden',!editing);$('record-editor').hidden=!editing;$('record-list-panel').hidden=editing;$('meeting-import-panel').hidden=editing||noticeMode;}
function editRecord(x){reset();if($('record-history-excluded'))$('record-history-excluded').checked=x.history_excluded===true;showRecordView(true);editingRecord=x;mod.value=noticeMode?'notice':recordType(x.module);editId=x.id;showRecorder();recorder.value=x.recorder||x.recorded_by||x.extra?.recorder||'';setRecordDate(x.date);title.value=x.title||'';body.value=x.body||'';pub.value=String(!!x.public);tags.value=(x.tags||[]).join(', ');drawExtra(x.extra||{});selectedAttendees=new Set((x.extra||{}).attendee_ids||[]);manualInput.value=((x.extra||{}).attendee_manual_names||[]).join(', ');originalParticipantText=(x.extra||{}).participants||'';attendeeTouched=false;attendeeSearch.value='';renderAttendees();[...att.options].forEach(o=>o.selected=!!o.value&&(x.attachments||[]).includes(o.value));updateAttachmentPreview();window.scrollTo({top:0,behavior:'smooth'})}
list.onclick=async e=>{if(recordSaving){msg.textContent='저장 또는 파일 등록 완료 후 기록을 전환해 주세요.';return;}const target=e.target.closest('button[data-edit],button[data-del]');if(!target)return;const id=target.dataset.edit||target.dataset.del;const x=rows.find(v=>String(v.id)===id);if(!x)return;if(target.dataset.edit){location.assign(recordPage+'?edit='+encodeURIComponent(x.id))}else if(confirm('삭제 상태로 전환하시겠습니까? 기록은 복구 가능하도록 보존됩니다.')){const r=await fetch('../api/admin/record',{method:'DELETE',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({id})});msg.textContent=r.ok?'삭제 상태로 전환했습니다.':'삭제 실패';await load()}};

// Reset after browser form restoration and before/after asynchronous initialization.
document.querySelectorAll('#record-editor input,#record-editor textarea,#record-editor select').forEach(e=>e.autocomplete='off');
reset();showRecordView(false);filter.value='__all__';
window.addEventListener('pageshow',e=>{if(e.persisted){reset();}});
await Promise.all([loadFiles(),loadMembers(),getAdminTitle()]);reset();$('record-editor').inert=false;await load();
const viewParams=new URLSearchParams(location.search);if(viewParams.get('new')==='1'){reset();showRecordView(true);}
const requested=viewParams.get('edit');
if(requested){const r=await fetch('../api/admin/records',{credentials:'same-origin',cache:'no-store'});if(r.ok){const d=await r.json();const item=(d.records||[]).find(x=>String(x.id)===requested);if(item&&inScope(item))editRecord(item);else if(item){location.replace((item.module==='notice'?'announcements.html':'records.html')+'?edit='+encodeURIComponent(item.id));}else msg.textContent='수정할 기록을 찾을 수 없습니다.';}}

})().catch(error=>{
 console.error('관리자 기록 화면 초기화 실패',error);
 const target=document.getElementById('record-list-message')||document.getElementById('record-msg');
 if(target){target.textContent='기록 화면을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요. ('+(error.message||'초기화 오류')+')';target.setAttribute('role','alert');}
});
