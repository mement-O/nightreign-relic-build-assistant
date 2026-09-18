// Presentation only: canonical master names and persisted IDs never change with language.
(()=>{
'use strict';
const KEY='nrba_language_v1',textCache=new WeakMap(),attributeCache=new WeakMap();
let language='ja';try{if(localStorage.getItem(KEY)==='en')language='en';}catch{}
const labels=new Map(),normalize=s=>String(s).normalize('NFKC').replace(/\s+/g,'').toLowerCase();
function add(ja,en){if(ja&&en)labels.set(normalize(ja),en);}
function configure(base,english){
 const families=new Map();
 for(const kind of ['effectNames','relicNames'])for(const [id,ja] of Object.entries(base[kind]||{})){
  let en=english[kind]?.[id];if(!en)continue;
  // English snapshot predates rank corrections. Keep the formal master's rank.
  const rank=kind==='effectNames'&&base.effectGroups?.[id]&&String(ja).normalize('NFKC').match(/\+\s*(\d+)\s*$/);
  if(rank)en=en.replace(/\s*\+\s*\d+\s*$/,'').trim()+' +'+rank[1];
  add(ja,en);
  if(kind==='effectNames'&&base.effectGroups?.[id]){const j=String(ja).normalize('NFKC').replace(/\s*\+\s*\d+\s*$/,'').trim(),e=en.replace(/\s*\+\s*\d+\s*$/,'').trim();if(!families.has(j))families.set(j,new Set());families.get(j).add(e);}
 }
 for(const [ja,names]of families)if(names.size===1)add(ja,[...names][0]);
 for(const [ja,en]of Object.entries(window.NR_EN_UI||{}))add(ja,en);
 for(const [id,ja] of Object.entries(base.effectNames||{})){const m=base.effectGroups?.[id]&&String(ja).normalize('NFKC').match(/^(.*?)\s*\+\s*(\d+)$/);if(m&&labels.has(normalize(m[1])))add(ja,labels.get(normalize(m[1]))+' +'+m[2]);}
 refresh();
}
function englishText(raw){
 const s=String(raw).trim();if(!s)return raw;
 let out=labels.get(normalize(s));
 if(out===undefined){
  for(const [pattern,replace]of templates){const m=s.match(pattern);if(m){out=replace(...m.slice(1));break;}}
 }
 // Decorations are removed only at their boundaries; unknown effect text stays Japanese.
 if(out===undefined){const m=s.match(/^(.*?)([（(](?:通常|深層|全ランク|共通設定|除外中)[）)])$/);if(m)out=englishText(m[1])+' '+englishText(m[2].slice(1,-1));}
 if(out===undefined){const m=s.normalize('NFKC').match(/^(.*?)\s*\+\s*(\d+)$/);if(m){const translated=englishText(m[1]);if(translated!==m[1])out=translated+' +'+m[2];}}
 if(out===undefined&&s.includes(' / '))out=s.split(' / ').map(englishText).join(' / ');
 if(out===undefined){const m=s.match(/^(Slot \d+\s*[:：]\s*|元：)(.*)$/);if(m)out=(m[1]==='元：'?'Original: ':m[1])+englishText(m[2]);}
 return out===undefined?raw:raw.replace(s,out);
}
const templates=[
 [/^改善候補 (\d+)件$/,n=>'Upgrade candidates: '+n],
 [/^セーブ枠 (\d+)$/,n=>'Save slot '+n],
 [/^((?:開始戦技|開始属性・状態異常|開始魔術・祈祷|武器種発見)) [·・] (適用|左側優先で未適用)$/,(group,state)=>englishText(group)+' · '+englishText(state)],
 [/^(\d+)個( →)?$/,(n,arrow)=>n+(n==='1'?' relic':' relics')+(arrow||'')],
 [/^(.+?) (\d+)個$/,(label,n)=>englishText(label)+' '+n+(n==='1'?' relic':' relics')],
 [/^(復元済み|読込済み|プレイヤー|登録)：(.*)$/,(kind,value)=>({'復元済み':'Restored','読込済み':'Loaded','プレイヤー':'Player','登録':'Registered'}[kind])+': '+value],
 [/^「(.*)」をマイセットから削除しますか？$/,name=>'Delete “'+name+'” from My Sets?'],
 [/^(.*)を(上|下)へ$/,(name,direction)=>'Move '+name+(direction==='上'?' up':' down')],
 [/^(.*)のプリセット$/,hero=>englishText(hero)+' presets'],
 [/^(.*?)：(?:追加で)?評価対象外(とする効果)?$/,(hero)=>englishText(hero)+': ignored effects'],
 [/^メリット効果の除外候補を見る（除外 (\d+)種類）$/,n=>'Exclude benefit effects ('+n+' selected)'],
 [/^(\d+) \/ (\d+)種類・取得した検索結果 (\d+)件・選択 (\d+)種類$/,(shown,total,results,selected)=>`${shown} / ${total} effects · ${results} results · ${selected} selected`],
 [/^追加スキル候補（(\d+)件）$/,n=>'Additional effect candidates ('+n+')'],
 [/^(検索条件|プリセット|除外)：(\d+)件$/,(kind,n)=>({'検索条件':'Search conditions','プリセット':'Presets','除外':'Excluded'}[kind])+': '+n],
 [/^(?:高速検索：)(\d+)件$/,n=>'Quick search: '+n+' results'],
 [/^(\d+)件で検索を打ち切りました。ほかにも結果がある可能性があります。(.*)$/,(n,rest)=>'Stopped at '+n+' results. More may exist. '+englishText(rest)],
 [/^現在のセーブで一致する遺物を確認できない枠が(\d+)個あります。保存時の構成を表示しています。$/,n=>n+' slots do not match the current save. Showing the saved composition.'],
 [/^色・通常／深層が判定不能の遺物が(\d+)個あります。これらはプリセット最適化・編成検索・追加スキル検索の対象外です。遺物ID：(.*)$/,(n,ids)=>n+' relics have unknown color/type and are excluded from optimization and searches. Relic IDs: '+ids],
 [/^セーブ解析に失敗しました。\n\n([\s\S]*)$/,error=>'Failed to parse the save.\n\n'+englishText(error)],
 [/^データ読込失敗: (.*)$/,path=>'Failed to load data: '+path],
 [/^遺物 #(\d+)$/,id=>'Relic #'+id],
 [/^(.*?) ×(\d+)$/,(label,n)=>englishText(label)+' ×'+n],
 [/^(\(?[\d,]+(?: \/ [\d,]+)?)(件|個|種類|ページ)(\)?)$/,(n,unit,end)=>n+({'件':' results','個':' relics','種類':' effects','ページ':' pages'}[unit])+end],
 // These templates are limited to status strings, never arbitrary effect names or user names.
 [/^((?:検索中|検索完了|検索中断|中断|安全上限|60秒の安全停止|検索時間|探索パターン|完了|経過|\d[\d,.]*探索パターン).*)$/,s=>s.replace(/安全上限2万件に到達しました（全件未完了）。/g,'Safety limit of 20,000 results reached (incomplete). ').replace(/60秒の安全停止/g,'60-second safety stop').replace(/検索中断/g,'Search cancelled').replace(/検索完了/g,'Search complete').replace(/検索中/g,'Searching').replace(/全件未完了/g,'incomplete').replace(/検索時間/g,'Search time').replace(/探索パターン/g,' patterns').replace(/成立パターン/g,'Matching patterns').replace(/実構成/g,' compositions').replace(/経過/g,'Elapsed').replace(/中断/g,'Cancelled').replace(/完了/g,'Complete').replace(/件/g,' results').replace(/秒/g,'s').replace(/分/g,'m ').replace(/：/g,': ').replace(/（/g,' (').replace(/）/g,')')],
 ];
function t(s){return language==='en'?englishText(String(s)):String(s);}
function matches(label,query){const q=normalize(query);return normalize(label).includes(q)||normalize(englishText(String(label))).includes(q);}
function sourceText(node){if(!node)return '';if(node.nodeType===3){const cached=textCache.get(node);return cached&&node.data===cached.rendered?cached.source:node.data;}return [...node.childNodes].map(sourceText).join('');}
function excluded(element){return !element||element.closest('script,style,pre,textarea,[translate="no"]');}
function translateNode(node){if(excluded(node.parentElement))return;let record=textCache.get(node);if(!record||node.data!==record.rendered)record={source:node.data};record.rendered=t(record.source);textCache.set(node,record);if(node.data!==record.rendered)node.data=record.rendered;}
function translateElement(element){
 if(excluded(element))return;
 // Translating an implicit option value would alter application state.
 if(element.tagName==='OPTION'&&!element.hasAttribute('value'))element.setAttribute('value',sourceText(element));
 for(const name of ['title','placeholder','aria-label']){if(!element.hasAttribute(name))continue;let cache=attributeCache.get(element);if(!cache){cache={};attributeCache.set(element,cache);}const current=element.getAttribute(name);let record=cache[name];if(!record||record.rendered!==current)record={source:current};record.rendered=t(record.source);cache[name]=record;if(current!==record.rendered)element.setAttribute(name,record.rendered);}
}
function translateTree(root){if(root.nodeType===3){translateNode(root);return;}if(root.nodeType!==1)return;translateElement(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;n.nodeType===3?translateNode(n):translateElement(n);}}
const observer=new MutationObserver(records=>{observer.disconnect();try{const roots=new Set();for(const r of records){if(r.type==='childList')r.addedNodes.forEach(n=>roots.add(n));else roots.add(r.target);}for(const root of roots)if(root.isConnected)translateTree(root);}finally{observe();}});
function observe(){observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']});}
function refresh(){observer.disconnect();translateTree(document.body);document.documentElement.lang=language;for(const b of document.querySelectorAll('[data-language]')){const active=b.dataset.language===language;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}observe();}
function setLanguage(value){if(!['ja','en'].includes(value))return;language=value;try{localStorage.setItem(KEY,value);}catch{}refresh();window.dispatchEvent(new Event('resize'));}
window.NR_I18N={configure,t,matches,sourceText,setLanguage,get language(){return language;}};
for(const [ja,en]of Object.entries(window.NR_EN_UI||{}))add(ja,en);
document.querySelectorAll('[data-language]').forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.language)));
refresh();
})();
