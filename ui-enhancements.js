'use strict';
(()=>{
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
  function bind(){
    const btn=document.getElementById('simSearchBtn');
    const target=document.getElementById('simSearchStatus');
    if(target)target.classList.add('sim-search-scroll-target');
    if(btn&&!btn.dataset.scrollBound){
      btn.dataset.scrollBound='1';
      btn.addEventListener('click',()=>{
        requestAnimationFrame(()=>setTimeout(scrollToSearchOutput,40));
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
