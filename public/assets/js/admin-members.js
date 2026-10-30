(async()=>{
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=['name','member_type','birth_date','home_phone','mobile_phone','joined_date','address','notes','status_date','status_reason'];
let data=[],editing='';
async function api(path,method='GET',body){const d=await window.CenterHubCommon.requestJson('api/admin/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});if(path==='members'&&method==='GET'&&!Array.isArray(d?.members))throw Error('회원 API 응답 형식이 맞지 않습니다. 서버 소스 버전을 확인해 주세요.');return d}
function todayLocal(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function open(item){editing=item?.id||'';keys.forEach(k=>{$('m-'+k).value=item?.[k]||(k==='joined_date'&&!item?todayLocal():'')});if(!item)$('m-member_type').value='정회원';if(item?.member_type&&!Array.from($('m-member_type').options).some(o=>o.value===item.member_type))$('m-member_type').add(new Option(item.member_type,item.member_type));document.querySelectorAll('input[name="m-gender-choice"]').forEach(r=>r.checked=item?r.value===item.gender:r.value==='남');$('m-status').value=item?.status||'active';$('m-public').value=String(item?.public!==false);$('m-editor-title').textContent=editing?'회원 정보 수정':'신규 회원 등록';$('m-msg').textContent='';$('m-editor-panel').hidden=false;$('m-editor-panel').scrollIntoView({block:'nearest',behavior:'smooth'})}
function nameOrder(a,b){return String(a.name||'').localeCompare(String(b.name||''),'ko')}
function birthOrder(a,b){
 const x=/^\d{4}-\d{2}-\d{2}$/.test(String(a.birth_date||''))?a.birth_date:null;
 const y=/^\d{4}-\d{2}-\d{2}$/.test(String(b.birth_date||''))?b.birth_date:null;
 if(!x)return y?1:0;
 if(!y)return -1;
 return x.localeCompare(y); // 출생일이 빠를수록 나이가 많음
}
function genderOrder(g){const value=String(g||'').trim();return value==='남'?0:value==='여'?1:2}
function render(){const q=$('m-search').value.trim().toLowerCase(),st=$('m-filter').value;const visible=data.filter(x=>(!st||(x.status||'active')===st)&&[x.name,x.member_type,x.source_number,x.address].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>{const k=$('m-sort').value;if(k==='gender')return genderOrder(a.gender)-genderOrder(b.gender)||birthOrder(a,b)||nameOrder(a,b);if(k==='age-desc')return birthOrder(a,b)||nameOrder(a,b);return nameOrder(a,b)});$('m-summary').textContent=`전체 ${data.length} · 재적 ${data.filter(x=>(x.status||'active')==='active').length} · 사망 ${data.filter(x=>x.status==='deceased').length} · 제적 ${data.filter(x=>x.status==='withdrawn').length} · 조회 ${visible.length}`;
$('m-list').innerHTML=visible.map((x,index)=>`<tr><td>${index+1}</td><td>${esc(x.organization_name||'우경')}</td><td><b style="${['deceased','withdrawn'].includes(x.status)?'text-decoration:line-through':''}">${esc(x.name)}</b></td><td>${esc(x.birth_date)}</td><td>${esc(x.home_phone||'–')}</td><td>${esc(x.mobile_phone||x.phone||'–')}</td><td>${esc(x.gender)}</td><td>${esc(x.original_age||'–')}</td><td>${esc(x.member_type)}</td><td class="address">${esc(x.address)}</td><td class="${x.status==='deceased'?'deceased':''}">${x.status==='deceased'?'사망':x.status==='withdrawn'?'제적':x.status==='active'||!x.status?'재적':esc(x.status)}${x.status_date?' · '+esc(x.status_date):''}${x.status_reason?' · '+esc(x.status_reason):''}${x.notes?.includes('신입')?' · 신입':''}</td><td class="${x.public?'':'private'}">${x.public?'공개':'비공개'}</td><td><button class="btn" data-edit="${esc(x.id)}">수정</button> <button class="btn danger" data-del="${esc(x.id)}">삭제</button></td></tr>`).join('')||'<tr><td colspan="13">조회할 회원이 없습니다. 상단의 명부 가져오기를 이용해 주세요.</td></tr>'}
async function load(){try{data=(await api('members')).members||[];render()}catch(e){$('m-summary').textContent='조회 오류: '+e.message}}
$('m-import').onclick=async()=>{
  $('m-import-panel').hidden=false;
  $('m-import-status').textContent='원본 회원명부를 확인하고 있습니다.';
  $('m-import-confirm').disabled=true;
  try{
    const d=await api('members/import','POST',{action:'preview'});
    $('m-import-status').textContent=`원본 ${d.source_total}명 · 신규 등록 ${d.added}명 · 기존 회원 일치 ${d.matched}명 · 누락 항목 보충 ${d.filled}개`;
    $('m-import-confirm').disabled=false;
  }catch(e){$('m-import-status').textContent='미리보기 실패: '+e.message}
};
$('m-import-close').onclick=()=>{$('m-import-panel').hidden=true};
$('m-import-confirm').onclick=async()=>{
  if(!confirm('원본 회원명부를 가져오시겠습니까? 기존 회원 수정값은 보존하고 회원 데이터는 자동 백업합니다.'))return;
  $('m-import-confirm').disabled=true;
  try{
    const d=await api('members/import','POST',{action:'import'});
    $('m-import-status').textContent=`가져오기 완료: 신규 ${d.added}명, 누락 필드 보충 ${d.filled}개, 전체 ${d.total}명${d.backup?' · 백업: '+d.backup:''}`;
    await load();
  }catch(e){$('m-import-status').textContent='가져오기 실패: '+e.message}
  finally{$('m-import-confirm').disabled=false}
};
$('m-publish-active').onclick=async()=>{
  const targets=data.filter(x=>(x.status||'active')==='active' && x.public===false);
  if(!targets.length){alert('공개로 변경할 재적 회원이 없습니다.');return}
  if(!confirm(`재적 회원 ${targets.length}명을 공개로 변경하시겠습니까? 일반페이지에는 마스킹된 이름·회원구분·성별·나이만 표시됩니다.`))return;
  try {const d=await api('members/publish-active','POST',{confirm:true});await load();alert(`공개 설정 변경 완료: ${d.updated}명`)} catch(e){alert(e.message)}
};
$('m-search').oninput=render;$('m-filter').onchange=render;$('m-sort').onchange=render;$('m-add').onclick=()=>open(null);$('m-new').onclick=()=>open(null);$('m-close').onclick=()=>{$('m-editor-panel').hidden=true};
$('m-save').onclick=async()=>{const d=Object.fromEntries(keys.map(k=>[k,$('m-'+k).value.trim()]));d.status=$('m-status').value;d.gender=document.querySelector('input[name="m-gender-choice"]:checked')?.value;if(!d.gender){$('m-msg').textContent='성별을 선택해 주세요.';return}d.phone=d.mobile_phone||d.home_phone;d.public=$('m-public').value==='true';if(!d.name){$('m-msg').textContent='이름을 입력해 주세요.';return}try{await api(editing?'member':'members',editing?'PATCH':'POST',{...d,id:editing});await load();$('m-editor-panel').hidden=true}catch(e){$('m-msg').textContent=e.message}};
$('m-list').onclick=async e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-del]');if(edit){const x=data.find(v=>v.id===edit.dataset.edit);if(x)open(x)}else if(del){const x=data.find(v=>v.id===del.dataset.del);if(x&&confirm(`${x.name} 회원을 삭제 상태로 변경하시겠습니까?`)){try{await api('member','DELETE',{id:x.id});await load()}catch(err){alert(err.message)}}}};
await load();
})();
