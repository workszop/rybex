// js/logging.js - Logging of runs and the team file.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── Logging ───
// gen: Polish genitive (after "wobec"); English has one form.
const BASE_NAME=(k,gen)=>({vision:T(gen?'kontroli wzrokowej':'kontrola wzrokowa','visual inspection'),rag:T(gen?'wyszukiwania dosłownego':'wyszukiwanie dosłowne','literal search'),complaints:T(gen?'klasy większościowej':'klasa większościowa','majority class'),forecast:T(gen?'średniej historycznej':'średnia historyczna','historical mean'),maint:T(gen?'reguły PROCES-05':'reguła PROCES-05','PROCES-05 rule')})[k]||'';
// Baseline entries store BASE_MK as their metric label and render it in the current language; older entries keep their stored label.
const BASE_MK='@base',BASE_M=k=>({vision:T('wykryte wady'),rag:T('poprawne odpowiedzi'),complaints:T('trafność (zestaw ćwiczeniowy)'),forecast:'MAPE',maint:T('wykryte awarie')})[k]||'';
const trackName=k=>(trMeta()[k]||{}).title||k;
function logText(l){if(l.text)return l.text;try{const s=logTextRaw(l),r=l.res||{};return isObj(r.ai)?`${s} · ${aiSumText(r.ai)}${r.agree!=null?` · ${T('zgodność sędziego z regułą')} ${pct(r.agree)}`:''}`:s}catch(e){return T('(wpis nieczytelny)')}}
function logTextRaw(l){const c=l.cfg||{},r=l.res||{};if(l.base){const p=r.primary||{},w=c.set==='val'||c.set==='dev'?T('zestaw ćwiczeniowy'):l.track==='forecast'&&PRODUCTS[c.p]?`${S.lang==='pl'?PRODUCTS[c.p][0]:PRODUCTS[c.p][1]}, h=${c.h}`:l.track==='maint'?T('minuty 300–600'):'';return`${T('Metoda odniesienia','Baseline')}: ${BASE_NAME(l.track)}${w?` (${w})`:''}; ${l.track==='maint'&&r.ev?mtPlain(r.ev,r.fp)+'; ':''}${p.m===BASE_MK?BASE_M(l.track):p.m}=${pct(p.v)}`}switch(l.track){
 case'vision':if(c.mode==='llm'){const m=r.test||r.val||{};return`[model] ${c.ver?`prompt ${c.ver}, `:''}${cnt(c.shots,'example')}, ${c.set==='test'?T('test końcowy'):T('zestaw ćwiczeniowy')}: ${T('wykryte wady')} ${pct(m.r)}${typeof m.fp==='number'?`, ${T('fałszywe alarmy')} ${Math.round(m.fp)}`:''}`}
  return typeof c.sens==='number'?`${T('czułość','sensitivity')} ${c.sens}; ${T('walidacja')} ${T('wykryte wady')} ${pct(r.val.r)}${typeof r.val.fp==='number'?`, ${T('fałszywe alarmy')} ${Math.round(r.val.fp)}`:''}${r.test?`; ${T('test')} ${T('wykryte wady')} ${pct(r.test.r)}`:''}`:`${T('progi')} d=${num(c.th.d)}, s=${num(c.th.s)}, c=${num(c.th.c)}; ${T('walidacja')} F1=${pct(r.val.f1)}`;
 case'rag':return`${cmpPlain(l)?cmpPlain(l)+'; ':''}${c.mode==='llm'?'[model] ':T('[bez modelu] ')}${c.lang?'['+String(c.lang).toUpperCase()+'] ':''}${r.test?T('test końcowy: '):''}k=${c.k}, ${T('akapitów/fragment')}=${c.chunk}, min=${num(c.min,2)}; hit@k=${r.hit}/${r.n}, ${T('poprawne odpowiedzi')}=${r.ok}/${r.n}, ${T('odmowy spoza zakresu')}=${r.ref}/${r.nOos}, ${T('trafne źródła')}=${pct(r.prec)}; ${T('metoda dosłowna')}=${r.baseOk}/${r.n}`;
 case'complaints':if(c.mode==='llm')return`${cmpPlain(l)?cmpPlain(l)+'; ':''}[model] prompt ${c.ver}, ${cnt(c.shots,'example')}, ${setLabel(c.set)}: ${T('trafność')}=${pct(r.acc)}, ${T('wykrycie zagrożeń')}=${pct(r.safety)} (${T('fałszywe alarmy')}: ${r.safetyFalse}); ${T('reguły na tych samych zgłoszeniach')}=${pct(r.base)}`;
  return`${cmpPlain(l)?cmpPlain(l)+'; ':''}${T('słowa kluczowe')}: ${CK.map(k=>catName(k)+'='+c.kw[k]).join('; ')}; ${T('bezpieczeństwo')}=${c.safety}. ${T('trafność (zestaw ćwiczeniowy)')}=${pct(r.dev)}, ${T('wykrycie zagrożeń')}=${pct(r.safety)}${r.safetyFalse!=null?` (${T('fałszywe alarmy')}: ${r.safetyFalse})`:''}${r.test!=null?`; ${T('trafność (test końcowy)')}=${pct(r.test)}`:''}; ${T('klasa większościowa')}=${pct(r.base)}`;
 case'forecast':return`${S.lang==='pl'?PRODUCTS[c.p][0]:PRODUCTS[c.p][1]}, h=${c.h}, ${T('okno')}=${c.w}: ${Object.keys(r.mape).map(k=>fcName(k)+' MAPE '+pct(r.mape[k])).join('; ')}`;
 case'maint':return r.ev?`${mtCfgTxt(c)}: ${mtPlain(r.ev,r.fp)}; ${T('reguła PROCES-05')}: ${mtPlain(r.bev,r.bfp)||'–'}`:`${mtCfgTxt(c)}: F1=${pct(r.f1)} (P ${pct(r.p)}, R ${pct(r.r)}); ${T('reguła PROCES-05')} F1=${pct(r.base)}`}
 return JSON.stringify(c)}
function fmtTs(ts){const d=new Date(ts);return isNaN(d)?String(ts):d.toLocaleString(loc(),{dateStyle:'short',timeStyle:'short'})}
function logSig(cfg,res){return JSON.stringify([cfg,{...res,primary:{...(res||{}).primary,m:''}}])}
// The lab's starting settings (rules or statistics; a model run is a change of method). Saving them is not an experiment.
function unchangedRun(track,cfg){const D=defaultLab(),c=isObj(cfg)?cfg:{},eq=(a,b)=>typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<1e-9;if(c.mode==='llm')return false;try{switch(track){
 case'vision':{if(typeof c.sens==='number')return eq(c.sens,50);return isObj(c.th)&&isObj(VIS.calib)&&['d','s','c'].every(k=>eq(c.th[k],VIS.calib[k]))}
 case'rag':return c.k===D.rag.k&&c.chunk===D.rag.chunk&&eq(c.min,D.rag.min);
 case'complaints':return JSON.stringify(c.kw)===JSON.stringify(D.compl.kw)&&c.safety===D.compl.safety;
 case'forecast':return c.p===D.fc.p&&c.h===D.fc.h&&c.w===D.fc.w;
 case'maint':return eq(c.thr,D.mt.thr)&&c.win===D.mt.win&&Object.keys(D.mt.f).every(k=>!!(c.f||{})[k]===!!D.mt.f[k])}}catch(e){}return false}
const UNCHANGED_MSG=k=>T(`To są ustawienia startowe – jeszcze nic nie zmieniliście, więc to nie jest nowy eksperyment. Zmieńcie najpierw jedną rzecz (${ONE_THING(k)[0]}), potem zapiszcie wynik.`,`These are the starting settings – you have not changed anything yet, so this is not a new experiment. Change one thing first (${ONE_THING(k)[1]}), then save the result.`);
function logAdd(track,cfg,res,primary,opt={}){const t=team(),input=opt.base?null:$('#expNote'),note=input?input.value.trim():'',same=logSig(cfg,{...res,primary});
 // The final test save on a hidden-test track may keep the starting settings: the team chose them.
 if(!opt.base&&unchangedRun(track,cfg)&&!(Object.hasOwn(TEST_TRACKS,track)&&cmpTestSaved({track,res:{...res,primary}}))){const msg=UNCHANGED_MSG(track),m=$('#expNoteMsg');toast(msg,{reason:'unchanged'});if(m)m.textContent=msg;return}
 const dup=t.log.find(l=>l.track===track&&l.cfg&&l.res&&logSig(l.cfg,l.res)===same);
 if(dup&&note&&!dup.note){dup.note=note;input.value='';noteErr(false);noteSync(track);save();renderProg();renderCmpList(track);toast(T('Dopisaliśmy wniosek do zapisanego wyniku.'));return}
 if(dup){toast(T('Ten wynik jest już w dzienniku. Zmieńcie jedno ustawienie, aby zapisać nowy eksperyment.'),{action:[T('Otwórz dziennik'),()=>go('deliver')]});return}
 if(!opt.base&&noteRequired(track,cmpTestSaved({track,res:{...res,primary}}))&&!note&&!S.trainer){toast(NOTE_MSG());noteErr(true);if(input)input.focus();return}
 const tv=(testLabOf(t,track)||{testViews:0}).testViews;
 t.log.push({id:newId(),ts:new Date().toISOString(),track,cfg,res:{...res,primary:opt.base?{...primary,m:BASE_MK}:primary},note,testViews:tv,...(opt.base?{base:true}:{})});if(input)input.value='';noteErr(false);noteSync(track);
 const ok=save();renderProg();renderHeroProg(track);renderBaseBanner(track);renderCmpList(track);syncRevealGate();
 if(ok)toast(T('Zapisano w dzienniku zespołu.'),{action:[T('Otwórz dziennik'),()=>go('deliver')]});
 else toast(T('Nie zapisano w pamięci przeglądarki. Pobierzcie plik zespołu.'))}
// The first final-result save (test revealed, the save carries a test result, at least MIN_EXPERIMENTS experiments, no entry
// saved with the test visible yet) needs no conclusion sentence; every other save follows the normal rule. logAdd passes
// whether the entry being saved carries a test result; the field indicator guesses it from the current view.
function noteRequired(track,carries=pendingTest(track)){const t=team(),L=testLabOf(t,track),n=expCount(track);return n>=2&&!(carries&&L&&L.revealed&&n>=MIN_EXPERIMENTS&&!t.log.some(l=>l.track===track&&cmpTestSaved(l)))}
// Would a save now carry a test result? Rules views: the reveal decides; model views: the selected run's set.
function pendingTest(track,t=team()){const L=testLabOf(t,track);if(!L||!L.revealed)return false;if(L.method==='llm'&&(track==='vision'||track==='complaints')){const r=track==='vision'?visSel(L):complSel(L);return!!r&&r.set==='test'}return true}
const TEST_SAVE_HINT=()=>T('Zapiszcie ten wynik w dzienniku – wtedy trafi do raportu jako ocena końcowa.');
// The hint by the save bar shows while the test set is revealed; the note field follows.
function syncTestSave(){const h=$('#testSaveHint');if(!h)return;const k=h.dataset.track,L=testLabOf(team(),k);h.hidden=!(L&&L.revealed);noteSync(k)}
// What "one thing" means on each track, for the experiments hint: [pl, en].
const ONE_THING=k=>({vision:['np. przesuńcie tylko jeden suwak progu','e.g. move only one threshold slider'],rag:['np. zmieńcie tylko, ile fragmentów asystent czyta','e.g. change only how many passages the assistant reads'],complaints:['np. dopiszcie słowa tylko do jednej kategorii','e.g. add words to one category only'],forecast:['np. zmieńcie tylko okno albo tylko horyzont','e.g. change only the window or only the horizon'],maint:['np. zmieńcie tylko próg albo włączcie jeden czujnik','e.g. change only the threshold or switch on one sensor']})[k]||['np. jedno ustawienie','e.g. one setting'];
const NOTE_MSG=()=>T('Dopiszcie jedno zdanie wniosku – trafi do raportu.');
const noteReqTxt=r=>r?T('(wymagane)'):'';
function saveBar(track){const nr=noteRequired(track);return`<div class="card-foot" style="padding:12px 0 0;margin-top:16px;align-items:flex-end"><div class="field" style="flex:1 1 280px"><label for="expNote">${T('Czego się nauczyliśmy? Gdzie system się myli?')} <span id="expNoteReq">${noteReqTxt(nr)}</span></label><input id="expNote" class="input" type="text" maxlength="1000" data-note-required="${nr}" aria-required="${nr}" aria-describedby="expNoteMsg" placeholder="${track==='vision'?T('Który typ wady (wgniecenie, etykieta, kod) zostaje problemem?'):T('Jednym zdaniem: co zmiana parametru poprawiła, a czego nadal nie łapie system?')}"><p id="expNoteMsg" class="hint" style="margin:4px 0 0"></p></div><button type="button" class="btn" id="sv">${ic('save')}${T('Zapiszcie wynik w dzienniku')}</button></div>${Object.hasOwn(TEST_TRACKS,track)?`<p class="hint" id="testSaveHint" data-track="${track}"${(testLabOf(team(),track)||{}).revealed?'':' hidden'}>${TEST_SAVE_HINT()}</p>`:''}`}
// Experiments only: a saved baseline (base:true) is the reference point, not one of the MIN_EXPERIMENTS.
const expTxt=(n,m=MIN_EXPERIMENTS)=>n>m?`${n} (min. ${m})`:`${n}/${m}`;
const expOf=(t,k)=>t.log.filter(l=>l.track===k&&!l.base).length;
function expCount(k){return expOf(team(),k)}
// The note field publishes whether the next save needs a conclusion; a held save marks it at the field, typing clears it.
function noteSync(track){const i=$('#expNote');if(!i)return;const r=noteRequired(track);i.dataset.noteRequired=r;i.setAttribute('aria-required',r);const q=$('#expNoteReq');if(q)q.textContent=noteReqTxt(r)}
function noteErr(on){const i=$('#expNote'),m=$('#expNoteMsg');if(!i)return;if(on)i.setAttribute('aria-invalid','true');else i.removeAttribute('aria-invalid');if(m)m.textContent=on?NOTE_MSG():''}
document.addEventListener('input',e=>{if(e.target.id==='expNote'&&e.target.hasAttribute('aria-invalid'))noteErr(false)});
function renderHeroProg(k){if(X.room)X.room.handle.refresh();const el=$('#heroProg');if(!el)return;const n=expCount(k),m=MIN_EXPERIMENTS;el.innerHTML=`<span class="gh-num">${n>m?n:`${n}/${m}`}</span> <span class="edu-overline">${T('eksperymenty')}${n>m?` (min. ${m})`:''}</span><div class="gh-bar"><span style="width:${Math.min(100,n/m*100)}%"></span></div>`}

// ─── Team file ───
function teamFileName(){return`rybex_team_${S.team}.json`}
function exportTeam(){if(S.example)return;dl(teamFileName(),JSON.stringify({app:APP_ID,version:FILE_VERSION,team:S.team,data:team()},null,1),'application/json');toast(T('Pobrano plik zespołu. Wczytajcie go na innym komputerze.'))}
function importTeam(file){if(S.example)return;const rd=new FileReader();rd.onerror=()=>toast(T('Nie udało się odczytać pliku.'));rd.onload=()=>{let o;try{o=JSON.parse(rd.result)}catch(e){toast(T('To nie jest prawidłowy plik JSON. Nic nie zmieniono.'));return}
  if(!isObj(o)||o.app!==APP_ID||!isObj(o.data)){toast(T('To nie jest plik zespołu z tej aplikacji. Nic nie zmieniono.'));return}
  const from=clampInt(o.team,1,TEAM_COUNT,0)||'?',n=typeof o.data.name==='string'?o.data.name.trim().slice(0,40):'',to=S.team;
  toast(T(`Plik zespołu ${from}${n?` („${n}”)`:''}. Wczytać go do zespołu ${to} i zastąpić obecne dane tego zespołu?`,`Team file from team ${from}${n?` (“${n}”)`:''}. Load it into team ${to} and replace that team’s current data?`),{action:[T(`Wczytajcie do zespołu ${to}`,`Load into team ${to}`),()=>guardRun(()=>{S.team=to;withUndo(T(`Wczytano dane do zespołu ${to}.`,`Data loaded into team ${to}.`),()=>{S.teams[to]=normTeam(o.data);LAB_KEYS.forEach(k=>{if(X.baseOn)delete X.baseOn[baseKey(k)]});if(!S.teams[to].onboardedAt)S.teams[to].onboardedAt=new Date().toISOString()})})]})};rd.readAsText(file)}

