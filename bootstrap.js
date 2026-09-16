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

  const structRes=await originalFetch('./data/relic-struct.json',{cache:'no-store'});
  if(!structRes.ok)throw new Error(`relic-struct.json 読込失敗 (${structRes.status})`);
  const struct=await structRes.json();
  if(!struct.r||!Object.keys(struct.r).length||Object.values(struct.r).some(v=>!Array.isArray(v)||v.length!==2||!Number.isInteger(v[0])||v[0]<0||v[0]>3||(v[1]!==0&&v[1]!==1)))throw new Error('遺物の色・通常／深層マスタが不正です。');
  const RELIC_STRUCT_JSON=JSON.stringify(struct);

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
    './data/effect-rule-master.json':['./runtime-v23f/effect-rule-master.json.gz.b64'],
    './data/effect-base-master.json':['./runtime-v23g/effect-base-master.json.gz.b64']
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
    './runtime-v23h/app.js.gz.b64'
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
