/* Ayer Star Radio v0.5.1 single-file PWA - offline shell */
const CACHE='ayer-star-radio-inline-v051-20261118';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('ayer-star-radio-')||k.startsWith('ayer-radio-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;
if(r.mode==='navigate'){e.respondWith(fetch(r).then(resp=>{if(resp.ok){const clone=resp.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put('./index.html',clone)))}return resp}).catch(async()=>await caches.match('./index.html')||new Response('暂时无法离线加载',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));return;}
e.respondWith(caches.match(r).then(cached=>cached||fetch(r).catch(()=>new Response('Offline',{status:503}))));});
