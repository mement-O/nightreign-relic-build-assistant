'use strict';
(async()=>{
  async function loadGzipBase64Text(path){
    const res=await fetch(path,{cache:'no-store'});
    if(!res.ok)throw new Error(`データ読込失敗: ${path} (${res.status})`);
    const b64=(await res.text()).trim();
    const bin=atob(b64);const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    if(!('DecompressionStream' in window))throw new Error('このブラウザはDecompressionStreamに対応していません。');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  window.__loadGzipBase64Text=loadGzipBase64Text;
  const code=await loadGzipBase64Text('./app.js.gz.b64');
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  const script=document.createElement('script');
  script.src=url;
  script.onload=()=>URL.revokeObjectURL(url);
  script.onerror=()=>{URL.revokeObjectURL(url);throw new Error('app.js の起動に失敗しました。')};
  document.head.appendChild(script);
})().catch(err=>{console.error(err);document.body.innerHTML=`<main style="max-width:900px;margin:80px auto;padding:24px;font-family:sans-serif"><h1>起動に失敗しました</h1><p>${String(err?.message||err)}</p></main>`});
