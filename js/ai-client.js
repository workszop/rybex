// js/ai-client.js - AI client: calls through the Worker, retries, cost, recorded replies.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── AI client ───
class AiError extends Error{constructor(kind,detail){super(kind);this.kind=kind;this.detail=detail||''}}
const AI_FATAL=new Set(['example','nocode','bad_code','budget','network','not_configured','no_embed','aborted']);
const usd=x=>'$'+num(x,x<1?4:2);
function hashStr(s){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^h1>>>16,2246822507)^Math.imul(h2^h2>>>13,3266489909);h2=Math.imul(h2^h2>>>16,2246822507)^Math.imul(h1^h1>>>13,3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36)}
// Models sometimes wrap JSON in code fences or add a sentence around it: take the outermost {...}.
function parseJsonLoose(t){if(typeof t!=='string')return null;const s=t.replace(/```(?:json)?/gi,''),a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<=a)return null;try{const o=JSON.parse(s.slice(a,b+1));return isObj(o)?o:null}catch(e){return null}}
const aiModel=k=>AI_MODELS[k]||AI_MODELS[S.ai.model]||AI_MODELS.deepseek;
const aiModelName=id=>(Object.values(AI_MODELS).find(m=>m.id===id)||{name:id}).name;
const aiErrText=k=>({example:T('W podglądzie przykładu model nie działa: nic nie zostanie wysłane ani doliczone do budżetu. Wróćcie do swojej pracy, aby uruchomić model.'),nocode:T('Wpiszcie kod zajęć, aby korzystać z modelu.'),bad_code:T('Nieprawidłowy kod zajęć.'),budget:T('Wyczerpano dzienny budżet na wywołania modelu. Nowych przebiegów modelu nie da się teraz uruchomić; zapisane wyniki zostają. Powiedzcie o tym prowadzącemu.'),network:T('Brak połączenia z serwerem modelu. Bez niego laboratorium pokazuje tylko nagrane odpowiedzi dla ustawień domyślnych, a dla tego przebiegu nagrania nie ma.'),not_configured:T('Serwer modelu nie jest jeszcze skonfigurowany (brak klucza API lub kodu zajęć).'),upstream:T('Dostawca modelu zwrócił błąd. Spróbujcie ponownie za chwilę.'),bad_request:T('Serwer odrzucił zapytanie (zbyt duże lub nieprawidłowe).'),parse:T('Model nie zwrócił poprawnego JSON.'),partial:T('Zbyt wiele wywołań nie powiodło się (zwykle limit zapytań u dostawcy). Przebieg nie został zapisany: spróbujcie ponownie za chwilę.'),no_embed:T('Serwer zajęć nie ma jeszcze funkcji zamiany tekstu na wektory (wymaga aktualizacji). Powiedzcie o tym prowadzącemu.'),aborted:T('Przerwano.'),timeout:T('Model nie odpowiedział w czasie. Spróbujcie ponownie.')})[k]||k;
// One shared load of replay.json: parallel calls in a batch all wait for the same fetch.
async function aiReplay(key){if(AIS.replay===undefined)AIS.replay=(async()=>{try{const r=await fetch('replay.json',{cache:'no-store'});if(r.ok){const o=await r.json();if(isObj(o))return o}}catch(e){}return null})();const rp=await AIS.replay;return rp&&isObj(rp[key])?rp[key]:null}
const aiRecordedJSON=()=>JSON.stringify(Object.fromEntries(AIS.rec));
function aiSetErr(k){AIS.state=k==='network'?'offline':k==='nocode'?'nocode':'error';AIS.err=k;AIS.replayed=false;renderAiState()}
function aiTally(u,j){AIS.calls++;AIS.inTok+=u.in;AIS.outTok+=u.out;AIS.cost+=u.paid;if(j&&isObj(j.rybex)){AIS.teamSpend=numOr(j.rybex.teamSpend,AIS.teamSpend);if(isObj(j.rybex.limits))AIS.limits=j.rybex.limits}renderAiStats()}
function aiResult(j,m,ms,key,json,replayed){const msg=j.choices&&j.choices[0]&&j.choices[0].message,text=msg&&typeof msg.content==='string'?msg.content:'',u=isObj(j.usage)?j.usage:{},cached=replayed||!!(isObj(j.rybex)&&j.rybex.cached),tin=numOr(u.prompt_tokens,0),tout=numOr(u.completion_tokens,0);
 const cost=numOr(u.cost,(tin*m.pin+tout*m.pout)/1e6);return{text,data:json?parseJsonLoose(text):null,usage:{in:tin,out:tout,cost,paid:cached?0:cost},ms,cached,replayed,model:m.id,key}}
// One model call. Resolves {text,data,usage:{in,out,cost},ms,cached,replayed,model}; rejects with AiError.
async function callModel({messages,maxTokens=300,json=true,signal,model}={}){if(S.example)throw new AiError('example');
 const m=aiModel(model),body={model:m.id,messages,max_tokens:maxTokens};if(json)body.response_format={type:'json_object'};
 const key=hashStr(JSON.stringify(body));
 if(!S.ai.code){aiSetErr('nocode');throw new AiError('nocode')}
 if(signal&&signal.aborted)throw new AiError('aborted');
 let timedOut=false;const ctl=new AbortController(),onAbort=()=>ctl.abort(),timer=setTimeout(()=>{timedOut=true;ctl.abort()},AIS.timeoutMs),t0=performance.now();
 if(signal)signal.addEventListener('abort',onAbort,{once:true});
 let r,j=null,stopped=()=>{if(signal&&signal.aborted)throw new AiError('aborted');if(timedOut)throw new AiError('timeout')};
 try{try{r=await fetch(AI_URL+'/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Class-Code':S.ai.code,'X-Team':String(S.team)},body:JSON.stringify(body),signal:ctl.signal})}
  catch(e){stopped();const rp=await aiReplay(key);if(rp){const out=aiResult(rp,m,0,key,json,true);aiTally(out.usage);if(!AIS.replayed){AIS.replayed=true;renderAiState()}return out}aiSetErr('network');throw new AiError('network')}
  // The timeout and the cancel button also cover reading the body, not only the wait for headers.
  try{j=await r.json()}catch(e){stopped()}}
 finally{clearTimeout(timer);if(signal)signal.removeEventListener('abort',onAbort)}
 if(!r.ok){const k=r.status===401?'bad_code':r.status===429?'budget':r.status===400?'bad_request':j&&j.error==='not_configured'?'not_configured':'upstream';if(k==='budget'&&j)AIS.teamSpend=numOr(j.teamSpend,AIS.teamSpend);if(AI_FATAL.has(k))aiSetErr(k);throw new AiError(k,j&&j.error)}
 if(!isObj(j)||!Array.isArray(j.choices))throw new AiError('upstream');
 const out=aiResult(j,m,Math.round(performance.now()-t0),key,json,false);AIS.rec.set(key,j);aiTally(out.usage,j);
 if(AIS.state!=='ready'||AIS.replayed){AIS.state='ready';AIS.err='';AIS.replayed=false;renderAiState()}
 return out}
// ─── Embeddings: texts to vectors (the knowledge assistant's search) ───
// The ready embedding model behind the class server: one fixed model and vector size (the Worker accepts no other). pin: USD per 1M tokens.
const AI_EMBED={id:'openai/text-embedding-3-small',name:'text-embedding-3-small',dim:256,pin:.02,batch:16};
// One embeddings call for up to AI_EMBED.batch texts. Resolves {vecs:[Float32Array],usage:{in,out:0,cost,paid},ms,cached,replayed,model,key};
// rejects with AiError exactly as callModel does (code, budget, network with the replay lookup, timeout, cancel).
async function embedTexts(texts,{signal}={}){if(S.example)throw new AiError('example');
 const m=AI_EMBED,body={model:m.id,input:texts,dimensions:m.dim},key=hashStr(JSON.stringify(body));
 if(!S.ai.code){aiSetErr('nocode');throw new AiError('nocode')}
 if(signal&&signal.aborted)throw new AiError('aborted');
 const read=(j,ms,replayed)=>{const rows=isObj(j)&&Array.isArray(j.data)?[...j.data].sort((a,b)=>(a.index||0)-(b.index||0)):[];
  if(rows.length!==texts.length||rows.some(r=>!isObj(r)||!Array.isArray(r.embedding)||r.embedding.length!==m.dim))throw new AiError('upstream','embedding_shape');
  const u=isObj(j.usage)?j.usage:{},cached=replayed||!!(isObj(j.rybex)&&j.rybex.cached),tin=numOr(u.prompt_tokens,0),cost=numOr(u.cost,tin*m.pin/1e6);
  return{vecs:rows.map(r=>Float32Array.from(r.embedding)),usage:{in:tin,out:0,cost,paid:cached?0:cost},ms,cached,replayed,model:m.id,key}};
 let timedOut=false;const ctl=new AbortController(),onAbort=()=>ctl.abort(),timer=setTimeout(()=>{timedOut=true;ctl.abort()},AIS.timeoutMs),t0=performance.now();
 if(signal)signal.addEventListener('abort',onAbort,{once:true});
 let r,j=null,stopped=()=>{if(signal&&signal.aborted)throw new AiError('aborted');if(timedOut)throw new AiError('timeout')};
 try{try{r=await fetch(AI_URL+'/embed',{method:'POST',headers:{'Content-Type':'application/json','X-Class-Code':S.ai.code,'X-Team':String(S.team)},body:JSON.stringify(body),signal:ctl.signal})}
  catch(e){stopped();const rp=await aiReplay(key);if(rp){const out=read(rp,0,true);aiTally(out.usage);if(!AIS.replayed){AIS.replayed=true;renderAiState()}return out}aiSetErr('network');throw new AiError('network')}
  try{j=await r.json()}catch(e){stopped()}}
 finally{clearTimeout(timer);if(signal)signal.removeEventListener('abort',onAbort)}
 // A Worker deployed before the embeddings endpoint existed answers 404: say that the class server needs an update.
 if(!r.ok){const k=r.status===401?'bad_code':r.status===429?'budget':r.status===404?'no_embed':r.status===400?'bad_request':j&&j.error==='not_configured'?'not_configured':'upstream';if(k==='budget'&&j)AIS.teamSpend=numOr(j.teamSpend,AIS.teamSpend);if(AI_FATAL.has(k))aiSetErr(k);throw new AiError(k,j&&j.error)}
 const out=read(j,Math.round(performance.now()-t0),false);AIS.rec.set(key,j);aiTally(out.usage,j);
 if(AIS.state!=='ready'||AIS.replayed){AIS.state='ready';AIS.err='';AIS.replayed=false;renderAiState()}
 return out}
// Run fn over items with limited concurrency. A fatal error (code, budget, network, cancel) stops the batch and rejects;
// an upstream error or a timeout is retried once and then counted as a failed item.
async function runBatch(items,fn,{concurrency=AI_CONCURRENCY,onProgress,signal}={}){const res=new Array(items.length);let next=0,done=0,fatal=null;
 const worker=async()=>{while(next<items.length&&!fatal&&!(signal&&signal.aborted)){const i=next++;let k=null;try{res[i]={ok:true,value:await fn(items[i],i)}}catch(e){k=e instanceof AiError?e.kind:'parse'}
  if((k==='upstream'||k==='timeout')&&!(signal&&signal.aborted)){await new Promise(r=>setTimeout(r,AI_RETRY_MS));try{res[i]={ok:true,value:await fn(items[i],i)};k=null}catch(e){k=e instanceof AiError?e.kind:'parse'}}
  if(k){res[i]={ok:false,kind:k};if(AI_FATAL.has(k))fatal=k}done++;if(onProgress)onProgress(done,items.length)}};
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},worker));
 if(signal&&signal.aborted)throw new AiError('aborted');if(fatal)throw new AiError(fatal);return res}
// Usage of one call, as stored in team state and the log.
const aiUse=x=>({model:x.model,in:x.usage.in,out:x.usage.out,cost:x.usage.cost,paid:x.usage.paid,ms:x.ms,cached:x.cached,...(x.replayed?{replayed:true}:{})});
// After one retry, failed calls are left out of the metrics; above AI_MAX_FAIL the run is discarded.
function aiCheckFailed(res){const f=res.filter(x=>!x.ok).length;if(f>res.length*AI_MAX_FAIL)throw new AiError('partial',String(f));return f}
const msText=ms=>ms==null?'–':`${num(ms/1000,2)} s`;
function aiSummary(uses){const v=uses.filter(Boolean),n=v.length;return{calls:n,inTok:v.reduce((a,x)=>a+x.in,0),outTok:v.reduce((a,x)=>a+x.out,0),cost:v.reduce((a,x)=>a+x.cost,0),paid:v.reduce((a,x)=>a+(x.paid==null?x.cost:x.paid),0),ms:(w=>w.length?Math.round(w.reduce((a,x)=>a+x.ms,0)/w.length):null)(v.filter(x=>!x.cached)),cached:v.filter(x=>x.cached).length,...(v.some(x=>x.replayed)?{replayed:v.filter(x=>x.replayed).length}:{}),model:n?v[0].model:aiModel().id}}
const aiSumText=s=>`${aiModelName(s.model)} · ${cnt(s.calls,'call')} · ${num(s.inTok,0)} + ${cnt(s.outTok,'token',num(s.outTok,0))} · ${usd(s.cost)}${s.paid!=null&&s.paid<s.cost-1e-12?` (${T('zapłacono teraz')} ${usd(s.paid)})`:''} · ${T('śr. czas')} ${msText(s.ms)}${s.cached-(s.replayed||0)?` · ${s.cached-(s.replayed||0)} ${T('z pamięci podręcznej (koszt i czas liczone wg pierwszego wywołania, bez opłaty teraz)')}`:''}${s.replayed?` · ${T('nagrane odpowiedzi')}: ${s.replayed} (${T('bez opłaty')})`:''}`;
function aiAbort(){if(AIS.run){AIS.run.abort();AIS.run=null}}
async function aiCheck(){if(S.example)return;const code=S.ai.code;AIS.checked=true;if(!code){aiSetErr('nocode');return}
 AIS.state='busy';AIS.err='';renderAiState();
 try{const r=await fetch(AI_URL+'/status',{headers:{'X-Class-Code':code,'X-Team':String(S.team)}});let j=null;try{j=await r.json()}catch(e){}
  if(r.status===401||(j&&j.error==='bad_code'))aiSetErr('bad_code');else if(!r.ok)aiSetErr(j&&j.error==='not_configured'?'not_configured':'upstream');
  else if(!isObj(j))aiSetErr('upstream');else{AIS.state='ready';AIS.teamSpend=numOr(j.teamSpend,null);AIS.totalSpend=numOr(j.totalSpend,null);AIS.limits=isObj(j.limits)?j.limits:null;renderAiState();renderAiStats()}}
 catch(e){aiSetErr('network')}}
function aiBar(){const opts=Object.entries(AI_MODELS).map(([k,m])=>`<option value="${k}" ${S.ai.model===k?'selected':''}>${m.name}</option>`).join(''),prices=Object.values(AI_MODELS).map(m=>`${m.name} – $${num(m.pin,3)} / $${num(m.pout,2)}`).join('; ');
 // Plain lead first; API, tokens and dollar prices are folded under "Dla zaawansowanych" (persona walk, round 2).
 return`<div class="ai-slot" id="aiBar" data-ai-state="${AIS.state}" data-ai-error="${AIS.err}">${card('cpu',T('Model językowy (jak czat) przez serwer zajęć'),`<p class="ai-lead"><b>${T('Koszt pokrywa prowadzący – nic nie zepsujecie.')}</b> ${T('Wpiszcie kod zajęć od prowadzącego i naciśnijcie „Połącz”. Limit na zespół jest ustawiony z góry. Gdy serwer zajęć jest niedostępny, laboratorium pokazuje tylko nagrane odpowiedzi dla ustawień domyślnych.')}</p>
 <div class="grid3 mt ai-grid"><div class="field"><label for="aiCode">${T('Kod zajęć')}</label><input id="aiCode" class="input" type="text" autocomplete="off" spellcheck="false" value="${esc(S.ai.code)}"${S.example?' disabled':''}></div><div class="field"><label for="aiModel">${T('Model')}</label><select id="aiModel" class="input"${S.example?' disabled':''}>${opts}</select></div><div class="field"><button type="button" class="btn-ink" id="aiConnect"${S.example?' disabled':''}>${ic('plug')}${T('Połącz')}</button></div></div>
 <p class="mt" id="aiStatus" role="status"></p><details class="ai-adv mt" id="aiAdv"><summary>${T('Dla zaawansowanych: API, tokeny i koszt')}</summary><p>${T('Wywołania idą przez serwer zajęć (API): klucz API nie trafia do przeglądarki. Każda odpowiedź pokazuje liczbę tokenów (kawałków tekstu), koszt i czas.')}</p><p class="hint">${T('Cena za 1 mln tokenów (wejście / wyjście)')}: ${prices}</p><p class="hint ai-cost" id="aiSpend"></p></details>${S.trainer?`<p class="hint"><button type="button" class="linkbtn" id="aiRecord">${T('Dla prowadzącego: pobierz odpowiedzi z tej sesji jako replay.json')}</button></p>`:''}`,{tone:'ink',meta:`<span id="aiChip" class="edu-chip tone-stone"></span>`})}</div>`}
function renderAiState(){const b=$('#aiBar');if(!b)return;b.dataset.aiState=AIS.state;b.dataset.aiError=AIS.err;const chip=$('#aiChip'),st=$('#aiStatus');
 const L={nocode:[T('brak kodu'),'stone'],idle:[T('niesprawdzone'),'stone'],busy:[T('łączenie…'),'yellow'],ready:[T('połączono'),'green'],error:[T('błąd','error'),'red'],offline:['offline','red']}[AIS.state]||['','stone'];
 chip.textContent=L[0];chip.className='edu-chip tone-'+L[1];
 // A stale "type the class code" toast goes once the connection works.
 if(AIS.state==='ready'&&!toastEl.hidden){const tm=$('span',toastEl);if(tm&&[aiErrText('nocode'),aiErrText('bad_code')].some(x=>tm.textContent.startsWith(x)))hideToast()}st.textContent=S.example?aiErrText('example'):AIS.replayed?T('Serwer modelu jest niedostępny – pokazujemy nagrane odpowiedzi dla ustawień domyślnych.'):AIS.err?aiErrText(AIS.err):AIS.state==='ready'?(AIS.limits&&['team','total'].some(k=>AIS[k+'Spend']!=null&&typeof AIS.limits[k]==='number'&&AIS[k+'Spend']>=AIS.limits[k])?aiErrText('budget'):T('Połączono. Możecie uruchomić model – koszt pokrywa prowadzący.')):AIS.state==='nocode'?aiErrText('nocode'):'';
 if(X.aiHook)X.aiHook()}
function renderAiStats(){const el=$('#aiSpend');if(!el)return;const lim=AIS.limits&&isFinite(AIS.limits.team)?` ${T('z limitu')} ${usd(AIS.limits.team)}`:'';
 el.textContent=`${AIS.teamSpend!=null?`${T('Zespół dziś')}: ${usd(AIS.teamSpend)}${lim} · `:''}${T('w tej sesji')}: ${cnt(AIS.calls,'call')}, ${num(AIS.inTok,0)} + ${cnt(AIS.outTok,'token',num(AIS.outTok,0))}, ${usd(AIS.cost)}`}
function bindAiBar(){const c=$('#aiCode');if(!c)return;
 c.oninput=e=>{S.ai.code=e.target.value.trim();save();AIS.checked=false;if(!S.ai.code)aiSetErr('nocode');else if(AIS.state==='nocode'||AIS.err==='bad_code'){AIS.state='idle';AIS.err='';renderAiState()}};
 c.onkeydown=e=>{if(e.key==='Enter')aiCheck()};
 $('#aiConnect').onclick=()=>aiCheck();
 const rec=$('#aiRecord');if(rec)rec.onclick=()=>{if(!AIS.rec.size){toast(T('Brak nagranych odpowiedzi: najpierw uruchomcie model.'));return}dl('replay.json',aiRecordedJSON(),'application/json');toast(T(`Pobrano ${cnt(AIS.rec.size,'answer')}. Umieść plik obok aplikacji: zadziała, gdy serwer modelu będzie niedostępny.`,`Downloaded ${AIS.rec.size} answers. Put the file next to the app: it is used when the model server is unreachable.`))};
 $('#aiModel').onchange=e=>{if(AI_MODELS[e.target.value]){S.ai.model=e.target.value;save();if(X.aiHook)X.aiHook()}};
 renderAiState();renderAiStats();if(S.ai.code&&!AIS.checked)aiCheck()}
// Progress + cancel strip for a batch run. Returns {signal, progress(done,total), end()}.
const aiRunBox=id=>`<div class="ai-run" id="${id}" hidden aria-live="polite"><div class="row"><progress max="1" value="0"></progress><span class="edu-small" data-t></span><button type="button" class="btn-ghost btn-sm" data-cancel>${ic('square')}${T('Przerwij')}</button></div></div>`;
function aiStart(id,total,label){aiAbort();const box=$('#'+id),ctl=new AbortController(),c0=AIS.cost;AIS.run=ctl;
 const upd=(d,n)=>{if(!box.isConnected)return;const pr=$('progress',box);pr.max=n;pr.value=d;$('[data-t]',box).textContent=`${label}: ${d}/${n} · ${usd(AIS.cost-c0)}`};
 box.hidden=false;upd(0,total);$('[data-cancel]',box).onclick=()=>ctl.abort();icons(box);
 return{signal:ctl.signal,progress:upd,end:()=>{if(AIS.run===ctl)AIS.run=null;if(box.isConnected)box.hidden=true;if(X.renderPending)setTimeout(()=>{if(AIS.run||!X.renderPending)return;X.renderPending=false;if(X.storagePending){X.storagePending=false;try{S.teams=normTeams((readStore()||{}).teams)}catch(e){}}render()},0)}}}
function aiFailToast(e){if(!(e instanceof AiError)||e.kind==='aborted')return;toast(aiErrText(e.kind));if(e.kind==='nocode'||e.kind==='bad_code'){const c=$('#aiCode');if(c&&!c.disabled){c.scrollIntoView({block:'center'});c.focus({preventScroll:true})}}}

