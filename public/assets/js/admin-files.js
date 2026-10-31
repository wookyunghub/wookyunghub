(async()=>{
  const $=id=>document.getElementById(id);
  const list=$('file-list'),filter=$('file-filter'),msg=$('file-msg'),uploadBtn=$('file-upload');
  const dialog=$('file-detail'),detail=$('file-detail-body');
  const docPills=$('file-doc-pills'),scrollTopBtn=$('file-scroll-top');
  const roles={minutes:'회의록 원본',attendance:'참석명단',report:'보고자료',receipt:'증빙',form:'서식',document:'일반문서',other:'일반문서'};
  const types={
    photo:{kind:'photos',role:''},
    form:{kind:'documents',role:'form'},
    document:{kind:'documents',role:''},
    minutes:{kind:'documents',role:'minutes'},
    attendance:{kind:'documents',role:'attendance'},
    report:{kind:'documents',role:'report'},
    receipt:{kind:'receipts',role:'receipt'}
  };
  function fileType(x){
    if(x._kind==='receipts')return 'receipt';
    if(x._kind==='photos')return 'photo';
    if(x.attachment_role==='form')return 'form';
    return ['minutes','attendance','report'].includes(x.attachment_role)?x.attachment_role:'document';
  }
  function rolePolicy(){
    const locked=$('file-role').value==='receipt';
    $('file-public').disabled=locked;
    if(locked)$('file-public').value='false';
  }
  $('file-role').onchange=()=>{
    if($('file-role').value!=='receipt')$('file-public').value='true';
    rolePolicy();
  };
  rolePolicy();

  const linksText=x=>(x.linked_records||[]).map(r=>r.title||r.id).join(' / ');
  const labels={documents:'일반문서',photos:'사진',receipts:'증빙'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kindOf=x=>(x.url||'').split('?')[0].split('.').pop().toLowerCase();
  const safeUrl=x=>{
    if(!x||!x.url)return '';
    try{
      const clean=x.url.startsWith('/')?x.url:'/'+x.url;
      if(clean.startsWith('/media/'))return clean;
      if(x.url.startsWith('http://')||x.url.startsWith('https://'))return x.url;
    }catch{return '';}
    return '';
  };
  const form=$('file-form-body'),toggle=$('file-form-toggle');
  toggle.onclick=()=>{
    form.hidden=!form.hidden;
    toggle.textContent=form.hidden?'등록 양식 펼치기':'등록 양식 접기';
    toggle.setAttribute('aria-expanded',String(!form.hidden));
  };
  $('file-detail-close').onclick=()=>dialog.close();
  
  let data={documents:[],photos:[],receipts:[]};
  let currentTab=['photo','form','document','receipt','all'].includes(location.hash.replace('#',''))?location.hash.replace('#',''):'photo';
  let currentDocSub='document_all';

  async function load(){
    try{
      const r=await fetch('../api/admin/files',{credentials:'same-origin',cache:'no-store'});
      if(r.ok&&(r.headers.get('content-type')||'').toLowerCase().includes('application/json')){
        data=await r.json();
        render();
        return;
      }
    }catch(e){}
    try{
      const r2=await fetch('../api/public/resources',{cache:'no-store'});
      if(r2.ok&&(r2.headers.get('content-type')||'').toLowerCase().includes('application/json')){
        data=await r2.json();
        render();
        return;
      }
    }catch(e){}
    try{
      const r3=await fetch('https://wookyunghub.pythonanywhere.com/api/public/resources',{cache:'no-store'});
      if(r3.ok&&(r3.headers.get('content-type')||'').toLowerCase().includes('application/json')){
        data=await r3.json();
        render();
        return;
      }
    }catch(e){}
    try{
      const r4=await fetch('../data/resources.json',{cache:'no-store'});
      if(r4.ok){
        data=await r4.json();
        render();
        return;
      }
    }catch(e){}
    throw new Error('자료 목록을 불러오지 못했습니다.');
  }

  function thumb(x){
    const url=safeUrl(x),ext=kindOf(x);
    if(!url)return '<span class="file-type-icon">파일</span>';
    if(['jpg','jpeg','png','gif','webp','bmp'].includes(ext)){
      return `<img loading="lazy" src="${esc(url)}" alt="${esc(x.title||x.name||'')} 미리보기" onerror="if(!this.dataset.fb&&!location.hostname.includes('pythonanywhere')){this.dataset.fb='1';this.src='https://wookyunghub.pythonanywhere.com'+(this.getAttribute('src').startsWith('/')?this.getAttribute('src'):'/'+this.getAttribute('src'));}">`;
    }
    if(ext==='pdf')return `<span class="file-type-icon pdf">PDF</span>`;
    return `<span class="file-type-icon">${esc(ext.toUpperCase().slice(0,6)||'파일')}</span>`;
  }

  function card(x){
    return `<article class="file-item"><button type="button" class="file-preview" data-view="${esc(x.id)}" data-kind="${x._kind}" aria-label="상세보기: ${esc(x.title||x.name)}">${thumb(x)}</button><div class="file-item-body"><button type="button" class="file-item-title" data-view="${esc(x.id)}" data-kind="${x._kind}">${esc(x.title||x.name)}</button><small>${esc(roles[x.attachment_role]||labels[x._kind])} · <strong>${esc(x.date||'날짜 미입력')}</strong> · ${x.public?'공개':'비공개'}</small><p>${esc(x.description||'')}</p><small>연결 기록: ${esc(linksText(x)||'없음 · 독립 자료')}</small></div><div class="file-item-actions"><button class="btn" data-view="${esc(x.id)}" data-kind="${x._kind}">상세</button><button class="btn" data-edit="${esc(x.id)}" data-kind="${x._kind}">수정</button><button class="btn danger" data-del="${esc(x.id)}" data-kind="${x._kind}">삭제</button></div></article>`;
  }

  function groupHtml(title, icon, items){
    if(!items.length) return '';
    return `<div class="file-group-heading"><span class="file-group-title">${icon} ${title}</span><span class="file-group-count">${items.length}건 · 날짜순(최신순) 정렬</span></div><div class="file-cards">${items.map(card).join('')}</div>`;
  }

  function render(){
    const sortFn=window.CenterHubResourceOrder.newestFirst;
    const allPhotos=(data.photos||[]).map(x=>({...x,_kind:'photos'})).sort(sortFn);
    const rawDocs=(data.documents||[]).map(x=>({...x,_kind:'documents'})).sort(sortFn);
    const forms=rawDocs.filter(x=>x.attachment_role==='form');
    const normalDocs=rawDocs.filter(x=>x.attachment_role!=='form');
    const allReceipts=(data.receipts||[]).map(x=>({...x,_kind:'receipts'})).sort(sortFn);

    document.querySelectorAll('.file-tab').forEach(t=>{
      const active=t.dataset.tab===currentTab;
      t.classList.toggle('active',active);
      t.setAttribute('aria-selected',String(active));
    });
    if(docPills) docPills.hidden=(currentTab!=='document');

    if(currentTab==='photo'){
      list.innerHTML=groupHtml('사진', '📷', allPhotos)||(allPhotos.length?'':'<div class="empty-state compact-empty">등록된 사진 자료가 없습니다.</div>');
      return;
    }
    if(currentTab==='form'){
      list.innerHTML=groupHtml('서식', '📋', forms)||(forms.length?'':'<div class="empty-state compact-empty">등록된 서식 자료가 없습니다.</div>');
      return;
    }
    if(currentTab==='document'){
      const filteredDocs=currentDocSub==='document_all'?normalDocs:normalDocs.filter(x=>fileType(x)===currentDocSub);
      const subLabels={document_all:'전체', document:'일반', minutes:'회의록', attendance:'명단', report:'보고'};
      const subLabel=subLabels[currentDocSub]||roles[currentDocSub]||'문서';
      list.innerHTML=groupHtml('문서 ('+subLabel+')', '📄', filteredDocs)||(filteredDocs.length?'':`<div class="empty-state compact-empty">해당 분류(${subLabel})의 문서 자료가 없습니다.</div>`);
      return;
    }
    if(currentTab==='receipt'){
      list.innerHTML=groupHtml('증빙(영수증)', '🧾', allReceipts)||(allReceipts.length?'':'<div class="empty-state compact-empty">등록된 증빙(영수증) 자료가 없습니다.</div>');
      return;
    }
    // Tab: 'all' -> Quick jump bar with 4 categories
    const jumpBar=`<div class="file-quick-jump"><span>위치 이동:</span><button type="button" class="quick-jump-btn" data-jump="section-photos">📷 사진 (${allPhotos.length})</button><button type="button" class="quick-jump-btn" data-jump="section-forms">📋 서식 (${forms.length})</button><button type="button" class="quick-jump-btn" data-jump="section-docs">📄 문서 (${normalDocs.length})</button>${allReceipts.length?`<button type="button" class="quick-jump-btn" data-jump="section-receipts">🧾 증빙 (${allReceipts.length})</button>`:''}</div>`;
    const photosSec=allPhotos.length?`<div id="section-photos">${groupHtml('사진', '📷', allPhotos)}</div>`:'';
    const formsSec=forms.length?`<div id="section-forms">${groupHtml('서식', '📋', forms)}</div>`:'';
    const docsSec=normalDocs.length?`<div id="section-docs">${groupHtml('문서', '📄', normalDocs)}</div>`:'';
    const receiptsSec=allReceipts.length?`<div id="section-receipts">${groupHtml('증빙', '🧾', allReceipts)}</div>`:'';
    list.innerHTML=(jumpBar+photosSec+formsSec+docsSec+receiptsSec)||(allPhotos.length+forms.length+normalDocs.length+allReceipts.length?'':'<div class="empty-state compact-empty">등록된 자료가 없습니다.</div>');
  }

  // Tab click event
  document.querySelectorAll('.file-tab').forEach(tabBtn=>{
    tabBtn.onclick=()=>{
      currentTab=tabBtn.dataset.tab;
      try{history.replaceState(null,'','#'+currentTab);}catch(e){}
      render();
    };
  });

  // Document sub-pills click event
  document.querySelectorAll('.sub-pill').forEach(pill=>{
    pill.onclick=()=>{
      document.querySelectorAll('.sub-pill').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');
      currentDocSub=pill.dataset.sub;
      render();
    };
  });

  // Quick jump button click event
  list.addEventListener('click',e=>{
    const jumpBtn=e.target.closest('[data-jump]');
    if(jumpBtn){
      const target=$(jumpBtn.dataset.jump);
      if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });

  // Scroll to top button
  if(scrollTopBtn){
    window.addEventListener('scroll',()=>{
      scrollTopBtn.classList.toggle('visible',window.scrollY>300);
    });
    scrollTopBtn.onclick=()=>{
      window.scrollTo({top:0,behavior:'smooth'});
    };
  }

  function show(x){
    const url=safeUrl(x),ext=kindOf(x);
    detail.innerHTML=`
      <div class="file-detail-grid">
        ${['jpg','jpeg','png','gif','webp','bmp'].includes(ext)&&url?`<div class="file-detail-thumb"><img src="${esc(url)}" alt="" onerror="if(!this.dataset.fb&&!location.hostname.includes('pythonanywhere')){this.dataset.fb='1';this.src='https://wookyunghub.pythonanywhere.com'+(this.getAttribute('src').startsWith('/')?this.getAttribute('src'):'/'+this.getAttribute('src'));}"></div>`:''}
        <div class="file-detail-info">
          <p><strong>제목:</strong> ${esc(x.title||x.name)}</p>
          <p><strong>자료구분:</strong> ${esc(roles[x.attachment_role]||labels[x._kind])}</p>
          <p><strong>날짜:</strong> ${esc(x.date||'미입력')}</p>
          <p><strong>공개 상태:</strong> ${x.public?'공개':'관리자 전용(비공개)'}</p>
          <p><strong>파일명:</strong> ${esc(x.name||'-')}</p>
          <p><strong>크기:</strong> ${x.size?(x.size/1024).toFixed(1)+' KB':'-'}</p>
          ${x.description?`<p><strong>설명:</strong> ${esc(x.description)}</p>`:''}
          <p><strong>연결 기록:</strong> ${esc(linksText(x)||'없음 · 독립 자료')}</p>
        </div>
      </div>
      <div class="toolbar" style="margin-top:14px;justify-content:flex-end">
        ${url?`<a class="btn primary" href="${esc(url)}" download="${esc(x.name||'다운로드')}" target="_blank" rel="noopener">원본 다운로드</a>`:''}
      </div>
    `;
    dialog.showModal();
  }

  async function uploadForm(fd){
    const r=await fetch('../api/admin/files',{method:'POST',credentials:'same-origin',body:fd});
    const d=await r.json();
    if(!r.ok||!d.ok)throw new Error(d.error||'파일 등록에 실패했습니다.');
    return d;
  }

  uploadBtn.onclick=async()=>{
    msg.textContent='';
    const files=Array.from($('file-input').files||[]);
    if(!files.length){msg.textContent='업로드할 원본 파일을 선택해 주세요.';return;}
    if(!$('file-date').value){msg.textContent='자료 날짜를 입력해 주세요.';$('file-date').focus();return;}
    if(files.some(f=>f.size>=60*1024*1024)){msg.textContent='파일 1개당 최대 크기는 60MB 미만이어야 합니다.';return;}
    const pdf=$('file-pdf').files[0];
    if(pdf&&(files.length!==1||!/\.(hwp|hwpx|doc|docx)$/i.test(files[0].name))){alert('PDF 열람본은 HWP·Word 원본 1개와 함께 선택해 주세요.');return;}
    if(pdf&&!/\.pdf$/i.test(pdf.name)){alert('열람본은 PDF 파일만 등록할 수 있습니다.');return;}
    if(files.some(f=>/\.(hwp|hwpx|doc|docx)$/i.test(f.name))&&!pdf&&!confirm('PDF 열람본이 없습니다. 홈페이지에서는 문서 미리보기 없이 원본 다운로드로 제공됩니다. 등록하시겠습니까?'))return;

    const type=types[$('file-role').value];
    if(!type){msg.textContent='자료구분을 확인해 주세요.';return;}
    const values={kind:type.kind,attachment_role:type.role,public:$('file-public').value,date:$('file-date').value,description:$('file-desc').value,book_include:'false'};
    const customTitle=$('file-title').value.trim();
    let completed=0;
    uploadBtn.disabled=true;
    try{
      for(const file of files){
        const fd=new FormData();
        for(const [key,value] of Object.entries(values))fd.append(key,value);
        fd.append('title',customTitle?(files.length===1?customTitle:customTitle+' · '+file.name):file.name);
        fd.append('file',file,file.name);
        if(pdf)fd.append('pdf_file',pdf,pdf.name);
        await uploadForm(fd);
        completed++;
      }
      $('file-input').value='';$('file-pdf').value='';$('file-title').value='';$('file-desc').value='';$('file-date').value='';
      msg.textContent=completed+'건의 자료를 등록했습니다.';
      // Switch to the matching tab
      if(type.kind==='photos') currentTab='photo';
      else if(type.role==='form') currentTab='form';
      else if(type.kind==='documents') {
        currentTab='document';
        currentDocSub=type.role||'document_all';
      }
      else if(type.kind==='receipts') currentTab='receipt';
      try{history.replaceState(null,'','#'+currentTab);}catch(e){}
      await load();
    }catch(e){
      $('file-input').value='';
      msg.textContent=completed+'개 등록 후 중단: '+e.message+'. 목록 확인 후 실패한 파일만 다시 선택해 주세요.';
      try{await load();}catch{}
    }finally{
      uploadBtn.disabled=false;
    }
  };

  list.onclick=async e=>{
    const btn=e.target.closest('[data-view],[data-edit],[data-del]');
    if(!btn)return;
    const id=btn.dataset.view||btn.dataset.edit||btn.dataset.del;
    const kind=btn.dataset.kind,x=(data[kind]||[]).find(z=>String(z.id)===id);
    if(!x)return;

    if(btn.dataset.view){show({...x,_kind:kind});return;}
    if(btn.dataset.del){
      if(!confirm('이 자료의 원본 파일'+(x.pdf?'과 PDF 열람본':'')+'을 삭제하시겠습니까?'))return;
      btn.disabled=true;
      try{
        const r=await fetch('../api/admin/file',{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id})});
        const d=await r.json();
        if(!r.ok||!d.ok)throw new Error(d.error||'삭제에 실패했습니다.');
        await load();
        alert('자료를 삭제했습니다.');
      }catch(error){
        msg.textContent=error.message;
        alert(error.message);
      }finally{
        btn.disabled=false;
      }
      return;
    }
    const editDialog=document.createElement('dialog');
    editDialog.className='file-dialog file-edit-dialog';
    const heading=document.createElement('h2');
    heading.textContent='자료 수정';
    const editForm=document.createElement('form');
    editForm.className='admin-form-grid file-edit-form';
    function field(labelText,input){
      const label=document.createElement('label');
      label.textContent=labelText;
      label.append(input);
      editForm.append(label);
      return input;
    }
    const titleInput=field('제목',document.createElement('input'));
    titleInput.value=x.title||x.name||'';
    const dateInput=document.createElement('input');
    dateInput.type='date';
    dateInput.required=true;
    dateInput.value=x.date||'';
    field('자료 날짜 (필수)',dateInput);
    const visibility=document.createElement('select');
    visibility.add(new Option('공개','true'));
    visibility.add(new Option('관리자만','false'));
    visibility.value=String(!!x.public);
    visibility.disabled=kind==='receipts'||x.attachment_role==='receipt';
    field('공개 여부',visibility);
    const descriptionInput=field('설명',document.createElement('textarea'));
    descriptionInput.rows=2;
    descriptionInput.value=x.description||'';
    descriptionInput.parentElement.classList.add('file-edit-description');
    const actions=document.createElement('div');
    actions.className='toolbar file-edit-actions';
    const save=document.createElement('button');
    save.type='submit';
    save.className='btn primary';
    save.textContent='저장';
    const cancel=document.createElement('button');
    cancel.type='button';
    cancel.className='btn';
    cancel.textContent='취소';
    cancel.onclick=()=>editDialog.close();
    actions.append(save,cancel);
    editForm.append(actions);
    editForm.onsubmit=async event=>{
      event.preventDefault();
      if(!editForm.reportValidity())return;
      save.disabled=true;
      try{
        const response=await fetch('../api/admin/file',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,title:titleInput.value.trim(),date:dateInput.value,description:descriptionInput.value,public:visibility.disabled?false:visibility.value==='true'})});
        const result=await response.json();
        if(!response.ok||!result.ok)throw new Error(result.error||'수정에 실패했습니다.');
        editDialog.close();
        await load();
        msg.textContent='수정했습니다.';
      }catch(error){
        alert(error.message);
      }finally{
        save.disabled=false;
      }
    };
    editDialog.append(heading,editForm);
    editDialog.addEventListener('close',()=>editDialog.remove());
    document.body.append(editDialog);
    editDialog.showModal();
  };

  try{await load();}catch(e){msg.textContent=e.message;}
})();
