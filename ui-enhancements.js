'use strict';
(()=>{
  let syntheticConditionChange=false;
  let normalSearchRunning=false;

  function stickyOffset(){
    const sticky=document.querySelector('.sticky-shell');
    return (sticky?.getBoundingClientRect().height||180)+12;
  }

  function scrollToSearchOutput(){
    const target=document.getElementById('simSearchStatus') || document.getElementById('simDemeritFilter') || document.querySelector('.sim-results');
    if(!target)return;
    const y=window.scrollY+target.getBoundingClientRect().top-stickyOffset();
    window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
  }

  function conditionCheckboxes(){
    return [...document.querySelectorAll('#simEffectCategories input[type="checkbox"]')];
  }

  // Core search already invalidates correctly when a condition is added.
  // For an unchecked condition, briefly feed the core an add event first,
  // then let the real remove event continue. Final UI state stays unchecked.
  function forceInvalidateOnRemoval(target){
    if(syntheticConditionChange || !normalSearchRunning || !target.matches('#simEffectCategories input[type="checkbox"]') || target.checked)return;
    syntheticConditionChange=true;
    target.checked=true;
    target.dispatchEvent(new Event('change',{bubbles:true}));
    target.checked=false;
    syntheticConditionChange=false;
  }

  // Explicit cancel for normal search. Pulse one condition through an "added"
  // state so the existing cooperative search invalidation path is used, while
  // restoring the user's conditions immediately afterwards.
  function cancelNormalSearch(){
    const boxes=conditionCheckboxes();
    if(!boxes.length)return;
    const box=boxes.find(b=>!b.checked) || boxes[0];
    const original=box.checked;
    syntheticConditionChange=true;
    if(!original){
      box.checked=true;
      box.dispatchEvent(new Event('change',{bubbles:true}));
      box.checked=false;
      box.dispatchEvent(new Event('change',{bubbles:true}));
    }else{
      box.checked=false;
      box.dispatchEvent(new Event('change',{bubbles:true}));
      box.checked=true;
      box.dispatchEvent(new Event('change',{bubbles:true}));
    }
    syntheticConditionChange=false;
  }

  function syncButtons(){
    const searchBtn=document.getElementById('simSearchBtn');
    const addBtn=document.getElementById('simAdditionalSearchBtn');
    const addCancel=document.getElementById('simAdditionalCancelBtn');
    if(!searchBtn||!addBtn||!addCancel)return;

    const coreNormalRunning=/検索中/.test(searchBtn.textContent||'');
    normalSearchRunning=coreNormalRunning || normalSearchRunning && searchBtn.dataset.userCancelling==='1';

    if(coreNormalRunning){
      searchBtn.dataset.normalRunning='1';
      searchBtn.textContent='検索中断';
      searchBtn.disabled=false;
    }else if(searchBtn.dataset.normalRunning==='1'){
      delete searchBtn.dataset.normalRunning;
      delete searchBtn.dataset.userCancelling;
      normalSearchRunning=false;
      if((searchBtn.textContent||'').trim()==='検索中断')searchBtn.textContent='検索';
    }

    const additionalRunning=!addCancel.classList.contains('hidden');
    if(additionalRunning){
      addCancel.classList.add('hidden');
      addBtn.dataset.additionalRunning='1';
      addBtn.textContent='検索中断';
      addBtn.disabled=false;
      addBtn.classList.add('danger');
    }else if(addBtn.dataset.additionalRunning==='1'){
      delete addBtn.dataset.additionalRunning;
      addBtn.textContent='追加スキル検索';
      addBtn.classList.remove('danger');
    }
  }

  function bind(){
    const searchBtn=document.getElementById('simSearchBtn');
    const addBtn=document.getElementById('simAdditionalSearchBtn');
    const addCancel=document.getElementById('simAdditionalCancelBtn');
    const target=document.getElementById('simSearchStatus');
    if(target)target.classList.add('sim-search-scroll-target');

    document.addEventListener('change',e=>{
      if(syntheticConditionChange)return;
      forceInvalidateOnRemoval(e.target);
    },true);

    if(searchBtn&&!searchBtn.dataset.enhancedBound){
      searchBtn.dataset.enhancedBound='1';
      searchBtn.addEventListener('click',e=>{
        if(searchBtn.dataset.normalRunning==='1' || normalSearchRunning){
          e.preventDefault();
          e.stopImmediatePropagation();
          searchBtn.dataset.userCancelling='1';
          cancelNormalSearch();
          return;
        }
        requestAnimationFrame(()=>setTimeout(scrollToSearchOutput,40));
      },true);
    }

    if(addBtn&&!addBtn.dataset.enhancedBound){
      addBtn.dataset.enhancedBound='1';
      addBtn.addEventListener('click',e=>{
        if(addBtn.dataset.additionalRunning==='1'){
          e.preventDefault();
          e.stopImmediatePropagation();
          addCancel.click();
        }
      },true);
    }

    const observer=new MutationObserver(syncButtons);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','disabled']});
    setInterval(syncButtons,150);
    syncButtons();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
