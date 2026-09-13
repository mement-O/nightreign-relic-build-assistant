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
  function simLabel(n){return $('.sim-effect-label',n)?.textContent||n.textContent||''}
  function ignoreLabel(n){return $('label',n)?.textContent||n.textContent||''}
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
    const texts=[active?.textContent,$('#simHeroIgnoreBtn')?.textContent].filter(Boolean).join(' ');
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
