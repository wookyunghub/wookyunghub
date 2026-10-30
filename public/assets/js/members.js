(async()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[];
try{const r=await fetch('api/public/members',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);rows=(await r.json()).members||[]}
catch(e){$('member-count').textContent='회원명부를 불러오지 못했습니다.';return}
function compare(a,b){const names=String(a.name||'').localeCompare(String(b.name||''),'ko');if($('member-sort').value==='name')return names;const aa=Number.isFinite(Number(a.age))&&a.age!==null&&a.age!==''?Number(a.age):null,bb=Number.isFinite(Number(b.age))&&b.age!==null&&b.age!==''?Number(b.age):null;if(aa===null)return bb===null?names:1;if(bb===null)return -1;return bb-aa||names}
function table(id,values){$(id).innerHTML=values.length?values.map(x=>`<tr><td>${esc(x.member_type)}</td><td>${esc(x.name)}</td><td>${esc(x.gender)}</td><td>${x.age==null?'–':esc(x.age)+'세'}</td></tr>`).join(''):'<tr><td colspan="4">해당 회원이 없습니다.</td></tr>'}
function draw(){const q=$('member-search').value.trim().toLowerCase(),a=rows.filter(x=>(String(x.name||'')+' '+String(x.member_type||'')).toLowerCase().includes(q)).sort(compare);const male=a.filter(x=>x.gender==='남'),female=a.filter(x=>x.gender==='여'),other=a.filter(x=>x.gender!=='남'&&x.gender!=='여');$('member-count').textContent=`조회 회원 ${a.length}명`;$('male-count').textContent=`${male.length}명`;$('female-count').textContent=`${female.length}명`;table('male-rows',male);table('female-rows',female);$('other-members').hidden=!other.length;$('other-members').textContent=other.length?`성별 미기재·기타 ${other.length}명은 관리자에서 성별을 확인해 주세요.`:''}
$('member-search').oninput=draw;$('member-sort').onchange=draw;draw();
})();
