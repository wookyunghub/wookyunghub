(()=>{
  function target(id){const section=document.getElementById(id);return section?.querySelector('h1,h2')||section;}
  function go(id){const el=target(id);if(!el)return;const header=document.querySelector('.topbar');const offset=(header?.getBoundingClientRect().height||0)+14;
    const y=el.getBoundingClientRect().top+window.scrollY-offset;
    window.scrollTo({top:Math.max(0,y),behavior:'instant'});
  }
  window.CenterHubScrollToSection=go;
  function fromHash(){if(location.hash)go(decodeURIComponent(location.hash.slice(1)));}
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');if(!a)return;
    let url;try{url=new URL(a.href)}catch{return}
    if(url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search||!url.hash)return;
    const id=decodeURIComponent(url.hash.slice(1));if(!target(id))return;
    e.preventDefault();if(location.hash!==url.hash)history.pushState(null,'',url);go(id);
  });
  addEventListener('hashchange',fromHash);addEventListener('popstate',fromHash);
  addEventListener('load',()=>{fromHash();setTimeout(fromHash,180);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(fromHash,200));else setTimeout(fromHash,200);
})();
