// js/lab-core.js - Lab shell: the guided exercise in five steps, walk-in rooms loader, the final-test gate and the list of saved experiments.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── View: lab shell ───
// Sticky shortcuts to the parts of a long lab page; the offset keeps the target below the sticky bars.
const JUMPS=()=>[['labData',T('Dane')],['labMethod',T('Budowa')],['labProto',T('Eksperyment')],['labExp',T('Wyniki')]];
const jumpBar=()=>`<nav class="jump" id="labJump" aria-label="${T('Skróty do części strony')}"><div class="wrap">${JUMPS().map(([id,l])=>`<button type="button" class="chip" data-j="${id}">${l}</button>`).join('')}</div></nav>`;
function bindJump(){setHdrH();
 $$('#labJump button').forEach(b=>b.onclick=()=>{const el=$('#'+b.dataset.j);if(!el)return;
  const off=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h'))||0)+$('#labJump').offsetHeight+12,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({top:el.getBoundingClientRect().top+scrollY-off,behavior:reduce?'auto':'smooth'})})}
// ─── The five steps of every lab (the same order as the five room stations) ───
// The labels name what the team does on its track; the done-state comes only from the team's saved work.
const LAB_STEPS=k=>[['task',T('Zadanie')],['data',({vision:T('Zdjęcia puszek'),rag:T('Dokumenty firmy'),complaints:T('Zgłoszenia klientów'),forecast:T('Historia sprzedaży'),maint:T('Odczyty czujników')})[k]||T('Dane')],
 ['build',({vision:T('Polecenie i przykłady'),rag:T('Polecenie i wyszukiwanie'),complaints:T('Polecenie i przykłady')})[k]||T('Trenowanie modelu')],['experiment',T('Eksperymenty')],
 ['result',AI_TRACKS.includes(k)?T('Test końcowy'):k==='forecast'?T('Wynik na ukrytych miesiącach'):T('Wynik na nowych minutach')]];
// Built: a model run exists (language-model tracks) or the model is trained on the current settings (forecast, machine failures); a saved experiment also counts.
function labBuilt(t,k){const L=t.lab;if(expOf(t,k)>0)return true;
 if(k==='vision')return L.vision.mruns.length>0;if(k==='complaints')return L.compl.runs.length>0;if(k==='rag')return!!L.rag.mrun;
 if(k==='forecast')return typeof fcTrained==='function'&&fcTrained(L.fc);if(k==='maint')return typeof mtTrained==='function'&&mtTrained(L.mt);return false}
// task: the lab is open; data: the data file, the data card or the room's data station was opened; experiment: MIN_EXPERIMENTS saved;
// result: the final-test result is in the log (tracks with a hidden test), elsewhere the experiments themselves (their check is already on unseen data).
function labStepState(k,t=team()){const n=expOf(t,k),tl=testLabOf(t,k);
 return{task:true,data:!!(t.track===k&&t.seen.data||t.seen['room.'+k+'.data']||t.seen['lab.'+k+'.data']),build:labBuilt(t,k),experiment:n>=MIN_EXPERIMENTS,result:tl?finalSaved(t,k):n>=MIN_EXPERIMENTS}}
// The step strip in the lab hero. A safe no-op when the strip is not on the page; lab files call it after a training, a run or a save.
function renderLabSteps(k=S.sub.lab){const el=$('#labSteps');if(!el||!LAB_KEYS.includes(k))return;const st=labStepState(k),L5=LAB_STEPS(k),cur=(L5.find(s=>!st[s[0]])||[])[0];
 el.dataset.track=k;el.dataset.done=L5.filter(s=>st[s[0]]).length;el.setAttribute('aria-label',T('Kroki ćwiczenia'));
 if(setHTML(el,L5.map(([id,l],i)=>`<li data-step="${id}" data-done="${!!st[id]}"${id===cur?' aria-current="step"':''}><span class="ls-n">${st[id]?ic('check'):i+1}</span><span class="ls-t">${l}<span class="sr-only"> ${st[id]?T('(zrobione)'):id===cur?T('(teraz)'):''}</span></span></li>`).join('')))icons(el)}
function vLab(){X.aiHook=null;const M=trMeta(),k=S.sub.lab,m=M[k],t=team(),tone=TONE[k],compact=!!(t.track&&t.track===k&&!X.showAllTracks);
 const trackNav=`<div class="tabs mt${compact?' tabs-compact':''}" id="trackTabs" role="navigation" aria-label="${T('Zadania')}">${LAB_KEYS.map(x=>`<button type="button" data-k="${x}" class="${k===x?'on':''}" ${k===x?'aria-current="true"':''}${compact&&x!==k?' hidden':''}>${ic(M[x].ic)}${M[x].title}${t.track===x?` <span class="edu-chip tone-ink">${T('wybrana')}</span>`:''}</button>`).join('')}${t.track&&t.track===k?`<button type="button" class="btn-ghost btn-sm track-toggle" id="trackTabsToggle" aria-expanded="${!compact}">${compact?T('Inne zadania (4)','Other tasks (4)'):T('Zwiń inne zadania','Hide other tasks')} ${ic(compact?'chevron-down':'chevron-up')}</button>`:t.track?`<button type="button" class="btn-ghost btn-sm track-toggle" id="backMyTrack">${ic('arrow-left')}${T(`Wróć do: ${M[t.track].title}`,`Back to: ${M[t.track].title}`)}</button>`:''}</div>`;
 mainEl.innerHTML=pageHead(nm('lab'),T('Zbudujcie rozwiązanie AI krok po kroku: obejrzyjcie dane, zbudujcie pierwszą wersję, przeprowadźcie co najmniej trzy eksperymenty i zapiszcie wynik.'),`${trackNav}${roomBar()}`)
 +`<section class="sec"><div class="wrap"><div class="group-hero tone-${tone} edu-block"><div><p class="edu-overline">${T('Zadanie')}</p><p class="gh-title">${m.title}</p><p>${m.inp} → ${m.proc} → ${m.out}</p><p class="mt" id="labIntro">${m.how} ${T('Idźcie po kolei przez pięć kroków: zadanie, dane, budowa, eksperymenty, wynik.')}</p><p class="row mt"><button type="button" class="btn-ghost btn-sm" id="pickTrack" aria-pressed="${t.track===k}">${ic(t.track===k?'check':'flag')}${t.track===k?T('To zadanie naszego zespołu'):T('Wybierzcie jako zadanie zespołu')}</button></p></div><div id="heroProg"></div></div><ol id="labSteps" class="lab-steps mt"></ol></div></section>`
 +jumpBar()+`<section class="sec" id="labData"><h2 class="sr-only">${T('Dane i budowa rozwiązania')}</h2><div class="wrap"><div class="grid2">${card('database',T('Krok 2 · Dane'),`<p>${T('Plik')}: <code>${m.data}</code></p><p>${T('Zanim cokolwiek zbudujecie, obejrzyjcie dane: co w nich jest, ile ich jest i czego brakuje.')}</p><p><button type="button" class="linkbtn" id="tod">${T('Zobaczcie kartę danych')}</button></p>`,{tone})}<div id="labMethod">${card('list-checks',T('Budowa: jak powstaje to rozwiązanie'),`<div class="grid3"><div><span class="edu-overline">${T('Wejście')}</span><p>${m.inp}</p></div><div><span class="edu-overline">${T('Przetwarzanie')}</span><p>${m.proc}</p></div><div><span class="edu-overline">${T('Wyjście')}</span><p>${m.out}</p></div></div><ol class="lab-build" id="labBuild">${m.build.map(x=>`<li>${glx(x)}</li>`).join('')}</ol>`,{tone})}</div></div>${k==='maint'?`<div class="mt">${personaQuote('anna','maint')}</div>`:''}</div></section>`
 +`<section class="sec" id="labProto"><div class="wrap"><div class="sec-head">${badge(m.ic,tone,1)}<h2>${T('Budowa i eksperymenty')}</h2></div><div id="aiSlot"></div><div id="proto"></div><div id="challengeSlot"></div></div></section>`
 +`<section class="sec" id="labExp"><div class="wrap">${Object.hasOwn(TEST_TRACKS,k)?goalLine(k):''}<div id="labFinal" class="callout tone-green edu-block mt" aria-live="polite" hidden></div><div class="mt">${card('notebook-pen',T('Zapisane eksperymenty'),`<p class="hint" style="margin-top:0">${T('Każdy zapisany eksperyment tego zadania, od najnowszego: co ustawiliście i jaki był wynik.')}</p><div id="labLog"></div>`,{tone})}</div></div></section>`;
 renderHeroProg(k);bindJump();
 $$('#trackTabs button[data-k]').forEach(b=>b.onclick=()=>{go('lab',b.dataset.k);const t=$(`#trackTabs button[data-k="${b.dataset.k}"]`);if(t&&S.view==='lab')t.focus()});
 const tt=$('#trackTabsToggle');if(tt)tt.onclick=()=>{X.showAllTracks=!X.showAllTracks;const c=!X.showAllTracks;$('#trackTabs').classList.toggle('tabs-compact',c);$$('#trackTabs button[data-k]').forEach(b=>{b.hidden=c&&b.dataset.k!==k});tt.setAttribute('aria-expanded',String(!c));tt.innerHTML=(c?T('Inne zadania (4)','Other tasks (4)'):T('Zwiń inne zadania','Hide other tasks'))+' '+ic(c?'chevron-down':'chevron-up');icons(tt);if(X.room)roomHost.style.setProperty('--room-head',Math.ceil(mainEl.getBoundingClientRect().height)+2+'px')};
 const bm=$('#backMyTrack');if(bm)bm.onclick=()=>{X.showAllTracks=false;go('lab',team().track)};
 $('#pickTrack').onclick=()=>guardRun(()=>{const tt=team();setTrack(tt,tt.track===k?null:k);save();render();const b=$('#pickTrack');if(b)b.focus()});
 $('#tod').onclick=()=>{if(!S.example&&!team().seen['lab.'+k+'.data']){team().seen['lab.'+k+'.data']=true;save();renderLabSteps(k)}if(X.room)return X.room.handle.open('data');openDataCardModal(k)};
 X.labRedraw=null;({vision:labVision,rag:labRag,complaints:labCompl,forecast:labFc,maint:labMaint})[k]();
 renderLabSteps(k);renderLabLog(k);syncRevealGate();roomSync(k)}
// ─── Lab: walk-in rooms (rooms/*.js) ───
// Room mode moves the lab sections just drawn into the five station panels of the track's room (never cloned, so ids,
// handlers and typed text stay). #roomHost sits outside #main: re-renders keep the canvas and only swap the panels.
// ?rooms=0 forces the page view (old test suites); S.rooms is the participant's choice; no WebGL2 -> page view with a notice.
const ROOMS_OFF=new URLSearchParams(location.search).get('rooms')==='0',roomHost=$('#roomHost');
// The 3D stack (three.js, the engine and the one room script of the track) is fetched when a lab first needs it, not with the page:
// a team that stays on the pages never downloads it. Until it arrives the lab shows as a page, then render() swaps in the room.
const roomJs={},roomReady={},roomBusy={};
const roomSrc=u=>roomJs[u]||(roomJs[u]=new Promise((ok,no)=>{const e=document.createElement('script');e.src=u;e.onload=ok;e.onerror=()=>no(new Error(u));document.head.appendChild(e)}));
const roomLoad=k=>roomSrc('vendor/three/three.global.js').then(()=>roomSrc('rooms/engine.js')).then(()=>roomSrc('rooms/room-'+k+'.js'));
function roomFetch(k){if(roomBusy[k])return;roomBusy[k]=true;roomLoad(k).then(()=>{roomReady[k]=true},()=>{X.roomFail=true}).then(()=>{roomBusy[k]=false;if(S.view==='lab'&&S.sub.lab===k)render()})}
let glMemo;const glOk=()=>{if(glMemo===undefined)try{const g=document.createElement('canvas').getContext('webgl2');glMemo=!!g;const l=g&&g.getExtension('WEBGL_lose_context');if(l)l.loseContext()}catch(e){glMemo=false}return glMemo};
const roomCan=()=>!X.roomFail&&(window.Rooms?Rooms.supported():glOk()),roomWant=()=>!ROOMS_OFF&&S.rooms!==false&&roomCan(),roomOk=(k=S.sub.lab)=>roomWant()&&!!window.Rooms&&!!roomReady[k];
const roomBar=()=>ROOMS_OFF?'':S.rooms===false?(roomCan()?`<p class="mt" style="margin-bottom:0"><button type="button" class="btn-ghost btn-sm" id="roomOn">${ic('box')}${T('Wejdźcie do pokoju 3D')}</button></p>`:''):roomCan()?'':`<p class="hint mt" id="roomNote" style="margin-bottom:0">${T('Ta przeglądarka nie pokaże pokoju 3D (brak WebGL2), dlatego zadanie jest w zwykłym widoku strony.')}</p>`;
const ROOM_TITLES=()=>({brief:{pl:'Zadanie',en:'Brief'},data:{pl:'Dane',en:'Data'},method:{pl:'Budowa',en:'Build'},experiment:{pl:'Eksperyment',en:'Experiment'},results:{pl:'Wyniki',en:'Results'}});
// What the room shows of the real data: can photos (data: URLs only, safe on file://), document codes, categories,
// products and one product's monthly sales, and a vibration window around the first sensor event.
function roomData(k){const i=langIx();if(k==='vision'){visInit();return{vision:{photos:VIS.train.slice(0,6).map(x=>x.url).filter(u=>/^data:/.test(u)),brand:'Rybex'}}}
 if(k==='rag')return{rag:{docs:DOCS.map(d=>d.id)}};if(k==='complaints')return{complaints:{categories:CK.map(c=>CAT[c][i])}};
 if(k==='forecast')return{forecast:{products:PRODUCTS.map(p=>p[i]),monthly:DATA.sales.filter(r=>r.product===PRODUCTS[0][0]).map(r=>r.units_k)}};
 const R=DATA.sensors,a=Math.max(0,R.findIndex(r=>r.anomaly)-90);return{maint:{series:R.slice(a,a+120).map(r=>r.vibration_mm_s)}}}
// An element inside a closed station (jump and path links, gate focus): open that station first.
function roomShow(el){const sl=el&&X.room&&el.closest&&el.closest('#roomHost .room-slot');if(sl)X.room.handle.open(sl.dataset.station);return el}
function roomDispose(){if(X.room){X.room.handle.dispose();X.room=null}roomHost.replaceChildren();roomHost.hidden=true;delete roomHost.dataset.roomStatus;document.body.classList.remove('in-room')}
// Old panels stay in #roomHost while vLab re-renders #main; $() finds the new nodes because #main precedes #roomHost.
// The room's guide once the team has reached the experiment station: what the lab still needs, in order - MIN_EXPERIMENTS
// experiments (each one named: "Eksperyment 2 z 3"), then the final test on the team's own task, and the results.
// Before that the stations lead in their own order.
function roomGuide(k,seen){const t=team(),n=expOf(t,k),M=MIN_EXPERIMENTS,tags={experiment:`${Math.min(n,M)}/${M}`},at=(station,text)=>({station,text,tags});
 if(!seen.includes('experiment')){if(t.track===k&&t.seen.data&&!n)return at('experiment',T(`Zadanie i dane już znacie. Zbudujcie pierwszą wersję, uruchomcie ją i zapiszcie wynik (1 z ${M}).`,`You already know the brief and data. Build the first version, run it and save the result (1 of ${M}).`));return{tags}}
 if(!n)return at('experiment',T(`Eksperyment 1 z ${M}: zbudujcie pierwszą wersję, uruchomcie ją i zapiszcie wynik.`,`Experiment 1 of ${M}: build the first version, run it and save the result.`));
 if(n<M)return at('experiment',T(`Eksperyment ${n+1} z ${M}: zmieńcie jedno ustawienie, uruchomcie i zapiszcie wynik.`,`Experiment ${n+1} of ${M}: change one setting, run it and save the result.`));
 if(t.track===k&&step7(t)!=='done'){const h=PATH_STEPS(t).find(s=>s.id==='iterate').hint;return at('experiment',T('Eksperymenty gotowe. Teraz test końcowy: ')+h+'.')}
 if(!seen.includes('results'))return at('results',T(`Macie ${n} ${plural(n,['eksperyment','eksperymenty','eksperymentów'],[])}. Zobaczcie zapisane wyniki.`,`You have ${n} experiments. See the saved results.`));
 return{done:true,tags,text:T('Laboratorium gotowe: eksperymenty i wynik są zapisane. Kolejny krok pokazuje pasek u góry.')}}
// The walk is kept in the team (seen['room.<track>.<station>']), so it survives the room being mounted again (language or team switch, reload).
const ROOM_STATIONS=['brief','data','method','experiment','results'],roomSeen=k=>{const t=team(),s=ROOM_STATIONS.filter(x=>t.seen['room.'+k+'.'+x]);if(t.track===k&&t.seen.data){if(!s.includes('brief'))s.push('brief');if(!s.includes('data'))s.push('data')}return s};
function roomSync(k){if(roomWant()&&!roomReady[k])roomFetch(k);if(!roomOk(k)){roomDispose();roomHost.dataset.roomStatus=roomBusy[k]?'loading':'2d';const b=$('#roomOn');if(b)b.onclick=()=>guardRun(()=>{S.rooms=true;save();render()});return}
 const pane=(...n)=>{const d=document.createElement('div');d.className='room-pane';d.append(...n.filter(Boolean));return d};
 // Brief: the hero with the step strip and the data card; method: the "Budowa" card; experiment: the model and its runs; results: the saved experiments.
 const hero=$('#main .group-hero').closest('.sec'),exp=pane($('#labProto')),meth=pane($('#labMethod')),brief=pane(hero,$('#labData')),res=pane($('#labExp')),data=pane();
 renderDataViewer(TRACK_FILE[k],data);mainEl.replaceChildren($('.page-head',mainEl));
 const P={brief,data,method:meth,experiment:exp,results:res},r=X.room;roomHost.hidden=false;document.body.classList.add('in-room');roomHost.style.setProperty('--room-head',Math.ceil(mainEl.getBoundingClientRect().height)+2+'px');
 if(r&&r.track===k&&r.lang===S.lang&&r.team===S.team&&r.handle.status!=='disposed'){r.handle.setPanels(P);r.data=data;return}
 // Seen-progress: the team's data file counts as seen when the data station opens, as on the data page.
 const h=Rooms.mount({host:roomHost,track:k,lang:S.lang,data:roomData(k),titles:ROOM_TITLES(),panels:P,seen:roomSeen(k),guide:seen=>roomGuide(k,seen),onSave:S.example?null:exportTeam,
  // A station opened with the room cut by the fold or by the sticky bars: scroll so the room's top sits just under them (the whole room and panel in view, the page heading fully above).
  onOpen:s=>{const t=team(),b=roomHost.getBoundingClientRect(),top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h'))||0;if(b.bottom>innerHeight+2||b.top<top-2)window.scrollBy(0,b.top-top);
   if(ROOM_STATIONS.includes(s)&&!t.seen['room.'+k+'.'+s]){t.seen['room.'+k+'.'+s]=true;save()}
   if(s==='data'&&!t.seen.data&&trackFileOk(t.track,TRACK_FILE[k])){t.seen.data=true;save();renderPathBar()}renderLabSteps(k)},
  onExit2d:()=>guardRun(()=>{S.rooms=false;save();render();const b=$('#roomOn');if(b)b.focus()})});
 X.room={track:k,lang:S.lang,team:S.team,handle:h,data};
 // The 3D view failed after all (scripts half-loaded, a shader error): the page view with the notice.
 if(h.status==='fallback'){X.roomFail=true;roomDispose();render()}}
// The language-model bar is shown on the three tracks built with the model.
const aiWanted=k=>AI_TRACKS.includes(k);
function syncAiBar(){const slot=$('#aiSlot');if(!slot)return;const want=aiWanted(S.sub.lab);
 if(want&&!$('#aiBar')){slot.innerHTML=aiBar();bindAiBar();icons(slot)}else if(!want&&slot.firstChild)slot.innerHTML=''}
// The team's own success criterion beside the result: shown, never judged (free text).
const goalLine=k=>{const t=team(),g=t.goal.trim();return t.track===k&&g?`<p class="callout tone-stone edu-block mt" id="goalLine" data-track="${k}"><b>${T('Wasze kryterium sukcesu')}:</b> „${esc(g)}” – ${T('sprawdźcie, czy wynik je spełnia.')}</p>`:''};
// ─── Final-test gate: the test opens once one experiment on the practice set is saved ───
// '' = open. Trainer mode, an already revealed test (old files) and re-reveals after a hide are never gated.
function revealGate(k){const t=team(),L=testLabOf(t,k);if(S.trainer||!L||L.revealed||L.testViews>0)return'';return t.log.some(l=>l.track===k&&!testSaved(l))?'':'experiment'}
const GATE_MSG=()=>T('Zanim odsłonicie test końcowy, uruchomcie model na zestawie ćwiczeniowym i zapiszcie wynik w dzienniku.');
// The inline gate message next to the reveal button (#gateMsg); cleared once the gate is open.
const GATE_P='<p class="hint" id="gateMsg" aria-live="polite"></p>';
const syncRevealGate=()=>{$$('[data-reveal]').forEach(b=>{const g=revealGate(b.dataset.reveal);b.dataset.blocked=g;const m=$('#gateMsg');if(!g&&m)m.textContent=''});syncTestSave()};
// A closed gate says what is missing and moves focus to the save button; an open one reveals the test and runs `after`.
function tryReveal(k,L,after){if(revealGate(k)){const msg=GATE_MSG(),gm=$('#gateMsg'),sv=$('#sv');toast(msg,{reason:'experiment'});if(gm)gm.textContent=msg;if(sv)roomShow(sv).focus();return}
 if(!toastEl.hidden&&toastEl.dataset.reason==='experiment')hideToast();toggleReveal(L);save();after();syncRevealGate();renderLabSteps(k);renderPathBar()}
// ─── Saved experiments of the track ───
const OLD_RUN=()=>T('starszy zapis');
// Entries from before the guided labs: rules runs on the model tracks and the forecast method table. They stay readable, nothing more.
const legacyRun=l=>{const c=isObj(l)&&isObj(l.cfg)?l.cfg:{};return AI_TRACKS.includes(l.track)?c.mode!=='llm':l.track==='forecast'&&!('trend'in c)};
// One line on an experiment's settings (the result is never part of it).
function cfgText(l){const c=l.cfg||{};try{switch(l.track){
  case'vision':return c.mode==='llm'?`prompt ${c.ver||'v1'}, ${cnt(c.shots,'example')}`:OLD_RUN();
  case'rag':return c.mode==='llm'?`k=${c.k}, ${T('akapitów/fragment')}=${c.chunk}, min=${num(c.min,2)}${c.lang?', '+String(c.lang).toUpperCase():''}`:OLD_RUN();
  case'complaints':return c.mode==='llm'?`prompt ${c.ver}, ${cnt(c.shots,'example')}`:OLD_RUN();
  case'forecast':{const p=PRODUCTS[c.p]?PRODUCTS[c.p][langIx()]:c.p;return legacyRun(l)?`${OLD_RUN()}: ${p}, h=${c.h}`:`${p}, ${T(`ukryte miesiące: ${c.h}`,`hidden months: ${c.h}`)}, ${T('model uczy się')}: ${[c.trend?T('trend'):'',c.season?T('sezonowość'):''].filter(Boolean).join(' + ')||T('tylko średni poziom')}`}
  case'maint':return mtCfgTxt(c)}}catch(e){}
 return T('ustawienia nieznane')}
// The track's saved experiments, newest first, each with its plain result; above them the result that goes into the report, once it exists.
function renderLabLog(k=S.sub.lab){const el=$('#labLog');if(!el||!LAB_KEYS.includes(k))return;const t=team(),es=t.log.filter(l=>l.track===k&&isObj(l.cfg)&&isObj(l.res)),b=bestRun(t,k),fin=$('#labFinal'),test=Object.hasOwn(TEST_TRACKS,k),done=!!b&&(test?b.test!=null:es.length>=MIN_EXPERIMENTS);
 el.dataset.n=es.length;
 if(fin){fin.hidden=!done;Object.assign(fin.dataset,{track:k,final:String(done)});fin.innerHTML=done?`<p style="margin:0"><b>${test?T('Test końcowy zrobiony.'):T('Eksperymenty zrobione.')}</b> ${esc(bestText(k,b))} ${T('Do raportu idzie ten wynik.')}</p>`:''}
 el.innerHTML=(es.length?`<ol class="lab-log" reversed>${[...es].reverse().map(l=>`<li data-id="${esc(l.id)}" data-final="${testSaved(l)}"><div class="ll-top"><p class="ll-h"><b>${esc(cfgText(l))}</b> <span class="hint">${esc(fmtTs(l.ts))}</span>${testSaved(l)?` <span class="edu-chip tone-yellow">${T('test końcowy')}</span>`:''}</p>${!legacyRun(l)?`<button type="button" class="btn-ghost btn-sm" data-restore="${esc(l.id)}" title="${esc(T('Wczytajcie ustawienia tego eksperymentu z powrotem do Laboratorium'))}">${ic('rotate-ccw')}${T('Przywróć','Restore')}</button>`:''}</div><p class="ll-r">${esc(resultText(l))}</p>${l.note?`<p class="hint ll-n">${T('Wniosek zespołu')}: ${esc(l.note)}</p>`:''}</li>`).join('')}</ol>`:`<p class="hint" style="margin:0">${T('Nie ma jeszcze zapisanych eksperymentów. Uruchomcie model i zapiszcie wynik w dzienniku – pojawi się tutaj.')}</p>`);
 $$('[data-restore]',el).forEach(btn=>btn.onclick=()=>{const l=team().log.find(x=>x.id===btn.dataset.restore);if(l)restoreRun(l)});icons(el)}
