(async()=>{
  const C=window.CenterHubCommon;
  await C.siteReady;

  const q=new URLSearchParams(location.search);
  const ledgerId=q.get('ledger');
  const requestedDoc=q.get('doc');
  const requestedPage=parseInt(q.get('page')||'1',10)||1;

  const [L,D]=await Promise.all([
    C.api('api/public/publications',{current:null,archives:[]}),
    C.loadJson('data/documents.json',{documents:{}})
  ]);

  const led=(L.current?.id===ledgerId||!ledgerId)
    ?L.current
    :(L.archives||[]).find(x=>x.id===ledgerId);

  const spread=document.getElementById('ebook-spread');
  const ind=document.getElementById('page-indicator');
  const prevBtn=document.getElementById('prev-btn');
  const nextBtn=document.getElementById('next-btn');
  const tabs=document.getElementById('ebook-volumes');

  if(!led){
    spread.innerHTML='<div class="empty-state">운영대장을 찾을 수 없습니다.</div>';
    return;
  }

  const vols=(led.volumes||[]).filter(v=>D.documents?.[v.id]);
  if(!vols.length){
    spread.innerHTML='<div class="empty-state">이북으로 연결된 책자가 없습니다.</div>';
    return;
  }

  let volIndex=Math.max(0,vols.findIndex(v=>v.id===(requestedDoc||vols[0].id)));
  let docId='';
  let meta=null;
  let p=1;
  let max=1;

  function spreadStart(page,count){
    const n=Math.max(1,Math.min(count,Number(page)||1));
    return n>1&&n%2===0?n-1:n;
  }

  function lastSpreadStart(count){
    return count>1&&count%2===0?count-1:count;
  }

  function src(n){
    return `${meta.image_base}/p${String(n).padStart(3,'0')}.webp`;
  }

  function updateUrl(replace=true){
    const x=new URL(location.href);
    x.searchParams.set('ledger',led.id);
    x.searchParams.set('doc',docId);
    x.searchParams.set('page',String(p));
    (replace?history.replaceState:history.pushState).call(history,null,'',x);
  }

  function renderTabs(){
    tabs.innerHTML=vols.map((v,i)=>
      `<button type="button" class="btn ${i===volIndex?'primary':''}" data-volume-index="${i}">${v.label}</button>`
    ).join('');
    tabs.querySelectorAll('[data-volume-index]').forEach(b=>{
      b.addEventListener('click',()=>loadVolume(Number(b.dataset.volumeIndex),1,false));
    });
  }

  function renderHeader(){
    document.getElementById('ebook-title').textContent=`${led.period} ${led.title} · ${meta.title}`;
    document.getElementById('ebook-desc').textContent=meta.description||'';
  }

  function render(){
    const p2=Math.min(p+1,max);
    const pageHTML=n=>(docId==='book1' && n>=47 && n<=60)
      ? `<div class="ebook-page"><p class="finance-note">${n}쪽은 결산·수납·증빙 자료 보호를 위해 일반 열람이 제한됩니다.</p></div>`
      : `<div class="ebook-page"><img src="${src(n)}" alt="${vols[volIndex].label} ${n}쪽"></div>`;
    spread.innerHTML=pageHTML(p)+(p2!==p?pageHTML(p2):'');

    ind.textContent=p2===p
      ?`${vols[volIndex].label} · ${p} / ${max}`
      :`${vols[volIndex].label} · ${p}-${p2} / ${max}`;

    const atFirst=p<=1;
    const atLast=p2>=max;
    const hasPrevVolume=volIndex>0;
    const hasNextVolume=volIndex<vols.length-1;

    prevBtn.disabled=atFirst&&!hasPrevVolume;
    nextBtn.disabled=atLast&&!hasNextVolume;
    prevBtn.textContent=atFirst&&hasPrevVolume?`◀ ${vols[volIndex-1].label}`:'◀ 이전';
    nextBtn.textContent=atLast&&hasNextVolume?`${vols[volIndex+1].label} ▶`:'다음 ▶';

    updateUrl(true);
  }

  function loadVolume(index,page=1,replaceUrl=true){
    if(index<0||index>=vols.length)return;
    volIndex=index;
    docId=vols[volIndex].id;
    meta=D.documents?.[docId];
    if(!meta)return;
    max=meta.page_count||1;
    p=spreadStart(page,max);
    renderTabs();
    renderHeader();
    render();
    if(!replaceUrl)updateUrl(false);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  prevBtn.addEventListener('click',()=>{
    if(p>1){
      p=Math.max(1,p-2);
      render();
      return;
    }
    if(volIndex>0){
      const prevMeta=D.documents?.[vols[volIndex-1].id];
      const prevMax=prevMeta?.page_count||1;
      loadVolume(volIndex-1,lastSpreadStart(prevMax),false);
    }
  });

  nextBtn.addEventListener('click',()=>{
    const p2=Math.min(p+1,max);
    if(p2<max){
      p=Math.min(max,p+2);
      render();
      return;
    }
    if(volIndex<vols.length-1){
      loadVolume(volIndex+1,1,false);
    }
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'&&!prevBtn.disabled){prevBtn.click();}
    if(e.key==='ArrowRight'&&!nextBtn.disabled){nextBtn.click();}
  });

  loadVolume(volIndex,requestedPage,true);
})();
