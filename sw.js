/* Ayer Star Radio v0.5.3 — offline single-file music PWA */
const CACHE='ayer-star-radio-inline-v053-20261118';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ayer-star-radio-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('./index.html',copy)))}
   return response;
  }).catch(async()=>await caches.match('./index.html')||new Response('当前离线页面尚未缓存',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
  return;
 }
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).catch(()=>new Response('Offline',{status:503}))));
});