(async()=>{
  const $=id=>document.getElementById(id);
  const list=$('file-list'),filter=$('file-filter'),msg=$('file-msg'),uploadBtn=$('file-upload');
  const dialog=$('file-detail'),detail=$('file-detail-body');
  const roles={minutes:'회의록 원본',attendance:'참석명단',report:'보고자료',receipt:'영수증·증빙',other:'일반문서'};
  const types={document:{kind:'documents',role:''},photo:{kind:'photos',role:''},minutes:{kind:'documents',role:'minutes'},attendance:{kind:'documents',role:'attendance'},report:{kind:'documents',role:'report'},receipt:{kind:'receipts',role:'receipt'}};
  function fileType(x){if(x._kind==='receipts')return 'receipt';if(x._kind==='photos')return 'photo';return ['minutes','attendance','report'].includes(x.attachment_role)?x.attachment_role:'document';}
  function rolePolicy(){const locked=$('file-role').value==='receipt';$('file-public').disabled=locked;if(locked)$('file-public').value='false';}
  $('file-role').onchange=()=>{$('file-public').value='true';rolePolicy();};rolePolicy();
  const linksText=x=>(x.linked_records||[]).map(r=>r.title||r.id).join(' / ');
  const labels={documents:'일반문서',photos:'사진',receipts:'영수증·증빙'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kindOf=x=>(x.url||'').split('?')[0].split('.').pop().toLowerCase();
  const safeUrl=x=>{try{const u=new URL(x.url,location.origin);return u.origin===location.origin&&u.pathname.startsWith('/media/')?u.href:''}catch{return ''}};
  const form=$('file-form-body'),toggle=$('file-form-toggle');
  toggle.onclick=()=>{form.hidden=!form.hidden;toggle.textContent=form.hidden?'등록 양식 펼치기':'등록 양식 접기';toggle.setAttribute('aria-expanded',String(!form.hidden));};
  $('file-detail-close').onclick=()=>dialog.close();
  let data={documents:[],photos:[],receipts:[]};
  async function load(){const r=await fetch('../api/admin/files',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('자료 목록 조회 실패 ('+r.status+')');data=await r.json();render();}
  function items(){return ['documents','photos','receipts'].flatMap(k=>(data[k]||[]).map(x=>({...x,_kind:k}))).filter(x=>filter.value==='all'||fileType(x)===filter.value).sort(window.CenterHubResourceOrder.newestFirst);}
  function thumb(x){const url=safeUrl(x),ext=kindOf(x);
    if(!url)return '<span class="file-type-icon">파일</span>';
    if(['jpg','jpeg','png','gif','webp','bmp'].includes(ext))return `<img loading="lazy" src="${esc(url)}" alt="${esc(x.title||x.name||'')} 미리보기">`;
    if(ext==='pdf')return `<span class="file-type-icon pdf">PDF</span>`;
    return `<span class="file-type-icon">${esc(ext.toUpperCase().slice(0,6)||'파일')}</span>`;
  }
  function render(){const arr=items();list.innerHTML=arr.length?arr.map(x=>`<article class="file-item"><button type="button" class="file-preview" data-view="${esc(x.id)}" data-kind="${x._kind}" aria-label="상세보기: ${esc(x.title||x.name)}">${thumb(x)}</button><div class="file-item-body"><button type="button" class="file-item-title" data-view="${esc(x.id)}" data-kind="${x._kind}">${esc(x.title||x.name)}</button><small>${esc(roles[x.attachment_role]||labels[x._kind])} · ${esc(x.date||'날짜 미입력')} · ${x.public?'공개':'비공개'}</small><p>${esc(x.description||'')}</p><small>연결 기록: ${esc(linksText(x)||'없음 · 독립 자료')}</small></div><div class="file-item-actions"><button class="btn" data-view="${esc(x.id)}" data-kind="${x._kind}">상세</button><button class="btn" data-edit="${esc(x.id)}" data-kind="${x._kind}">수정</button><button class="btn danger" data-del="${esc(x.id)}" data-kind="${x._kind}">삭제</button></div></article>`).join(''):'<div class="empty-state compact-empty">등록된 자료가 없습니다.</div>';}
  filter.onchange=render;
  function show(x){const url=safeUrl(x),ext=kindOf(x);$('file-detail-title').textContent=x.title||x.name||'자료 상세';let media='<p>미리보기를 제공하지 않는 파일입니다.</p>';
    const preview=x.pdf?.url||url;const previewExt=x.pdf?'pdf':ext;
    if(preview){if(['jpg','jpeg','png','gif','webp','bmp'].includes(previewExt))media=`<img class="file-full-image" src="${esc(url)}" alt="${esc(x.title||x.name)}">`;
      else if(previewExt==='pdf')media=`<iframe class="file-pdf-view" src="${esc(preview)}#toolbar=1" title="PDF 미리보기"></iframe>`;
      else media='<p>파일 미리보기를 지원하지 않습니다. 원본을 다운로드하여 확인해 주세요.</p>';
    }
    detail.innerHTML=`<div class="file-detail-meta"><span>구분: ${labels[x._kind]}</span><span>날짜: ${esc(x.date||'-')}</span><span>${x.public?'공개':'비공개'}</span></div><p class="file-detail-desc">${esc(x.description||'설명 없음')}</p><p>유형: ${esc(roles[x.attachment_role]||'일반 자료')} · 연결 기록: ${esc(linksText(x)||'없음 · 독립 자료')}</p><div class="file-detail-media">${media}</div>${url?`<a class="btn primary" target="_blank" rel="noopener" data-file-download href="${esc(url)}?download=1">원본 다운로드</a>`:''}`;
    dialog.showModal();
  }
  const uploadForm=fd=>window.CenterHubUpload.upload(fd,percent=>{msg.textContent=`업로드 중... ${percent}%`;});
  uploadBtn.onclick=async()=>{
    if(!$('file-date').value||!$('file-date').checkValidity()){alert('자료 날짜를 달력에서 선택해 주세요.');$('file-date').focus();return;}
    const files=[...$('file-input').files];if(!files.length){msg.textContent='파일을 선택해 주세요.';return;}
    if(files.some(f=>f.size>=60*1024*1024)){msg.textContent='각 파일은 폼 정보를 포함해 60MB 미만이어야 합니다.';return;}
    const pdf=$('file-pdf').files[0];if(pdf&&(files.length!==1||!/\.(hwp|hwpx|doc|docx)$/i.test(files[0].name))){alert('PDF 열람본은 HWP·Word 원본 1개와 함께 선택해 주세요.');return;}if(pdf&&!/\.pdf$/i.test(pdf.name)){alert('열람본은 PDF 파일을 선택해 주세요.');return;}if(files.some(f=>/\.(hwp|hwpx|doc|docx)$/i.test(f.name))&&!pdf&&!confirm('PDF 열람본이 없습니다. 홈페이지에서 내용 미리보기 없이 원본 다운로드로 제공합니다. 등록하시겠습니까?'))return;
    const type=types[$('file-role').value];if(!type){msg.textContent='자료유형을 확인해 주세요.';return;}
    const values={kind:type.kind,attachment_role:type.role,public:$('file-public').value,date:$('file-date').value,description:$('file-desc').value,book_include:'false'};
    const customTitle=$('file-title').value.trim();let completed=0;uploadBtn.disabled=true;
    try{for(const file of files){const fd=new FormData();for(const [key,value] of Object.entries(values))fd.append(key,value);fd.append('title',customTitle?(files.length===1?customTitle:customTitle+' · '+file.name):file.name);fd.append('file',file,file.name);if(pdf)fd.append('pdf_file',pdf,pdf.name);await uploadForm(fd);completed++;}
      $('file-input').value='';$('file-pdf').value='';$('file-title').value='';$('file-desc').value='';$('file-date').value='';msg.textContent=completed+'개 자료를 등록했습니다.';await load();
    }catch(e){$('file-input').value='';msg.textContent=completed+'개 등록 후 중단: '+e.message+'. 목록 확인 후 실패한 파일만 다시 선택해 주세요.';try{await load()}catch{}}
    finally{uploadBtn.disabled=false;}
  };
  list.onclick=async e=>{const btn=e.target.closest('[data-view],[data-edit],[data-del]');if(!btn)return;const id=btn.dataset.view||btn.dataset.edit||btn.dataset.del;const kind=btn.dataset.kind,x=(data[kind]||[]).find(z=>String(z.id)===id);if(!x)return;
    if(btn.dataset.view){show({...x,_kind:kind});return;}
    if(btn.dataset.del){
      if(!confirm('이 자료의 원본 파일'+(x.pdf?'과 PDF 열람본':'')+'을 삭제하시겠습니까?'))return;
      btn.disabled=true;
      try{const r=await fetch('../api/admin/file',{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'삭제에 실패했습니다.');await load();alert('자료를 삭제했습니다.');}
      catch(error){msg.textContent=error.message;alert(error.message);}finally{btn.disabled=false;}return;
    }
    const editDialog=document.createElement('dialog');editDialog.className='file-dialog file-edit-dialog';
    const heading=document.createElement('h2');heading.textContent='자료 수정';
    const form=document.createElement('form');form.className='admin-form-grid file-edit-form';
    function field(labelText,input){const label=document.createElement('label');label.textContent=labelText;label.append(input);form.append(label);return input;}
    const titleInput=field('제목',document.createElement('input'));titleInput.value=x.title||x.name||'';
    const dateInput=document.createElement('input');dateInput.type='date';dateInput.required=true;dateInput.value=x.date||'';field('자료 날짜 (필수)',dateInput);
    const visibility=document.createElement('select');visibility.add(new Option('공개','true'));visibility.add(new Option('관리자만','false'));visibility.value=String(!!x.public);visibility.disabled=kind==='receipts'||x.attachment_role==='receipt';field('공개 여부',visibility);
const descriptionInput=field('설명',document.createElement('textarea'));descriptionInput.rows=2;descriptionInput.value=x.description||'';descriptionInput.parentElement.classList.add('file-edit-description');
    const actions=document.createElement('div');actions.className='toolbar file-edit-actions';
    const save=document.createElement('button');save.type='submit';save.className='btn primary';save.textContent='저장';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='취소';cancel.onclick=()=>editDialog.close();actions.append(save,cancel);form.append(actions);
    form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;save.disabled=true;
      try{const response=await fetch('../api/admin/file',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,title:titleInput.value.trim(),date:dateInput.value,description:descriptionInput.value,public:visibility.disabled?false:visibility.value==='true'})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'수정에 실패했습니다.');editDialog.close();await load();msg.textContent='수정했습니다.';}
      catch(error){alert(error.message);}finally{save.disabled=false;}
    };
    editDialog.append(heading,form);editDialog.addEventListener('close',()=>editDialog.remove());document.body.append(editDialog);editDialog.showModal();

  };
  try{await load()}catch(e){msg.textContent=e.message;}
})();
