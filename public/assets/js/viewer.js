async function loadJSON(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path);return r.json()}
function pad(n){return String(n).padStart(3,'0')}
function requestedPage(max){
  const hash=(location.hash||'').match(/^#p(\d+)$/i);
  const query=new URLSearchParams(location.search).get('page');
  const raw=hash?hash[1]:query;
  const n=Math.max(1,Math.min(max,Number(raw)||1));
  return n;
}
function goToPage(n,behavior='auto'){
  const el=document.getElementById(`p${n}`);
  if(!el)return;
  el.scrollIntoView({behavior,block:'start'});
  const jump=document.querySelector('#jump');
  if(jump)jump.value=n;
}
(async()=>{
 const all=await loadJSON('../data/documents.json'); const site=await loadJSON('../data/site.json');
 const d=all.documents[window.DOC_ID]; if(!d)throw new Error('Unknown document');
 document.title=`${d.title} - ${site.organization_name}`;
 document.querySelector('[data-doc-title]').textContent=d.title;
 document.querySelector('[data-doc-desc]').textContent=d.description;
 document.querySelector('[data-source]').textContent=d.source_name;
 const side=document.querySelector('#sections');
 d.sections.forEach(s=>{const a=document.createElement('a');a.href=`?page=${s.page}#p${s.page}`;a.textContent=`${s.title} · ${s.page}쪽`;side.appendChild(a)});
 const pages=document.querySelector('#pages');
 for(let i=1;i<=d.page_count;i++){
   const box=document.createElement('section');box.className='page';box.id=`p${i}`;
   if(window.DOC_ID==='book1' && i>=47 && i<=60){
     const notice=document.createElement('p');notice.className='finance-note';
     notice.textContent='이 페이지는 결산·수납·증빙 관련 개인정보 보호를 위해 일반 열람이 제한됩니다.';
     box.appendChild(notice);
   }else{const img=document.createElement('img');img.loading='lazy';img.alt=`${d.title} ${i}쪽`;img.src=`${d.image_base}/p${pad(i)}.webp`;box.appendChild(img);}
   const label=document.createElement('div');label.className='page-label';label.textContent=`${i} / ${d.page_count}`;
   box.appendChild(label);pages.appendChild(box);
 }
 const jump=document.querySelector('#jump'); jump.max=d.page_count;
 const first=requestedPage(d.page_count);jump.value=first;
 document.querySelector('#jump-btn').onclick=()=>{let n=Math.max(1,Math.min(d.page_count,Number(jump.value)||1));history.replaceState(null,'',`?page=${n}#p${n}`);goToPage(n,'smooth')};
 const printBtn=document.querySelector('#print-btn'); if(printBtn) printBtn.onclick=()=>window.print();
 // 페이지 DOM이 생성된 뒤 URL의 쪽 번호로 이동합니다. 비동기 생성 전에 처리되는 기본 hash 동작을 보완합니다.
 requestAnimationFrame(()=>requestAnimationFrame(()=>goToPage(first,'auto')));
 setTimeout(()=>goToPage(first,'auto'),120);
 window.addEventListener('hashchange',()=>goToPage(requestedPage(d.page_count),'smooth'));
})();
