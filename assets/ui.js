// game-filter-master.js (v23h source)
/* Game filter hierarchy derived from the in-game filter screens. */
'use strict';
window.NR_GAME_FILTER_MASTER=(()=>{
  const MAJORS=['全般','特定キャラクターのみ','特定武器のみ','デメリット'];
  const CHARS=['追跡者','守護者','鉄の目','レディ','無頼漢','復讐者','隠者','執行者','学者','葬儀屋'];
  const WEAPONS=['短剣','直剣','大剣','特大剣','刺剣','重刺剣','曲剣','大曲剣','刀','両刃剣','斧','大斧','槌','フレイル','大槌','特大武器','槍','大槍','斧槍','鎌','鞭','拳','爪','弓','大弓','クロスボウ','バリスタ','小盾','中盾','大盾','松明','杖','聖印'];

  const GENERAL={
    '能力値':['最大ＨＰ上昇','最大ＦＰ上昇','最大スタミナ上昇','生命力','精神力','持久力','筋力','技量','知力','信仰','神秘','強靭度','魔術師塔の仕掛けが解除される度、最大ＦＰ上昇','小砦の強敵を倒す度、取得ルーン増加、発見力上昇','大教会の強敵を倒す度、最大ＨＰ上昇','大野営地の強敵を倒す度、最大スタミナ上昇','遺跡の強敵を倒す度、神秘上昇'],
    '攻撃力':['物理攻撃力上昇','属性攻撃力上昇','魔力攻撃力上昇','炎攻撃力上昇','雷攻撃力上昇','聖攻撃力上昇','近接攻撃力上昇','戦技攻撃力上昇','通常攻撃の１段目強化','攻撃連続時、攻撃力上昇','致命の一撃強化','魔術強化','祈祷強化','咆哮とブレス強化','両手持ちの、体勢を崩す力上昇','二刀持ちの、体勢を崩す力上昇','武器の持ち替え時、物理攻撃力上昇','属性攻撃力が付加された時、属性攻撃力上昇','攻撃を受けると攻撃力上昇','状態異常ゲージがある時、徐々に攻撃力上昇','封牢の囚を倒す度、攻撃力上昇','夜の侵入者を倒す度、攻撃力上昇','ガードカウンター強化','ガードカウンターに、自身の現在ＨＰの一部を加える','脂アイテム使用時、追加で物理攻撃力上昇','投擲壺の攻撃力上昇','投擲ナイフの攻撃力上昇','輝石、重力石アイテムの攻撃力上昇','調香術強化'],
    'スキル／アーツ':['スキルクールタイム軽減','アーツゲージ自然蓄積','敵を倒した時、アーツゲージ増加','致命の一撃で、アーツゲージ増加','ガード成功時、アーツゲージ増加'],
    '魔術／祈祷':['魔術／祈祷、効果時間延長','輝剣の魔術を強化','石掘りの魔術を強化','カーリアの剣の魔術を強化','不可視の魔術を強化','結晶人の魔術を強化','重力の魔術を強化','茨の魔術を強化','黄金律原理主義の祈祷を強化','王都古竜信仰の祈祷を強化','巨人の火の祈祷を強化','神狩りの祈祷を強化','獣の祈祷を強化','狂い火の祈祷を強化','竜餐の祈祷を強化'],
    'カット率':['物理カット率上昇','属性カット率上昇','魔力カット率上昇','炎カット率上昇','雷カット率上昇','聖カット率上昇','ＨＰ低下時、カット率上昇','ダメージで吹き飛ばされた時、強靭度とカット率上昇'],
    '状態異常耐性':['毒耐性上昇','腐敗耐性上昇','出血耐性上昇','冷気耐性上昇','睡眠耐性上昇','発狂耐性上昇','抗死耐性上昇'],
    '回復':['ＨＰ持続回復','ＨＰ低下時、周囲の味方を含めＨＰをゆっくりと回復','ガード成功時、ＨＰ回復','刺突カウンター発生時、ＨＰ回復','ダメージを受けた直後、攻撃によりＨＰの一部を回復','苔薬などのアイテム使用でＨＰ回復','周囲で腐敗状態の発生時、ＨＰ持続回復','聖杯瓶の回復量上昇','消費ＦＰ軽減','ＦＰ持続回復','攻撃連続時、ＦＰ回復','発狂状態になると、ＦＰ持続回復','攻撃命中時、スタミナ回復','致命の一撃で、スタミナ回復速度上昇'],
    'アクション':['致命の一撃で、ルーンを取得','武器の持ち替え時、いずれかの属性攻撃力を付加','被ダメージ時、腐敗の状態異常を付加','ガード中、敵に狙われやすくなる','ジェスチャー「あぐら」により、発狂が蓄積','カット率低下時、稀に敵から受ける攻撃を無効化','毒状態の敵に対する攻撃を強化','腐敗状態の敵に対する攻撃を強化','凍傷状態の敵に対する攻撃を強化','周囲で毒／腐敗状態の発生時、攻撃力上昇','周囲で凍傷状態の発生時、自身の姿を隠す','周囲で睡眠状態の発生時、攻撃力上昇','周囲で発狂状態の発生時、攻撃力上昇'],
    '出撃時の武器（戦技）':['我慢','クイックステップ','嵐脚','デターミネーション','輝剣の円陣','グラビタス','炎撃','溶岩噴火','落雷','雷撃斬','聖なる刃','祈りの一撃','毒の霧','毒蛾は二度舞う','血の刃','切腹','冷気の霧','霜踏み','白い影の誘い','アローレイン'],
    '出撃時の武器（付加）':['魔力攻撃力','炎攻撃力','雷攻撃力','聖攻撃力','毒の状態異常','出血の状態異常','冷気の状態異常'],
    '出撃時の武器（魔術／祈祷）':['魔術の輝剣','カーリアの大剣','夜のつぶて','溶岩弾','罰の茨','黄金の怒り','雷の槍','火よ！','獣爪','竜炎'],
    '出撃時のアイテム':['星光の欠片','火炎壺','魔力壺','雷壺','聖水壺','骨の毒投げ矢','結晶投げ矢','スローイングダガー','屑輝石','塊の重力石','誘惑の枝','火花の香り','毒の噴霧','鉄壺の香薬','高揚の香り','酸の噴霧','狂熱の香薬','呪霊喚びの鈴','火脂','魔力脂','雷脂','聖脂','盾脂','小さなポーチ','石剣の鍵'],
    '出撃時のアイテム（結晶の雫）':['緋色の結晶雫','緋溢れの結晶雫','緋湧きの結晶雫','青色の結晶雫','緑溢れの結晶雫','緑湧きの結晶雫','真珠色の硬雫','斑彩色の硬雫','鉛色の硬雫','魔力纏いの割れ雫','炎纏いの割れ雫','雷纏いの割れ雫','聖纏いの割れ雫','岩棘の割れ雫','大棘の割れ雫','連棘の割れ雫','細枝の割れ雫','風の結晶雫','緋色の泡雫','緋色渦の泡雫','真珠色の泡雫','青色の秘雫','破裂した結晶雫'],
    'マップ環境':['埋もれ宝の位置を地図に表示','出撃中、ショップでの購入に必要なルーンが割引','出撃中、ショップでの購入に必要なルーンが大割引'],
    'チームメンバー':['自身と味方の取得ルーン増加','自身を除く、周囲の味方のスタミナ回復速度上昇','聖杯瓶の回復を、周囲の味方に分配','敵を倒した時、自身を除く周囲の味方のＨＰを回復','アイテムの効果が周囲の味方にも発動']
  };
  const DEMERIT={
    'デメリット（能力値）':['生命力と神秘が低下','筋力と知力が低下','技量と信仰が低下','知力と技量が低下','信仰と筋力が低下','取得ルーン減少'],
    'デメリット（カット率）':['ＨＰ持続減少','すべての状態異常耐性低下','聖杯瓶使用時、カット率低下','回避直後、カット率低下','回避連続時、カット率低下','被ダメージ時、毒を蓄積','被ダメージ時、腐敗を蓄積','被ダメージ時、出血を蓄積','被ダメージ時、冷気を蓄積','被ダメージ時、睡眠を蓄積','被ダメージ時、発狂を蓄積','被ダメージ時、死を蓄積'],
    'デメリット（アクション）':['聖杯瓶の回復量低下','アーツゲージ蓄積鈍化','ＨＰ最大未満時、攻撃力低下','ＨＰ最大未満時、毒が蓄積','ＨＰ最大未満時、腐敗が蓄積','瀕死時、最大ＨＰ低下']
  };
  const CATEGORY={'能力値':'status','攻撃力':'attack','スキル／アーツ':'skill_arts','魔術／祈祷':'magic','カット率':'defense','状態異常耐性':'resist','回復':'heal','アクション':'action','出撃時の武器（戦技）':'starting_weapon','出撃時の武器（付加）':'starting_enchant','出撃時の武器（魔術／祈祷）':'starting_magic','出撃時のアイテム':'starting_item','出撃時のアイテム（結晶の雫）':'starting_item','マップ環境':'map_environment','チームメンバー':'team','デメリット（能力値）':'demerit_status','デメリット（カット率）':'demerit_defense','デメリット（アクション）':'demerit_action'};
  const hierarchy=[{label:'全般',groups:Object.keys(GENERAL).map(label=>({label,category:CATEGORY[label]}))},{label:'特定キャラクターのみ',groups:CHARS.map(label=>({label,category:'character_special'}))},{label:'特定武器のみ',groups:WEAPONS.map(label=>({label,category:'weapon'}))},{label:'デメリット',groups:Object.keys(DEMERIT).map(label=>({label,category:CATEGORY[label]}))}];
  function norm(s){return String(s||'').normalize('NFKC').replace(/HP/g,'ＨＰ').replace(/FP/g,'ＦＰ').replace(/\n?※適用可能な武器種のみ/g,'').replace(/\s+/g,'');}
  function base(s){return norm(s).replace(/\+\d+$/,'');}
  const exact=new Map();
  for(const [g,names] of Object.entries(GENERAL))names.forEach((name,i)=>exact.set(norm(name),{major:'全般',group:g,itemOrder:i+1,category:CATEGORY[g]}));
  for(const [g,names] of Object.entries(DEMERIT))names.forEach((name,i)=>exact.set(norm(name),{major:'デメリット',group:g,itemOrder:i+1,category:CATEGORY[g]}));
  const majorIndex=new Map(MAJORS.map((x,i)=>[x,i]));
  const groupIndex=new Map(); hierarchy.forEach(h=>h.groups.forEach((g,i)=>groupIndex.set(h.label+'\0'+g.label,i)));
  function classify(effect){
    const raw=String(effect?.displayNameJa||effect?.displayName||''), n=norm(raw), b=base(raw); let out=null;
    const cm=raw.match(/^【([^】]+)】/); let char=cm&&CHARS.includes(cm[1])?cm[1]:null; if(!char&&raw.includes('トーテム・ステラ'))char='無頼漢';
    if(char)out={major:'特定キャラクターのみ',group:char,category:'character_special',itemOrder:Number(effect.displayOrder)||999};
    if(!out){const weapon=[...WEAPONS].sort((a,b)=>b.length-a.length).find(w=>n.startsWith(norm(w)+'の')||n.includes(norm('潜在する力から、'+w+'を見つけやすくなる'))); if(weapon){let itemOrder=99;if(n.startsWith(norm(weapon+'の攻撃力上昇')))itemOrder=1;else if(n.startsWith(norm(weapon+'の攻撃でＨＰ回復')))itemOrder=2;else if(n.startsWith(norm(weapon+'の攻撃でＦＰ回復')))itemOrder=3;else if(n.includes('武器種を3つ以上装備していると'))itemOrder=['小盾','中盾','大盾','杖','聖印'].includes(weapon)?1:4;else if(n.includes('潜在する力から、'))itemOrder=['大弓','クロスボウ','バリスタ','松明'].includes(weapon)?1:(['小盾','中盾','大盾','杖','聖印'].includes(weapon)?2:5);out={major:'特定武器のみ',group:weapon,category:'weapon',itemOrder};}}
    if(!out)out=exact.get(b)||exact.get(n)||null;
    if(!out){if(n.startsWith('出撃時の武器の戦技を「')){const key=GENERAL['出撃時の武器（戦技）'].find(x=>n.includes(norm('「'+x+'」')));if(key)out={major:'全般',group:'出撃時の武器（戦技）',category:'starting_weapon',itemOrder:GENERAL['出撃時の武器（戦技）'].indexOf(key)+1};}else if(n.startsWith('出撃時の武器に')){const key=GENERAL['出撃時の武器（付加）'].find(x=>n.includes(norm(x)));if(key)out={major:'全般',group:'出撃時の武器（付加）',category:'starting_enchant',itemOrder:GENERAL['出撃時の武器（付加）'].indexOf(key)+1};}else if(n.startsWith('出撃時の武器の魔術を「')||n.startsWith('出撃時の武器の祈祷を「')){const key=GENERAL['出撃時の武器（魔術／祈祷）'].find(x=>n.includes(norm('「'+x+'」')));if(key)out={major:'全般',group:'出撃時の武器（魔術／祈祷）',category:'starting_magic',itemOrder:GENERAL['出撃時の武器（魔術／祈祷）'].indexOf(key)+1};}else if(n.startsWith('出撃時に「')){const crystal=GENERAL['出撃時のアイテム（結晶の雫）'].find(x=>n.includes(norm('「'+x+'」'))),item=GENERAL['出撃時のアイテム'].find(x=>n.includes(norm('「'+x+'」')));if(crystal)out={major:'全般',group:'出撃時のアイテム（結晶の雫）',category:'starting_item',itemOrder:GENERAL['出撃時のアイテム（結晶の雫）'].indexOf(crystal)+1};else if(item)out={major:'全般',group:'出撃時のアイテム',category:'starting_item',itemOrder:GENERAL['出撃時のアイテム'].indexOf(item)+1};}}
    if(!out)return null;
    const rank=Number((n.match(/\+(\d+)$/)||[])[1]||0);let subOrder=10+rank;if(String(effect?.masterKey||'').endsWith('#normal')||(effect?.normalAvailable===true&&effect?.deepAvailable===false))subOrder=rank;if(String(effect?.masterKey||'').endsWith('#deep')||(effect?.normalAvailable===false&&effect?.deepAvailable===true))subOrder=20+rank;
    const mi=majorIndex.get(out.major)??9,gi=groupIndex.get(out.major+'\0'+out.group)??999;return {...out,subOrder,sortOrder:mi*1000000+gi*10000+(out.itemOrder||999)*100+subOrder};
  }
  return {version:'2026-09-13.game-filter-v1',hierarchy,classify,norm};
})();

;
// master-filter-ui-v3.js (v23h source)
'use strict';
(async()=>{
  const master=window.NR_GAME_FILTER_MASTER;
  if(!master)return;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const CHARS=['追跡者','守護者','鉄の目','レディ','無頼漢','復讐者','隠者','執行者','学者','葬儀屋'];
  const WEAPONS=['短剣','直剣','大剣','特大剣','刺剣','重刺剣','曲剣','大曲剣','刀','両刃剣','斧','大斧','槌','フレイル','大槌','特大武器','槍','大槍','斧槍','鎌','鞭','拳','爪','弓','大弓','クロスボウ','バリスタ','小盾','中盾','大盾','松明','杖','聖印'];
  const MAP_ITEMS=['埋もれ宝の位置を地図に表示','出撃中、ショップでの購入に必要なルーンが割引','出撃中、ショップでの購入に必要なルーンが大割引'];
  const CRYSTAL_WORDS=['結晶雫','硬雫','割れ雫','泡雫','秘雫'];
  const labelIndex=new Map();
  let ignoreSelection={mode:'all',major:null,group:null,category:'all'};
  let simObserver=null,ignoreObserver=null,simApplying=false,ignoreApplying=false,simQueued=false,ignoreQueued=false;

  function norm(s){return String(s||'').normalize('NFKC').replace(/HP/g,'ＨＰ').replace(/FP/g,'ＦＰ').replace(/\n?※適用可能な武器種のみ/g,'').replace(/[（(](?:通常|深層|全ランク)[）)]/g,'').replace(/\s+/g,'').trim()}
  function effectDisplay(e){return e.displayNameJa||e.displayName||e.name||String(e.masterKey||'').replace(/^name:/,'')}
  function direct(label){
    const n=norm(label);
    for(let i=0;i<MAP_ITEMS.length;i++)if(n===norm(MAP_ITEMS[i]))return {major:'全般',group:'マップ環境',category:'map_environment',sortOrder:120000+i*100};
    const cm=String(label||'').match(/【([^】]+)】/);if(cm)return {major:'特定キャラクターのみ',group:cm[1],category:'character_special',sortOrder:200000+CHARS.indexOf(cm[1])*1000};
    for(const w of [...WEAPONS].sort((a,b)=>b.length-a.length)){
      const wn=norm(w);let kind=-1;
      if(n.startsWith(wn+'の攻撃力上昇'))kind=0;
      else if(n.startsWith(wn+'の攻撃でＨＰ回復'))kind=1;
      else if(n.startsWith(wn+'の攻撃でＦＰ回復'))kind=2;
      else if(n.startsWith(wn+'の武器種を3つ以上装備していると'))kind=3;
      else if(n.includes(norm('潜在する力から、'+w+'を見つけやすくなる')))kind=4;
      if(kind>=0){const rank=Number((n.match(/\+(\d+)$/)||[])[1]||0);return {major:'特定武器のみ',group:w,category:'weapon',sortOrder:300000+WEAPONS.indexOf(w)*1000+kind*100+rank}}
    }
    return null;
  }
  function put(e){const n=norm(e.displayNameJa||'');if(!n)return;if(!labelIndex.has(n))labelIndex.set(n,[]);labelIndex.get(n).push(e)}
  async function loadIndex(){
    for(let a=0;a<40;a++){
      try{const r=await fetch('./data/effect-rule-master.json',{cache:'no-store'});if(r.ok){const d=await r.json(),arr=Array.isArray(d)?d:d.effects;for(const ef of arr||[]){let x=ef.gameMajor&&ef.gameGroup?{major:ef.gameMajor,group:ef.gameGroup,category:ef.category,sortOrder:ef.displayOrder,itemOrder:ef.gameItemOrder,subOrder:ef.gameSubOrder}:master.classify?.(ef)||direct(effectDisplay(ef));if(x)put({...x,masterKey:ef.masterKey,displayNameJa:effectDisplay(ef)})}return}}catch{}
      await new Promise(r=>setTimeout(r,100));
    }
  }
  await loadIndex();
  function entry(label){const n=norm(label),hit=labelIndex.get(n);if(hit?.length)return hit[0];const d=direct(label);if(d)return d;let best=null,len=-1;for(const[k,a]of labelIndex){if((n.startsWith(k)||k.startsWith(n))&&k.length>len){best=a[0];len=k.length}}return best}
  function canonicalText(n){return window.NR_I18N?.sourceText(n)??n?.textContent??''}
  function simLabel(n){return canonicalText($('.sim-effect-label',n)||n)}
  function ignoreLabel(n){return canonicalText($('label',n)||n)}
  function key(e){return e?.sortOrder??Number.MAX_SAFE_INTEGER}
  function rankInfo(label){
    const n=norm(label);
    const m=n.match(/\+(\d+)$/);
    return {base:m?n.slice(0,m.index):n,rank:m?Number(m[1]):0,explicit:!!m};
  }
  function compareEffects(a,b,labelFn){
    const la=labelFn(a),lb=labelFn(b),ea=entry(la),eb=entry(lb);
    const pa=rankInfo(la),pb=rankInfo(lb);
    // Within one visible effect family always use base -> +1 -> +2 -> ... .
    // This overrides inconsistent internal Effect ID/displayOrder ordering only inside the family.
    if(pa.base===pb.base){
      if(pa.rank!==pb.rank)return pa.rank-pb.rank;
      if(pa.explicit!==pb.explicit)return pa.explicit?1:-1;
    }
    return key(ea)-key(eb);
  }
  function selectedHero(){
    const active=$('#simHeroList .hero-btn.active,#simHeroList button.active,#simHeroList [aria-pressed="true"]');
    const texts=[canonicalText(active),canonicalText($('#simHeroIgnoreBtn'))].filter(Boolean).join(' ');
    return CHARS.find(c=>texts.includes(c))||null;
  }
  function observeSim(){const r=$('#simEffectCategories');if(r&&simObserver)simObserver.observe(r,{childList:true,subtree:true})}
  function observeIgnore(){const r=$('#ignoreEffectList');if(r&&ignoreObserver)ignoreObserver.observe(r,{childList:true,subtree:true})}
  function qSim(){if(simQueued)return;simQueued=true;requestAnimationFrame(()=>{simQueued=false;applySim()})}
  function qIgnore(delay=0){if(delay){setTimeout(()=>qIgnore(),delay);return}if(ignoreQueued)return;ignoreQueued=true;requestAnimationFrame(()=>{ignoreQueued=false;applyIgnore()})}

  function unwrapWeaponRows(root){
    for(const row of $$('.master-weapon-row',root)){const p=row.parentNode;if(!p)continue;while(row.firstChild)p.insertBefore(row.firstChild,row);row.remove()}
  }
  function applySim(){
    const root=$('#simEffectCategories');if(!root||simApplying)return;const all=$$('.sim-effect',root);if(!all.length)return;
    simApplying=true;simObserver?.disconnect();
    try{
      unwrapWeaponRows(root);
      $$('.master-major-heading,.master-subgroup-heading',root).forEach(n=>n.remove());
      $$('.master-hide-category-title',root).forEach(n=>n.classList.remove('master-hide-category-title'));
      const hero=selectedHero();
      const categories=$$('.sim-category',root);
      for(const section of categories){
        const grid=$('.sim-effect-grid',section);if(!grid)continue;
        let nodes=$$('.sim-effect',grid);
        for(const node of nodes){const e=entry(simLabel(node));node.classList.toggle('master-hidden-character',!!(hero&&e?.major==='特定キャラクターのみ'&&e.group!==hero))}
        nodes=[...nodes].sort((a,b)=>compareEffects(a,b,simLabel));
        for(const n of nodes)grid.appendChild(n);
        const firstVisible=nodes.find(n=>!n.classList.contains('master-hidden-character'));
        const firstEntry=firstVisible&&entry(simLabel(firstVisible));
        if(firstEntry?.major==='特定武器のみ'){
          $('.sim-category-title',section)?.classList.add('master-hide-category-title');
          const groups=new Map();
          for(const node of nodes){const e=entry(simLabel(node));if(!e||e.major!=='特定武器のみ')continue;if(!groups.has(e.group))groups.set(e.group,[]);groups.get(e.group).push(node)}
          for(const w of WEAPONS){const members=groups.get(w);if(!members?.length)continue;const row=document.createElement('div');row.className='master-weapon-row';row.dataset.weapon=w;for(const n of members)row.appendChild(n);grid.appendChild(row)}
        }
      }
      const info=categories.map(s=>{const n=$$('.sim-effect',s).find(x=>!x.classList.contains('master-hidden-character'));return {s,e:n&&entry(simLabel(n))}});
      const sorted=[...info].sort((a,b)=>key(a.e)-key(b.e));for(const x of sorted)root.appendChild(x.s);
      let last=null;for(const {s,e} of sorted){if(e&&e.major!==last){const h=document.createElement('div');h.className='master-major-heading';h.textContent=e.major;root.insertBefore(h,s);last=e.major}}
    }finally{simApplying=false;observeSim()}
  }

  function oldBtn(cat){try{return $(`#ignoreCategoryTabs [data-ignore-category="${CSS.escape(cat)}"]`)}catch{return null}}
  function activeBtn(btn){$$('.master-filter-btn').forEach(b=>b.classList.toggle('active',b===btn))}
  function restoreAll(){const b=oldBtn('all');if(b&&!b.classList.contains('active'))b.click();qIgnore();qIgnore(50)}
  function createIgnoreNav(){
    const old=$('#ignoreCategoryTabs');if(!old||$('#masterIgnoreHierarchy'))return;old.classList.add('master-original-tabs');
    const nav=document.createElement('div');nav.id='masterIgnoreHierarchy';nav.className='master-ignore-hierarchy';
    const all=document.createElement('button');all.type='button';all.className='category-btn master-filter-btn active';all.textContent='すべて';all.onclick=()=>{ignoreSelection={mode:'all',major:null,group:null,category:'all'};activeBtn(all);restoreAll()};nav.appendChild(all);
    for(const major of master.hierarchy){const block=document.createElement('section');block.className='master-filter-major';const title=document.createElement('div');title.className='master-filter-major-title';title.textContent=major.label;block.appendChild(title);const row=document.createElement('div');row.className='master-filter-group-row';for(const g of major.groups){const b=document.createElement('button');b.type='button';b.className='category-btn master-filter-btn';b.textContent=g.label;b.onclick=()=>{ignoreSelection={mode:'group',major:major.label,group:g.label,category:g.category};activeBtn(b);restoreAll()};row.appendChild(b)}block.appendChild(row);nav.appendChild(block)}old.before(nav)
  }
  function fallback(label){if(ignoreSelection.mode==='all')return true;const n=norm(label),M=ignoreSelection.major,g=ignoreSelection.group;if(M==='特定キャラクターのみ')return n.includes(norm('【'+g+'】'));if(M==='特定武器のみ')return direct(label)?.group===g;if(M==='全般'&&g==='出撃時のアイテム（結晶の雫）')return CRYSTAL_WORDS.some(w=>n.includes(norm(w)));if(M==='全般'&&g==='出撃時のアイテム')return !CRYSTAL_WORDS.some(w=>n.includes(norm(w)));return true}
  function applyIgnore(){
    const list=$('#ignoreEffectList');if(!list||ignoreApplying)return;const opts=$$('.effect-option',list);if(!opts.length)return;ignoreApplying=true;ignoreObserver?.disconnect();
    try{const items=opts.map((node,i)=>({node,i,label:ignoreLabel(node),e:entry(ignoreLabel(node))}));const sorted=[...items].sort((a,b)=>compareEffects(a.node,b.node,ignoreLabel)||a.i-b.i);for(const x of sorted){let show=true;if(ignoreSelection.mode==='group')show=x.e?(x.e.major===ignoreSelection.major&&x.e.group===ignoreSelection.group):fallback(x.label);x.node.style.display=show?'':'none'}const cur=$$('.effect-option',list),want=sorted.map(x=>x.node);if(cur.some((n,i)=>n!==want[i]))for(const n of want)list.appendChild(n);for(const c of [...list.children])if(!c.classList.contains('effect-option')&&!c.classList.contains('master-ignore-empty'))c.style.display=ignoreSelection.mode==='all'?'':'none';let empty=$('.master-ignore-empty',list),vis=sorted.some(x=>x.node.style.display!=='none');if(!vis){if(!empty){empty=document.createElement('div');empty.className='master-ignore-empty muted';empty.textContent='この分類に表示できる効果はありません。';list.appendChild(empty)}empty.style.display=''}else if(empty)empty.style.display='none'}finally{ignoreApplying=false;observeIgnore()}
  }
  function bind(){createIgnoreNav();simObserver=new MutationObserver(()=>{if(!simApplying)qSim()});ignoreObserver=new MutationObserver(()=>{if(!ignoreApplying)qIgnore()});observeSim();observeIgnore();restoreAll();qSim();$('#simHeroList')?.addEventListener('click',()=>setTimeout(qSim,0),true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})().catch(e=>console.error('master-filter-ui-v3',e));
