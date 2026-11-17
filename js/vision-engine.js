// js/vision-engine.js - Vision engine and the pixel features of the can photographs.
// A classic script: it shares one global scope with the other js/ files; the load order is in rybex-ai-workshop.html.
// ─── Vision engine ───
const visionItems=()=>[...VIS.train,...VIS.val,...VIS.test];
const visionPhotoStatus=()=>{
 if(VIS.loading)return T('Ładowanie fotografii…');
 if(VIS.photoCount===VIS.expectedPhotoCount)return T(`Obrazy wygenerowane: ${VIS.photoCount}/${VIS.expectedPhotoCount}. Klasy wad pochodzą z poleceń generowania i nie zostały zweryfikowane; wyniki oceny mogą być niewiarygodne.`,`Generated images: ${VIS.photoCount}/${VIS.expectedPhotoCount}. Defect classes come from generation prompts and have not been verified; evaluation results may be unreliable.`);
 if(VIS.photoCount)return T(`Fotografie: ${VIS.photoCount}/${VIS.expectedPhotoCount}; w miejsce pozostałych aplikacja wstawia obrazy syntetyczne.`,`Photographic images: ${VIS.photoCount}/${VIS.expectedPhotoCount}; the rest use the synthetic fallback.`);
 if(VIS.fallbackReason==='file')return T('Tryb file://: brak pliku assets/vision-generated/web/photos.js, więc używane są rysowane puszki. Zbudujcie go poleceniem node tools/vision-bundle.mjs albo uruchomcie aplikację przez HTTP.');
 return T('Fotografie są niedostępne; aplikacja używa obrazów syntetycznych.');
};
const visionFeatureDisclosure=()=>{
 if(VIS.featureSource==='photo')return T('Reguły mierzą te same zdjęcia, które widzicie (kopia 160×200 px, stałe kadrowanie kamery na linii): wgniecenie = ‰ pikseli metalu nad etykietą, które jasnością odstają od swojej kolumny; przesunięcie = odległość środka etykiety od wysokości wzorcowej (px); kod = energia krawędzi nadruku (rozmazany kod ma mniejszą).');
 if(VIS.photoCount)return T('Uwaga edukacyjna: reguły nadal używają cech bazowych obliczonych wcześniej z obrazu syntetycznego. Fotografia jest prawdziwym obrazem wejściowym, ale wynik reguł nie jest pomiarem cech tej fotografii.');
 return T('Reguły używają cech pikseli syntetycznego obrazu bazowego.');
};
const visionManifestWarning=()=>VIS.manifestRejected?T(`Odrzucone wpisy manifestu: ${VIS.manifestRejected}. Etykiety muszą zgadzać się z oryginalnym zbiorem, więc za odrzucone pozycje aplikacja wstawia obrazy syntetyczne.`,`${VIS.manifestRejected} manifest rows were rejected: labels must match the original dataset, so the app puts synthetic images in place of the rejected rows.`):'';
const visionStatusInner=()=>`<b>${visionPhotoStatus()}</b><br><span>${visionFeatureDisclosure()}</span>${visionManifestWarning()?`<br><span>${visionManifestWarning()}</span>`:''}`;
const visionAssetStatusHtml=()=>`<div id="visionAssetStatus" class="callout tone-yellow edu-block">${visionStatusInner()}</div>`;
// Loading state as data attributes (read by the tests and the recording tool) plus the visible status box.
function publishVisionContract(){
 Object.assign(document.body.dataset,{visionStatus:VIS.status,visionPhotos:VIS.photoCount,visionExpected:VIS.expectedPhotoCount,visionFallback:VIS.fallbackCount,visionManifestRejected:VIS.manifestRejected,visionDataset:VIS.datasetKey});
 document.documentElement.dataset.visionFeatures=VIS.featureSource;
 const el=$('#visionAssetStatus');if(el)el.innerHTML=visionStatusInner();
}
// Redraws a lab part while keeping what is being typed in the note field: its text, caret and focus.
function keepNote(draw){const e=$('#expNote'),v=e&&[e.value,e.selectionStart,e.selectionEnd,document.activeElement===e];draw();const n=$('#expNote');if(!v||!n)return;n.value=v[0];if(v[3]){n.focus({preventScroll:true});n.setSelectionRange(v[1],v[2])}}
function visionRefresh(){publishVisionContract();if(VIS.loading||AIS.run)return;if(S.view==='data'&&FSEL==='can_images/ (210)'){vData();icons(mainEl)}else if(S.view==='lab'&&S.sub.lab==='vision'&&$('#proto')){const fa=document.activeElement,had=!!fa&&fa!==document.body,fid=had?fa.id:null;keepNote(labVision);icons($('#proto'));if(X.room&&X.room.track==='vision'){renderDataViewer(TRACK_FILE.vision,X.room.data);icons(X.room.data);X.room.handle.setData(roomData('vision'))}const o=$('#baseOut');if(o&&!o.hidden)showBase('vision',true);
  // The photos arrived and the lab was redrawn: keep the keyboard focus where it was, never on BODY; the note keeps its text and caret.
  if(had&&(!document.activeElement||document.activeElement===document.body))(fid&&document.getElementById(fid)||mainEl).focus({preventScroll:true})}}
function dataUrlFromBlob(blob){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onerror=()=>reject(rd.error||new Error('file_read'));rd.onload=()=>resolve(String(rd.result));rd.readAsDataURL(blob)})}
// Draw an image at the 320×400 working size and return it as a data URL of the given type.
function scaledVisionDataUrl(url,type,q){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas');c.width=320;c.height=400;c.getContext('2d').drawImage(im,0,0,320,400);resolve(c.toDataURL(type,q))}catch(e){reject(e)}};im.onerror=()=>reject(new Error('image_decode'));im.src=url})}
// ─── Vision: pixel features of the photographs ───
// The line camera frames every can the same way, so the rules read fixed regions of a 160×200 copy:
// dent = ‰ of metal pixels above the label whose brightness stands out from their own column (crater shading);
// centre = label centre row (turned into a shift from the training median); code = horizontal edge energy of the print.
const PF_W=160,PF_H=200;
function photoFeatureRaw(px){const n=PF_W*PF_H,L=new Float32Array(n),blue=new Uint8Array(n);
 for(let i=0;i<n;i++){const r=px[i*4],g=px[i*4+1],b=px[i*4+2];L[i]=.299*r+.587*g+.114*b;blue[i]=b>r+25&&g>r+20&&b>55?1:0}
 let top=-1,bot=-1;for(let y=0;y<PF_H;y++){let k=0;for(let x=50;x<110;x++)k+=blue[y*PF_W+x];if(k/60>.4){if(top<0)top=y;bot=y}}
 if(top<0)top=bot=PF_H/2;
 let out=0,cnt=0;const y0=24,y1=Math.max(26,top-3);
 for(let x=45;x<115;x++){const col=[];for(let y=y0;y<y1;y++)col.push(L[y*PF_W+x]);const o=[...col].sort((a,b)=>a-b),h=o.length>>1,med=o.length%2?o[h]:(o[h-1]+o[h])/2;col.forEach(v=>{cnt++;if(Math.abs(v-med)>18)out++})}
 let e=0,m=0;for(let y=152;y<177;y++)for(let x=45;x<114;x++){const i=y*PF_W+x;m++;if(!blue[i]&&!blue[i+1])e+=Math.abs(L[i+1]-L[i])}
 return{dent:cnt?out/cnt*1000:0,center:(top+bot)/2,code:m?e/m:0}}
function photoPixels(url){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas');c.width=PF_W;c.height=PF_H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,PF_W,PF_H);res(x.getImageData(0,0,PF_W,PF_H).data)}catch(e){rej(e)}};im.onerror=()=>rej(new Error('image_decode'));im.src=url})}
// Slider ranges and calibrated thresholds follow the features currently in use.
function visRanges(){const all=VIS.train;VIS.rng={};['dent','shift','code'].forEach(k=>{const v=all.map(i=>i.f[k]);VIS.rng[k]=[Math.min(...v),Math.max(...v)]});VIS.calib=visCalib()}
// The rules switch to photo features only when every photo loaded, so one threshold scale covers all images.
function applyPhotoFeatures(){const all=visionItems(),ok=all.length>0&&all.every(i=>i.source==='photo'&&i.pf);
 if(!ok){all.forEach(i=>{if(i.synF)i.f=i.synF});VIS.featureSource='synthetic'}
 else{const cs=VIS.train.map(i=>i.pf.center).sort((a,b)=>a-b),ref=cs[cs.length>>1];all.forEach(i=>{if(!i.synF)i.synF=i.f;i.f={dent:i.pf.dent,shift:Math.abs(i.pf.center-ref),code:i.pf.code}});VIS.featureSource='photo'}
 visRanges()}
function invalidateVisionRuns(){let changed=false;Object.values(S.teams||{}).forEach(t=>{const L=t&&t.lab&&t.lab.vision;if(!L||!Array.isArray(L.mruns))return;const n=L.mruns.length;L.mruns=L.mruns.filter(r=>r&&r.datasetKey===VIS.datasetKey);if(L.mruns.length!==n){L.vsel='';changed=true}});if(changed)save()}
function finishVisionAssets(){
 VIS.loading=false;VIS.status='ready';VIS.fallbackCount=Math.max(0,VIS.expectedPhotoCount-VIS.photoCount);
 applyPhotoFeatures();
 VIS.photoHashes=visionItems().filter(i=>i.source==='photo').map(i=>`${i.id}:${i.photoHash||hashStr(i.url)}`).sort();
 VIS.datasetKey=VIS.photoCount?`vision-photo-v2:${hashStr(VIS.photoHashes.join('|'))}`:'synthetic-baseline-v1';
 invalidateVisionRuns();publishVisionContract();visionRefresh();
}
// file:// pages cannot fetch local files or read local images into a canvas, so there the photos come from
// photos.js (built by tools/vision-bundle.mjs) as data: URLs, the same bytes the WebP files give over HTTP.
function visionBundle(){const ok=b=>isObj(b)&&isObj(b.manifest)&&isObj(b.images)?b:null;if(ok(window.RYBEX_VISION_BUNDLE))return Promise.resolve(window.RYBEX_VISION_BUNDLE);return new Promise(res=>{const s=document.createElement('script');s.src=VISION_ASSET_DIR+'photos.js';s.onload=()=>res(ok(window.RYBEX_VISION_BUNDLE));s.onerror=()=>res(null);document.head.appendChild(s)})}
async function visionPhotoData(file,url,bundle){if(bundle){const d=bundle.images[file];return typeof d==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(d)?d:null}const r=await fetch(url);if(!r.ok)return null;const blob=await r.blob();return dataUrlFromBlob(/\.jpe?g$/i.test(file)?new Blob([blob],{type:'image/jpeg'}):blob)}
async function loadVisionAssets(){
 if(VIS.loading===false&&VIS.status!=='loading')return;
 const bundle=location.protocol==='file:'?await visionBundle():null;
 if(location.protocol==='file:'&&!bundle){VIS.fallbackReason='file';finishVisionAssets();return}
 try{
  let manifest;if(bundle)manifest=bundle.manifest;else{const mr=await fetch(VISION_ASSET_DIR+'manifest.json',{cache:'no-cache'});if(!mr.ok)throw new Error(`manifest_http_${mr.status}`);manifest=await mr.json()}
  if(!isObj(manifest)||manifest.version!==1||!Array.isArray(manifest.images))throw new Error('manifest_shape');VIS.manifestVersion=manifest.version;
  const index=new Map();VIS.manifestRejected=0;manifest.images.forEach(e=>{if(!isObj(e)||!VISION_SPLITS.includes(e.split)||typeof e.id!=='string'||!['ok','dent','label','code'].includes(e.type))return;const it=VIS[e.split]&&VIS[e.split].find(x=>x.id===e.id);if(!it)return;if(it.type!==e.type){VIS.manifestRejected++;return}const file=/^[A-Za-z0-9_-]+\.(png|jpe?g|webp)$/i.test(String(e.file||''))?String(e.file):`${it.id}.jpg`;index.set(it.id,{it,file})});
  const manifestIds=[...index.keys()].sort();if(manifestIds.length){VIS.datasetKey=`vision-photo-v2:manifest-${hashStr(manifestIds.join('|'))}`;publishVisionContract();if(S.view==='lab'&&S.sub.lab==='vision'&&!AIS.run){keepNote(labVision);icons($('#proto'))}}
 const entries=[...index.values()];let cursor=0;const worker=async()=>{while(cursor<entries.length){const {it,file}=entries[cursor++],url=VISION_ASSET_DIR+file;try{const fullData=await visionPhotoData(file,url,bundle);if(!fullData)continue;const jpg=/\.(jpe?g|webp)$/i.test(file),data=jpg?fullData:await scaledVisionDataUrl(fullData,'image/png');it.originalUrl=new URL(url,document.baseURI).href;it.url=data;it.source='photo';it.photoHash=hashStr(fullData);// Gallery, preview and ZIP keep the published JPEG or WebP as fetched (it.url); the copy sent to the model (it.big)
// is re-encoded at the same 320×400 working size with VIS_PAYLOAD_Q, which is what keeps the request small.
 try{it.big=await scaledVisionDataUrl(data,'image/jpeg',VIS_PAYLOAD_Q)}catch(e){it.big=data}
 try{it.pf=photoFeatureRaw(await photoPixels(data))}catch(e){it.pf=null}VIS.photoCount++;VIS.fallbackCount=Math.max(0,VIS.expectedPhotoCount-VIS.photoCount);publishVisionContract()}catch(e){/* Keep the original synthetic item for this missing photo. */}}};await Promise.all(Array.from({length:Math.min(6,Math.max(1,entries.length))},worker));
 }catch(e){VIS.error=e&&e.message||'manifest';VIS.fallbackReason=location.protocol==='file:'?'file':'manifest'}
 finishVisionAssets();
}
// Runs on the first visit to the vision lab or the image folder, not at startup: other pages need neither
// the 210 drawn fallback cans nor the photo download (about 5 MB).
function visInit(){if(VIS.initialized){publishVisionContract();return}const mk=(s0,n)=>{const r=rng(s0),a=[],nb=Math.round(n*.1),types=[...Array(nb).fill('dent'),...Array(nb).fill('label'),...Array(nb).fill('code'),...Array(n-3*nb).fill('ok')];for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[types[i],types[j]]=[types[j],types[i]]}for(let i=0;i<n;i++){const t=types[i],c=document.createElement('canvas');c.width=160;c.height=200;const f=drawCan(c,s0*1000+i,t);a.push({type:t,bad:t!=='ok',f,url:c.toDataURL(),seed:s0*1000+i,source:'synthetic',originalUrl:''})}return a};
 VIS.train=mk(7,90);VIS.val=mk(9,60);VIS.test=mk(8,60);
 VIS.train.forEach((x,i)=>x.id='train_'+String(i+1).padStart(3,'0'));VIS.val.forEach((x,i)=>x.id='val_'+String(i+1).padStart(3,'0'));VIS.test.forEach((x,i)=>x.id='test_'+String(i+1).padStart(3,'0'));
 visRanges();VIS.initialized=true;VIS.loading=true;VIS.status='loading';VIS.expectedPhotoCount=VISION_SPLITS.reduce((n,s)=>n+VIS[s].length,0);VIS.fallbackCount=VIS.expectedPhotoCount;publishVisionContract();VIS.readyPromise=loadVisionAssets();}
const visKey=()=>`<span><i class="tp"></i>TP – ${T('wada wykryta')}</span><span><i class="fn"></i>FN – ${T('wada przeoczona')}</span><span><i class="fp"></i>FP – ${T('fałszywy alarm')}</span><span><i></i>TN – ${T('poprawnie OK')}</span>`;
const visPred=(f,t)=>f.dent>t.d||f.shift>t.s||f.code<t.c;
function visEval(set,t){let tp=0,fp=0,fn=0,tn=0;set.forEach(i=>{const p=visPred(i.f,t);if(p&&i.bad)tp++;else if(p)fp++;else if(i.bad)fn++;else tn++});return prf(tp,fp,fn,tn)}
function visCalib(){const off={d:VIS.rng.dent[1],s:VIS.rng.shift[1],c:VIS.rng.code[0]},t={...off},map={d:'dent',s:'shift',c:'code'},own={d:'dent',s:'label',c:'code'};
 const cands=k=>{const v=[...new Set(VIS.train.map(i=>i.f[map[k]]))].sort((a,b)=>a-b),o=[];for(let i=0;i<v.length;i++)o.push(i?(v[i]+v[i-1])/2:v[0]-1e-6);o.push(v[v.length-1]+1e-6);return o};
 const search=(k,set,base)=>{let best=-Infinity,bv=base[k];cands(k).forEach(cv=>{const m=visEval(set,{...base,[k]:cv}),f=(m.tp/(m.tp+m.fn||1)+m.tn/(m.tn+m.fp||1))/2;if(f>best){best=f;bv=cv}});return bv};
 for(const k of['d','s','c'])t[k]=search(k,VIS.train.filter(i=>i.type==='ok'||i.type===own[k]),off);
 for(let pass=0;pass<3;pass++)for(const k of['d','s','c'])t[k]=search(k,VIS.train,t);
 return t}
// The participant's whole method is ONE "sensitivity" knob (0–100, 50 = the calibrated starting point):
// higher catches more (lower dent/label thresholds, higher code threshold), lower is calmer. The per-feature
// numbers stay in the engine room.
const visSens=()=>{const u=lab().vision.th,v=u&&u.fk===VIS.featureSource?u.sens:null;return typeof v==='number'?Math.min(100,Math.max(0,v)):50};
const visThFromSens=s=>{const c=VIS.calib,R=VIS.rng,q=(Math.min(100,Math.max(0,s))-50)/50;
 const dn=q>0?c.d-q*(c.d-R.dent[0]):c.d-q*(R.dent[1]-c.d);
 const sh=q>0?c.s-q*(c.s-R.shift[0]):c.s-q*(R.shift[1]-c.s);
 const cd=q>0?c.c+q*(R.code[1]-c.c):c.c+q*(c.c-R.code[0]);
 return{d:dn,s:sh,c:cd}};
// The baseline is a person's visual check: no knobs, it flags only the clear defects (a loosened operating point).
const visHumanTh=()=>{const c=VIS.calib,R=VIS.rng,to=(v,span)=>v+0.2*span;return{d:to(c.d,R.dent[1]-c.d),s:to(c.s,R.shift[1]-c.s),c:c.c+0.2*(R.code[0]-c.c)}};
const visHumanEval=(set=VIS.val)=>visEval(set,visHumanTh());
const visTh=()=>{const u=lab().vision.th;if(!u||u.fk!==VIS.featureSource)return VIS.calib;
 if(typeof u.sens==='number')return visThFromSens(u.sens);
 const cl=(v,k)=>Math.min(VIS.rng[k][1],Math.max(VIS.rng[k][0],v));return{d:cl(u.d,'dent'),s:cl(u.s,'shift'),c:cl(u.c,'code')}};

