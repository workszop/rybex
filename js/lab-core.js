// js/lab-core.js - Lab shell, walk-in rooms loader, baseline and its gate, A/B comparison of saved runs.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── View: lab shell ───
// Sticky shortcuts to the parts of a long lab page; the offset keeps the target below the sticky bars.
const JUMPS=()=>[['labData',T('Dane')],['labMethod',T('Metoda')],['labProto',T('Prototyp')],['labExp',T('Eksperymenty')]];
const jumpBar=()=>`<nav class="jump" id="labJump" aria-label="${T('Skróty do części strony')}"><div class="wrap">${JUMPS().map(([id,l])=>`<button type="button" class="chip" data-j="${id}">${l}</button>`).join('')}</div></nav>`;
function bindJump(){setHdrH();
 $$('#labJump button').forEach(b=>b.onclick=()=>{const sv=$('#sv'),el=b.dataset.j==='labExp'?(sv?sv.closest('.card-foot')||sv:$('#labProto')):$('#'+b.dataset.j);if(!el)return;if(b.dataset.j==='labMethod'){const d=$('details',el);if(d)d.open=true}
  const off=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h'))||0)+$('#labJump').offsetHeight+12,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({top:el.getBoundingClientRect().top+scrollY-off,behavior:reduce?'auto':'smooth'})})}
// The method box: on the tracks with a hidden test set the choice opens the test; elsewhere it completes step 7 and goes into the report.
const METH_SUM=k=>methOk(team(),k)&&whyOk(team(),k)?T('Wybór metody i uzasadnienie (gotowe)'):Object.hasOwn(TEST_TRACKS,k)?T('Wybierzcie metodę i uzasadnijcie wybór – potrzebne przed testem'):T('Wybierzcie metodę i uzasadnijcie wybór – część kroku 7, trafia do raportu');
const METH_HINT=k=>Object.hasOwn(TEST_TRACKS,k)?T('Trafia do raportu. Zaznaczcie metodę i napiszcie co najmniej jedno zdanie – bez tego test końcowy pozostaje zamknięty.'):T('Trafia do raportu. Zaznaczcie metodę i napiszcie co najmniej jedno zdanie – bez tego krok 7 nie jest skończony, a raport będzie niepełny.');
// Visible confirmation under the justification; typed: the team just changed it (also refreshes the path bar).
function syncMeth(k,typed){const el=$('#methSaved'),t=team(),m=methOk(t,k),w=whyOk(t,k),d=Object.hasOwn(t.decision,k)?t.decision[k]:null,txt=d&&typeof d.why==='string'?d.why.trim():'';if(!el)return;
 el.dataset.saved=String(m&&w);el.textContent=m&&w?T('Zapisano – wybrana metoda i uzasadnienie trafią do raportu.'):typed&&m&&txt?T('Uzasadnienie jest za krótkie – dopiszcie co najmniej jedno zdanie.'):typed&&!m&&txt?T('Zaznaczcie jeszcze metodę w tabeli.'):'';
 const sm=$('#methSum');if(sm&&sm.textContent!==METH_SUM(k))sm.textContent=METH_SUM(k);if(typed)renderProg()}
function vLab(){X.aiHook=null;const M=trMeta(),k=S.sub.lab,m=M[k],t=team(),tone=TONE[k],dec=t.decision[k]||{m:-1,why:''};
 mainEl.innerHTML=pageHead(nm('lab'),T('Wybierzcie zadanie, uzasadnijcie metodę, przeprowadźcie co najmniej trzy eksperymenty i zapiszcie wnioski.'),`<div class="tabs mt" id="trackTabs" role="navigation" aria-label="${T('Zadania')}">${LAB_KEYS.map(x=>`<button type="button" data-k="${x}" class="${k===x?'on':''}" ${k===x?'aria-current="true"':''}>${ic(M[x].ic)}${M[x].title}${t.track===x?` <span class="edu-chip tone-ink">${T('wybrana')}</span>`:''}</button>`).join('')}</div>${roomBar()}`)
 +`<section class="sec"><div class="wrap"><div class="group-hero tone-${tone} edu-block"><div><p class="edu-overline">${T('Zadanie')}</p><p class="gh-title">${m.title}</p><p>${m.inp} → ${m.proc} → ${m.out}</p><p class="mt">${T('Zaczynamy od najprostszej metody, która w ogóle rozwiązuje zadanie. Potem spróbujecie ją pobić. To ta sama zasada, której użyjecie w projekcie końcowym.')}</p><p class="row mt"><button type="button" class="btn" id="runBase">${ic('play')}${T('Uruchomcie metodę odniesienia')}</button><button type="button" class="btn-ghost btn-sm" id="pickTrack" aria-pressed="${t.track===k}">${ic(t.track===k?'check':'flag')}${t.track===k?T('To zadanie naszego zespołu'):T('Wybierzcie jako zadanie zespołu')}</button></p><p class="edu-small" id="baseDef"><b>${T('Metoda odniesienia','The baseline')}</b> = ${BASE_DEF(k)}</p><p class="edu-small">${BASE_INFO(k)}</p></div><div id="heroProg"></div></div><div id="baseBanner" class="callout edu-block mt" aria-live="polite" hidden></div>${['forecast','maint'].includes(k)?'':goalLine(k)}<div id="baseOut" class="mt" aria-live="polite" hidden></div></div></section>`
 +jumpBar()+`<section class="sec" id="labData"><h2 class="sr-only">${T('Założenia zadania')}</h2><div class="wrap"><div class="grid2">${card('database',T('Dane'),`<p>${T('Plik')}: <code>${m.data}</code></p><p><button type="button" class="linkbtn" id="tod">${T('Zobaczcie kartę danych')}</button></p>`,{tone})}${card('list-checks',T('Jak system wykonuje zadanie'),`<div class="grid3"><div><span class="edu-overline">${T('Wejście')}</span><p>${m.inp}</p></div><div><span class="edu-overline">${T('Przetwarzanie')}</span><p>${m.proc}</p></div><div><span class="edu-overline">${T('Wyjście')}</span><p>${m.out}</p></div></div>`,{tone})}</div>${k==='maint'?`<div class="mt">${personaQuote('anna','maint')}</div>`:''}
 <div class="mt" id="labMethod"><details class="meth-more"${Object.hasOwn(X.methOpen||{},k)?(X.methOpen[k]?' open':''):!(methOk(team(),k)&&whyOk(team(),k))?' open':''}><summary id="methSum">${METH_SUM(k)}</summary>${card('scale',T('Wybór metody'),`<div class="tscroll" role="radiogroup" aria-label="${T('Metoda zespołu')}"><div class="meth-cards">${m.methods.map((r,i)=>`<label class="meth-card${dec.m===i?' on':''}"><input type="radio" name="meth" value="${i}" ${dec.m===i?'checked':''}><span class="mc-txt"><b class="mc-name">${glx(r[0])}</b><span class="mc-l"><i class="mc-p">+</i><span>${glx(r[1])}</span></span><span class="mc-l"><i class="mc-m">−</i><span>${glx(r[2])}</span></span><span class="mc-cost"><i>zł</i>${glx(r[3])}</span></span></label>`).join('')}</div><details class="meth-table"><summary>${T('Porównajcie wszystkie metody w tabeli')}</summary><table><thead><tr><th>${T('Podejście')}</th><th>${T('Zalety')}</th><th>${T('Wady')}</th><th>${T('Koszt')}</th></tr></thead><tbody>${m.methods.map(r=>`<tr><td class="mlist">${glx(r[0])}</td><td>${glx(r[1])}</td><td>${glx(r[2])}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table></details></div><div class="field mt"><label for="methWhy">${T('Uzasadnienie wyboru (trafia do raportu)')}</label><textarea id="methWhy" class="input" rows="2" maxlength="2000" aria-describedby="methWhyHint" placeholder="${T('Dlaczego ta metoda pasuje do zadania, danych i kosztów?')}">${esc(dec.why)}</textarea><p class="hint" id="methWhyHint" style="margin:4px 0 0">${METH_HINT(k)}</p><p class="hint" id="methSaved" role="status" aria-live="polite" style="margin:4px 0 0"></p></div>`,{tone})}</details></div></div></section>`
 +`<section class="sec" id="labProto"><div class="wrap"><div class="sec-head">${badge(m.ic,tone,1)}<h2>${T('Prototyp i eksperymenty')}</h2></div><div id="aiSlot"></div><div id="proto"></div><div id="challengeSlot"></div></div></section>`
 +`<section class="sec" id="labExp"><div class="wrap">${card('columns-2',T('Porównajcie dwa przebiegi'),`<p class="hint" style="margin-top:0">${T('Zaznaczcie dwa zapisane wyniki, żeby zobaczyć obok siebie, co się zmieniło i o ile.')}</p><div id="cmpList"></div>`,{tone})}</div></section>`;
 renderHeroProg(k);bindJump();
 $$('#trackTabs button').forEach(b=>b.onclick=()=>{go('lab',b.dataset.k);const t=$(`#trackTabs button[data-k="${b.dataset.k}"]`);if(t&&S.view==='lab')t.focus()});
 $('#pickTrack').onclick=()=>guardRun(()=>{const tt=team();setTrack(tt,tt.track===k?null:k);save();render();const b=$('#pickTrack');if(b)b.focus()});
 $('#tod').onclick=()=>{if(X.room)return X.room.handle.open('data');FSEL=TRACK_FILE[k];go('data')};
 const dset=()=>{const tt=team();return tt.decision[k]||(tt.decision[k]={m:-1,why:''})};
 $$('input[name=meth]').forEach(r=>r.onchange=e=>{dset().m=+e.target.value;save();syncRevealGate();syncMeth(k,true)});$('#methWhy').oninput=e=>{dset().why=e.target.value;save();syncRevealGate();syncMeth(k,true)};syncMeth(k);
 $('#labMethod details').ontoggle=e=>{(X.methOpen||(X.methOpen={}))[k]=e.target.open};
 $('#runBase').onclick=()=>{(X.baseOn||(X.baseOn={}))[baseKey(k)]=true;if(!S.example){team().seen['baseRun.'+k]=true;save()}showBase(k);if(X.labRedraw)X.labRedraw();const o=roomShow($('#baseOut'));if(o)o.scrollIntoView({block:'nearest'})};
 X.labRedraw=null;({vision:labVision,rag:labRag,complaints:labCompl,forecast:labFc,maint:labMaint})[k]();renderCmpList(k);
 if(baseRan(k)||t.log.some(l=>l.track===k&&l.base))showBase(k,!baseRan(k));renderBaseBanner(k);syncRevealGate();roomSync(k)}
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
const ROOM_TITLES=()=>({brief:{pl:'Zadanie',en:'Brief'},data:{pl:'Dane',en:'Data'},method:{pl:'Metoda',en:'Method'},experiment:{pl:'Eksperyment',en:'Experiment'},results:{pl:'Wyniki',en:'Results'}});
// What the room shows of the real data: can photos (data: URLs only, safe on file://), document codes, categories,
// products and one product's monthly sales, and a vibration window around the first sensor event.
function roomData(k){const i=langIx();if(k==='vision'){visInit();return{vision:{photos:VIS.train.slice(0,6).map(x=>x.url).filter(u=>/^data:/.test(u)),brand:'Rybex'}}}
 if(k==='rag')return{rag:{docs:DOCS.map(d=>d.id)}};if(k==='complaints')return{complaints:{categories:CK.map(c=>CAT[c][i])}};
 if(k==='forecast')return{forecast:{products:PRODUCTS.map(p=>p[i]),monthly:DATA.sales.filter(r=>r.product===PRODUCTS[0][0]).map(r=>r.units_k)}};
 const R=DATA.sensors,a=Math.max(0,R.findIndex(r=>r.anomaly)-90);return{maint:{series:R.slice(a,a+120).map(r=>r.vibration_mm_s)}}}
// An element inside a closed station (jump and path links, gate focus): open that station first.
function roomShow(el){const sl=el&&X.room&&el.closest&&el.closest('#roomHost .room-slot');if(sl)X.room.handle.open(sl.dataset.station);return el}
function roomDispose(){if(X.room){X.room.handle.dispose();X.room=null}roomHost.replaceChildren();roomHost.hidden=true;delete roomHost.dataset.roomStatus;document.body.classList.remove('in-room')}
// Old panels stay in #roomHost while vLab re-renders #main; $() finds the new nodes because #main precedes #roomHost; $$('input[name=meth]') also binds the old radios harmlessly until setPanels.
// The room's guide once the team has reached the experiment station: what the lab still needs, in order - the baseline,
// MIN_EXPERIMENTS experiments of their own (each one named: "Eksperyment 2 z 3"), then step 7's rest (final test or the
// method choice) on the team's own task, and the results. Before that the stations lead in their own order.
function roomGuide(k,seen){const t=team(),n=expOf(t,k),M=MIN_EXPERIMENTS,tags={experiment:`${Math.min(n,M)}/${M}`},at=(station,text)=>({station,text,tags});
 if(!seen.includes('experiment'))return{tags};
 if(!hasBaseline(t,k)&&!n)return at('experiment',T(`Najpierw metoda odniesienia: uruchomcie ją i zapiszcie wynik. Potem ${M} własne eksperymenty.`,`First the baseline: run it and save the result. Then ${M} experiments of your own.`));
 if(n<M)return at('experiment',T(`Eksperyment ${n+1} z ${M}: zmieńcie jedno ustawienie, uruchomcie i zapiszcie wynik.`,`Experiment ${n+1} of ${M}: change one setting, run it and save the result.`));
 if(t.track===k){const s7=step7(t);if(s7==='meth')return at('method',T('Eksperymenty gotowe. Wybierzcie metodę i uzasadnijcie wybór.'));
  if(s7!=='done'){const h=PATH_STEPS(t).find(s=>s.id==='iterate').hint;return at('experiment',T('Eksperymenty gotowe. Teraz test końcowy: ')+h+'.')}}
 if(!seen.includes('results'))return at('results',T(`Macie ${n} ${plural(n,['eksperyment','eksperymenty','eksperymentów'],[])}. Porównajcie przebiegi.`,`You have ${n} experiments. Compare the runs.`));
 return{done:true,tags,text:T('Laboratorium gotowe: eksperymenty zapisane i porównane. Kolejny krok pokazuje pasek u góry.')}}
// The walk is kept in the team (seen['room.<track>.<station>']), so it survives the room being mounted again (language or team switch, reload).
const ROOM_STATIONS=['brief','data','method','experiment','results'],roomSeen=k=>ROOM_STATIONS.filter(s=>team().seen['room.'+k+'.'+s]);
function roomSync(k){if(roomWant()&&!roomReady[k])roomFetch(k);if(!roomOk(k)){roomDispose();roomHost.dataset.roomStatus=roomBusy[k]?'loading':'2d';const b=$('#roomOn');if(b)b.onclick=()=>guardRun(()=>{S.rooms=true;save();render()});return}
 const pane=(...n)=>{const d=document.createElement('div');d.className='room-pane';d.append(...n.filter(Boolean));return d};
 const hero=$('#main .group-hero').closest('.sec'),bd=$('#baseDef'),bi=bd.nextElementSibling,row=document.createElement('p');row.className='row';row.append($('#runBase'));
 const exp=pane(row,bd,bi,$('#baseBanner'),$('#baseOut'),$('#labProto')),meth=pane($('#labMethod')),brief=pane(hero,$('#labData')),res=pane($('#labExp')),data=pane();
 renderDataViewer(TRACK_FILE[k],data);mainEl.replaceChildren($('.page-head',mainEl));
 const P={brief,data,method:meth,experiment:exp,results:res},r=X.room;roomHost.hidden=false;document.body.classList.add('in-room');roomHost.style.setProperty('--room-head',Math.ceil(mainEl.getBoundingClientRect().height)+2+'px');
 if(r&&r.track===k&&r.lang===S.lang&&r.team===S.team&&r.handle.status!=='disposed'){r.handle.setPanels(P);r.data=data;return}
 // Seen-progress: the team's data file counts as seen when the data station opens, as on the data page.
 const h=Rooms.mount({host:roomHost,track:k,lang:S.lang,data:roomData(k),titles:ROOM_TITLES(),panels:P,seen:roomSeen(k),guide:seen=>roomGuide(k,seen),
  // A station opened with the room cut by the fold or by the sticky bars: scroll so the room's top sits just under them (the whole room and panel in view, the page heading fully above).
  onOpen:s=>{const t=team(),b=roomHost.getBoundingClientRect(),top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h'))||0;if(b.bottom>innerHeight+2||b.top<top-2)window.scrollBy(0,b.top-top);
   if(ROOM_STATIONS.includes(s)&&!t.seen['room.'+k+'.'+s]){t.seen['room.'+k+'.'+s]=true;save()}
   if(s==='data'&&!t.seen.data&&trackFileOk(t.track,TRACK_FILE[k])){t.seen.data=true;save();renderPathBar()}},
  onExit2d:()=>guardRun(()=>{S.rooms=false;save();render();const b=$('#roomOn');if(b)b.focus()})});
 X.room={track:k,lang:S.lang,team:S.team,handle:h,data};
 // The 3D view failed after all (scripts half-loaded, a shader error): the page view with the notice.
 if(h.status==='fallback'){X.roomFail=true;roomDispose();render()}}
// The AI bar is shown only while the lab's method is the model (spec 4.18); method switches re-render #proto and call this.
const aiWanted=k=>k==='vision'?lab().vision.method==='llm':k==='complaints'?lab().compl.method==='llm':k==='rag'?lab().rag.gen==='llm':false;
function syncAiBar(){const slot=$('#aiSlot');if(!slot)return;const want=AI_TRACKS.includes(S.sub.lab)&&aiWanted(S.sub.lab);
 if(want&&!$('#aiBar')){slot.innerHTML=aiBar();bindAiBar();icons(slot)}else if(!want&&slot.firstChild)slot.innerHTML=''}
// ─── Baseline (spec 4.18): always on the tuning set or the lab's visible evaluation window, never on a hidden test set ───
const BASE_INFO=k=>({vision:T('Metoda odniesienia to kontrola wzrokowa: człowiek bez systemu wyłapuje tylko wyraźne wady. Policzymy jej wynik na 60 zdjęciach zestawu ćwiczeniowego.'),
 rag:T(`Wyszukiwanie dosłowne zwraca akapit z największą liczbą wspólnych słów. Policzymy jego wynik na ${RQ_DEV.length} pytaniach zestawu ćwiczeniowego.`,`Literal search returns the paragraph sharing the most words with the question. We will score it on the ${RQ_DEV.length} practice-set questions.`),
 complaints:T('Klasa większościowa przypisuje każdemu zgłoszeniu najczęstszą kategorię. Policzymy jej wynik na zestawie ćwiczeniowym (36 zgłoszeń).'),
 forecast:T('Średnia historyczna prognozuje każdy miesiąc jako średnią z wcześniejszych miesięcy. Policzymy jej błąd na miesiącach testowych wybranego produktu.'),
 maint:T('Reguła PROCES-05 podnosi alarm, gdy drgania przekraczają 4 mm/s. Policzymy jej wynik na ocenianych minutach 300–600.')})[k]||'';
// What "metoda odniesienia" means on each track, in plain words (shown where the lab first names it).
const BASE_DEF=k=>({vision:T('to, co dzieje się dziś bez systemu: pracownik ogląda puszki i wyłapuje tylko wyraźne wady (kontrola wzrokowa). AI musi to pobić.'),
 rag:T('najprostszy sposób, jaki każdy zna: szukanie akapitu z tymi samymi słowami, jak Ctrl+F w dokumentach. Asystent musi to pobić.'),
 complaints:T('najprostszy sposób: każdemu zgłoszeniu dajemy najczęstszą kategorię. Wasze reguły albo model muszą to pobić.'),
 forecast:T('najprostsza prognoza, jaką każdy zrobi w Excelu: średnia z dotychczasowej sprzedaży. Wasza metoda musi mylić się mniej.'),
 maint:T('to, co działa dziś: reguła z PROCES-05, czyli alarm, gdy drgania przekroczą 4 mm/s. Wasz system musi być od niej lepszy.')})[k]||'';
// "Run the baseline" was clicked in this session: remembered per team, so another team does not inherit the open card.
const baseKey=k=>`${S.example?'ex':S.team}|${k}`;
// Forecast and maintenance show their scores only once the baseline was run (this session) or is in the log.
// The team's own success criterion beside the result: shown, never judged (free text).
const goalLine=k=>{const t=team(),g=t.goal.trim();return t.track===k&&g?`<p class="callout tone-stone edu-block mt" id="goalLine" data-track="${k}"><b>${T('Wasze kryterium sukcesu')}:</b> „${esc(g)}” – ${T('porównajcie z wynikiem.')}</p>`:''};
// A run baseline is remembered in the team (seen['baseRun.<track>']), so an unsaved result is shown again after a reload.
const baseRan=k=>!!(X.baseOn||{})[baseKey(k)]||!S.example&&!!team().seen['baseRun.'+k];
const baseShown=k=>baseRan(k)||hasBaseline(team(),k);
const BASE_FIRST=()=>`<div class="callout tone-yellow edu-block mt" id="baseFirst"><p style="margin:0">${T('Uruchomcie metodę odniesienia, żeby zobaczyć wynik. Najpierw liczymy wynik najprostszego sposobu – potem sprawdzicie, czy wasze ustawienia są lepsze.')}</p><p class="row mt" style="margin-bottom:0"><button type="button" class="btn-ghost btn-sm" data-runbase>${ic('play')}${T('Uruchomcie metodę odniesienia')}</button></p></div>`;
const bindBaseFirst=el=>{const b=$('[data-runbase]',el);if(b){icons(el);b.onclick=()=>{const r=$('#runBase');if(r)r.click()}}};
function baseRun(k){
 if(k==='vision'){visInit();const set=VIS.val,m=visHumanEval(set),n=set.length;
  return{set:'val',html:kpis(m,{recap:plainRecap('vision',m,{set:'val',n})}),cfg:{base:true,set:'val',datasetKey:VIS.datasetKey},res:{val:{p:f0(m.p),r:f0(m.r),f1:f0(m.f1)},acc:m.acc,found:Math.round(m.tp),fp:Math.round(m.fp)},primary:{m:BASE_M('vision'),v:f0(m.r),base:f0(m.r),hi:true,test:false}}}
 if(k==='rag'){const li=langIx();let ok=0,ref=0;RQ_DEV.forEach(r=>{const q=r.q[li],b=literalBaseline(q);if(r.oos){if(!b)ref++}else if(rqGood(r,b))ok++});const n=RQ_DEV.filter(r=>!r.oos).length,nOos=RQ_DEV.length-n,m={n,ok,ref,nOos};
  return{set:'dev',html:essentials([[`${ok}/${n}`,T('Poprawne odpowiedzi'),'yellow'],[`${ref}/${nOos}`,T('Poprawne odmowy spoza zakresu'),'green']],[],{recap:plainRecap('rag',m,{set:'dev',n}),extra:`<p class="hint">${T('Ta metoda zwraca akapit z największą liczbą wspólnych słów i odmawia tylko wtedy, gdy żadne słowo pytania nie pasuje do dokumentów.')}</p>`}),cfg:{base:true,set:'dev',lang:S.lang},res:{ok,ref,n,nOos,baseOk:ok},primary:{m:BASE_M('rag'),v:ok/n,base:ok/n,hi:true,test:false}}}
 if(k==='complaints'){const rows=DATA.compl.slice(0,36),top=COMPL_TOP(),ok=rows.filter(r=>r.category===top).length,nh=rows.filter(r=>r.hazard).length,acc=ok/rows.length,m={n:rows.length,ok,hit:0,total:nh};
  return{set:'dev',html:essentials([[pct(acc),`${T('Trafność kategorii')} (${gl('dev',T('zestaw ćwiczeniowy'))})`,'blue'],[`0/${nh}`,T('Wykryte zgłoszenia o bezpieczeństwie żywności'),'red']],[],{recap:plainRecap('complaints',m,{set:'dev',n:rows.length}),extra:`<p class="hint">${T('Najczęstsza kategoria')}: ${catName(top)}. ${T('Ta metoda nie oznacza żadnego zagrożenia bezpieczeństwa żywności.')}</p>`}),cfg:{base:true,set:'dev'},res:{dev:acc,base:acc,safety:0},primary:{m:BASE_M('complaints'),v:acc,base:acc,hi:true,test:false}}}
 if(k==='forecast'){const L=lab().fc,R=fcCompute(L),e=R.mt.mean;
  return{set:'test',html:essentials([[pct(e.mape),`${T('Błąd metody odniesienia')} (${gl('mape','MAPE')}): ${BASE_NAME('forecast')}`,'ink'],[num(e.mae),T('Średni błąd w tys. sztuk (MAE)'),'blue']],[],{recap:`<p class="recap" data-track="forecast" data-set="test">${esc(T(`Prognoza na ${L.h} mies.: metoda odniesienia (średnia historyczna) ma błąd ${pct(e.mape)}. To wynik, który wasza metoda ma pobić.`,`Over a horizon of ${L.h} months the baseline (historical mean) has an error of ${pct(e.mape)}. That is the result your method has to beat.`))}</p>`,extra:`<p class="hint">${T('Produkt')}: ${S.lang==='pl'?PRODUCTS[L.p][0]:PRODUCTS[L.p][1]} · ${T('miesiące testowe (ukryte przed metodą)')}: ${L.h}.${team().log.some(l=>l.track==='forecast'&&l.base)&&!team().log.some(l=>l.track==='forecast'&&l.base&&isObj(l.cfg)&&l.cfg.p===L.p&&l.cfg.h===L.h)?' '+T('W dzienniku jest metoda odniesienia dla innego produktu lub horyzontu; tę zapiszcie jako odniesienie dla obecnych danych.'):''}</p>`}),cfg:{base:true,p:L.p,h:L.h},res:{mape:{mean:e.mape},best:'mean'},primary:{m:'MAPE',v:e.mape,base:e.mape,hi:false,test:false}}}
 if(k==='maint'){const R=mtCompute(lab().mt),b=R.bl;
  return{set:'test',html:MT_LESSON(b.ev)+kpis(b,{kind:'maint',recap:plainRecap('maint',b,{set:'test',n:300})}),cfg:{base:true,from:300,to:600},res:{f1:f0(b.f1),p:f0(b.p),r:f0(b.r),base:f0(b.f1),ev:mtEv(b),fp:Math.round(b.fp)},primary:{m:BASE_M('maint'),v:cf(b.ev),base:cf(b.ev),hi:true,test:false}}}
 return null}
// The shown baseline is already in the log when an entry with the same settings and result exists (logAdd's duplicate rule);
// forecast: one baseline per product and horizon.
const baseSaved=(k,b)=>{const sg=logSig(b.cfg,{...b.res,primary:b.primary});return team().log.some(l=>l.track===k&&l.base&&l.cfg&&l.res&&(logSig(l.cfg,l.res)===sg||k==='vision'||k==='maint'||k==='forecast'&&l.cfg.p===b.cfg.p&&l.cfg.h===b.cfg.h))};
function showBase(k,quiet){const o=$('#baseOut'),b=baseRun(k);if(!o||!b)return;const sv=baseSaved(k,b);Object.assign(o.dataset,{track:k,v:b.primary.v,set:b.set,saved:sv});o.hidden=false;
 o.innerHTML=card('flag',`${T('Metoda odniesienia','Baseline')}: ${BASE_NAME(k)}`,b.html+`<div class="row mt"><button type="button" class="btn-ghost" id="saveBase"${sv?' aria-disabled="true"':''}>${ic(sv?'check':'save')}${sv?T('Metoda odniesienia jest zapisana w dzienniku'):T('Zapiszcie metodę odniesienia w dzienniku')}</button></div>`,{tone:TONE[k],h:2});icons(o);
 ['mtLesson','mtMoreHelp'].forEach(id=>{const e=$('#'+id,o);if(e)e.id='base-'+id});
 $('#saveBase').onclick=()=>{if(sv)return;logAdd(k,b.cfg,b.res,b.primary,{base:true});if(baseSaved(k,b)){showBase(k,true);const s=$('#saveBase');if(s)s.focus()}};
 const rc=$('.recap',o);if(rc&&!quiet)announce(rc.textContent);renderPathBar()}

// ─── Baseline loop gate (spec 4.7): the test set opens only after a saved baseline and a written justification ───
const hasBaseline=(t,k)=>t.log.some(l=>l.track===k&&l.base===true);
// '' = open. Trainer mode, an already revealed test (old files) and re-reveals after a hide are never gated.
function revealGate(k){const t=team(),L=testLabOf(t,k);if(S.trainer||!L||L.revealed||L.testViews>0)return'';
 if(!hasBaseline(t,k))return'baseline';if(!methOk(t,k))return'method';return whyOk(t,k)?'':'why'}
const GATE_MSG=()=>T('Zanim odsłonicie test końcowy, uruchomcie i zapiszcie metodę odniesienia, zaznaczcie wybraną metodę i dopiszcie uzasadnienie (trafia do raportu).');
// Only what is missing: both parts get the full sentence, one part gets its own short line.
const GATE_WHY=()=>T('Dopiszcie uzasadnienie wyboru metody – trafia do raportu.');
const GATE_BASE=save=>save?T('Zanim odsłonicie test końcowy, zapiszcie metodę odniesienia w dzienniku.'):T('Zanim odsłonicie test końcowy, uruchomcie i zapiszcie metodę odniesienia.');
const methOk=(t,k)=>{const d=Object.hasOwn(t.decision,k)?t.decision[k]:null;return!!d&&Number.isInteger(d.m)&&d.m>=0};
const GATE_METH=()=>T('Zaznaczcie w tabeli metodę, którą wybraliście – trafia do raportu razem z uzasadnieniem.');
const whyOk=(t,k)=>{const d=Object.hasOwn(t.decision,k)?t.decision[k]:null;return!!d&&typeof d.why==='string'&&d.why.trim().length>=10};
// The inline gate message next to the reveal button (#gateMsg); cleared once the gate is open.
const GATE_P='<p class="hint" id="gateMsg" aria-live="polite"></p>';
const syncRevealGate=()=>{$$('[data-reveal]').forEach(b=>{const g=revealGate(b.dataset.reveal);b.dataset.blocked=g;const m=$('#gateMsg');if(!g&&m)m.textContent=''});syncTestSave()};
const GATE_SHORT=()=>T('Uzasadnienie jest za krótkie – dopiszcie co najmniej jedno zdanie.');
// Focus goes to the next thing to do: run the baseline, save the one already shown, or write the justification.
function tryReveal(k,L,after){const g=revealGate(k);
 if(g){const o=$('#baseOut'),unsaved=g==='baseline'&&o&&!o.hidden&&o.dataset.saved==='false'&&$('#saveBase'),dc=team().decision,d=Object.hasOwn(dc,k)?dc[k]:null,short=g==='why'&&!!(d&&typeof d.why==='string'&&d.why.trim());
  const msg=short?GATE_SHORT():g==='method'?GATE_METH():g==='why'?GATE_WHY():whyOk(team(),k)?GATE_BASE(!!unsaved):GATE_MSG(),gm=$('#gateMsg');toast(msg,{reason:short?'short':unsaved?'save':g});if(gm)gm.textContent=msg;
  if(g==='baseline')roomShow(unsaved||$('#runBase')||{focus(){}}).focus();else{const det=$('#labMethod details');if(det)det.open=true;const w=g==='method'?$('input[name=meth]'):$('#methWhy');if(w)roomShow(w).focus()}return}
 // The one-time test belongs to the chosen method: from the other panel, stop and offer the switch instead of revealing.
 const want=!L.revealed&&!L.testViews&&!S.trainer?chosenMode(team(),k):null,cur=L.method==='llm'?'llm':'rules';
 if(want&&want!==cur){const nm=x=>x==='llm'?T('model','the model'):T('reguły','the rules'),msg=T(`Wybraliście metodę: ${nm(want)}, a ten panel to ${nm(cur)}. Test końcowy odsłania się tylko raz, więc musi ocenić wybraną metodę.`,`You chose ${nm(want)}, but this panel is ${nm(cur)}. The final test is revealed only once, so the test must score the chosen method.`),gm=$('#gateMsg');
  if(gm)gm.textContent=msg;toast(msg,{reason:'mode',action:[T('Przełącz na wybraną metodę'),()=>{revealSwitch(k);const r=$(`[data-reveal="${k}"]`);if(r)r.focus()}]});return}
 if(!toastEl.hidden&&['baseline','save','method','why','short','mode'].includes(toastEl.dataset.reason))hideToast();toggleReveal(L);save();after();syncRevealGate();renderPathBar()}
// Banner: the best experiment against the baseline measured on the same data as that experiment, on the tuning set only –
// never a test-set value. Each entry carries its own baseline: forecast (mean MAPE for its product and horizon), RAG (literal
// search in its language), maintenance (PROCES-05 on the same window), complaints rules (majority class on dev); model runs
// on complaints compare with the majority class on the subset they were scored on. "Always OK" scores F1 0 on any set.
const BANNER_SET=k=>({vision:T('na zestawie ćwiczeniowym'),rag:T('na zestawie ćwiczeniowym'),complaints:T('na zestawie ćwiczeniowym'),forecast:T('na miesiącach testowych'),maint:T('na ocenianych minutach')})[k]||'';
// The majority-class baseline: the most common category of dev complaints 1–36, scored on any rows.
const COMPL_TOP=()=>{const c={};DATA.compl.slice(0,36).forEach(r=>c[r.category]=(c[r.category]||0)+1);return Object.keys(c).sort((a,b)=>c[b]-c[a])[0]};
const complMajOn=rows=>{if(!rows.length)return null;const top=COMPL_TOP();return rows.filter(r=>r.category===top).length/rows.length};
function pairBase(l,L0=lab()){const c=l.cfg||{},r=l.res||{},p=isObj(r.primary)?r.primary:{};
 if(l.track==='vision')return typeof p.base==='number'?p.base:null;
 if(l.track==='complaints'){if(c.mode!=='llm')return typeof r.base==='number'?r.base:null;if(typeof r.maj==='number')return r.maj;
  const run=(L0.compl.runs||[]).find(x=>isObj(x)&&x.id===r.run);return run&&Array.isArray(run.ids)?complMajOn(run.ids.map(i=>DATA.compl[i-1]).filter(Boolean)):null}
 return typeof p.base==='number'?p.base:null}
// '' when the experiment used the saved baseline's data, else a short note naming the experiment's data.
function pairNote(k,be,l){const a=be.cfg||{},c=l.cfg||{};
 if(k==='forecast'&&(c.p!==a.p||c.h!==a.h))return PRODUCTS[c.p]?T(`dla produktu ${PRODUCTS[c.p][0]}, horyzont ${c.h} mies.`,`for ${PRODUCTS[c.p][1]}, horizon ${c.h} months`):T('dla innych danych');
 if(k==='rag'&&c.lang!==a.lang)return c.lang==='en'?T('na pytaniach po angielsku'):T('na pytaniach po polsku');
 if(k==='complaints'&&c.set&&c.set!=='dev')return setLabel(c.set);
 return''}
// The like-with-like verdict behind the banner, shared with the beatBase badge so they never disagree. Pure of the team passed in.
function baseVerdict(t,k){const be=[...t.log].reverse().find(l=>l.track===k&&l.base===true&&l.res&&isObj(l.res.primary)&&typeof l.res.primary.v==='number');if(!be)return null;
 const bp=be.res.primary,hi=bp.hi!==false,b=bestRun(t,k),best=b?(Object.hasOwn(TEST_TRACKS,k)?b.dev:b.entry.res.primary.v):null,pb=best==null?null:pairBase(b.entry,t.lab);
 const f=b?faOf(b.entry,'dev'):null;
 return{be,bp,hi,b,best,pb,f,beaten:best!=null&&pb!=null&&beats(best,pb,f,hi)}}
function renderBaseBanner(k){const el=$('#baseBanner');if(!el)return;const t=team(),vd=baseVerdict(t,k),be=vd&&vd.be,
  off=()=>Object.assign(el.dataset,{track:k,beaten:'',base:'',best:'',same:''});
 if(!be){el.hidden=true;el.innerHTML='';off();return}
 const{bp,hi,b,best,pb,f}=vd,
  met=BEST_METRIC(k)||(hi?'F1':'MAPE'),set=BANNER_SET(k),test=Object.hasOwn(TEST_TRACKS,k),q=`<b>${T('Czy pobiliście metodę odniesienia?')}</b> ${T('Metoda odniesienia','Baseline')} (${BASE_NAME(k)})`;
 if(best==null||pb==null){off();el.className='callout edu-block mt tone-yellow';el.innerHTML=`<p>${q}: ${met} ${pct(bp.v)}. ${T('Zapiszcie eksperyment, żeby porównać go z metodą odniesienia.')}</p>`;el.hidden=false;return}
 const note=pairNote(k,be,b.entry),beaten=vd.beaten;
 Object.assign(el.dataset,{track:k,beaten:String(beaten),base:String(pb),best:String(best),same:String(!note)});el.className=`callout edu-block mt tone-${beaten?'green':'yellow'}`;
 const pv=test&&!note?plainScore(b.entry,'dev'):null,bt=pv?pv.btxt:`${met} ${pct(pb)}${f?faTxt(f.bfa,k):''}`,et=pv?pv.txt:`${met} ${pct(best)}${f?faTxt(f.fa,k):''}`,fin=test&&b.test!=null&&b.testEntry?partVerdict(k,b.testEntry,'test')||{beat:b.test>pb+1e-9,line:`${cap(PART_NAME('test'))}: ${met} ${pct(b.test)}.`}:null;
 el.dataset.final=fin?String(fin.beat):'';
 // After the final test the lab says what goes into the report, never "think about the test".
 if(fin){el.className=`callout edu-block mt tone-${fin.beat?'green':'yellow'}`;el.innerHTML=`<p><b>${T('Test końcowy zrobiony.')}</b> ${esc(fin.line)} ${T('Do raportu idzie ten wynik.')}</p><p class="edu-small">${T('Dla porównania')} ${set} (${esc(cmpCfg(b.entry))}): ${esc(et)}; ${T('metoda odniesienia')}: ${esc(bt)}.</p>`;el.hidden=false;return}
 el.innerHTML=`<p>${q}${note?' '+esc(note):''}: ${esc(bt)}. ${T('Wasz najlepszy eksperyment')} (${esc(cmpCfg(b.entry))}): ${esc(et)}. `+(beaten?(test?T(`Pobiliście metodę odniesienia ${set}. Gdy zaznaczycie metodę w tabeli i uzasadnicie wybór, odsłońcie test końcowy.`,`You have beaten the baseline ${set}. Once you tick the method in the table and justify the choice, reveal the final test.`):T(`Pobiliście metodę odniesienia ${set}.`,`You have beaten the baseline ${set}.`))
  :f&&f.fa>f.bfa&&best>pb-1e-9?T(`Wykrywacie co najmniej tyle samo ${set}, ale macie więcej fałszywych alarmów niż metoda odniesienia. Żeby ją pobić, nie możecie mieć ich więcej – zmieńcie ustawienia i spróbujcie ponownie.`,`You catch at least as much ${set}, but you raise more false alarms than the baseline. To beat it you may not raise more – change the settings and try again.`)
  :T(`Metoda odniesienia jest nadal co najmniej tak dobra ${set} – zmieńcie ustawienia i spróbujcie ponownie.`,`The baseline is still at least as good ${set} – change the settings and try again.`))+'</p>';el.hidden=false}
// ─── A/B comparison of two saved runs (spec 4.9) ───
// Tuning-set values only: devScore on the tracks with a test set, the scored value elsewhere. A test number is never printed.
const CMP_SET=k=>k==='vision'?'val':Object.hasOwn(TEST_TRACKS,k)?'dev':'eval';
function cmpVal(l){if(Object.hasOwn(TEST_TRACKS,l.track))return devScore(l);const p=(l.res||{}).primary;return isObj(p)&&typeof p.v==='number'?p.v:null}
const cmpTestSaved=l=>Object.hasOwn(TEST_TRACKS,l.track)&&testScore(l)!=null;
// The saved list names results in plain counts on the hidden-test tracks: the practice set and, for a final result, the final test.
const cmpPlain=l=>{if(l.base||!Object.hasOwn(TEST_TRACKS,l.track))return null;const d=plainScore(l,'dev'),t=plainScore(l,'test');return d||t?[d?`${PART_NAME('dev')}: ${d.txt}`:'',t?`${PART_NAME('test')}: ${t.txt}`:''].filter(Boolean).join(' · '):null};
const cmpCost=l=>{const a=(l.res||{}).ai;return isObj(a)&&typeof a.cost==='number'?a.cost:null};
// Same data as in pairNote: product and horizon, question language, complaint subset, image set.
function cmpSame(a,b){const x=a.cfg||{},y=b.cfg||{};switch(a.track){
 case'forecast':return x.p===y.p&&x.h===y.h;
 case'rag':return(x.lang||'')===(y.lang||'');
 case'complaints':{const s=c=>c.mode==='llm'?c.set:'dev';return s(x)===s(y)}
 case'vision':return!x.datasetKey||!y.datasetKey||x.datasetKey===y.datasetKey}
 return true}
const CMP_OTHER=k=>({forecast:T('inny produkt albo horyzont'),rag:T('pytania w innym języku'),complaints:T('różne zestawy zgłoszeń'),vision:T('różne zestawy zdjęć')})[k]||'';
const CMP_PHR=(k,hi)=>hi?(({complaints:T('wyższą trafność'),rag:T('wyższy odsetek poprawnych odpowiedzi')})[k]||T('wyższy F1')):T('niższy błąd prognozy (MAPE)');
// Configuration only (logText also prints results, including test values).
function cmpCfg(l){const c=l.cfg||{};if(l.base)return`${T('metoda odniesienia')}: ${BASE_NAME(l.track)}`;
 try{switch(l.track){
  case'vision':return c.mode==='llm'?`${T('model','model')}: prompt ${c.ver||'v1'}, ${cnt(c.shots,'example')}`:(typeof c.sens==='number'?`${T('bez modelu')}: ${T('czułość','sensitivity')} ${c.sens}`:`${T('bez modelu')}: ${T('progi')} d=${num(c.th.d)}, s=${num(c.th.s)}, c=${num(c.th.c)}`);
  case'rag':return`${c.mode==='llm'?T('z modelem'):T('bez modelu')}, k=${c.k}, ${T('akapitów/fragment')}=${c.chunk}, min=${num(c.min,2)}${c.lang?', '+String(c.lang).toUpperCase():''}`;
  case'complaints':{if(c.mode==='llm')return`${T('model językowy')}: prompt ${c.ver}, ${cnt(c.shots,'example')}`;const n=[...Object.values(c.kw||{}),c.safety||''].join(',').split(',').filter(s=>s.trim()).length;return`${T('słowa kluczowe')}: ${n} ${plural(n,['słowo','słowa','słów'],['word','words'])}`}
  case'forecast':return`${PRODUCTS[c.p]?PRODUCTS[c.p][langIx()]:c.p}, h=${c.h}, ${T('okno')}=${c.w}`;
  case'maint':return mtCfgTxt(c)}}catch(e){}
 return T('ustawienia nieznane')}
const CMP_LBL=()=>({thr:T('próg'),win:T('wygładzanie'),w:T('okno'),h:T('horyzont'),p:T('produkt'),chunk:T('akapitów/fragment'),min:'min',k:'k',lang:T('język'),shots:T('przykłady'),ver:'prompt',model:'model',mode:T('metoda'),safety:T('słowa bezpieczeństwa'),judge:T('sędzia'),set:T('zbiór')});
function cmpFlat(o,pre='',out={}){for(const[k,v]of Object.entries(o||{}))if(isObj(v))cmpFlat(v,pre+k+'.',out);else out[pre+k]=v;return out}
// "label: A → B" for every setting that differs; long values (keyword lists) are only named.
function cmpChanges(a,b){if(a.base||b.base)return a.base&&b.base?[]:[T('metoda odniesienia ↔ wasz eksperyment')];
 const fa=cmpFlat(a.cfg),fb=cmpFlat(b.cfg),L=CMP_LBL(),out=[];
 for(const key of new Set([...Object.keys(fa),...Object.keys(fb)])){if(/^(datasetKey|keys|prompt|base|from|to|set|th\.fk)$/.test(key)||JSON.stringify(fa[key])===JSON.stringify(fb[key]))continue;
  const[h,s]=key.split('.'),yn=x=>x?T('tak'):T('nie'),lbl=h==='kw'?`${T('słowa')}: ${catName(s)}`:h==='f'?`${T('cecha')} ${s}`:h==='th'?`${T('próg')} ${s}`:L[key]||key,
   fv=x=>x===undefined?(key==='mode'?T('reguły','rules'):'–'):typeof x==='boolean'?yn(x):typeof x==='number'?(key==='p'&&PRODUCTS[x]?PRODUCTS[x][langIx()]:h==='f'?yn(x):num(x,dp)):key==='model'?aiModelName(x):key==='mode'?T('model','model'):String(x),
   x0=fa[key],y0=fb[key];let dp=h==='th'?2:[x0,y0].every(x=>typeof x!=='number'||Number.isInteger(x))&&key!=='thr'?0:[x0,y0].some(x=>typeof x==='number'&&Math.abs(x)>=1)?1:2,va=fv(x0),vb=fv(y0);
   while(va===vb&&dp<4&&typeof x0==='number'&&typeof y0==='number'){dp++;va=fv(x0);vb=fv(y0)}out.push(va.length>24||vb.length>24?`${lbl} ${T('(zmienione)')}`:`${lbl}: ${va} → ${vb}`)}
 return out}
// Plain-language recap only where the entry stores the counts recapText needs (RAG on the tuning questions).
// Forecast entries store every method's error (res.mape) and the best one (res.best); primary.v is the best method's error.
const cmpFc=l=>{const r=l.res||{};return!l.base&&l.track==='forecast'&&isObj(r.mape)&&r.best&&Object.hasOwn(r.mape,r.best)?r.mape:null};
const FC_GEN=k=>({mean:T('średniej historycznej'),naive:T('ostatniej wartości'),snaive:T('sezonowej naiwnej'),ma:T('średniej ruchomej'),ts:T('trendu × sezonowości')})[k]||k;
// Signed pp.; no sign when the rounded value is 0.
const cmpPP=d=>`${Math.round(Math.abs(d)*1000)?d>0?'+':'−':''}${num(Math.abs(d)*100,1)} ${T('punktu procentowego')}`;
function cmpRecap(l){const r=l.res||{},p=r.primary||{};return l.track==='rag'&&!p.test&&typeof r.ok==='number'&&r.n?plainRecap('rag',{n:r.n,ok:r.ok,ref:r.ref},{set:'dev'}):''}
function renderCompare(a,b,track){if(!isObj(a)||!isObj(b)||a===b||a.id===b.id||a.track!==track||b.track!==track)return'';
 const va=cmpVal(a),vb=cmpVal(b),hi=[a,b].map(l=>((l.res||{}).primary||{}).hi).find(x=>x!==undefined)!==false,same=cmpSame(a,b),met=BEST_METRIC(track)||(hi?'F1':'MAPE'),set=BANNER_SET(track),
  ca=cmpCost(a),cb=cmpCost(b),cost=ca!=null&&cb!=null,has=va!=null&&vb!=null,d=has&&same?vb-va:null,pp=d==null?'':`${num(Math.abs(d)*100,1)} ${T('punktu procentowego')}`,ch=cmpChanges(a,b),fa=cmpFc(a),fb=cmpFc(b),fk=fa&&fb&&same?Object.keys(fa).filter(k=>Object.hasOwn(fb,k)&&typeof fa[k]==='number'&&typeof fb[k]==='number'):[],fch=fk.filter(k=>Math.abs(fb[k]-fa[k])>=5e-4),
  costMove=cost?(cb>ca?T(`koszt przebiegu rośnie z ${usd(ca)} do ${usd(cb)}`,`the cost per run rises from ${usd(ca)} to ${usd(cb)}`):cb<ca?T(`koszt przebiegu spada z ${usd(ca)} do ${usd(cb)}`,`the cost per run falls from ${usd(ca)} to ${usd(cb)}`):T(`koszt przebiegu jest taki sam (${usd(ca)})`,`the cost per run is the same (${usd(ca)})`)):'',
  col=(l,n,v,c)=>`<div class="cmp-col" data-v="${v==null?'':+v.toFixed(4)}"><h4>${T('Wersja')} ${n} (${esc(cmpCfg(l))})</h4><p class="hint" style="margin:0">${esc(fmtTs(l.ts))}${l.base?` <span class="edu-chip tone-ink">${T('metoda odniesienia')}</span>`:''}${cmpTestSaved(l)?` <span class="edu-chip tone-yellow">${T('zapisano przy odsłoniętym teście')}</span>`:''}</p>${cmpFc(l)&&v!=null?`<p class="cmp-v">${T('Błąd najlepszej metody')} (${fcName(l.res.best)}): <b>${pct(v)}</b></p><p class="hint" style="margin:6px 0 0">MAPE ${set}, ${T('każda metoda')}:</p><ul class="cmp-m">${Object.keys(l.res.mape).filter(k=>typeof l.res.mape[k]==='number').map(k=>`<li>${fcName(k)||esc(k)}: ${pct(l.res.mape[k])}</li>`).join('')}</ul>`:`${l.track==='maint'&&mtPlain((l.res||{}).ev,(l.res||{}).fp)?`<p class="cmp-v cmp-mt"><b>${esc(mtPlain(l.res.ev,l.res.fp))}</b></p><p class="hint" style="margin:0">${T('Więcej miar')}: ${esc(met)} ${set} ${pct(v)}</p>`:`<p class="cmp-v">${v==null?T('brak wyniku na zestawie ćwiczeniowym'):`${esc(met)} ${set}: <b>${pct(v)}</b>`}</p>${plainScore(l,'dev')?`<p class="hint" style="margin:0">${esc(plainScore(l,'dev').txt)}</p>`:''}`}`}${cost?`<p class="hint" style="margin:0">${T('Koszt przebiegu')}: ${usd(c)}</p>`:''}${cmpRecap(l)}${l.note?`<p class="hint">${T('Wniosek zespołu')}: ${esc(l.note)}</p>`:''}</div>`;
 const mm=[a,b].map(l=>(l.cfg||{}).mode==='llm'),mixed=['rag','complaints','vision'].includes(track)&&!a.base&&!b.base&&mm[0]!==mm[1];
 let s;
 if(!same)s=T(`Te dwa przebiegi zmierzono na różnych danych (${CMP_OTHER(track)}), więc ich wyniki nie mówią, która wersja jest lepsza.`,`These two runs were measured on different data (${CMP_OTHER(track)}), so their results do not tell which version is better.`);
 else if(!has)s=T('Co najmniej jedna wersja nie ma wyniku na zestawie ćwiczeniowym, więc różnicy nie liczymy.');
 else if(Math.abs(d)<5e-4&&fch.length)s=T(`Najlepsza metoda ma w obu wersjach ten sam błąd; ${fch.length>1?'zmieniły się błędy':'zmienił się błąd'} ${fch.map(k=>`${FC_GEN(k)}: z ${pct(fa[k])} do ${pct(fb[k])}`).join(', ')}.`,`The best method has the same error in both versions; ${fch.map(k=>`the error of ${FC_GEN(k)} changed: from ${pct(fa[k])} to ${pct(fb[k])}`).join(', ')}.`);
 else if(Math.abs(d)<5e-4)s=T(`Obie wersje mają ten sam wynik ${set}.`,`Both versions have the same result ${set}.`)+(cost?' '+costMove[0].toUpperCase()+costMove.slice(1)+'.':'');
 else{const W=(hi?d>0:d<0)?'B':'A',trade=W==='B'?cb>ca:cb<ca;s=T(`Wersja ${W} ma ${CMP_PHR(track,hi)} ${set} o ${pp}`,`Version ${W} has ${CMP_PHR(track,hi)} ${set} by ${pp}`)+(cost?`, ${trade?T('ale'):T('a')} ${costMove}.`:'')}
 return`<div id="cmp" class="cmp mt" data-a="${esc(a.id)}" data-b="${esc(b.id)}" data-set="${CMP_SET(track)}" data-same="${same}"${d!=null?` data-diff="${+d.toFixed(4)}"`:''}><div class="grid2">${col(a,'A',va,ca)}${col(b,'B',vb,cb)}</div>`
  +(d!=null?`<p class="mt"><b>${T('Różnica (B wobec A)')}:</b> ${cmpPP(d)}</p>`:'')+(fk.length?`<p><b>${T('Różnice według metod (B wobec A)')}:</b> ${fk.map(k=>`${fcName(k)||esc(k)}: ${cmpPP(fb[k]-fa[k])}`).join('; ')}</p>`:'')
  +(mixed?`<p class="callout tone-yellow edu-block" data-mixed="true">${T(`Uwaga: wersja ${mm[0]?'B':'A'} działała bez modelu, a wersja ${mm[0]?'A':'B'} z modelem językowym. To dwie różne metody, nie jedna zmiana ustawienia.`,`Note: version ${mm[0]?'B':'A'} ran without the model and version ${mm[0]?'A':'B'} with the language model. These are two different methods, not one changed setting.`)}</p>`:'')
  +`<p><b>${T('Co się zmieniło')}:</b> ${esc(ch.length?ch.join('; '):T('te same ustawienia'))}</p><p class="cmp-s"><b>${esc(s)}</b></p></div>`}
const cmpSel=k=>{const m=X.cmpSel||(X.cmpSel={});return Object.hasOwn(m,k)?m[k]:(m[k]=[])};
// The track's saved entries, newest first; exactly two ticked enable #cmpGo, a third tick drops the oldest choice.
function renderCmpList(k){const el=$('#cmpList');if(!el)return;const es=team().log.filter(l=>l.track===k&&isObj(l.cfg)&&isObj(l.res)),ids=new Set(es.map(l=>l.id)),sel=cmpSel(k);
 for(let i=sel.length-1;i>=0;i--)if(!ids.has(sel[i]))sel.splice(i,1);
 el.dataset.n=es.length;
 el.innerHTML=(es.length?`<ul class="cmp-list">${[...es].reverse().map(l=>{const v=cmpVal(l);return`<li><label><input type="checkbox" data-cmp="${esc(l.id)}" data-base="${!!l.base}"${sel.includes(l.id)?' checked':''}><span>${l.base?`<span class="edu-chip tone-ink">${T('Metoda odniesienia','Baseline')}</span> ${esc(BASE_NAME(k))}`:esc(cmpCfg(l))} · ${cmpPlain(l)?`<b>${esc(cmpPlain(l))}</b>`:k==='maint'&&mtPlain((l.res||{}).ev,(l.res||{}).fp)?`<b>${esc(mtPlain(l.res.ev,l.res.fp))}</b> (F1 ${pct(v)})`:v==null?T('brak wyniku na zestawie ćwiczeniowym'):`<b>${pct(v)}</b>`} <span class="hint">${esc(fmtTs(l.ts))}</span></span></label></li>`}).join('')}</ul>`:'')
  +(es.length<2?`<p class="hint">${T('Zapiszcie co najmniej dwa wyniki w dzienniku, żeby je porównać.')}</p>`:'')
  +`<p class="row mt"><button type="button" class="btn-ghost" id="cmpGo"${sel.length===2?'':' disabled'}>${ic('columns-2')}${T('Porównaj')}</button></p><div id="cmpOut"></div>`;
 const btn=$('#cmpGo',el),out=$('#cmpOut',el),boxes=$$('input[data-cmp]',el);
 boxes.forEach(x=>x.onchange=()=>{const s=cmpSel(k),i=s.indexOf(x.dataset.cmp);if(x.checked){if(i<0)s.push(x.dataset.cmp);while(s.length>2){const o=s.shift(),ob=boxes.find(y=>y.dataset.cmp===o);if(ob)ob.checked=false}}else if(i>=0)s.splice(i,1);btn.disabled=s.length!==2;out.innerHTML=''});
 btn.onclick=()=>{const s=cmpSel(k),log=team().log;if(s.length!==2)return;const[a,b]=s.map(id=>log.find(l=>l.id===id)).sort((x,y)=>log.indexOf(x)-log.indexOf(y));out.innerHTML=renderCompare(a,b,k);const c=$('#cmp',out);if(c)c.scrollIntoView({block:'nearest'})};
 icons(el)}
