// js/vision-engine.js - Vision engine: loading the can photographs and their status.
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
const visionManifestWarning=()=>VIS.manifestRejected?T(`Odrzucone wpisy manifestu: ${VIS.manifestRejected}. Etykiety muszą zgadzać się z oryginalnym zbiorem, więc za odrzucone pozycje aplikacja wstawia obrazy syntetyczne.`,`${VIS.manifestRejected} manifest rows were rejected: labels must match the original dataset, so the app puts synthetic images in place of the rejected rows.`):'';
const visionStatusInner=()=>`<b>${visionPhotoStatus()}</b>${visionManifestWarning()?`<br><span>${visionManifestWarning()}</span>`:''}`;
const visionAssetStatusHtml=()=>`<div id="visionAssetStatus" class="callout tone-yellow edu-block">${visionStatusInner()}</div>`;
// Loading state as data attributes (read by the tests and the recording tool) plus the visible status box.
function publishVisionContract(){
 Object.assign(document.body.dataset,{visionStatus:VIS.status,visionPhotos:VIS.photoCount,visionExpected:VIS.expectedPhotoCount,visionFallback:VIS.fallbackCount,visionManifestRejected:VIS.manifestRejected,visionDataset:VIS.datasetKey});
 document.documentElement.dataset.visionFeatures=VIS.featureSource;
 const el=$('#visionAssetStatus');if(el)el.innerHTML=visionStatusInner();
}
// Redraws a lab part while keeping what is being typed in the note field: its text, caret and focus.
function keepNote(draw){const e=$('#expNote'),v=e&&[e.value,e.selectionStart,e.selectionEnd,document.activeElement===e];draw();const n=$('#expNote');if(!v||!n)return;n.value=v[0];if(v[3]){n.focus({preventScroll:true});n.setSelectionRange(v[1],v[2])}}
function visionRefresh(){publishVisionContract();if(VIS.loading||AIS.run)return;if(S.view==='data'&&FSEL==='can_images/ (210)'){vData();icons(mainEl)}else if(S.view==='lab'&&S.sub.lab==='vision'&&$('#proto')){const fa=document.activeElement,had=!!fa&&fa!==document.body,fid=had?fa.id:null;keepNote(labVision);icons($('#proto'));if(X.room&&X.room.track==='vision'){renderDataViewer(TRACK_FILE.vision,X.room.data);icons(X.room.data);X.room.handle.setData(roomData('vision'))}
  // The photos arrived and the lab was redrawn: keep the keyboard focus where it was, never on BODY; the note keeps its text and caret.
  if(had&&(!document.activeElement||document.activeElement===document.body))(fid&&document.getElementById(fid)||mainEl).focus({preventScroll:true})}}
function dataUrlFromBlob(blob){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onerror=()=>reject(rd.error||new Error('file_read'));rd.onload=()=>resolve(String(rd.result));rd.readAsDataURL(blob)})}
// Draw an image at the 320×400 working size and return it as a data URL of the given type.
function scaledVisionDataUrl(url,type,q){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas');c.width=320;c.height=400;c.getContext('2d').drawImage(im,0,0,320,400);resolve(c.toDataURL(type,q))}catch(e){reject(e)}};im.onerror=()=>reject(new Error('image_decode'));im.src=url})}
// The photo set counts as complete ('photo') only when every can loaded as a photograph; the borderline challenge needs that.
function applyPhotoSource(){const all=visionItems();VIS.featureSource=all.length>0&&all.every(i=>i.source==='photo')?'photo':'synthetic'}
function invalidateVisionRuns(){let changed=false;Object.values(S.teams||{}).forEach(t=>{const L=t&&t.lab&&t.lab.vision;if(!L||!Array.isArray(L.mruns))return;const n=L.mruns.length;L.mruns=L.mruns.filter(r=>r&&r.datasetKey===VIS.datasetKey);if(L.mruns.length!==n){L.vsel='';changed=true}});if(changed)save()}
function finishVisionAssets(){
 VIS.loading=false;VIS.status='ready';VIS.fallbackCount=Math.max(0,VIS.expectedPhotoCount-VIS.photoCount);
 applyPhotoSource();
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
 VIS.photoCount++;VIS.fallbackCount=Math.max(0,VIS.expectedPhotoCount-VIS.photoCount);publishVisionContract()}catch(e){/* Keep the original synthetic item for this missing photo. */}}};await Promise.all(Array.from({length:Math.min(6,Math.max(1,entries.length))},worker));
 }catch(e){VIS.error=e&&e.message||'manifest';VIS.fallbackReason=location.protocol==='file:'?'file':'manifest'}
 finishVisionAssets();
}
// Runs on the first visit to the vision lab or the image folder, not at startup: other pages need neither
// the 210 drawn fallback cans nor the photo download (about 5 MB).
function visInit(){if(VIS.initialized){publishVisionContract();return}const mk=(s0,n)=>{const r=rng(s0),a=[],nb=Math.round(n*.1),types=[...Array(nb).fill('dent'),...Array(nb).fill('label'),...Array(nb).fill('code'),...Array(n-3*nb).fill('ok')];for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[types[i],types[j]]=[types[j],types[i]]}for(let i=0;i<n;i++){const t=types[i],c=document.createElement('canvas');c.width=160;c.height=200;const f=drawCan(c,s0*1000+i,t);a.push({type:t,bad:t!=='ok',f,url:c.toDataURL(),seed:s0*1000+i,source:'synthetic',originalUrl:''})}return a};
 VIS.train=mk(7,90);VIS.val=mk(9,60);VIS.test=mk(8,60);
 VIS.train.forEach((x,i)=>x.id='train_'+String(i+1).padStart(3,'0'));VIS.val.forEach((x,i)=>x.id='val_'+String(i+1).padStart(3,'0'));VIS.test.forEach((x,i)=>x.id='test_'+String(i+1).padStart(3,'0'));
 VIS.initialized=true;VIS.loading=true;VIS.status='loading';VIS.expectedPhotoCount=VISION_SPLITS.reduce((n,s)=>n+VIS[s].length,0);VIS.fallbackCount=VIS.expectedPhotoCount;publishVisionContract();VIS.readyPromise=loadVisionAssets();}
const visKey=()=>`<span><i class="tp"></i>TP – ${T('wada wykryta')}</span><span><i class="fn"></i>FN – ${T('wada przeoczona')}</span><span><i class="fp"></i>FP – ${T('fałszywy alarm')}</span><span><i></i>TN – ${T('poprawnie OK')}</span>`;
