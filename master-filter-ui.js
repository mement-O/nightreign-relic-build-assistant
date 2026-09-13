'use strict';
(async()=>{
  const master=window.NR_GAME_FILTER_MASTER;
  if(!master)return;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let busy=false;
  let ignoreSelection={mode:'all',major:null,group:null,category:'all'};
  const labelIndex=new Map();
  const WEAPONS=['短剣','直剣','大剣','特大剣','刺剣','重刺剣','曲剣','大曲剣','刀','両刃剣','斧','大斧','槌','フレイル','大槌','特大武器','槍','大槍','斧槍','鎌','鞭','拳','爪','弓','大弓','クロスボウ','バリスタ','小盾','中盾','大盾','松明','杖','聖印'];
  const MAP_ITEMS=['埋もれ宝の位置を地図に表示','出撃中、ショップでの購入に必要なルーンが割引','出撃中、ショップでの購入に必要なルーンが大割引'];
  const CRYSTAL_WORDS=['結晶雫','硬雫','割れ雫','泡雫','秘雫'];

  function normalizeLabel(s){
    return String(s||'').normalize('NFKC')
      .replace(/HP/g,'ＨＰ').replace(/FP/g,'ＦＰ')
      .replace(/\n?※適用可能な武器種のみ/g,'')
      .replace(/[（(](?:通常|深層|全ランク)[）)]/g,'')
      .replace(/\s+/g,'').trim();
  }
  function effectDisplay(effect){return effect.displayNameJa||effect.displayName||effect.name||String(effect.masterKey||'').replace(/^name:/,'');}
  function directEntryForLabel(label){
    const n=normalizeLabel(label);
    for(let i=0;i<MAP_ITEMS.length;i++)if(n===normalizeLabel(MAP_ITEMS[i]))return {major:'全般',group:'マップ環境',category:'map_environment',sortOrder:120000+i*100};
    const cm=String(label||'').match(/【([^】]+)】/);
    if(cm)return {major:'特定キャラクターのみ',group:cm[1],category:'character_special',sortOrder:200000};
    const ordered=[...WEAPONS].sort((a,b)=>b.length-a.length);
    for(const w of ordered){
      const wn=normalizeLabel(w);
      let kind=-1;
      if(n.startsWith(wn+'の攻撃力上昇'))kind=0;
      else if(n.startsWith(wn+'の攻撃でＨＰ回復'))kind=1;
      else if(n.startsWith(wn+'の攻撃でＦＰ回復'))kind=2;
      else if(n.startsWith(wn+'の武器種を3つ以上装備していると'))kind=3;
      else if(n.includes(normalizeLabel('潜在する力から、'+w+'を見つけやすくなる')))kind=4;
      if(kind>=0){
        const wi=WEAPONS.indexOf(w), rank=Number((n.match(/\+(\d+)$/)||[])[1]||0);
        return {major:'特定武器のみ',group:w,category:'weapon',sortOrder:300000+wi*1000+kind*100+rank};
      }
    }
    return null;
  }
  function putIndex(entry){
    const n=normalizeLabel(entry.displayNameJa||'');
    if(!n)return;
    if(!labelIndex.has(n))labelIndex.set(n,[]);
    labelIndex.get(n).push(entry);
  }
  async function loadFormalIndex(){
    for(let attempt=0;attempt<40;attempt++){
      try{
        const res=await fetch('./data/effect-rule-master.json',{cache:'no-store'});
        if(res.ok){
          const data=await res.json();
          const effects=Array.isArray(data)?data:data.effects;
          for(const effect of effects||[]){
            let d=null;
            if(effect.gameMajor&&effect.gameGroup){
              d={major:effect.gameMajor,group:effect.gameGroup,category:effect.category,sortOrder:effect.displayOrder,itemOrder:effect.gameItemOrder,subOrder:effect.gameSubOrder};
            }else d=master.classify?.(effect)||directEntryForLabel(effectDisplay(effect));
            if(!d)continue;
            putIndex({...d,masterKey:effect.masterKey,displayNameJa:effectDisplay(effect)});
          }
          return;
        }
      }catch{}
      await new Promise(r=>setTimeout(r,100));
    }
    console.warn('game filter master UI: formal master index unavailable; using label fallback');
  }
  await loadFormalIndex();

  function entryForLabel(label){
    const n=normalizeLabel(label);
    const hit=labelIndex.get(n);
    if(hit?.length)return hit[0];
    const direct=directEntryForLabel(label);
    if(direct)return direct;
    let best=null,bestLen=-1;
    for(const [k,arr] of labelIndex){
      if((n.startsWith(k)||k.startsWith(n))&&k.length>bestLen){best=arr[0];bestLen=k.length;}
    }
    return best;
  }
  function labelOfSim(node){return $('.sim-effect-label',node)?.textContent||node.textContent||'';}
  function labelOfIgnore(node){return $('label',node)?.textContent||node.textContent||'';}
  function key(e){return e?.sortOrder??Number.MAX_SAFE_INTEGER;}

  function applySimulatorHierarchy(){
    const root=$('#simEffectCategories');
    if(!root||busy)return;
    const effects=$$('.sim-effect',root);
    if(!effects.length)return;
    busy=true;
    try{
      $$('.master-major-heading,.master-subgroup-heading',root).forEach(n=>n.remove());
      const categories=$$('.sim-category',root);
      for(const section of categories){
        const grid=$('.sim-effect-grid',section);if(!grid)continue;
        const nodes=$$('.sim-effect',grid);
        nodes.sort((a,b)=>key(entryForLabel(labelOfSim(a)))-key(entryForLabel(labelOfSim(b))));
        nodes.forEach(n=>grid.appendChild(n));
        const mapped=nodes.map(node=>({node,e:entryForLabel(labelOfSim(node))})).filter(x=>x.e);
        let last=null;
        for(const {node,e} of mapped){
          if(e.group!==last){const h=document.createElement('div');h.className='master-subgroup-heading';h.textContent=e.group;grid.insertBefore(h,node);last=e.group;}
        }
      }
      categories.sort((a,b)=>key(entryForLabel(labelOfSim($('.sim-effect',a))))-key(entryForLabel(labelOfSim($('.sim-effect',b)))));
      categories.forEach(s=>root.appendChild(s));
      let lastMajor=null;
      for(const section of categories){
        const first=$('.sim-effect',section),e=first&&entryForLabel(labelOfSim(first));
        if(e&&e.major!==lastMajor){const h=document.createElement('div');h.className='master-major-heading';h.textContent=e.major;root.insertBefore(h,section);lastMajor=e.major;}
      }
    }finally{busy=false;}
  }

  function originalCategoryButton(category){try{return $(`#ignoreCategoryTabs [data-ignore-category="${CSS.escape(category)}"]`);}catch{return null;}}
  function setActiveMasterButton(btn){$$('.master-filter-btn').forEach(b=>b.classList.toggle('active',b===btn));}
  function createIgnoreHierarchy(){
    const old=$('#ignoreCategoryTabs');if(!old||$('#masterIgnoreHierarchy'))return;
    old.classList.add('master-original-tabs');
    const nav=document.createElement('div');nav.id='masterIgnoreHierarchy';nav.className='master-ignore-hierarchy';
    const all=document.createElement('button');all.type='button';all.className='category-btn master-filter-btn active';all.textContent='すべて';
    all.addEventListener('click',()=>{ignoreSelection={mode:'all',major:null,group:null,category:'all'};originalCategoryButton('all')?.click();setActiveMasterButton(all);setTimeout(applyIgnoreList,0);});nav.appendChild(all);
    for(const major of master.hierarchy){
      const block=document.createElement('section');block.className='master-filter-major';
      const title=document.createElement('div');title.className='master-filter-major-title';title.textContent=major.label;block.appendChild(title);
      const row=document.createElement('div');row.className='master-filter-group-row';
      for(const group of major.groups){
        const btn=document.createElement('button');btn.type='button';btn.className='category-btn master-filter-btn';btn.textContent=group.label;
        btn.addEventListener('click',()=>{ignoreSelection={mode:'group',major:major.label,group:group.label,category:group.category};originalCategoryButton(group.category)?.click();setActiveMasterButton(btn);setTimeout(applyIgnoreList,0);});row.appendChild(btn);
      }
      block.appendChild(row);nav.appendChild(block);
    }
    old.before(nav);
  }

  function fallbackBelongs(label){
    if(ignoreSelection.mode==='all')return true;
    const n=normalizeLabel(label), major=ignoreSelection.major, group=ignoreSelection.group;
    if(major==='特定キャラクターのみ')return n.includes(normalizeLabel('【'+group+'】'));
    if(major==='特定武器のみ')return directEntryForLabel(label)?.group===group;
    if(major==='全般'&&group==='出撃時のアイテム（結晶の雫）')return CRYSTAL_WORDS.some(w=>n.includes(normalizeLabel(w)));
    if(major==='全般'&&group==='出撃時のアイテム')return !CRYSTAL_WORDS.some(w=>n.includes(normalizeLabel(w)));
    return true;
  }
  function applyIgnoreList(){
    const list=$('#ignoreEffectList');if(!list||busy)return;
    const options=$$('.effect-option',list);if(!options.length)return;
    busy=true;
    try{
      const items=options.map(node=>({node,label:labelOfIgnore(node),e:entryForLabel(labelOfIgnore(node))}));
      items.sort((a,b)=>key(a.e)-key(b.e));
      for(const {node,label,e} of items){
        let show=true;
        if(ignoreSelection.mode==='group')show=e?(e.major===ignoreSelection.major&&e.group===ignoreSelection.group):fallbackBelongs(label);
        node.style.display=show?'':'none';list.appendChild(node);
      }
      for(const child of [...list.children])if(!child.classList.contains('effect-option')&&!child.classList.contains('master-ignore-empty'))child.style.display=ignoreSelection.mode==='all'?'':'none';
      let empty=$('.master-ignore-empty',list);const visible=items.some(x=>x.node.style.display!=='none');
      if(!visible){if(!empty){empty=document.createElement('div');empty.className='master-ignore-empty muted';empty.textContent='この分類に表示できる効果はありません。';list.appendChild(empty);}empty.style.display='';}else if(empty)empty.style.display='none';
    }finally{busy=false;}
  }

  function bind(){
    createIgnoreHierarchy();applySimulatorHierarchy();applyIgnoreList();
    const sim=$('#simEffectCategories');if(sim)new MutationObserver(()=>{if(!busy)requestAnimationFrame(applySimulatorHierarchy)}).observe(sim,{childList:true,subtree:true});
    const ignore=$('#ignoreEffectList');if(ignore)new MutationObserver(()=>{if(!busy)requestAnimationFrame(applyIgnoreList)}).observe(ignore,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})().catch(err=>console.error('master-filter-ui',err));