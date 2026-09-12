'use strict';
(async()=>{
  const originalFetch=window.fetch.bind(window);
  async function loadParts(paths,label='payload'){
    let b64='';
    for(const path of paths){
      let res;
      try {
        res=await originalFetch(new URL(path,location.href).href,{cache:'no-store'});
      } catch(err) {
        throw new Error(`データ取得失敗: ${path} / ${err?.message||err}`);
      }
      if(!res.ok)throw new Error(`データ読込失敗: ${path} (${res.status})`);
      b64+=(await res.text()).trim();
    }
    let bytes;
    try{
      const bin=atob(b64); bytes=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    }catch(err){
      throw new Error(`${label} のBase64復元に失敗: ${err?.message||err}`);
    }
    if(!('DecompressionStream' in window))throw new Error('このブラウザはDecompressionStreamに対応していません。');
    try{
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    }catch(err){
      throw new Error(`${label} の展開に失敗: ${err?.message||err}`);
    }
  }

  if(typeof window.buildRelicStruct!=='function'){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='./relic-struct-generator.js?v=22i';
      s.onload=resolve;
      s.onerror=()=>reject(new Error('relic-struct-generator.js の読込に失敗しました。'));
      document.head.appendChild(s);
    });
  }
  if(typeof window.buildRelicStruct!=='function')throw new Error('relic-struct-generator.js の初期化に失敗しました。');
  const RELIC_STRUCT_JSON=JSON.stringify(await window.buildRelicStruct());

  const packed={
    './data/effect-rule-master.json':[
      './runtime-v22g/effect-rule-master.part01',
      './runtime-v22g/p2/p01','./runtime-v22g/p2/p02','./runtime-v22g/p2/p03','./runtime-v22g/p2/p04',
      './runtime-v22g/p2/p05','./runtime-v22g/p2/p06','./runtime-v22g/p2/p07','./runtime-v22g/p2/p08',
      './runtime/effect-rule-master.json.gz.b64.part03','./runtime/effect-rule-master.json.gz.b64.part04'
    ],
    './data/effect-base-master.json':[
      './runtime-v22i/effect-base.part01'
    ]
  };

  window.fetch=async function(input,init){
    const raw=typeof input==='string'?input:input?.url;
    const u=new URL(raw,location.href);
    const base=new URL('./',location.href);
    const rel='./'+u.pathname.slice(base.pathname.length);
    if(rel==='./data/relic-struct.json')return new Response(RELIC_STRUCT_JSON,{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}});
    const parts=packed[rel];
    if(!parts)return originalFetch(input,init);
    const text=await loadParts(parts,rel);
    return new Response(text,{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}});
  };

  let code=await loadParts([
    './runtime-v22c/app.js.gz.b64.part01',
    './runtime-v22c/app.js.gz.b64.part01b',
    './runtime-v22b/app.js.gz.b64.part02',
    './runtime-v22b/app.js.gz.b64.part03'
  ],'app.js');
  code=code.replace(/\u0000/g,'\\0');
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  const script=document.createElement('script');
  script.src=url;
  script.onload=()=>URL.revokeObjectURL(url);
  script.onerror=()=>{URL.revokeObjectURL(url);throw new Error('app.js の起動に失敗しました。');};
  document.head.appendChild(script);
})().catch(err=>{
  console.error(err);
  document.body.innerHTML=`<main style="max-width:900px;margin:80px auto;padding:24px;font-family:sans-serif"><h1>起動に失敗しました</h1><p>${String(err?.message||err)}</p><p>GitHub Pages 上でこの表示が出た場合は、そのエラー文をそのまま共有してください。</p></main>`;
});