(async()=>{
  const C=window.CenterHubCommon;
  await C.siteReady;
  const F=window.CenterHubFeed;
  const [news,org]=await Promise.all([
    C.requestJson('api/public/news').catch(error=>({loadError:error.message})),
    C.api('api/public/organization',{basic:{}})
  ]);
  const items=F.all(news);
  const noticeRow=x=>{
    const query=new URLSearchParams({id:String(x.id),list:'notice'});
    return `<a class="home-news-item" href="news-detail.html?${F.esc(query.toString())}"><time datetime="${F.esc(x.date||'')}">${F.esc(x.date||'')}</time><b class="home-news-title">${F.esc(x.title||'')}</b><span class="home-news-chevron" aria-hidden="true">›</span></a>`;
  };
  for(const [id,rows,render,empty] of [
    ['home-news',items.filter(x=>x.module==='notice').slice(0,5),noticeRow,'등록된 공지사항이 없습니다.'],
    ['home-records',items.filter(x=>['meeting','event','activity','event_schedule'].includes(x.module)).slice(0,3),x=>F.homeRow(x,null,'records'),'등록된 회의·행사 기록이 없습니다.']
  ]){
    const el=document.getElementById(id);if(!el)continue;
    if(news.loadError)el.textContent='소식 조회 오류: '+news.loadError;
    else el.innerHTML=rows.length?rows.map(render).join(''):`<p class="empty-inline">${empty}</p>`;
  }
  const b=org.basic||{};
  document.getElementById('home-address').textContent=b.address||'-';
  document.getElementById('home-phone').textContent=b.phone||'-';
  document.getElementById('home-members').textContent=b.members_total?b.members_total+'명':'-';
})();
