'use strict';
(async()=>{
  const master=window.NR_GAME_FILTER_MASTER;
  if(!master)return;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let busy=false;
  let ignoreSelection={mode:'all',major:null,group:null,category:'all'};
  const labelIndex=new Map();

  function normalizeLabel(s){
    return String(s||'').normalize('NFKC')
      .replace(/HP/g,'ＨＰ').replace(/FP/g,'ＦＰ')
      .replace(/\n?※適用可能な武器種のみ/g,'')
      .replace(/[（(](?:通常|深層|全ランク)[）)]/g,'')
      .replace(/\s+/g,'').trim();
  }

  try{
    const res=await fetch('./data/effect-rule-master.json',{cache:'no-store'});
    if(res.ok){
      const data=await res.json();
      const effects=Array.isArray(data)?data:data.effects;
      for(const effect of effects||[]){
        const d=master.classify(effect);
        if(!d)continue;
        const entry={...d,masterKey:effect.masterKey,displayNameJa:effect.displayNameJa||effect.displayName||''};
        const n=normalizeLabel(entry.displayNameJa);
        if(!labelIndex.has(n))labelIndex.set(n,[]);
        labelIndex.get(n).push(entry);
      }
    }
  }catch(err){console.warn('game filter master UI: rule master read failed',err);}

  function entryForLabel(label){
    const n=normalizeLabel(label);
    const hit=labelIndex.get(n);
    if(hit?.length)return hit[0];
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
        const grid=$('.sim-effect-grid',section);
        if(!grid)continue;
        const nodes=$$('.sim-effect',grid);
        nodes.sort((a,b)=>key(entryForLabel(labelOfSim(a)))-key(entryForLabel(labelOfSim(b))));
        nodes.forEach(n=>grid.appendChild(n));
        const mapped=nodes.map(node=>({node,e:entryForLabel(labelOfSim(node))})).filter(x=>x.e);
        const groups=[...new Set(mapped.map(x=>x.e.group))];
        if(groups.length>1){
          let last=null;
          for(const {node,e} of mapped){
            if(e.group!==last){
              const h=document.createElement('div');
              h.className='master-subgroup-heading';
              h.textContent=e.group;
              grid.insertBefore(h,node);
              last=e.group;
            }
          }
        }
      }
      categories.sort((a,b)=>key(entryForLabel(labelOfSim($('.sim-effect',a))))-key(entryForLabel(labelOfSim($('.sim-effect',b)))));
      categories.forEach(s=>root.appendChild(s));
      let lastMajor=null;
      for(const section of categories){
        const first=$('.sim-effect',section);
        const e=first&&entryForLabel(labelOfSim(first));
        if(!e)continue;
        if(e.major!==lastMajor){
          const h=document.createElement('div');
          h.className='master-major-heading';
          h.textContent=e.major;
          root.insertBefore(h,section);
          lastMajor=e.major;
        }
      }
    }finally{busy=false;}
  }

  function originalCategoryButton(category){
    try{return $(`#ignoreCategoryTabs [data-ignore-category="${CSS.escape(category)}"]`);}
    catch{return null;}
  }
  function setActiveMasterButton(btn){$$('.master-filter-btn').forEach(b=>b.classList.toggle('active',b===btn));}

  function createIgnoreHierarchy(){
    const old=$('#ignoreCategoryTabs');
    if(!old||$('#masterIgnoreHierarchy'))return;
    old.classList.add('master-original-tabs');
    const nav=document.createElement('div');
    nav.id='masterIgnoreHierarchy';nav.className='master-ignore-hierarchy';

    const all=document.createElement('button');
    all.type='button';all.className='category-btn master-filter-btn active';all.textContent='すべて';
    all.addEventListener('click',()=>{
      ignoreSelection={mode:'all',major:null,group:null,category:'all'};
      originalCategoryButton('all')?.click();setActiveMasterButton(all);setTimeout(applyIgnoreList,0);
    });
    nav.appendChild(all);

    for(const major of master.hierarchy){
      const block=document.createElement('section');block.className='master-filter-major';
      const title=document.createElement('div');title.className='master-filter-major-title';title.textContent=major.label;block.appendChild(title);
      const row=document.createElement('div');row.className='master-filter-group-row';
      for(const group of major.groups){
        const btn=document.createElement('button');
        btn.type='button';btn.className='category-btn master-filter-btn';btn.textContent=group.label;
        btn.addEventListener('click',()=>{
          ignoreSelection={mode:'group',major:major.label,group:group.label,category:group.category};
          originalCategoryButton(group.category)?.click();setActiveMasterButton(btn);setTimeout(applyIgnoreList,0);
        });
        row.appendChild(btn);
      }
      block.appendChild(row);nav.appendChild(block);
    }
    old.before(nav);
  }

  function applyIgnoreList(){
    const list=$('#ignoreEffectList');
    if(!list||busy)return;
    const options=$$('.effect-option',list);
    if(!options.length)return;
    busy=true;
    try{
      const items=options.map(node=>({node,e:entryForLabel(labelOfIgnore(node))}));
      items.sort((a,b)=>key(a.e)-key(b.e));
      for(const {node,e} of items){
        const show=ignoreSelection.mode==='all'||(e&&e.major===ignoreSelection.major&&e.group===ignoreSelection.group);
        node.style.display=show?'':'none';
        list.appendChild(node);
      }
      for(const child of [...list.children]){
        if(child.classList.contains('effect-option')||child.classList.contains('master-ignore-empty'))continue;
        child.style.display=ignoreSelection.mode==='all'?'':'none';
      }
      let empty=$('.master-ignore-empty',list);
      const visible=items.some(x=>x.node.style.display!=='none');
      if(!visible){
        if(!empty){empty=document.createElement('div');empty.className='master-ignore-empty muted';empty.textContent='この分類に表示できる効果はありません。';list.appendChild(empty);}
        empty.style.display='';
      }else if(empty)empty.style.display='none';
    }finally{busy=false;}
  }

  function bind(){
    createIgnoreHierarchy();applySimulatorHierarchy();applyIgnoreList();
    const sim=$('#simEffectCategories');
    if(sim)new MutationObserver(()=>{if(!busy)requestAnimationFrame(applySimulatorHierarchy)}).observe(sim,{childList:true,subtree:true});
    const ignore=$('#ignoreEffectList');
    if(ignore)new MutationObserver(()=>{if(!busy)requestAnimationFrame(applyIgnoreList)}).observe(ignore,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})().catch(err=>console.error('master-filter-ui',err));