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
      let part=(await res.text()).trim();
      if(path.endsWith('.rev')) part=part.split('').reverse().join('');
      b64+=part;
    }
    b64=b64.replace(/\s+/g,'');
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
      s.src='./relic-struct-generator.js?v=22j';
      s.onload=resolve;
      s.onerror=()=>reject(new Error('relic-struct-generator.js の読込に失敗しました。'));
      document.head.appendChild(s);
    });
  }
  if(typeof window.buildRelicStruct!=='function')throw new Error('relic-struct-generator.js の初期化に失敗しました。');
  const RELIC_STRUCT_JSON=JSON.stringify(await window.buildRelicStruct());

  const v063Maxima={
    'name:最大ＨＰ上昇#normal':1,
    'name:最大ＦＰ上昇#normal':1,
    'name:最大スタミナ上昇#normal':1,
    'name:近接攻撃力上昇':2,
    'name:戦技攻撃力上昇':2,
    'name:攻撃連続時、攻撃力上昇':1,
    'name:致命の一撃強化+1':1,
    'name:武器の持ち替え時、物理攻撃力上昇':1,
    'name:属性攻撃力が付加された時、属性攻撃力上昇':3,
    'name:状態異常ゲージがある時、徐々に攻撃力上昇':1,
    'name:魔術／祈祷、効果時間延長':1,
    'group:improvedPhysicalDamageNegation#normal':1,
    'name:ＨＰ持続回復':2,
    'name:周囲で腐敗状態の発生時、ＨＰ持続回復':1,
    'name:ＦＰ持続回復':1,
    'name:攻撃連続時、ＦＰ回復':2,
    'name:発狂状態になると、ＦＰ持続回復':2,
    'name:攻撃命中時、スタミナ回復+1':1,
    'name:武器の持ち替え時、いずれかの属性攻撃力を付加':1,
    'name:被ダメージ時、腐敗の状態異常を付加':1,
    'name:ジェスチャー「あぐら」により、発狂が蓄積':2,
    'name:カット率低下時、稀に敵から受ける攻撃を無効化':1,
    'name:周囲で毒／腐敗状態の発生時、攻撃力上昇':1,
    'name:周囲で凍傷状態の発生時、自身の姿を隠す':1,
    'name:出撃中、ショップでの購入に必要なルーンが大割引':1
  };

  function applyV063RulePatch(text){
    const data=JSON.parse(text);
    const effects=Array.isArray(data)?data:data.effects;
    if(!Array.isArray(effects))throw new Error('effect-rule-master の形式が不正です。');
    for(const effect of effects){
      if(Object.prototype.hasOwnProperty.call(v063Maxima,effect.masterKey)){
        effect.theoreticalMax=v063Maxima[effect.masterKey];
      }
    }
    if(!Array.isArray(data))data.version='0.6.3';
    return JSON.stringify(data);
  }

  const packed={
    './data/effect-rule-master.json':[
      './runtime-v22g/effect-rule-master.part01',
      './runtime-v22g/p2/p01','./runtime-v22g/p2/p02','./runtime-v22g/p2/p03','./runtime-v22g/p2/p04',
      './runtime-v22g/p2/p05','./runtime-v22g/p2/p06','./runtime-v22g/p2/p07','./runtime-v22g/p2/p08',
      './runtime/effect-rule-master.json.gz.b64.part03','./runtime/effect-rule-master.json.gz.b64.part04'
    ],
    './data/effect-base-master.json':[
      './runtime-v22c/base4000.part01',
      './runtime-v22j/base2/p01','./runtime-v22j/base2/p02','./runtime-v22j/base2/p03','./runtime-v22j/base2/p04.rev',
      './runtime-v22c/base4000.part03','./runtime-v22c/base4000.part04','./runtime-v22c/base4000.part05','./runtime-v22c/base4000.part06'
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
    let text=await loadParts(parts,rel);
    if(rel==='./data/effect-rule-master.json')text=applyV063RulePatch(text);
    return new Response(text,{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}});
  };

  let code=await loadParts([
    './runtime-v23b/app.js.gz.b64'
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
