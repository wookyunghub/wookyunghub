(async()=>{
  const $=id=>document.getElementById(id);let data={};
  function resolveAdminImg(u){
    if(!u) return '';
    if(u.startsWith('http://')||u.startsWith('https://')||u.startsWith('data:')||u.startsWith('/')) return u;
    if(u.startsWith('../')) return u;
    return '../'+u;
  }
  function updatePreviews(){
    const logoVal=($('s-logo')&&$('s-logo').value.trim())||'assets/img/logo.png';
    const bldVal=($('s-building')&&$('s-building').value.trim())||'assets/img/building.jpg';
    if($('s-logo-preview')) $('s-logo-preview').src=resolveAdminImg(logoVal);
    if($('s-building-preview')) $('s-building-preview').src=resolveAdminImg(bldVal);
  }
  try{
    const response=await fetch('../api/admin/data?name=site',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw Error('기본설정을 불러오지 못했습니다.');
    data=await response.json();
  }catch(error){
    $('s-msg').textContent=error.message;$('s-save').disabled=true;return;
  }
  const fields={
    's-org':'organization_name',
    's-parent':'parent_organization',
    's-branch':'branch_name',
    's-period':'latest_period',
    's-title':'site_title',
    's-mode':'link_mode',
    's-public':'public_url',
    's-logo':'logo_image',
    's-building':'building_image'
  };
  for(const [id,key] of Object.entries(fields)){
    const def = key==='link_mode'?'preview':(key==='logo_image'?'assets/img/logo.png':(key==='building_image'?'assets/img/building.jpg':''));
    if($(id)) $(id).value=data[key]||def;
  }
  updatePreviews();
  if($('s-logo')) $('s-logo').oninput=updatePreviews;
  if($('s-building')) $('s-building').oninput=updatePreviews;

  async function handleFileSelect(fileInput, textInput, previewImg){
    const file = fileInput.files && fileInput.files[0];
    if(!file) return;
    const fd = new FormData();
    fd.append('kind','photos');
    fd.append('attachment_role','photo');
    fd.append('public','true');
    fd.append('date',new Date().toISOString().slice(0,10));
    fd.append('title',file.name);
    fd.append('file',file,file.name);
    try{
      $('s-msg').textContent='파일 업로드 중...';
      const res = await fetch('../api/admin/upload',{method:'POST',credentials:'same-origin',body:fd});
      const result = await res.json();
      if(res.ok && result.item && result.item.path){
        const mediaPath = 'media/' + result.item.path;
        textInput.value = mediaPath;
        previewImg.src = resolveAdminImg(mediaPath);
        $('s-msg').textContent='파일이 업로드되었습니다. [저장] 버튼을 눌러 설정을 반영해 주세요.';
      } else {
        const reader = new FileReader();
        reader.onload = e => { previewImg.src = e.target.result; };
        reader.readAsDataURL(file);
        $('s-msg').textContent='파일이 선택되었습니다.';
      }
    }catch(err){
      const reader = new FileReader();
      reader.onload = e => { previewImg.src = e.target.result; };
      reader.readAsDataURL(file);
      $('s-msg').textContent='파일이 선택되었습니다.';
    }
  }

  if($('s-logo-file')) $('s-logo-file').onchange = () => handleFileSelect($('s-logo-file'), $('s-logo'), $('s-logo-preview'));
  if($('s-building-file')) $('s-building-file').onchange = () => handleFileSelect($('s-building-file'), $('s-building'), $('s-building-preview'));

  $('s-save').onclick=async()=>{
    if(!$('s-org').value.trim()){$('s-msg').textContent='조직명을 입력해 주세요.';return;}
    $('s-save').disabled=true;
    try{
      const updated={...data};
      for(const [id,key] of Object.entries(fields))if($(id))updated[key]=$(id).value.trim();
      const response=await fetch('../api/admin/data',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name:'site',data:updated})});
      const result=await response.json();
      if(!response.ok||result.ok!==true)throw Error(result.error||'저장 실패');
      data=updated;
      $('s-msg').textContent='';
      window.alert('기본설정을 저장했습니다.');
      window.location.assign('index.html');
    }catch(error){
      $('s-msg').textContent=error.message;
    }finally{
      $('s-save').disabled=false;
    }
  };
})();
