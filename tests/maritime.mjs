import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {lowContrast} from './contrast.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch();
const check=(value,label)=>{if(!value)throw Error(label);console.log('PASS',label)};
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file://'+ROOT+'/rybex-ai-workshop.html#/rybex/home');
 await p.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));
 const theme=await p.evaluate(()=>{const f=document.querySelector('.rybex-frame');return{bg:getComputedStyle(f).backgroundColor,ink:getComputedStyle(f).color,outer:getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()}});
 check(theme.bg==='rgb(7, 25, 38)','maritime navy frame');
 check(theme.outer.toLowerCase()==='#ffffff','simulation paper unchanged');
 const compact=await p.evaluate(()=>{const box=s=>document.querySelector(s).getBoundingClientRect(),head=box('.rf-head'),logo=box('.rf-logo'),nav=box('.rf-navwrap'),photo=box('.rf-hero-pic'),copy=box('.rf-hero>div:first-child');return{inline:Math.abs(logo.top+logo.height/2-nav.top-nav.height/2)<8,header:head.height,photoGap:photo.top-head.bottom,copyGap:copy.top-head.bottom}});
 check(compact.inline&&compact.header<=90,'compact header: navigation inline with logo');
 check(compact.photoGap<=28&&compact.copyGap<=28,'hero starts directly below company header');
 for(const width of [1440,390]){
  await p.setViewportSize({width,height:1000});
  for(const route of ['home','about','products','quality','news','contact','career','intranet']){
   await p.evaluate(route=>go('rybex',route),route);
   await p.waitForFunction(route=>document.querySelector('.rybex-frame')?.dataset.page===route,route);
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${route}: no overflow`);
   check(await p.locator('.rybex-frame h1').count()===0,`${width} ${route}: heading hierarchy`);
   const contrast=await p.evaluate(lowContrast,{root:'.rybex-frame'});
   check(contrast.length===0,`${width} ${route}: contrast ${contrast.join('; ')}`);
  }
  await p.evaluate(()=>go('rybex','home'));
  await p.locator('.rf-hero-pic img').evaluate(i=>i.decode());
  check(await p.locator('.rf-hero-pic img').evaluate(i=>{const r=i.getBoundingClientRect();return i.naturalWidth===i.naturalHeight&&Math.abs(r.width-r.height)<1}),`${width}: square hero`);
  if(width===390){await p.locator('.rf-toggle').click();check(await p.locator('.rf-toggle').getAttribute('aria-expanded')==='true','mobile company menu');await p.locator('[data-rp=products]').first().click();check(await p.locator('.rf-prod').count()===4,'mobile products navigation')}
  await p.evaluate(()=>go('rybex','home'));if(await p.locator('#toast .toast-x').isVisible())await p.locator('#toast .toast-x').click();await p.screenshot({path:`/tmp/rybex-maritime-${width}.png`,fullPage:true});
 }
 await p.evaluate(()=>{S.lang='en';go('rybex','home')});check((await p.locator('.rf-lead').textContent()).includes('Canned fish'),'English company copy');
 await p.evaluate(()=>{S.lang='pl';go('home')});check(await p.locator('#sitePreview .rf-hero-pic img').count()===1,'workshop preview retained');
 check(await p.locator('#siteOpen').getAttribute('href')==='#/rybex/news','preview opens news');
 await p.locator('#siteOpen').click();await p.waitForFunction(()=>document.querySelector('.rybex-frame')?.dataset.page==='news');check(await p.locator('.rybex-frame').getAttribute('data-page')==='news','preview navigation');
 await p.evaluate(()=>go('rybex','contact'));await p.selectOption('#rcCat',{index:1});await p.fill('#rcText','Maritime theme regression check');await p.click('#rcSend');
 check(await p.locator('#rcDone').count()===1,'contact submission retained');
 check((await p.evaluate(lowContrast,{root:'.rybex-frame'})).length===0,'contact success contrast');
 await p.click('#rcToLab');check(await p.evaluate(()=>S.view==='lab'&&S.sub.lab==='complaints'),'contact lab link retained');
 check(errors.length===0,'no runtime errors');
 const first=await browser.newPage({viewport:{width:1280,height:720}});
 await first.goto('file://'+ROOT+'/rybex-ai-workshop.html#/home');await first.waitForFunction(()=>document.documentElement.classList.contains('app-ready'));
 const visible=()=>first.locator('#siteOpen').evaluate(e=>{const r=e.getBoundingClientRect(),bar=document.querySelector('#pathBar').getBoundingClientRect();return r.top>=bar.bottom&&r.bottom<=innerHeight});
 check(await visible(),'first-visit preview CTA fits 1280x720');
 check(await first.locator('.sp-name').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=28),'preview brand hierarchy');
 await first.click('#onboardGo');await first.waitForFunction(()=>!document.querySelector('#onboard'));
 await first.waitForFunction(()=>{const r=document.querySelector('#siteOpen').getBoundingClientRect(),bar=document.querySelector('#pathBar').getBoundingClientRect();return r.top>=bar.bottom&&r.bottom<=innerHeight});
 check(await visible(),'preview CTA fits after onboarding');await first.close();
}finally{await browser.close()}
