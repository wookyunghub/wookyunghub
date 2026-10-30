(()=>{
 function dateKey(value){
  const text=String(value||'').trim().replace(/년\s*/g,'-').replace(/월\s*/g,'-').replace(/일$/,'').replace(/[./]/g,'-').replace(/-$/,'');
  const match8=text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(match8)return Number(match8[1])*10000+Number(match8[2])*100+Number(match8[3]);
  const match=text.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
  if(!match)return -Infinity;
  const year=Number(match[1]),month=Number(match[2]||0),day=Number(match[3]||0);
  if(year<1||(match[2]&&(month<1||month>12))||(match[3]&&(day<1||day>31)))return -Infinity;
  if(match[3]){const date=new Date(0);date.setUTCFullYear(year,month-1,day);if(date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return -Infinity;}
  return year*10000+month*100+day;
 }
 const newestFirst=(a,b)=>(dateKey(b.date)-dateKey(a.date))||String(b.title||b.name||b.id||'').localeCompare(String(a.title||a.name||a.id||''))||0;
 window.CenterHubResourceOrder={dateKey,newestFirst};
})();
