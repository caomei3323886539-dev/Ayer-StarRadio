/* Ayer Star Radio v0.7 cloud sync staging — separate offline routes */
const CACHE='ayer-star-radio-inline-v071-vinyl-20261120';
const SHELL=['./','./index.html','./cloud.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ayer-star-radio-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(req.mode==='navigate'){
   const path=new URL(req.url).pathname.endsWith('/cloud.html')?'./cloud.html':'./index.html';
   event.respondWith(fetch(req).then(resp=>{if(resp.ok){const copy=resp.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(path,copy)))}return resp}).catch(async()=>await caches.match(path)||new Response('离线页面未缓存',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
   return;
 }
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).catch(()=>new Response('Offline',{status:503}))));
});