(async()=>{
  const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const r=await fetch('../api/admin/data?name=organization',{cache:'no-store',credentials:'same-origin'});
  if(!r.ok){$('officers-msg').textContent='임원 정보를 불러오지 못했습니다.';return}
  const data=await r.json();
  data.organization_chart=data.organization_chart||{officers:[],board:[]};
  const fields=['position','name','birth_date','phone','address','note'];
  const makeId=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
  function rows(kind){return data.organization_chart[kind]||(data.organization_chart[kind]=[])}
  function inputCell(x,field,placeholder=''){
    return `<td><input type="text" data-field="${field}" value="${esc(x[field]||'')}" placeholder="${esc(placeholder)}" autocomplete="off"></td>`;
  }
  function render(kind){
    const body=$(kind==='officers'?'officer-table':'board-table'),arr=rows(kind);body.innerHTML='';
    arr.forEach((x,i)=>{
      if(x.book_include===undefined)x.book_include=true;
      if(x.public===undefined)x.public=true;
      const tr=document.createElement('tr');
      tr.innerHTML=`${inputCell(x,'position','직위')}${inputCell(x,'name','성명 또는 공석')}${inputCell(x,'birth_date','YY.MM.DD')}${inputCell(x,'phone','연락처')}${inputCell(x,'address','주소')}${inputCell(x,'note','비고')}<td class="center"><input type="checkbox" data-field="public" ${x.public===false?'':'checked'} aria-label="홈페이지 공개"></td><td class="center"><input type="checkbox" data-field="book_include" ${x.book_include===false?'':'checked'} aria-label="책자 포함"></td><td><div class="admin-row-actions"><button type="button" class="btn" data-act="up" title="위로">↑</button><button type="button" class="btn" data-act="down" title="아래로">↓</button><button type="button" class="btn danger" data-act="delete">삭제</button></div></td>`;
      tr.querySelectorAll('input').forEach(el=>el.addEventListener(el.type==='checkbox'?'change':'input',()=>{const f=el.dataset.field;x[f]=el.type==='checkbox'?el.checked:el.value}));
      tr.querySelector('[data-act="up"]').onclick=()=>{if(i>0){[arr[i-1],arr[i]]=[arr[i],arr[i-1]];render(kind)}};
      tr.querySelector('[data-act="down"]').onclick=()=>{if(i<arr.length-1){[arr[i+1],arr[i]]=[arr[i],arr[i+1]];render(kind)}};
      tr.querySelector('[data-act="delete"]').onclick=()=>{if(confirm('이 행을 현재 임원명부에서 삭제하시겠습니까? 이미 생성된 운영대장 스냅샷은 변경되지 않습니다.')){arr.splice(i,1);render(kind)}};
      body.appendChild(tr);
    });
    if(!arr.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="9" class="small">등록된 항목이 없습니다. 행 추가를 눌러 입력하세요.</td>';body.appendChild(tr)}
  }
  const blank=prefix=>({id:makeId(prefix),position:'',name:'',birth_date:'',phone:'',address:'',note:'',public:true,book_include:true});
  $('add-officer').onclick=()=>{rows('officers').push(blank('officer'));render('officers')};
  $('add-board').onclick=()=>{rows('board').push(blank('board'));render('board')};
  $('save-officers').onclick=async()=>{
    const msg=$('officers-msg');msg.textContent='저장 중...';data.updated=new Date().toISOString().slice(0,10);
    const res=await fetch('../api/admin/data',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name:'organization',data})});
    if(res.ok){msg.textContent='저장했습니다. 홈페이지에는 직위·성명만 반영되고, 상세정보는 관리자·책자용으로 보관됩니다.'}
    else{let e={};try{e=await res.json()}catch(_){}msg.textContent=e.error||'저장하지 못했습니다.'}
  };
  render('officers');render('board');
})();
