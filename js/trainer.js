// js/trainer.js - View: trainer (?trainer=1).
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── View: trainer (?trainer=1) ───
// The room's progress without a backend: the eight local slots of this browser and team files imported from the
// participants' laptops (kept in memory only, never written to a slot). No test-set score is shown; the class code never appears.
// The in-app measures of spec 7.2 for the team passed in; never reads team().
function teamSummary(t){const k=t.track,ps=pathState(t),tl=k?testLabOf(t,k):null,Q=QUIZZES(),
  fr=Object.values(t.quizzes).flatMap(z=>Object.values(z.first)),right=fr.filter(Boolean).length;
 return{name:t.name.trim(),track:k,steps:ps.doneCount,stepsOf:ps.steps.length,
  experiments:k?expOf(t,k):0,testViews:tl?tl.testViews:null,finalSaved:tl?finalSaved(t,k):null,quizFirst:fr.length?right/fr.length:null,quizRight:right,quizAnswered:fr.length,
  quizDone:Object.keys(Q).filter(q=>quizDone(t,q)).length,quizOf:Object.keys(Q).length,risks:riskCount(t),risksOf:RISK_SCENARIOS().length,
  decisions:goLiveCount(t),decisionsOf:GO_LIVE_DECISIONS(t).length,noteCount:t.log.filter(l=>typeof l.note==='string'&&l.note.trim()).length,newsRead:!!t.site.newsRead,intranetOpened:!!t.site.intranetOpened,contactSent:!!t.site.contactSent}}
// Column key, header, cell text; booleans carry data-v. Shared by the tables and the CSV.
// csv: counts read as text "3 z 9" (Excel turns 3/9 into a date).
function trCols(csv){const yn=v=>v==null?'–':v?T('tak'):T('nie'),of=(a,b)=>csv?T(`${a} z ${b}`,`${a} of ${b}`):`${a}/${b}`;return[
 ['track',T('Zadanie'),s=>s.track?trackName(s.track):'–'],['steps',T('Kroki ścieżki'),s=>of(s.steps,s.stepsOf)],
 ['experiments',T('Eksperymenty'),s=>String(s.experiments)],
 ['testViews',T('Odsłony testu'),s=>s.testViews==null?'–':String(s.testViews)],['finalSaved',T('Wynik testu zapisany'),s=>yn(s.finalSaved),1],
 ['quizFirst',T('Quizy: dobrze za 1. razem'),s=>s.quizFirst==null?'–':`${Math.round(s.quizFirst*100)}% (${of(s.quizRight,s.quizAnswered)})`],
 ['quizDone',T('Quizy ukończone'),s=>of(s.quizDone,s.quizOf)],['risks',T('Karty ryzyk'),s=>of(s.risks,s.risksOf)],
 ['decisions',T('Decyzje wdrożeniowe'),s=>of(s.decisions,s.decisionsOf)],['noteCount',T('Notatki'),s=>String(s.noteCount)],
 ['newsRead',T('Aktualność przeczytana'),s=>yn(s.newsRead),1],['intranetOpened',T('Intranet otwarty'),s=>yn(s.intranetOpened),1],['contactSent',T('Formularz kontaktowy wysłany'),s=>yn(s.contactSent),1]]}
// Rows: [attributes, first cell, summary]. The slots read S.teams directly, so the example copy is never listed.
const trSlotRows=()=>Array.from({length:TEAM_COUNT},(_,i)=>{const n=i+1,t=Object.hasOwn(S.teams,n)?S.teams[n]:defaultTeam(),s=teamSummary(t);return[{slot:n},`${n}. ${s.name||T('(bez nazwy)')}`,s]});
const trFileRows=()=>(X.trFiles||[]).map(f=>{const s=teamSummary(f.team);return[{file:f.file},`${s.name||T('(bez nazwy)')} – ${f.file}`,s]});
function trTable(id,first,rows,empty){const C=trCols();
 return`<div class="tscroll"><table id="${id}"><thead><tr><th scope="col">${first}</th>${C.map(c=>`<th scope="col">${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(([a,h,s])=>`<tr ${Object.entries(a).map(([k,v])=>`data-${k}="${esc(String(v))}"`).join(' ')}><td>${esc(h)}</td>${C.map(c=>`<td data-col="${c[0]}"${c[3]?` data-v="${s[c[0]]}"`:''}>${esc(c[2](s))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length?'':`<p class="hint" id="${id}Empty">${empty}</p>`}`}
// A cell that a spreadsheet would read as a formula (= + - @ tab CR first) gets a leading apostrophe and quotes.
function trCSV(){const C=trCols(true),q=v=>{const f=/^[=+\-@\t\r]/.test(v);if(f)v="'"+v;return f||/[;"\n\r]/.test(v)?`"${v.replace(/"/g,'""')}"`:v},line=a=>a.map(x=>q(String(x))).join(';'),
  part=(title,first,rows)=>[line([title]),line([first,...C.map(c=>c[1])]),...rows.map(([,h,s])=>line([h,...C.map(c=>c[2](s))]))];
 return'﻿'+[...part(T('Lokalne sloty'),T('Zespół'),trSlotRows()),'',...part(T('Wczytane pliki'),T('Zespół – plik'),trFileRows())].join('\r\n')+'\r\n'}
// X.trRes keeps what happened (counts, skipped names and reasons); trMsg() words it in the current language.
const TR_MAX=5*1024*1024;
function trMsg(){const r=X.trRes;if(!r)return'';if(r.cleared)return T('Lista wyczyszczona.');
 const why={json:T('nieprawidłowy JSON'),app:T('to nie plik zespołu z tej aplikacji'),read:T('nie udało się odczytać pliku'),big:T('plik większy niż 5 MB')};
 return`${T(`Wczytano plików: ${r.n}.`,`Files loaded: ${r.n}.`)}${r.bad.length?' '+T('Pominięto')+': '+r.bad.map(([n,w])=>`${n} (${why[w]})`).join(', ')+'.':''}`}
async function trImport(files){const bad=[];let n=0;X.trFiles=X.trFiles||[];
 for(const f of files){let txt,o;if(f.size>TR_MAX){bad.push([f.name,'big']);continue}
  try{txt=await f.text()}catch(e){bad.push([f.name,'read']);continue}
  try{o=JSON.parse(txt)}catch(e){bad.push([f.name,'json']);continue}
  if(!isObj(o)||o.app!==APP_ID||!isObj(o.data)){bad.push([f.name,'app']);continue}
  const row={file:f.name,team:normTeam(o.data)},i=X.trFiles.findIndex(x=>x.file===f.name);if(i>=0)X.trFiles[i]=row;else X.trFiles.push(row);n++}
 X.trRes={n,bad};trPaintFiles()}
// Updates the file table, the clear button and the status line in place: the file input keeps focus and the
// live region announces the new text.
function trPaintFiles(){if(S.view!=='trainer'||!$('#trFilesBox'))return;$('#trFilesBox').innerHTML=trTable('trFiles',T('Zespół – plik'),trFileRows(),T('Brak wczytanych plików.'));
 $('#trClear').disabled=!(X.trFiles||[]).length;$('#trStatus').textContent=trMsg();$('#trImport').focus()}
// Team slots saved in this browser (what "Clear all teams" would remove).
function storedTeamCount(){try{const x=readStore();return x&&isObj(x.teams)?Object.keys(x.teams).length:0}catch(e){return 0}}
// Trainer: removes all team slots from this browser after a confirmation; language, class code and model stay.
// One undo restores the exact stored state. Transient per-slot state (open panels) is dropped.
function trWipeAll(){toast(T('Usunąć pracę wszystkich zespołów (sloty 1–8) z tej przeglądarki? Zespoły, które nie pobrały pliku zespołu, stracą swoją pracę.'),{reason:'wipe',action:[T('Usuń wszystkie zespoły'),()=>guardRun(()=>{
  let raw=null,ok=true;try{raw=localStorage.getItem(STORE_KEY);const cur=raw?JSON.parse(raw):{};localStorage.setItem(STORE_KEY,JSON.stringify({...cur,team:1,teams:{}}))}catch(e){ok=false}
  if(!ok){toast(T('Nie udało się wyczyścić danych w tej przeglądarce. Nic nie zmieniono.'));return}
  S.teams={};S.team=1;badgeQ=[];['moreOpen','rc','ragLastMsgs','ragPending'].forEach(k=>delete X[k]);render();
  toast(T('Usunięto pracę wszystkich zespołów z tej przeglądarki.'),{reason:'wiped',action:[T('Cofnij'),()=>{try{if(raw)localStorage.setItem(STORE_KEY,raw);else localStorage.removeItem(STORE_KEY)}catch(e){return}
   const x=raw?JSON.parse(raw):{};S.teams=normTeams(x.teams);S.team=clampInt(x.team,1,TEAM_COUNT,1);render();announce(T('Cofnięto'))}]})})]})}
function vTrainer(){const fn=X.trFiles||[];
 mainEl.innerHTML=pageHead(T('Tryb prowadzącego'),'',`<p class="edu-lead" id="trIntro">${T('Tryb prowadzącego: wczytaj pliki zespołów, żeby zobaczyć, ile eksperymentów zapisał każdy zespół, ile razy oglądano test i czy wynik testu końcowego jest w dzienniku. Wyników zespołów nie zestawiamy na forum grupy.')}</p>`)
  +`<section class="sec"><h2 class="sr-only">${T('Postęp zespołów')}</h2><div class="wrap">`+card('users',T('Zespoły na tej przeglądarce (sloty 1–8)'),trTable('trSlots',T('Zespół'),trSlotRows(),''),{tone:'blue',foot:`<p class="hint" style="margin:0">${T('Po zajęciach: najpierw niech zespoły pobiorą pliki zespołu, potem wyczyść sloty dla następnej grupy.')}</p><button type="button" class="btn-ghost btn-sm" id="trWipe"${storedTeamCount()?'':' disabled'}>${ic('trash-2')}${T('Wyczyść wszystkie zespoły')}</button>`})
  +`<div class="mt">${card('upload',T('Wczytane pliki zespołów'),`<p class="edu-small">${T('Wybierz kilka plików JSON naraz. Pliki zostają tylko w pamięci tej karty: nie trafiają do żadnego slotu i znikają po zamknięciu strony. Ten sam plik wczytany ponownie zastępuje swój wiersz.')}</p>
 <div class="field mt"><label for="trImport">${T('Pliki zespołów (JSON)')}</label><input type="file" id="trImport" class="input" accept="application/json,.json" multiple></div>
 <p class="hint" id="trStatus" aria-live="polite">${esc(trMsg())}</p><div class="mt" id="trFilesBox">${trTable('trFiles',T('Zespół – plik'),trFileRows(),T('Brak wczytanych plików.'))}</div>`,{tone:'yellow',foot:`<button type="button" class="btn-ghost btn-sm" id="trClear"${fn.length?'':' disabled'}>${ic('trash-2')}${T('Wyczyść listę')}</button>`})}</div>`
  +`<div class="mt">${card('download',T('Eksport'),`<p class="edu-small">${T('Plik CSV z obiema tabelami (średniki, kodowanie UTF-8) otworzy się w Excelu. Nie zawiera kodu zajęć ani notatek zespołów.')}</p>`,{tone:'green',foot:`<button type="button" class="btn" id="trCsv">${ic('download')}${T('Pobierz CSV')}</button>`})}</div></div></section>`;
 $('#trImport').onchange=e=>{const f=[...e.target.files];e.target.value='';if(f.length)trImport(f)};
 $('#trClear').onclick=()=>{X.trFiles=[];X.trRes={cleared:true};trPaintFiles()};
 $('#trCsv').onclick=()=>dl('rybex_trainer.csv',trCSV(),'text/csv;charset=utf-8');
 $('#trWipe').onclick=trWipeAll;
 icons(mainEl)}
