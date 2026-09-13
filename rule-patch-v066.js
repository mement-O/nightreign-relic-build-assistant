'use strict';
(()=>{
  const corrections={
    'name:ＨＰ低下時、カット率上昇':{ruleType:'ADDITIVE',uiMode:'COUNT',theoreticalMax:6},
    'name:ＨＰ低下時、周囲の味方を含めＨＰをゆっくりと回復':{ruleType:'NON_STACKING',uiMode:'SINGLE',theoreticalMax:1},
    'name:被ダメージ時、腐敗の状態異常を付加':{ruleType:'SPECIAL',uiMode:'SINGLE',theoreticalMax:1},
    'name:カット率低下時、稀に敵から受ける攻撃を無効化':{ruleType:'SPECIAL',uiMode:'SINGLE',theoreticalMax:1}
  };
  function applyPatch(text){
    const data=JSON.parse(text);
    const effects=Array.isArray(data)?data:data.effects;
    if(!Array.isArray(effects))return text;
    for(const effect of effects){
      const fix=corrections[effect.masterKey];
      if(fix)Object.assign(effect,fix);
      const d=window.NR_GAME_FILTER_MASTER?.classify(effect);
      if(d){
        effect.category=d.category;
        effect.displayOrder=d.sortOrder;
        effect.gameMajor=d.major;
        effect.gameGroup=d.group;
        effect.gameItemOrder=d.itemOrder;
        effect.gameSubOrder=d.subOrder;
      }
    }
    if(!Array.isArray(data))data.version='0.6.6-game-filter';
    return JSON.stringify(data);
  }
  function isRuleMaster(input){
    try{
      const raw=typeof input==='string'?input:input?.url;
      return new URL(raw,location.href).pathname.endsWith('/data/effect-rule-master.json');
    }catch{return false;}
  }
  function wrap(fn){
    return async function(input,init){
      const res=await fn(input,init);
      if(!isRuleMaster(input)||!res?.ok)return res;
      const text=await res.text();
      return new Response(applyPatch(text),{status:res.status,statusText:res.statusText,headers:{'Content-Type':'application/json; charset=utf-8'}});
    };
  }
  let current=wrap(window.fetch.bind(window));
  Object.defineProperty(window,'fetch',{configurable:true,get(){return current;},set(fn){current=wrap(fn.bind(window));}});
})();