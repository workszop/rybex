// js/lab-vision.js - Lab: vision, and vision with a model.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── Lab: vision ───
function visRules(){const L=lab().vision;
 $('#proto').innerHTML=visMethodBar()+visionAssetStatusHtml()+card('sliders-horizontal',T('Wasza kontrola'),`<p>${T('Ustawiacie jedną <b>czułość</b>. Wyżej = system łapie więcej wad, ale odrzuca też dobre puszki (fałszywe alarmy); niżej = spokojniej, ale więcej wad przechodzi. Wartość startową dobrano na zbiorze <b>treningowym</b> (90 zdjęć), a wy dostrajacie ją, patrząc na <b>walidacyjny</b> (60). Zbiór <b>testowy</b> (60) służy tylko do oceny końcowej.')}</p>
 <div class="mt">${slider('vd',T('Czułość (wyżej = łapie więcej wad)'),0,100,1,visSens(),visSens())}</div>
 <details class="engine-block mt"><summary>${T('Silnik: co dokładnie mierzy kontrola')}</summary><p class="hint" id="visThrOut" style="margin:8px 0 0"></p></details>
 <div class="row mt"><button type="button" class="btn-ghost" id="cal">${ic('rotate-ccw')}${T('Kalibrujcie ponownie na zbiorze treningowym')}</button><button type="button" class="btn-ink" id="visRv" data-reveal="vision" aria-describedby="gateMsg" data-blocked="${revealGate('vision')}"></button><span id="visViews" class="edu-chip tone-stone"></span></div>${GATE_P}<p class="hint" id="visLock"></p><div id="visRes" class="mt"></div>${saveBar('vision')}`,{tone:'grape'});
 const out=$('#visRes');
 const update=()=>{const L=lab().vision,th=visTh(),rv=L.revealed,trm=visEval(VIS.train,th),vm=visEval(VIS.val,th),tm=visEval(VIS.test,th),cur=rv?tm:vm,set=rv?VIS.test:VIS.val,hv=visHumanEval(VIS.val);
  $('#vdV').textContent=visSens();const sd=$('#vd');sd.value=visSens();sd.disabled=rv;$('#cal').disabled=rv;const to=$('#visThrOut');if(to)to.textContent=T(`wgniecenie > ${num(th.d,1)}, przesunięcie > ${num(th.s,1)} px, kod < ${num(th.c,1)}`,`dent > ${num(th.d,1)}, shift > ${num(th.s,1)} px, code < ${num(th.c,1)}`);
  $('#visRv').innerHTML=rv?ic('eye-off')+T('Ukryjcie test końcowy i wróćcie do ćwiczeń'):ic('lock-open')+T('Odsłońcie test końcowy');
  $('#visViews').textContent=T(`Test końcowy oglądany: ${L.testViews}×`,`Final test viewed: ${L.testViews}×`);
  $('#visLock').textContent=rv?T('Parametry są zablokowane, gdy test jest widoczny. Każde kolejne odsłonięcie zostanie policzone i odnotowane w dzienniku.'):'';
  const types=['dent','label','code'].map(t=>{const s=set.filter(i=>i.type===t),h=s.filter(i=>visPred(i.f,th)).length;return[t,h,s.length]});
  const rc={set:rv?'test':'val',n:set.length};Object.assign(out.dataset,{set:rv?'test':'val',f1:cur.f1,valF1:vm.f1,testVisible:rv,testViews:L.testViews});
  out.innerHTML=`<div class="grid2"><div><h4 style="margin:0 0 8px">${rv?T('Wynik na zbiorze testowym'):T('Wynik na zbiorze walidacyjnym')}</h4>${kpis(cur,{recap:plainRecap('vision',cur,rc)})}<p class="hint mt">${T('Metoda odniesienia (kontrola wzrokowa) na walidacji: wykryte wady')} ${pct(hv.r)}, ${T('fałszywe alarmy')} ${Math.round(hv.fp)}.</p></div><div><h4 style="margin:0 0 8px">${T('Analiza błędów: ile wad każdego typu wykryto')}</h4><div class="tscroll"><table><thead><tr><th>${T('Typ wady')}</th><th class="num">${T('Wykryto')}</th></tr></thead><tbody>${types.map(t=>`<tr><td>${typeName(t[0])}</td><td class="num">${t[1]} / ${t[2]}</td></tr>`).join('')}</tbody></table></div></div></div>
  <h4 style="margin:18px 0 4px">${rv?T('Zdjęcia testowe'):T('Zdjęcia walidacyjne')}</h4><div class="keyrow">${visKey()}<span>${T('Kliknijcie zdjęcie, aby zobaczyć cechy i regułę.')}</span></div>
${(()=>{const o={fn:0,fp:1,tp:2,tn:3},l=set.map((i,n)=>{const p=visPred(i.f,th),c=p&&i.bad?'tp':p?'fp':i.bad?'fn':'tn';return{i,n,c}}).sort((a,b)=>o[a.c]-o[b.c]),w=l.filter(x=>x.c==='fn'||x.c==='fp').length;return`<div class="gal-filter" role="group" aria-label="${T('Co pokazać')}"><button type="button" class="chip" data-gf="wrong" aria-pressed="true">${ic('triangle-alert')}${T(`Pomyłki (${w})`,`Mistakes (${w})`)}</button><button type="button" class="chip" data-gf="all" aria-pressed="false">${T(`Pokaż wszystkie (${l.length})`,`Show all (${l.length})`)}</button></div><div class="gal" data-mode="wrong">${l.map(({i,n,c})=>`<button type="button" class="thumb ${c}"${c==='tn'||c==='tp'?' hidden':''} data-cls="${c}" data-i="${n}" aria-label="${esc(i.id)} · ${galWord(c)} · ${c.toUpperCase()}"><img src="${i.url}" alt=""><span>${galWord(c)}</span></button>`).join('')}</div>`})()}`;
  $$('.thumb',out).forEach(b=>b.onclick=()=>openInspector(rv?'test':'val',+b.dataset.i,false));
  bindGalFilter(out);
  announce(recapText('vision',cur,rc));renderChallenge('vision')};
 update();bindVisMethod();
 $('#vd').oninput=e=>{lab().vision.th={sens:+e.target.value,fk:VIS.featureSource};save();update()};
 $('#cal').onclick=()=>{lab().vision.th=null;save();update()};
 $('#visRv').onclick=()=>tryReveal('vision',lab().vision,()=>{update();icons($('#proto'));$('#visRv').focus()});
 $('#sv').onclick=()=>{const L=lab().vision,th=visTh(),vm=visEval(VIS.val,th),tm=L.revealed?visEval(VIS.test,th):null,hb=visHumanEval(tm?VIS.test:VIS.val),s=m=>({p:f0(m.p),r:f0(m.r),f1:f0(m.f1),tp:m.tp,fp:m.fp,fn:m.fn,tn:m.tn});logAdd('vision',{sens:visSens(),fk:VIS.featureSource,datasetKey:VIS.datasetKey},{val:s(vm),test:tm?s(tm):null},{m:tm?T('wykryte wady (test)'):T('wykryte wady (walidacja)'),v:f0((tm||vm).r),base:f0(hb.r),baseFp:Math.round(hb.fp),hi:true,test:!!tm})}}

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
