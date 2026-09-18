(async()=>{'use strict';
const fetchJson=async path=>{const res=await fetch(path,{cache:'no-store'});if(!res.ok)throw new Error(`データ読込失敗: ${path} (${res.status})`);return res.json()};
const [BUILTIN_STRUCT,MASTER_DATA_SNAPSHOT,EFFECT_RULE_MASTER]=await Promise.all([fetchJson('./data/relic-struct.json'),fetchJson('./data/effect-base-master.json'),fetchJson('./data/effect-rule-master.json')]);
if(!BUILTIN_STRUCT.r||!Object.keys(BUILTIN_STRUCT.r).length||Object.values(BUILTIN_STRUCT.r).some(v=>!Array.isArray(v)||v.length!==2||!Number.isInteger(v[0])||v[0]<0||v[0]>3||(v[1]!==0&&v[1]!==1)))throw new Error('遺物の色・通常／深層マスタが不正です。');
const EFFECT_RULES=EFFECT_RULE_MASTER.effects||[];
const EFFECT_RULES_BY_ID=new Map();for(const rule of EFFECT_RULES)for(const id of rule.effectIds||[]){if(!EFFECT_RULES_BY_ID.has(id))EFFECT_RULES_BY_ID.set(id,[]);EFFECT_RULES_BY_ID.get(id).push(rule)}

const HERO_NAMES={1:'追跡者',2:'守護者',3:'鉄の目',4:'レディ',5:'無頼漢',6:'復讐者',7:'隠者',8:'執行者',9:'学者',10:'葬儀屋'};
const COLOR_HEX=['#ff4053','#3292ff','#ffbd1d','#14c875'];
const EMPTY=0xffffffff, RELIC_TYPE=0xC0000000, WEAPON_TYPE=0x80000000, ARMOR_TYPE=0x90000000;
const AES_KEY=new Uint8Array([0x18,0xf6,0x32,0x66,0x05,0xbd,0x17,0x8a,0x55,0x24,0x52,0x3a,0xc0,0xa0,0xc6,0x09]);


const state={player:'',slot:-1,saveName:'',relics:new Map(),presets:[],hero:0,globalIgnored:new Set(),heroIgnored:new Map(),ignoreMode:'global',ignoreCategory:'all',ignoreSelectedOnly:false,selectedGa:0,selectedSlot:-1,currentPresetPos:0,workingPresets:new Map(),simConditionsByHero:new Map(),simConditions:new Map(),simDemeritExclusionsByHero:new Map(),simBenefitExclusionsByHero:new Map(),simSearchMode:"50",simResultPage:0,simAdditionalCandidates:[],simAdditionalStats:null,simAdditionalCancelRequested:false,simResults:[],simSelectedResult:-1};
let simBenefitDraft=null,simBenefitSearchExclusions=null;
function simBenefitFilterState(){const h=Number(state.hero)||0,sig=simConditionSignature();let s=state.simBenefitExclusionsByHero.get(h);if(!s||s.signature!==sig){s={signature:sig,items:new Map()};state.simBenefitExclusionsByHero.set(h,s)}return s.items;}
function simBenefitIdentity(id,relic){const rule=simRuleMasterForEffect(id,relic);if(!rule)return null;const ranked=rule.uiMode==='RANK_SUM'||rule.ruleType==='UNIQUE_LEVEL';return rule.masterKey+(ranked?':rank:'+(effectInfo(id).level??0):'')+':scope:'+(relicMeta(relic.relicId).deep?'deep':'normal');}
function simHasExcludedBenefit(relics){const excluded=simBenefitSearchExclusions||simBenefitFilterState();return excluded.size>0&&simEffectiveRecords(relics).some(({id,relic})=>excluded.has(simBenefitIdentity(id,relic)));}
function simConditionSignature(map=state.simConditions){
 return JSON.stringify([...map.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(([k,c])=>[k,c?.rule??'',c?.value??null]))
}
function simDemeritFilterState(hero=state.hero){
 const h=Number(hero)||0, sig=simConditionSignature(simConditionsForHero(h));
 let s=state.simDemeritExclusionsByHero.get(h);
 if(!s){s={signature:sig,names:new Set()};state.simDemeritExclusionsByHero.set(h,s)}
 if(s.signature!==sig){s.signature=sig;s.names.clear()}
 return s
}
function simSearchConditionsChanged(){
 simInvalidateSearch();
 const h=Number(state.hero)||0;
 state.simDemeritExclusionsByHero.set(h,{signature:simConditionSignature(state.simConditions),names:new Set()});
 state.simResults=[];state.simSelectedResult=-1;
 state.simAdditionalCandidates=[];state.simAdditionalStats=null;
 if($('#simSearchStatus'))$('#simSearchStatus').innerHTML='';
 renderSimDemeritFilter();renderSimAdditionalCandidates();
}
function simConditionsForHero(hero=state.hero){
 const h=Number(hero)||0;
 if(!state.simConditionsByHero.has(h))state.simConditionsByHero.set(h,new Map());
 return state.simConditionsByHero.get(h)
}
function activateSimConditionsForHero(hero=state.hero){
 simInvalidateSearch();
 state.simConditions=simConditionsForHero(hero);
 return state.simConditions
}
let simSearchRevision=0,simActiveSearch=null,simAdditionalRefreshTimer=null;
function simInvalidateSearch(){
 if(simAdditionalRefreshTimer!==null){clearTimeout(simAdditionalRefreshTimer);simAdditionalRefreshTimer=null;}
 simSearchRevision++;simBenefitSearchExclusions=null;simActiveSearch=null;simSearchRankMetaCache=null;
 state.simAdditionalCancelRequested=false;
 state.simResults=[];state.simSelectedResult=-1;state.simAdditionalCandidates=[];state.simAdditionalStats=null;
 if($('#simSearchStatus'))$('#simSearchStatus').innerHTML='';
 simUpdateSearchButtons();renderSimResults();renderSimAdditionalCandidates();
}
function simUpdateSearchButtons(){
 const busy=simActiveSearch!==null;
 if($("#simBenefitPreviewBtn"))$("#simBenefitPreviewBtn").disabled=busy||(!state.simResults.length&&!simBenefitFilterState().size);
 if($("#simSearchMode"))$("#simSearchMode").disabled=busy;if($("#simBenefitApply"))$("#simBenefitApply").disabled=busy;
 for(const [id,kind,label] of [['#simSearchBtn','normal','検索'],['#simAdditionalSearchBtn','additional','追加スキル検索']]){
  const b=$(id);if(!b)continue;const own=simActiveSearch===kind;
  b.disabled=!state.relics.size||(busy&&!own)||(own&&state.simAdditionalCancelRequested);
  b.textContent=own?(state.simAdditionalCancelRequested?'中断中…':'検索中断'):label;b.classList.toggle('danger',own);
 }
}
function simBeginSearch(kind){
 const previous=kind==='additional'?{results:state.simResults,selected:state.simSelectedResult}:null;
 simInvalidateSearch();if(previous){state.simResults=previous.results;state.simSelectedResult=previous.selected;renderSimResults();}
 simBenefitSearchExclusions=new Map(simBenefitFilterState());simActiveSearch=kind;simUpdateSearchButtons();return simSearchRevision;
}
function simRequestCancel(kind){if(simActiveSearch!==kind)return;state.simAdditionalCancelRequested=true;simUpdateSearchButtons();}
function simScrollToOutput(kind){requestAnimationFrame(()=>{const target=$('#simOutputStart');if(!target)return;const offset=(document.querySelector('.sticky-shell')?.getBoundingClientRect().height||180)+12;window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset),behavior:'smooth'});});}
function simDemeritSelectionChanged(){
 const refresh=state.simAdditionalCandidates.length>0||state.simAdditionalStats!==null||simActiveSearch==='additional'||simAdditionalRefreshTimer!==null;
 if(simActiveSearch!==null||refresh){const results=state.simResults,selected=state.simSelectedResult;simInvalidateSearch();state.simResults=results;state.simSelectedResult=selected;renderSimResults();}
 persistAppState();renderSimDemeritFilter();
 if(refresh){const revision=simSearchRevision;simAdditionalRefreshTimer=setTimeout(()=>{simAdditionalRefreshTimer=null;if(revision===simSearchRevision&&state.simConditions.size)runSimulatorAdditionalSearch();},150);}
}
function simFinishSearch(revision){if(revision!==simSearchRevision)return;simActiveSearch=null;simBenefitSearchExclusions=null;simSearchRankMetaCache=null;simUpdateSearchButtons();}

function removeIgnoredSimConditions(){
 for(const [hero,conditions] of state.simConditionsByHero){
  const ignored=new Set([...state.globalIgnored,...(state.heroIgnored.get(hero)||[])]);
  let changed=false;
  for(const [key] of conditions){
   const rule=EFFECT_RULES.find(r=>key===r.masterKey||(r.uiMode==='UNIQUE_LEVEL'&&key.startsWith(r.masterKey+':level:')));
   if(!rule||!(rule.effectIds||[]).some(id=>isEffectIgnored(id,ignored)))continue;
   conditions.delete(key);changed=true;
  }
  if(changed)state.simDemeritExclusionsByHero.set(hero,{signature:simConditionSignature(conditions),names:new Set()});
 }
}
function simIgnoreSettingsChanged(){
 removeIgnoredSimConditions();
 simSearchConditionsChanged();
 simSearchRankMetaCache=null;
 persistAppState();
 renderSimulator();
}
const STORAGE_KEY='nightreign_relic_build_assistant_phase2_v2';
function persistAppState(){
  try{
    const data={
      v:4,simSearchMode:state.simSearchMode,simBenefitExclusionsByHero:[...state.simBenefitExclusionsByHero].map(([h,s])=>[h,{signature:s.signature,items:[...s.items]}]),
      saveName:state.saveName||'',player:state.player||'',slot:state.slot,hero:state.hero||0,currentPresetPos:state.currentPresetPos||0,
      relics:[...state.relics.entries()],
      presets:state.presets.map(p=>({...p,timestamp:p.timestamp!=null?String(p.timestamp):'0'})),
      globalIgnored:[...state.globalIgnored],
      heroIgnored:[...state.heroIgnored.entries()].map(([h,set])=>[h,[...set]]),
      simConditionsByHero:[...state.simConditionsByHero.entries()].map(([h,m])=>[h,[...m.entries()]]),
      simDemeritExclusionsByHero:[...state.simDemeritExclusionsByHero.entries()].map(([h,s])=>[h,{signature:s.signature||'',names:[...s.names]}])
    };
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  }catch(e){console.warn('状態保存に失敗しました',e)}
}
function restoreAppState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;
    const d=JSON.parse(raw);if(!d||![2,3,4].includes(d.v))return false;
    state.simSearchMode=['50','100','all'].includes(d.simSearchMode)?d.simSearchMode:'50';$('#simSearchMode').value=state.simSearchMode;
    state.simBenefitExclusionsByHero=new Map((d.simBenefitExclusionsByHero||[]).map(([h,s])=>[Number(h),{signature:s.signature,items:new Map(s.items||[])}]));
    state.saveName=d.saveName||'';state.player=d.player||'';state.slot=Number.isInteger(d.slot)?d.slot:-1;
    state.relics=new Map(Array.isArray(d.relics)?d.relics:[]);
    state.presets=(Array.isArray(d.presets)?d.presets:[]).map(p=>({...p,timestamp:BigInt(p.timestamp||'0')}));
    state.globalIgnored=new Set(Array.isArray(d.globalIgnored)?d.globalIgnored:[]);
    state.heroIgnored=new Map((Array.isArray(d.heroIgnored)?d.heroIgnored:[]).map(([h,a])=>[Number(h),new Set(Array.isArray(a)?a:[])]));
    state.hero=Number(d.hero)||state.presets[0]?.heroId||0;state.currentPresetPos=Number(d.currentPresetPos)||0;
    state.simConditionsByHero=new Map();
    if(d.v>=3&&Array.isArray(d.simConditionsByHero)){
      for(const [h,entries] of d.simConditionsByHero)state.simConditionsByHero.set(Number(h),new Map(Array.isArray(entries)?entries:[]));
    }else{
      // v2 migration: the formerly global simulator conditions belong to the saved active hero.
      state.simConditionsByHero.set(state.hero,new Map(Array.isArray(d.simConditions)?d.simConditions:[]));
    }
    state.simDemeritExclusionsByHero=new Map();
    if(d.v>=4&&Array.isArray(d.simDemeritExclusionsByHero)){
      for(const [h,s] of d.simDemeritExclusionsByHero){
        state.simDemeritExclusionsByHero.set(Number(h),{signature:String(s?.signature||''),names:new Set(Array.isArray(s?.names)?s.names:[])});
      }
    }
    activateSimConditionsForHero(state.hero);
    removeIgnoredSimConditions();
    simDemeritFilterState(state.hero);
    state.selectedGa=0;state.selectedSlot=-1;state.workingPresets.clear();state.simResults=[];state.simSelectedResult=-1;ignoreAliasMapCache=null;
    if(!state.relics.size)return false;
    $('#saveStatus').textContent=`復元済み：${state.saveName||'前回のセーブ'}`;$('#saveStatus').className='pill ok';
    $('#playerStatus').textContent=`プレイヤー：${state.player}`;$('#presetStatus').textContent=`プリセット：${state.presets.length}件`;
    renderHeroes();renderPresets();renderCandidatePane(-1);updateIgnoreButtons();renderSimulator();
    persistAppState();
    return true;
  }catch(e){console.warn('保存状態の復元に失敗しました',e);return false}
}
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function u32(dv,o){return dv.getUint32(o,true)}
function relicMeta(id){const v=BUILTIN_STRUCT.r[id],known=Array.isArray(v)&&Number.isInteger(v[0])&&v[0]>=0&&v[0]<=3&&(v[1]===0||v[1]===1);return {name:MASTER_DATA_SNAPSHOT.relicNames[id]||`遺物 #${id}`,known,color:known?v[0]:null,deep:known?Boolean(v[1]):null}}
function renderRelicMetadataNotice(){
 const el=$('#relicMetadataNotice');if(!el)return;
 const unknown=[...state.relics.values()].filter(r=>!relicMeta(r.relicId).known);
 el.hidden=!unknown.length;
 el.textContent=unknown.length?`色・通常／深層が判定不能の遺物が${unknown.length}個あります。これらはプリセット最適化・編成検索・追加スキル検索の対象外です。遺物ID：${[...new Set(unknown.map(r=>r.relicId))].join('、')}`:'';
}
function effectName(id){return MASTER_DATA_SNAPSHOT.effectNames[id]||`Effect ${id}`}
function effectInfo(id){const g=MASTER_DATA_SNAPSHOT.effectGroups?.[id]||null;return {id,name:effectName(id),jaName:MASTER_DATA_SNAPSHOT.effectNames?.[id]||effectName(id),group:g?.group??null,level:g?.level??null}}
function ignoreBaseLabel(name){return String(name||'').replace(/[＋+]\s*[0-9０-９]+\s*$/,'').trim()}
let ignoreAliasMapCache=null;
function normalizeEffectIdentity(s){return String(s||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase()}
function getIgnoreAliasMap(){
  if(ignoreAliasMapCache)return ignoreAliasMapCache;
  const groupedByLabel=new Map();
  for(const r of state.relics.values())for(const id of r.effects||[]){
    const e=effectInfo(id);if(!e.group)continue;
    const label=normalizeEffectIdentity(ignoreBaseLabel(effectName(id)));
    if(label&&!groupedByLabel.has(label))groupedByLabel.set(label,`g:${e.group}`);
  }
  const byId=new Map();
  for(const r of state.relics.values())for(const id of r.effects||[]){
    const e=effectInfo(id);if(e.group)continue;
    const alias=groupedByLabel.get(normalizeEffectIdentity(ignoreBaseLabel(effectName(id))));
    if(alias)byId.set(id,alias);
  }
  ignoreAliasMapCache=byId;return byId;
}
function effectIgnoreKey(e){if(e.group)return `g:${e.group}`;return `n:${normalizeEffectIdentity(ignoreBaseLabel(e.name))}`}
function activeIgnoredKeys(){return new Set([...state.globalIgnored,...(state.hero?heroIgnoredSet(state.hero):[])])}
function isEffectIgnored(id,keys=activeIgnoredKeys()){return keys.has(effectIgnoreKey(effectInfo(id)))}
function comparableRelic(ga){const r=state.relics.get(ga);if(!r)return null;const m=relicMeta(r.relicId);if(!m.known)return null;return {...r,name:m.name,color:m.color,deep:m.deep,effectInfos:(r.effects||[]).map(id=>({...effectInfo(id),optimizerDeep:m.deep})),curseInfos:(r.curses||[]).map(effectInfo)}}
function optimizerRule(e){
 const rules=(EFFECT_RULES_BY_ID.get(Number(e.id))||[]).filter(r=>e.optimizerDeep===undefined?true:e.optimizerDeep?r.deepAvailable:r.normalAvailable);
 return rules.length===1?rules[0]:null;
}
function effectCanCover(a,b){
 if(a.id===b.id)return {ok:true,kind:'same'};
 const ar=optimizerRule(a),br=optimizerRule(b);
 if(!ar||!br||ar.masterKey!==br.masterKey)return {ok:false};
 if(ar.uiMode==='RANK_SUM'||ar.ruleType==='UNIQUE_LEVEL'){
  if(a.level==null||b.level==null||b.level<a.level)return {ok:false};
  return {ok:true,kind:b.level>a.level?'up':'same'};
 }
 return {ok:true,kind:'same'};
}
// Resolve conflicts before ignoring effects: an ignored earlier effect can still
// suppress a later effect that the user wants to preserve.
function optimizerCompositionMeasures(relics,hero,ignored){
 const measures=new Map(),seen=new Set();
 for(const r of relics){if(!r)continue;const meta=relicMeta(r.relicId);
  for(const id of r.effects||[]){const e={...effectInfo(id),optimizerDeep:meta.deep},rule=meta.known?optimizerRule(e):null;
   if(rule?.ruleType==='LEFTMOST_WINS'&&rule.conflictGroup){let conflict=rule.conflictGroup;if(hero===6&&(conflict==='START_SKILL'||conflict==='START_MAGIC'))conflict='REVENANT_START';if(seen.has(conflict))continue;seen.add(conflict);}
   if(ignored.has(effectIgnoreKey(e)))continue;
   let key=rule?rule.masterKey:`id:${id}`,value=1,add=false;
   if(rule?.ruleType==='UNIQUE_LEVEL')key+=`:level:${e.level??0}`;
   else if(rule?.ruleType==='ADDITIVE'){
    add=true;if(rule.uiMode==='RANK_SUM')value=(e.level??0)+(rule.zeroBasedRank?1:0);
   }
   const old=measures.get(key);measures.set(key,{value:add?(old?.value||0)+value:Math.max(old?.value||0,value),present:true});
  }
 }
 return measures;
}
function optimizerPreservesComposition(before,after){
 for(const [key,m] of before){const next=after.get(key);if(!next||next.value<m.value)return false;}return true;
}
function findMatching(aList,bList){
  const used=new Set(),pairs=[];
  function rec(i){if(i===aList.length)return true;for(let j=0;j<bList.length;j++){if(used.has(j))continue;const c=effectCanCover(aList[i],bList[j]);if(c.ok){used.add(j);pairs.push({ai:i,bj:j,kind:c.kind});if(rec(i+1))return true;pairs.pop();used.delete(j)}}return false}
  return rec(0)?pairs:null
}
function exactSameBeneficial(a,b){if(a.color!==b.color||a.deep!==b.deep||a.effectInfos.length!==b.effectInfos.length)return false;const p=findMatching(a.effectInfos,b.effectInfos);return !!p&&p.every(x=>x.kind==='same')}
function curseSubset(candidate,base){if(candidate.curseInfos.length>base.curseInfos.length)return false;const counts=new Map();for(const e of base.curseInfos)counts.set(e.id,(counts.get(e.id)||0)+1);for(const e of candidate.curseInfos){const n=counts.get(e.id)||0;if(!n)return false;counts.set(e.id,n-1)}return true}
function improvementRelation(base,candidate,ignoredKeys){
  if(!base||!candidate||base.ga===candidate.ga||base.color!==candidate.color||base.deep!==candidate.deep||exactSameBeneficial(base,candidate))return null;
  const kept=base.effectInfos.filter(e=>!ignoredKeys.has(effectIgnoreKey(e)));
  const ignored=base.effectInfos.filter(e=>ignoredKeys.has(effectIgnoreKey(e)));
  if(!kept.length||candidate.effectInfos.length<kept.length)return null;
  const pairs=findMatching(kept,candidate.effectInfos);if(!pairs)return null;
  const hasUp=pairs.some(p=>p.kind==='up'),hasExtra=candidate.effectInfos.length>kept.length;
  if(!ignored.length&&!hasUp&&!hasExtra)return null;
  return {pairs,kept,ignored,hasUp,hasExtra,safeCurse:curseSubset(candidate,base)}
}
function presetKey(p){return `${p.heroId}:${p.index}`}
function workingState(p){const k=presetKey(p);if(!state.workingPresets.has(k))state.workingPresets.set(k,{original:[...p.relics],current:[...p.relics]});return state.workingPresets.get(k)}
function currentPreset(){const list=getHeroPresetList();return list[state.currentPresetPos]||null}
function getCandidatesFor(p,slotIndex){
  const w=workingState(p),baseGa=w.original[slotIndex],base=comparableRelic(baseGa);if(!base)return [];
  const ignored=activeIgnoredKeys(),out=[],current=w.current.map(ga=>state.relics.get(ga));
  const before=optimizerCompositionMeasures(current,p.heroId,ignored);
  for(const [ga] of state.relics){const cand=comparableRelic(ga);const rel=improvementRelation(base,cand,ignored);if(rel){const after=[...current];after[slotIndex]=cand;if(optimizerPreservesComposition(before,optimizerCompositionMeasures(after,p.heroId,ignored)))out.push({ga,relic:cand,rel})}}
  out.sort((a,b)=>(Number(b.rel.safeCurse)-Number(a.rel.safeCurse))||((b.relic.effects?.length||0)-(a.relic.effects?.length||0))||((b.relic.acquisition||0)-(a.relic.acquisition||0)));
  return out
}
function usedInOtherSlot(p,slotIndex,ga){const w=workingState(p);return w.current.some((x,i)=>i!==slotIndex&&x===ga)}
function relationCandidateClasses(rel,candidate){
  const classes=Array(candidate.effectInfos.length).fill('extra');
  if(rel)for(const p of rel.pairs)classes[p.bj]=p.kind;
  return classes
}

async function aesDecrypt(enc){if(!globalThis.crypto?.subtle)throw new Error('Web Crypto API が利用できません。');const iv=enc.slice(0,16),payload=enc.slice(16);const key=await crypto.subtle.importKey('raw',AES_KEY,{name:'AES-CBC'},false,['decrypt']);const dec=await crypto.subtle.decrypt({name:'AES-CBC',iv},key,payload);return new Uint8Array(dec)}
async function unpackBnd4(buf){const a=new Uint8Array(buf);if(String.fromCharCode(...a.slice(0,4))!=='BND4')throw new Error('PC版のBND4セーブではありません。');const dv=new DataView(buf),count=dv.getInt32(12,true);if(count<1||count>64)throw new Error('BND4エントリ数が不正です。');const out=[];for(let i=0;i<count;i++){const p=64+32*i,size=dv.getInt32(p+8,true),off=dv.getInt32(p+16,true);if(size<=16||off<=0||off+size>a.length)throw new Error(`BND4 entry ${i} bounds error`);out.push(await aesDecrypt(a.slice(off,off+size)))}return out}
function findBytes(h,n,start=0){outer:for(let i=start;i<=h.length-n.length;i++){for(let j=0;j<n.length;j++)if(h[i+j]!==n[j])continue outer;return i}return -1}
function parseSlot(a){const dv=new DataView(a.buffer,a.byteOffset,a.byteLength);let off=0x14;const relicMap=new Map();for(let i=0;i<5120;i++){if(off+8>a.length)throw new Error('ItemState範囲外');const ga=u32(dv,off),item=u32(dv,off+4),type=(ga&0xF0000000)>>>0;let size=8;if(ga!==0){if(type===WEAPON_TYPE)size=88;else if(type===ARMOR_TYPE)size=16;else if(type===RELIC_TYPE)size=80}if(off+size>a.length)throw new Error('ItemStateサイズ不正');if(ga&&type===RELIC_TYPE){const relicId=item&0x00ffffff;relicMap.set(ga,{ga,relicId,effects:[u32(dv,off+16),u32(dv,off+20),u32(dv,off+24)].filter(x=>x!==EMPTY&&x!==0),curses:[u32(dv,off+56),u32(dv,off+60),u32(dv,off+64)].filter(x=>x!==EMPTY&&x!==0)})}off+=size}off+=0x94;let player='';for(let i=0;i<16;i++){const c=dv.getUint16(off+i*2,true);if(!c)break;player+=String.fromCharCode(c)}off+=0x5B8;if(off+4>a.length)throw new Error('ItemEntry count範囲外');off+=4;let owned=0;for(let i=0;i<3065;i++){const p=off+i*14;if(p+14>a.length)break;const ga=u32(dv,p);if(ga&&((ga&0xF0000000)>>>0)===RELIC_TYPE&&relicMap.has(ga))owned++}return {player,relicMap,owned}}
function parsePresets(a){const magic=new Uint8Array([0xC2,0x00,0x03,0x00,0x00,0x2C,0x00,0x00,0x03,0x00,0x0A,0x00,0x04,0x00,0x46,0x00,0x64,0x00,0x00,0x00]);const found=findBytes(a,magic);if(found<0)return[];const dv=new DataView(a.buffer,a.byteOffset,a.byteLength);let cursor=found+magic.length;cursor+=10*(8+4*28);while(cursor+4<=a.length){const v=u32(dv,cursor);if(v===0){cursor+=4;break}if(cursor+28>a.length)throw new Error('Vessel block範囲外');cursor+=28}const out=[];let zeroSeen=false;const td=new TextDecoder('utf-16le');for(let i=0;i<100&&cursor+80<=a.length;i++,cursor+=80){const heroId=a[cursor+1],counter=a[cursor+3];const rawName=td.decode(a.slice(cursor+4,cursor+40));const name=rawName.replace(/\0+$/,'');const vesselId=u32(dv,cursor+44);const relics=[];for(let k=0;k<6;k++)relics.push(u32(dv,cursor+48+k*4));const lo=u32(dv,cursor+72),hi=u32(dv,cursor+76);const timestamp=BigInt(hi)*4294967296n+BigInt(lo);if(heroId>=1&&heroId<=10)out.push({index:i,heroId,counter,name,vesselId,relics,timestamp});if(counter===0){if(zeroSeen)break;zeroSeen=true}}return out}
function filetimeDate(ft){if(!ft)return null;const ms=Number(ft/10000n)-11644473600000;const d=new Date(ms);return Number.isNaN(d.getTime())?null:d}
function formatDate(ft){const d=filetimeDate(ft);if(!d)return '日時不明';return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d)}
function relicEffectsHtml(r,{ignoredKeys=null,classes=null}={}){
  const eff=(r.effects||[]).map((id,i)=>{
    let cls=classes?.[i]||'';
    if(ignoredKeys&&isEffectIgnored(id,ignoredKeys))cls='ignored';
    return `<span class="eff ${cls}">${esc(effectName(id))}</span>`;
  }).join('');
  const curses=(r.curses||[]).map(id=>`<span class="eff curse">${esc(effectName(id))}</span>`).join('');
  return `<div class="effects">${eff}</div>${curses?`<div class="curse-effects">${curses}</div>`:''}`
}
function relicCard(p,slotIndex){
  const w=workingState(p),originalGa=w.original[slotIndex],ga=w.current[slotIndex],slot=slotIndex%3+1;
  if(!ga)return `<div class="empty-slot">Slot ${slot}：未設定</div>`;
  const r=state.relics.get(ga);
  if(!r)return `<div class="relic selectable" data-slot="${slotIndex}"><div class="relic-head"><span class="relic-name">所有遺物に見つかりません</span><span class="rid">GA 0x${ga.toString(16).padStart(8,'0')}</span></div></div>`;
  const m=relicMeta(r.relicId),replaced=ga!==originalGa,candidates=getCandidatesFor(p,slotIndex);
  const original=state.relics.get(originalGa),originalMeta=original?relicMeta(original.relicId):null;
  return `<div class="relic selectable ${state.selectedSlot===slotIndex?'selected':''} ${!candidates.length&&!replaced?'no-candidates':''}" data-slot="${slotIndex}">
    <div class="relic-head"><span class="dot" style="background:${COLOR_HEX[m.color]||'#999'}"></span><span class="relic-name">${esc(m.name)}</span>${!m.known?'<span class="deep">判定不能（色・通常／深層）</span>':m.deep?'<span class="deep">深層</span>':''}<span class="rid">#${r.relicId} / 0x${ga.toString(16).padStart(8,'0')}</span><span class="improvement-count ${candidates.length?'has':'none'}">${m.known?`改善候補 ${candidates.length}件`:'比較対象外'}${replaced?' / 置換済み':''}</span>${replaced?`<button class="reset-slot" data-reset-slot="${slotIndex}">元に戻す</button>`:''}</div>
    ${relicEffectsHtml(r)}
    ${replaced&&originalMeta?`<div class="original-note">← 元：${esc(originalMeta.name)}</div>`:''}
  </div>`
}
function heroIgnoredSet(heroId){if(!state.heroIgnored.has(heroId))state.heroIgnored.set(heroId,new Set());return state.heroIgnored.get(heroId)}
function activeIgnoredSet(){return activeIgnoredKeys()}
function updateIgnoreButtons(){
 const globalCount=state.globalIgnored.size;
 const hs=state.hero?heroIgnoredSet(state.hero):new Set();
 const heroCount=hs.size;
 $('#globalIgnoreCount').textContent=`(${globalCount})`;
 $('#heroIgnoreCount').textContent=`(${heroCount})`;
 $('#heroIgnoreBtn').disabled=!state.hero;
 if(state.hero)$('#heroIgnoreBtn').childNodes[0].nodeValue=`${HERO_NAMES[state.hero]}：評価対象外 `;
 // Simulator uses the same state, so its visible controls must be synchronized
 // even while the optimizer tab is the currently opened tab.
 $('#simGlobalIgnoreCount').textContent=`(${globalCount})`;
 $('#simHeroIgnoreCount').textContent=`(${heroCount})`;
 $('#simHeroIgnoreBtn').disabled=!state.hero;
 if(state.hero)$('#simHeroIgnoreBtn').childNodes[0].nodeValue=`${HERO_NAMES[state.hero]}：評価対象外 `;
 else $('#simHeroIgnoreBtn').childNodes[0].nodeValue='キャラクター個別：評価対象外 ';
}

function effectCategory(e){
  // Classification must be language-independent. The category rules are based on
  // the canonical Japanese master labels, not the currently displayed JA/EN text.
  const n=e.jaName||MASTER_DATA_SNAPSHOT.effectNames[e.id]||e.name||'';
  // ゲーム内「遺物効果」分類に合わせた表示用分類。
  // 順序は、より限定的なカテゴリを先に判定する。
  if(/^【[^】]+】/.test(n))return 'character_special';
  if(/デメリット|低下|減少|下が|被ダメージ時.*(?:毒|腐敗|出血|冷気|睡眠|発狂)|回避.*カット率低下|連続.*カット率低下/.test(n)){
    if(/生命力|精神力|持久力|筋力|技量|知力|信仰|神秘|最大HP|最大Ｆ?Ｐ|最大FP|最大スタミナ/.test(n))return 'demerit_status';
    if(/カット率|被ダメージ|防御/.test(n))return 'demerit_defense';
    return 'demerit_action';
  }
  if(/出撃時の武器/.test(n)){
    if(/戦技/.test(n))return 'starting_weapon';
    if(/魔術|祈祷|杖|聖印/.test(n))return 'starting_magic';
    return 'starting_enchant';
  }
  if(/出撃時(?:に)?(?:\s*\[[^\]]+\]|\s*［[^］]+］)?.*(?:持つ|所持)|出撃時.*(?:アイテム|壺|ナイフ|石|ボルト|矢|雫)/.test(n))return 'starting_item';
  if(/マップ|地変|火口|山嶺|腐れ森|ノクラテオ|隠れ都|大空洞|湖沼|地下砦|魔術師塔|封牢|教会|砦|野営地|潜在する力から.*見つけやすく/.test(n))return 'map_environment';
  if(/味方|チーム|周囲の味方|自身を除く周囲/.test(n))return 'team';
  if(/大剣のみ|直剣のみ|特大剣のみ|曲剣のみ|刀のみ|槍のみ|斧のみ|槌のみ|拳のみ|爪のみ|弓のみ|クロスボウのみ|武器種/.test(n))return 'weapon';
  if(/魔術|祈祷|魔法|魔術師|輝石|重力|夜の魔術|カーリア|火の祈祷|雷の祈祷|神狩り|竜餐|狂い火|黄金律|魔術強化|祈祷強化/.test(n))return 'magic';
  if(/スキル|アーツ|アビリティ/.test(n))return 'skill_arts';
  if(/生命力|精神力|持久力|筋力|技量|知力|信仰|神秘|最大HP|最大ＨＰ|最大ＦＰ|最大FP|最大スタミナ|ルーン獲得量/.test(n))return 'status';
  if(/免疫|頑健|正気|抗死|毒耐性|腐敗耐性|出血耐性|冷気耐性|睡眠耐性|発狂耐性|状態異常耐性/.test(n))return 'resist';
  if(/カット率|ガード時.*軽減|被ダメージ.*軽減|防御力|強靭度/.test(n))return 'defense';
  if(/HP回復|ＨＰ回復|FP回復|ＦＰ回復|スタミナ回復|聖杯瓶.*回復|回復量|回復効果|徐々に.*回復/.test(n))return 'heal';
  if(/物理攻撃|魔力攻撃|炎攻撃|雷攻撃|聖攻撃|攻撃力|攻撃を強化|攻撃強化|与えるダメージ|致命の一撃|状態の敵に対する攻撃|連続攻撃|タメ攻撃|ジャンプ攻撃|ガードカウンター|背後.*攻撃/.test(n))return 'attack';
  return 'action';
}
function categoryMatches(selected, actual){
  if(selected==='all')return true;
  if(selected==='starting_bonus')return ['starting_weapon','starting_enchant','starting_magic'].includes(actual);
  return selected===actual;
}
const CHARACTER_DISPLAY_ORDER=['追跡者','守護者','鉄の目','レディ','無頼漢','復讐者','隠者','執行者','学者','葬儀屋'];
function characterNameFromEffectName(name){const m=String(name||'').match(/^【([^】]+)】/);return m?m[1]:'その他'}
function canonicalCharacterName(o){return characterNameFromEffectName(o?.jaName||MASTER_DATA_SNAPSHOT.effectNames[o?.id]||o?.name||o?.label)}
function characterDisplayName(ja){return ja}
function characterSortIndex(name){const i=CHARACTER_DISPLAY_ORDER.indexOf(name);return i>=0?i:CHARACTER_DISPLAY_ORDER.length}
function sortCharacterEffects(a,b){
  const ca=canonicalCharacterName(a), cb=canonicalCharacterName(b);
  const ia=characterSortIndex(ca), ib=characterSortIndex(cb);
  if(ia!==ib)return ia-ib;
  if(ca!==cb)return ca.localeCompare(cb,'ja');
  return (a.id||0)-(b.id||0);
}
function renderCharacterGroupedOptions(opts,{ignore=false}={}){
  let html='', last=null;
  for(const o of opts){
    const ch=canonicalCharacterName(o);
    if(ch!==last){html+=`<div class="character-effect-group">${esc(characterDisplayName(ch))}</div>`;last=ch;}
    if(ignore){html+=`<label class="effect-option"><input type="checkbox" data-ignore-key="${esc(o.key)}" ${state.ignoreKeys.has(o.key)?'checked':''}><span>${esc(o.label)}</span></label>`;}
    else {html+=`<label class="effect-option ${o.curse?'curse-option':''}"><input type="checkbox" data-effect-id="${o.id}" ${state.filterIds.has(o.id)?'checked':''}><span>${esc(o.name)}${o.name.startsWith('Effect ')?` <span class="rid">${o.id}</span>`:''}</span></label>`;}
  }
  return html;
}
function ignoreOptionsInSave(){
  const map=new Map();

  for(const r of state.relics.values())for(const id of r.effects||[]){
    const e=effectInfo(id);

    // Organizer-compatible identity:
    // ranked effects => EffectGroup; unranked => normalized displayed effect label.
    const rankedKey=e.group?`g:${e.group}`:null;
    const baseLabel=ignoreBaseLabel(e.name);
    const labelKey=`n:${normalizeEffectIdentity(baseLabel)}`;
    const key=rankedKey||labelKey;

    const label=rankedKey?`${baseLabel}（全ランク）`:baseLabel;
    const category=effectCategory(e);

    const prev=map.get(key);
    if(!prev || e.id<prev.id){
      map.set(key,{
        key,
        label,
        category,
        id:e.id,
        name:e.name,
        jaName:e.jaName
      });
    }
  }

  // Some save/master combinations expose the same displayed effect through more than one
  // internal ID / EffectGroup. The filter is a UI-level effect selector, so show each
  // normalized displayed effect only once. Prefer the grouped entry when available.
  const deduped=new Map();
  for(const o of map.values()){
    const displayKey=normalizeEffectIdentity(o.label.replace(/（全ランク）$/,''));
    const prev=deduped.get(displayKey);
    if(!prev || (o.key.startsWith('g:')&&!prev.key.startsWith('g:')) || (o.key.startsWith('g:')===prev.key.startsWith('g:')&&o.id<prev.id)) deduped.set(displayKey,o);
  }
  return [...deduped.values()].sort((a,b)=>a.id-b.id);
}
function effectsInSave(){return ignoreOptionsInSave()}
function renderIgnoreModal(){
  const globalMode=state.ignoreMode==='global',local=globalMode?state.globalIgnored:heroIgnoredSet(state.hero);
  $('#ignoreModalTitle').textContent=globalMode?'全キャラクター共通：評価対象外とする効果':`${HERO_NAMES[state.hero]}：追加で評価対象外とする効果`;
  $('#ignoreModalNote').textContent=globalMode?'ランク付き効果は同一EffectGroupをまとめて評価対象外にします。':'全キャラクター共通で選択済みの効果は変更できません。ランク付き効果は同一EffectGroupをまとめて扱います。';
  $('#ignoreClearBtn').textContent=globalMode?'共通選択をすべて解除':'このキャラクターの追加選択を解除';
  document.querySelectorAll('[data-ignore-category]').forEach(b=>b.classList.toggle('active',b.dataset.ignoreCategory===state.ignoreCategory));
  $('#ignoreSelectedOnly').classList.toggle('active',state.ignoreSelectedOnly);

  const q=$('#ignoreSearch').value.trim().toLowerCase();
  let opts=ignoreOptionsInSave().filter(o=>{
    const inherited=!globalMode&&state.globalIgnored.has(o.key);
    const checked=inherited||local.has(o.key);
    return (state.ignoreSelectedOnly?checked:categoryMatches(state.ignoreCategory,o.category))
      &&(!q||o.label.toLowerCase().includes(q)||String(o.id).includes(q));
  });

  if(!state.ignoreSelectedOnly&&state.ignoreCategory==='character_special')opts=opts.sort(sortCharacterEffects);

  const optionHtml=o=>{
    const inherited=!globalMode&&state.globalIgnored.has(o.key);
    const checked=inherited||local.has(o.key);
    return `<label class="effect-option ${inherited?'disabled':''}"><input type="checkbox" data-ignore-key="${esc(o.key)}" ${checked?'checked':''} ${inherited?'disabled':''}><span>${esc(o.label)}${inherited?' <span class="muted">（共通設定）</span>':''}</span></label>`;
  };

  if(!opts.length){
    $('#ignoreEffectList').innerHTML='<div class="empty">該当する効果がありません。</div>';
  }else if(!state.ignoreSelectedOnly&&state.ignoreCategory==='character_special'){
    let html='',last=null;
    for(const o of opts){
      const ch=canonicalCharacterName(o);
      if(ch!==last){html+=`<div class="character-effect-group">${esc(characterDisplayName(ch))}</div>`;last=ch;}
      html+=optionHtml(o);
    }
    $('#ignoreEffectList').innerHTML=html;
  }else{
    $('#ignoreEffectList').innerHTML=opts.map(optionHtml).join('');
  }

  document.querySelectorAll('[data-ignore-key]').forEach(c=>c.onchange=()=>{
    const key=c.dataset.ignoreKey;
    if(c.checked)local.add(key);else local.delete(key);
    simIgnoreSettingsChanged();
    updateIgnoreButtons();
    renderIgnoreModal();
  });
  if($('#simGlobalIgnoreCount'))$('#simGlobalIgnoreCount').textContent=`(${state.globalIgnored.size})`;
  if($('#simHeroIgnoreCount'))$('#simHeroIgnoreCount').textContent=`(${state.hero?heroIgnoredSet(state.hero).size:0})`;
  if($('#simHeroIgnoreBtn'))$('#simHeroIgnoreBtn').disabled=!state.hero;
}
function openIgnore(mode){
  if(!state.relics.size)return;
  state.ignoreMode=mode;state.ignoreCategory='all';state.ignoreSelectedOnly=false;$('#ignoreSearch').value='';
  renderIgnoreModal();$('#ignoreModal').classList.remove('hidden');
}
function renderOriginalBlock(base,ignored){
  const m=relicMeta(base.relicId);
  return `<div class="relic"><div class="relic-head"><span class="dot" style="background:${COLOR_HEX[m.color]||'#999'}"></span><span class="relic-name">${esc(m.name)}</span>${!m.known?'<span class="deep">判定不能（色・通常／深層）</span>':m.deep?'<span class="deep">深層</span>':''}<span class="rid">#${base.relicId} / 0x${base.ga.toString(16).padStart(8,'0')}</span></div>${relicEffectsHtml(base,{ignoredKeys:ignored})}</div>`
}
function renderCandidateCard(p,slotIndex,item,currentGa,{outside=false}={}){
  const c=item.relic,m=relicMeta(c.relicId),chosen=c.ga===currentGa,conflict=!chosen&&usedInOtherSlot(p,slotIndex,c.ga),classes=relationCandidateClasses(item.rel,c);
  return `<div class="candidate-card ${chosen?'chosen':''} ${conflict?'disabled':''}" data-candidate-ga="${c.ga}" data-slot="${slotIndex}" data-conflict="${conflict?1:0}">
    <div class="candidate-head"><span class="dot" style="background:${COLOR_HEX[m.color]||'#999'}"></span><span class="relic-name">${esc(m.name)}</span>${!m.known?'<span class="deep">判定不能（色・通常／深層）</span>':m.deep?'<span class="deep">深層</span>':''}<span class="rid">#${c.relicId} / 0x${c.ga.toString(16).padStart(8,'0')}</span>${chosen?'<span class="candidate-status chosen">現在選択中</span>':conflict?'<span class="candidate-status conflict">他スロットで使用中</span>':outside?'<span class="candidate-status outside">現在の条件では候補外</span>':''}</div>
    ${relicEffectsHtml(c,{classes})}
    ${item.rel?.safeCurse?'<span class="safe-badge">デメリット同等以下</span>':''}
  </div>`
}
function renderCandidatePane(slotIndex){
  const pane=$('#candidatePane'),p=currentPreset();if(slotIndex==null||slotIndex<0||!p){pane.innerHTML='';return}
  const w=workingState(p),originalGa=w.original[slotIndex],currentGa=w.current[slotIndex],base=comparableRelic(originalGa);if(!base){pane.innerHTML='';return}
  const ignored=activeIgnoredKeys(),candidates=getCandidatesFor(p,slotIndex);
  let items=[...candidates],outside=false;
  if(currentGa!==originalGa&&!items.some(x=>x.ga===currentGa)){const cur=comparableRelic(currentGa);if(cur){items.unshift({ga:currentGa,relic:cur,rel:null});outside=true}}
  pane.innerHTML=`<div class="candidate-toolbar"><h2>改善候補</h2>${currentGa!==originalGa?`<button class="reset-current" id="resetCurrentBtn">元に戻す</button>`:''}</div>
    <div class="candidate-section-title">元の遺物</div>${renderOriginalBlock(base,ignored)}
    <div class="candidate-section-title">改善候補 ${candidates.length}件</div>
    ${items.length?`<div class="candidate-list">${items.map((x,i)=>renderCandidateCard(p,slotIndex,x,currentGa,{outside:outside&&i===0&&x.ga===currentGa})).join('')}</div>`:'<div class="candidate-placeholder">現在の評価条件では改善候補がありません。</div>'}`;
  const reset=$('#resetCurrentBtn');if(reset)reset.onclick=()=>resetWorkingSlot(p,slotIndex);
  document.querySelectorAll('.candidate-card[data-candidate-ga]').forEach(el=>el.onclick=()=>{if(el.dataset.conflict==='1')return;adoptCandidate(p,slotIndex,Number(el.dataset.candidateGa))})
}
function adoptCandidate(p,slotIndex,ga){const w=workingState(p);if(usedInOtherSlot(p,slotIndex,ga))return;w.current[slotIndex]=ga;state.selectedSlot=slotIndex;state.selectedGa=ga;renderPresets();renderCandidatePane(slotIndex)}
function resetWorkingSlot(p,slotIndex){const w=workingState(p);w.current[slotIndex]=w.original[slotIndex];state.selectedSlot=slotIndex;state.selectedGa=w.current[slotIndex];renderPresets();renderCandidatePane(slotIndex)}
function bindRelicClicks(){
  document.querySelectorAll('.relic.selectable[data-slot]').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-reset-slot]'))return;const slot=Number(el.dataset.slot),p=currentPreset(),w=workingState(p),replaced=w.current[slot]!==w.original[slot],count=getCandidatesFor(p,slot).length;if(!replaced&&count===0)return;state.selectedSlot=slot;state.selectedGa=w.current[slot];renderPresets();renderCandidatePane(slot)});
  document.querySelectorAll('[data-reset-slot]').forEach(b=>b.onclick=e=>{e.stopPropagation();const p=currentPreset();resetWorkingSlot(p,Number(b.dataset.resetSlot))})
}
function getHeroPresetList(){return state.presets.filter(p=>p.heroId===state.hero).sort((a,b)=>(a.counter-b.counter)||(a.index-b.index))}
function presetDisplayName(p,i){const name=p.name&&p.name.trim()?p.name.trim():'名称なし';return `${i+1}. ${name} — ${formatDate(p.timestamp)}`}
function syncPresetNav(){
  const list=getHeroPresetList();
  if(!list.length){
    state.currentPresetPos=0;
    $('#presetSelect').innerHTML='<option>プリセットなし</option>';
    $('#presetSelect').disabled=true;
    $('#prevPresetBtn').disabled=true;
    $('#nextPresetBtn').disabled=true;
    $('#presetPosition').textContent='';
    return;
  }
  if(state.currentPresetPos<0)state.currentPresetPos=0;
  if(state.currentPresetPos>=list.length)state.currentPresetPos=list.length-1;
  $('#presetSelect').innerHTML=list.map((p,i)=>`<option value="${i}" ${i===state.currentPresetPos?'selected':''}>${esc(presetDisplayName(p,i))}</option>`).join('');
  $('#presetSelect').disabled=false;
  $('#prevPresetBtn').disabled=state.currentPresetPos<=0;
  $('#nextPresetBtn').disabled=state.currentPresetPos>=list.length-1;
  $('#presetPosition').textContent=`${state.currentPresetPos+1} / ${list.length}`;
}
function changePreset(pos){
  const list=getHeroPresetList();
  if(!list.length)return;
  state.currentPresetPos=Math.max(0,Math.min(pos,list.length-1));
  state.selectedGa=0;state.selectedSlot=-1;
  renderPresets();
  renderCandidatePane(-1);
}

const SIM_CATEGORY_ORDER=['status','attack','skill_arts','magic','defense','resist','heal','action','starting_weapon','starting_enchant','starting_magic','starting_item','map_environment','team','character_special','weapon'];
const SIM_CATEGORY_LABELS={status:'能力値',attack:'攻撃力',skill_arts:'スキル／アーツ',magic:'魔術／祈祷',defense:'カット率',resist:'状態異常耐性',heal:'回復',action:'アクション',starting_weapon:'開始ボーナス：武器（戦技）',starting_enchant:'開始ボーナス：武器（付加）',starting_magic:'開始ボーナス：武器（魔術／祈祷）',starting_item:'出撃時のアイテム',map_environment:'マップ環境',team:'チームメンバー',character_special:'キャラクター固有',weapon:'特定武器のみ'};
const SIM_SHARED_VESSELS=[
 {name:"Giant's Cradle Grail",slots:['blue','blue','blue','blue','blue','blue']},{name:'Sacred Erdtree Grail',slots:['yellow','yellow','yellow','yellow','yellow','yellow']},{name:'Spirit Shelter Grail',slots:['green','green','green','green','green','green']},{name:'Scadutree Grail',slots:['red','red','red','red','red','red']}
];
const SIM_VESSELS={
1:[{name:"Wylder's Chalice",slots:['red','yellow','any','red','blue','green']},{name:"Wylder's Goblet",slots:['yellow','green','green','yellow','green','green']},{name:"Wylder's Urn",slots:['red','red','blue','red','red','blue']},{name:"Soot-Covered Wylder's Urn",slots:['blue','blue','yellow','blue','blue','yellow']},{name:"Sealed Wylder's Urn",slots:['blue','red','red','green','yellow','yellow']},{name:"Decrepit Wylder's Goblet",slots:['blue','green','yellow','blue','green','yellow']},{name:"Forgotten Wylder's Goblet",slots:['green','green','yellow','red','green','any']},...SIM_SHARED_VESSELS],
2:[{name:"Guardian's Chalice",slots:['blue','yellow','any','red','blue','yellow']},{name:"Guardian's Goblet",slots:['blue','blue','green','blue','blue','green']},{name:"Guardian's Urn",slots:['red','yellow','yellow','red','yellow','yellow']},{name:"Soot-Covered Guardian's Urn",slots:['red','green','green','red','green','green']},{name:"Sealed Guardian's Urn",slots:['yellow','yellow','red','green','green','blue']},{name:"Decrepit Guardian's Goblet",slots:['yellow','green','green','yellow','green','green']},{name:"Forgotten Guardian's Goblet",slots:['green','blue','blue','red','blue','any']},...SIM_SHARED_VESSELS],
3:[{name:"Ironeye's Chalice",slots:['red','green','any','red','red','green']},{name:"Ironeye's Goblet",slots:['red','blue','yellow','red','blue','yellow']},{name:"Ironeye's Urn",slots:['yellow','green','green','yellow','green','green']},{name:"Soot-Covered Ironeye's Urn",slots:['blue','yellow','yellow','blue','yellow','yellow']},{name:"Sealed Ironeye's Urn",slots:['green','green','yellow','blue','blue','red']},{name:"Decrepit Ironeye's Goblet",slots:['blue','blue','green','blue','blue','green']},{name:"Forgotten Ironeye's Goblet",slots:['yellow','blue','red','yellow','green','any']},...SIM_SHARED_VESSELS],
4:[{name:"Duchess' Chalice",slots:['blue','yellow','any','red','blue','yellow']},{name:"Duchess' Goblet",slots:['yellow','yellow','green','yellow','yellow','green']},{name:"Duchess' Urn",slots:['red','blue','blue','red','blue','blue']},{name:"Soot-Covered Duchess' Urn",slots:['red','red','green','red','red','green']},{name:"Sealed Duchess' Urn",slots:['blue','blue','red','green','green','yellow']},{name:"Decrepit Duchess' Goblet",slots:['blue','green','green','blue','green','green']},{name:"Forgotten Duchess' Goblet",slots:['green','yellow','yellow','red','green','any']},...SIM_SHARED_VESSELS],
5:[{name:"Raider's Chalice",slots:['red','red','any','red','yellow','yellow']},{name:"Raider's Goblet",slots:['red','blue','yellow','red','blue','yellow']},{name:"Raider's Urn",slots:['red','green','green','red','green','green']},{name:"Soot-Covered Raider's Urn",slots:['blue','blue','green','blue','blue','green']},{name:"Sealed Raider's Urn",slots:['green','green','red','yellow','blue','blue']},{name:"Decrepit Raider's Goblet",slots:['yellow','yellow','green','yellow','yellow','green']},{name:"Forgotten Raider's Goblet",slots:['yellow','blue','red','red','green','any']},...SIM_SHARED_VESSELS],
6:[{name:"Revenant's Chalice",slots:['blue','green','any','blue','yellow','green']},{name:"Revenant's Goblet",slots:['red','red','green','red','red','green']},{name:"Revenant's Urn",slots:['blue','blue','yellow','blue','blue','yellow']},{name:"Soot-Covered Revenant's Urn",slots:['red','yellow','yellow','red','yellow','yellow']},{name:"Sealed Revenant's Urn",slots:['yellow','blue','blue','green','green','red']},{name:"Decrepit Revenant's Goblet",slots:['red','red','yellow','red','red','yellow']},{name:"Forgotten Revenant's Goblet",slots:['green','red','red','yellow','green','any']},...SIM_SHARED_VESSELS],
7:[{name:"Recluse's Chalice",slots:['yellow','green','any','blue','green','green']},{name:"Recluse's Goblet",slots:['red','blue','yellow','red','blue','yellow']},{name:"Recluse's Urn",slots:['blue','blue','green','blue','blue','green']},{name:"Soot-Covered Recluse's Urn",slots:['red','red','yellow','red','red','yellow']},{name:"Sealed Recluse's Urn",slots:['green','blue','blue','yellow','yellow','red']},{name:"Decrepit Recluse's Goblet",slots:['red','red','blue','red','red','blue']},{name:"Forgotten Recluse's Goblet",slots:['yellow','blue','red','blue','green','any']},...SIM_SHARED_VESSELS],
8:[{name:"Executor's Chalice",slots:['blue','yellow','any','yellow','yellow','green']},{name:"Executor's Goblet",slots:['red','blue','green','red','blue','green']},{name:"Executor's Urn",slots:['red','yellow','yellow','red','yellow','yellow']},{name:"Soot-Covered Executor's Urn",slots:['red','red','blue','red','red','blue']},{name:"Sealed Executor's Urn",slots:['yellow','yellow','red','green','green','blue']},{name:"Decrepit Executor's Goblet",slots:['red','red','yellow','red','red','yellow']},{name:"Forgotten Executor's Goblet",slots:['green','blue','red','yellow','green','any']},...SIM_SHARED_VESSELS],
9:[{name:"Scholar's Chalice",slots:['red','blue','any','red','yellow','yellow']},{name:"Scholar's Goblet",slots:['blue','green','yellow','blue','green','yellow']},{name:"Scholar's Urn",slots:['red','red','yellow','red','red','yellow']},{name:"Sealed Scholar's Urn",slots:['yellow','red','red','green','blue','blue']},{name:"Soot-Covered Scholar's Urn",slots:['blue','green','green','blue','green','green']},{name:"Decrepit Scholar's Goblet",slots:['blue','blue','green','blue','blue','green']},{name:"Forgotten Scholar's Goblet",slots:['yellow','green','blue','red','green','any']},...SIM_SHARED_VESSELS],
10:[{name:"Undertaker's Chalice",slots:['green','yellow','any','blue','green','yellow']},{name:"Undertaker's Goblet",slots:['red','yellow','yellow','red','yellow','yellow']},{name:"Undertaker's Urn",slots:['blue','green','green','blue','green','green']},{name:"Sealed Undertaker's Urn",slots:['green','green','blue','yellow','red','red']},{name:"Soot-Covered Undertaker's Urn",slots:['red','red','blue','red','red','blue']},{name:"Decrepit Undertaker's Goblet",slots:['red','blue','blue','red','blue','blue']},{name:"Forgotten Undertaker's Goblet",slots:['yellow','yellow','red','blue','yellow','green']},...SIM_SHARED_VESSELS]
};
function simBaseLabel(name){return ignoreBaseLabel(name).replace(/\s*[（(](?:通常|深層)[）)]\s*$/,'').trim()}
function simRuleMasterForEffect(id,relic){
 const meta=relicMeta(relic.relicId);if(!meta.known)return null;
 const deep=meta.deep;
 const candidates=EFFECT_RULES_BY_ID.get(Number(id))||[];
 return candidates.find(r=>deep?r.deepAvailable:r.normalAvailable)||null
}
function simRuleName(rule){return rule?.displayNameJa||rule?.displayName||''}
function simRuleMode(rule){
 if(!rule)return 'boolean';
 if(rule.uiMode==='RANK_SUM')return 'rank_sum';
 if(rule.uiMode==='COUNT')return 'count';
 if(rule.uiMode==='UNIQUE_LEVEL')return 'unique_level';
 return 'boolean'
}
function simConflictGroupFromRule(rule){
 const g=rule?.conflictGroup||null;
 return g?String(g).toLowerCase():null
}
function simEffectKeyFor(id,relic){
 const rule=simRuleMasterForEffect(id,relic);
 if(!rule)return `unmapped:${id}`;
 const e=effectInfo(id);
 if(rule.uiMode==='UNIQUE_LEVEL')return `${rule.masterKey}:level:${e.level??0}`;
 return rule.masterKey
}
function simCatalog(){
 const ignored=activeIgnoredKeys(), map=new Map();
 for(const r of state.relics.values()){
  const meta=relicMeta(r.relicId);
  for(const id of r.effects||[]){
   const e=effectInfo(id),rule=simRuleMasterForEffect(id,r);
   if(!rule)continue;
   const cat=rule.category||effectCategory(e);
   if(cat.startsWith('demerit_')||rule.ruleType==='DEMERIT'||isEffectIgnored(id,ignored))continue;
   if(cat==='character_special'&&rule.character&&rule.character!==(HERO_NAMES[state.hero]||''))continue;
   const key=simEffectKeyFor(id,r), base=simRuleName(rule);
   let item=map.get(key);
   if(!item){item={key,base,cat,ids:new Set(),levels:new Set(),normalLevels:new Set(),deepLevels:new Set(),normalCount:0,deepCount:0,group:rule.effectGroup,display:base,master:rule};map.set(key,item)}
   item.ids.add(id);item.levels.add(e.level??0);
   if(meta.deep){item.deepLevels.add(e.level??0);item.deepCount++}else{item.normalLevels.add(e.level??0);item.normalCount++}
  }
 }
 for(const item of map.values()){
  const rule=item.master;
  item.rule=simRuleMode(rule);
  if((rule.normalAvailable&&!rule.deepAvailable)||(rule.deepAvailable&&!rule.normalAvailable)){
   item.display+=rule.deepAvailable?'（深層）':'（通常）';
  }
  if(item.rule==='rank_sum'){
   item.rankZeroBased=!!rule.zeroBasedRank;
   const nmax=rule.normalAvailable?(rule.normalRankMax??(item.rankZeroBased?0:null)):null;
   const dmax=rule.deepAvailable?(rule.deepRankMax??(item.rankZeroBased?0:null)):null;
   const nSlots=rule.normalAvailable?3:0,dSlots=rule.deepAvailable?3:0;
   const nPoints=nmax==null?0:(nmax+(item.rankZeroBased?1:0))*nSlots;
   const dPoints=dmax==null?0:(dmax+(item.rankZeroBased?1:0))*dSlots;
   const mins=[rule.normalRankMin,rule.deepRankMin].filter(v=>v!=null);
   item.min=item.rankZeroBased?0:(mins.length?Math.min(...mins):0);
   item.max=nPoints+dPoints-(item.rankZeroBased?1:0);
   if(item.max<item.min)item.max=item.min;
  }else if(item.rule==='count'){
   item.min=1;
   item.max=(rule.normalAvailable?3:0)+(rule.deepAvailable?3:0);
  }
  // The official maximum limits selectable targets, not actual measured copies.
  if((item.rule==='count'||item.rule==='rank_sum')&&Number.isFinite(rule.theoreticalMax)&&rule.theoreticalMax>=item.min){
   item.max=Math.min(item.max,Math.floor(rule.theoreticalMax));
  }
 }
 return [...map.values()].sort((a,b)=>(a.master.displayOrder??999999)-(b.master.displayOrder??999999)||a.display.localeCompare(b.display,'ja'));
}
function simRenderHeroes(){
 const ids=Object.keys(HERO_NAMES).map(Number);const html=state.relics.size?ids.map(id=>`<button class="hero-btn ${state.hero===id?'active':''}" data-sim-hero="${id}">${esc(HERO_NAMES[id])}</button>`).join(''):'<span class="muted">セーブ読込後に表示します。</span>';$('#simHeroList').innerHTML=html;
 document.querySelectorAll('[data-sim-hero]').forEach(b=>b.onclick=()=>{state.hero=Number(b.dataset.simHero);activateSimConditionsForHero(state.hero);simDemeritFilterState(state.hero);state.simAdditionalCandidates=[];state.simAdditionalStats=null;state.currentPresetPos=0;state.selectedGa=0;state.selectedSlot=-1;state.simResults=[];state.simSelectedResult=-1;renderHeroes();renderPresets();renderCandidatePane(-1);updateIgnoreButtons();renderSimulator();requestAnimationFrame(updateStickyOffsets);persistAppState();});
}
function simConflictUiClass(group){
 return group?`leftmost-group leftmost-${group.replaceAll('_','-')}`:''
}
function simSelectedConflictGroups(cat){
 const groups=new Set();
 for(const [k] of state.simConditions){
  const item=cat.find(x=>x.key===k),cg=simUiConflictGroup(item);
  if(!cg)continue;
  if(state.hero===6&&(cg==='start_skill'||cg==='start_magic'))groups.add('revenant_start_skill_magic');
  else groups.add(cg);
 }
 return groups
}
function simConflictUiNormalized(group){
 if(state.hero===6&&(group==='start_skill'||group==='start_magic'))return 'revenant_start_skill_magic';
 return group
}
function simOptionHtml(item){
 const cond=state.simConditions.get(item.key);let control='';
 if(item.rule==='rank_sum'){let opts=[];for(let v=item.min;v<=item.max;v++)opts.push(`<option value="${v}" ${cond?.value===v?'selected':''}>+${v}</option>`);control=`<select data-sim-value="${esc(item.key)}">${opts.join('')}</select>`}
 else if(item.rule==='count'){let opts=[];for(let v=1;v<=Math.max(1,item.max);v++)opts.push(`<option value="${v}" ${cond?.value===v?'selected':''}>${v}個</option>`);control=`<select data-sim-value="${esc(item.key)}">${opts.join('')}</select>`}
 let label=item.display;if(item.rule==='unique_level'){const lv=Math.max(...item.levels);if(lv>0&&!/[＋+]\s*\d+\s*$/.test(label))label+=`＋${lv}`}
 const cg=simUiConflictGroup(item), normalized=simConflictUiNormalized(cg);
 const selectedGroups=simSelectedConflictGroups(window.__simRenderCatalog||[]);
 const dimmed=!!cg&&!cond&&selectedGroups.has(normalized);
 const cls=[cond?'checked':'',simConflictUiClass(cg),dimmed?'leftmost-dimmed':''].filter(Boolean).join(' ');
 return `<label class="sim-effect ${cls}"${cg?` data-leftmost-group="${esc(cg)}"`:''}><input type="checkbox" data-sim-check="${esc(item.key)}" ${cond?'checked':''}><span class="sim-effect-label">${esc(label)}</span>${control}</label>`;
}
function renderSimulator(){simRenderHeroes();updateIgnoreButtons();if(!state.relics.size){$('#simEffectCategories').innerHTML='<div class="sim-empty">セーブデータをインポートしてください。</div>';$('#simSearchBtn').disabled=true;$('#simAdditionalSearchBtn').disabled=true;return}const cat=simCatalog();
 // Rule-master migrations must not invalidate the user's saved selections.
 // If an effect changed from ON/OFF to exact-count, preserve it as 1 copy.
 let conditionRuleMigrated=false;
 for(const [k,c] of state.simConditions){
  const item=cat.find(x=>x.key===k);if(!item)continue;
  if(c.rule!==item.rule){
   c.rule=item.rule;c.label=item.display;
   if(item.rule==='count')c.value=Math.max(1,Number(c.value)||1);
   else if(item.rule==='rank_sum')c.value=Math.min(item.max,Math.max(item.min,Number(c.value)||item.min));
   else c.value=null;
   state.simConditions.set(k,c);conditionRuleMigrated=true
  }else if(item.rule==='count'&&(!Number.isFinite(Number(c.value))||Number(c.value)<1)){
   c.value=1;state.simConditions.set(k,c);conditionRuleMigrated=true
  }
  if((item.rule==='count'||item.rule==='rank_sum')&&Number(c.value)>item.max){
   c.value=item.max;state.simConditions.set(k,c);conditionRuleMigrated=true;
  }
 }
 if(conditionRuleMigrated){simSearchConditionsChanged();persistAppState();}
 // Do not destructively delete saved search conditions merely because an item is not
 // visible in the current render pass. This keeps selections stable across tab changes
 // and page reloads; visibility/filtering is handled separately from persisted state.
 // Older saved states may contain multiple choices from one LEFTMOST_WINS group.
 // Keep the last selected condition and remove the others so the UI/search state is consistent.
 const seenUiConflict=new Map();
 for(const [k] of [...state.simConditions]){
  const item=cat.find(x=>x.key===k),cg=simUiConflictGroup(item);
  if(!cg)continue;
  const normalized=(state.hero===6&&(cg==='start_skill'||cg==='start_magic'))?'revenant_start_skill_magic':cg;
  if(seenUiConflict.has(normalized))state.simConditions.delete(seenUiConflict.get(normalized));
  seenUiConflict.set(normalized,k);
 }
 window.__simRenderCatalog=cat;
 const by=new Map();for(const x of cat){if(!by.has(x.cat))by.set(x.cat,[]);by.get(x.cat).push(x)}
 let html=`<div class="sim-leftmost-legend"><span class="skill"><i></i>開始戦技変更</span><span class="affinity"><i></i>開始属性・状態異常付与</span><span class="magic"><i></i>開始魔術・祈祷変更</span><span class="weaponfind"><i></i>潜在する力：武器種発見</span></div>`;
 for(const c of SIM_CATEGORY_ORDER){const xs=by.get(c);if(!xs?.length)continue;html+=`<section class="sim-category"><div class="sim-category-title">${esc(SIM_CATEGORY_LABELS[c]||c)}</div><div class="sim-effect-grid">${xs.map(simOptionHtml).join('')}</div></section>`}
 $('#simEffectCategories').innerHTML=html||'<div class="sim-empty">表示できるメリット効果がありません。</div>';simUpdateSearchButtons();$('#simConditionSummary').textContent=`検索条件：${state.simConditions.size}件`;
 document.querySelectorAll('[data-sim-check]').forEach(ch=>ch.onchange=()=>{
  const k=ch.dataset.simCheck,item=cat.find(x=>x.key===k);
  if(ch.checked){
   const cg=simUiConflictGroup(item);
   if(cg){
    const conflictSet=simUiConflictSet(cg);
    for(const [otherKey] of [...state.simConditions]){
     if(otherKey===k)continue;
     const other=cat.find(x=>x.key===otherKey);
     if(other&&conflictSet.has(simUiConflictGroup(other)))state.simConditions.delete(otherKey);
    }
   }
   let v=null;if(item.rule==='rank_sum')v=item.min;else if(item.rule==='count')v=1;
   state.simConditions.set(k,{key:k,value:v,rule:item.rule,label:item.display})
  }else state.simConditions.delete(k);
  simSearchConditionsChanged();persistAppState();renderSimulator()
 });
 document.querySelectorAll('[data-sim-value]').forEach(sel=>sel.onchange=()=>{const k=sel.dataset.simValue,c=state.simConditions.get(k);if(c){const next=Number(sel.value);if(c.value!==next){c.value=next;state.simConditions.set(k,c);simSearchConditionsChanged();persistAppState();renderSimResults()}}});
 renderSimAdditionalCandidates();renderSimDemeritFilter();renderSimResults();}
function simColorIndex(name){return {red:0,blue:1,yellow:2,green:3}[name]}
function simRelicFitsSlot(r,slotColor,slotIndex){const m=relicMeta(r.relicId);if(!m.known)return false;if((slotIndex<3&&m.deep)||(slotIndex>=3&&!m.deep))return false;if(slotColor==='any')return true;return m.color===simColorIndex(slotColor)}
function simConflictGroup(name){
 const n=String(name||'');
 if(/^潜在する力から、.+を見つけやすくなる$/.test(n))return 'weapon_find';
 if(/出撃時の武器/.test(n)&&/戦技/.test(n))return 'start_skill';
 if(/出撃時の武器/.test(n)&&/魔術|祈祷|杖|聖印/.test(n))return 'start_magic';
 if(/出撃時の武器/.test(n)&&/魔力|炎|雷|聖|毒|出血|冷気|属性/.test(n))return 'start_affinity';
 return null
}
function simConflictGroupForEffect(id,relic){
 const rule=simRuleMasterForEffect(id,relic);
 return simConflictGroupFromRule(rule)||simConflictGroup(effectName(id))
}
function simUiConflictGroup(item){return simConflictGroupFromRule(item?.master)||simConflictGroup(item?.display||item?.base||'')}
function simUiConflictSet(group){
 // 復讐者のみ、開始戦技変更と開始魔術/祈祷変更も相互競合。
 if(state.hero===6&&(group==='start_skill'||group==='start_magic'))return new Set(['start_skill','start_magic']);
 return new Set(group?[group]:[])
}
function simEffectiveConflictKey(cg){
 if(state.hero===6&&(cg==='start_skill'||cg==='start_magic'))return 'revenant_start_skill_magic';
 return cg
}
function simEffectiveRecords(relics){const out=[],seenConflict=new Set();for(let si=0;si<relics.length;si++){const r=relics[si];for(const id of r.effects||[]){const e=effectInfo(id),cg=simConflictGroupForEffect(id,r),ck=simEffectiveConflictKey(cg);if(ck){if(seenConflict.has(ck))continue;seenConflict.add(ck)}out.push({id,e,relic:r,slot:si})}}return out}
let simSearchRankMetaCache=null;
function simRankMetaMap(){
 if(simSearchRankMetaCache)return simSearchRankMetaCache;
 const m=new Map();
 for(const item of simCatalog())if(item.rule==='rank_sum')m.set(item.key,{zeroBased:!!item.rankZeroBased});
 return m
}
function simRankPoints(key,level,rankMeta){return (level??0)+((rankMeta.get(key)?.zeroBased)?1:0)}
function simRankTargetPoints(key,value,rankMeta){return Number(value)+((rankMeta.get(key)?.zeroBased)?1:0)}
function simMeasureConditions(relics){const recs=simEffectiveRecords(relics),wanted=new Set(state.simConditions.keys()),rankMeta=simRankMetaMap(),measures=new Map();for(const rec of recs){const k=simEffectKeyFor(rec.id,rec.relic);if(!wanted.has(k))continue;let m=measures.get(k)||{count:0,sum:0,present:false};m.count++;m.sum+=simRankPoints(k,rec.e.level??0,rankMeta);m.present=true;measures.set(k,m)}return measures}
function simMatches(relics){const measures=simMeasureConditions(relics);for(const [k,c] of state.simConditions){const m=measures.get(k)||{count:0,sum:0,present:false};if(c.rule==='rank_sum'){const rankMeta=simRankMetaMap();if(!m.present||m.sum!==simRankTargetPoints(k,c.value,rankMeta))return false}else if(c.rule==='count'){if(m.count!==c.value)return false}else if(!m.present)return false}return true}
function simBuildSearchInfo(){
 const wanted=new Set(state.simConditions.keys()), rankMeta=simRankMetaMap(), info=new Map();
 for(const r of state.relics.values()){
  const direct=[], conflicts=[];
  for(const id of r.effects||[]){
   const e=effectInfo(id),cg=simConflictGroupForEffect(id,r),key=simEffectKeyFor(id,r);
   const rec={key,level:simRankPoints(key,e.level??0,rankMeta),wanted:wanted.has(key)};
   if(cg)conflicts.push({...rec,cg:simEffectiveConflictKey(cg)}); else if(rec.wanted)direct.push(rec);
  }
  info.set(r.ga,{direct,conflicts,contributes:direct.length>0||conflicts.some(x=>x.wanted)});
 }
 return info
}
function simCandidatePools(vessel,searchInfo){
 const all=[...state.relics.values()];
 return vessel.slots.map((color,i)=>all.filter(r=>simRelicFitsSlot(r,color,i)).sort((a,b)=>Number(searchInfo.get(b.ga)?.contributes)-Number(searchInfo.get(a.ga)?.contributes)))
}
function simApplyRelic(r,searchInfo,measures,seenConflicts){
 const changes=[],newConflicts=[];const inf=searchInfo.get(r.ga)||{direct:[],conflicts:[]};
 const addRec=rec=>{let m=measures.get(rec.key);if(!m){m={count:0,sum:0,present:false};measures.set(rec.key,m)}changes.push([rec.key,m.count,m.sum,m.present]);m.count++;m.sum+=rec.level;m.present=true};
 for(const rec of inf.direct)addRec(rec);
 for(const rec of inf.conflicts){if(seenConflicts.has(rec.cg))continue;seenConflicts.add(rec.cg);newConflicts.push(rec.cg);if(rec.wanted)addRec(rec)}
 return ()=>{for(let i=changes.length-1;i>=0;i--){const [k,c,s,p]=changes[i],m=measures.get(k);m.count=c;m.sum=s;m.present=p;if(!c&&!s&&!p)measures.delete(k)}for(const cg of newConflicts)seenConflicts.delete(cg)}
}
function simMeasureMatches(measures){const rankMeta=simRankMetaMap();for(const [k,c] of state.simConditions){const m=measures.get(k)||{count:0,sum:0,present:false};if(c.rule==='rank_sum'){if(!m.present||m.sum!==simRankTargetPoints(k,c.value,rankMeta))return false}else if(c.rule==='count'){if(m.count!==c.value)return false}else if(!m.present)return false}return true}
function simExceeded(measures){const rankMeta=simRankMetaMap();for(const [k,c] of state.simConditions){const m=measures.get(k);if(!m)continue;if(c.rule==='rank_sum'&&m.sum>simRankTargetPoints(k,c.value,rankMeta))return true;if(c.rule==='count'&&m.count>c.value)return true}return false}
function simRemainingBounds(pools,searchInfo){
 const bounds=Array(7);bounds[6]=new Map();
 for(let d=5;d>=0;d--){const cur=new Map();for(const [k,v] of bounds[d+1])cur.set(k,{sum:v.sum,count:v.count,present:v.present});
  const slotMax=new Map();for(const r of pools[d]){const inf=searchInfo.get(r.ga);if(!inf)continue;for(const rec of [...inf.direct,...inf.conflicts]){if(!rec.wanted)continue;let x=slotMax.get(rec.key)||{sum:0,count:0,present:false};x.sum=Math.max(x.sum,rec.level);x.count=1;x.present=true;slotMax.set(rec.key,x)}}
  for(const [k,x] of slotMax){let v=cur.get(k)||{sum:0,count:0,present:false};v={sum:v.sum+x.sum,count:v.count+x.count,present:v.present||x.present};cur.set(k,v)}bounds[d]=cur
 }
 return bounds
}
function simCanStillReach(measures,bound,depth){const rankMeta=simRankMetaMap();for(const [k,c] of state.simConditions){const m=measures.get(k)||{count:0,sum:0,present:false},b=bound[depth]?.get(k)||{sum:0,count:0,present:false};if(c.rule==='rank_sum'){const target=simRankTargetPoints(k,c.value,rankMeta);if(m.sum>target||m.sum+b.sum<target)return false}else if(c.rule==='count'){if(m.count>c.value||m.count+b.count<c.value)return false}else if(!m.present&&!b.present)return false}return true}
function simContributionSignature(inf){
 const direct=(inf?.direct||[]).map(x=>`D:${x.key}:${x.level}`).sort();
 const conflicts=(inf?.conflicts||[]).map(x=>`C:${x.cg}:${x.key}:${x.level}:${x.wanted?1:0}`).sort();
 return direct.concat(conflicts).join('|')||'__FILLER__'
}
function simGroupedCandidatePools(vessel,searchInfo){
 const raw=simCandidatePools(vessel,searchInfo);
 return raw.map(pool=>{
  const groups=new Map();
  for(const relic of pool){
   const inf=searchInfo.get(relic.ga)||{direct:[],conflicts:[]};
   const sig=simContributionSignature(inf);
   let g=groups.get(sig);
   if(!g){g={sig,info:inf,members:[]};groups.set(sig,g)}
   g.members.push(relic)
  }
  return [...groups.values()].sort((a,b)=>{
   const ac=a.sig==='__FILLER__'?0:1,bc=b.sig==='__FILLER__'?0:1;
   return bc-ac||b.members.length-a.members.length
  })
 })
}
function simRemainingGroupBounds(groupPools){
 const bounds=Array(7);bounds[6]=new Map();
 for(let d=5;d>=0;d--){
  const cur=new Map();for(const [k,v] of bounds[d+1])cur.set(k,{sum:v.sum,count:v.count,present:v.present});
  const slotMax=new Map();
  for(const g of groupPools[d])for(const rec of [...(g.info.direct||[]),...(g.info.conflicts||[])]){
   if(!rec.wanted)continue;
   const x=slotMax.get(rec.key)||{sum:0,count:0,present:false};
   x.sum=Math.max(x.sum,rec.level);x.count=1;x.present=true;slotMax.set(rec.key,x)
  }
  for(const [k,x] of slotMax){const v=cur.get(k)||{sum:0,count:0,present:false};cur.set(k,{sum:v.sum+x.sum,count:v.count+x.count,present:v.present||x.present})}
  bounds[d]=cur
 }
 return bounds
}
function simApplyGroup(group,measures,seenConflicts){
 const changes=[],newConflicts=[];const inf=group.info||{direct:[],conflicts:[]};
 const addRec=rec=>{let m=measures.get(rec.key);if(!m){m={count:0,sum:0,present:false};measures.set(rec.key,m)}changes.push([rec.key,m.count,m.sum,m.present]);m.count++;m.sum+=rec.level;m.present=true};
 for(const rec of inf.direct||[])addRec(rec);
 for(const rec of inf.conflicts||[]){if(seenConflicts.has(rec.cg))continue;seenConflicts.add(rec.cg);newConflicts.push(rec.cg);if(rec.wanted)addRec(rec)}
 return ()=>{for(let i=changes.length-1;i>=0;i--){const [k,c,sum,p]=changes[i],m=measures.get(k);m.count=c;m.sum=sum;m.present=p;if(!c&&!sum&&!p)measures.delete(k)}for(const cg of newConflicts)seenConflicts.delete(cg)}
}
function simDemeritNamesFromRelics(relics){
 const out=[];
 for(const r of relics||[])for(const id of r.curses||[]){const n=effectName(id);if(n)out.push(n)}
 return out
}
function simHasExcludedDemerit(relics){
 const excluded=simDemeritFilterState().names;
 if(!excluded.size)return false;
 return simDemeritNamesFromRelics(relics).some(n=>excluded.has(n))
}
function simMaterializeGroupPattern(vessel,groups,limit){
 const out=[],chosen=Array(6),used=new Set();
 function rec(depth){
  if(out.length>=limit)return;
  if(depth===6){
   const relics=[...chosen];
   // Pattern search and actual relic expansion must use the identical exact-match rule.
   // This also guards future changes to rank aggregation / conflict handling.
   if(simMatches(relics)&&!simHasExcludedDemerit(relics)&&!simHasExcludedBenefit(relics))out.push({vessel,relics});
   return
  }
  for(const relic of groups[depth].members){
   if(used.has(relic.ga))continue;
   used.add(relic.ga);chosen[depth]=relic;rec(depth+1);used.delete(relic.ga);
   if(out.length>=limit)return
  }
 }
 rec(0);return out
}

function simAdditionalUniverse(cat){
 const out=new Map(),existing=state.simConditions;
 const activeConflictGroups=new Set();
 for(const [k] of existing){
  const item=cat.find(x=>x.key===k),cg=simUiConflictGroup(item);
  if(cg)activeConflictGroups.add(simConflictUiNormalized(cg))
 }
 for(const item of cat){
  const cur=existing.get(item.key),cg=simUiConflictGroup(item);
  if(!cur&&cg&&activeConflictGroups.has(simConflictUiNormalized(cg)))continue;
  if(cur){
   if(item.rule==='rank_sum'||item.rule==='count'){
    for(let v=Number(cur.value)+1;v<=item.max;v++){
     const id=`${item.key}::${v}`;
     out.set(id,{id,key:item.key,value:v,rule:item.rule,label:item.display,cat:item.cat,item,kind:'upgrade',from:Number(cur.value)})
    }
   }
   continue
  }
  if(item.rule==='rank_sum'||item.rule==='count'){
   for(let v=item.min;v<=item.max;v++){
    const id=`${item.key}::${v}`;
    out.set(id,{id,key:item.key,value:v,rule:item.rule,label:item.display,cat:item.cat,item,kind:'new'})
   }
  }else{
   const id=`${item.key}::on`;
   out.set(id,{id,key:item.key,value:null,rule:item.rule,label:item.display,cat:item.cat,item,kind:'new'})
  }
 }
 return out
}
function simAdditionalBaseStatus(measures){
 const rankMeta=simRankMetaMap(),upgrades=[];
 for(const [k,c] of state.simConditions){
  const m=measures.get(k)||{count:0,sum:0,present:false};
  if(c.rule==='rank_sum'){
   const target=simRankTargetPoints(k,c.value,rankMeta);
   if(!m.present||m.sum<target)return null;
   if(m.sum>target)upgrades.push([k,m.sum-(rankMeta.get(k)?.zeroBased?1:0)]);
  }else if(c.rule==='count'){
   if(m.count<c.value)return null;
   if(m.count>c.value)upgrades.push([k,m.count]);
  }else if(!m.present)return null
 }
 return upgrades.length<=1?upgrades:null
}
function simAdditionalCanStillReach(measures,bounds,depth){
 const rankMeta=simRankMetaMap();let alreadyHigher=0;
 for(const [k,c] of state.simConditions){
  const m=measures.get(k)||{count:0,sum:0,present:false},b=bounds[depth]?.get(k)||{sum:0,count:0,present:false};
  if(c.rule==='rank_sum'){
   const target=simRankTargetPoints(k,c.value,rankMeta);
   if(m.sum>target)alreadyHigher++;
   if(m.sum+b.sum<target)return false
  }else if(c.rule==='count'){
   if(m.count>c.value)alreadyHigher++;
   if(m.count+b.count<c.value)return false
  }else if(!m.present&&!b.present)return false
 }
 return alreadyHigher<=1
}
function simMeasureAllCatalogBenefits(relics,cat){
 const byKey=new Map(cat.map(x=>[x.key,x])),ignored=activeIgnoredKeys(),rankMeta=simRankMetaMap(),measures=new Map();
 for(const rec of simEffectiveRecords(relics)){
  if(isEffectIgnored(rec.id,ignored))continue;
  // simCatalog already applies the patched rule master, hero and ignore filters.
  // Reuse that catalog instead of reclassifying Japanese labels with legacy rules.
  const k=simEffectKeyFor(rec.id,rec.relic),item=byKey.get(k);if(!item)continue;
  let m=measures.get(k);if(!m){m={count:0,sum:0,present:false};measures.set(k,m)}
  m.count++;m.sum+=simRankPoints(k,rec.e.level??0,rankMeta);m.present=true
 }
 return measures
}
function simCollectAdditionalFromComposition(relics,cat,universe,found,mode){
 const measures=simMeasureAllCatalogBenefits(relics,cat),rankMeta=simRankMetaMap();
 if(mode==='new'){
  for(const item of cat){
   if(state.simConditions.has(item.key))continue;
   const cg=simUiConflictGroup(item);
   if(cg){
    let blocked=false;
    for(const [k] of state.simConditions){
     const other=cat.find(x=>x.key===k);
     if(other&&simConflictUiNormalized(simUiConflictGroup(other))===simConflictUiNormalized(cg)){blocked=true;break}
    }
    if(blocked)continue
   }
   const m=measures.get(item.key);if(!m?.present)continue;
   let id;
   if(item.rule==='rank_sum')id=`${item.key}::${m.sum-(rankMeta.get(item.key)?.zeroBased?1:0)}`;
   else if(item.rule==='count')id=`${item.key}::${m.count}`;
   else id=`${item.key}::on`;
   if(universe.has(id))found.set(id,universe.get(id))
  }
 }else if(mode?.key){
  const item=cat.find(x=>x.key===mode.key),m=measures.get(mode.key);
  if(!item||!m?.present)return;
  let value=item.rule==='rank_sum'?m.sum-(rankMeta.get(item.key)?.zeroBased?1:0):m.count;
  const id=`${item.key}::${value}`;
  if(universe.has(id))found.set(id,universe.get(id))
 }
}
async function simEnumerateActualForAdditional(groups,onComposition,progress){
 const searchRevision=simSearchRevision;
 const chosen=Array(6),used=new Set();let stopped=false;
 async function rec(depth){
  if(stopped||state.simAdditionalCancelRequested||searchRevision!==simSearchRevision){stopped=true;return true;}
  if(depth===6){
   progress.actual++;
   // Share normal search's demerit rule before either new or upgrade collection.
   // Rejected compositions must not trigger the upgrade branch's early stop.
   const res=(simHasExcludedDemerit(chosen)||simHasExcludedBenefit(chosen))?false:onComposition([...chosen]);
   if(res===true){stopped=true;return true}
   if((progress.actual&2047)===0&&performance.now()-progress.lastYield>30){
    progress.lastYield=performance.now();await new Promise(r=>setTimeout(r,0))
   }
   return false
  }
  for(const relic of groups[depth].members){
   if(used.has(relic.ga))continue;
   used.add(relic.ga);chosen[depth]=relic;
   if(await rec(depth+1)){used.delete(relic.ga);return true}
   used.delete(relic.ga)
  }
  return false
 }
 await rec(0);return stopped
}
function renderSimAdditionalCandidates(){
 const host=$('#simAdditionalCandidates');if(!host)return;
 const list=state.simAdditionalCandidates||[],stats=state.simAdditionalStats;
 if(!list.length&&!stats){host.innerHTML='';return}
 const fmt=v=>v.rule==='rank_sum'?`+${v.value}`:v.rule==='count'?`${v.value}個`:'';
 const upgrades=list.filter(x=>x.kind==='upgrade');
 const additions=list.filter(x=>x.kind!=='upgrade');
 const order=new Map(SIM_CATEGORY_ORDER.map((c,i)=>[c,i]));
 const sorter=(a,b)=>(order.get(a.cat)??99)-(order.get(b.cat)??99)||a.label.localeCompare(b.label,'ja')||(a.value??0)-(b.value??0);
 upgrades.sort(sorter);additions.sort(sorter);
 const group=(title,items)=>items.length?`<div class="sim-additional-group"><div class="sim-additional-group-title">${title}</div><div class="sim-additional-grid">${items.map(x=>{
   const label=x.kind==='upgrade'?`${esc(x.label)} <span class="arrow">${x.rule==='rank_sum'?`+${x.from}`:`${x.from}個`} →</span> ${fmt(x)}`:`${esc(x.label)}${fmt(x)?` ${fmt(x)}`:''}`;
   return `<button class="sim-additional-item ${x.kind==='upgrade'?'upgrade':''}" data-sim-additional="${esc(x.id)}">${label}</button>`
 }).join('')}</div></div>`:'';
 const statsText=stats?`${stats.patterns.toLocaleString()}探索パターン / ${stats.compositions.toLocaleString()}実構成 / ${stats.elapsed}`:'';
 host.innerHTML=`<div class="sim-additional-box"><div class="sim-additional-head"><div><div class="sim-additional-title">追加スキル候補（${list.length}件）</div><div class="sim-additional-help">候補を選ぶと現在の検索条件へ反映します。既存の加算・個数条件の上位候補を優先表示しています。</div></div><div class="sim-additional-stats">${statsText}</div></div>${list.length?group('現在の条件を強化',upgrades)+group('新しく追加できる効果',additions):'<div class="sim-additional-empty">現在の条件から追加できる効果は見つかりませんでした。</div>'}</div>`;
 document.querySelectorAll('[data-sim-additional]').forEach(btn=>btn.onclick=()=>{
  const c=(state.simAdditionalCandidates||[]).find(x=>x.id===btn.dataset.simAdditional);if(!c)return;
  const cat=simCatalog(),item=cat.find(x=>x.key===c.key);if(!item)return;
  const cg=simUiConflictGroup(item);
  if(cg){
   const conflictSet=simUiConflictSet(cg);
   for(const [otherKey] of [...state.simConditions]){
    if(otherKey===c.key)continue;
    const other=cat.find(x=>x.key===otherKey);
    if(other&&conflictSet.has(simUiConflictGroup(other)))state.simConditions.delete(otherKey)
   }
  }
  state.simConditions.set(c.key,{key:c.key,value:(c.rule==='rank_sum'||c.rule==='count')?c.value:null,rule:c.rule,label:item.display});
  simSearchConditionsChanged();persistAppState();renderSimulator()
 })
}
async function runSimulatorAdditionalSearch(){
 if(!state.relics.size)return;
 if(!state.simConditions.size){alert('まず検索条件を1つ以上選択してください。');return}
 const searchRevision=simBeginSearch('additional');
 const started=performance.now(),formatElapsed=ms=>{if(ms<1000)return `${Math.round(ms)}ms`;const s=ms/1000;if(s<60)return `${s.toFixed(s<10?2:1)}秒`;const m=Math.floor(s/60),rs=s-m*60;return `${m}分${rs.toFixed(1)}秒`};
 simUpdateSearchButtons();
 state.simAdditionalCandidates=[];state.simAdditionalStats=null;renderSimAdditionalCandidates();
 simSearchRankMetaCache=simRankMetaMap();
 await new Promise(r=>setTimeout(r,0));
 if(searchRevision!==simSearchRevision)return;
 const cat=simCatalog(),universe=simAdditionalUniverse(cat),found=new Map(),searchInfo=simBuildSearchInfo(),vessels=SIM_VESSELS[state.hero]||[];
 let patterns=0,actual=0,lastYield=performance.now(),stopAll=false;
 const progress={actual:0,lastYield};
 try{
  outer:for(const vessel of vessels){
   if(state.simAdditionalCancelRequested||searchRevision!==simSearchRevision)break outer;
   const groupPools=simGroupedCandidatePools(vessel,searchInfo);if(groupPools.some(p=>!p.length))continue;
   const bounds=simRemainingGroupBounds(groupPools),measures=new Map(),seenConflicts=new Set(),chosenGroups=[];
   async function dfs(depth){
    if(searchRevision!==simSearchRevision)return true;
    if(state.simAdditionalCancelRequested){stopAll=true;return true}
    if(stopAll)return true;
    if(!simAdditionalCanStillReach(measures,bounds,depth))return false;
    if(depth===6){
     const upgrades=simAdditionalBaseStatus(measures);if(upgrades===null)return false;
     patterns++;
     if(upgrades.length===1){
      const [key,value]=upgrades[0],id=`${key}::${value}`;
      if(universe.has(id)&&!found.has(id)){
       let accepted=false;
       await simEnumerateActualForAdditional(chosenGroups,relics=>{
        accepted=true;simCollectAdditionalFromComposition(relics,cat,universe,found,{key});return true
       },progress);
      }
     }else{
      await simEnumerateActualForAdditional(chosenGroups,relics=>{
       simCollectAdditionalFromComposition(relics,cat,universe,found,'new');
       // all candidate possibilities found: safe global early stop
       if(found.size>=universe.size)return true
      },progress);
     }
     if(found.size>=universe.size){stopAll=true;return true}
     return false
    }
    for(const group of groupPools[depth]){
     chosenGroups.push(group);const undo=simApplyGroup(group,measures,seenConflicts);
     if(await dfs(depth+1)){undo();chosenGroups.pop();return true}
     undo();chosenGroups.pop();
     if(searchRevision!==simSearchRevision)return true;
     if(performance.now()-progress.lastYield>35){
      progress.lastYield=performance.now();
      state.simAdditionalCandidates=[...found.values()];
      state.simAdditionalStats={patterns,compositions:progress.actual,elapsed:formatElapsed(performance.now()-started)};
      renderSimAdditionalCandidates();
      await new Promise(r=>setTimeout(r,0));
      if(state.simAdditionalCancelRequested){stopAll=true;return true}
     }
    }
    return false
   }
   await dfs(0);
   if(stopAll)break outer
  }
 }finally{
  simFinishSearch(searchRevision)
 }
 if(searchRevision!==simSearchRevision)return;
 state.simAdditionalCandidates=[...found.values()];
 const elapsed=formatElapsed(performance.now()-started);
 state.simAdditionalStats={patterns,compositions:progress.actual,elapsed,cancelled:state.simAdditionalCancelRequested};
 renderSimAdditionalCandidates();
 if(state.simAdditionalCancelRequested){
  const host=$('#simAdditionalCandidates .sim-additional-stats');
  if(host)host.textContent=`中断 / ${patterns.toLocaleString()}探索パターン / ${progress.actual.toLocaleString()}実構成 / ${elapsed}`;
 }
}
async function simMaterializeGroupPatternAsync(vessel,groups,limit,revision){
 let ticks=0;
 const out=[],chosen=Array(6),used=new Set();
 async function rec(depth){
  if(state.simAdditionalCancelRequested||revision!==simSearchRevision)return;
  if(++ticks%512===0){await new Promise(r=>setTimeout(r,0));if(state.simAdditionalCancelRequested||revision!==simSearchRevision)return;}
  if(out.length>=limit||state.simAdditionalCancelRequested||revision!==simSearchRevision)return;
  if(depth===6){
   const relics=[...chosen];
   // Pattern search and actual relic expansion must use the identical exact-match rule.
   // This also guards future changes to rank aggregation / conflict handling.
   if(simMatches(relics)&&!simHasExcludedDemerit(relics)&&!simHasExcludedBenefit(relics))out.push({vessel,relics});
   return
  }
  for(const relic of groups[depth].members){
   if(used.has(relic.ga))continue;
   used.add(relic.ga);chosen[depth]=relic;await rec(depth+1);used.delete(relic.ga);
   if(out.length>=limit)return
  }
 }
 await rec(0);return out
}

async function runSimulatorSearch(){
 if(!state.relics.size)return;if(!state.simConditions.size){alert('検索する効果を1つ以上選択してください。');return}
 const searchRevision=simBeginSearch('normal');state.simResultPage=0;const resultLimit=state.simSearchMode==='all'?20000:Number(state.simSearchMode);
 const searchStartedAt=performance.now();let timedOut=false;const safetyTimer=setTimeout(()=>{if(searchRevision===simSearchRevision){timedOut=true;state.simAdditionalCancelRequested=true;simUpdateSearchButtons();}},60000);
 const formatElapsed=ms=>{if(ms<1000)return `${Math.round(ms)}ms`;const s=ms/1000;if(s<60)return `${s.toFixed(s<10?2:1)}秒`;const m=Math.floor(s/60),rs=s-m*60;return `${m}分${rs.toFixed(1)}秒`};
 // v7で追加した+0始まりランク判定用メタ情報は、simCatalog()の全遺物走査を伴う。
 // 探索ノードごとに再生成すると極端に遅くなるため、検索1回につき1度だけ固定する。
 simSearchRankMetaCache=simRankMetaMap();
 simUpdateSearchButtons();state.simResults=[];state.simSelectedResult=-1;
 $('#simSearchStatus').innerHTML='<div class="note">検索中… 0件（探索パターン 0 / 経過 0.00秒）</div>';renderSimDemeritFilter();renderSimResults();
 await new Promise(r=>setTimeout(r,0));
 if(searchRevision!==simSearchRevision){clearTimeout(safetyTimer);return;}
 const vessels=SIM_VESSELS[state.hero]||[],searchInfo=simBuildSearchInfo();let capped=false,nodes=0,lastYield=performance.now(),matchedPatterns=0;
 const measures=new Map(),seenConflicts=new Set(),chosenGroups=[];
 try{
  outer:for(const vessel of vessels){
   const groupPools=simGroupedCandidatePools(vessel,searchInfo);if(groupPools.some(p=>!p.length))continue;
   const bounds=simRemainingGroupBounds(groupPools);
   async function dfs(depth){
    if(searchRevision!==simSearchRevision||state.simAdditionalCancelRequested)return true;
    if(state.simResults.length>=resultLimit){capped=true;return true}
    if(!simCanStillReach(measures,bounds,depth))return false;
    if(depth===6){
     if(simMeasureMatches(measures)){
      matchedPatterns++;
      const actual=await simMaterializeGroupPatternAsync(vessel,chosenGroups,resultLimit-state.simResults.length,searchRevision);
      for(const result of actual)state.simResults.push(result);
      if(state.simResults.length>=resultLimit){capped=true;return true}
     }
     return false
    }
    for(const group of groupPools[depth]){
     nodes++;chosenGroups.push(group);const undo=simApplyGroup(group,measures,seenConflicts);
     if(!simExceeded(measures)&&await dfs(depth+1)){undo();chosenGroups.pop();return true}
     undo();chosenGroups.pop();
     if(searchRevision!==simSearchRevision)return true;
     if(nodes%1000===0||performance.now()-lastYield>40){const now=performance.now();$('#simSearchStatus').innerHTML=`<div class="note">検索中… ${state.simResults.length}件 / ${nodes.toLocaleString()}探索パターン（成立パターン ${matchedPatterns.toLocaleString()} / 経過 ${formatElapsed(now-searchStartedAt)}）</div>`;await new Promise(r=>setTimeout(r,0));lastYield=performance.now()}
    }
    return false
   }
   if(await dfs(0)&&(state.simResults.length>=resultLimit||searchRevision!==simSearchRevision||state.simAdditionalCancelRequested))break outer
  }
 }finally{clearTimeout(safetyTimer);simFinishSearch(searchRevision)}
 if(searchRevision!==simSearchRevision)return;
 if(timedOut)$('#simSearchStatus').dataset.safetyStop='true';else delete $('#simSearchStatus').dataset.safetyStop;state.simSelectedResult=state.simResults.length?0:-1;const elapsed=formatElapsed(performance.now()-searchStartedAt);
 $('#simSearchStatus').innerHTML=state.simAdditionalCancelRequested?`<div class="note">検索中断（全件未完了）：${state.simResults.length}件（検索時間：${elapsed}）</div>`:capped?`<div class="sim-limit-note">${state.simSearchMode==='all'?'安全上限2万件に到達しました（全件未完了）。':`${resultLimit}件で検索を打ち切りました。ほかにも結果がある可能性があります。`}検索時間：${elapsed}（${nodes.toLocaleString()}探索パターン / 成立パターン ${matchedPatterns.toLocaleString()}）</div>`:`<div class="note">検索完了：${state.simResults.length}件（${nodes.toLocaleString()}探索パターン / 成立パターン ${matchedPatterns.toLocaleString()} / 検索時間：${elapsed}）</div>`;if(timedOut)$('#simSearchStatus').innerHTML+='<div class="note">60秒の安全停止（全件未完了）</div>';renderSimDemeritFilter();renderSimResults();persistAppState()
}
function renderSimDemeritFilter(){
 const host=$('#simDemeritFilter');if(!host)return;
 const selected=simDemeritFilterState().names;
 const names=new Set(selected);
 for(const result of state.simResults)for(const n of simDemeritNamesFromRelics(result.relics))names.add(n);
 const list=[...names].sort((a,b)=>a.localeCompare(b,'ja'));
 if(!list.length){host.innerHTML='';return}
 host.innerHTML=`<div class="sim-demerit-filter-box"><div class="sim-demerit-filter-head"><div><div class="sim-demerit-filter-title">検索結果に含まれるデメリット効果</div><div class="sim-demerit-filter-help">チェックした効果を含む構成を次回検索から除外します。追加スキル候補を表示中は自動で再検索します。検索条件を変更するまで選択状態を保持します。</div></div><div class="muted">除外：${selected.size}件</div></div><div class="sim-demerit-filter-grid">${list.map(n=>`<label class="sim-demerit-filter-item ${selected.has(n)?'selected':''}"><input type="checkbox" data-sim-demerit-exclude="${esc(n)}" ${selected.has(n)?'checked':''}><span>${esc(n)}</span></label>`).join('')}</div></div>`;
 document.querySelectorAll('[data-sim-demerit-exclude]').forEach(ch=>ch.onchange=()=>{
  const s=simDemeritFilterState(),name=ch.dataset.simDemeritExclude;
  if(ch.checked)s.names.add(name);else s.names.delete(name);
  simDemeritSelectionChanged()
 })
}
function simColorChip(c){const cls=c==='any'?' any':'';const color={red:'#ff4053',blue:'#3292ff',yellow:'#ffbd1d',green:'#14c875'}[c]||'';return `<span class="sim-color-chip${cls}" ${c==='any'?'':`style="background:${color}"`} title="${c}"></span>`}
function simDemeritSummary(result){const names=[];for(const r of result.relics)for(const id of r.curses||[])names.push(effectName(id));if(!names.length)return '<span class="sim-no-demerit">デメリットなし</span>';const m=new Map();for(const n of names)m.set(n,(m.get(n)||0)+1);return [...m].map(([n,c])=>`${esc(n)}${c>1?` ×${c}`:''}`).join(' / ')}
function simResultBenefits(){
 const items=new Map();
 const catalog=simCatalog(),allowed=new Set(catalog.map(x=>x.master.masterKey));
 const selected=new Set(catalog.filter(x=>state.simConditions.has(x.key)).map(x=>x.master.masterKey));
 const sources=state.simResults;
 for(const result of sources){const seen=new Set();
  for(const {id,relic} of simEffectiveRecords(result.relics)){
   const rule=simRuleMasterForEffect(id,relic),info=effectInfo(id);
   if(rule&&(rule.ruleType==='DEMERIT'||String(rule.category).startsWith('demerit_')||(rule.character&&rule.character!==HERO_NAMES[state.hero])))continue;
   if(!rule||!allowed.has(rule.masterKey)||selected.has(rule.masterKey))continue;
   const ranked=rule&&(rule.uiMode==='RANK_SUM'||rule.ruleType==='UNIQUE_LEVEL');
   const key=simBenefitIdentity(id,relic);
   if(seen.has(key))continue;seen.add(key);
   if(!items.has(key)){
    let label=rule?simRuleName(rule):effectName(id);
    if(ranked)label+=` ＋${info.level??0}`;
    label+=relicMeta(relic.relicId).deep?'（深層）':'（通常）';
    items.set(key,{key,label,category:rule?.gameGroup||'その他',count:0,required:state.simConditions.has(simEffectKeyFor(id,relic)),order:rule?.displayOrder??99999});
   }
   items.get(key).count++;
  }
 }
 const groupOrder=new Map((window.NR_GAME_FILTER_MASTER?.hierarchy||[]).flatMap(major=>major.groups.map(group=>group.label)).map((label,index)=>[label,index]));
 return [...items.values()].sort((a,b)=>(groupOrder.get(a.category)??999)-(groupOrder.get(b.category)??999)||a.order-b.order||a.label.localeCompare(b.label,'ja'));
}
function simBenefitPreviewItems(){const items=new Map(simResultBenefits().map(x=>[x.key,x]));for(const [key,x] of simBenefitFilterState())if(!items.has(key))items.set(key,{...x,count:0});return [...items.values()].sort((a,b)=>Number(simBenefitFilterState().has(b.key))-Number(simBenefitFilterState().has(a.key)));}
function renderSimBenefitPreview(){const items=simBenefitPreviewItems(),button=$('#simBenefitPreviewBtn');if(!button)return;button.disabled=(!state.simResults.length&&!simBenefitFilterState().size)||simActiveSearch!==null;button.textContent='メリット効果の除外候補を見る（除外 '+simBenefitFilterState().size+'種類）';const select=$('#simBenefitCategory'),previous=select.value;select.innerHTML='<option value="">すべての分類</option>'+[...new Set(items.map(x=>x.category))].map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');select.value=previous;renderSimBenefitPreviewList(items);}
function renderSimBenefitPreviewList(items=simBenefitPreviewItems()){const draft=simBenefitDraft||simBenefitFilterState(),query=normalizeEffectIdentity($('#simBenefitQuery').value),category=$('#simBenefitCategory').value;const shown=items.filter(x=>(!category||x.category===category)&&(!query||normalizeEffectIdentity(x.label).includes(query)));$('#simBenefitPreviewCount').textContent=shown.length+' / '+items.length+'種類・取得した検索結果 '+state.simResults.length+'件・選択 '+draft.size+'種類';$('#simBenefitPreviewList').innerHTML=shown.map(x=>'<li class="benefit-preview-row"><label><input type="checkbox" data-benefit-key="'+esc(x.key)+'" '+(draft.has(x.key)?'checked':'')+'><span class="benefit-preview-category">'+esc(x.category)+'</span> '+esc(x.label)+(simBenefitFilterState().has(x.key)?'（除外中）':'')+'</label><span>'+x.count+' / '+state.simResults.length+'件</span></li>').join('')||'<li class="sim-empty">該当するメリット効果はありません。</li>';document.querySelectorAll('[data-benefit-key]').forEach(ch=>ch.onchange=()=>{const item=items.find(x=>x.key===ch.dataset.benefitKey);if(ch.checked)simBenefitDraft.set(item.key,item);else simBenefitDraft.delete(item.key);renderSimBenefitPreviewList();});}

function renderSimResults(){const pages=Math.max(1,Math.ceil(state.simResults.length/50));state.simResultPage=Math.min(state.simResultPage,pages-1);$('#simResultPages').innerHTML='<button class="btn" id="simPagePrev" '+(!state.simResultPage?'disabled':'')+'>前へ</button> '+(state.simResultPage+1)+' / '+pages+'ページ <button class="btn" id="simPageNext" '+(state.simResultPage>=pages-1?'disabled':'')+'>次へ</button>';$('#simPagePrev').onclick=()=>{state.simResultPage--;renderSimResults()};$('#simPageNext').onclick=()=>{state.simResultPage++;renderSimResults()};renderSimBenefitPreview();if(!$('#simResultList'))return;$('#simResultCount').textContent=state.simResults.length?`(${state.simResults.length}件)`:'';if(!state.simResults.length){$('#simResultList').innerHTML='<div class="sim-empty">検索後に結果を表示します。</div>';$('#simResultDetail').innerHTML='<div class="sim-empty">左の検索結果を選択してください。</div>';return}$('#simResultList').innerHTML=state.simResults.slice(state.simResultPage*50,(state.simResultPage+1)*50).map((r,j)=>{const i=state.simResultPage*50+j;return `<button class="sim-result-item ${i===state.simSelectedResult?'active':''} ${mySetSaved(r)?'is-saved':''}" data-sim-result="${i}"><div class="sim-result-top"><span class="sim-vessel-name">${esc(r.vessel.name)}${mySetSaved(r)?'<span class="saved-badge">保存済み</span>':''}</span><span class="sim-color-row">${r.vessel.slots.slice(0,3).map(simColorChip).join('')}<span class="sim-divider"></span>${r.vessel.slots.slice(3).map(simColorChip).join('')}</span></div><div class="sim-demerits">${simDemeritSummary(r)}</div></button>`}).join('');document.querySelectorAll('[data-sim-result]').forEach(b=>b.onclick=()=>{state.simSelectedResult=Number(b.dataset.simResult);renderSimResults()});renderSimDetail(state.simResults[state.simSelectedResult])}
const MYSETS_STORAGE_KEY='nightreign_relic_mysets_v1';
let mySets=[],mySetSelectedId=null;
function mySetProfile(){return {player:state.player,slot:state.slot};}
function mySetRelicIdentity(r){return [r.ga,r.relicId,r.effects||[],r.curses||[]];}
function mySetKey(result,hero=state.hero,profile=mySetProfile()){
 return JSON.stringify([profile.player,profile.slot,hero,result.vessel.name,result.vessel.slots,result.relics.map(mySetRelicIdentity)]);
}
function mySetSaved(result){const k=mySetKey(result);return mySets.some(s=>s.key===k);}
function writeMySets(next){
 try{localStorage.setItem(MYSETS_STORAGE_KEY,JSON.stringify({v:1,sets:next}));mySets=next;return true;}
 catch(e){console.warn('マイセット保存失敗',e);alert('マイセットを保存できませんでした。ブラウザの保存容量・設定を確認してください。');return false;}
}
function loadMySets(){
 try{const d=JSON.parse(localStorage.getItem(MYSETS_STORAGE_KEY)||'null');if(d?.v===1&&Array.isArray(d.sets))mySets=d.sets.filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&s.profile&&Number.isInteger(s.hero)&&s.result?.vessel&&Array.isArray(s.result.vessel.slots)&&s.result.vessel.slots.length===6&&Array.isArray(s.result.relics)&&s.result.relics.length===6&&s.result.relics.every(r=>r&&Number.isInteger(r.relicId)&&Number.isInteger(r.ga)&&Array.isArray(r.effects)&&Array.isArray(r.curses))).map(s=>({...s,key:mySetKey(s.result,s.hero,s.profile)}));}
 catch(e){console.warn('マイセット読込失敗',e);}
}
function saveCurrentMySet(){
 const result=state.simResults[state.simSelectedResult];if(!result||mySetSaved(result))return;
 const entry={id:crypto.randomUUID(),name:($('#mySetName')?.value||'').trim().slice(0,80)||`${HERO_NAMES[state.hero]||'キャラクター'} / ${result.vessel.name}`,hero:state.hero,profile:mySetProfile(),createdAt:new Date().toISOString(),result:JSON.parse(JSON.stringify(result)),key:mySetKey(result)};
 if(writeMySets([...mySets,entry])){mySetSelectedId=entry.id;renderSimResults();renderMySets();}
}
function moveMySet(id,delta){const next=[...mySets],i=next.findIndex(s=>s.id===id),j=i+delta;if(i<0||j<0||j>=next.length)return;[next[i],next[j]]=[next[j],next[i]];if(writeMySets(next))renderMySets();}
function deleteMySet(id){if(writeMySets(mySets.filter(s=>s.id!==id))){if(mySetSelectedId===id)mySetSelectedId=null;renderMySets();renderSimResults();}}
function mySetMissingCount(s){if(s.profile.player!==state.player||s.profile.slot!==state.slot)return null;return s.result.relics.filter(r=>JSON.stringify(mySetRelicIdentity(state.relics.get(r.ga)||{}))!==JSON.stringify(mySetRelicIdentity(r))).length;}
function renderMySets(){
 const host=$('#mySetList');if(!host)return;
 if(!mySets.length){host.innerHTML='<div class="sim-empty">保存した構成はありません。検索結果の「遺物構成を保存」から追加できます。</div>';$('#mySetDetail').innerHTML='';return;}
 if(!mySets.some(s=>s.id===mySetSelectedId))mySetSelectedId=mySets[0].id;
 host.innerHTML=mySets.map((s,i)=>`<article class="myset-row ${s.id===mySetSelectedId?'active':''}"><button class="myset-select" data-myset-select="${esc(s.id)}"><strong>${esc(s.name)}</strong><span>${esc(HERO_NAMES[s.hero]||'')} / ${esc(s.result.vessel.name)}</span><small>${esc(s.profile.player)} · セーブ枠 ${Number(s.profile.slot)+1}</small></button><div class="myset-actions"><button class="btn" data-myset-up="${esc(s.id)}" ${i===0?'disabled':''} aria-label="${esc(s.name)}を上へ">↑</button><button class="btn" data-myset-down="${esc(s.id)}" ${i===mySets.length-1?'disabled':''} aria-label="${esc(s.name)}を下へ">↓</button><button class="btn danger" data-myset-delete="${esc(s.id)}">削除</button></div></article>`).join('');
 const selected=mySets.find(s=>s.id===mySetSelectedId),missing=mySetMissingCount(selected);
 $('#mySetDetail').innerHTML=`<h3>${esc(selected.name)}</h3>${missing===null?'<p class="note">別のセーブ枠から保存した構成です。</p>':missing?`<p class="note">現在のセーブで一致する遺物を確認できない枠が${missing}個あります。保存時の構成を表示しています。</p>`:''}${simDetailHtml(selected.result,selected.hero)}`;
 document.querySelectorAll('[data-myset-select]').forEach(b=>b.onclick=()=>{mySetSelectedId=b.dataset.mysetSelect;renderMySets();});
 document.querySelectorAll('[data-myset-up]').forEach(b=>b.onclick=()=>moveMySet(b.dataset.mysetUp,-1));
 document.querySelectorAll('[data-myset-down]').forEach(b=>b.onclick=()=>moveMySet(b.dataset.mysetDown,1));
 document.querySelectorAll('[data-myset-delete]').forEach(b=>b.onclick=()=>{const s=mySets.find(s=>s.id===b.dataset.mysetDelete);if(s&&confirm(`「${s.name}」をマイセットから削除しますか？`))deleteMySet(s.id);});
}
function simDetailHtml(result,hero=state.hero){
 const seen=new Set();
 const labels={start_skill:'開始戦技',start_affinity:'開始属性・状態異常',start_magic:'開始魔術・祈祷',weapon_find:'武器種発見'};
 function card(r,i){const m=relicMeta(r.relicId);const effects=(r.effects||[]).map(id=>{
  const rule=simRuleMasterForEffect(id,r),group=String(rule?.conflictGroup||'').toLowerCase();
  if(rule?.ruleType!=='LEFTMOST_WINS'||!labels[group])return `<div>${esc(effectName(id))}</div>`;
  const key=hero===6&&(group==='start_skill'||group==='start_magic')?'revenant_start':group,applied=!seen.has(key);seen.add(key);
  return `<div class="priority-effect priority-${group} ${applied?'is-applied':'is-inactive'}"><span class="priority-label">${labels[group]} · ${applied?'適用':'左側優先で未適用'}</span>${esc(effectName(id))}</div>`;
 }).join('');return `<div class="sim-detail-relic"><div class="sim-detail-head"><span class="dot" style="background:${COLOR_HEX[m.color]||'#999'}"></span><span class="sim-detail-name">Slot ${i%3+1}：${esc(m.name)}</span>${!m.known?'<span class="deep">判定不能</span>':m.deep?'<span class="deep">深層</span>':''}</div><div class="sim-detail-effects">${effects}${(r.curses||[]).map(id=>`<div class="sim-detail-curse">${esc(effectName(id))}</div>`).join('')}</div></div>`;}
 return `<div class="sim-detail-group"><div class="sim-detail-group-title">通常遺物</div>${result.relics.slice(0,3).map((r,i)=>card(r,i)).join('')}</div><div class="sim-detail-group"><div class="sim-detail-group-title">深層遺物</div>${result.relics.slice(3).map((r,i)=>card(r,i+3)).join('')}</div>`;
}
function renderSimDetail(result){
 const host=$('#simResultDetail');if(!result){host.innerHTML='<div class="sim-empty">左の検索結果を選択してください。</div>';return;}
 const saved=mySetSaved(result);
 host.innerHTML=`<div class="myset-save"><label>マイセット名<input id="mySetName" maxlength="80" placeholder="${esc(HERO_NAMES[state.hero]||'')} / ${esc(result.vessel.name)}"></label><button class="btn primary" id="saveMySetBtn" ${saved?'disabled':''}>${saved?'保存済み':'遺物構成を保存'}</button></div>${simDetailHtml(result)}`;
 $('#saveMySetBtn').onclick=saveCurrentMySet;
}


function renderHeroes(){
  const counts=new Map();for(const p of state.presets)counts.set(p.heroId,(counts.get(p.heroId)||0)+1);
  const ids=[...counts.keys()].sort((a,b)=>a-b);
  $('#heroList').innerHTML=ids.length?ids.map(id=>`<button class="hero-btn ${state.hero===id?'active':''}" data-hero="${id}">${esc(HERO_NAMES[id]||`ID${id}`)}<span class="hero-count">${counts.get(id)}</span></button>`).join(''):'<span class="muted">プリセットがありません。</span>';
  document.querySelectorAll('[data-hero]').forEach(b=>b.onclick=()=>{
    state.hero=Number(b.dataset.hero);
    activateSimConditionsForHero(state.hero);
    simDemeritFilterState(state.hero);
    state.simAdditionalCandidates=[];state.simAdditionalStats=null;
    state.currentPresetPos=0;
    state.selectedGa=0;state.selectedSlot=-1;
    renderHeroes();
    renderPresets();
    renderCandidatePane(-1);
    updateIgnoreButtons();
    persistAppState();
  });
  simRenderHeroes();
  updateIgnoreButtons();
}
function renderPresets(){
  const list=getHeroPresetList();
  $('#viewTitle').textContent=state.hero?`${HERO_NAMES[state.hero]}のプリセット`:'プリセット';
  syncPresetNav();
  if(!list.length){
    $('#presetList').innerHTML='<div class="empty">このキャラクターのプリセットはありません。</div>';
    return;
  }
  const p=list[state.currentPresetPos];
  workingState(p);
  $('#presetList').innerHTML=`<div class="preset-grid"><article class="preset"><div class="preset-head"><div class="preset-title">${p.name?esc(p.name):'<span style="color:#8e98a7">名称なし</span>'}</div><div class="preset-meta"><span>${esc(HERO_NAMES[p.heroId]||`ID${p.heroId}`)}</span><span>登録：${formatDate(p.timestamp)}</span><span>Vessel ID：${p.vesselId}</span><span>Preset #${p.index+1}</span></div></div><div class="section"><div class="section-title">通常遺物</div>${[0,1,2].map(i=>relicCard(p,i)).join('')}</div><div class="section"><div class="section-title">深層遺物</div>${[3,4,5].map(i=>relicCard(p,i)).join('')}</div></article></div>`;
  bindRelicClicks();
}
async function importFile(file){simInvalidateSearch();$('#saveStatus').textContent='解析中…';$('#saveStatus').className='pill';try{if(file.size>128*1024*1024)throw new Error('セーブファイルが大きすぎます。');const entries=await unpackBnd4(await file.arrayBuffer());const slots=[];for(let i=0;i<Math.min(10,entries.length);i++){try{const s=parseSlot(entries[i]);if(s.owned)slots.push({i,...s})}catch(e){console.warn('slot',i,e)}}if(!slots.length)throw new Error('遺物を含むキャラクタースロットを検出できませんでした。');slots.sort((a,b)=>b.owned-a.owned);const s=slots[0];simInvalidateSearch();state.player=s.player||`Slot ${s.i+1}`;state.slot=s.i;state.saveName=file.name;state.relics=s.relicMap;renderRelicMetadataNotice();state.presets=parsePresets(entries[s.i]);state.hero=state.presets.some(p=>p.heroId===state.hero)?state.hero:(state.presets[0]?.heroId||0);state.currentPresetPos=0;state.selectedGa=0;state.selectedSlot=-1;state.workingPresets.clear();state.simResults=[];state.simSelectedResult=-1;ignoreAliasMapCache=null;$('#saveStatus').textContent=`読込済み：${file.name}`;$('#saveStatus').className='pill ok';$('#playerStatus').textContent=`プレイヤー：${state.player}`;$('#presetStatus').textContent=`プリセット：${state.presets.length}件`;renderHeroes();renderPresets();renderCandidatePane(-1);updateIgnoreButtons();renderSimulator();persistAppState()}catch(e){console.error(e);$('#saveStatus').textContent='読込失敗';$('#saveStatus').className='pill err';alert('セーブ解析に失敗しました。\n\n'+e.message)}}
$('#importBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=e=>{const f=e.target.files?.[0];if(f)importFile(f);e.target.value=''};
function updateStickyOffsets(){
  const shell=document.querySelector('.sticky-shell');
  const spacer=$('#stickySpacer');
  if(!shell||!spacer)return;
  spacer.style.height=`${Math.ceil(shell.getBoundingClientRect().height)}px`;
}
window.addEventListener('resize',()=>requestAnimationFrame(updateStickyOffsets));
if('ResizeObserver' in window){
  new ResizeObserver(()=>requestAnimationFrame(updateStickyOffsets)).observe(document.querySelector('.sticky-shell'));
}
requestAnimationFrame(updateStickyOffsets);
document.querySelectorAll('[data-app-tab]').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('[data-app-tab]').forEach(b=>b.classList.toggle('active',b===btn));
  const tab=btn.dataset.appTab;
  $('#optimizerPanel').classList.toggle('hidden',tab!=='optimizer');
  $('#simulatorPanel').classList.toggle('hidden',tab!=='simulator');
  $('#mysetsPanel').classList.toggle('hidden',tab!=='mysets');
  if(tab==='mysets'){renderMySets();window.scrollTo({top:0,behavior:'instant'});}
  $('#optimizerStickyControls').classList.toggle('hidden',tab!=='optimizer');
  $('#simulatorStickyControls').classList.toggle('hidden',tab!=='simulator');
  if(tab==='simulator')renderSimulator();
  requestAnimationFrame(updateStickyOffsets);
  persistAppState();
});
$('#prevPresetBtn').onclick=()=>changePreset(state.currentPresetPos-1);
$('#nextPresetBtn').onclick=()=>changePreset(state.currentPresetPos+1);
$('#presetSelect').onchange=e=>changePreset(Number(e.target.value));
function closeIgnoreModal(){
  $('#ignoreModal').classList.add('hidden');
  updateIgnoreButtons();
  renderPresets();
  if(state.selectedSlot>=0)renderCandidatePane(state.selectedSlot);
  renderSimulator();
  requestAnimationFrame(updateStickyOffsets);
  persistAppState();
}
$('#globalIgnoreBtn').onclick=()=>openIgnore('global');
$('#simGlobalIgnoreBtn').onclick=()=>openIgnore('global');
$('#simHeroIgnoreBtn').onclick=()=>{if(state.hero)openIgnore('hero')};
$('#simBenefitPreviewBtn').onclick=()=>{simBenefitDraft=new Map(simBenefitFilterState());renderSimBenefitPreview();$('#simBenefitPreviewDialog').showModal();};
$('#simBenefitPreviewClose').onclick=()=>$('#simBenefitPreviewDialog').close();
$('#simBenefitQuery').oninput=()=>renderSimBenefitPreviewList();
$('#simBenefitPreviewDialog').onclose=()=>{simBenefitDraft=null;};
$('#simBenefitClear').onclick=()=>{simBenefitDraft.clear();renderSimBenefitPreviewList();};
$('#simBenefitApply').onclick=async()=>{if(simActiveSearch!==null||!simBenefitDraft)return;const refresh=state.simAdditionalStats!==null||state.simAdditionalCandidates.length>0;state.simBenefitExclusionsByHero.set(Number(state.hero)||0,{signature:simConditionSignature(),items:new Map(simBenefitDraft)});$('#simBenefitPreviewDialog').close();persistAppState();const pending=runSimulatorSearch(),revision=simSearchRevision;await pending;if(refresh&&revision===simSearchRevision&&!state.simAdditionalCancelRequested&&simActiveSearch===null)await runSimulatorAdditionalSearch();simScrollToOutput('normal');};
$('#simSearchMode').onchange=()=>{state.simSearchMode=$('#simSearchMode').value;persistAppState();};
$('#simBenefitCategory').onchange=()=>renderSimBenefitPreviewList();
$('#simSearchBtn').onclick=()=>{if(simActiveSearch==='normal'){simRequestCancel('normal');return;}if(simActiveSearch)return;runSimulatorSearch();simScrollToOutput('normal');};
$('#simAdditionalSearchBtn').onclick=()=>{if(simActiveSearch==='additional'){simRequestCancel('additional');return;}if(simActiveSearch)return;runSimulatorAdditionalSearch();simScrollToOutput('additional');};

$('#heroIgnoreBtn').onclick=()=>{if(state.hero)openIgnore('hero')};
$('#ignoreModalClose').onclick=closeIgnoreModal;
$('#ignoreModal').onclick=e=>{if(e.target===$('#ignoreModal'))closeIgnoreModal()};
$('#ignoreSearch').oninput=renderIgnoreModal;
document.querySelectorAll('[data-ignore-category]').forEach(b=>b.onclick=()=>{state.ignoreCategory=b.dataset.ignoreCategory;renderIgnoreModal()});
$('#ignoreSelectedOnly').onclick=()=>{state.ignoreSelectedOnly=!state.ignoreSelectedOnly;renderIgnoreModal()};
$('#ignoreClearBtn').onclick=()=>{if(state.ignoreMode==='global')state.globalIgnored.clear();else heroIgnoredSet(state.hero).clear();simIgnoreSettingsChanged();renderIgnoreModal();updateIgnoreButtons();renderPresets();if(state.selectedSlot>=0)renderCandidatePane(state.selectedSlot);renderSimulator();persistAppState()};
loadMySets();
restoreAppState();
renderMySets();
updateIgnoreButtons();
window.addEventListener('pagehide',persistAppState);
window.addEventListener('beforeunload',persistAppState);
})().catch(err=>{console.error(err);document.body.innerHTML=`<main style="max-width:900px;margin:80px auto;padding:24px;font-family:sans-serif"><h1>起動に失敗しました</h1><p>${String(err?.message||err)}</p><p>この版は外部JSONを読み込むため、file:// ではなくHTTPサーバー経由で開いてください。</p></main>`});
