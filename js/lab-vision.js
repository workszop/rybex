// js/lab-vision.js - Lab: vision with a model (the default instruction, answer parsing, example photos).
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── Lab: vision with a model ───
const VIS_SYS=()=>T(`Jesteś systemem kontroli jakości na linii produkcyjnej konserw Rybex. Dostajesz zdjęcie puszki z boku: szary korpus, niebieska etykieta z białym paskiem i żółtą elipsą, na dole nadrukowany kod partii ${STORY().lot}.
Możliwe wady:
- dent: wgniecenie, widoczne jako rozmyta ciemna plama na korpusie nad etykietą;
- label: etykieta przesunięta w górę lub w dół względem normalnej pozycji;
- code: kod partii zamazany jasnymi plamami lub nieczytelny.
Mała ciemna kropka brudu nie jest wadą. Jeśli nie widzisz wady, odpowiedz "ok".
Zwróć wyłącznie JSON: {"defect": "ok" | "dent" | "label" | "code", "reason": "jedno krótkie zdanie"}`,`You are the quality-control system on the Rybex canning line. You get a side photo of a can: grey body, a blue label with a white stripe and a yellow ellipse, and the printed batch code ${STORY().lot} at the bottom.
Possible defects:
- dent: a dent, visible as a blurred dark patch on the body above the label;
- label: the label is shifted up or down from its normal position;
- code: the batch code is smudged with light patches or unreadable.
A small dark dirt dot is not a defect. If you see no defect, answer "ok".
Return JSON only: {"defect": "ok" | "dent" | "label" | "code", "reason": "one short sentence"}`);
const VIS_TYPES=['ok','dent','label','code'],VIS_IMG_TOKENS=171;
const VIS_SYN=[['ok',['none','brak','no defect','bez wad','correct','good']],['dent',['dent','wgniec','dark patch']],['label',['label','etykiet','shift','przesun']],['code',['code','kod','smudg','zamaz','batch','partii']]];
// Map the model's defect answer to a class; null = unusable answer (counted as "ok", i.e. a miss).
function normDefect(v){if(typeof v!=='string')return null;const s=v.trim().toLowerCase();if(VIS_TYPES.includes(s))return s;for(const[k,ws]of VIS_SYN)if(ws.some(w=>s.includes(w)))return k;return null}
// Always return a data URL. Photographic items are preloaded and upscaled before a run;
// the fallback redraw keeps the original synchronous behaviour when no asset is available.
function visBig(it){if(it.big&&/^data:image\//.test(it.big))return it.big;if(it.source==='photo'&&/^data:image\//.test(it.url))return it.url;const a=document.createElement('canvas');a.width=160;a.height=200;drawCan(a,it.seed,it.type);const b=document.createElement('canvas');b.width=320;b.height=400;b.getContext('2d').drawImage(a,0,0,320,400);it.big=b.toDataURL('image/jpeg',.9);return it.big}
function visExamples(n){const k=n/4,out=[];for(let i=0;i<k;i++)VIS_TYPES.forEach(t=>{const x=VIS.train.filter(y=>y.type===t)[i];if(x)out.push(x)});return out}
