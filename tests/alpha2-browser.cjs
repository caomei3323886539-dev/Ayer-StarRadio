const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const base='http://127.0.0.1:8765/';
const names=['home','discover','playlists','favorites','profile'];
fs.mkdirSync('alpha2-browser-results',{recursive:true});
async function checkNav(page,selector,attribute,mobile){
 const buttons=page.locator(selector+' button['+attribute+']');
 assert.equal(await buttons.count(),5);
 for(let i=0;i<5;i++){
  const button=buttons.nth(i);
  assert.equal(await button.getAttribute(attribute),names[i]);
  const box=await button.boundingBox();
  assert.ok(box&&box.width>=44&&box.height>=44,'Tap target too small: '+names[i]);
  if(mobile)await button.tap();else await button.click();
  await page.waitForFunction(({selector,attribute,name})=>{
   const selected=document.querySelector(selector+' button[aria-current="page"]');
   return selected?.getAttribute(attribute)===name;
  },{selector,attribute,name:names[i]});
  const state=await page.locator(selector).evaluate(nav=>[...nav.querySelectorAll('button')].map(button=>{
   const visible=[...button.querySelectorAll('.ayer-nav-art img')].filter(img=>getComputedStyle(img).display!=='none');
   return {active:button.classList.contains('active'),visible:visible.length,loaded:visible.every(img=>img.complete&&img.naturalWidth>0),label:button.querySelectorAll('.ayer-nav-label').length,background:getComputedStyle(button).backgroundColor};
  }));
  assert.equal(state.filter(x=>x.active).length,1);
  for(const x of state){
   assert.equal(x.visible,1,'duplicate or hidden artwork');
   assert.ok(x.loaded,'approved image not loaded');
   assert.equal(x.label,1,'duplicate label');
   assert.equal(x.background,'rgba(0, 0, 0, 0)','rectangular button feedback');
  }
 }
}
async function main(){
 const hasChrome=spawnSync('bash',['-lc','command -v google-chrome || command -v google-chrome-stable']).status===0;
 const browser=await chromium.launch(hasChrome?{channel:'chrome',headless:true,args:['--no-sandbox']}:{headless:true,args:['--no-sandbox']});
 try{
  for(const [width,height] of [[320,740],[390,844],[480,900],[1366,900]]){
   const mobile=width<900;
   const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,serviceWorkers:'block'});
   // Smoke tests must never read or modify real cloud accounts or songs.
   await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'alpha2-preview.html',{waitUntil:'load'});
   await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
   await checkNav(page,'.sample-nav','data-tab',mobile);
   await page.locator('#demoOpen').click();
   assert.equal(await page.locator('#demoDialog').isVisible(),true);
   await page.locator('#demoInput').fill('Alpha 2');
   await page.locator('#demoClose').click();
   assert.equal(await page.locator('#demoDialog').isVisible(),false);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'Preview horizontal overflow at '+width);
   await page.screenshot({path:'alpha2-browser-results/preview-'+width+'.png',fullPage:true});
   await page.locator('.launch').click();
   await page.waitForURL('**/music.html?v=100a2c11');
   await page.waitForFunction(()=>document.querySelector('#notice')?.textContent.includes('离线模式'),null,{timeout:20000});
   await page.waitForFunction(()=>document.querySelector('#viewRoot')?.children.length>0);
   if(mobile){
    await checkNav(page,'body > .mobile-nav','data-view',true);
    await page.locator('#mobileSearchToggle').tap();
    assert.equal(await page.locator('#searchInput').isVisible(),true);
    await page.locator('#searchInput').fill('Alpha2 smoke test');
    await page.locator('#mobileSearchToggle').tap();
    assert.equal(await page.locator('#mobileSearchToggle').getAttribute('aria-expanded'),'false');
    await page.locator('#mobileMenu').tap();
    assert.equal(await page.locator('.sidebar').evaluate(el=>el.classList.contains('open')),true);
    await page.locator('#backdrop').tap();
    assert.equal(await page.locator('.sidebar').evaluate(el=>el.classList.contains('open')),false);
    await page.locator('body > .mobile-nav button[data-view="home"]').tap();
   }else{
    assert.equal(await page.locator('.search-wrap img').isVisible(),true);
    await page.locator('.side-nav button[data-view="discover"]').click();
    assert.equal(await page.locator('.side-nav button[data-view="discover"]').getAttribute('aria-current'),'page');
    await page.locator('.side-nav button[data-view="home"]').click();
   }
   assert.equal(errors.length,0,errors.join('; '));
   await page.screenshot({path:'alpha2-browser-results/music-'+width+'.png',fullPage:false});
   console.log(width+'px: approved artwork, five routes, header and component smoke test passed');
   await context.close();
  }
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exit(1)});
