(async()=>{
 const info=document.getElementById('meeting-import-result');
 async function request(dry_run){
  info.textContent='확인 중...';
  try{const r=await fetch('../api/admin/import/meeting-2026',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({dry_run})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'요청 실패');
   info.textContent=`${dry_run?'미리보기':'완료'}: 원본 ${d.total}건 · 신규 ${d.new}건 · 기존 ${d.existing}건${d.backup?' · 백업 '+d.backup:''}. 정확한 회의 일자는 확인 후 수정해 주세요.`;
   if(!dry_run){info.textContent+=' · 목록을 새로고침하면 반영됩니다.';}
  }catch(e){info.textContent='오류: '+e.message}
 }
 document.getElementById('meeting-import-preview').onclick=()=>request(true);
 document.getElementById('meeting-import-confirm').onclick=()=>{if(confirm('기존 기록을 보존하고 본책1·본책2의 회의·행사 자료를 추가하시겠습니까?'))request(false)};
})();
