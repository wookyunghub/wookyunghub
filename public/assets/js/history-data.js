window.CenterHubHistory=(()=>{
const parts=v=>(String(v||'').match(/\d+/g)||[]).slice(0,3).map(Number);
function formatDate(v){const p=parts(v);if(!p.length)return '날짜 미상';return String(p[0])+(p.length>1?'.'+String(p[1]).padStart(2,'0'):'년')+(p.length>2?'.'+String(p[2]).padStart(2,'0'):'');}
function sorted(rows){return rows.slice().sort((a,b)=>{const A=parts(a.date),B=parts(b.date);for(let i=0;i<3;i++){const diff=(B[i]||0)-(A[i]||0);if(diff)return diff;}return String(a.title||'').localeCompare(String(b.title||''),'ko');});}
async function load(){try{const response=await fetch('api/public/records',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json(),rows=Array.isArray(data)?data:data.records;if(!Array.isArray(rows))throw Error('기록 응답 형식 오류');return {records:sorted(rows.filter(x=>x.module!=='notice'&&x.public===true&&x.status!=='deleted'&&x.history_excluded!==true))};}catch(error){console.warn('[연혁 조회]',error);return {records:[],error:true};}}
function groupYears(rows){const groups=new Map();for(const x of sorted(rows)){const p=parts(x.date),year=p.length?String(p[0]):'날짜 미상';if(!groups.has(year))groups.set(year,[]);groups.get(year).push(x);}return [...groups];}
return {formatDate,sorted,load,groupYears};
})();