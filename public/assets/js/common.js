(function(){
  function getRoot(){const s=document.currentScript;return (!s||!s.src)?new URL('./',location.href).href:new URL('../../',s.src).href}
  const root=getRoot(), BUILD_VERSION='1.1';
  const DEFAULT_SITE={organization_name:'우경경로당',site_title:'경로당 홈페이지',latest_period:'2025-2026',link_mode:'preview',preview_url:'',content_protection:true,watermark_text:'열람용 · 무단복제금지'};
  const u=p=>new URL(p,root).href;const noCache=url=>{const x=new URL(url);x.searchParams.set('_',Date.now());return x.href};
  async function loadJson(path,fallback=null){try{const r=await fetch(noCache(u(path)),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(e){console.warn('[CenterHub]',path,e);return fallback}}
  const API_STATIC_FALLBACKS = {
    'api/public/site': 'data/site.json',
    'api/public/organization': 'data/organization.json',
    'api/public/news': 'data/news.json',
    'api/public/resources': 'data/resources.json',
    'api/public/about': 'data/about.json',
    'api/public/ledgers': 'data/ledgers.json',
    'api/public/documents': 'data/documents.json',
    'api/public/members': 'data/members.json',
    'api/public/records': 'data/records.json',
    'api/public/publications': 'data/ledgers.json',
    'api/public/history': 'data/about.json'
  };

  async function requestJson(path,options={}){
    const clean = String(path).replace(/^\/+/,'').split('?')[0];
    if (clean === 'api/admin/status') {
      try {
        let r = await fetch(noCache(u(path)),{cache:'no-store',credentials:'same-origin',...options});
        if(r.ok && (r.headers.get('content-type')||'').toLowerCase().includes('application/json')) return await r.json();
      } catch(e){}
      return {authenticated:false,features:{}};
    }
    try {
      let r = await fetch(noCache(u(path)),{cache:'no-store',credentials:'same-origin',...options});
      const contentType = r.headers.get('content-type')||'';
      if(r.ok && contentType.toLowerCase().includes('application/json')) {
        return await r.json();
      }
    } catch(e){}

    if (API_STATIC_FALLBACKS[clean]) {
      const fb = await loadJson(API_STATIC_FALLBACKS[clean], null);
      if (fb !== null) return fb;
    }
    throw new Error('데이터를 불러오지 못했습니다. ('+path+')');
  }
  async function api(path,fallback=null){try{return await requestJson(path)}catch(e){console.warn('[CenterHub API]',path,e);return fallback}}

  function normalizeUrl(v){v=(v||'').trim();if(!v)return '';return (/^https?:\/\//i.test(v)?v:'https://'+v).replace(/\/$/,'')}
  function currentTunnelUrl(){return (location.hostname||'').endsWith('.trycloudflare.com')?location.origin.replace(/\/$/,''):''}
  async function getRuntimePreviewUrl(){const c=currentTunnelUrl();if(c)return c;const d=await loadJson('data/runtime-preview.json',null);return d&&d.status==='ready'&&d.verified===true?normalizeUrl(d.preview_url||d.url):''}
  async function resolveExternalLink(site){const mode=(site&&site.link_mode)||'none';if(mode==='preview')return{mode,url:await getRuntimePreviewUrl(),label:site.preview_link_label||'개발 미리보기'};if(mode==='public')return{mode,url:normalizeUrl(site.public_url),label:site.public_link_label||'공개 홈페이지'};return{mode:'none',url:'',label:''}}
  async function apiStatus(){return await api('api/admin/status',{authenticated:false,features:{}})}
  function isAdminSession(){return sessionStorage.getItem('centerhub_admin')==='1'}
  function configureMobileMenu(nav,top){
    const mobile=()=>window.matchMedia('(max-width:820px)').matches;
    nav.querySelectorAll('.nav-item').forEach(item=>{
      const heading=document.createElement('span');heading.className='nav-group-heading';heading.textContent=item.querySelector('.nav-main-link').textContent;item.insertBefore(heading,item.firstChild);
    });
    let button=top.querySelector('.menu-toggle');if(!button){button=document.createElement('button');button.className='menu-toggle';button.type='button';button.innerHTML='<span></span><span></span><span></span>';top.insertBefore(button,nav);}
    button.setAttribute('aria-controls',nav.id);
    function setMenu(open){nav.classList.toggle('menu-open',open);button.classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');}
    setMenu(false);button.onclick=()=>setMenu(!nav.classList.contains('menu-open'));
    nav.addEventListener('click',event=>{if(mobile()&&event.target.closest('.nav-sub-link'))setMenu(false);});
    nav.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile()){setMenu(false);button.focus();}});
    window.addEventListener('resize',()=>{if(!mobile())setMenu(false);});
  }
  async function installStandardNavigation(site){
    const external=await resolveExternalLink(site),stat=await apiStatus(),admin=!!stat.authenticated;
    if(admin){sessionStorage.setItem('centerhub_admin','1');document.body.classList.add('admin-session');document.querySelectorAll('.brand[data-brand]').forEach(brand=>{if(brand.parentElement&&brand.parentElement.querySelector('.admin-mode-indicator'))return;const badge=document.createElement('a');badge.className='admin-mode-indicator';badge.href=u('admin/index.html');badge.textContent='관리자 모드';badge.title='관리자 로그인 상태';brand.insertAdjacentElement('afterend',badge)})}else document.body.classList.remove('admin-session');
    document.querySelectorAll('[data-feature="publication_management"]').forEach(el=>{el.hidden=!(admin&&stat.features?.publication_management===true)});
    const indicator=document.querySelector('[data-runtime-environment]');if(indicator)indicator.textContent=(stat.environment==='development'?'개발용':'운영용')+' · v'+(stat.app_version||'확인 필요');
    const groups=[
      {key:'about',label:'경로당 소개',href:u('about.html'),items:[['기본현황',u('about.html#basic')],['연혁',u('about.html#history')],['조직도',u('about.html#officers')],['회원명부',u('members.html')],['시설안내',u('about.html#facilities')],['오시는 길',u('about.html#access')]]},
      {key:'guide',label:'운영안내',href:u('guide.html'),items:[['운영지침',u('guide.html#policy')],['노인강령',u('guide.html#elder-code')],['경로헌장',u('guide.html#charter')],['운영규정',u('regulations.html')]]},
      {key:'news',label:'소식·활동',href:u('news-list.html'),items:[['공지사항',u('news-list.html?type=notice')],['회의·행사 기록',u('news-list.html?type=records')]]},
      {key:'ledger',label:'운영대장',href:u('ledger.html'),items:[['운영대장 전체',u('ledger.html')],['최신 운영대장',u('ledger.html#current')],['지난 운영대장',u('ledger.html#archives')],['이북 보기',u('ebook.html?ledger=2025-2026&doc=summary')]]},
      {key:'resources',label:'자료실',href:u('resources.html'),items:[['일반문서',u('resources.html#documents')],['사진자료',u('resources.html#photos')]]},
      {key:'admin',label:'관리자',href:admin?u('admin/index.html'):u('admin-login.html'),items:admin?[[ '관리자 홈',u('admin/index.html')],['공지사항 관리',u('admin/announcements.html')],['통합 기록 관리',u('admin/records.html')],['임원·이사회 관리',u('admin/officers.html')],['회원명부 관리',u('admin/members.html')],['자료·첨부 관리',u('admin/files.html')],...(stat.features?.publication_management===true?[['운영대장·발간',u('admin/ledgers.html')]]:[]),['기본 설정',u('admin/settings.html')],['관리자 PIN',u('admin/security.html')],['로그아웃','#logout']]:[['관리자 로그인',u('admin-login.html')]]}
    ];
    if(external.mode!=='none')groups[5].items.push([external.mode==='preview'?'개발 미리보기':'공개 홈페이지','#external']);
    document.querySelectorAll('.top-actions').forEach((nav,i)=>{nav.className='main-nav top-actions';nav.innerHTML='';nav.id='main-nav-'+i;groups.forEach(g=>{const item=document.createElement('div');item.className='nav-item nav-'+g.key;const a=document.createElement('a');a.className='nav-main-link';a.href=g.href;a.textContent=g.label;const sub=document.createElement('div');sub.className='nav-submenu';g.items.forEach(([label,href])=>{if(href==='#logout'){const b=document.createElement('button');b.className='nav-sub-link nav-sub-button';b.textContent=label;b.onclick=async()=>{try{await fetch(u('api/admin/logout'),{method:'POST',credentials:'same-origin'})}catch(e){}sessionStorage.clear();location.href=u('index.html')};sub.appendChild(b)}else if(href==='#external'){const x=document.createElement('a');x.className='nav-sub-link nav-external-link';x.dataset.externalMode=external.mode;x.target='_blank';x.rel='noopener';if(external.url){x.href=external.url;x.textContent=label}else{x.textContent=label+' (준비 중)';x.setAttribute('aria-disabled','true');x.tabIndex=-1}sub.appendChild(x)}else{const x=document.createElement('a');x.className='nav-sub-link';x.href=href;x.textContent=label;sub.appendChild(x)}});item.append(a,sub);nav.appendChild(item)});const top=nav.closest('.topbar .wrap');if(top)configureMobileMenu(nav,top)});
    // Cloudflare Quick Tunnel 주소는 서버 실행 후 비동기로 생성됩니다.
    // 최초 로딩 시 주소가 없더라도 메뉴를 표시하고 준비 완료 시 자동 활성화합니다.
    if(external.mode==='preview'&&!external.url){
      let attempts=0,busy=false;
      const poll=setInterval(async()=>{
        if(busy)return;
        if(++attempts>60){clearInterval(poll);return;}
        busy=true;
        try{
          const url=await getRuntimePreviewUrl();
          if(url){
            document.querySelectorAll('.nav-external-link[data-external-mode="preview"]').forEach(x=>{
              x.href=url;x.textContent=site.preview_link_label||'개발 미리보기';
              x.removeAttribute('aria-disabled');x.removeAttribute('tabindex');
            });
            clearInterval(poll);
          }
        }finally{busy=false;}
      },1000);
    }
  }
  // v4.4: Public basic information is reused in the footer across all pages.
  async function installCommonFooter(site){
    const footer=document.querySelector('footer.footer');
    if(!footer)return;
    const org=await api('api/public/organization',{});
    const basic=org&&org.basic||{};
    const name=String(site.organization_name||'우경경로당');
    const address=String(basic.address||'').trim();
    const phone=String(basic.phone||'').trim();
    const wrap=footer.querySelector('.wrap')||footer.appendChild(document.createElement('div'));
    wrap.classList.add('centerhub-footer-inner');
    wrap.replaceChildren();
    const info=document.createElement('div');info.className='centerhub-footer-info';
    const orgName=document.createElement('strong');orgName.textContent=[site.parent_organization??basic.parent_organization,site.branch_name??basic.branch_name,name].map(v=>String(v||'').trim()).filter(Boolean).join(' ');orgName.style.overflowWrap='anywhere';info.appendChild(orgName);
    if(address){const v=document.createElement('span');v.textContent=address;info.appendChild(v)}
    if(phone){const v=document.createElement('span');v.textContent='전화 '+phone;info.appendChild(v)}
    const rights=document.createElement('small');rights.className='centerhub-footer-rights';
    rights.textContent='© '+new Date().getFullYear()+' '+name+'. All rights reserved.';
    wrap.append(info,rights);
  }
  function installCompactLayout(){
    if(document.getElementById('centerhub-site-compact-css'))return;
    const css=document.createElement('style');css.id='centerhub-site-compact-css';
    css.textContent=`
      body{min-height:100vh;display:flex;flex-direction:column}
      body>main{flex:1 0 auto}
      body>main.wrap{width:100%;box-sizing:border-box}
      .nav-group-heading{display:none}
      @media(max-width:820px){
        .main-nav.menu-open{display:block!important;max-height:70vh;max-height:70dvh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:8px 0 14px}
        .main-nav .nav-item{display:block;padding:8px 0;border-bottom:1px solid var(--line,#e8d7c4)}
        .main-nav .nav-main-link{display:none}
        .main-nav .nav-group-heading{display:block;padding:6px 14px;font-size:16px;font-weight:800;color:var(--brand,#80553d)}
        .main-nav .nav-submenu{position:static;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 8px;min-width:0;width:auto;visibility:visible;opacity:1;transform:none;box-shadow:none;border:0;background:transparent;padding:0 10px}
        .main-nav .nav-sub-link{display:flex;align-items:center;min-width:0;min-height:44px;margin:0;padding:10px 12px;box-sizing:border-box;font-size:15px;line-height:1.45;white-space:normal;overflow-wrap:anywhere;border-radius:6px;text-align:left;text-decoration:none}
        .main-nav .nav-sub-link:focus-visible{outline:2px solid currentColor;outline-offset:-2px}
      }
      @media(max-width:340px){.main-nav .nav-submenu{grid-template-columns:1fr}}
      body>footer.footer{margin-top:auto;flex-shrink:0;padding:14px 0;background:rgba(255,251,246,.82);border-top:1px solid #e8d7c4}
      .centerhub-footer-inner{display:flex;align-items:center;justify-content:space-between;gap:8px 24px;flex-wrap:wrap;padding-top:0!important;padding-bottom:0!important;font-size:13px;line-height:1.5;color:#806453}
      .centerhub-footer-info{display:flex;gap:5px 14px;align-items:center;flex-wrap:wrap}
      .centerhub-footer-info strong{color:#73513c}
      .centerhub-footer-rights{font-size:12px;color:#957d6d}
      @media(max-width:650px){.centerhub-footer-inner{align-items:flex-start;flex-direction:column;gap:3px}.centerhub-footer-info{gap:3px 12px}}
      @media print{body>footer.footer{display:none!important}}
    `;document.head.appendChild(css);
  }
  async function loadSite(){const site={...DEFAULT_SITE,...(await api('api/public/site',await loadJson('data/site.json',{})))};document.querySelectorAll('[data-brand]').forEach(e=>e.textContent=site.organization_name);document.querySelectorAll('[data-period]').forEach(e=>e.textContent=site.latest_period);await installStandardNavigation(site);installCompactLayout();installCommonFooter(site).catch(e=>console.warn('[CenterHub footer]',e));installReadonlyProtection(site);return site}
  function toast(msg){let e=document.getElementById('security-toast');if(!e){e=document.createElement('div');e.id='security-toast';e.className='security-toast';document.body.appendChild(e)}e.textContent=msg;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2200)}
  function installReadonlyProtection(site){if(location.pathname.includes('/admin/')||location.pathname.endsWith('/admin-login.html')||site.content_protection===false)return;document.body.classList.add('public-readonly');const layer=document.createElement('div');layer.className='watermark-layer';for(let i=0;i<6;i++){const s=document.createElement('span');s.textContent=(site.organization_name||'')+' · '+(site.watermark_text||'열람용');layer.appendChild(s)}document.body.appendChild(layer);document.addEventListener('contextmenu',e=>{e.preventDefault();toast('공개 열람 화면에서는 오른쪽 메뉴를 제한합니다.')});document.addEventListener('dragstart',e=>{if(e.target.closest('img,.page,.ebook-page'))e.preventDefault()});document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&['s','p','u'].includes(k)){e.preventDefault();toast('저장·인쇄·소스보기는 제한됩니다.')}},true)}
  function installTop(){const b=document.createElement('button');b.className='top-button';b.innerHTML='↑<span class="top-button-text">TOP</span>';b.onclick=()=>scrollTo({top:0,behavior:'smooth'});document.body.appendChild(b);addEventListener('scroll',()=>b.classList.toggle('show',scrollY>260),{passive:true})}
  function compactAdminHeading(){
    if(!document.body.classList.contains('admin-page'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=u('assets/css/admin-compact.css?v=5.14');document.head.appendChild(link);
    const main=document.querySelector('main');if(!main)return;
    const heading=main.querySelector(':scope > .page-title,:scope > .compact-heading');if(!heading)return;
    const title=heading.querySelector('h1');if(!title)return;
    const description=heading.querySelector('p');const existing=heading.querySelector('.toolbar');
    const actions=document.createElement('div');actions.className='admin-heading-actions';
    if(existing)while(existing.firstChild)actions.appendChild(existing.firstChild);
    heading.replaceChildren(title);heading.classList.add('admin-compact-heading');
    if(description){description.title=description.textContent;description.classList.add('admin-heading-description');heading.appendChild(description);}
    heading.appendChild(actions);
    // Move existing controls, preserving their IDs and attached event handlers.
    for(const selector of ['#record-list-panel > .toolbar > a[href$=".html?new=1"]','#record-editor > p > a[href$=".html"]']){
      const control=main.querySelector(selector);if(control){if(selector.includes('record-editor'))control.hidden=true;actions.appendChild(control);}
    }
    const toggle=main.querySelector('#file-form-toggle');if(toggle){const wrapper=toggle.closest('.file-form-head');actions.appendChild(toggle);if(wrapper)wrapper.hidden=true;}
  }
  compactAdminHeading();
  let siteReady=loadSite();installTop();
  const obj={root,BUILD_VERSION,loadJson,api,requestJson,loadSite,isAdminSession,apiStatus,getRuntimePreviewUrl,resolveExternalLink,get siteReady(){return siteReady}};
  window.CenterHubCommon=obj;window.OrgLedgerCommon=obj;window.OpsLedgerCommon=obj;
})();
{const s=document.createElement("script");s.src=window.CenterHubCommon.root+"assets/js/file-viewer.js?v=5.50";document.head.append(s);}

// All pages load the shared theme through the existing common entry point.
{const link=document.createElement('link');link.id='centerhub-site-theme';link.rel='stylesheet';link.href=new URL('assets/css/site-theme.css?v=5.67',window.CenterHubCommon.root).href;document.head.appendChild(link);}
