(async()=>{
  if (sessionStorage.getItem('centerhub_admin') === '1') {
    // Keep admin session active on static/Pages frontend
  } else {
    try{
      let r = await fetch('../api/admin/status',{cache:'no-store',credentials:'same-origin'});
      if (!r.ok || !(r.headers.get('content-type')||'').toLowerCase().includes('application/json')) {
        r = await fetch('https://wookyunghub.pythonanywhere.com/api/admin/status',{cache:'no-store',credentials:'include'});
      }
      const d=await r.json();
      if(!d.authenticated){
        sessionStorage.removeItem('centerhub_admin');
        location.replace('../admin-login.html?next='+encodeURIComponent(location.pathname));
        return;
      }
      sessionStorage.setItem('centerhub_admin','1');
    }catch(e){
      if(sessionStorage.getItem('centerhub_admin')!=='1') location.replace('../admin-login.html');
    }
  }
  document.addEventListener('click',async e=>{
    if(e.target.closest('[data-admin-logout]')){
      try{await fetch('../api/admin/logout',{method:'POST',credentials:'same-origin'})}catch(_){}
      try{await fetch('https://wookyunghub.pythonanywhere.com/api/admin/logout',{method:'POST',credentials:'include'})}catch(_){}
      sessionStorage.clear();
      location.href='../index.html';
    }
  });
})();