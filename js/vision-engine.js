// js/vision-engine.js - Vision engine: loading the can photographs and their status, and the model the team trains on them.
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
function visionRefresh(){publishVisionContract();if(VIS.loading||X.visBusy)return;if(S.view==='data'&&FSEL==='can_images/ (210)'){vData();icons(mainEl)}else if(S.view==='lab'&&S.sub.lab==='vision'&&$('#proto')){const fa=document.activeElement,had=!!fa&&fa!==document.body,fid=had?fa.id:null;keepNote(labVision);icons($('#proto'));if(X.room&&X.room.track==='vision'){renderDataViewer(TRACK_FILE.vision,X.room.data);icons(X.room.data);X.room.handle.setData(roomData('vision'))}
  // The photos arrived and the lab was redrawn: keep the keyboard focus where it was, never on BODY; the note keeps its text and caret.
  if(had&&(!document.activeElement||document.activeElement===document.body))(fid&&document.getElementById(fid)||mainEl).focus({preventScroll:true})}}
function dataUrlFromBlob(blob){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onerror=()=>reject(rd.error||new Error('file_read'));rd.onload=()=>resolve(String(rd.result));rd.readAsDataURL(blob)})}
// Draw an image at the 320×400 working size and return it as a data URL of the given type.
function scaledVisionDataUrl(url,type,q){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas');c.width=320;c.height=400;c.getContext('2d').drawImage(im,0,0,320,400);resolve(c.toDataURL(type,q))}catch(e){reject(e)}};im.onerror=()=>reject(new Error('image_decode'));im.src=url})}
// The photo set counts as complete ('photo') only when every can loaded as a photograph; the borderline challenge needs that.
function applyPhotoSource(){const all=visionItems();VIS.featureSource=all.length>0&&all.every(i=>i.source==='photo')?'photo':'synthetic'}
function finishVisionAssets(){
 VIS.loading=false;VIS.status='ready';VIS.fallbackCount=Math.max(0,VIS.expectedPhotoCount-VIS.photoCount);
 applyPhotoSource();
 VIS.photoHashes=visionItems().filter(i=>i.source==='photo').map(i=>`${i.id}:${i.photoHash||hashStr(i.url)}`).sort();
 VIS.datasetKey=VIS.photoCount?`vision-photo-v2:${hashStr(VIS.photoHashes.join('|'))}`:'synthetic-baseline-v1';
 publishVisionContract();visionRefresh();
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
  const manifestIds=[...index.keys()].sort();if(manifestIds.length){VIS.datasetKey=`vision-photo-v2:manifest-${hashStr(manifestIds.join('|'))}`;publishVisionContract();if(S.view==='lab'&&S.sub.lab==='vision'&&!X.visBusy){keepNote(labVision);icons($('#proto'))}}
 const entries=[...index.values()];let cursor=0;const worker=async()=>{while(cursor<entries.length){const {it,file}=entries[cursor++],url=VISION_ASSET_DIR+file;try{const fullData=await visionPhotoData(file,url,bundle);if(!fullData)continue;const jpg=/\.(jpe?g|webp)$/i.test(file),data=jpg?fullData:await scaledVisionDataUrl(fullData,'image/png');it.originalUrl=new URL(url,document.baseURI).href;it.url=data;it.source='photo';it.photoHash=hashStr(fullData);
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
// ─── Vision model (shared verbatim with the app) ───
// Input: the photo averaged over 4×4 pixel blocks and rounded (80×100, RGB). The can is cut out of the photo, laid on a grid of
// VG_W×VG_H cells, and each cell gives two numbers: its brightness (against the whole can) and its detail (how much brightness changes between neighbouring points).
const VP_W=80,VP_H=100,VG_W=8,VG_H=10,VG_N=VG_W*VG_H,VIS_CLASSES=['ok','dent','label','code'],VIS_LR=.05;
function visCanBox(px){const n=VP_W*VP_H,L=new Float32Array(n),D=new Uint8Array(n),cs=[[],[],[]];
 for(const[x0,y0]of[[0,0],[VP_W-6,0],[0,6],[VP_W-6,6]])for(let y=y0;y<y0+6;y++)for(let x=x0;x<x0+6;x++)for(let c=0;c<3;c++)cs[c].push(px[(y*VP_W+x)*3+c]);
 const bg=cs.map(a=>a.sort((p,q)=>p-q)[a.length>>1]);
 for(let i=0;i<n;i++){const r=px[i*3],g=px[i*3+1],b=px[i*3+2];L[i]=.299*r+.587*g+.114*b;D[i]=Math.abs(r-bg[0])+Math.abs(g-bg[1])+Math.abs(b-bg[2])>60?1:0}
 const col=x=>{let k=0;for(let y=25;y<75;y++)k+=D[y*VP_W+x];return k/50};let x0=0,x1=VP_W-1;while(x0<VP_W/2-4&&col(x0)<.6)x0++;while(x1>VP_W/2+4&&col(x1)<.6)x1--;
 const xa=Math.round(x0+(x1-x0)*.25),xb=Math.round(x0+(x1-x0)*.75),row=y=>{let k=0;for(let x=xa;x<=xb;x++)k+=D[y*VP_W+x];return k/(xb-xa+1)};let y0=0,y1=VP_H-1;while(y0<VP_H/2-4&&row(y0)<.5)y0++;while(y1>VP_H/2+4&&row(y1)<.5)y1--;
 return{x0,x1:x1+1,y0,y1:y1+1,L}}
// {b,e}: brightness and detail per grid cell, rounded to 3 and 2 decimals so tiny decoding differences between browsers disappear.
function visFeat(px){const B=visCanBox(px),L=B.L,w=B.x1-B.x0,h=B.y1-B.y0,b=new Float64Array(VG_N),e=new Float64Array(VG_N),c=new Float64Array(VG_N);
 for(let y=B.y0;y<B.y1;y++)for(let x=B.x0;x<B.x1;x++){const k=Math.min(VG_H-1,Math.floor((y-B.y0)*VG_H/h))*VG_W+Math.min(VG_W-1,Math.floor((x-B.x0)*VG_W/w)),i=y*VP_W+x;
  b[k]+=L[i];e[k]+=(x<VP_W-1?Math.abs(L[i+1]-L[i]):0)+(y<VP_H-1?Math.abs(L[i+VP_W]-L[i]):0);c[k]++}
 let m=0;for(let k=0;k<VG_N;k++){b[k]/=c[k]||1;e[k]/=c[k]||1;m+=b[k]/VG_N}let s=0;for(let k=0;k<VG_N;k++)s+=(b[k]-m)**2;s=Math.sqrt(s/VG_N)||1;
 return{b:Array.from(b,v=>Math.round((v-m)/s*1000)/1000),e:Array.from(e,v=>Math.round(v*100)/100),box:[B.x0,B.y0,B.x1,B.y1]}}
const visVec=(f,cfg)=>[...(cfg.bright?f.b:[]),...(cfg.detail?f.e:[])];
// Softmax regression: one weight per input number and class, all zero before training. One round = one step of gradient descent over all chosen photos.
// trainF/evalF: arrays of {f:{b,e},y:class index}. step(k) runs k rounds; curve[r]=[share of wrong answers on the training photos, on the practice set] after round r+1.
function visTrainer(cfg,trainF,evalF,thr=.5){const X0=trainF.map(t=>visVec(t.f,cfg)),D=X0[0].length,K=4,n=X0.length,mu=new Float64Array(D),sd=new Float64Array(D);
 X0.forEach(x=>{for(let d=0;d<D;d++)mu[d]+=x[d]/n});X0.forEach(x=>{for(let d=0;d<D;d++)sd[d]+=(x[d]-mu[d])**2/n});for(let d=0;d<D;d++)sd[d]=Math.sqrt(sd[d])+.05;
 const z=x=>x.map((v,d)=>(v-mu[d])/sd[d]),X=X0.map(z),Y=trainF.map(t=>t.y),XE=evalF.map(t=>z(visVec(t.f,cfg))),YE=evalF.map(t=>t.y),W=new Float64Array(K*D),B=new Float64Array(K);
 const prob=x=>{const s=[];let mx=-1e9;for(let k=0;k<K;k++){let a=B[k];for(let d=0;d<D;d++)a+=W[k*D+d]*x[d];s.push(a);if(a>mx)mx=a}let t=0;for(let k=0;k<K;k++){s[k]=Math.exp(s[k]-mx);t+=s[k]}return s.map(v=>v/t)};
 const wrong=(Xs,Ys)=>{let w=0;Xs.forEach((x,i)=>{if(visAnswer(prob(x),thr)!==Ys[i])w++});return Xs.length?w/Xs.length:0};
 const M={cfg,n,D,W,B,mu,sd,round:0,curve:[],prob:f=>prob(z(visVec(f,cfg))),
  step(k){for(let it=0;it<k&&M.round<cfg.rounds;it++){const gW=new Float64Array(K*D),gB=new Float64Array(K);
    for(let i=0;i<n;i++){const x=X[i],p=prob(x);for(let c=0;c<K;c++){const g=(p[c]-(c===Y[i]?1:0))/n;gB[c]+=g;for(let d=0;d<D;d++)gW[c*D+d]+=g*x[d]}}
    for(let j=0;j<W.length;j++)W[j]-=VIS_LR*gW[j];for(let c=0;c<K;c++)B[c]-=VIS_LR*gB[c];M.round++;M.curve.push([wrong(X,Y),wrong(XE,YE)])}return M.round>=cfg.rounds}};
 return M}
// The model's answer: a defect when its confidence that the can is defective (1 − confidence of OK) reaches the threshold; then the most likely defect type.
function visAnswer(p,thr){if(1-p[0]<thr)return 0;let d=1;for(let k=2;k<4;k++)if(p[k]>p[d])d=k;return d}
// The training photos the model gets: the first of every class in file order, 7 good cans for every 3 defective ones (one of each defect type), as in the whole set.
function visPick(items,n){const k=Math.round(n/10),by=t=>items.filter(i=>i.type===t);return[...by('ok').slice(0,n-3*k),...by('dent').slice(0,k),...by('label').slice(0,k),...by('code').slice(0,k)]}
// ─── Vision model in the app: pixels, features, the trained model of the team ───
// The photo at 320×400, averaged over 4×4 blocks and rounded: the same numbers in every browser that decodes the file the same way, and nearly the same elsewhere.
function visPixels(url){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas');c.width=VP_W*4;c.height=VP_H*4;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,VP_W*4,VP_H*4);
  const d=x.getImageData(0,0,VP_W*4,VP_H*4).data,s=new Uint16Array(VP_W*VP_H*3);for(let y=0;y<VP_H*4;y++)for(let xx=0;xx<VP_W*4;xx++){const k=((y>>2)*VP_W+(xx>>2))*3,j=(y*VP_W*4+xx)*4;s[k]+=d[j];s[k+1]+=d[j+1];s[k+2]+=d[j+2]}
  res(Uint8Array.from(s,v=>Math.round(v/16)))}catch(e){rej(e)}};im.onerror=()=>rej(new Error('image_decode'));im.src=url})}
// Every photo's grid numbers (it.vf), computed once per loaded photo set; a trained model is kept only for the set it was trained on.
let visFeatP=null;
const visFeatOk=()=>VIS.initialized&&!VIS.loading&&VIS.featKey===VIS.datasetKey;
function visFeatures(){if(visFeatOk())return Promise.resolve();if(visFeatP)return visFeatP;const key=VIS.datasetKey,blank=()=>({b:Array(VG_N).fill(0),e:Array(VG_N).fill(0),box:[0,0,VP_W,VP_H]});
 return visFeatP=(async()=>{const todo=visionItems().filter(it=>!it.vf||it.vfU!==it.url);let c=0;const w=async()=>{while(c<todo.length){const it=todo[c++],u=it.url;try{it.vf=visFeat(await visPixels(u))}catch(e){it.vf=blank()}it.vfU=u}};
  await Promise.all(Array.from({length:6},w));VIS.featKey=key;X.visModel=null})().finally(()=>{visFeatP=null})}
// The build settings of the vision lab, read defensively (older team files have none): how many training photos, how many rounds, what the model gets from every grid cell.
const visCfg=L=>{const b=L.bright!==0?1:0,d=L.detail!==0?1:0;return{n:VIS_NS.includes(L.n)?L.n:VIS_DEF.n,rounds:VIS_ROUNDS.includes(L.rounds)?L.rounds:VIS_DEF.rounds,bright:b||!d?1:0,detail:d}};
const visThr=L=>typeof L.thr==='number'&&L.thr>=.1&&L.thr<=.9?Math.round(L.thr*10)/10:VIS_DEF.thr;
// The training covers the photos, the rounds and the inputs; the sensitivity only tunes the trained model.
const visSig=L=>{const c=visCfg(L);return[c.n,c.rounds,c.bright,c.detail].join('|')};
const visTrained=(L=lab().vision)=>!!(L.fit||null)&&L.fit===visSig(L);
const visData=(items)=>items.map(it=>({f:it.vf,y:VIS_CLASSES.indexOf(it.type)}));
const visNewTrainer=L=>{const c=visCfg(L);return visTrainer(c,visData(visPick(VIS.train,c.n)),visData(VIS.val))};
// The team's trained model. The weights are never stored: the same settings and photos always give the same weights, so after a reload the model is trained again here, silently.
function visModel(L=lab().vision){if(!visTrained(L)||!visFeatOk())return null;const sig=L.fit+'@'+VIS.datasetKey;if(X.visModel&&X.visModel.sig===sig)return X.visModel.M;const M=visNewTrainer(L);M.step(M.cfg.rounds);X.visModel={sig,M};return M}
// The model's answers on one data part: m = counts and measures, types = [type, flagged as a defect, all of that type, type named correctly], preds = [{d: answer, p: confidence per class}].
function visEval(M,set,thr){let tp=0,fp=0,fn=0,tn=0,ok=0;const preds=set.map(it=>{const p=M.prob(it.vf),a=visAnswer(p,thr),bad=a>0;if(bad&&it.bad)tp++;else if(bad)fp++;else if(it.bad)fn++;else tn++;if(VIS_CLASSES[a]===it.type)ok++;return{d:VIS_CLASSES[a],p}}),m=prf(tp,fp,fn,tn);
 return{m:{tp,fp,fn,tn,p:f0(m.p),r:f0(m.r),f1:f0(m.f1),acc:m.acc},typeOk:ok,n:set.length,preds,types:['dent','label','code'].map(t=>{const ix=set.map((it,i)=>it.type===t?i:-1).filter(i=>i>=0);return[t,ix.filter(i=>preds[i].d!=='ok').length,ix.length,ix.filter(i=>preds[i].d===t).length]})}}
// How strongly each grid cell pulls the model towards one defect type: the distance between that type's weights and the weights of "OK", summed over the inputs in use. Three maps, scaled together to 0..1.
function visHeat(M){const C=M.D/VG_N,maps=[1,2,3].map(k=>Array.from({length:VG_N},(_,c)=>{let s=0;for(let ch=0;ch<C;ch++)s+=Math.abs(M.W[k*M.D+ch*VG_N+c]-M.W[ch*VG_N+c]);return s})),mx=Math.max(1e-9,...maps.flat());return maps.map(m=>m.map(v=>v/mx))}
