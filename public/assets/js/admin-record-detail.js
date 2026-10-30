// Legacy URL compatibility only; all rendering lives in news-detail.js.
(()=>{const q=new URLSearchParams(location.search);q.set('from','admin');location.replace('../news-detail.html?'+q.toString());})();
