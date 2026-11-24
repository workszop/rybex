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
 {id:'build',label:T('Laboratorium, runda 1'),min:25,go:lb,hint:T('zbudujcie pierwszą wersję rozwiązania, uruchomcie ją i zapiszcie wynik w dzienniku')},
 {id:'iterate',label:T('Rundy 2–3 i test'),min:30,go:lb,hint:({reveal:T('odsłońcie test końcowy jeden raz i zapiszcie wynik'),save:T('zapiszcie wynik testu w dzienniku – trafi do raportu jako ocena końcowa'),run:T('uruchomcie model na teście końcowym, a potem zapiszcie wynik'),again:T('nie zapisaliście wyniku testu: odsłońcie test ponownie i zapiszcie wynik (ponowne odsłonięcie liczy się jako kolejne oglądanie testu)')})[step7(t)]||T(`zapiszcie co najmniej ${MIN_EXPERIMENTS} ${plural(MIN_EXPERIMENTS,['eksperyment','eksperymenty','eksperymentów'],[])}, zmieniając jedną rzecz naraz (${ONE_THING(t.track)[0]})`,`save at least ${MIN_EXPERIMENTS} experiments, changing one thing at a time (${ONE_THING(t.track)[1]})`)},
 // Risk cards first (the risk tab), then the four go-live decisions on the architecture view.
 {id:'risk',label:T('Ryzyka i wdrożenie'),min:20,pages:[['demos','risk'],['arch']],go:riskCount(t)>=4?['arch']:['demos','risk'],hint:T('odpowiedzcie na co najmniej cztery karty ryzyk i podejmijcie cztery decyzje wdrożeniowe')},
 {id:'report',label:T('Raport i wystąpienie'),min:15,go:['deliver'],hint:T('uzupełnijcie listę i wyeksportujcie raport')}]}
// One place changes the team's task: go-live decision 3 (what is monitored) has per-track answers, so it is cleared.
function setTrack(t,k){if(t.track!==k)delete t.arch.decisions.monitor;t.track=k}
const testLabOf=(t,k)=>Object.hasOwn(TEST_TRACKS,k)?t.lab[TEST_TRACKS[k]]:null;
// Step 7 on a track with a hidden test set needs the final result in the log: an entry saved with the test visible.
// Teams from before that rule whose log holds an entry saved after a test view (normTeam leaves seen.testSave off for them)
// also count that entry, so their finished step stays done.
const finalSaved=(t,k)=>t.log.some(l=>l.track===k&&(testSaved(l)||!t.seen.testSave&&l.testViews>0));
// Where step 7 stands: 'exp' fewer than MIN_EXPERIMENTS; then, on the tracks with a hidden test, 'reveal' test never seen,
// 'save' test visible and not saved, 'run' test visible but the model run on screen is a practice-set run,
// 'again' test seen, hidden again and not saved; 'done'. Forecast and machine failures are done with the experiments:
// their check is already on data the model did not see.
function step7(t){const k=t.track,tl=k?testLabOf(t,k):null;if(!k||expOf(t,k)<MIN_EXPERIMENTS)return'exp';if(!tl||finalSaved(t,k))return'done';return tl.revealed?(pendingTest(k,t)?'save':'run'):tl.testViews<1?'reveal':'again'}
// Step 1 needs the company news once the team is past onboarding. Only real prior work (a log entry or a ticked
// checklist item) exempts a team from it: a typed name alone does not.
const realWork=t=>t.log.length>0||Object.values(t.checks).some(Boolean);
const pastOnboarding=t=>!!t.onboardedAt||hasWork(t);
const newsDue=t=>pastOnboarding(t)&&!t.site.newsRead&&!realWork(t);
function pathState(t){const k=t.track,ne=k?expOf(t,k):0,tl=k?testLabOf(t,k):null,
 done={join:pastOnboarding(t)&&(t.site.newsRead||realWork(t)),cycle:demoDone(t,'life'),task:!!(k&&t.goal.trim()),data:!!t.seen.data,demos:reqDemos(k).every(x=>demoDone(t,x)),
  build:!!k&&(ne>=1||!!(tl&&(tl.revealed||tl.testViews>0))),iterate:ne>=MIN_EXPERIMENTS&&(!tl||finalSaved(t,k)),risk:riskDone(t),report:!!t.seen.report};
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
 const el=({data:()=>$('.tree button[aria-current]'),join:()=>{if(S.view==='rybex'){siteVisit();renderPathBar();return $('.rybex-frame .rf-page h2')}return $('#onboardName')||$('#siteOpen')},task:()=>t.track?$('#goal'):$('#main [data-t]'),build:()=>t.track==='rag'&&!expOf(t,'rag')?$(({build:'#ragBuildBtn',run:'#ragRun',save:'#sv'})[ragNext(t.lab.rag)]):labBuilt(t,t.track)?$('#sv'):$(BUILD_BTNS),iterate:()=>({reveal:()=>revealTarget(t.track),save:()=>$('#sv'),run:()=>$(t.track==='vision'?'#visTrain':RUN_BTNS),again:()=>$(`[data-reveal="${t.track}"]`)})[step7(t)]?.()||$('#expNote'),report:()=>$('#expH'),cycle:quizFocus,demos:quizFocus,risk:()=>S.view==='arch'?$('#goLive [data-d]:not([data-choice]) [data-o]')||$('#goLive [data-o]'):$('#riskDemo [data-r]:not([data-choice]) [data-o]')||$('#riskDemo [data-o]')})[id]?.()||mainEl;
 const sm=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
 // An action button the bar names (train the model, save the result, export the report) is pressed, not
 // only focused: the bar's label already says what it does, so a second, identical button click is not needed. Fields,
 // the one-time test reveal and paid model runs keep the focus-only behaviour.
 roomShow(el);if(PATH_ACTIONS.some(s=>el.matches(s))&&el.getAttribute('aria-disabled')!=='true'&&!el.disabled){el.scrollIntoView({block:'center',behavior:sm});el.click();return}
 if(!el.matches('input,button,textarea,select,[tabindex]'))el.setAttribute('tabindex','-1');el.scrollIntoView({block:'center',behavior:sm});el.focus({preventScroll:true})}
// The knowledge assistant's first version takes three presses in order (ragNext: build the base, run the model, save); building the base is paid like a run, so it is focus only.
// The lab buttons the path bar leads to: the paid model runs (focus only) and the three free trainings in the browser (pressed).
const RUN_BTNS='#cRun,#ragRun',BUILD_BTNS=RUN_BTNS+',#visTrain,#fcTrain,#mtTrain';
const PATH_ACTIONS=['#expH','#sv','#visTrain','#fcTrain','#mtTrain'];
// The reveal button, or the save button while the gate still asks for a saved practice-set experiment.
function revealTarget(k){return revealGate(k)?$('#sv'):$(`[data-reveal="${k}"]`)}
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
 task:()=>t.track?T('Wpiszcie kryterium sukcesu'):T('Wybierzcie zadanie'),data:()=>T('Otwórzcie dane swojego zadania'),build:()=>t.track==='rag'&&!expOf(t,'rag')?({build:T('Zbudujcie bazę wiedzy'),run:T('Uruchomcie model na zestawie ćwiczeniowym'),save:T('Zapiszcie wynik w dzienniku')})[ragNext(t.lab.rag)]:labBuilt(t,t.track)?T('Zapiszcie wynik w dzienniku'):AI_TRACKS.includes(t.track)?T('Uruchomcie model na zestawie ćwiczeniowym'):T('Wytrenujcie model'),
 iterate:()=>({reveal:revealGate(t.track)?T('Zapiszcie eksperyment'):T('Odsłońcie test końcowy'),save:T('Zapiszcie wynik testu'),run:t.track==='vision'?T('Wytrenujcie model'):T('Uruchomcie model na teście końcowym'),again:T('Odsłońcie test ponownie i zapiszcie wynik')})[step7(t)]||T('Zapiszcie eksperyment'),risk:()=>S.view==='arch'?T('Podejmijcie cztery decyzje wdrożeniowe'):T('Odpowiedzcie na pytania o ryzyka'),report:()=>T('Wyeksportujcie raport')})[id]?.()||T('Dalej')};
// The path bar's Next label for a step (also the start page's main button): the action here, else where it leads.
const nextLabel=(n,st=pathState(team()))=>{const s=PATH_STEPS().find(x=>x.id===n.id);return atTarget(s)?NEXT_HERE(s.id):`${T('Dalej')}: ${s.id===st.cur?NEXT_WHERE(s):s.label}`};
const NEXT_WHERE=s=>({join:s.go[0]==='rybex'?T('strona firmy Rybex'):'',risk:s.go[0]==='arch'?T('decyzje wdrożeniowe'):'',demos:T('następna demonstracja')})[s.id]||s.label;
// A redraw keeps keyboard focus on the bar's control it was on (a run can end while the participant sits on Next);
// not while Next itself navigates (pathNav), where the target page decides focus.
function closePathMap(){const m=$('#pathMap'),b=$('#pathMapBtn');if(m)m.hidden=true;if(b)b.setAttribute('aria-expanded','false')}
document.addEventListener('click',e=>{const m=$('#pathMap');if(m&&!m.hidden&&!e.target.closest('#pathBar'))closePathMap()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=$('#pathMap');if(m&&!m.hidden){e.preventDefault();closePathMap();const b=$('#pathMapBtn');if(b)b.focus()}}});
function renderPathBar(ps){if(X.room)X.room.handle.refresh();if(S.example)return renderExampleBar();const el=$('#pathBar'),ae=document.activeElement,fid=ae&&ae!==el&&el.contains(ae)&&ae.id||'',t=team(),st=ps||pathState(t),all=PATH_STEPS(),c=all.find(s=>s.id===st.cur),ci=all.indexOf(c)+1,nx=st.next&&all.find(s=>s.id===st.next.id),ni=all.indexOf(nx)+1,cDone=!!st.steps.find(s=>s.id===st.cur)?.done,act=atTarget(c)&&!cDone?c:nx,here=!!act&&atTarget(act);
 Object.assign(el.dataset,{total:all.length,step:st.cur,done:st.doneCount,next:nx?nx.id:''});el.setAttribute('aria-label',T('Ścieżka warsztatów'));
 const mapRows=all.map((s,i)=>{const dn=!!st.steps[i].done,cur=s.id===st.cur;return`<li><button type="button" class="pm-item${dn?' done':''}${cur?' cur':''}" data-step="${s.id}" data-go="${s.go.join('/')}"${cur?' aria-current="step"':''}><span class="pm-num">${dn?ic('check'):i+1}</span><span class="pm-info"><b>${esc(s.label)}</b> <span class="pm-min">· ${T('ok.')} ${s.min} min</span><span class="pm-hint">${esc(s.hint)}</span></span><span class="pm-st">${dn?T('gotowe','done'):cur?T('tu jesteś','here'):''}</span></button></li>`}).join('');
 if(!setHTML(el,`<div class="pb-in"><button type="button" class="pb-map-btn" id="pathMapBtn" aria-expanded="false" aria-controls="pathMap" title="${esc(T('Pokaż wszystkie 9 kroków i przejdź do wybranego','Show all 9 steps and jump to any step'))}"><ol class="pb-dots" aria-hidden="true">${st.steps.map(s=>`<li class="${s.done?'done':''} ${s.id===st.cur?'cur':''}"></li>`).join('')}</ol><span class="sr-only">${esc(T('Mapa wszystkich kroków','All steps map'))}</span>${ic('chevron-down')}</button><p class="pb-txt"><span class="pb-here">${T('Jesteś tutaj')}: <b>${T(`krok ${ci} z ${all.length}`,`step ${ci} of ${all.length}`)}, ${c.label}</b> <span class="pb-min">· ${T('ok.')} ${c.min} min</span></span>${nx?`<span class="pb-hint"> ${ni<ci?T(`Brakuje wcześniejszego kroku ${ni} z ${all.length}`,`Earlier step ${ni} of ${all.length} still open`):T('Następny krok')}: ${nx.hint}.</span>`:''}</p>${nx?`<button type="button" class="${S.view==='deliver'?'btn-ghost':'btn'} btn-sm" id="pathNext" data-go="${act.go.join('/')}" data-mode="${here?'here':'go'}"><span class="pb-lbl">${nextLabel(act,st)}</span>${ic(here?'arrow-down':'arrow-right')}</button>`:`<button type="button" class="btn-ghost btn-sm" id="pathNext" data-go="" data-mode="done">${ic('circle-check')}<span class="pb-lbl">${T('Ścieżka ukończona')}</span></button>`}</div><div class="path-map" id="pathMap" hidden><ol class="pm-list">${mapRows}</ol></div>`))return;
 $('#pathMapBtn').onclick=()=>{const m=$('#pathMap'),b=$('#pathMapBtn'),open=m.hidden;m.hidden=!open;b.setAttribute('aria-expanded',String(open))};
 $$('#pathMap [data-go]').forEach(b=>b.onclick=()=>{const id=b.dataset.step,p=PATH_STEPS().find(x=>x.id===id);closePathMap();if(!p)return;if(p.id==='data'&&team().track&&!AIS.run)FSEL=TRACK_FILE[team().track];if(atTarget(p)&&!AIS.run)pathFocus(p.id);else{pathNav=true;try{go(...p.go)}finally{pathNav=false}}});
 $('#pathNext').onclick=()=>{closePathMap();const st=pathState(team()),c=PATH_STEPS().find(x=>x.id===st.cur),cDone=!!st.steps.find(s=>s.id===st.cur)?.done,s=atTarget(c)&&!cDone?c:st.next;if(!s)return;const p=PATH_STEPS().find(x=>x.id===s.id);if(atTarget(p)&&!AIS.run)pathFocus(p.id);else{if(p.id==='data'&&team().track&&!AIS.run)FSEL=TRACK_FILE[team().track];pathNav=true;try{go(...p.go)}finally{pathNav=false}
  // Same view, new sub view (one demo to the next): the button was redrawn, so focus would fall to BODY.
  if(!document.activeElement||document.activeElement===document.body)mainEl.focus({preventScroll:true})}};icons(el);setHdrH();
 if(fid&&!pathNav&&(!document.activeElement||document.activeElement===document.body)){const f=document.getElementById(fid);if(f)f.focus({preventScroll:true})}}

// ─── Worked example (spec 4.13): one finished, deliberately incomplete forecast project, read-only ───
// The log entries copy the shapes and values the forecast lab saves (Szprot w oleju: trend and seasonality at 6 hidden months,
// trend alone, then 9 hidden months).
// Gaps on purpose: 2 of 4 go-live decisions, 3 of 5 risks, about half the checklist, notes for sections 1-3 only, other labs untouched.
function EXAMPLE_TEAM(){const lab=defaultLab(),qa=k=>{const q=QUIZZES()[k];return{answers:Object.fromEntries(q.map(x=>[x.id,x.answer])),first:Object.fromEntries(q.map(x=>[x.id,true])),doneAt:'2026-11-05T09:40:00.000Z'}},
  ex=(id,ts,h,season,mape,mae,slope,note)=>({id,ts,track:'forecast',cfg:{p:0,h,trend:1,season},res:{mape,mae,slope,trained:true,primary:{m:'MAPE',v:mape,hi:false,test:true}},note,testViews:0});
 lab.fc={p:0,h:9,trend:1,season:1,fit:'0|9|1|1'};
 return{name:T('Przykład: prognoza Szprotu'),track:'forecast',goal:T('Prognoza sprzedaży Szprotu w oleju na 6 miesięcy z błędem (MAPE) poniżej 5%.'),
  checks:Object.fromEntries(['1.0','1.1','1.2','2.0','2.1','2.3','3.0','3.2','3.5','4.0','4.2','5.0'].map(k=>[k,true])),
  notes:{1:T('Problem: planowanie produkcji Szprotu w sezonie, dla działu planowania. Sukces: błąd prognozy poniżej 5% na 6 miesięcy.'),
   2:T('Dane: sales_history.csv, 36 miesięcy sprzedaży. Ostatnie miesiące to test (podział chronologiczny). Brak danych o promocjach i cenach.'),
   3:T('Model: trend i sezonowość, bo sprzedaż ma wyraźny sezon. Infrastruktura hybrydowa: dane sprzedaży z ERP zostają w zakładzie.')},
  arch:{sel:Object.fromEntries(PRESET.forecast.map(k=>[k,true])),infra:'hybrid',decisions:{runWhere:'hybrid',reviewEvery:'quarterly'}},
  log:[ex('ex1','2026-11-05T10:12:00.000Z',6,1,0.04232415277446049,6.444299833761529,1.0375973303670745,T('Model z trendem i sezonowością myli się średnio o 4,2% na 6 ukrytych miesiącach.')),
   ex('ex2','2026-11-05T10:20:00.000Z',6,0,0.07899797965914232,11.590767519466075,1.0375973303670745,T('Bez sezonowości błąd rośnie do 7,9%: model nie wie, że niektóre miesiące są mocniejsze.')),
   ex('ex3','2026-11-05T10:31:00.000Z',9,1,0.03999604622914333,6.005431875415086,1.0677655677655677,T('9 ukrytych miesięcy: model ma mniej danych do nauki, a błąd to 4,0%.'))],
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
 {id:'fairTest',icon:'scale',name:T('Uczciwy test'),desc:T('odsłoniliście test końcowy jeden raz, dopiero po zapisaniu eksperymentu na zestawie ćwiczeniowym.'),how:T(`Dotyczy zadań z ukrytym testem końcowym (${tt}): najpierw zapiszcie eksperyment na zestawie ćwiczeniowym, potem odsłońcie test jeden raz.`,`Applies to the tasks with a hidden final test (${tt}): first save an experiment on the practice set, then reveal the test once.`)},
 {id:'noGuess',icon:'message-square-x',name:T('Linia nie zgaduje'),desc:T('asystent wiedzy poprawnie odmówił odpowiedzi poza dokumentami.'),how:T('Wykonajcie wyzwanie z pytaniem spoza dokumentów w laboratorium asystenta wiedzy. To odznaka tego zadania: przy innym nie jest potrzebna.')},
 {id:'privacy',icon:'shield-check',name:T('Dane osobowe chronione'),desc:T('wybraliście przetwarzanie lokalne, anonimizację danych osobowych albo bezpieczną odpowiedź w ryzyku o danych osobowych.'),how:T('Wybierzcie przetwarzanie lokalne lub komponent anonimizacji w architekturze albo bezpieczną odpowiedź w ryzyku o danych osobowych.')},
 {id:'threeExp',icon:'flask-conical',name:T('Trzy eksperymenty'),desc:T('zapisaliście co najmniej trzy eksperymenty w swoim zadaniu.'),how:T('Zapiszcie trzy eksperymenty w swoim zadaniu.')},
 {id:'quizzes',icon:'list-checks',name:T('Demonstracje zaliczone'),desc:T('odpowiedzieliście poprawnie na pytania sprawdzające w cyklu projektu i w demonstracjach wymaganych dla waszego zadania.'),how:T('Odpowiedzcie na pytania sprawdzające pod cyklem projektu i pod demonstracjami wymaganymi dla waszego zadania (bez wybranego zadania: pod wszystkimi pięcioma).')},
 {id:'news',icon:'newspaper',name:T('Aktualność przeczytana'),desc:T('przeczytaliście aktualność na stronie firmy Rybex.'),how:T('Otwórzcie aktualności na stronie firmy Rybex.')},
 {id:'report',icon:'file-check',name:T('Raport wyeksportowany'),desc:T('pobraliście raport projektu w HTML albo Markdown.'),how:T('Wyeksportujcie raport na stronie Raport.')}]}
// Pure function of the team passed in. fairTest needs an experiment saved before the test was first seen (log entries keep testViews at save time).
function earnedBadges(t){const k=t.track,a=t.arch,ok={},
  L=k?testLabOf(t,k):null,pr=RISK_SCENARIOS().find(s=>s.id==='privacy'),ri=pr?riskChoice(t,pr):-1;
 ok.fairTest=!!L&&L.testViews===1&&t.log.some(l=>l.track===k&&!l.testViews);
 ok.noGuess=Object.hasOwn(t.challenges,'rag_oos')&&t.challenges.rag_oos==='done';
 ok.privacy=(ri>=0&&!!pr.options[ri].good)||(a.infra==='local'&&a.decisions.runWhere==='local')||!!a.sel.anon;
 ok.threeExp=!!k&&expOf(t,k)>=MIN_EXPERIMENTS;
 ok.quizzes=(k?['life',...reqDemos(k)]:BADGE_QUIZ).every(q=>quizDone(t,q));
 ok.news=!!t.site.newsRead;ok.report=!!t.seen.report;
 return BADGES().map(b=>b.id).filter(id=>ok[id])}
// Shown: announced badges (they stay even if a condition later turns false) plus the ones earned now.
const badgeIds=(t,e=earnedBadges(t))=>BADGES().map(b=>b.id).filter(id=>t.badges.includes(id)||e.includes(id));
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

