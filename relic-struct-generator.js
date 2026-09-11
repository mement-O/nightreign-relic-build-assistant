'use strict';
window.buildRelicStruct = async function buildRelicStruct(){
  const res = await fetch('./data/relic-low-meta.json', {cache:'no-store'});
  if(!res.ok) throw new Error(`relic-low-meta.json 読込失敗 (${res.status})`);
  const r = await res.json();
  for(let base=1000000;base<3000000;base+=100000){
    const deep = base>=2000000 ? 1 : 0;
    for(let mid=0;mid<10000;mid+=1000)
      for(let color=0;color<4;color++)
        for(let tens=0;tens<=20;tens+=10)
          for(let u=0;u<=2;u++) r[base+mid+color*100+tens+u]=[color,deep];
  }
  for(let id=6000000;id<7380000;id++) r[id]=[(Math.floor(id/10)%10)%4,0];
  for(let id=7900000;id<7900020;id++) r[id]=[(Math.floor(id/10)%10)%4,0];
  Object.assign(r,{7000090:[0,0],7000190:[0,0],7000290:[0,0],7035410:[0,0],7035510:[0,0],7100110:[0,0],7900000:[1,0],7900001:[1,0],7900002:[1,0],7900003:[1,1],7900004:[1,1],7900005:[1,1],7900010:[1,0],7900011:[1,0],7900012:[1,0],7900013:[1,1],7900014:[1,1],7900015:[1,1],7999999:[0,0]});
  return {r};
};