'use strict';
(async()=>{
  const originalFetch=window.fetch.bind(window);
  async function loadParts(paths){
    let b64='';
    for(const path of paths){
      const res=await originalFetch(path,{cache:'no-store'});
      if(!res.ok)throw new Error(`データ読込失敗: ${path} (${res.status})`);
      b64+=(await res.text()).trim();
    }
    const bin=atob(b64); const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    if(!('DecompressionStream' in window))throw new Error('このブラウザはDecompressionStreamに対応していません。');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }

  const packed={
    './data/effect-rule-master.json':[
      './runtime/effect-rule-master.json.gz.b64.part01','./runtime/effect-rule-master.json.gz.b64.part02','./runtime/effect-rule-master.json.gz.b64.part03','./runtime/effect-rule-master.json.gz.b64.part04'
    ],
    './data/effect-base-master.json':[
      './runtime-v22c/base4000.part01','./runtime-v22c/base4000.part02','./runtime-v22c/base4000.part03','./runtime-v22c/base4000.part04','./runtime-v22c/base4000.part05','./runtime-v22c/base4000.part06'
    ],
    './data/relic-struct.json':[
      './runtime-v22c/relic4000.part01','./runtime-v22c/relic4000.part02','./runtime-v22c/relic4000.part03','./runtime-v22c/relic4000.part04','./runtime-v22c/relic4000.part05'
    ]
  };

  window.fetch=async function(input,init){
    const raw=typeof input==='string'?input:input?.url;
    const u=new URL(raw,location.href);
    const base=new URL('./',location.href);
    const rel='./'+u.pathname.slice(base.pathname.length);
    const parts=packed[rel];
    if(!parts)return originalFetch(input,init);
    const text=await loadParts(parts);
    return new Response(text,{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}});
  };

  let code=await loadParts([
    './runtime-v22b/app.js.gz.b64.part01','./runtime-v22b/app.js.gz.b64.part02','./runtime-v22b/app.js.gz.b64.part03'
  ]);
  code=code.replace(/\u0000/g,'\\0');
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  const script=document.createElement('script');
  script.src=url;
  script.onload=()=>URL.revokeObjectURL(url);
  script.onerror=()=>{URL.revokeObjectURL(url);throw new Error('app.js の起動に失敗しました。');};
  document.head.appendChild(script);
})().catch(err=>{
  console.error(err);
  document.body.innerHTML=`<main style="max-width:900px;margin:80px auto;padding:24px;font-family:sans-serif"><h1>起動に失敗しました</h1><p>${String(err?.message||err)}</p></main>`;
});
