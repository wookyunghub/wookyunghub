(()=>{
 const C=window.CenterHubCommon;
 const documentFile=u=>/\.(hwp|hwpx|doc|docx|pdf)$/i.test(u.pathname);
 function download(url){if(!confirm('원본 파일을 다운로드하시겠습니까?'))return;const u=new URL(url,location.href);u.searchParams.set('download','1');const a=document.createElement('a');a.href=u.href;a.download='';document.body.append(a);a.click();a.remove();}
 async function lookup(url){const status=await C.apiStatus();const data=await C.api(status.authenticated?'api/admin/files':'api/public/resources',null);if(!data)throw new Error('자료 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');return ['documents','photos','receipts'].flatMap(k=>data[k]||[]).find(x=>x.url&&new URL(x.url,location.origin).pathname===url.pathname);}
 function view(x,url){const pdf=x?.pdf?.url||(/\.pdf$/i.test(url.pathname)?url.href:null);if(!pdf){download(url);return;}
 const dialog=document.createElement('dialog');dialog.style.cssText='width:min(1000px,94vw);max-width:94vw;padding:16px;border:1px solid #cbb8aa;border-radius:12px';
 const bar=document.createElement('div');bar.style.cssText='display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap';const title=document.createElement('strong');title.textContent=x?.title||x?.name||'문서 보기';title.style.flex='1';
 const dl=document.createElement('button');dl.className='btn';dl.textContent='원본 다운로드';dl.onclick=()=>download(url);
 const close=document.createElement('button');close.className='btn';close.textContent='닫기';close.onclick=()=>dialog.close();bar.append(title,dl,close);
 const frame=document.createElement('iframe');frame.src=pdf;frame.title='PDF 열람';frame.style.cssText='display:block;width:100%;height:72vh;border:0';dialog.append(bar,frame);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
 }
 document.addEventListener('click',async event=>{const a=event.target.closest('a[href]');if(!a)return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||!u.pathname.startsWith('/media/'))return;if(!documentFile(u)&&!a.hasAttribute('data-file-download'))return;event.preventDefault();event.stopImmediatePropagation();
 if(a.hasAttribute('data-file-download')||u.searchParams.get('download')==='1'){download(u);return;}
 try{const x=await lookup(u);view(x,u);}catch(error){alert(error.message);}
 },true);
 window.CenterHubFiles={download};
})();
