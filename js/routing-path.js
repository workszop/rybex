// js/routing-path.js - Routing, the path bar, the worked example, the render shell and badges.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── Routing ───
const hashFor=v=>'#/'+v+(v==='demos'?'/'+S.sub.demos:v==='lab'?'/'+S.sub.lab:v==='rybex'?'/'+S.sub.rybex:'');
// The company site (#/rybex/<page>) is a view outside NAV: keys 1–7 and the workshop menu stay as they are.
// The trainer view (#/trainer) is outside NAV too and opens only with ?trainer=1, never from the example.
function parseHash(){const[,v,sub]=location.hash.split('/');if(v==='trainer')return S.trainer&&!S.example?{v}:null;if(!NAV.some(n=>n[0]===v)&&v!=='rybex')return null;return{v,sub}}
// Applies a parsed route's sub view; an unknown company page falls back to the site's home.
function routeSub(r){if(r.v==='demos'&&DEMO_KEYS.includes(r.sub))S.sub.demos=r.sub;if(r.v==='lab'&&LAB_KEYS.includes(r.sub))S.sub.lab=r.sub;if(r.v==='rybex')S.sub.rybex=RYBEX_PAGES.includes(r.sub)?r.sub:RYBEX_PAGES.includes(S.sub.rybex)&&!r.sub?S.sub.rybex:'home'}
function normHash(){const h=hashFor(S.view);if(location.hash!==h)try{history.replaceState(null,'',h)}catch(e){}}
function onHashChange(){const r=parseHash();if(!r){normHash();return}const cur=r.v==='demos'||r.v==='lab'||r.v==='rybex'?S.sub[r.v]:undefined;if(r.v===S.view&&(r.sub===cur||!r.sub))return;
 if(AIS.run){const h=location.hash;normHash();guardRun(()=>{try{history.pushState(null,'',h)}catch(e){}applyRoute()});return}applyRoute()}
// Reading the news or opening the intranet counts when the page is opened by navigation, never on a re-render (team or language switch).
function siteVisit(){if(S.view!=='rybex')return;const s=team().site,k={news:'newsRead',intranet:'intranetOpened'}[S.sub.rybex];if(k&&!s[k]){s[k]=true;save()}}
// Where the company site was entered from (transient, never saved): "Back to the workshop" returns there. Null after a
// deep link or reload, and when the path bar led to the site: then Back goes to the path's next step.
let siteFrom=null,pathNav=false;
function applyRoute(){const r=parseHash();if(!r){normHash();return}const changed=r.v!==S.view;if(changed&&r.v==='rybex')siteFrom=pathNav||S.example?null:{v:S.view,sub:S.sub[S.view]};const f0=document.activeElement,sub0=JSON.stringify(S.sub[r.v]);S.view=r.v;routeSub(r);siteVisit();normHash();save();render();if(changed){window.scrollTo(0,0);mainEl.focus({preventScroll:true})}
 // Same view: move focus only when the sub view changed or the focused element was redrawn away, never when it simply sat on BODY.
 else if((!document.activeElement||document.activeElement===document.body)&&(JSON.stringify(S.sub[r.v])!==sub0||(f0&&f0!==document.body&&!f0.isConnected)))mainEl.focus({preventScroll:true})}
function go(v,sub){if(AIS.run)return guardRun(()=>go(v,sub));clearInterval(X.ragTimer);aiAbort();if(sub)S.sub[v]=sub;const h=hashFor(v);if(location.hash!==h){try{history.pushState(null,'',h)}catch(e){location.hash=h;return}}applyRoute()}
// ─── Path ───
const TEST_TRACKS={vision:'vision',rag:'rag',complaints:'compl'};
// Each track's own file in the data view; for RAG any process document counts as the team's data.
const TRACK_FILE={vision:'can_images/ (210)',rag:'PROCES-01.md',complaints:'complaints.csv',forecast:'sales_history.csv',maint:'sensors.csv'};
const trackFileOk=(k,f)=>!!k&&(k==='rag'?/^PROCES-0\d\.md$/.test(f):Object.hasOwn(TRACK_FILE,k)&&TRACK_FILE[k]===f);
function hasWork(t){return!!(t.name.trim()||t.log.length||Object.values(t.checks).some(Boolean))}
function demoDone(t,key){return quizDone(t,key)}
function reqDemos(track){return['split','metr',...(AI_TRACKS.includes(track)?['tok']:[]),...(track==='rag'?['rag']:[])]}
function PATH_STEPS(t=team()){const d=reqDemos(t.track).find(k=>!demoDone(t,k))||'split',lb=['lab',t.track||S.sub.lab],nw=newsDue(t);return[
 {id:'join',label:T('Przydział i strona firmy'),min:10,go:nw?['rybex','news']:['home'],hint:nw?T('przeczytajcie na stronie firmy komunikat o zwrocie partii'):T('podajcie nazwę zespołu i otwórzcie stronę firmową')},
 {id:'cycle',label:T('Cykl projektu'),min:10,go:['demos','life'],hint:T('przejdźcie etapy cyklu projektu AI')},
 {id:'task',label:T('Wybór zadania','Choosing the task'),min:10,go:['brief'],hint:T('wybierzcie zadanie i wpiszcie kryterium sukcesu')},
 {id:'data',label:T('Dane zadania'),min:15,go:['data'],hint:T('otwórzcie dane wybranego zadania')},
 {id:'demos',label:T('Demonstracje'),min:20,go:['demos',d],subs:reqDemos(t.track),hint:T('obejrzyjcie demonstracje wymagane dla waszego zadania')+(rem=>rem.length?': '+rem.join(', '):'')(reqDemos(t.track).filter(k=>!demoDone(t,k)).map(k=>DEMO_SUBS().find(x=>x[0]===k)[1]))},
 {id:'base',label:T('Laboratorium, runda 1'),min:25,go:lb,hint:T('uruchomcie metodę odniesienia i zapiszcie wynik')},
 {id:'iterate',label:T('Rundy 2–3 i test'),min:30,go:lb,hint:({reveal:t.track==='rag'?T('odsłońcie test końcowy jeden raz i zapiszcie wynik'):T('odsłońcie test końcowy jeden raz i zapiszcie wynik'),save:T('zapiszcie wynik testu w dzienniku – trafi do raportu jako ocena końcowa'),run:T('uruchomcie model na teście końcowym, a potem zapiszcie wynik'),again:T('nie zapisaliście wyniku testu: odsłońcie test ponownie i zapiszcie wynik (ponowne odsłonięcie liczy się jako kolejne oglądanie testu)'),meth:T('zaznaczcie w tabeli metodę, którą wybieracie, i napiszcie jedno zdanie, dlaczego – trafi do raportu')})[step7(t)]||T(`zapiszcie co najmniej ${MIN_EXPERIMENTS} ${plural(MIN_EXPERIMENTS,['eksperyment','eksperymenty','eksperymentów'],[])}, zmieniając jedną rzecz naraz (${ONE_THING(t.track)[0]})`,`save at least ${MIN_EXPERIMENTS} experiments, changing one thing at a time (${ONE_THING(t.track)[1]})`)},
 // Risk cards first (the risk tab), then the four go-live decisions on the architecture view.
 {id:'risk',label:T('Ryzyka i wdrożenie'),min:20,pages:[['demos','risk'],['arch']],go:riskCount(t)>=4?['arch']:['demos','risk'],hint:T('odpowiedzcie na co najmniej cztery karty ryzyk i podejmijcie cztery decyzje wdrożeniowe')},
 {id:'report',label:T('Raport i wystąpienie'),min:15,go:['deliver'],hint:T('uzupełnijcie listę i wyeksportujcie raport')}]}
// One place changes the team's task: go-live decision 3 (what is monitored) has per-track answers, so it is cleared.
function setTrack(t,k){if(t.track!==k)delete t.arch.decisions.monitor;t.track=k}
const testLabOf=(t,k)=>Object.hasOwn(TEST_TRACKS,k)?t.lab[TEST_TRACKS[k]]:null;
// Step 7 on a track with a hidden test set needs the final result in the log: an entry saved with the test visible.
// Teams from before that rule whose log holds an entry saved after a test view (normTeam leaves seen.testSave off for them)
// also count that entry, so their finished step stays done.
const finalSaved=(t,k)=>t.log.some(l=>l.track===k&&(cmpTestSaved(l)||!t.seen.testSave&&l.testViews>0));
// Where step 7 stands: 'exp' fewer than MIN_EXPERIMENTS, 'meth' (tracks without a hidden test) the method choice or its
// justification is missing – on the test tracks the reveal gate asks for them – 'reveal' test never seen, 'save' test visible and not saved,
// 'run' test visible but the selected model run is a tuning run (vision and complaints model views),
// 'again' test seen, hidden again and not saved, 'done'.
function step7(t){const k=t.track,tl=k?testLabOf(t,k):null;if(!k||expOf(t,k)<MIN_EXPERIMENTS)return'exp';if(!tl)return methOk(t,k)&&whyOk(t,k)?'done':'meth';if(finalSaved(t,k))return'done';return tl.revealed?(pendingTest(k,t)?'save':'run'):tl.testViews<1?'reveal':'again'}
// Step 1 needs the company news once the team is past onboarding. Only real prior work (a log entry or a ticked
// checklist item) exempts a team from it: a typed name alone does not.
const realWork=t=>t.log.length>0||Object.values(t.checks).some(Boolean);
const pastOnboarding=t=>!!t.onboardedAt||hasWork(t);
const newsDue=t=>pastOnboarding(t)&&!t.site.newsRead&&!realWork(t);
function pathState(t){const k=t.track,ne=k?expOf(t,k):0,tl=k?testLabOf(t,k):null,
 done={join:pastOnboarding(t)&&(t.site.newsRead||realWork(t)),cycle:demoDone(t,'life'),task:!!(k&&t.goal.trim()),data:!!t.seen.data,demos:reqDemos(k).every(x=>demoDone(t,x)),
  base:!!k&&(hasBaseline(t,k)||!!(tl&&(tl.revealed||tl.testViews>0))),iterate:ne>=MIN_EXPERIMENTS&&(tl?finalSaved(t,k):methOk(t,k)&&whyOk(t,k)),risk:riskDone(t),report:!!t.seen.report};
 const all=PATH_STEPS(t),steps=all.map(s=>({id:s.id,done:!!done[s.id]})),isDone=s=>steps.find(x=>x.id===s.id).done,
  nx=all.find(s=>!done[s.id]),here=all.filter(onStep),last=[...all].reverse().find(isDone);
 const cur=(here.find(s=>!isDone(s))||here[here.length-1]||last||all[0]).id;
 return{steps,cur,next:nx?{id:nx.id,label:nx.label,go:nx.go}:null,doneCount:steps.filter(s=>s.done).length}}
// Risk step: at least four risk cards answered and all four go-live decisions taken.
function riskDone(t){return riskCount(t)>=4&&goLiveCount(t)===GO_LIVE_DECISIONS(t).length}
const riskCount=t=>RISK_SCENARIOS().filter(s=>riskChoice(t,s)>=0).length;
// The step's target matches the current view and, where the step has one, the sub view.
function onStep(s){if(s.pages)return s.pages.some(g=>g[0]===S.view&&(g.length<2||g[1]===S.sub[S.view]));if(s.go[0]!==S.view)return false;const sub=S.sub[S.view];return s.subs?s.subs.includes(sub):s.go.length<2||s.go[1]===sub}
// The step's concrete target (view and sub view) is the current page; subs only decide the current step.
function atTarget(s){return s.go[0]===S.view&&(s.go.length<2||s.go[1]===S.sub[S.view])}
// Next on the step's own page: bring its working element into view instead of a no-op navigation.
// On a demo page the working element is the first quiz question not yet answered correctly.
const quizFocus=()=>$('#quiz .qz-q:not([data-state=right]) [data-o]');
// Next on the data page opens the team's own file first, then focuses its entry in the folder tree.
function pathFocus(id){const t=team();if(id==='data'&&t.track&&!trackFileOk(t.track,FSEL)){FSEL=TRACK_FILE[t.track];vData();icons(mainEl)}
 const el=({data:()=>$('.tree button[aria-current]'),join:()=>{if(S.view==='rybex'){siteVisit();renderPathBar();return $('.rybex-frame .rf-page h2')}return $('#onboardName')||$('#siteOpen')},task:()=>t.track?$('#goal'):$('#main [data-t]'),base:()=>baseUnsaved()||$('#runBase'),iterate:()=>({reveal:()=>revealTarget(t.track),save:()=>$('#sv'),run:()=>$(t.track==='vision'?'#visRun':'#cRun'),again:()=>{revealSwitch(t.track);return $(`[data-reveal="${t.track}"]`)},meth:()=>{const det=$('#labMethod details');if(det)det.open=true;return methOk(t,t.track)?$('#methWhy'):$('input[name=meth]')}})[step7(t)]?.()||$('#expNote'),report:()=>$('#expH'),cycle:quizFocus,demos:quizFocus,risk:()=>S.view==='arch'?$('#goLive [data-d]:not([data-choice]) [data-o]')||$('#goLive [data-o]'):$('#riskDemo [data-r]:not([data-choice]) [data-o]')||$('#riskDemo [data-o]')})[id]?.()||mainEl;
 const sm=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
 // An action button the bar names (run or save the baseline, save the test result, export the report) is pressed, not
 // only focused: the bar's label already says what it does, so a second, identical button click is not needed. Fields,
 // the one-time test reveal and paid model runs keep the focus-only behaviour.
 roomShow(el);if(PATH_ACTIONS.some(s=>el.matches(s))&&el.getAttribute('aria-disabled')!=='true'&&!el.disabled){el.scrollIntoView({block:'center',behavior:sm});el.click();return}
 if(!el.matches('input,button,textarea,select,[tabindex]'))el.setAttribute('tabindex','-1');el.scrollIntoView({block:'center',behavior:sm});el.focus({preventScroll:true})}
const PATH_ACTIONS=['#runBase','#saveBase','#expH','#sv'];
// The baseline card is shown but its result is not in the log yet.
const baseUnsaved=()=>{const o=$('#baseOut');return o&&!o.hidden&&o.dataset.saved==='false'?$('#saveBase'):null};
// The reveal button, or what the closed gate needs first (save or run the baseline, write the justification).
// The lab panel (rules or model) that belongs to the method the team ticked; null when the choice has no runnable panel (e.g. CNN).
function chosenMode(t,k){const d=Object.hasOwn(t.decision,k)?t.decision[k]:null,m=d&&Number.isInteger(d.m)?d.m:-1;return({vision:{0:'rules',2:'llm'},complaints:{0:'rules',1:'llm'}})[k]?.[m]||null}
// Next on the reveal step opens the panel of the chosen method first, so the one-time test scores the method the report names.
function revealSwitch(k){const want=chosenMode(team(),k),L=k==='vision'?lab().vision:k==='complaints'?lab().compl:null;if(!want||!L||(L.method==='llm'?'llm':'rules')===want)return;
 const b=$(`#${k==='vision'?'visMethod':'cMethod'} button[data-m="${want}"]`);if(!b)return;b.click();toast(T(`Przełączyliśmy na wybraną metodę (${want==='llm'?'model':'reguły'}): test oceni to, co opiszecie w raporcie.`,`Switched to your chosen method (${want==='llm'?'model':'rules'}): the test scores what your report describes.`))}
function revealTarget(k){const g=revealGate(k);if(!g){revealSwitch(k);return $(`[data-reveal="${k}"]`)}if(g==='baseline')return baseUnsaved()||$('#runBase');const det=$('#labMethod details');if(det)det.open=true;return g==='method'?$('input[name=meth]'):$('#methWhy')}
function setHdrH(){const hd=$('.edu-header'),pb=$('#pathBar'),cb=$('#caseBar'),hh=e=>e?e.getBoundingClientRect().height:0,h=hd&&getComputedStyle(hd).position==='sticky'?hh(hd):0,p=h+hh(pb),r=document.documentElement.style;r.setProperty('--hdr-top',h+'px');r.setProperty('--cb-top',p+'px');r.setProperty('--hdr-h',p+(cb&&!cb.hidden?hh(cb):0)+'px')}
// Case bar (spec 4.2): the incident stays in view on the working screens once the team has a task.
const CASE_VIEWS=['data','lab','arch','deliver'];
const caseLine=()=>{const s=STORY(),k=team().track,tail=({rag:T('pracownicy szukają w procedurach, co robić z taką partią'),complaints:T('do skrzynki reklamacji wpływa więcej zgłoszeń niż zwykle'),forecast:T('zabrakło towaru zastępczego: ile produkować w kolejnych miesiącach'),maint:T('zamykarka i retorta stają: awarie trzeba wykrywać szybciej')})[k]||T('kontrola jakości na linii');
 return T(`Sprawa: partia ${s.lot}, ${PRODUCTS[s.product][0]} – zwrot z sieci, ${tail}.`,`Case: lot ${s.lot}, ${PRODUCTS[s.product][1]} – returned by a retail chain, ${tail}.`)};
function renderCaseBar(){const el=$('#caseBar'),t=team(),on=!!t.track&&CASE_VIEWS.includes(S.view);el.hidden=!on;
 if(!on){el.innerHTML='';delete el.dataset.lot;delete el.dataset.track;return}
 Object.assign(el.dataset,{lot:STORY().lot,track:t.track});el.innerHTML=`<p class="cb-in">${ic('folder-open')}<span class="cb-txt">${caseLine()} <span class="cb-task">${S.example?T('Zadanie przykładu'):T('Wasze zadanie')}: ${trMeta()[t.track].title}</span></span></p>`}
// Next's text when the next step's target is the current page: the step's action, not a link elsewhere.
const NEXT_HERE=id=>{const t=team();return({join:()=>S.view==='rybex'?T('Przeczytajcie komunikat o zwrocie partii'):$('#onboardName')?T('Podajcie nazwę zespołu'):T('Otwórzcie stronę firmową'),cycle:()=>T('Odpowiedzcie na pytania'),demos:()=>T('Odpowiedzcie na pytania'),
 task:()=>t.track?T('Wpiszcie kryterium sukcesu'):T('Wybierzcie zadanie'),data:()=>T('Otwórzcie dane swojego zadania'),base:()=>baseUnsaved()?T('Zapiszcie metodę odniesienia'):T('Uruchomcie metodę odniesienia'),
 iterate:()=>({reveal:(g=>g==='method'||g==='why'?T('Wybierzcie metodę i uzasadnijcie wybór'):g==='baseline'?(baseUnsaved()?T('Zapiszcie metodę odniesienia'):T('Uruchomcie metodę odniesienia')):t.track==='rag'?T('Odsłońcie test końcowy'):T('Odsłońcie test końcowy'))(revealGate(t.track)),save:T('Zapiszcie wynik testu'),run:T('Uruchomcie model na teście końcowym'),again:T('Odsłońcie test ponownie i zapiszcie wynik'),meth:T('Wybierzcie metodę i uzasadnijcie wybór')})[step7(t)]||T('Zapiszcie eksperyment'),risk:()=>S.view==='arch'?T('Podejmijcie cztery decyzje wdrożeniowe'):T('Odpowiedzcie na pytania o ryzyka'),report:()=>T('Wyeksportujcie raport')})[id]?.()||T('Dalej')};
// The path bar's Next label for a step (also the start page's main button): the action here, else where it leads.
const nextLabel=(n,st=pathState(team()))=>{const s=PATH_STEPS().find(x=>x.id===n.id);return atTarget(s)?NEXT_HERE(s.id):`${T('Dalej')}: ${s.id===st.cur?NEXT_WHERE(s):s.label}`};
const NEXT_WHERE=s=>({join:s.go[0]==='rybex'?T('strona firmy Rybex'):'',risk:s.go[0]==='arch'?T('decyzje wdrożeniowe'):'',demos:T('następna demonstracja')})[s.id]||s.label;
// A redraw keeps keyboard focus on the bar's control it was on (a run can end while the participant sits on Next);
// not while Next itself navigates (pathNav), where the target page decides focus.
function renderPathBar(ps){if(X.room)X.room.handle.refresh();if(S.example)return renderExampleBar();const el=$('#pathBar'),ae=document.activeElement,fid=ae&&ae!==el&&el.contains(ae)&&ae.id||'',t=team(),st=ps||pathState(t),all=PATH_STEPS(),c=all.find(s=>s.id===st.cur),ci=all.indexOf(c)+1,nx=st.next&&all.find(s=>s.id===st.next.id),ni=all.indexOf(nx)+1,cDone=!!st.steps.find(s=>s.id===st.cur)?.done,act=atTarget(c)&&!cDone?c:nx,here=!!act&&atTarget(act);
 Object.assign(el.dataset,{total:all.length,step:st.cur,done:st.doneCount,next:nx?nx.id:''});el.setAttribute('aria-label',T('Ścieżka warsztatów'));
 if(!setHTML(el,`<div class="pb-in"><ol class="pb-dots" aria-hidden="true">${st.steps.map(s=>`<li class="${s.done?'done':''} ${s.id===st.cur?'cur':''}"></li>`).join('')}</ol><p class="pb-txt"><span class="pb-here">${T('Jesteś tutaj')}: <b>${T(`krok ${ci} z ${all.length}`,`step ${ci} of ${all.length}`)}, ${c.label}</b> <span class="pb-min">· ${T('ok.')} ${c.min} min</span></span>${nx?`<span class="pb-hint"> ${ni<ci?T(`Brakuje wcześniejszego kroku ${ni} z ${all.length}`,`Earlier step ${ni} of ${all.length} still open`):T('Następny krok')}: ${nx.hint}.</span>`:''}</p>${nx?`<button type="button" class="${S.view==='deliver'?'btn-ghost':'btn'} btn-sm" id="pathNext" data-go="${act.go.join('/')}" data-mode="${here?'here':'go'}"><span class="pb-lbl">${nextLabel(act,st)}</span>${ic(here?'arrow-down':'arrow-right')}</button>`:`<button type="button" class="btn-ghost btn-sm" id="pathNext" data-go="" data-mode="done">${ic('circle-check')}<span class="pb-lbl">${T('Ścieżka ukończona')}</span></button>`}</div>`))return;
 $('#pathNext').onclick=()=>{const st=pathState(team()),c=PATH_STEPS().find(x=>x.id===st.cur),cDone=!!st.steps.find(s=>s.id===st.cur)?.done,s=atTarget(c)&&!cDone?c:st.next;if(!s)return;const p=PATH_STEPS().find(x=>x.id===s.id);if(atTarget(p)&&!AIS.run)pathFocus(p.id);else{if(p.id==='data'&&team().track&&!AIS.run)FSEL=TRACK_FILE[team().track];pathNav=true;try{go(...p.go)}finally{pathNav=false}
  // Same view, new sub view (one demo to the next): the button was redrawn, so focus would fall to BODY.
  if(!document.activeElement||document.activeElement===document.body)mainEl.focus({preventScroll:true})}};icons(el);setHdrH();
 if(fid&&!pathNav&&(!document.activeElement||document.activeElement===document.body)){const f=document.getElementById(fid);if(f)f.focus({preventScroll:true})}}

// ─── Worked example (spec 4.13): one finished, deliberately incomplete forecast project, read-only ───
// The log entries copy the shapes and values the forecast lab saves (Szprot w oleju; baseline at 6 months, then w=3, w=6 and a 9-month horizon).
// Gaps on purpose: 2 of 4 go-live decisions, 3 of 5 risks, about half the checklist, notes for sections 1-3 only, other labs untouched.
function EXAMPLE_TEAM(){const lab=defaultLab(),qa=k=>{const q=QUIZZES()[k];return{answers:Object.fromEntries(q.map(x=>[x.id,x.answer])),first:Object.fromEntries(q.map(x=>[x.id,true])),doneAt:'2026-11-05T09:40:00.000Z'}},
  m6={mean:0.08210087543729959,naive:0.14337778761384967,snaive:0.06930270455305779,ts:0.04232415277446049},
  ex=(id,ts,h,w,mape,note)=>({id,ts,track:'forecast',cfg:{p:0,h,w},res:{mape,best:'ts',primary:{m:'MAPE',v:mape.ts,base:mape.mean,hi:false}},note,testViews:0});
 return{name:T('Przykład: prognoza Szprotu'),track:'forecast',goal:T('Prognoza sprzedaży Szprotu w oleju na 6 miesięcy z błędem (MAPE) niższym niż średnia historyczna.'),
  decision:{forecast:{m:1,why:T('Wybraliśmy prognozowanie popytu, bo zwrot partii zbiegł się z sezonem. Metoda odniesienia (średnia) ma wyższy błąd niż trend × sezonowość na horyzoncie 6 mies. Nie modelujemy promocji – to ograniczenie.')}},
  checks:Object.fromEntries(['1.0','1.1','1.2','2.0','2.1','2.3','3.0','3.2','3.5','4.0','4.2','5.0','5.3'].map(k=>[k,true])),
  notes:{1:T('Problem: planowanie produkcji Szprotu w sezonie, dla działu planowania. Sukces: błąd prognozy niższy niż średnia historyczna na 6 miesięcy.'),
   2:T('Dane: sales_history.csv, 36 miesięcy sprzedaży. Ostatnie miesiące to test (podział chronologiczny). Brak danych o promocjach i cenach.'),
   3:T('Metoda: trend × sezonowość, bo sprzedaż ma wyraźny sezon. Infrastruktura hybrydowa: dane sprzedaży z ERP zostają w zakładzie.')},
  arch:{sel:Object.fromEntries(PRESET.forecast.map(k=>[k,true])),infra:'hybrid',decisions:{runWhere:'hybrid',reviewEvery:'quarterly'}},
  log:[{id:'ex0',ts:'2026-11-05T10:05:00.000Z',track:'forecast',cfg:{base:true,p:0,h:6},res:{mape:{mean:m6.mean},best:'mean',primary:{m:'MAPE',v:m6.mean,base:m6.mean,hi:false,test:false}},note:'',testViews:0,base:true},
   ex('ex1','2026-11-05T10:12:00.000Z',6,3,{...m6,ma:0.06303093921757821,ts:m6.ts},T('Trend × sezonowość: 4,2% wobec 8,2% dla średniej na 6 mies.')),
   ex('ex2','2026-11-05T10:20:00.000Z',6,6,{...m6,ma:0.07589584006345117,ts:m6.ts},T('Okno średniej ruchomej 6 zamiast 3: średnia ruchoma gorsza (7,6% wobec 6,3%), najlepsza metoda bez zmian.')),
   ex('ex3','2026-11-05T10:31:00.000Z',9,3,{mean:0.11387354526030083,naive:0.12930961233972194,snaive:0.08567695391357057,ma:0.11277289925958822,ts:0.03999604622914333},T('Horyzont 9 mies.: średnia myli się bardziej (11,4%), trend × sezonowość nadal 4,0%.'))],
  lab,onboardedAt:'2026-11-05T09:30:00.000Z',seen:{},site:{newsRead:true,contactSent:false,intranetOpened:false},inbox:[],quizzes:{split:qa('split'),metr:qa('metr')},challenges:{},risks:{privacy:1,hallucination:2,aiact:1},badges:[]}}
// A fresh copy per entry; its badges are taken silently (nothing is announced in the example).
function buildExample(){const t=normTeam(EXAMPLE_TEAM());t.badges=earnedBadges(t);badgeOwner=t;return t}
function enterExample(){if(AIS.run)return guardRun(enterExample);badgeQ=[];hideToast();if(!S.example)exFrom={view:S.view,sub:{...S.sub},siteFrom};S.example=true;exTeam=buildExample();S.sub.lab='forecast';go('deliver');announce(T('Podgląd przykładu zespołu. Wasza praca jest bezpieczna.'))}
function exitExample(){if(AIS.run)return guardRun(exitExample);badgeQ=[];hideToast();const f=exFrom||{view:S.view,sub:{...S.sub},siteFrom};S.example=false;exTeam=null;exFrom=null;S.sub=f.sub;go(f.view);siteFrom=f.siteFrom||null;announce(T('Wróciliście do swojej pracy.'))}
// Takes the path bar's sticky slot while the example is shown.
function renderExampleBar(){const el=$('#pathBar');el.setAttribute('aria-label',T('Podgląd przykładu'));
 if(!setHTML(el,`<div class="pb-in ex-bar" id="exampleBar"><span class="edu-chip tone-yellow ex-tag">${T('przykład')}</span><p class="pb-txt"><b>${T(`To podgląd. Wasza praca jest zapisana w zespole ${S.team}.`,`This is a preview; your work is in team slot ${S.team}.`)}</b> <span class="ex-why">${T('Przykład pokazuje formę skończonego projektu. Luki zostawiono celowo – to nie wzorcowa odpowiedź.')}</span></p><button type="button" class="btn-ink btn-sm" id="exampleExit">${ic('arrow-left')}<span>${T('Wróćcie do swojej pracy')}</span></button></div>`))return;
 $('#exampleExit').onclick=exitExample;icons(el);setHdrH()}

// ─── Render: shell ───
const nm=id=>T(...NAV.find(n=>n[0]===id)[2]);
function renderSaveWarn(){const w=$('#saveWarn');w.hidden=!saveFailed;if(saveFailed)w.textContent=T('Uwaga: przeglądarka nie zapisuje danych. Pobierzcie plik zespołu, zanim zamkniecie kartę.')}
function teamLabel(i){const n=S.teams[i]&&S.teams[i].name;return`${T('Zespół')} ${i}${n?' – '+n:''}`}
function renderTeamOptions(){$('#teamSel').innerHTML=Array.from({length:TEAM_COUNT},(_,k)=>k+1).map(i=>`<option value="${i}" ${i==S.team?'selected':''}>${esc(teamLabel(i))}</option>`).join('')}
// ─── Badges (spec 4.14): sober milestones derived from team state; no scores, no test values, no ranking ───
const BADGE_QUIZ=['life','tok','rag','split','metr'];
function BADGES(){const tt=Object.keys(TEST_TRACKS).map(trackName).join(', ');return[
 {id:'firstBase',icon:'ruler',name:T('Metoda odniesienia zapisana'),desc:T('zapisaliście metodę odniesienia, z którą porównujecie każdy eksperyment.'),how:T('Uruchomcie i zapiszcie metodę odniesienia w laboratorium swojego zadania.')},
 {id:'beatBase',icon:'trending-up',name:T('Lepiej niż metoda odniesienia'),desc:T('najlepszy eksperyment wypadł lepiej niż metoda odniesienia na tej samej części danych: na zestawie ćwiczeniowym, a po teście końcowym także na nim (remis się nie liczy).'),how:T('Zapiszcie eksperyment, który na zestawie ćwiczeniowym wypada lepiej niż metoda odniesienia (remis się nie liczy). Przy kontroli puszek i czujnikach nie może on mieć więcej fałszywych alarmów niż metoda odniesienia.')},
 {id:'fairTest',icon:'scale',name:T('Uczciwy test'),desc:T('odsłoniliście test końcowy jeden raz, dopiero po zapisaniu metody odniesienia i uzasadnienia.'),how:T(`Dotyczy zadań z ukrytym testem końcowym (${tt}): najpierw zapiszcie metodę odniesienia i uzasadnienie wyboru metody, potem odsłońcie test jeden raz.`,`Applies to the tasks with a hidden final test (${tt}): first save the baseline and the justification of your method, then reveal the test once.`)},
 {id:'noGuess',icon:'message-square-x',name:T('Linia nie zgaduje'),desc:T('asystent wiedzy poprawnie odmówił odpowiedzi poza dokumentami.'),how:T('Wykonajcie wyzwanie z pytaniem spoza dokumentów w laboratorium asystenta wiedzy. To odznaka tego zadania: przy innym nie jest potrzebna.')},
 {id:'privacy',icon:'shield-check',name:T('Dane osobowe chronione'),desc:T('wybraliście przetwarzanie lokalne, anonimizację danych osobowych albo bezpieczną odpowiedź w ryzyku o danych osobowych.'),how:T('Wybierzcie przetwarzanie lokalne lub komponent anonimizacji w architekturze albo bezpieczną odpowiedź w ryzyku o danych osobowych.')},
 {id:'threeExp',icon:'flask-conical',name:T('Trzy eksperymenty'),desc:T('zapisaliście co najmniej trzy eksperymenty w swoim zadaniu.'),how:T('Zapiszcie trzy eksperymenty w swoim zadaniu (metoda odniesienia się nie liczy).')},
 {id:'quizzes',icon:'list-checks',name:T('Demonstracje zaliczone'),desc:T('odpowiedzieliście poprawnie na pytania sprawdzające w cyklu projektu i w demonstracjach wymaganych dla waszego zadania.'),how:T('Odpowiedzcie na pytania sprawdzające pod cyklem projektu i pod demonstracjami wymaganymi dla waszego zadania (bez wybranego zadania: pod wszystkimi pięcioma).')},
 {id:'news',icon:'newspaper',name:T('Aktualność przeczytana'),desc:T('przeczytaliście aktualność na stronie firmy Rybex.'),how:T('Otwórzcie aktualności na stronie firmy Rybex.')},
 {id:'report',icon:'file-check',name:T('Raport wyeksportowany'),desc:T('pobraliście raport projektu w HTML albo Markdown.'),how:T('Wyeksportujcie raport na stronie Raport.')}]}
// Pure function of the team passed in. fairTest needs a baseline saved before the test was first seen (log entries keep testViews at save time).
function earnedBadges(t){const k=t.track,a=t.arch,ok={},vd=k?baseVerdict(t,k):null,
  L=k?testLabOf(t,k):null,pr=RISK_SCENARIOS().find(s=>s.id==='privacy'),ri=pr?riskChoice(t,pr):-1;
 ok.firstBase=!!k&&hasBaseline(t,k);
 ok.beatBase=!!(vd&&vd.beaten)&&testBeaten(t,k)!==false;
 ok.fairTest=!!L&&L.testViews===1&&t.log.some(l=>l.track===k&&l.base===true&&!l.testViews)&&whyOk(t,k);
 ok.noGuess=Object.hasOwn(t.challenges,'rag_oos')&&t.challenges.rag_oos==='done';
 ok.privacy=(ri>=0&&!!pr.options[ri].good)||(a.infra==='local'&&a.decisions.runWhere==='local')||!!a.sel.anon;
 ok.threeExp=!!k&&expOf(t,k)>=MIN_EXPERIMENTS;
 ok.quizzes=(k?['life',...reqDemos(k)]:BADGE_QUIZ).every(q=>quizDone(t,q));
 ok.news=!!t.site.newsRead;ok.report=!!t.seen.report;
 return BADGES().map(b=>b.id).filter(id=>ok[id])}
// Shown: announced badges (they stay even if a condition later turns false) plus the ones earned now.
// Exception: "better than the baseline" is withdrawn once the final test shows the tested configuration did not beat it there (a tie is no win).
const badgeIds=(t,e=earnedBadges(t))=>{const lost=testBeaten(t,t.track)===false;return BADGES().map(b=>b.id).filter(id=>(t.badges.includes(id)||e.includes(id))&&!(lost&&id==='beatBase'))};
const badgeLine=t=>BADGES().filter(b=>badgeIds(t).includes(b.id)).map(b=>b.name).join(', ')||T('(brak)');
// Announces once per new badge. A team that is only loaded, imported or switched to takes its badges silently.
// Badge toasts never interrupt: a toast on screen (a log, gate or held-save message) keeps its place and gets the badge
// line under it at once; with the toast area free the badges show as their own toast. The announcement is immediate.
let badgeOwner=null,badgeQ=[];
function flushBadges(){if(!badgeQ.length)return;const q=badgeQ.filter(x=>x.t===team()&&team().badges.includes(x.id));badgeQ=[];if(!q.length)return;
 const line=q.length===1?q[0].msg:`${T('Odznaki')}: ${q.map(x=>x.name).join(', ')}`,m=toastEl.hidden?null:$('span',toastEl);if(!m){toast(line);return}
 m.insertAdjacentHTML('beforeend',`<span class="toast-bd">${esc(line)}</span>`);if(toastEl.dataset.paused!=='true')armToast()}
function syncBadges(e){const t=team(),nw=(e||earnedBadges(t)).filter(id=>!t.badges.includes(id)),quiet=badgeOwner!==t;badgeOwner=t;if(!nw.length)return;
 t.badges.push(...nw);if(quiet||S.example)return;save();
 const nb=BADGES().filter(b=>nw.includes(b.id)).map(b=>({id:b.id,t,name:b.name,msg:`${T('Odznaka')}: ${b.name} – ${b.desc}`}));announce(nb.map(x=>x.msg).join(' '));badgeQ.push(...nb);setTimeout(flushBadges,0)}
// Badges another task earns: once the team has a task, they read "not for your task" instead of "not yet".
const badgeNA=(t,id)=>!!t.track&&(id==='fairTest'&&!Object.hasOwn(TEST_TRACKS,t.track)||id==='noGuess'&&t.track!=='rag');
// The knowledge assistant's challenge badge is optional: it is shown as such and left out of the count.
const badgeOpt=(t,id)=>id==='noGuess'&&t.track==='rag';
// Counter: badges the team's track can earn, without the optional one; an earned optional badge shows as "+1".
function badgeCount(t,on){const B=BADGES().filter(b=>!badgeNA(t,b.id)&&!badgeOpt(t,b.id)),opt=BADGES().filter(b=>badgeOpt(t,b.id)&&on.includes(b.id)).length;return`${B.filter(b=>on.includes(b.id)).length}/${B.length}${opt?` +${opt}`:''}`}
function renderBadges(e){const t=team(),on=badgeIds(t,e),B=BADGES().filter(b=>!badgeNA(t,b.id)),el=$('#badges'),nyet=T('jeszcze nie'),nopt=T('nieobowiązkowa'),st=b=>badgeOpt(t,b.id)?nopt:nyet;
 if(el){el.dataset.earned=on.join(' ');if(setHTML(el,`<span class="label" id="lblBadges">${T('Odznaki')}</span><ul class="bd-strip" aria-labelledby="lblBadges">${B.map(b=>{const e=on.includes(b.id);return`<li class="bd${e?' on':''}${!e&&badgeNA(t,b.id)?' na':''}" data-badge="${b.id}" title="${esc(b.name)}${e?'':' ('+st(b)+')'}">${ic(b.icon)}<span class="sr-only">${esc(b.name)}${e?'':' ('+st(b)+')'}</span></li>`}).join('')}</ul>`))icons(el)}
 const li=$('#badgeList');if(li&&setHTML(li,B.map(b=>{const e=on.includes(b.id),na=!e&&badgeNA(t,b.id);return`<li class="bd-item${e?' on':''}${na?' na':''}" data-badge="${b.id}" data-earned="${e}"${na?' data-na="true"':''}>${ic(b.icon)}<div><p class="bd-name"><b>${esc(b.name)}</b>${e?` – ${esc(b.desc)}`:` <span class="edu-chip">${st(b)}</span>`}</p>${e||na?'':`<p class="bd-how hint">${esc(b.how)}</p>`}</div></li>`}).join('')))icons(li)}
// Path progress first, the checklist second; data-done/data-total stay the checklist count.
function renderProg(bar=true){const t=team(),eb=earnedBadges(t);syncBadges(eb);const {done,tot}=checkProgress(t),nb=badgeIds(t,eb).length,ps=pathState(t),pn=ps.doneCount,pt=ps.steps.length,pl=`${T('Ścieżka')}: ${pn}/${pt}`,cl=`${T('lista kontrolna')} ${done}/${tot}`;const el=$('#tbProg');el.dataset.done=done;el.dataset.total=tot;el.dataset.pathDone=pn;el.dataset.pathTotal=pt;el.dataset.log=t.log.length;if(setHTML($('#tbToggle'),`<span>${pl} · ${cl} · ${T('odznaki')} ${badgeCount(t,badgeIds(t,eb))} · ${esc(S.example?t.name:teamLabel(S.team))}</span>${ic($('#teamBar').classList.contains('open')?'chevron-up':'chevron-down')}`))icons($('#tbToggle'));setHTML(el,`<div class="field"><span class="label">${pl} · ${cl} · ${t.track?`${T('eksperymenty')} (${trackName(t.track)}): ${expTxt(expCount(t.track))}`:`${T('wpisy w dzienniku')}: ${t.log.length}`}</span><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${pt}" aria-valuenow="${pn}" aria-label="${T('Postęp ścieżki warsztatów')}"><span style="width:${pt?pn/pt*100:0}%"></span></div></div>`);renderBadges(eb);paintDemoTabs();paintGaps();if(bar)renderPathBar(ps)}
function renderShell(){
 $('#nav').innerHTML=NAV.map((n,i)=>`<button type="button" data-v="${n[0]}" class="${S.view===n[0]?'on':''}" ${S.view===n[0]?'aria-current="page"':''} aria-keyshortcuts="${i+1}">${ic(n[1])}${nm(n[0])}</button>`).join('');
 $('#skip').textContent=T('Przejdź do treści');$('#lblTeam').textContent=T('Zespół');$('#lblName').innerHTML=T('Nazwa zespołu / projektu')+(S.example?` <span class="edu-chip tone-yellow" id="exChip">${T('przykład')}</span>`:'');
 renderTeamOptions();['#teamSel','#teamExport','#teamImport'].forEach(s=>{const e=$(s);e.disabled=S.example;if(S.example)e.setAttribute('aria-describedby','exLock');else e.removeAttribute('aria-describedby')});const xl=$('#exLock');xl.hidden=!S.example;xl.textContent=S.example?T('W podglądzie przykładu nie można zmienić zespołu ani wczytać lub pobrać pliku zespołu. Wróćcie do swojej pracy przyciskiem na górze.'):'';const tn=$('#teamName');tn.value=team().name;tn.placeholder=T('Np. Zespół Szprot');
 $('#teamExport').innerHTML=ic('download')+T('Pobierzcie plik zespołu');$('#teamImport').innerHTML=ic('upload')+T('Wczytajcie plik zespołu');
 const tc=$('#trChip');tc.hidden=!S.trainer||S.example;tc.textContent=T('Tryb prowadzącego');if(S.view==='trainer')tc.setAttribute('aria-current','page');else tc.removeAttribute('aria-current');
 $('#langSeg').setAttribute('aria-label',T('Język'));$$('#langSeg button').forEach(b=>{const on=b.dataset.l===S.lang;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 renderProg(false);renderSaveWarn();
 const d=document.body.dataset;d.example=String(S.example);d.view=S.view;d.team=S.team;d.lang=S.lang;d.sub=S.view==='demos'||S.view==='lab'||S.view==='rybex'?S.sub[S.view]:'';
 document.documentElement.lang=S.lang;document.title='AI Project Lab – Rybex';publishVisionContract()}
function render(){clearInterval(X.ragTimer);aiAbort();const key=`${S.team}|${S.view}|${S.sub.lab}`,keep=key===X.formKey?['expNote','qi'].map(id=>{const e=$('#'+id);return e?[id,e.value]:null}).filter(Boolean):[];X.formKey=key;if(S.view!=='lab'||!roomOk())roomDispose();renderShell();({home:vHome,brief:vBrief,data:vData,demos:vDemos,lab:vLab,arch:vArch,deliver:vDeliver,rybex:vRybex,trainer:vTrainer})[S.view]();keep.forEach(([id,v])=>{const e=$('#'+id);if(e)e.value=v});renderCaseBar();renderPathBar();icons()}

