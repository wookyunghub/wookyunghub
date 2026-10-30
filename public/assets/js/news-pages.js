(async()=>{
const q=new URLSearchParams(location.search),type=['notice','records'].includes(q.get('type'))?q.get('type'):'all',title=type==='notice'?'공지사항':type==='records'?'회의·행사 기록':'공지 및 소식';
const heading=document.getElementById('list-title');heading.textContent=title;heading.hidden=false;document.title=title;
const C=window.CenterHubCommon;await C.siteReady;try{const F=window.CenterHubFeed,requested=Math.max(1,parseInt(q.get('page')||'1',10)||1),d=await C.requestJson('api/public/news'),items=F.all(d).filter(x=>type==='all'||(type==='notice'?x.module==='notice':x.module!=='notice')),total=Math.max(1,Math.ceil(items.length/10)),page=Math.min(requested,total);
document.getElementById('news-full-list').innerHTML=items.length?items.slice((page-1)*10,page*10).map(x=>F.homeRow(x,page,type)).join(''):'<div class="empty-state compact-empty">등록된 내용이 없습니다.</div>';
const link=(n,label)=>`<a ${n===page?'aria-current="page" class="active"':''} href="?${type==='all'?'':'type='+type+'&'}page=${n}">${label}</a>`;
document.getElementById('news-pagination').innerHTML=(page>1?link(page-1,'‹ 이전'):'')+Array.from({length:total},(_,i)=>link(i+1,i+1)).join('')+(page<total?link(page+1,'다음 ›'):'');
}catch(e){document.getElementById('news-full-list').textContent='기록 조회 오류: '+e.message;document.getElementById('news-pagination').replaceChildren();}
})();