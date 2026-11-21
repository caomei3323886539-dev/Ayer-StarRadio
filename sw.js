/* Ayer Star Music v0.8.0: shell-only PWA, never cache protected media. */
const CACHE='ayer-star-radio-v094-20261121';
const SHELL=['./','./index.html','./music.html','./music.css?v=094','./music.js?v=094','./cloud.html','./public.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ayer-star-radio-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname.includes('/functions/')||url.pathname.includes('/storage/'))return;
 if(req.mode==='navigate'){
  const path=url.pathname.endsWith('/cloud.html')?'./cloud.html':url.pathname.endsWith('/public.html')?'./public.html':url.pathname.endsWith('/music.html')?'./music.html':'./index.html';
  e.respondWith(fetch(req).then(response=>{
   if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(cache=>cache.put(path,copy))}
   return response;
  }).catch(()=>caches.match(path).then(r=>r||new Response('该页面尚未缓存。请联网后再次打开。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}))));
  return;
 }
 const isShell=/\.(?:html|js|css|svg|webmanifest)$/.test(url.pathname);
 if(isShell)e.respondWith(fetch(req).then(response=>{
  if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy))}
  return response;
 }).catch(()=>caches.match(req).then(r=>r||new Response('Offline',{status:503}))));
});
