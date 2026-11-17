// js/main.js - Listeners and init: wires the page and starts the app.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── Listeners ───
$('#nav').addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(b)go(b.dataset.v)});
$('#teamSel').onchange=e=>{const v=+e.target.value;if(S.example){e.target.value=S.team;return}if(AIS.run)e.target.value=S.team;guardRun(()=>{S.team=v;badgeQ=[];save();render()})};
$('#tbToggle').onclick=()=>{const b=$('#teamBar'),on=b.classList.toggle('open');$('#tbToggle').setAttribute('aria-expanded',on);renderProg()};
MOBILE_MQ.addEventListener('change',()=>{if(!isTyping()&&!inspEl.open)softRender()});
$('#teamName').oninput=e=>{team().name=e.target.value;const on=$('#onboardName');if(on)on.value=e.target.value;save();renderTeamOptions();renderProg();const h=$('#main .app-title');if(S.view==='data'&&h)h.textContent=`${T('Folder zespołu')} – ${team().name||T('Zespół')+' '+S.team}`};
$('#teamExport').onclick=exportTeam;$('#teamImport').onclick=()=>$('#teamFile').click();
$('#teamFile').onchange=e=>{const f=e.target.files[0];if(f)importTeam(f);e.target.value=''};
$$('#langSeg button').forEach(b=>b.onclick=()=>guardRun(()=>{const l=b.dataset.l;(l==='en'?needEn():Promise.resolve()).then(()=>{S.lang=l;clearTimeout(liveTimer);liveBuf=[];liveEl.textContent='';if(S.example)exTeam=buildExample();save();render();const a=$(`#langSeg button[data-l=${S.lang}]`);if(a)a.focus()})}));
toastEl.addEventListener('mouseenter',()=>{clearTimeout(toastTimer);toastEl.dataset.paused='true'});toastEl.addEventListener('focusin',()=>{clearTimeout(toastTimer);toastEl.dataset.paused='true'});
toastEl.addEventListener('mouseleave',()=>{if(!toastEl.contains(document.activeElement)){toastEl.dataset.paused='false';armToast()}});toastEl.addEventListener('focusout',e=>{if(!toastEl.contains(e.relatedTarget)&&!toastEl.matches(':hover')){toastEl.dataset.paused='false';armToast()}});
inspEl.addEventListener('click',e=>{if(e.target===inspEl)inspEl.close()});
$('#skip').onclick=e=>{e.preventDefault();mainEl.focus()};
bindMoreMetrics();
addEventListener('hashchange',onHashChange);
addEventListener('load',()=>icons());
addEventListener('storage',e=>{if(e.key!==STORE_KEY||!e.newValue)return;if(AIS.run){X.storagePending=X.renderPending=true;return}try{const x=JSON.parse(e.newValue);S.teams=normTeams(x.teams)}catch(err){return}if(!isTyping()&&!inspEl.open)softRender();else renderProg()});
addEventListener('resize',setHdrH);addEventListener('resize',queueToastPlace);addEventListener('scroll',queueToastPlace,{passive:true});if(window.ResizeObserver)new ResizeObserver(queueToastPlace).observe(toastEl);
// The sticky bars change height without a resize (wrapping text, fonts, the case bar appearing): keep the offsets exact.
if(window.ResizeObserver){const ro=new ResizeObserver(()=>setHdrH());['.edu-header','#pathBar','#caseBar'].forEach(s=>{const e=$(s);if(e)ro.observe(e)})}
addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||inspEl.open)return;const a=e.target,tag=a.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||a.isContentEditable)return;const i=+e.key;if(i>=1&&i<=NAV.length){e.preventDefault();go(NAV[i-1][0])}});

// ─── Init ───
((S.lang==='en'||new URLSearchParams(location.search).has('i18n'))?needEn():Promise.resolve()).then(function init(){S.trainer=new URLSearchParams(location.search).get('trainer')==='1';document.body.dataset.trainer=String(S.trainer);const r=parseHash();if(r){S.view=r.v;routeSub(r);siteVisit()}else{try{history.replaceState(null,'',hashFor(S.view))}catch(e){location.hash=hashFor(S.view)}}
 normHash();render();
 const BRAND_FONTS=['400 1em Raleway','700 1em Raleway','400 1em "IBM Plex Sans"','600 1em "IBM Plex Sans"','400 1em "Roboto Mono"'];
 Promise.race([Promise.all(BRAND_FONTS.map(f=>document.fonts.load(f).catch(()=>null))),new Promise(res=>setTimeout(res,FONT_WAIT_MS))]).then(()=>document.documentElement.classList.add('app-ready'))});
