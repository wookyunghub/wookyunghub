(async()=>{
const C=window.CenterHubCommon;await C.siteReady;const H=window.CenterHubHistory,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=await H.load(),groups=H.groupYears(data.records);
for(const [year] of groups)$('history-year').add(new Option(year==='날짜 미상'?year:year+'년',year));
const requested=new URLSearchParams(location.search).get('year');if(groups.some(([y])=>y===requested))$('history-year').value=requested;
function render(){const selected=$('history-year').value,visible=groups.filter(([year])=>!selected||year===selected);$('history-count').textContent=`${visible.length}개 연도 · ${visible.reduce((n,[y,rows])=>n+rows.length,0)}건`;
$('history-years').innerHTML=visible.length?visible.map(([year,rows])=>`<section class="history-year-card"><h2>${esc(year==='날짜 미상'?year:year+'년')}<small>${rows.length}건</small></h2><ul>${rows.map(x=>`<li><time>${esc(H.formatDate(x.date))}</time><span>${esc(x.title||'제목 없음')}</span></li>`).join('')}</ul></section>`).join(''):`<div class="empty-state">${data.error?'기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.':'표시할 공개 기록이 없습니다.'}</div>`;}
$('history-year').onchange=()=>{render();const url=new URL(location.href);if($('history-year').value)url.searchParams.set('year',$('history-year').value);else url.searchParams.delete('year');history.replaceState(null,'',url);};render();
})();