window.CenterHubFeed=(function(){
const key=v=>{const p=(String(v||'').match(/\d+/g)||[]);return Number(p[0]||0)*10000+Number(p[1]||0)*100+Number(p[2]||0)};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=x=>({notice:'공지',meeting:'회의',event:'행사',activity:'행사',event_schedule:'행사',facility:'시설·비품',asset:'시설·비품'})[x.module]||'기타 운영';
function all(data){let items=(data.feed||[...(data.notices||[]),...(data.activities||[]),...(data.events||[])]).filter(x=>x.public!==false&&x.status!=='deleted');items=[...new Map(items.map(x=>[String(x.id),x])).values()];const canon=v=>String(v||'').replace(/일정|개최|기록|회의록|및|\s/g,'');items=items.filter(x=>x.module!=='event_schedule'||!items.some(y=>y.module!=='event_schedule'&&y.date===x.date&&(canon(y.title).includes(canon(x.title))||canon(x.title).includes(canon(y.title))||((x.title||'').includes('총회')&&(y.title||'').includes('총회')))));return items.sort((a,b)=>key(b.date)-key(a.date)||String(b.updated_at||'').localeCompare(String(a.updated_at||''))||String(a.title||'').localeCompare(String(b.title||''),'ko'))}
const recorder=x=>{
  // 이미 저장되어 있는 기록자 이름만 사용합니다. 저장되지 않은 기록은 추정하지 않습니다.
  const e=x.extra&&typeof x.extra==='object'?x.extra:{};
  const v=x.recorder||x.recorded_by||x.writer||x.author||e.recorder||e.recorded_by||e.writer||e.author||'';
  return typeof v==='string'?v.trim():'';
};
const row=(x,page)=>{
  const who=recorder(x);
  const href=`news-detail.html?id=${encodeURIComponent(x.id)}${page?'&page='+page:''}`;
  return `<article class="record-row news-record-link"><time datetime="${esc(x.date||'')}">${esc(x.date||'')}</time><div class="news-record-main"><div class="news-record-heading"><h3><span class="news-kind">${label(x)}</span> <a href="${href}" class="news-record-title">${esc(x.title||'')}</a></h3><span class="news-recorder" title="기록자">${esc(who?'기록자 ' + who:'기록자 미등록')}</span></div><p>${esc(x.body||'')}</p></div></article>`;
};
const homeRow=(x,page,type='all')=>{
 const query=new URLSearchParams({id:String(x.id),list:type});if(page)query.set('page',String(page));
 return `<a class="home-news-item" href="news-detail.html?${esc(query.toString())}"><time datetime="${esc(x.date||'')}">${esc(x.date||'')}</time><span class="home-news-kind">${label(x)}</span><b class="home-news-title">${esc(x.title||'')}</b><span class="home-news-chevron" aria-hidden="true">›</span></a>`;
};
return {all,esc,label,row,homeRow};})();
