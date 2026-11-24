// js/state.js - State: the team state object S, its defaults, normalisation and storage.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── State ───
// Complaints and the knowledge assistant are built with the language model only (method/gen stay in the state as 'llm' for the code that reads them).
// vision.fit / fc.fit / mt.fit: the settings signature of the last training (visSig, fcSig, mtSig), null = not trained yet.
const defaultLab=()=>({vision:{testViews:0,revealed:false,n:VIS_DEF.n,rounds:VIS_DEF.rounds,bright:1,detail:1,thr:VIS_DEF.thr,fit:null},rag:{docs:DOCS.map(d=>d.id),size:40,overlap:0,k:3,min:.3,ins:null,fit:null,msgs:[],testViews:0,revealed:false,gen:'llm',judge:false,mrun:null},compl:{kw:{...KW},safety:SAFETY_KW,testViews:0,revealed:false,sel:0,method:'llm',prompts:[],active:'v1',draft:null,shots:0,runs:[],rsel:'',curve:null},fc:{p:0,h:6,trend:1,season:1,fit:null},mt:{thr:4,win:1,f:{temp_c:1,vibration_mm_s:1,pressure_bar:0},fit:null}});
const defaultTeam=()=>({name:'',track:null,checks:{},notes:{},arch:{sel:{},infra:'hybrid',decisions:{}},log:[],lab:defaultLab(),goal:'',onboardedAt:'',seen:{testSave:true},site:{newsRead:false,contactSent:false,intranetOpened:false},inbox:[],quizzes:{},challenges:{},risks:{},badges:[]});
let S={lang:'pl',team:1,view:'home',sub:{demos:'life',lab:'vision',rybex:'home'},teams:{},ai:{code:'',model:'deepseek'},trainer:false,example:false,rooms:true};
const AIS={state:'nocode',err:'',checked:false,calls:0,inTok:0,outTok:0,cost:0,teamSpend:null,limits:null,rec:new Map(),replay:undefined,run:null,timeoutMs:AI_TIMEOUT_MS};
// T(pl): the Polish text is the key, English comes from i18n/en.js (window.I18N_EN, fetched only for English readers, see needEn()); T(pl,en): both inline,
// for texts with ${} parts or a Polish text that needs more than one English one. Until the dictionary has arrived an English reader sees the Polish text.
const T=(pl,en)=>S.lang==='pl'?pl:en!==undefined?en:(window.I18N_EN&&window.I18N_EN[pl])||pl,langIx=()=>S.lang==='pl'?0:1;
// Published 320×400 WebP copies (≈3 MB: per photo the lowest WebP quality that keeps its label-shift bucket and its dent and code features within 1 ‰ and 0.25 of the JPEG's, measured with the app's own extractor; the JPEGs are in git history); the full-size PNG renders are not shipped.
const VISION_ASSET_DIR='assets/vision-generated/web/',VISION_SPLITS=['train','val','test'],VISION_SPLIT_COUNTS={train:90,val:60,test:60},VISION_ASSET_TOTAL=210;
const VIS={featureSource:'synthetic',initialized:false,loading:false,queued:false,readyPromise:null,status:'idle',error:'',fallbackReason:'',manifestVersion:null,manifestRejected:0,photoCount:0,fallbackCount:VISION_ASSET_TOTAL,expectedPhotoCount:VISION_ASSET_TOTAL,datasetKey:'synthetic-baseline-v1',photoHashes:[]};
const TOK_SAMPLE={pl:`Puszka szprota w oleju, partia ${LOT} została wstrzymana.`,en:`A can of sprats in oil, batch ${LOT}, has been put on hold.`};
const X={life:0,tokTxt:TOK_SAMPLE.pl,tokIn:'1',tokOut:'1',tokCtx:2000,tokAns:300,tokCalls:10000,ragStep:-1,testPct:20,leak:false,shuf:1,thr:.5,prev:5,ragTimer:null};
let FSEL='project_description.md',toastTimer=null,liveTimer=null,saveFailed=false;

function isObj(o){return !!o&&typeof o==='object'&&!Array.isArray(o)}
function numOr(v,d){return typeof v==='number'&&isFinite(v)?v:d}
function clampNum(v,lo,hi,d){return Math.min(hi,Math.max(lo,numOr(v,d)))}
function clampInt(v,lo,hi,d){return Math.round(clampNum(v,lo,hi,d))}
function cleanMsg(m){if(!isObj(m)||typeof m.q!=='string'||typeof m.a!=='string')return null;return{q:m.q,a:m.a,src:Array.isArray(m.src)?m.src.filter(isObj).map(x=>({doc:String(x.doc||''),par:String(x.par||'')})):[],sim:numOr(m.sim,0),refused:!!m.refused,lang:m.lang==='pl'||m.lang==='en'?m.lang:undefined,ai:cleanUse(m.ai),note:typeof m.note==='string'?m.note.slice(0,300):undefined}}
function cleanUse(u){if(!isObj(u))return undefined;return{model:String(u.model||''),in:clampNum(u.in,0,1e7,0),out:clampNum(u.out,0,1e7,0),cost:clampNum(u.cost,0,1e4,0),paid:clampNum(u.paid,0,1e4,clampNum(u.cost,0,1e4,0)),ms:clampNum(u.ms,0,1e7,0),cached:!!u.cached,...(u.replayed===true?{replayed:true}:{})}}
function cleanSum(u){if(!isObj(u))return null;return{model:String(u.model||''),calls:clampInt(u.calls,0,1e7,0),inTok:clampNum(u.inTok,0,1e9,0),outTok:clampNum(u.outTok,0,1e9,0),cost:clampNum(u.cost,0,1e4,0),paid:clampNum(u.paid,0,1e4,clampNum(u.cost,0,1e4,0)),ms:u.ms==null?null:clampNum(u.ms,0,1e7,0),cached:clampInt(u.cached,0,1e7,0),...(typeof u.replayed==='number'&&isFinite(u.replayed)&&u.replayed>0?{replayed:clampInt(u.replayed,0,clampInt(u.cached,0,1e7,0),0)}:{})}}
function cleanComplRun(o){if(!isObj(o)||!Array.isArray(o.ids)||!Array.isArray(o.preds)||o.ids.length!==o.preds.length)return null;return{id:String(o.id||'').slice(0,20),ts:String(o.ts||''),ver:String(o.ver||'').slice(0,12),model:String(o.model||''),shots:SHOTS.includes(o.shots)?o.shots:0,set:['dev','dev16','test'].includes(o.set)?o.set:'dev',n:o.ids.length,failed:clampInt(o.failed,0,60,0),acc:clampNum(o.acc,0,1,0),macro:clampNum(o.macro,0,1,0),safety:clampNum(o.safety,0,1,0),safetyFalse:clampInt(o.safetyFalse,0,99,0),sum:cleanSum(o.sum)||cleanSum({}),ids:o.ids.map(i=>clampInt(i,1,60,1)),preds:o.preds.map(x=>isObj(x)?{c:CK.includes(x.c)?x.c:'other',h:!!x.h,r:typeof x.r==='string'?x.r.slice(0,800):'',bad:!!x.bad}:{c:'other',h:false,r:'',bad:true})}}
function cleanCurve(o){if(!isObj(o)||!Array.isArray(o.points))return null;return{model:String(o.model||''),ver:String(o.ver||'').slice(0,12),cost:clampNum(o.cost,0,1e4,0),points:o.points.filter(isObj).slice(0,SHOTS.length).map(x=>({shots:SHOTS.includes(x.shots)?x.shots:0,acc:clampNum(x.acc,0,1,0),macro:clampNum(x.macro,0,1,0),safety:clampNum(x.safety,0,1,0),cost:clampNum(x.cost,0,1e4,0)}))}}
// Question types of the knowledge-assistant set; runs saved before the types existed have none
const RAG_TYPES=['direct','para','multi','version','context','oos'];
function cleanRagRun(o){if(!isObj(o)||!Array.isArray(o.rows)||!isObj(o.res)||!isObj(o.sum))return null;const R=o.res;return{sig:String(o.sig||''),base:String(o.base||'').slice(0,40),...(isObj(o.emb)?{emb:{calls:clampInt(o.emb.calls,0,1e6,0),tok:clampNum(o.emb.tok,0,1e9,0),cost:clampNum(o.emb.cost,0,1e4,0)}}:{}),set:o.set==='test'?'test':'dev',judge:!!o.judge,sum:cleanSum(o.sum),judgeN:o.judgeN==null?null:clampInt(o.judgeN,0,99,0),failed:clampInt(o.failed,0,99,0),agree:o.agree==null?null:clampNum(o.agree,0,1,0),
 res:{hit:clampInt(R.hit,0,99,0),ok:clampInt(R.ok,0,99,0),ref:clampInt(R.ref,0,99,0),n:clampInt(R.n,0,99,0),nOos:clampInt(R.nOos,0,99,0),prec:clampNum(R.prec,0,1,0),...(isObj(R.byType)?{byType:Object.fromEntries(Object.keys(R.byType).filter(t=>RAG_TYPES.includes(t)&&isObj(R.byType[t])).map(t=>[t,Object.fromEntries(['n','ok'].map(k=>[k,clampInt(R.byType[t][k],0,99,0)]))]))}:{})},
 rows:o.rows.slice(0,40).filter(isObj).map(r=>({q:String(r.q||''),doc:String(r.doc||''),...(RAG_TYPES.includes(r.type)?{type:r.type}:{}),oos:!!r.oos,a:String(r.a||'').slice(0,600),good:!!r.good,refused:!!r.refused,err:!!r.err,src:Array.isArray(r.src)?r.src.filter(isObj).map(x=>({doc:String(x.doc||''),par:String(x.par||'')})):[],judge:isObj(r.judge)?{correct:!!r.judge.correct,grounded:!!r.judge.grounded,reason:String(r.judge.reason||'').slice(0,200)}:null,ret:Array.isArray(r.ret)?r.ret.filter(isObj).slice(0,8).map(x=>({i:clampInt(x.i,0,1e5,0),d:String(x.d||'').slice(0,20),p:String(x.p||'').slice(0,8),s:clampNum(x.s,-1,1,0),u:!!x.u})):[]}))}}
// Baseline entries of older team files (base:true) are dropped: the labs no longer have a baseline.
function cleanLog(l){if(!isObj(l)||l.base===true)return null;const o={id:String(l.id||Math.random().toString(36).slice(2)),ts:String(l.ts||''),track:String(l.track||''),note:String(l.note||'').slice(0,1000),testViews:clampInt(l.testViews,0,1e6,0)};if(typeof l.text==='string')o.text=l.text;if(isObj(l.cfg))o.cfg=l.cfg;if(isObj(l.res))o.res=l.res;return o}
// Copies the entries of a plain object whose key is a short string and whose value passes keep (returns the stored value or undefined).
function cleanMap(o,keep,keyOk=k=>k.length<=40){const r={};if(isObj(o))for(const k in o){if(k==='__proto__'||!keyOk(k))continue;const v=keep(o[k]);if(v!==undefined)r[k]=v}return r}
function cleanPrompts(x){return Array.isArray(x)?x.filter(p=>isObj(p)&&typeof p.text==='string'&&/^v\d{1,3}$/.test(p.id)).slice(0,30).map(p=>({id:p.id,text:p.text.slice(0,8000)})):[]}
function cleanQuiz(q){if(!isObj(q))return undefined;return{answers:cleanMap(q.answers,v=>Number.isInteger(v)&&v>=0&&v<=99?v:undefined),first:cleanMap(q.first,v=>typeof v==='boolean'?v:undefined),doneAt:typeof q.doneAt==='string'?q.doneAt.slice(0,40):''}}
function cleanInbox(x){return isObj(x)&&typeof x.text==='string'&&Object.hasOwn(CAT,x.cat)&&Number.isInteger(x.product)&&x.product>=0&&x.product<PRODUCTS.length?{id:String(x.id||'').slice(0,40),ts:String(x.ts||'').slice(0,40),product:x.product,cat:x.cat,text:x.text.slice(0,2000)}:null}
// The first n entries of a plain object (team files are capped so a hand-edited file cannot grow without bound).
const capKeys=(o,n)=>Object.fromEntries(Object.entries(o).slice(0,n));
function normTeam(t){const d=defaultTeam();if(!isObj(t))return d;
 d.name=typeof t.name==='string'?t.name.slice(0,120):'';d.track=LAB_KEYS.includes(t.track)?t.track:null;
 if(isObj(t.checks))for(const k in t.checks)d.checks[k]=!!t.checks[k];
 if(isObj(t.notes))for(const k in t.notes)d.notes[k]=String(t.notes[k]).slice(0,4000);
 if(isObj(t.arch)){const known=new Set(LANES().flatMap(l=>l[2].map(o=>o[0])));if(isObj(t.arch.sel))for(const k in t.arch.sel)if(known.has(k))d.arch.sel[k]=!!t.arch.sel[k];if(INFRA.includes(t.arch.infra))d.arch.infra=t.arch.infra;d.arch.decisions=cleanMap(t.arch.decisions,v=>typeof v==='string'&&v.length<=20?v:undefined)}
 d.goal=typeof t.goal==='string'?t.goal.slice(0,300):'';d.onboardedAt=typeof t.onboardedAt==='string'?t.onboardedAt.slice(0,40):'';
 // seen: 49 keys plus the step-7 marker, so the cap never drops the marker.
 const sn=cleanMap(t.seen,v=>typeof v==='boolean'?v:undefined);d.seen=capKeys(Object.fromEntries(Object.entries(sn).filter(e=>e[0]!=='testSave'&&!e[0].startsWith('baseRun.'))),49);if(sn.testSave===true)d.seen.testSave=true;if(isObj(t.site))for(const k in d.site)d.site[k]=t.site[k]===true;
 if(Array.isArray(t.inbox))d.inbox=t.inbox.map(cleanInbox).filter(Boolean).slice(-20);
 d.quizzes=cleanMap(t.quizzes,cleanQuiz,k=>DEMO_KEYS.includes(k)||k==='risk');d.challenges=capKeys(cleanMap(t.challenges,v=>v==='done'?v:undefined),50);
 d.risks=capKeys(cleanMap(t.risks,v=>Number.isInteger(v)&&v>=0&&v<=9?v:undefined),50);if(Array.isArray(t.badges))d.badges=[...new Set(t.badges.filter(b=>typeof b==='string'&&b.length<=40))].slice(0,30);
 if(Array.isArray(t.log))d.log=t.log.map(cleanLog).filter(Boolean);
 // Step 7 needs a saved test result; only a log that already holds an entry saved after a test view keeps the older allowance.
 if(!d.seen.testSave&&!d.log.some(l=>l.testViews>0))d.seen.testSave=true;
 const L=isObj(t.lab)?t.lab:{},v=isObj(L.vision)?L.vision:{},r=isObj(L.rag)?L.rag:{},c=isObj(L.compl)?L.compl:{},f=isObj(L.fc)?L.fc:{},m=isObj(L.mt)?L.mt:{};
 // Vision: the training settings. Files from before the trained model (prompts, mruns, vshots, th) keep only the test views: the model starts untrained on the default settings.
 const fit=x=>typeof x==='string'&&x.length<=80?x:null;
 d.lab.vision.testViews=clampInt(v.testViews,0,1e6,0);d.lab.vision.revealed=!!v.revealed;if(VIS_NS.includes(v.n))d.lab.vision.n=v.n;if(VIS_ROUNDS.includes(v.rounds))d.lab.vision.rounds=v.rounds;d.lab.vision.detail=v.detail===0?0:1;d.lab.vision.bright=v.bright===0&&d.lab.vision.detail?0:1;d.lab.vision.thr=Math.round(clampNum(v.thr,.1,.9,VIS_DEF.thr)*10)/10;d.lab.vision.fit=fit(v.fit);
 // Knowledge assistant: the settings of the base (documents, fragment size, overlap) and of the answer (k, threshold, instruction); `fit` is the signature of the last build, the vectors are never in the file.
 // Files from before the vector search ({k,chunk,min,...}, no `size`) keep the chat and the test views; search settings and the old run start from the defaults (the similarity scale changed).
 if('size'in r){const ids=DOCS.map(x=>x.id);if(Array.isArray(r.docs))d.lab.rag.docs=ids.filter(id=>r.docs.includes(id));d.lab.rag.size=Math.round(clampNum(r.size,20,120,40)/10)*10;d.lab.rag.overlap=clampInt(r.overlap,0,2,0);d.lab.rag.k=clampInt(r.k,1,6,3);d.lab.rag.min=Math.round(clampNum(r.min,0,.8,.3)*100)/100;d.lab.rag.ins=typeof r.ins==='string'&&r.ins.trim()?r.ins.trim().slice(0,2000):null;d.lab.rag.fit=fit(r.fit);d.lab.rag.mrun=cleanRagRun(r.mrun)}
 d.lab.rag.testViews=clampInt(r.testViews,0,1e6,0);d.lab.rag.revealed=!!r.revealed;d.lab.rag.judge=!!r.judge;if(Array.isArray(r.msgs))d.lab.rag.msgs=r.msgs.map(cleanMsg).filter(Boolean);
 if(isObj(c.kw))CK.forEach(k=>{if(typeof c.kw[k]==='string')d.lab.compl.kw[k]=c.kw[k]});
 if(typeof c.safety==='string')d.lab.compl.safety=c.safety;d.lab.compl.testViews=clampInt(c.testViews,0,1e6,0);d.lab.compl.revealed=!!c.revealed;d.lab.compl.sel=clampInt(c.sel,0,59,0);
 d.lab.compl.prompts=cleanPrompts(c.prompts);d.lab.compl.active=d.lab.compl.prompts.some(x=>x.id===c.active)?c.active:'v1';d.lab.compl.draft=typeof c.draft==='string'?c.draft.slice(0,8000):null;d.lab.compl.shots=SHOTS.includes(c.shots)?c.shots:0;d.lab.compl.runs=Array.isArray(c.runs)?c.runs.map(cleanComplRun).filter(Boolean).slice(-MAX_RUNS):[];d.lab.compl.rsel=typeof c.rsel==='string'?c.rsel.slice(0,20):'';d.lab.compl.curve=cleanCurve(c.curve);
 // Files from before the guided training have no trend/season/fit: both parts on, model not trained yet.
 d.lab.fc.p=[0,1,2,3].includes(f.p)?f.p:0;d.lab.fc.h=clampInt(f.h,3,9,6);d.lab.fc.trend=f.trend===0?0:1;d.lab.fc.season=f.season===0?0:1;d.lab.fc.fit=fit(f.fit);
 d.lab.mt.thr=clampNum(m.thr,1.5,10,4);d.lab.mt.win=clampInt(m.win,1,8,1);if(isObj(m.f)&&Object.keys(d.lab.mt.f).some(k=>m.f[k]))for(const k in d.lab.mt.f)if(k in m.f)d.lab.mt.f[k]=m.f[k]?1:0;d.lab.mt.fit=fit(m.fit);
 return d}
function readStore(){const raw=localStorage.getItem(STORE_KEY);return raw?JSON.parse(raw):null}
function normTeams(o){const r={};if(isObj(o))for(const k in o)r[k]=normTeam(o[k]);return r}
try{const x=readStore();if(isObj(x)){if(x.lang==='en'||x.lang==='pl')S.lang=x.lang;if(+x.team>=1&&+x.team<=TEAM_COUNT)S.team=+x.team;if(NAV.some(n=>n[0]===x.view)||x.view==='rybex')S.view=x.view;if(isObj(x.sub)){if(DEMO_KEYS.includes(x.sub.demos))S.sub.demos=x.sub.demos;if(LAB_KEYS.includes(x.sub.lab))S.sub.lab=x.sub.lab;if(RYBEX_PAGES.includes(x.sub.rybex))S.sub.rybex=x.sub.rybex}S.teams=normTeams(x.teams);if(isObj(x.ai)){if(typeof x.ai.code==='string')S.ai.code=x.ai.code.slice(0,80);if(AI_MODELS[x.ai.model])S.ai.model=x.ai.model}if(typeof x.rooms==='boolean')S.rooms=x.rooms;if(typeof x.fsel==='string'&&FILES().flatMap(g=>g.f).some(f=>f[0]===x.fsel))FSEL=x.fsel}}catch(e){}
if(S.ai.code)AIS.state='idle';
// While S.example is on, team() is the in-memory worked example (never stored); S.teams is not touched.
let exTeam=null,exFrom=null;
const team=()=>S.example&&exTeam?exTeam:S.teams[S.team]||(S.teams[S.team]=defaultTeam());
// Replaces the current team object (undo, restore): the example copy in example mode, else the team's slot.
function setTeam(t){if(S.example)exTeam=t;else S.teams[S.team]=t}
const lab=()=>team().lab;

