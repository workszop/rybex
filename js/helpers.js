// js/helpers.js - DOM refs, shared helpers and the store-only ZIP writer.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── DOM refs ───
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const mainEl=$('#main'),toastEl=$('#toast'),liveEl=$('#live'),inspEl=$('#insp');

// ─── Helpers ───
const catName=k=>k==='other'?T('inne (nic nie pasuje)'):CAT[k]?CAT[k][langIx()]:k;
const typeName=k=>({dent:T('wgniecenie'),label:T('etykieta'),code:T('kod partii'),ok:'OK'})[k]||k;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc=()=>S.lang==='pl'?'pl-PL':'en-GB';
const NUM_FMT={},numFmt=d=>NUM_FMT[S.lang+d]||(NUM_FMT[S.lang+d]=new Intl.NumberFormat(loc(),{minimumFractionDigits:d,maximumFractionDigits:d}));
const num=(x,d=1)=>isFinite(x)?numFmt(d).format(Number(x)):'–';
const pct=x=>isFinite(x)?num(x*100,1)+'%':'–';
// Writes markup only when it differs from the last write to this element (icons and handlers then stay in place).
const setHTML=(el,h)=>{if(el._h===h)return false;el._h=h;el.innerHTML=h;return true};
const ic=n=>`<i data-lucide="${n}" class="ic" aria-hidden="true"></i>`;
const badge=(n,t='ink',lg)=>`<span class="badge ${lg?'badge-lg ':''}tone-${t}">${ic(n)}</span>`;
// English texts live in i18n/en.js and are fetched when an English reader needs them: at start, or when the language is switched.
// ?i18n=all loads them for everyone (the tests flip S.lang directly). A failed fetch leaves the Polish text.
let enLoad=null;const needEn=()=>window.I18N_EN?Promise.resolve():enLoad||(enLoad=new Promise(res=>{const e=document.createElement('script');e.src='i18n/en.js';e.onload=e.onerror=()=>{enLoad=null;res()};document.head.appendChild(e)}));
// An <i data-lucide> element becomes the inline svg from vendor/icons.js (lucide icons, built by tools/build-icons.mjs); an unknown name, or a missing vendor/icons.js, leaves an empty <i>.
function icons(root=document){for(const el of root.querySelectorAll('i[data-lucide]')){const n=el.getAttribute('data-lucide'),b=(window.ICONS||{})[n];if(!b)continue;const v=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const a of el.attributes)if(a.name!=='data-lucide'&&a.name!=='class')v.setAttribute(a.name,a.value);
 for(const[k,x]of Object.entries({width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round',class:'lucide lucide-'+n+(el.getAttribute('class')?' '+el.getAttribute('class'):'')}))v.setAttribute(k,x);
 v.innerHTML=b;el.replaceWith(v)}}
function save(){if(S.example)return true;let ok=true;try{const cur=readStore()||{};localStorage.setItem(STORE_KEY,JSON.stringify({...cur,lang:S.lang,team:S.team,view:S.view==='trainer'?cur.view||'home':S.view,sub:S.sub,ai:S.ai,rooms:S.rooms,fsel:FSEL,teams:{...(cur.teams||{}),[S.team]:team()}}))}catch(e){ok=false}saveFailed=!ok;renderSaveWarn();return ok}
function dl(name,data,type){const b=data instanceof Blob?data:new Blob([data],{type:type||'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
const toCSV=rows=>{const k=Object.keys(rows[0]);return k.join(',')+'\n'+rows.map(r=>k.map(c=>{const v=String(r[c]);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\n')};
function prf(tp,fp,fn,tn){const p=tp/(tp+fp),r=tp/(tp+fn);return{tp,fp,fn,tn,p,r,f1:2*p*r/(p+r),acc:(tp+tn)/(tp+fp+fn+tn)}}
const f0=x=>isFinite(x)?x:0;
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
// Show or hide the held-out test set; every reveal is counted and ends up in the log.
function toggleReveal(L){L.revealed=!L.revealed;if(L.revealed)L.testViews++;renderPathBar()}
const isTyping=()=>{const a=document.activeElement;return !!a&&(a.tagName==='TEXTAREA'||(a.tagName==='INPUT'&&a.type==='text'))};
// Announcements made in the same task join into one live message; a later task replaces it as before.
let liveBuf=[],liveTick=false;
function announce(t){if(!liveTick){liveBuf=[];liveTick=true;queueMicrotask(()=>{liveTick=false})}liveBuf.push(t);const m=liveBuf.join(' ');clearTimeout(liveTimer);liveTimer=setTimeout(()=>{liveEl.textContent=m},500)}
// Toasts with an action (undo, confirm) stay longer; every toast pauses while hovered or focused.
function toast(msg,opt={}){clearTimeout(toastTimer);toastEl.innerHTML=`<span>${esc(msg)}</span>`;toastEl.dataset.reason=opt.reason||'';toastEl.dataset.ms=opt.ms||(opt.action?TOAST_ACTION_MS:TOAST_MS);toastEl.dataset.paused='false';
 if(opt.action){const b=document.createElement('button');b.type='button';b.className='toast-act';b.textContent=opt.action[0];b.onclick=()=>{hideToast();opt.action[1]()};toastEl.append(b)}
 const x=document.createElement('button');x.type='button';x.className='toast-x';x.setAttribute('aria-label',T('Zamknij powiadomienie'));x.innerHTML=ic('x');x.onclick=hideToast;toastEl.append(x);icons(toastEl);
 toastEl.hidden=false;document.body.classList.add('has-toast');armToast();placeToast()}
function armToast(){clearTimeout(toastTimer);toastTimer=setTimeout(hideToast,+toastEl.dataset.ms||TOAST_MS)}
function hideToast(){clearTimeout(toastTimer);toastEl.hidden=true;document.body.classList.remove('has-toast')}
// From 1024 px the toast sits bottom right; if it would cover a save, note or reveal control or the lab jump bar, it moves to the nearest free height (lifted above them, below them, or top right under the sticky bars).
const TOAST_AVOID='#sv,#expNote,[data-reveal],#labJump';let toastRaf=0;
function placeToast(){toastRaf=0;const st=toastEl.style;st.top='';st.bottom='';if(toastEl.hidden||innerWidth<1024)return;const t=toastEl.getBoundingClientRect(),h=t.height,vh=innerHeight,top=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h'))||0)+8;
 const obs=[...document.querySelectorAll(TOAST_AVOID)].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.bottom>0&&r.top<vh&&r.right>t.left&&r.left<t.right);
 const free=y=>y>=top&&y+h<=vh-8&&obs.every(r=>r.bottom<=y||r.top>=y+h);if(free(t.top))return;
 const ys=[...obs.map(r=>r.top-12-h).sort((a,b)=>b-a),top+4,...obs.map(r=>r.bottom+12).sort((a,b)=>a-b)],y=ys.find(free);if(y!==undefined){st.top=y+'px';st.bottom='auto'}}
const queueToastPlace=()=>{if(!toastRaf&&!toastEl.hidden)toastRaf=requestAnimationFrame(placeToast)};
// Polish plural forms [1, 2–4, 5+] and English [1, other].
function plural(n,pl,en){const a=Math.abs(Math.round(+n||0));if(S.lang==='en')return a===1?en[0]:en[1];return a===1?pl[0]:(a%10>=2&&a%10<=4&&(a%100<12||a%100>14))?pl[1]:pl[2]}
const PLW={call:[['wywołanie','wywołania','wywołań'],['call','calls']],token:[['token','tokeny','tokenów'],['token','tokens']],example:[['przykład','przykłady','przykładów'],['example','examples']],answer:[['odpowiedź','odpowiedzi','odpowiedzi'],['answer','answers']],grade:[['ocena','oceny','ocen'],['grade','grades']],complaint:[['zgłoszenie','zgłoszenia','zgłoszeń'],['complaint','complaints']],falseAlarm:[['fałszywy alarm','fałszywe alarmy','fałszywych alarmów'],['false alarm','false alarms']]};
const cnt=(n,w,shown=n)=>`${shown} ${plural(n,...PLW[w])}`;
// Glossary: id -> {forms (regex sources, Polish inflection + English), d (definition)}. Tips show on hover and keyboard focus.
const GLOSS=()=>{const g=(forms,pl,en)=>({forms,d:T(pl,en)});return{
 'macro-f1':g(['ma[ck]ro-f1'],'Średnia z F1 policzonych osobno dla każdej kategorii: rzadka kategoria waży tyle samo co częsta.','The mean of F1 computed separately for each category: a rare category counts as much as a common one.'),
 'few-shot':g(['few-shot'],'Kilka oznaczonych przykładów dołączonych do promptu. Model korzysta z nich przy odpowiedzi, bez zmiany swoich wag.','A few labelled examples added to the prompt. The model uses them while answering, without changing its weights.'),
 dev:g(['dev','zestaw(?:u|ie|em|owi|y|ów)? ćwiczeniow(?:y|ego|ym|emu|e|ych)','(?:zbi(?:ór|oru|orze|orem|orowi)|zestaw(?:u|ie|em|owi)?) deweloperski(?:ego|emu|m)?','practice sets?','dev(?:elopment)? sets?'],'Zestaw ćwiczeniowy: część danych, na której poprawiacie polecenie dla modelu albo ustawienia. Wynik możecie oglądać dowolnie często. Test końcowy zostaje zakryty na ocenę na koniec.','Practice set: the part of the data you improve the model instruction or the settings on. You may look at its score as often as you like. The final test stays hidden for the evaluation at the end.'),
 precision:g(['precyzj[aięąi]','precision'],'Ze wszystkich alarmów, które podniósł system, jaka część była trafna (naprawdę wada albo naprawdę awaria). Niska precyzja oznacza dużo fałszywych alarmów i zbędne zatrzymywanie linii.','Of all the alarms the system raised, the share that were right (really a defect or really a breakdown). Low precision means many false alarms and needless line stops.'),
 recall:g(['czułoś(?:ć|ci|cią)','recall'],'Ze wszystkich prawdziwych przypadków (wad, minut awarii, groźnych zgłoszeń), jaką część system wykrył. Niska czułość oznacza przegapione przypadki: wadliwa puszka w sklepie albo awaria bez alarmu.','Of all the real cases (defects, failure minutes, dangerous complaints), the share the system caught. Low recall means missed cases: a defective can in the shop or a breakdown without an alarm.'),
 accuracy:g(['trafnoś(?:ć|ci|cią)','accuracy'],'Odsetek wszystkich przypadków ocenionych poprawnie. Przy rzadkich wadach bywa myląco wysoka (paradoks trafności).','The share of all cases judged correctly. With rare defects it can be misleadingly high (the accuracy paradox).'),
 f1:g(['f1','f1[- ]score'],'Jedna liczba łącząca precyzję i czułość. Wysokie F1 wymaga, żeby system jednocześnie rzadko się mylił i rzadko coś pomijał.','One number combining precision and recall. A high F1 needs the system to be wrong rarely and to miss things rarely, both at once.'),
 token:g(['token(?:y|ów|ami|ach|om|a|ie|em)?','tokens'],'Kawałek tekstu, na który model dzieli zdanie. To nie zawsze jest całe słowo. Opłata za model liczy się zwykle od liczby tokenów.','A piece of text the model splits a sentence into, not always a whole word. Model fees are usually charged per token.'),
 prompt:g(['prompt(?:y|u|ów|em|ach|ami|om)?','prompcie','prompt(?:u|em|cie)? systemow(?:y|ego|ym)','system prompts?','prompts'],'Instrukcja i kontekst przekazywane modelowi przy wywołaniu. Zmiana promptu zmienia zachowanie bez trenowania wag.','The instruction and context passed to the model with each call. Changing the prompt changes behaviour without training any weights.'),
 rag:g(['rag(?:-(?:u|a|iem|owi))?'],'Najpierw wyszukujemy fragmenty dokumentów firmy, a dopiero potem model pisze odpowiedź na ich podstawie. Model nie „zna” procedur z pamięci.','First we search the company documents for passages, then the model writes the answer from them. The model does not “know” the procedures from memory.'),
 'tf-idf':g(['tf-idf'],'Prosty sposób liczenia, jak charakterystyczne jest słowo dla fragmentu. Asystent wiedzy w tej aplikacji szuka inaczej: po wektorach (embeddingach).','A simple way to score how characteristic a word is of a passage. The knowledge assistant in this app searches differently: by vectors (embeddings).'),
 embedding:g(['embedding(?:i|ów|ami|ach|u|iem|s)?'],'Liczbowa reprezentacja tekstu używana do wyszukiwania „po sensie”. Na warsztatach nie trzeba jej liczyć ręcznie.','A numeric representation of text used to search “by meaning”. In the workshop you do not compute it by hand.'),
 poc:g(['poc','proof of concept','prototyp(?:u|ie|em|y|ów)?','prototypes?'],'Najmniejsza działająca wersja, która sprawdza główne założenie rozwiązania.','The smallest working version that tests the solution’s main assumption.'),
 mape:g(['mape'],'Średni bezwzględny błąd procentowy prognozy. Niższy zwykle oznacza lepszą prognozę.','Mean absolute percentage error of a forecast. Lower is usually better.'),
 hallucination:g(['halucynacj(?:a|i|ę|ą|e|om|ami)','hallucinations?','hallucinated'],'Pewna odpowiedź modelu niepoparta źródłem albo sprzeczna z dokumentami.','A confident model answer that no source supports or that contradicts the documents.'),
 leakage:g(['wyciek(?:u|iem|i)? danych','(?:data )?leakage'],'Te same przykłady trafiają do budowy rozwiązania i do testu. Wynik wygląda dobrze, ale nie pokazuje, jak system zachowa się na nowych przypadkach.','The same examples go into building the solution and into the test. The score looks good but does not show how the system handles new cases.'),
 'test-set':g(['test(?:u|em|owi|cie)? końcow(?:y|ego|ym|emu)','zbi(?:ór|oru|orze|orem|ory|orów|orach) testow(?:y|ego|ym|e|ych)','zestaw(?:u|ie|em)? testow(?:y|ego|ym)','final tests?','test sets?'],'Test końcowy: część danych odłożona na ocenę na koniec. Odsłaniacie go raz, gdy rozwiązanie jest gotowe, i nie stroicie na nim ustawień – dlatego pokazuje, jak system poradzi sobie z nowymi przypadkami.','Final test: the part of the data set aside for the evaluation at the end. You reveal it once, when the solution is ready, and do not tune on it – so it shows how the system copes with new cases.'),
 api:g(['api'],'Usługa zewnętrzna wywoływana przez sieć. Na warsztatach to model językowy dostępny przez serwer zajęć.','An external service called over the network. In the workshop it is the language model reached through the class server.'),
 injection:g(['prompt injection','injection','wstrzyknię(?:cie|cia|ciem|ciu) (?:promptu|polecenia)'],'Próba traktowania treści od użytkownika (np. reklamacji) jako nowej instrukcji dla modelu. Treść to dane, nie polecenie.','An attempt to make user content (e.g. a complaint) act as a new instruction to the model. Content is data, not a command.'),
 'ai-act':g(['ai act(?:u|em|s)?'],'Unijne ramy obowiązków dla systemów AI. Na warsztatach uczymy pytań, które warto zadać; nie wystawiamy oceny prawnej.','The EU framework of obligations for AI systems. In the workshop we practise the questions worth asking; we give no legal assessment.'),
 gdpr:g(['rodo','gdpr','dan(?:e|ych|ymi|ym) osobow(?:e|ych|ymi|ym)','personal data'],'Zasady ochrony danych osób. Reklamacje mogą zawierać telefon czy adres, które nie powinny bez potrzeby trafiać do zewnętrznego API.','Rules protecting people’s data. Complaints may contain a phone number or address that should not go to an external API without need.'),
 hitl:g(['hitl','człowiek(?:a)? w pętli','weryfikacj(?:a|i|ę|ą) przez człowieka','nadz(?:ór|oru|orem|orze) człowieka','human[- ]in[- ]the[- ]loop','human oversight'],'Człowiek zatwierdza decyzję o dużych skutkach (zatrzymanie linii, odpowiedź do klienta).','A person approves decisions with big consequences (stopping the line, replying to a customer).'),
 tfidf:g(['tf-idf'],'Sposób wyszukiwania po słowach: fragment dostaje wyższy wynik, gdy zawiera słowa z pytania, zwłaszcza rzadkie. Nie rozumie synonimów ani odmiany słów.','A word-based search method: a passage scores higher when it contains words from the question, especially rare ones. It does not understand synonyms or word forms.'),
 json:g(['json'],'Format zapisu danych, który program łatwo odczyta (pola w nawiasach klamrowych). Prosimy model o odpowiedź w JSON, żeby aplikacja mogła ją automatycznie sprawdzić.','A data format a program can read easily (fields in curly brackets). We ask the model to answer in JSON so the app can check the answer automatically.'),
 fewshot:g(['few-shot'],'Kilka przykładów z poprawną odpowiedzią dołączonych do promptu. Model uczy się z nich formy odpowiedzi bez trenowania.','A few examples with the correct answer included in the prompt. The model learns the answer format from them without training.'),
 cnn:g(['cnn'],'Sieć neuronowa do obrazów (konwolucyjna). Trzeba ją wytrenować na setkach oznaczonych zdjęć.','A neural network for images (convolutional). It has to be trained on hundreds of labelled photos.'),
 plc:g(['plc'],'Sterownik maszyny na linii. Z niego pochodzą odczyty czujników i do niego można wysłać sygnał zatrzymania.','The machine controller on the line. Sensor readings come from it and a stop signal can be sent to it.'),
 erp:g(['erp'],'System firmy do zamówień, magazynu i faktur. Stąd pochodzą dane o sprzedaży i partiach.','The company system for orders, stock and invoices. The sales and batch data come from it.'),
 drift:g(['dryf(?:u|em|ie)?','drift'],'Zmiana danych albo warunków w czasie, przez którą system zaczyna działać gorzej i wymaga ponownej oceny.','A change in data or conditions over time that makes the system work worse and calls for a fresh evaluation.')}};
// One combined regex per language, longest form first (shortest text a form can match, so 'prompt injection' wins over 'prompt'); ids are looked up by capture group.
const glLen=f=>{let o;do{o=f;f=f.replace(/\((?:\?:)?[^()]*\)\?/g,'').replace(/\((?:\?:)?([^()|]*)[^()]*\)/g,'$1')}while(f!==o);return f.replace(/\[[^\]]*\]\?|.\?/g,'').replace(/\[[^\]]*\]/g,'x').length};
const GLRX={};
function glRx(){if(GLRX[S.lang])return GLRX[S.lang];const G=GLOSS(),fs=[];Object.keys(G).forEach(id=>G[id].forms.forEach(f=>fs.push([f,id])));fs.sort((a,b)=>glLen(b[0])-glLen(a[0]));
 return GLRX[S.lang]={re:new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${fs.map(f=>`(${f[0]})`).join('|')})(?![\\p{L}\\p{N}_-])`,'giu'),ids:fs.map(f=>f[1])}}
const gl=(id,label=id)=>{const k=String(id).toLowerCase(),e=GLOSS()[k];return e?`<span class="gloss" tabindex="0" data-term="${k}">${label}<span class="gloss-tip" role="tooltip">${esc(e.d)}</span></span>`:label};
// glh: glosses the first occurrence of each term in text nodes of an HTML string; tags, attributes, code, links, buttons and existing tips stay untouched.
const GL_SKIP=/^(code|pre|a|button|textarea|select|option|script|style|svg|kbd)$/,GL_VOID=/^(br|img|input|hr|wbr|meta|link|source|col|area|path|circle|rect|line|polyline|use)$/;
function glh(html){const{re,ids}=glRx(),seen=new Set(),st=[];let skip=0;
 return String(html).split(/(<\/?[a-z][^>]*>)/i).map(p=>{const m=/^<(\/?)([a-z][a-z0-9-]*)/i.exec(p);if(m){const n=m[2].toLowerCase();
   if(m[1]){const i=st.map(x=>x.n).lastIndexOf(n);if(i>=0)st.splice(i).forEach(x=>skip-=x.s)}
   else{const t=/data-term="([^"]*)"/.exec(p);if(t)seen.add(t[1]);if(!GL_VOID.test(n)&&!/\/>$/.test(p)){const s=+(GL_SKIP.test(n)||/class="[^"]*\bgloss/.test(p));st.push({n,s});skip+=s}}return p}
  if(skip||!p)return p;return p.replace(re,(m,...g)=>{const i=g.findIndex(x=>x!==undefined),id=ids[i];if(i<0||seen.has(id))return m;seen.add(id);return gl(id,m)})}).join('')}
const glx=s=>glh(esc(s));
// Keeps an open tip inside the viewport: shifts it sideways and flips it above the term near the bottom edge.
function glFit(e){const g=e.target.closest&&e.target.closest('.gloss'),t=g&&g.querySelector('.gloss-tip');if(!t)return;requestAnimationFrame(()=>{const r=t.getBoundingClientRect();if(!r.width)return;const W=document.documentElement.clientWidth,x0=r.left-(parseFloat(t.style.left)||0),gr=g.getBoundingClientRect();let dx=0;if(x0+r.width>W-8)dx=W-8-x0-r.width;if(x0+dx<8)dx=8-x0;t.style.left=dx?dx+'px':'';t.classList.toggle('up',gr.bottom+6+r.height>innerHeight-8&&gr.top-6-r.height>8)})}
document.addEventListener('mouseover',glFit);document.addEventListener('focusin',glFit);
// Escape dismisses an open tip (WCAG 1.4.13) without moving focus; the next focus or hover on that term shows it again.
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||inspEl.open)return;const a=document.activeElement,g=new Set([...document.querySelectorAll('.gloss:hover')]);if(a&&a.closest)g.add(a.closest('.gloss'));g.forEach(x=>x&&x.classList.add('gl-off'))});
// A term inside a label (the split demo's leakage box) opens its tip without toggling the labelled control.
document.addEventListener('click',e=>{const g=e.target.closest&&e.target.closest('.gloss');if(g&&g.closest('label'))e.preventDefault()});
const glOn=e=>{const g=e.target.closest&&e.target.closest('.gloss');if(g&&g.classList.contains('gl-off')&&!(e.type==='mouseover'&&e.relatedTarget&&g.contains(e.relatedTarget)))g.classList.remove('gl-off')};
document.addEventListener('focusin',glOn);document.addEventListener('mouseover',glOn);
// While a model run is going, actions that rebuild the page ask first instead of cancelling it silently.
function guardRun(fn){if(!AIS.run)return fn();toast(T('Trwa przebieg modelu. Zaczekajcie, aż się skończy, albo go przerwijcie.'),{action:[T('Przerwijcie i kontynuujcie'),()=>{aiAbort();fn()}]})}
// Background re-renders (another tab, layout breakpoint) wait until the run ends.
function softRender(){if(AIS.run){X.renderPending=true;return}render()}
function withUndo(msg,fn){const snap=JSON.stringify(team()),ex=S.example;fn();const ok=save();render();if(!ok)return;toast(msg,{action:[T('Cofnij'),()=>{if(S.example!==ex)return;setTeam(normTeam(JSON.parse(snap)));save();render();announce(T('Cofnięto'))}]})}
function statGrid(items,cls='grid4 stats4'){return`<div class="${cls}">${items.map(([v,l,t])=>`<div class="stat ${t?'tone-'+t:'neutral'} edu-block"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`}
// Focus pass 2: every photo gallery opens with the mismatches first and can hide the correct ones.
// The tiles stay in the DOM (tests count them); the filter only toggles `hidden` on the correct ones.
function galWord(c){return c==='fn'?T('przegapiona wada'):c==='fp'?T('fałszywy alarm'):c==='tp'?T('trafnie: wada'):c==='tn'?T('poprawnie OK'):T('błąd wywołania')}
function bindGalFilter(root){$$('.gal-filter [data-gf]',root).forEach(b=>b.onclick=()=>{const bar=b.parentElement,box=bar.nextElementSibling;$$('.thumb',box).forEach(t=>{t.hidden=b.dataset.gf==='wrong'&&!['fn','fp','err'].includes(t.dataset.cls)});$$('[data-gf]',bar).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));bar.dataset.mode=b.dataset.gf;if(box.dataset)box.dataset.mode=b.dataset.gf})}
// "More metrics" keeps its open state across redraws of the same result panel (key: team, view, sub view, panel id).
const moreKey=d=>{const c=d.closest('[id]');return c?`${S.team}|${S.view}|${S.sub[S.view]||''}|${c.id}`:null};
function bindMoreMetrics(){const M=X.moreOpen||(X.moreOpen={});
 document.addEventListener('toggle',e=>{const d=e.target;if(!(d instanceof Element)||!d.matches('details.more-metrics')||!d.isConnected)return;const k=moreKey(d);if(k)M[k]=d.open},true);
 // The lab's result panels live in #roomHost while a walk-in room is open: watch both containers.
 const R=[mainEl,$('#roomHost')],mo=new MutationObserver(()=>R.forEach(r=>$$('details.more-metrics',r).forEach(d=>{const k=moreKey(d);if(k&&Object.hasOwn(M,k)&&d.open!==M[k])d.open=M[k]})));R.forEach(r=>mo.observe(r,{childList:true,subtree:true}))}
function essentials(head,rest,{cls='grid3',extra='',recap='',open=false}={}){return`<div class="headline">${statGrid(head,'grid2')}</div>${recap}<details class="more-metrics"${open?' open':''}><summary>${T('Więcej miar')}</summary>${rest.length?statGrid(rest,cls):''}${extra}</details>`}
const KIND=k=>k==='maint'?{pos:T('minuta awarii'),found:T('Minuty awarii z alarmem'),tp:T('min. z alarmem'),fn:T('min. bez alarmu')}:{pos:T('wada'),found:T('Wykryte wady'),tp:T('wykryta wada'),fn:T('przeoczona wada')};
// Maintenance headline counts whole breakdowns; the per-minute recall moves into the folded metrics.
function kpis(m,{kind='vision',recap='',open=false,more=[]}={}){const K=KIND(kind),ev=kind==='maint'&&isObj(m.ev)?m.ev:null,rec=[pct(m.r),`${K.found} (${gl('recall',T('czułość','recall'))})`,'stone'];
 return essentials([ev?[`${ev.caught} ${T('z')} ${ev.total}`,T('Wykryte awarie (całe awarie, nie minuty)'),ev.caught<ev.total?'red':'green']:rec,[Math.round(m.fp),ev?T('Fałszywe alarmy (minuty)'):T('Fałszywe alarmy'),Math.round(m.fp)?'red':'green']],[...(ev?[rec]:[]),[pct(m.p),gl('precision',T('Precyzja')),'yellow'],[pct(f0(m.f1)),gl('f1','F1'),'green'],[pct(m.acc),gl('accuracy',T('Trafność')),'ink'],...more],{recap,open,extra:confMat(m,kind)})}
// Maintenance speaks in minutes and alarms, without the TP/FN codes, plus one plain line on precision and F1.
function confMat(m,kind='vision'){const K=KIND(kind),r=x=>Math.round(x);if(kind==='maint')return`<p class="hint" id="mtMoreHelp">${T('Precyzja: jaka część minut z alarmem przypadła na awarię. F1: jedna liczba łącząca obie miary – 100% znaczy, że każda minuta awarii miała alarm i nie było ani jednego fałszywego. Trafność: odsetek wszystkich minut ocenionych dobrze (przy rzadkich awariach zawsze wysoka, więc mało mówi).')}</p><div class="tscroll conf"><table><thead><tr><th></th><th>${T('Alarm')}</th><th>${T('Bez alarmu')}</th></tr></thead><tbody><tr><td>${T('Minuty awarii')}</td><td><span class="edu-chip tone-green">${r(m.tp)} ${T('trafnie')}</span></td><td><span class="edu-chip tone-red">${r(m.fn)} ${T('przegapione')}</span></td></tr><tr><td>${T('Minuty bez awarii')}</td><td><span class="edu-chip tone-red">${r(m.fp)} ${T('fałszywie')}</span></td><td><span class="edu-chip tone-green">${r(m.tn)} ${T('spokój, słusznie')}</span></td></tr></tbody></table></div>`;return`<div class="tscroll conf"><table><thead><tr><th></th><th>${T('System mówi')}: ${K.pos}</th><th>${T('System mówi: OK')}</th></tr></thead><tbody><tr><td>${T('Naprawdę')}: ${K.pos}</td><td><span class="edu-chip tone-green">${r(m.tp)} ${K.tp} (TP)</span></td><td><span class="edu-chip tone-red">${r(m.fn)} ${K.fn} (FN)</span></td></tr><tr><td>${T('Naprawdę: OK')}</td><td><span class="edu-chip tone-red">${r(m.fp)} ${T('fałszywy alarm')} (FP)</span></td><td><span class="edu-chip tone-green">${r(m.tn)} ${T('poprawnie OK')} (TN)</span></td></tr></tbody></table></div>`}
// Plain-language recap under every result (spec 4.5). Text only: shown on screen and spoken by announce(), never sent to a model or exported.
const RSET=s=>({val:T('zestawu ćwiczeniowego'),test:T('testu końcowego'),dev:T('zestawu ćwiczeniowego'),demo:T('przykładowej partii')})[s]||s;
function recapText(track,m,{set,n}={}){const z=RSET(set),N=x=>num(Math.round(x),0);
 if(track==='vision'){const tp=Math.round(m.tp),fp=Math.round(m.fp),fn=Math.round(m.fn),al=tp+fp,plA=(tp?`${N(tp)} ${plural(tp,['puszka była naprawdę wadliwa','puszki były naprawdę wadliwe','puszek było naprawdę wadliwych'],[])}`:'')+(tp&&fp?', ':'')+(fp?(tp?`${N(fp)} ${plural(fp,['była dobra (fałszywy alarm)','były dobre (fałszywe alarmy)','było dobrych (fałszywe alarmy)'],[])}`:al===1?'puszka była dobra (fałszywy alarm)':al===2?'oba dotyczyły dobrych puszek (fałszywe alarmy)':'wszystkie dotyczyły dobrych puszek (fałszywe alarmy)'):', fałszywych alarmów nie było'),enA=(tp?`${N(tp)} ${tp===1?'can was':'cans were'} truly defective`:'')+(tp&&fp?', ':'')+(fp?(tp?`${N(fp)} ${fp===1?'was good (a false alarm)':'were good (false alarms)'}`:al===1?'the can was good (a false alarm)':al===2?'both were good cans (false alarms)':'all were good cans (false alarms)'):', and there were no false alarms');return T(`Na ${N(n)} ${plural(n,['puszce','puszkach','puszkach'],[])} ${z} system ${al?`podniósł alarm ${al===1?'raz':`${N(al)} ${plural(al,['raz','razy','razy'],[])}`}: ${plA}.`:'nie podniósł żadnego alarmu.'} ${fn?`Przegapił ${N(fn)} ${plural(fn,['wadliwą puszkę','wadliwe puszki','wadliwych puszek'],[])} – przy takim ustawieniu ${fn===1?'trafiłaby':'trafiłyby'} do sklepu.`:'Nie przegapił żadnej wadliwej puszki.'}`,`On the ${N(n)} ${n===1?'can':'cans'} ${z} the system ${al?`raised an alarm ${al===1?'once':`${N(al)} times`}: ${enA}.`:'raised no alarm.'} ${fn?`It missed ${N(fn)} defective ${fn===1?'can':'cans'} – at this setting ${fn===1?'it':'they'} would have gone to the shop.`:'It did not miss any defective can.'}`)}
 if(track==='maint'){const w=set==='test'?T('W oknie testowym'):T(`W oknie ${z}`,`In the window ${z}`),e=isObj(m.ev)?m.ev:null,dl=e&&e.delay!=null?num(e.delay,1):'';
  const evPl=e?(e.caught?`system wykrył ${e.caught} z ${e.total} ${plural(e.total,['awarii','awarii','awarii'],[])}; pierwszy alarm pojawiał się średnio ${dl} min po początku awarii, czyli już w jej trakcie, nie przed nią. `:`system nie wykrył żadnej z ${e.total} awarii. `):'',
   evEn=e?(e.caught?`the system detected ${e.caught} of ${e.total} ${e.total===1?'breakdown':'breakdowns'}; the first alarm came on average ${dl} min after the breakdown started, so during it, not before it. `:`the system detected none of the ${e.total} breakdowns. `):'';
  return T(`${w}: ${evPl}Minuty z alarmem: ${m.tp} ${plural(m.tp,['trafna','trafne','trafnych'],[])} i ${m.fp} ${plural(m.fp,['fałszywa','fałszywe','fałszywych'],[])}; ${m.fn} ${plural(m.fn,['minuta','minuty','minut'],[])} awarii bez alarmu. Fałszywy alarm zatrzymuje linię; przegapienie awarii retortu to ryzyko partii.`,`${w}: ${evEn}Alarm minutes: ${m.tp} true and ${m.fp} false; ${m.fn} failure ${m.fn===1?'minute':'minutes'} without an alarm. A false alarm stops the line; missing a retort failure puts a batch at risk.`)}
 if(track==='rag')return T(`Z ${m.n} pytań ${z} system odpowiedział poprawnie na ${m.ok}. W ${m.ref} ${plural(m.ref,['przypadku','przypadkach','przypadkach'],[])} poprawnie odmówił odpowiedzi poza zakresem dokumentów. Jeśli odmawia za rzadko, pracownik może dostać zmyśloną procedurę.`,`Of the ${m.n} questions ${z} the system answered ${m.ok} correctly. In ${m.ref} ${m.ref===1?'case':'cases'} it correctly refused to answer outside the scope of the documents. If it refuses too rarely, an employee may get a made-up procedure.`);
 if(track==='complaints')return T(`Z ${m.n} zgłoszeń ${z} kategoria zgadzała się w ${m.ok} ${plural(m.ok,['przypadku','przypadkach','przypadkach'],[])}. Zgłoszenia o bezpieczeństwie żywności: wykryto ${m.hit} z ${m.total}. Pomyłka w tej grupie oznacza ryzyko dla klienta i dla firmy.`,`Of the ${m.n} complaints ${z} the category matched in ${m.ok} ${m.ok===1?'case':'cases'}. Food-safety complaints: ${m.hit} of ${m.total} detected. A mistake in this group means a risk for the customer and for the company.`);
 if(track==='forecast'){const h=m.h||n;return T(`Na ${h} ukrytych miesiącach model myli się średnio o ${pct(m.mape)}${typeof m.mae==='number'?` (${num(m.mae)} tys. szt. na miesiąc)`:''}.`,`Over the ${h} hidden months the model is off by ${pct(m.mape)} on average${typeof m.mae==='number'?` (${num(m.mae)}k units a month)`:''}.`)}
 return''}
const plainRecap=(track,m,ctx)=>`<p class="recap" data-track="${track}" data-set="${ctx.set}">${esc(recapText(track,m,ctx))}</p>`;
const MOBILE_MQ=matchMedia('(max-width:768px)');
function chart(series,o){const narrow=!o.w&&MOBILE_MQ.matches,W=o.w||(narrow?380:720),H=o.h||250,fs=narrow?12:10,m={l:42,r:14,t:10,b:24};
 const sx=x=>m.l+(x-o.x0)/(o.x1-o.x0)*(W-m.l-m.r),sy=y=>H-m.b-(Math.min(Math.max(y,o.y0),o.y1)-o.y0)/(o.y1-o.y0)*(H-m.t-m.b);
 let s=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(o.label||'')}" font-family="'IBM Plex Sans',sans-serif">`;
 for(let i=0;i<=4;i++){const v=o.y0+(o.y1-o.y0)*i/4;s+=`<line x1="${m.l}" x2="${W-m.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="${LINE}"/><text x="${m.l-6}" y="${sy(v)+4}" text-anchor="end" font-size="${fs}" fill="${INK3}">${Math.round(v*10)/10}</text>`}
 (o.bands||[]).forEach(b=>s+=`<rect x="${sx(b[0])}" y="${m.t}" width="${Math.max(2,sx(b[1])-sx(b[0]))}" height="${H-m.t-m.b}" fill="${b[2]}"/>`);
 (o.vlines||[]).forEach(v=>s+=`<line x1="${sx(v)}" x2="${sx(v)}" y1="${m.t}" y2="${H-m.b}" stroke="${INK}" stroke-dasharray="4 3"/>`);
 if(o.hline!=null)s+=`<line x1="${m.l}" x2="${W-m.r}" y1="${sy(o.hline)}" y2="${sy(o.hline)}" stroke="${RED}" stroke-dasharray="5 3"/>`;
 series.forEach(se=>{if(se.pts.length)s+=`<polyline fill="none" stroke="${se.c}" stroke-width="${se.w||1.6}" ${se.d?`stroke-dasharray="${se.d}"`:''} points="${se.pts.map(p=>sx(p[0]).toFixed(1)+','+sy(p[1]).toFixed(1)).join(' ')}"/>`;if(se.tips)se.pts.forEach((p,i)=>{const t=se.tips[i];if(t)s+=`<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="5" fill="${se.c}" fill-opacity="0" class="ch-pt"><title>${esc(t)}</title></circle>`})});
 (o.dots||[]).forEach(d=>s+=`<circle cx="${sx(d[0]).toFixed(1)}" cy="${sy(d[1]).toFixed(1)}" r="2.8" fill="${d[2]}">${d[3]?`<title>${esc(d[3])}</title>`:''}</circle>`);
 const xl=o.xlab||[];xl.forEach(([x,l],i)=>s+=`<text x="${sx(x)}" y="${H-6}" font-size="${fs}" text-anchor="${i===0?'start':i===xl.length-1?'end':'middle'}" fill="${INK3}">${esc(l)}</text>`);
 return s+'</svg>'}
const swatch=(c,d,w=2.4)=>`<svg class="sw" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line x1="1" x2="29" y1="5" y2="5" stroke="${c}" stroke-width="${w}" ${d?`stroke-dasharray="${d}"`:''}/></svg>`;
const legend=a=>`<div class="legend">${a.map(([c,l,d])=>`<span>${swatch(c,d)}${esc(l)}</span>`).join('')}</div>`;
function slider(id,label,min,max,step,val,show){return`<div class="ctl"><label for="${id}">${label}: <output id="${id}V" for="${id}">${show}</output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`}
function sectionBand(icon,title,body,tone='ink'){return`<section class="sec"><div class="wrap"><div class="sec-head">${badge(icon,tone,1)}<h2>${title}</h2></div>${body}</div></section>`}
function card(icon,title,body,o={}){return`<div class="card ${o.cls||''}"><div class="card-head"><span class="tile-h">${badge(icon,o.tone||'ink')}<h${o.h||3}>${title}</h${o.h||3}></span>${o.meta||''}</div><div class="card-body ${o.flush?'flush':''}">${body}</div>${o.foot?`<div class="card-foot">${o.foot}</div>`:''}</div>`}
const pageHead=(title,lead,extra='')=>`<header class="page-head"><h1 class="app-title">${title}</h1>${lead?`<p class="edu-lead">${lead}</p>`:''}${extra}</header>`;

// ─── ZIP (store-only, no dependency) ───
const CRC_TABLE=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC_TABLE[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zipStore(files){const enc=new TextEncoder(),parts=[],central=[];let off=0;
 const u16=v=>[v&255,v>>>8&255],u32=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
 files.forEach(f=>{const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);
  const common=[...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(33),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)];
  const lh=new Uint8Array([...u32(0x04034b50),...common]);parts.push(lh,name,data);
  central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...common,...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),name);off+=lh.length+name.length+data.length});
 const cs=central.reduce((a,b)=>a+b.length,0);
 return new Blob([...parts,...central,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cs),...u32(off),...u16(0)])],{type:'application/zip'})}
const visExt=u=>/^data:image\/jpe?g/i.test(u)?'jpg':/^data:image\/webp/i.test(u)?'webp':'png';
const dataUrlBytes=u=>Uint8Array.from(atob(u.split(',')[1]),c=>c.charCodeAt(0));

