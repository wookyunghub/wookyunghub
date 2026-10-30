(async()=>{
  const btn=document.getElementById('admin-login-btn'),pin=document.getElementById('admin-pin'),msg=document.getElementById('admin-login-message');
  async function login(){
    if(!pin.value){msg.textContent='관리 PIN을 입력해 주세요.';return}
    try{
      let r = await fetch('api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({pin:pin.value})});
      if (!r.ok && r.status === 405) {
        // Fallback to direct backend if proxy is not routing POST
        r = await fetch('https://wookyunghub.pythonanywhere.com/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({pin:pin.value})});
      }
      const d=await r.json();
      if(!r.ok){msg.textContent=d.error||'로그인하지 못했습니다.';return}
      sessionStorage.setItem('centerhub_admin','1');
      location.href='admin/index.html';
    }catch(e){
      try {
        const r2 = await fetch('https://wookyunghub.pythonanywhere.com/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({pin:pin.value})});
        const d2 = await r2.json();
        if(!r2.ok){msg.textContent=d2.error||'로그인하지 못했습니다.';return}
        sessionStorage.setItem('centerhub_admin','1');
        location.href='admin/index.html';
      } catch(err) {
        msg.textContent='관리자 API에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
      }
    }
  }
  btn.onclick=login;
  pin.onkeydown=e=>{if(e.key==='Enter')login()}
})();