// js/prompt-versions.js - Prompt versions (the complaints lab: L has prompts, active, draft) and the lab-step wrapper.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── Prompt versions (L has prompts, active, draft) ───
const promptActive=L=>L.prompts.find(x=>x.id===L.active)||L.prompts[0];
const promptVer=L=>promptActive(L).text===L.draft?L.active:L.active+'*';
const verOpts=L=>L.prompts.map(x=>`<option value="${x.id}" ${x.id===L.active?'selected':''}>${x.id}</option>`).join('');
function promptSaveVer(L){const id='v'+(Math.max(0,...L.prompts.map(x=>+x.id.slice(1)))+1);L.prompts.push({id,text:L.draft});L.active=id;return id}
function promptRestore(L,ver){const v=String(ver||'').replace('*','');if(ver&&!String(ver).endsWith('*')&&L.prompts.some(x=>x.id===v)){L.active=v;L.draft=L.prompts.find(x=>x.id===v).text}}
const labStepsSync=()=>{if(typeof renderLabSteps==='function')renderLabSteps(S.sub.lab)};
// A numbered lab step (3 build, 4 experiment, 5 result): the wrapper the page and the room stations can address.
const labStep=(s,html)=>`<div class="lab-step mt" data-lab-step="${s}">${html}</div>`;
const HIST_HINT=()=>T('To wasz zapis kolejnych prób. Zmieńcie jedną rzecz naraz i zobaczcie, co się poprawiło.');
