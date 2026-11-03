(()=>{
'use strict';
const data=window.CenterHubRegulations||[];
const tabs=document.getElementById('reg-tabs');
const main=document.getElementById('reg-main');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const operationReferences=[
 ['모법','대한노인회 지원에 관한 법률','대한노인회 지원에 관한 법률 시행령','대한노인회 지원에 관한 법률 시행규칙'],
 ['정관·규정','사단법인대한노인회정관','(사)대한노인회운영규정','(사)대한노인회운영규정 제22편 경로당운영','(사)대한노인회 진천군지회 우경경로당운영규정 시행규칙(세칙)']
];
const operationHistory=[
 ['제정','2014.11.21'],['개정','2015.02.03'],['개정','2016.02.02'],
 ['개정','2016.12.26'],['개정','2017.12.07'],['개정','2021.02.18'],
 ['개정','2021.03.18'],['개정','2022.02.07'],['개정','2022.12.22'],['개정','2025.12.31']
];
const operationPreamble=()=>`<details class="reg-preamble reg-history"><summary>관련 법령 및 제정·개정 이력 <span class="reg-history-count">제정 1건 · 개정 9건</span></summary><div class="reg-history-content"><section><h3>관련 법령 및 시행 제규정</h3>${operationReferences.map(([label,...entries])=>`<div class="reg-ref-group"><strong>${esc(label)}</strong><ol>${entries.map(v=>`<li>${esc(v)}</li>`).join('')}</ol></div>`).join('')}</section><section><h3>제정·개정 이력</h3><table class="reg-history-table"><thead><tr><th scope="col">구분</th><th scope="col">날짜</th></tr></thead><tbody>${operationHistory.map(([kind,date])=>`<tr><td>${kind}</td><td><time datetime="${date.replace(/\./g,'-')}">${date}</time></td></tr>`).join('')}</tbody></table></section></div><p class="reg-history-source">출처: 대한노인회 공식 제규정집 전문 기준</p></details>`;

const itemLabel=a=>{
 const n=String(a.number);
 if(n==='부칙'||n==='부록'||n==='정의'||n.startsWith('별표')||n.startsWith('보칙')||n.startsWith('제'))return n;
 return `제${n}조`;
};
const article=a=>{
 const text=String(a.fullText||'').trim();
 return `<article class="reg-article"><h4 class="reg-article-title">${esc(itemLabel(a))} ${esc(a.title||'')}</h4><div class="reg-article-text">${text?esc(text).replace(/\n/g,'<br>'):'원문 확인 필요'}</div></article>`;
};

let current='';
function render(){
 const hash=decodeURIComponent(location.hash.slice(1));
 const section=data.find(x=>x.id===hash)||data[0];
 if(!section)return;
 current=section.id;

 tabs.innerHTML=data.map(x=>`<a class="reg-tab ${x.id===current?'is-active':''}" ${x.id===current?'aria-current="page"':''} href="#${esc(x.id)}"><strong>${esc(x.title)}</strong><small>${x.pdf?'PDF 열람 · HWP 제공':'전문 열람'}</small></a>`).join('');
 const operation=section.id==='operation';
 const groupNav=operation?`<nav class="reg-jump" aria-label="장 바로가기">${section.groups.map((g,i)=>`<a href="#reg-group-${i}" data-group="${i}">${esc(g.title)}</a>`).join('')}</nav>`:'';

 const groups=section.groups.map((g,i)=>{
   return `<section class="reg-group" id="reg-group-${i}"><header class="reg-group-head"><h3>${esc(g.title)}</h3></header><div class="reg-articles">${g.items.map(article).join('')}</div></section>`;
 }).join('');

 const fileActions=`
   <div class="reg-file-actions">
     ${section.pdf ? `<a class="btn reg-btn-pdf" href="${esc(section.pdf)}" target="_blank" rel="noopener" title="${esc(section.title)} PDF 전문 열람"><span>📄 PDF 열람본 ↗</span></a>` : ''}
     ${section.hwp ? `<a class="btn reg-btn-hwp" href="${esc(section.hwp)}" download="${esc(section.filename || section.title + '.hwp')}" title="${esc(section.title)} HWP 한글 원본 파일 다운로드"><span>💾 HWP 원본</span></a>` : ''}
   </div>
 `;

 main.innerHTML=`<section class="reg-chapter"><header class="reg-chapter-head"><div><span class="reg-kicker">공식 규정 및 서식 원본</span><h2>${esc(section.title)}</h2></div>${fileActions}</header><div class="reg-body">${operation?operationPreamble():(section.preamble?`<div class="reg-preamble"><strong>관련 법령·제정 및 개정 이력</strong><div>${esc(section.preamble).replace(/\n/g,'<br>')}</div></div>`:'')}${groupNav}${groups}</div></section>`;

 main.querySelectorAll('[data-group]').forEach(link=>link.addEventListener('click',e=>{
  e.preventDefault();main.querySelector('#reg-group-'+link.dataset.group)?.scrollIntoView({behavior:'smooth',block:'start'});
 }));
}

window.addEventListener('hashchange',render);
render();
})();
