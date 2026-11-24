// js/logging.js - Logging of runs and the team file.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── Logging ───
const trackName=k=>(trMeta()[k]||{}).title||k;
function logText(l){if(l.text)return l.text;try{const s=logTextRaw(l),r=l.res||{};return isObj(r.ai)?`${s} · ${aiSumText(r.ai)}${r.agree!=null?` · ${T('zgodność sędziego z oceną automatyczną')} ${pct(r.agree)}`:''}`:s}catch(e){return T('(wpis nieczytelny)')}}
// One log line: the plain result first, then the settings. Entries saved before the guided labs (legacyRun) are marked as older records.
function logTextRaw(l){const c=l.cfg||{},r=l.res||{},pl=plainLine(l);if(legacyRun(l))return`[${OLD_RUN()}] ${l.track==='forecast'?`${cfgText(l).replace(OLD_RUN()+': ','')}: ${resultText(l)}`:pl||T('(wpis nieczytelny)')}`;switch(l.track){
 case'vision':return`${pl?pl+'; ':''}${cfgText(l)}`;
 case'rag':return`${pl?pl+'; ':''}${cfgText(l)}; hit@k=${r.hit}/${r.n}, ${T('odmowy spoza zakresu')}=${r.ref}/${r.nOos}, ${T('trafne źródła')}=${pct(r.prec)}`;
 case'complaints':return`${pl?pl+'; ':''}${cfgText(l)}, ${setLabel(c.set)}: ${T('trafność')}=${pct(r.acc)}, ${T('wykrycie zagrożeń')}=${pct(r.safety)} (${T('fałszywe alarmy')}: ${r.safetyFalse})`;
 case'forecast':return`${cfgText(l)}: ${resultText(l)}`;
 case'maint':return`${mtCfgTxt(c)}: ${resultText(l)}`}
 return JSON.stringify(c)}
function fmtTs(ts){const d=new Date(ts);return isNaN(d)?String(ts):d.toLocaleString(loc(),{dateStyle:'short',timeStyle:'short'})}
function logSig(cfg,res){return JSON.stringify([cfg,{...res,primary:{...(res||{}).primary,m:''}}])}
// An entry saved with the final test visible and carrying its result (tracks with a hidden test only).
const testSaved=l=>Object.hasOwn(TEST_TRACKS,l.track)&&testScore(l)!=null;
// opt is accepted for older callers and ignored.
function logAdd(track,cfg,res,primary,opt={}){const t=team(),input=$('#expNote'),note=input?input.value.trim():'',same=logSig(cfg,{...res,primary}),fin=testSaved({track,res:{...res,primary}});
 const dup=t.log.find(l=>l.track===track&&l.cfg&&l.res&&logSig(l.cfg,l.res)===same);
 if(dup&&note&&!dup.note){dup.note=note;input.value='';noteErr(false);noteSync(track);save();renderProg();renderLabLog(track);toast(T('Dopisaliśmy wniosek do zapisanego wyniku.'));return}
 if(dup){toast(T('Ten wynik jest już w dzienniku. Zmieńcie jedno ustawienie, aby zapisać nowy eksperyment.'),{action:[T('Otwórz dziennik'),()=>go('deliver')]});return}
 if(noteRequired(track,fin)&&!note&&!S.trainer){toast(NOTE_MSG());noteErr(true);if(input)input.focus();return}
 const tv=(testLabOf(t,track)||{testViews:0}).testViews;
 t.log.push({id:newId(),ts:new Date().toISOString(),track,cfg,res:{...res,primary},note,testViews:tv});if(input)input.value='';noteErr(false);noteSync(track);
 const ok=save();renderProg();renderHeroProg(track);renderLabSteps(track);renderLabLog(track);syncRevealGate();updateSaveReady(track,cfg,res,primary);if(S.view==='lab'&&S.sub.lab===track)renderChallenge(track);
 if(ok)toast(T('Zapisano w dzienniku zespołu.'),{action:[T('Otwórz dziennik'),()=>go('deliver')]});
 else toast(T('Nie zapisano w pamięci przeglądarki. Pobierzcie plik zespołu.'))}
// The first final-result save (test revealed, the save carries a test result, at least MIN_EXPERIMENTS experiments, no entry
// saved with the test visible yet) needs no conclusion sentence; every other save follows the normal rule. logAdd passes
// whether the entry being saved carries a test result; the field indicator guesses it from the current view.
function noteRequired(track,carries=pendingTest(track)){const t=team(),L=testLabOf(t,track),n=expCount(track);return n>=2&&!(carries&&L&&L.revealed&&n>=MIN_EXPERIMENTS&&!t.log.some(l=>l.track===track&&testSaved(l)))}
// Would a save now carry a test result? The test is revealed and the result on screen is a final-test one (vision: the trained model, shown on the test photos).
function pendingTest(track,t=team()){const L=testLabOf(t,track);if(!L||!L.revealed)return false;if(track==='rag')return!!L.mrun&&L.mrun.set==='test';if(track==='vision')return visTrained(L);const r=complSel(L);return!!r&&r.set==='test'}
const TEST_SAVE_HINT=()=>T('Zapiszcie ten wynik w dzienniku – wtedy trafi do raportu jako ocena końcowa.');
// The hint by the save bar shows while the test set is revealed; the note field follows.
function syncTestSave(){const h=$('#testSaveHint');if(!h)return;const k=h.dataset.track,L=testLabOf(team(),k);h.hidden=!(L&&L.revealed);noteSync(k)}
// What "one thing" means on each track, for the experiments hint: [pl, en].
const ONE_THING=k=>({vision:['np. zmieńcie tylko liczbę zdjęć albo tylko liczbę rund','e.g. change only the number of photos or only the number of rounds'],rag:['np. usuńcie z bazy jeden dokument albo zmieńcie tylko wielkość fragmentu','e.g. remove one document from the base or change only the fragment size'],complaints:['np. dopiszcie jedną zasadę do polecenia albo zmieńcie tylko liczbę przykładów','e.g. add one rule to the instruction or change only the number of examples'],forecast:['np. wyłączcie tylko sezonowość albo zmieńcie tylko liczbę ukrytych miesięcy','e.g. switch off only the seasonality or change only the number of hidden months'],maint:['np. zmieńcie tylko próg albo włączcie jeden czujnik','e.g. change only the threshold or switch on one sensor']})[k]||['np. jedno ustawienie','e.g. one setting'];
const NOTE_MSG=()=>T('Dopiszcie jedno zdanie wniosku – trafi do raportu.');
const noteReqTxt=r=>r?T('(wymagane)'):'';
const NOTE_STARTERS=k=>({
 vision:[T('Po tej zmianie model wykrył więcej wad, ale: ','After this change the model caught more defects, but: '),T('Nadal trudne do wykrycia są: ','Still hard to detect: ')],
 rag:[T('Po zmianie ustawień asystent lepiej radzi sobie z: ','After changing the settings the assistant handles better: '),T('Nadal błędnie odpowiada na pytania o: ','Still answers wrongly on questions about: ')],
 complaints:[T('Po zmianie polecenia poprawiła się kategoria: ','After changing the instruction this category improved: '),T('Nadal mylą się zgłoszenia, w których: ','Still misclassified are complaints where: ')],
 forecast:[T('Przy większej liczbie ukrytych miesięcy błąd modelu: ','With more hidden months the model error: '),T('Najtrudniejszy produkt do prognozy to: ','The hardest product to forecast is: ')],
 maint:[T('Po zmianie progu / czujników alarm wykrywa: ','After changing threshold / sensors the alarm catches: '),T('Koszt tej zmiany w fałszywych alarmach to: ','The cost of this change in false alarms is: ')]
})[k]||[T('Po zmianie jednego ustawienia wynik: ','After changing one setting the score: ')];
function cfgDiff(track,a,b){if(!isObj(a)||!isObj(b))return[];const out=[],yn=v=>v?T('wł.','on'):T('wył.','off');
 if(track==='vision'){if(a.n!==b.n)out.push(`${T('zdjęcia','photos')}: ${a.n} → ${b.n}`);if(a.rounds!==b.rounds)out.push(`${T('rundy','rounds')}: ${a.rounds} → ${b.rounds}`);[['bright',T('jasność','brightness')],['detail',T('szczegóły','detail')]].forEach(([k,l])=>{if(!!a[k]!==!!b[k])out.push(`${l}: ${yn(a[k])} → ${yn(b[k])}`)});if(a.thr!==b.thr)out.push(`${T('próg','threshold')}: ${Math.round(a.thr*100)}% → ${Math.round(b.thr*100)}%`)}
 else if(track==='complaints'){if(a.ver!==b.ver)out.push(`${T('polecenie','instruction')}: ${a.ver||'v1'} → ${b.ver||'v1'}`);if(a.shots!==b.shots)out.push(`${T('przykłady','examples')}: ${a.shots} → ${b.shots}`);if(a.model&&b.model&&a.model!==b.model)out.push(`model: ${aiModelName(a.model)} → ${aiModelName(b.model)}`)}
 else if(track==='rag'){const da=a.docs||[],db=b.docs||[],add=db.filter(x=>!da.includes(x)),del=da.filter(x=>!db.includes(x));if(add.length||del.length)out.push(`${T('dokumenty','documents')}: ${[...del.map(x=>'−'+x),...add.map(x=>'+'+x)].join(' ')}`);if(a.size!==b.size)out.push(`${T('fragment (słowa)','fragment (words)')}: ${a.size} → ${b.size}`);if(a.overlap!==b.overlap)out.push(`${T('zakładka (zdania)','overlap (sentences)')}: ${a.overlap} → ${b.overlap}`);if(a.k!==b.k)out.push(`k: ${a.k} → ${b.k}`);if((a.ins||'')!==(b.ins||''))out.push(T('polecenie zmienione','instruction changed'));if(a.min!==b.min)out.push(`${T('próg','threshold')}: ${num(a.min,2)} → ${num(b.min,2)}`);if(a.model&&b.model&&a.model!==b.model)out.push(`model: ${aiModelName(a.model)} → ${aiModelName(b.model)}`);if(a.lang&&b.lang&&a.lang!==b.lang)out.push(`${T('język','lang')}: ${a.lang.toUpperCase()} → ${b.lang.toUpperCase()}`)}
 else if(track==='forecast'){if(a.p!==b.p)out.push(`${T('produkt','product')}: ${(PRODUCTS[a.p]||[])[langIx()]||a.p} → ${(PRODUCTS[b.p]||[])[langIx()]||b.p}`);if(a.h!==b.h)out.push(`${T('ukryte mies.','hidden mo.')}: ${a.h} → ${b.h}`);if(!!a.trend!==!!b.trend)out.push(`trend: ${yn(a.trend)} → ${yn(b.trend)}`);if(!!a.season!==!!b.season)out.push(`${T('sezonowość','seasonality')}: ${yn(a.season)} → ${yn(b.season)}`)}
 else if(track==='maint'){const ka=(a.keys||Object.keys(a.f||{}).filter(k=>a.f[k])).sort(),kb=(b.keys||Object.keys(b.f||{}).filter(k=>b.f[k])).sort();if(ka.join('+')!==kb.join('+'))out.push(`${T('czujniki','sensors')}: ${ka.map(MT_KEY).join('+')} → ${kb.map(MT_KEY).join('+')}`);if(a.thr!==b.thr)out.push(`${T('próg','threshold')}: ${num(a.thr)} → ${num(b.thr)}`);if(a.win!==b.win)out.push(`${T('wygładzanie','smoothing')}: ${a.win} → ${b.win} min`)}
 return out}
function clearSaveReady(){['expReady','expDelta','expDiff'].forEach(id=>{const e=$('#'+id);if(e){e.textContent='';if(id!=='expReady')e.hidden=true}})}
function updateSaveReady(track,cfg,res,primary){const el=$('#expReady'),dl=$('#expDelta'),df=$('#expDiff');if(!el)return;const t=team(),same=logSig(cfg,{...res,primary}),dup=t.log.some(l=>l.track===track&&l.cfg&&l.res&&logSig(l.cfg,l.res)===same),testSave=testSaved({track,res:{...res,primary}});
 const saved=t.log.filter(l=>l.track===track&&!legacyRun(l)&&isObj(l.cfg)&&isObj(l.res)&&isObj(l.res.primary)&&typeof l.res.primary.v==='number');
 if(df){const last=saved[saved.length-1],diffs=last?cfgDiff(track,last.cfg,cfg):[];if(diffs.length){df.hidden=false;df.innerHTML=`<b>${T(`Zmiana względem ostatniego zapisu (#${saved.length})`,`Changed vs last saved (#${saved.length})`)}:</b> ${esc(diffs.join(' · '))}`}else{df.hidden=true;df.textContent=''}}
 if(dl){const b=saved.length?bestRun(t,track):null,be=b?(b.testEntry||b.entry):null;
  if(saved.length&&be&&primary&&typeof primary.v==='number'){const first=saved[0],sameProd=track!=='forecast'||cfg.p===be.cfg.p,sameSet=!Object.hasOwn(TEST_TRACKS,track)||(!!primary.test===testSaved(be)&&(track!=='complaints'||cfg.set===be.cfg.set));
   const d=primary.v-be.res.primary.v,hi=primary.hi!==false,better=hi?d>5e-4:d<-5e-4,worse=hi?d<-5e-4:d>5e-4,pp=(d>=0?'+':'−')+num(Math.abs(d)*100,1)+' '+T('pkt proc.','pp');
   const cNow=isObj(res.ai)?res.ai.cost:null,cBest=isObj(be.res.ai)?be.res.ai.cost:null,cPart=cNow!=null&&cBest!=null?` <span class="hint">(${usd(cBest)} → ${usd(cNow)})</span>`:'';
   dl.hidden=false;dl.innerHTML=`<div class="ed-item"><span class="edu-overline">${T('Pierwszy (#1)','First (#1)')}</span><b>${pct(first.res.primary.v)}</b></div><div class="ed-item"><span class="edu-overline">${T('Najlepszy zapisany','Best saved')}</span><b>${pct(be.res.primary.v)}</b></div><div class="ed-item"><span class="edu-overline">${T('Teraz','Now')}</span><span><b>${pct(primary.v)}</b> ${sameProd&&sameSet?`<span class="edu-chip ${better?'tone-green':worse?'tone-red':'tone-stone'}">${pp}</span>`:`<span class="edu-chip tone-stone">${T('inny zbiór / produkt','other split / product')}</span>`}${cPart}</span></div>`}
  else{dl.hidden=true;dl.textContent=''}}
 if(dup){el.dataset.state='dup';el.textContent=T('Ten wynik jest już w dzienniku – zmieńcie jedno ustawienie, aby zrobić kolejny eksperyment.','This result is already in the log – change one setting to run another experiment.');return}
 const n=expCount(track);
 el.dataset.state='ready';el.textContent=(testSave?T('Gotowe do zapisu jako wynik testu końcowego','Ready to save as the final test result'):T(`Gotowe do zapisu (eksperyment ${n+1} z min. ${MIN_EXPERIMENTS})`,`Ready to save (experiment ${n+1} of min. ${MIN_EXPERIMENTS})`))+'.'}
function saveBar(track){const nr=noteRequired(track),st=NOTE_STARTERS(track);return`<div class="exp-delta" id="expDelta" data-track="${track}" hidden></div><p class="exp-diff" id="expDiff" data-track="${track}" hidden></p><p class="exp-ready" id="expReady" data-track="${track}" aria-live="polite"></p><div class="card-foot" style="padding:12px 0 0;margin-top:8px;align-items:flex-end"><div class="field" style="flex:1 1 280px"><label for="expNote">${T('Czego się nauczyliśmy? Gdzie system się myli?')} <span id="expNoteReq">${noteReqTxt(nr)}</span></label><input id="expNote" class="input" type="text" maxlength="1000" data-note-required="${nr}" aria-required="${nr}" aria-describedby="expNoteMsg" placeholder="${track==='vision'?T('Który typ wady (wgniecenie, etykieta, kod) zostaje problemem?'):T('Jednym zdaniem: co ta zmiana poprawiła, a gdzie system nadal się myli?')}"><div class="note-starters" aria-label="${esc(T('Podpowiedzi początku zdania','Sentence starters'))}">${st.map(s=>`<button type="button" class="chip chip-xs" data-starter="${esc(s)}">+ ${esc(s.trim())}</button>`).join('')}</div><p id="expNoteMsg" class="hint" style="margin:4px 0 0"></p></div><button type="button" class="btn" id="sv">${ic('save')}${T('Zapiszcie wynik w dzienniku')}</button></div>${Object.hasOwn(TEST_TRACKS,track)?`<p class="hint" id="testSaveHint" data-track="${track}"${(testLabOf(team(),track)||{}).revealed?'':' hidden'}>${TEST_SAVE_HINT()}</p>`:''}`}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-starter]');if(!b)return;const i=$('#expNote');if(!i)return;const s=b.dataset.starter;i.value=i.value.trim()?i.value.trim()+' '+s:s;if(i.hasAttribute('aria-invalid'))noteErr(false);i.focus();i.setSelectionRange(i.value.length,i.value.length)});
// Every saved entry of a track is one of its experiments.
const expTxt=(n,m=MIN_EXPERIMENTS)=>n>m?`${n} (min. ${m})`:`${n}/${m}`;
const expOf=(t,k)=>t.log.filter(l=>l.track===k).length;
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
  toast(T(`Plik zespołu ${from}${n?` („${n}”)`:''}. Wczytać go do zespołu ${to} i zastąpić obecne dane tego zespołu?`,`Team file from team ${from}${n?` (“${n}”)`:''}. Load it into team ${to} and replace that team’s current data?`),{action:[T(`Wczytajcie do zespołu ${to}`,`Load into team ${to}`),()=>guardRun(()=>{S.team=to;withUndo(T(`Wczytano dane do zespołu ${to}.`,`Data loaded into team ${to}.`),()=>{S.teams[to]=normTeam(o.data);if(!S.teams[to].onboardedAt)S.teams[to].onboardedAt=new Date().toISOString()})})]})};rd.readAsText(file)}

