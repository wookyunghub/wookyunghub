(()=>{
  const $=id=>document.getElementById(id);
  const button=$('change-pin');
  button.addEventListener('click',async()=>{
    const old=$('old-pin').value;
    const next=$('new-pin').value;
    const confirm=$('new-pin2').value;
    const msg=$('pin-msg');
    if(!old||!next||!confirm){msg.textContent='PIN을 모두 입력해 주세요.';return;}
    if(next!==confirm){msg.textContent='새 PIN 확인이 일치하지 않습니다.';return;}
    button.disabled=true;
    try{
      const response=await fetch('../api/admin/change-pin',{
        method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
        body:JSON.stringify({old_pin:old,new_pin:next})
      });
      const result=await response.json();
      if(!response.ok){msg.textContent=result.error||'PIN 변경에 실패했습니다.';return;}
      msg.textContent='PIN 변경 완료';
      window.alert('관리 PIN이 정상적으로 변경되었습니다.\n확인을 누르면 로그아웃되고 로그인 화면으로 이동합니다.');
      try{
        const logout=await fetch('../api/admin/logout',{method:'POST',credentials:'same-origin'});
        if(!logout.ok)throw new Error('로그아웃 요청 실패');
      }catch(error){
        msg.textContent='PIN은 변경되었으나 자동 로그아웃에 실패했습니다. 로그아웃 후 새 PIN으로 로그인해 주세요.';
        return;
      }
      sessionStorage.removeItem('centerhub_admin');
      location.replace('../admin-login.html');
    }catch(error){
      msg.textContent='서버 연결 오류가 발생했습니다. 변경 여부를 확인해 주세요.';
    }finally{button.disabled=false;}
  });
})();
