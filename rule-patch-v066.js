'use strict';
(()=>{
  const corrections={
    'name:ＨＰ低下時、カット率上昇':{ruleType:'ADDITIVE',uiMode:'COUNT',theoreticalMax:6},
    'name:ＨＰ低下時、周囲の味方を含めＨＰをゆっくりと回復':{ruleType:'NON_STACKING',uiMode:'SINGLE',theoreticalMax:1},
    'name:被ダメージ時、腐敗の状態異常を付加':{ruleType:'SPECIAL',uiMode:'SINGLE',theoreticalMax:1},
    'name:カット率低下時、稀に敵から受ける攻撃を無効化':{ruleType:'SPECIAL',uiMode:'SINGLE',theoreticalMax:1}
  };
  const WEAPONS=['短剣','直剣','大剣','特大剣','刺剣','重刺剣','曲剣','大曲剣','刀','両刃剣','斧','大斧','槌','フレイル','大槌','特大武器','槍','大槍','斧槍','鎌','鞭','拳','爪','弓','大弓','クロスボウ','バリスタ','小盾','中盾','大盾','松明','杖','聖印'];
  const MAP_ITEMS=['埋もれ宝の位置を地図に表示','出撃中、ショップでの購入に必要なルーンが割引','出撃中、ショップでの購入に必要なルーンが大割引'];
  const CHARS=['追跡者','守護者','鉄の目','レディ','無頼漢','復讐者','隠者','執行者','学者','葬儀屋'];

  function norm(s){return String(s||'').normalize('NFKC').replace(/HP/g,'ＨＰ').replace(/FP/g,'ＦＰ').replace(/\s+/g,'').replace(/\n?※適用可能な武器種のみ/g,'');}
  function effectName(effect){return effect.displayNameJa||effect.displayName||effect.name||String(effect.masterKey||'').replace(/^name:/,'');}
  function directClassify(effect){
    const raw=effectName(effect), n=norm(raw);

    for(let i=0;i<MAP_ITEMS.length;i++){
      if(n===norm(MAP_ITEMS[i]))return {major:'全般',group:'マップ環境',category:'map_environment',itemOrder:i,subOrder:0,sortOrder:120000+i*100};
    }

    const cm=raw.match(/^【([^】]+)】/);
    if(cm&&CHARS.includes(cm[1])){
      const ci=CHARS.indexOf(cm[1]);
      return {major:'特定キャラクターのみ',group:cm[1],category:'character_special',itemOrder:0,subOrder:0,sortOrder:200000+ci*1000};
    }

    const ordered=[...WEAPONS].sort((a,b)=>b.length-a.length);
    for(const w of ordered){
      const wn=norm(w);
      let kind=-1;
      if(n.startsWith(wn+'の攻撃力上昇'))kind=0;
      else if(n.startsWith(wn+'の攻撃でＨＰ回復'))kind=1;
      else if(n.startsWith(wn+'の攻撃でＦＰ回復'))kind=2;
      else if(n.startsWith(wn+'の武器種を3つ以上装備していると'))kind=3;
      else if(n.includes(norm('潜在する力から、'+w+'を見つけやすくなる')))kind=4;
      if(kind>=0){
        const wi=WEAPONS.indexOf(w);
        const rank=Number((n.match(/\+(\d+)$/)||[])[1]||0);
        return {major:'特定武器のみ',group:w,category:'weapon',itemOrder:kind,subOrder:rank,sortOrder:300000+wi*1000+kind*100+rank};
      }
    }
    return null;
  }

  function applyPatch(text){
    const data=JSON.parse(text);
    const effects=Array.isArray(data)?data:data.effects;
    if(!Array.isArray(effects))return text;
    for(const effect of effects){
      const fix=corrections[effect.masterKey];
      if(fix)Object.assign(effect,fix);
      const d=directClassify(effect)||window.NR_GAME_FILTER_MASTER?.classify(effect);
      if(d){
        effect.category=d.category;
        effect.displayOrder=d.sortOrder;
        effect.gameMajor=d.major;
        effect.gameGroup=d.group;
        effect.gameItemOrder=d.itemOrder;
        effect.gameSubOrder=d.subOrder;
      }
    }
    if(!Array.isArray(data))data.version='0.6.7-game-filter';
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