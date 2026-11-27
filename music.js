import {readLocalLibrary,saveLocalSong,saveLocalPlaylist,importLocalSongs} from './local-library.js?v=0994';

// The offline library must remain usable when the cloud SDK is unreachable.
let createClient=null;
try{({createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.4'))}catch(error){console.warn('云端组件离线，本地曲库仍可使用',error)}

const API='https://nnoffobuktejgtmwfvbn.supabase.co';
const PUBLISHABLE='sb_publishable_ypAoa0UggQNWR9Rt9HWelQ_ao_Ih5Yw';
const sb=createClient?createClient(API,PUBLISHABLE,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const $=id=>document.getElementById(id);
const audio=$('audio');
const state={
 user:null,public:[],private:[],favorites:new Set(),history:[],playlists:[],items:[],
 local:[],localPlaylists:[],localFilter:'all',localPlaylistId:null,localStatus:'',localLoaded:false,localAudioUrl:null,localAudioId:null,
 view:'home',search:'',album:null,artist:null,selectedPlaylist:null,discoverFilter:'all',discoverSort:'newest',
 queue:[],current:null,index:-1,shuffle:false,repeat:false,
 covers:new Map(),coverObjects:[],lyrics:[],lyricIndex:-1,channel:null,
 pendingAdd:null,playToken:0,recordedKey:null,loadToken:0,cloudUser:null,cloudStamp:null,cloudRestoring:false,pendingResume:0,lastSyncAt:0
};
const PUBLIC_COLS='track_id,title,artist,album,lyrics,published,published_at,updated_at';
const PRIVATE_COLS='id,title,artist,album,lyrics,audio_path,cover_path,is_favorite,last_played_at,duration_seconds,created_at';
const accountRequired=['favorites','recent','playlists','private'];
function el(tag,cls,text){
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=String(text);
 return n;
}
function button(txt,cls,fn,title){
 const b=el('button',cls,txt);b.type='button';if(title)b.title=title;
 if(fn)b.addEventListener('click',fn);return b;
}
function say(msg){const node=$('notice');node.textContent=msg;node.classList.add('visible')}
function silent(){ $('notice').classList.remove('visible') }
function safeError(response,action){if(response.error)throw Error(action+'：'+response.error.message);return response.data}
function displayName(t){return t.artist||'艾耶尔大陆'}
function albumName(t){return t.album||'未分类专辑'}
function key(t){return t.kind+':'+t.id}
function formatTime(sec){if(!Number.isFinite(sec)||sec<0)return '0:00';return Math.floor(sec/60)+':'+String(Math.floor(sec%60)).padStart(2,'0')}
function availablePublic(){return state.public.map(t=>({...t,kind:'public',id:t.track_id}))}
function availablePrivate(){return state.private.map(t=>({...t,kind:'private'}))}
function availableLocal(){
 return state.local.filter(t=>t.blob instanceof Blob).map(t=>({
  kind:'local',id:String(t.id),title:t.title||'本地音乐',artist:t.artist||'艾耶尔大陆 · 本地音乐',
  album:t.album||'本地音乐',fav:!!t.fav,cover:t.cover||null,lyrics:t.lyrics||'',
  lastPlayed:t.lastPlayed||0,addedAt:t.addedAt||0
 }));
}
function findLocal(id){return availableLocal().find(t=>t.id===String(id))||null}
async function loadLocalLibrary(){
 try{
  const data=await readLocalLibrary();
  state.local=data.songs||[];state.localPlaylists=data.playlists||[];
  state.localStatus='';state.localLoaded=true;
  if(!state.current)restoreLocalQueue();
  if(['local','profile','home'].includes(state.view))render();
 }catch(error){
  state.localLoaded=true;state.localStatus=error.message;
  if(state.view==='local')render();
  console.warn('本地音乐库载入失败',error);
 }
}
function localTrackData(id){return state.local.find(t=>String(t.id)===String(id))||null}

function findPublic(id){const t=state.public.find(t=>t.track_id===id);return t?{...t,kind:'public',id:t.track_id}:null}
function findPrivate(id){const t=state.private.find(t=>t.id===id);return t?{...t,kind:'private'}:null}
function isLiked(t){if(t?.kind==='local')return !!localTrackData(t.id)?.fav;return t?.kind==='public'?state.favorites.has(t.id):!!state.private.find(x=>x.id===t?.id)?.is_favorite}
function requireUser(){if(state.user)return true;openAuth();say('请先登录星音账号，才能使用个人音乐功能。');return false}
function setActiveNav(){
 document.querySelectorAll('[data-view]').forEach(b=>{
  const active=b.dataset.view===state.view&&!state.search;
  b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
}
function goto(view){
 state.view=view;state.search='';$('searchInput').value='';
 setMobileSearchOpen(false);
 state.album=null;state.artist=null;state.selectedPlaylist=null;
 if(view==='discover')state.discoverFilter='all';
 if(view==='local')state.localPlaylistId=null;
 document.querySelector('.sidebar').classList.remove('open');$('backdrop').hidden=true;
 render();$('mainContent').scrollIntoView({block:'start',behavior:'instant'});
}
async function mediaUrl(id,kind){
 const response=await fetch(API+'/functions/v1/ayer-public-media',{
  method:'POST',headers:{'content-type':'application/json',apikey:PUBLISHABLE},body:JSON.stringify({track_id:id,kind})
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||!payload.url)throw Error(payload.error||'媒体地址获取失败');
 return payload.url;
}
async function sourceFor(t){
 if(t.kind==='local'){
  const song=localTrackData(t.id);
  if(!(song?.blob instanceof Blob))throw Error('本机歌曲音频不可用，请检查原始存档');
  if(!state.localAudioUrl||state.localAudioId!==t.id){
   if(state.localAudioUrl)URL.revokeObjectURL(state.localAudioUrl);
   state.localAudioUrl=URL.createObjectURL(song.blob);state.localAudioId=t.id;
  }
  return state.localAudioUrl;
 }
 if(t.kind==='public')return mediaUrl(t.id,'audio');
 if(!state.user||!t.audio_path)throw Error('私人曲目无效或尚未登录');
 const result=await sb.storage.from('ayer-audio').createSignedUrl(t.audio_path,3600);
 return safeError(result,'私人音乐访问').signedUrl;
}
// Cover cache: public images only, versioned by publication timestamp.
const COVER_CACHE='ayer-public-cover-v1';
const coverPending=new Map(),coverRetry=new Map();
let coverEpoch=0;
function coverIdentity(t){
 return t.kind==='public'?key(t)+':'+(t.updated_at||t.published_at||'0'):
 t.kind==='private'?key(t)+':'+(state.user?.id||'guest')+':'+(t.cover_path||''):key(t);
}
function coverRequest(t){
 return new Request(new URL('./__cover_cache__/'+encodeURIComponent(t.id)+'/'+encodeURIComponent(t.updated_at||t.published_at||'0'),location.href));
}
async function publicCoverBlob(t){
 let cache=null;
 try{if('caches' in window)cache=await caches.open(COVER_CACHE)}catch(_e){}
 const request=coverRequest(t);
 if(cache){try{const hit=await cache.match(request);if(hit)return await hit.blob()}catch(_e){}}
 const url=await mediaUrl(t.id,'cover');
 const response=await fetch(url,{credentials:'omit'});
 if(!response.ok)throw Error('封面请求失败');
 const blob=await response.blob();
 if(!blob.type.startsWith('image/')||blob.size>8*1024*1024)throw Error('封面格式无效');
 if(cache){try{
  await cache.put(request,new Response(blob,{headers:{'Content-Type':blob.type}}));
  const keys=await cache.keys();
  for(const old of keys.filter(k=>k.url.includes('/__cover_cache__/'+encodeURIComponent(t.id)+'/')&&k.url!==request.url))await cache.delete(old);
  for(const old of (await cache.keys()).slice(0,-80))await cache.delete(old);
 }catch(_e){}}
 return blob;
}
async function artwork(t){
 const k=coverIdentity(t),epoch=coverEpoch;
 if(state.covers.has(k))return state.covers.get(k);
 if(coverPending.has(k))return coverPending.get(k);
 if((coverRetry.get(k)||0)>Date.now())return null;
 const task=(async()=>{
  let url=null,blob=null;
  try{
   if(t.kind==='local'){
    const cover=localTrackData(t.id)?.cover;
    if(cover instanceof Blob)blob=cover;
    else if(typeof cover==='string'&&/^data:image\/(?:png|jpeg|webp);base64,/i.test(cover))url=cover;
   }else if(t.kind==='public'){
    try{blob=await publicCoverBlob(t)}catch(_e){url=await mediaUrl(t.id,'cover')}
   }else if(t.cover_path&&state.user){
    const r=await sb.storage.from('ayer-covers').download(t.cover_path);
    if(r.error)throw r.error;
    blob=r.data;
   }
   if(epoch!==coverEpoch)return null;
   if(blob){url=URL.createObjectURL(blob);state.coverObjects.push(url)}
   if(url){state.covers.set(k,url);coverRetry.delete(k)}
   return url;
  }catch(_e){coverRetry.set(k,Date.now()+10000);return null}
 })();
 coverPending.set(k,task);
 try{return await task}finally{if(coverPending.get(k)===task)coverPending.delete(k)}
}
function setArt(t,holder){
 if(!t||!holder)return;
 const identity=coverIdentity(t);
 holder.dataset.coverIdentity=identity;
 holder.replaceChildren();holder.textContent='✦';
 const apply=url=>{
  if(!url||holder.dataset.coverIdentity!==identity)return;
  const img=el('img');img.alt=t.title+' 的封面';img.decoding='async';
  img.loading='eager';
  if(holder.classList.contains('ayer-feature-art')||holder.id==='playerArt')img.fetchPriority='high';
  img.onerror=()=>{if(holder.dataset.coverIdentity!==identity)return;state.covers.delete(identity);img.remove();if(!holder.textContent)holder.textContent='✦'};
  holder.replaceChildren(img);img.src=url;
 };
 if(state.covers.has(identity))apply(state.covers.get(identity));
 else artwork(t).then(apply);
}
function clearArtObjects(){
 coverEpoch++;coverPending.clear();coverRetry.clear();
 for(const url of state.coverObjects)URL.revokeObjectURL(url);
 state.coverObjects=[];state.covers.clear();
}
function heading(title,subtitle,actionText,action){
 const section=el('div','section-heading'),left=el('div');
 left.append(el('h2','',title));
 if(subtitle)left.append(el('p','',subtitle));
 section.append(left);
 if(actionText)section.append(button(actionText,'',action));
 return section;
}
function empty(title,description,actionText,fn){
 const box=el('div','empty'),wrap=el('div');wrap.append(el('span','','✦'),el('h3','',title),el('p','',description));
 if(actionText)wrap.append(button(actionText,'primary-btn',fn));box.append(wrap);return box;
}
function loggedOut(){
 return empty('登录后开启你的音乐空间','公开音乐无需登录即可播放。账号登录后，收藏、歌单和私人音乐库将在电脑和手机之间同步。','登录 / 注册',openAuth);
}
function collectionTile(title,subtitle,first,onClick,tag){
 const item=el('div','music-tile album-tile'),cover=button('✦','tile-cover',onClick,title);
 if(first)setArt(first,cover);
 item.append(cover,button(title,'tile-title',onClick),el('div','tile-sub',subtitle));
 if(tag)item.append(el('span','tile-tag',tag));
 return item;
}
function tile(t){
 const item=el('div','music-tile'),cover=button('✦','tile-cover',()=>start(t), '播放 '+t.title),p=button('▶','tile-play',()=>start(t),'播放');
 cover.append(p);setArt(t,cover);
 const fav=button(isLiked(t)?'♥':'♡','mini-action'+(isLiked(t)?' active':''),()=>toggleFavorite(t),'收藏');
 fav.setAttribute('aria-label',isLiked(t)?'取消收藏':'收藏');
 const bottom=el('div','tile-bottom'),sub=el('div','tile-sub',displayName(t));
 bottom.append(sub,fav);
 item.append(cover,button(t.title,'tile-title',()=>start(t)),bottom);
 if(t.kind==='private')item.append(el('span','tile-tag','私人曲库'));
 return item;
}
function row(t,idx,scope){
 const root=el('div','track-row'+(state.current&&key(state.current)===key(t)?' playing-row':''));
 const n=el('span','track-number',idx+1),art=el('div','track-cover','✦');
 setArt(t,art);
 const desc=el('div','track-desc'),playName=button(t.title,'tile-title',()=>start(t,scope));playName.style.margin='0';
 desc.append(playName,el('small','',displayName(t)+' · '+albumName(t)));
 const actions=el('div','track-actions');
 const like=button(isLiked(t)?'♥':'♡','mini-action'+(isLiked(t)?' active':''),()=>toggleFavorite(t),'喜欢/取消喜欢');
 like.setAttribute('aria-label','收藏 '+t.title);
 const play=button('▶','mini-action',()=>start(t,scope),'播放');
 play.setAttribute('aria-label','播放 '+t.title);
 actions.append(like,play);
 if(t.kind==='local'){
  const add=button('＋','mini-action',()=>addLocalToPlaylist(t),'加入本地歌单');
  add.setAttribute('aria-label','将 '+t.title+' 加入本地歌单');actions.append(add);
 }
 if(t.kind==='public'){
  const add=button('＋','mini-action',()=>addPrompt(t),'加入歌单');
  add.setAttribute('aria-label','添加 '+t.title+' 到歌单');actions.append(add);
 }
 if(state.selectedPlaylist&&t.kind==='public'&&state.view==='playlists'){
  const del=button('×','mini-action',()=>removePlaylistTrack(t.id),'从歌单中移除');
  del.setAttribute('aria-label','从歌单移除 '+t.title);actions.append(del);
 }
 root.append(n,art,desc,actions);return root;
}
function rowList(arr){
 const root=el('div','list');arr.forEach((t,i)=>root.append(row(t,i,arr)));return root;
}
function tiles(arr){const root=el('div','tiles');for(const t of arr)root.append(tile(t));return root}
function renderHome(root){
 const songs=sortPublicTracks(availablePublic(),'newest');
 const albums=groupBy(songs,albumName);
 const creators=groupBy(songs,displayName);
 const localSongs=availableLocal();
 const page=el('div','ayer-home');
 const top=el('div','ayer-home-top');
 const hero=el('section','ayer-illustrated-hero');
 const heroSky=el('div','ayer-hero-sky');
 heroSky.setAttribute('aria-hidden','true');
 // The approved original illustration is preferred; the previous vector remains a
 // non-blocking fallback until the binary asset is available on GitHub Pages.
 const officialBanner=new Image();
 officialBanner.decoding='async';
 officialBanner.onload=()=>{if(hero.isConnected)hero.classList.add('ayer-original-art-ready')};
 officialBanner.onerror=()=>{if(hero.isConnected)hero.classList.remove('ayer-original-art-ready')};
 officialBanner.src='./assets/ayer_home_harpist.webp';
 const heroine=el('div','ayer-hero-musician');
 heroine.setAttribute('aria-hidden','true');
 const heroineArtwork=el('img');
 heroineArtwork.alt='';
 heroineArtwork.decoding='async';
 heroineArtwork.src='./assets/ayer-harpist.svg';
 heroine.append(heroineArtwork);
 const ornamental=el('div','ayer-hero-ornaments');
 ornamental.setAttribute('aria-hidden','true');
 ornamental.append(el('span','','✦'),el('span','','✧'),el('span','','✦'));
 const heroContent=el('div','ayer-hero-message');
 heroContent.append(el('span','ayer-hero-kicker','✦ AYER STAR MUSIC · 艾耶尔大陆'),
  el('h1','','让每一段旅程，都有自己的旋律'),
  el('p','','听见神之谷的风、沙海尽头的祈愿，还有旅途中每一份温柔的约定。'));
 const heroActions=el('div','ayer-hero-buttons');
 heroActions.append(button('♫ 探索音乐馆','ayer-hero-primary',()=>goto('discover')),
  button('✧ 本机音乐','ayer-hero-secondary',()=>goto('local')));
 heroContent.append(heroActions);
 const heroFoot=el('div','ayer-hero-foot');
 heroFoot.append(el('span','','✧ SKY HALL · MUSIC JOURNEY'),el('span','','✦ ✦ ✦'));
 heroContent.append(heroFoot);
 hero.append(heroSky,ornamental,heroine,heroContent);
 top.append(hero);
 const tabs=el('nav','ayer-home-tabs');tabs.setAttribute('aria-label','主页音乐分类');
 const categories=[['home','推荐'],['discover','音乐'],['albums','专辑'],['artists','创作者'],['favorites','心动']];
 for(const [view,label] of categories){const tab=button(label,view==='home'?'is-current':'',()=>goto(view));if(view==='home')tab.setAttribute('aria-current','page');tabs.append(tab)}
 top.append(tabs);page.append(top);
 const carousel=el('section','ayer-featured');
 carousel.append(heading('探索今日星音','EXPLORE TODAY\'S STAR MUSIC'));
 const rail=el('div','ayer-featured-rail');
 const cards=[
  {title:'最新星音',subtitle:'刚刚来到音乐馆的旋律',track:songs[0],view:'discover',kind:'latest'},
  {title:'神之谷 · 云端漫游',subtitle:'穿过天空与浮岛的音乐旅程',track:songs.find(t=>/神之谷|神女|天空|星|sky/i.test(t.title+' '+albumName(t)))||songs[1],view:'albums',kind:'valley'},
  {title:'萨德尔 · 沙海回响',subtitle:'在沙漠的尽头听见约定',track:songs.find(t=>/萨德尔|砂|沙|ともだち/i.test(t.title+' '+albumName(t)))||songs[2],view:'discover',kind:'desert'}
 ];
 for(const card of cards){
  const item=button('','ayer-feature-card '+card.kind,()=>{if(card.track)start(card.track,songs);else goto(card.view)});
  item.setAttribute('aria-label',card.title+(card.track?'，播放 '+card.track.title:'，浏览音乐馆'));
  const artworkBox=el('div','ayer-feature-art','✦');
  if(card.track)setArt(card.track,artworkBox);
  const overlay=el('div','ayer-feature-copy');
  const emblem=el('span','ayer-feature-emblem','✧');
  emblem.setAttribute('aria-hidden','true');
  item.append(emblem);
  overlay.append(el('span','ayer-feature-medallion','✦'));
  overlay.append(el('small','',card.subtitle),el('strong','',card.title),el('span','',card.track?card.track.title:'等待新的正式发布歌曲'));
  item.append(artworkBox,overlay);rail.append(item);
 }
 carousel.append(rail);page.append(carousel);
 const rec=el('section','ayer-recommend section');
 rec.append(heading('根据你的喜爱探索星音','FOR YOU IN AYER CONTINENT','查看全部',()=>goto('discover')));
 const liked=state.user?songs.filter(t=>state.favorites.has(t.id)):[];
 const recTracks=[...liked,...songs.filter(t=>!liked.some(x=>key(x)===key(t)))].slice(0,6);
 rec.append(recTracks.length?rowList(recTracks):empty('期待第一首公开旋律','管理员正式发布歌曲后，音乐会出现在这里。'));page.append(rec);
 const newSection=el('section','ayer-recommend section');
 newSection.append(heading('最近来到音乐馆',songs.length+' 首已正式发布的歌曲','全部音乐',()=>goto('discover')));
 newSection.append(songs.length?rowList(songs.slice(0,5)):empty('音乐馆正在准备中','私人曲目不会出现在公开主页。'));page.append(newSection);
 const albumsSection=el('section','ayer-home-albums section');
 albumsSection.append(heading('沿着旋律旅行','探索艾耶尔大陆的故事与专辑','全部专辑',()=>goto('albums')));
 if(albums.size){
  const grid=el('div','ayer-album-rail');
  for(const [name,tracks] of Array.from(albums).slice(0,8))grid.append(collectionTile(name,tracks.length+' 首歌曲',tracks[0],()=>{state.view='albums';state.album=name;render()},'专辑'));
  albumsSection.append(grid);
 }else albumsSection.append(empty('尚无公开专辑','正式发布歌曲后，将自动整理专辑。'));
 page.append(albumsSection);
 if(localSongs.length){
  const offline=el('section','ayer-recommend section');
  offline.append(heading('收藏在此设备的旋律','原有本地音乐和离线歌曲 · 无须登录','本地音乐馆',()=>goto('local')));
  offline.append(rowList(localSongs.slice().sort((a,b)=>b.addedAt-a.addedAt).slice(0,4)));
  page.append(offline);
 }
 if(state.user){
  const personal=[...availablePrivate().slice(0,4)];
  const mine=el('section','ayer-recommend section');
  mine.append(heading('继续聆听我的音乐','仅当前账号可访问的私人歌曲','进入私人曲库',()=>goto('private')));
  mine.append(personal.length?rowList(personal):empty('私人云音乐库尚无歌曲','上传的私人歌曲不会自动公开。'));page.append(mine);
 }
 if(creators.size){
  const section=el('section','section');
  section.append(heading('音乐旅途的创作者','每一段旋律都有自己的故事','全部创作者',()=>goto('artists')));
  const grid=el('div','ayer-album-rail');
  for(const [name,tracks] of Array.from(creators).slice(0,6))grid.append(collectionTile(name,tracks.length+' 首公开作品',tracks[0],()=>{state.view='artists';state.artist=name;render()},'创作者'));
  section.append(grid);page.append(section);
 }
 root.append(page);
}
function groupBy(arr,fn){const map=new Map();for(const t of arr){const k=fn(t);if(!map.has(k))map.set(k,[]);map.get(k).push(t)}return map}
function pageHead(root,title,description,right,fn){
 const bar=el('div','summary-top'),left=el('div');left.append(el('h1','',title),el('p','',description));bar.append(left);
 if(right)bar.append(button(right,'primary-btn',fn));root.append(bar);
}
function sortPublicTracks(songs,sort){
 const arr=[...songs];
 if(sort==='title')return arr.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
 if(sort==='artist')return arr.sort((a,b)=>displayName(a).localeCompare(displayName(b),'zh-CN'));
 return arr.sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0));
}
function renderDiscover(root){
 const songs=availablePublic(),albums=groupBy(songs,albumName),artists=groupBy(songs,displayName);
 pageHead(root,'发现音乐','公开音乐馆 · '+songs.length+' 首已发布曲目');
 if(!songs.length){root.append(empty('尚无已发布歌曲','只有管理员在云端管理中明确发布的音乐，才会向所有用户开放。'));return}
 const tools=el('div','music-filter-tools');
 const tabs=el('div','music-filter-tabs');
 const filters=[['all','全部音乐'],...Array.from(albums.keys()).map(name=>['album:'+name,name])];
 for(const [value,label] of filters){
  const b=button(label,(state.discoverFilter===value?'active ':''),'');
  b.setAttribute('aria-pressed',String(state.discoverFilter===value));
  b.onclick=()=>{state.discoverFilter=value;render()};
  tabs.append(b);
 }
 const sorter=el('select','music-sort');
 sorter.setAttribute('aria-label','歌曲排序');
 for(const [value,label] of [['newest','最新发布'],['title','歌曲名称'],['artist','创作者名称']]){
  const option=el('option','',label);option.value=value;sorter.append(option);
 }
 sorter.value=state.discoverSort;sorter.onchange=()=>{state.discoverSort=sorter.value;render()};
 tools.append(tabs,sorter);root.append(tools);
 const filtered=state.discoverFilter.startsWith('album:')?songs.filter(t=>albumName(t)===state.discoverFilter.slice(6)):songs;
 if(!filtered.length){state.discoverFilter='all';renderDiscover(root);return}
 const summary=el('p','music-filter-summary','当前展示 '+filtered.length+' 首歌曲 · '+albums.size+' 张专辑 · '+artists.size+' 位创作者');
 root.append(summary,rowList(sortPublicTracks(filtered,state.discoverSort)));
}
function renderAlbums(root){
 const songs=availablePublic(),albums=groupBy(songs,albumName);
 if(state.album){
  const selected=albums.get(state.album)||[];
  const header=el('div','category-header');header.append(button('← 返回专辑','',()=>{state.album=null;render()}),el('h1','',state.album));
  root.append(header);root.append(selected.length?rowList(selected):empty('专辑暂无曲目','已发布的歌曲可能已撤回。'));return;
 }
 pageHead(root,'专辑合集','按照 OST 专辑、音乐作品集浏览已公开歌曲');
 if(!albums.size){root.append(empty('暂无公开专辑','正式发布曲目后会自动创建专辑分类。'));return}
 const grid=el('div','tiles');
 for(const [name,arr] of albums)grid.append(collectionTile(name,arr.length+' 首歌曲',arr[0],()=>{state.album=name;render()},'音乐专辑'));
 root.append(grid);
}
function renderArtists(root){
 const songs=availablePublic(),artists=groupBy(songs,displayName);
 if(state.artist){
  const arr=artists.get(state.artist)||[],head=el('div','category-header');
  head.append(button('← 返回创作者','',()=>{state.artist=null;render()}),el('h1','',state.artist));
  root.append(head);root.append(arr.length?rowList(arr):empty('暂无曲目','该创作者的歌曲可能已被撤回。'));return;
 }
 pageHead(root,'歌手与创作者','用音乐记录每一段旅程');
 if(!artists.size){root.append(empty('暂无公开歌手','正式发布曲目后，创作者会自动出现在这里。'));return}
 const grid=el('div','tiles');
 for(const [name,arr] of artists)grid.append(collectionTile(name,arr.length+' 首歌曲',arr[0],()=>{state.artist=name;render()},'创作者'));
 root.append(grid);
}
/* v0.9.8.2: personal music hub. Everything here is account-scoped or explicitly public. */
function profileAction(icon,title,description,onClick,variant=''){
 const item=button('','profile-v2-action '+variant,onClick,title);
 item.append(el('span','profile-v2-action-icon',icon));
 const copy=el('span','profile-v2-action-text');
 copy.append(el('strong','',title),el('small','',description));
 item.append(copy,el('span','profile-v2-arrow','›'));
 return item;
}
function renderLocal(root){
 const panel=el('div','unified-local');
 pageHead(panel,'本机音乐馆','当前设备的音乐与离线歌单 · 不会自动上传到云端','＋ 导入音乐',()=>$('localImport').click());
 const summary=el('div','local-summary');
 summary.append(el('span','','✦ 本机已保存 '+state.local.length+' 首音乐'),el('span','','本地歌单 '+state.localPlaylists.length+' 个'));
 panel.append(summary);
 const actions=el('div','local-action-bar');
 const filters=[['all','全部音乐'],['fav','本地收藏'],['recent','最近播放'],['playlists','本地歌单']];
 for(const [value,label] of filters){
  const filter=button(label,'local-filter'+(state.localFilter===value?' active':''),()=>{state.localFilter=value;state.localPlaylistId=null;render()});
  filter.setAttribute('aria-pressed',String(state.localFilter===value));actions.append(filter);
 }
 panel.append(actions);
 if(state.localStatus)panel.append(el('p','local-warning','无法读取本机歌曲：'+state.localStatus));
 if(!state.localLoaded){panel.append(el('p','local-help','正在读取旧版音乐存档…'));root.append(panel);return}
 if(state.localFilter==='playlists'){
  const playlistBar=el('div','local-playlist-bar');
  playlistBar.append(button('＋ 创建本地歌单','soft-btn',createLocalPlaylist));
  if(state.localPlaylistId)playlistBar.append(button('← 全部本地歌单','soft-btn',()=>{state.localPlaylistId=null;render()}));
  panel.append(playlistBar);
  const selected=state.localPlaylists.find(p=>String(p.id)===String(state.localPlaylistId));
  if(selected){
   panel.append(heading(selected.name,(selected.songIds||[]).length+' 首歌曲'));
   const songs=(selected.songIds||[]).map(findLocal).filter(Boolean);
   panel.append(songs.length?rowList(songs):empty('歌单还是空的','在本地音乐列表点击 ＋，即可添加歌曲。'));
   if(songs.length){
    const controls=el('div','local-playlist-bar');
    controls.append(button('▶ 播放全部','primary-btn',()=>start(songs[0],songs)));
    controls.append(button('移除歌曲','soft-btn',()=>removeLocalFromPlaylist(selected)));
    panel.append(controls);
   }
  }else if(state.localPlaylists.length){
   const cards=el('div','local-playlist-grid');
   for(const p of state.localPlaylists){
    const count=(p.songIds||[]).length;
    const card=button('','local-playlist-card',()=>{state.localPlaylistId=String(p.id);render()});
    card.append(el('span','local-playlist-cover','♫'));
    const text=el('span','local-playlist-title');text.append(el('strong','',p.name),el('small','',count+' 首音乐'));
    card.append(text);cards.append(card);
   }
   panel.append(cards);
  }else panel.append(empty('还没有本地歌单','可直接创建歌单，旧版本地歌单也会自动显示。'));
 }else{
  let songs=availableLocal();
  if(state.localFilter==='fav')songs=songs.filter(t=>isLiked(t));
  if(state.localFilter==='recent')songs=songs.filter(t=>t.lastPlayed).sort((a,b)=>b.lastPlayed-a.lastPlayed);
  if(state.localFilter==='all')songs=songs.sort((a,b)=>b.addedAt-a.addedAt);
  panel.append(songs.length?rowList(songs):empty('这里还没有本地歌曲','可从手机或电脑选择 MP3、WAV、FLAC 等文件导入；旧版 IndexedDB 存档无需迁移。','＋ 导入音乐',()=>$('localImport').click()));
 }
 const foot=el('div','local-bottom-tools');
 foot.append(el('p','local-help','歌曲和本地歌单保存在此浏览器的 IndexedDB 中。删除浏览器站点数据会丢失本地存档；换设备不会自动同步。'));
 foot.append(button('打开旧版高级离线工具','soft-btn',()=>location.assign('./index.html?legacy=1')));
 foot.append(button('刷新本机曲库','soft-btn',()=>void loadLocalLibrary()));
 panel.append(foot);root.append(panel);
}
async function createLocalPlaylist(){
 const value=prompt('为本地歌单命名（不影响云端歌单）');
 if(value===null)return;
 const name=value.trim();
 if(!name||name.length>80){say('本地歌单名称须为 1～80 字符');return}
 const playlist={id:crypto.randomUUID(),name,description:'',songIds:[]};
 try{await saveLocalPlaylist(playlist);await loadLocalLibrary();state.localFilter='playlists';state.localPlaylistId=String(playlist.id);render();say('本地歌单已创建')}
 catch(error){say('创建本地歌单失败：'+error.message)}
}
async function addLocalToPlaylist(t){
 if(!state.localPlaylists.length){if(confirm('还没有本地歌单。现在创建吗？'))await createLocalPlaylist();return}
 const options=state.localPlaylists.map((p,i)=>(i+1)+'. '+p.name).join('\n');
 const answer=prompt('将「'+t.title+'」加入哪张本地歌单？输入序号：\n'+options);
 if(answer===null)return;
 const idx=Number(answer)-1,playlist=state.localPlaylists[idx];
 if(!Number.isInteger(idx)||!playlist){say('歌单序号无效');return}
 const ids=(playlist.songIds||[]).map(String);
 if(ids.includes(String(t.id))){say('歌曲已在该歌单中');return}
 try{
  const next={...playlist,songIds:[...(playlist.songIds||[]),localTrackData(t.id)?.id??t.id]};
  await saveLocalPlaylist(next);await loadLocalLibrary();say('已加入本地歌单：'+playlist.name);
 }catch(error){say('添加失败：'+error.message)}
}
async function removeLocalFromPlaylist(playlist){
 const songs=(playlist.songIds||[]).map(findLocal).filter(Boolean);
 if(!songs.length)return;
 const answer=prompt('输入要移除的歌曲序号（不会删除歌曲文件）：\n'+songs.map((t,i)=>(i+1)+'. '+t.title).join('\n'));
 if(answer===null)return;
 const index=Number(answer)-1;
 if(!Number.isInteger(index)||!songs[index]){say('歌曲序号无效');return}
 const target=songs[index];
 try{
  const next={...playlist,songIds:(playlist.songIds||[]).filter(id=>String(id)!==String(target.id))};
  await saveLocalPlaylist(next);await loadLocalLibrary();say('已从本地歌单移除：'+target.title);
 }catch(error){say('移除失败：'+error.message)}
}
async function importLocalFiles(files){
 if(!files?.length)return;
 say('正在保存 '+files.length+' 个本机音频文件…');
 try{
  const report=await importLocalSongs(files,state.local);
  await loadLocalLibrary();
  const detail=report.skipped.concat(report.failed).slice(0,2).join('；');
  say('本机导入 '+report.saved+' 首成功'+(detail?'；'+detail:'')+'。');
 }catch(error){say('本机导入失败：'+error.message)}
}
function renderProfile(root){
 const user=state.user, page=el('div','profile-v2');
 const hero=el('section','profile-v2-hero');
 const banner=el('div','profile-v2-hero-copy');
 banner.append(el('span','profile-v2-eyebrow','✦ AYER STAR MUSIC · TRAVELER ARCHIVE'));
 banner.append(el('h1','',user?'我的星音空间':'欢迎来到星音电台'));
 banner.append(el('p','',user?'把喜欢的旋律收藏成自己的旅程。音乐、歌单与私人曲库，在这里继续。':'聆听艾耶尔大陆的旋律。登录后可管理收藏、在线歌单及私人云音乐库。'));
 const avatar=el('div','profile-v2-avatar');
 avatar.setAttribute('aria-hidden','true');
 avatar.append(el('span','profile-v2-avatar-star','✦'),el('span','profile-v2-avatar-ring',''));
 const intro=el('div','profile-v2-intro');
 const badge=el('span','profile-v2-user-badge',user?'已登录 · 星音旅人':'访客 · 公开音乐馆');
 intro.append(badge);
 if(user){
  const name=String(user.user_metadata?.display_name||user.email?.split('@')[0]||'星音旅人');
  intro.append(el('strong','profile-v2-name',name),el('span','profile-v2-email',user.email||'星音账号'));
 }else intro.append(el('strong','profile-v2-name','从一首歌开始旅程'));
 banner.append(intro);
 const heroActions=el('div','profile-v2-hero-actions');
 heroActions.append(button(user?'管理账号':'登录 / 注册','profile-v2-primary',openAuth));
 heroActions.append(button(user?'编辑昵称':'探索音乐馆','profile-v2-secondary',user?null:()=>goto('discover')));
 banner.append(heroActions);
 hero.append(banner,avatar);page.append(hero);
 if(!user){
  const guest=el('section','profile-v2-section');
  guest.append(heading('星音旅人专属空间','登录后开启完整的个人音乐功能'));
  const links=el('div','profile-v2-actions');
  links.append(profileAction('♡','我的收藏','收藏心动旋律并同步到云端',openAuth,'favorite'));
  links.append(profileAction('☷','个人歌单','为你的冒险建立播放清单',openAuth,'playlist'));
  links.append(profileAction('♬','私人音乐','上传并保护仅自己可见的歌曲',openAuth,'private'));
  links.append(profileAction('✧','公开音乐馆','无须登录即可收听',()=>goto('discover'),'discover'));
  links.append(profileAction('♬','本机离线音乐',state.local.length+' 首保存在此设备的歌曲',()=>goto('local'),'private'));
  guest.append(links);page.append(guest);root.append(page);return;
 }
 const editBtn=heroActions.lastElementChild;
 const editor=el('form','profile-v2-editor');editor.hidden=true;
 const editLabel=el('label','','编辑旅人昵称');editLabel.setAttribute('for','profileDisplayName');
 const field=el('input');field.id='profileDisplayName';field.type='text';field.maxLength=28;field.required=true;field.autocomplete='nickname';
 field.value=String(user.user_metadata?.display_name||user.email?.split('@')[0]||'');
 const save=button('保存昵称','profile-v2-primary',null),cancel=button('取消','profile-v2-secondary',()=>{editor.hidden=true});
 save.type='submit';editLabel.append(field);editor.append(editLabel,save,cancel);banner.append(editor);
 editBtn.onclick=()=>{editor.hidden=!editor.hidden;if(!editor.hidden)field.focus()};
 editor.onsubmit=async event=>{
  event.preventDefault();
  const name=field.value.trim();
  if(!name||name.length>28){say('昵称需要填写，且不能超过 28 个字符。');return}
  save.disabled=true;
  try{
   const response=await sb.auth.updateUser({data:{display_name:name}});
   if(response.error)throw response.error;
   if(state.user?.id!==user.id)return;
   state.user=response.data?.user||{...state.user,user_metadata:{...state.user.user_metadata,display_name:name}};
   say('旅人昵称已更新。');render();
  }catch(e){say('昵称修改失败：'+e.message)}
  finally{save.disabled=false}
 };
 const publics=availablePublic(),privates=availablePrivate();
 const liked=publics.filter(t=>state.favorites.has(t.id)).concat(privates.filter(t=>t.is_favorite));
 const recent=state.history.map(h=>{const t=findPublic(h.track_id);return t?{...t,played_at:h.played_at||''}:null}).filter(Boolean)
  .concat(privates.filter(t=>t.last_played_at).map(t=>({...t,played_at:t.last_played_at})))
  .sort((a,b)=>new Date(b.played_at||0)-new Date(a.played_at||0));
 const metrics=[
  ['♡','喜欢的旋律',liked.length,'favorites','favorites'],
  ['☷','我的歌单',state.playlists.length,'playlists','playlists'],
  ['◷','收听足迹',recent.length,'recent','recent'],
  ['♬','私人音乐',privates.length,'private','private']
 ];
 const stats=el('section','profile-v2-stats');
 stats.setAttribute('aria-label','个人音乐资料概览');
 for(const [icon,label,count,view,variant] of metrics){
  const item=button('','profile-v2-stat '+variant,()=>goto(view),label+'：'+count);
  item.append(el('span','profile-v2-stat-icon',icon));
  const info=el('span','profile-v2-stat-copy');info.append(el('strong','',String(count)),el('small','',label));
  item.append(info,el('span','profile-v2-stat-chevron','›'));stats.append(item);
 }
 page.append(stats);
 const localBanner=profileAction('♬','本机离线音乐',state.local.length+' 首在当前设备保存 · 无需云端登录',()=>goto('local'),'private');
 localBanner.classList.add('profile-v2-local-entry');
 page.append(localBanner);
 const overview=el('section','profile-v2-section');
 overview.append(heading('继续你的音乐旅程','衔接上次聆听的旋律'));
 const playing=state.current&&((state.current.kind==='public'&&publics.some(t=>t.id===state.current.id))||(state.current.kind==='private'&&privates.some(t=>t.id===state.current.id)))?state.current:null;
 const featured=playing||recent[0]||liked[0]||privates[0]||publics[0];
 if(featured){
  const feature=el('div','profile-v2-now');
  const art=el('div','profile-v2-now-art','✦');setArt(featured,art);
  const copy=el('div','profile-v2-now-copy');
  copy.append(el('small','profile-v2-now-label',playing?'上次播放的歌曲':'为你找到一首旋律'));
  copy.append(el('strong','',featured.title),el('span','',displayName(featured)+' · '+albumName(featured)));
  const actions=el('div','profile-v2-now-actions');
  actions.append(button('▶ 继续播放','profile-v2-primary',()=>{if(playing&&state.current&&key(playing)===key(state.current))void requestPlayback();else void start(featured,[featured,...recent.filter(t=>key(t)!==key(featured))])}));
  actions.append(button('播放队列','profile-v2-secondary',()=>{$('queueDrawer').hidden=false;renderQueue()}));
  copy.append(actions);feature.append(art,copy);overview.append(feature);
 }else overview.append(empty('从一段旋律开始','音乐馆发布歌曲或你上传私人音乐后，即可从这里继续收听。','去发现音乐',()=>goto('discover')));
 page.append(overview);
 const entry=el('section','profile-v2-section');
 entry.append(heading('我的音乐宝库','收藏、歌单与私人音乐的专属入口'));
 const entries=el('div','profile-v2-actions');
 entries.append(profileAction('♡','喜欢的音乐',liked.length+' 首心动旋律',()=>goto('favorites'),'favorite'));
 entries.append(profileAction('☷','我的歌单',state.playlists.length+' 个在线歌单',()=>goto('playlists'),'playlist'));
 entries.append(profileAction('♬','私人云曲库',privates.length+' 首仅自己可见的音乐',()=>goto('private'),'private'));
 entries.append(profileAction('⇧','上传与管理','管理私人音乐及封面',()=>location.assign('./cloud.html'),'upload'));
 entries.append(profileAction('♬','本地音乐与歌单',state.local.length+' 首设备内音乐',()=>goto('local'),'private'));
 entry.append(entries);page.append(entry);
 const favoritesSection=el('section','profile-v2-section');
 favoritesSection.append(heading('最近喜欢的旋律','收藏中的精选歌曲','查看全部',()=>goto('favorites')));
 favoritesSection.append(liked.length?rowList(liked.slice(0,4)):empty('还没有收藏歌曲','在歌曲旁点击 ♡，收藏喜欢的旋律。','发现歌曲',()=>goto('discover')));
 page.append(favoritesSection);
 const lists=el('section','profile-v2-section');
 lists.append(heading('自己创建的歌单','为不同旅程准备不同的音乐','全部歌单',()=>goto('playlists')));
 const mini=el('div','profile-v2-playlists');
 for(const p of state.playlists.slice(0,4)){
  const count=state.items.filter(item=>item.playlist_id===p.id).length;
  mini.append(profileAction('♫',p.name,count+' 首已添加歌曲',()=>{goto('playlists');state.selectedPlaylist=p.id;render()},'playlist'));
 }
 mini.append(profileAction('＋','新建歌单','收藏专属于你的冒险旋律',()=>$('playlistDialog').showModal(),'create'));
 lists.append(mini);page.append(lists);
 if(recent.length){
  const history=el('section','profile-v2-section');
  history.append(heading('最近听过', '云端同步的播放足迹','查看全部',()=>goto('recent')));
  history.append(rowList(recent.slice(0,3)));page.append(history);
 }
 const account=el('section','profile-v2-section profile-v2-account');
 account.append(heading('旅人账号与隐私','在你的音乐空间里安心收藏与聆听'));
 const details=el('div','profile-v2-account-grid');
 const identity=el('div','profile-v2-account-item');
 identity.append(el('span','','当前账号'),el('strong','',user.email||'已登录星音账号'));
 const protection=el('div','profile-v2-account-item');
 protection.append(el('span','','私人音乐权限'),el('strong','','仅当前账号可访问'));
 details.append(identity,protection);account.append(details);
 account.append(el('p','profile-v2-privacy','私人曲目不会因加入收藏、创建歌单或进入个人主页而自动公开。只有管理员明确发布的歌曲才会进入公开音乐馆。'));
 page.append(account);
 root.append(page);
}
function renderFavorites(root){
 const arr=availablePublic().filter(t=>state.favorites.has(t.id)).concat(availablePrivate().filter(t=>t.is_favorite));
 pageHead(root,'我喜欢的音乐','已同步 '+arr.length+' 首收藏歌曲');
 root.append(arr.length?rowList(arr):empty('还没有收藏音乐','点击歌曲旁的 ♡，它会被添加到你的收藏中。','发现音乐',()=>goto('discover')));
}
function renderRecent(root){
 const arr=state.history.map(h=>findPublic(h.track_id)).filter(Boolean);
 const mine=availablePrivate().filter(t=>t.last_played_at).map(t=>({...t,played_at:t.last_played_at}));
 const fromHistory=arr.map(t=>({...t,played_at:state.history.find(h=>h.track_id===t.id)?.played_at||''}));
 const combined=fromHistory.concat(mine).sort((a,b)=>new Date(b.played_at)-new Date(a.played_at)).slice(0,100);
 pageHead(root,'最近播放','登录账号后同步最近收听记录');
 root.append(combined.length?rowList(combined):empty('还没有播放记录','开始播放一首歌曲，记录会显示在这里。','发现音乐',()=>goto('discover')));
}
function playlistTracks(id){
 const ids=state.items.filter(i=>i.playlist_id===id).sort((a,b)=>a.sort_order-b.sort_order);
 return ids.map(i=>findPublic(i.track_id)).filter(Boolean);
}
function renderPlaylists(root){
 if(state.selectedPlaylist){
  const p=state.playlists.find(p=>p.id===state.selectedPlaylist);
  if(!p){state.selectedPlaylist=null;return renderPlaylists(root)}
  const head=el('div','category-header');head.append(button('← 我的歌单','',()=>{state.selectedPlaylist=null;render()}),el('h1','',p.name));
  root.append(head);
  const songs=playlistTracks(p.id);
  if(songs.length){
  root.append(button('▶ 播放全部','primary-btn',()=>start(songs[0],songs)));
  const list=el('div','playlist-edit-list');
  songs.forEach((track,index)=>{
   const row=el('div','playlist-edit-row');
   const title=el('div','playlist-edit-title');title.append(el('strong','',track.title),el('small','',displayName(track)));
   const actions=el('div','playlist-edit-actions');
   const up=button('↑','',()=>movePlaylistTrack(p.id,track.id,-1));up.disabled=index===0;up.setAttribute('aria-label','上移 '+track.title);
   const down=button('↓','',()=>movePlaylistTrack(p.id,track.id,1));down.disabled=index===songs.length-1;down.setAttribute('aria-label','下移 '+track.title);
   actions.append(button('▶','',()=>start(track,songs)),up,down,button('移除','',()=>removePlaylistTrack(track.id)));
   row.append(title,actions);list.append(row);
  });root.append(list);
 }
  else root.append(empty('歌单还是空的','在发现音乐中，点击歌曲旁的 ＋ 即可加入这张歌单。','去添加歌曲',()=>goto('discover')));
  return;
 }
 pageHead(root,'我的在线歌单','创建只属于你的 OST 歌单和播放清单','＋ 新建歌单',()=>{$('playlistDialog').showModal()});
 if(!state.playlists.length){root.append(empty('第一张歌单，从现在开始','登录后创建歌单，已发布的歌曲可以自由收藏到歌单中。','创建歌单',()=>{$('playlistDialog').showModal()}));return}
 const list=el('div','playlist-panel');
 for(const p of state.playlists){
  const item=el('div','playlist-item'),left=el('div'),right=el('div');
  left.append(el('strong','',p.name),el('small','',state.items.filter(i=>i.playlist_id===p.id).length+' 首歌曲'));
  right.append(button('打开','',()=>{state.selectedPlaylist=p.id;render()}));
  right.append(button('重命名','',()=>renamePlaylist(p.id,p.name)));
  right.append(button('删除','',()=>deletePlaylist(p.id,p.name)));
  item.append(left,right);list.append(item);
 }
 root.append(list);
}
function renderPrivate(root){
 const songs=availablePrivate();
 pageHead(root,'私人云音乐库','当前账号拥有的歌曲 · 仅自己可见','上传 / 管理音乐',()=>location.assign('./cloud.html'));
 root.append(el('p','hint','私人音频保存在受保护的云端存储桶中。上传不代表公开发布；管理员须在管理中心手动发布后，访客才能收听。'));
 root.append(songs.length?rowList(songs):empty('还没有云端私人音乐','可以从云音乐管理页面上传，上传成功后自动同步到这里。','前往云音乐管理',()=>location.assign('./cloud.html')));
}
function normalizedSearch(text){return String(text||'').normalize('NFKC').toLocaleLowerCase().trim()}
function searchCatalog(query,tracks){
 const term=normalizedSearch(query);
 if(!term)return {tracks:[],albums:[],artists:[]};
 const matching=tracks.filter(t=>[t.title,t.artist,t.album,...(Array.isArray(t.tags)?t.tags:[])].some(value=>normalizedSearch(value).includes(term)));
 const albumMatches=[...groupBy(tracks.filter(t=>t.kind==='public'),albumName)].filter(([name])=>normalizedSearch(name).includes(term));
 const artistMatches=[...groupBy(tracks.filter(t=>t.kind==='public'),displayName)].filter(([name])=>normalizedSearch(name).includes(term));
 return {tracks:matching,albums:albumMatches,artists:artistMatches};
}
function renderSearch(root){
 const term=state.search.trim(),publicTracks=availablePublic(),privateTracks=state.user?availablePrivate():[];
 const all=publicTracks.concat(privateTracks,availableLocal()),results=searchCatalog(term,all);
 pageHead(root,'搜索结果','“'+term+'” · 找到 '+results.tracks.length+' 首歌曲');
 if(results.albums.length){
  const section=el('section','section');section.append(heading('匹配专辑','按专辑继续浏览'));
  const grid=el('div','tiles');
  for(const [name,tracks] of results.albums.slice(0,8)){
   grid.append(collectionTile(name,tracks.length+' 首歌曲',tracks[0],()=>{
    state.search='';$('searchInput').value='';state.view='albums';state.album=name;render();
   },'公开专辑'));
  }
  section.append(grid);root.append(section);
 }
 if(results.artists.length){
  const section=el('section','section');section.append(heading('匹配创作者','查看创作者作品'));
  const grid=el('div','tiles');
  for(const [name,tracks] of results.artists.slice(0,8)){
   grid.append(collectionTile(name,tracks.length+' 首歌曲',tracks[0],()=>{
    state.search='';$('searchInput').value='';state.view='artists';state.artist=name;render();
   },'创作者'));
  }
  section.append(grid);root.append(section);
 }
 const section=el('section','section');
 section.append(heading('匹配歌曲',results.tracks.length+' 首'));
 section.append(results.tracks.length?rowList(results.tracks):empty('没有找到匹配的歌曲','可以尝试歌曲名、专辑名称或创作者名称。'));
 root.append(section);
}
function render(){
 setActiveNav();
 const root=$('viewRoot');root.replaceChildren();
 if(state.search.trim()){renderSearch(root);return}
 if(!state.user&&accountRequired.includes(state.view)){
  pageHead(root,({favorites:'我喜欢的音乐',recent:'最近播放',playlists:'我的歌单',private:'私人云音乐库',profile:'个人音乐中心'})[state.view],'请登录账号后继续');
  root.append(loggedOut());return;
 }
 const pages={local:renderLocal,home:renderHome,discover:renderDiscover,albums:renderAlbums,artists:renderArtists,favorites:renderFavorites,recent:renderRecent,playlists:renderPlaylists,private:renderPrivate,profile:renderProfile};
 (pages[state.view]||renderHome)(root);
}
async function loadAll(){
 const token=++state.loadToken;
 if(!sb){state.user=null;render();say('离线模式：本机音乐可正常使用；连接网络后重新打开即可同步云端歌曲。');return}
 try{
  const publicRequest=Promise.resolve(sb.from('radio_publications').select(PUBLIC_COLS).eq('published',true).order('published_at',{ascending:false}));
  const [auth]=await Promise.all([sb.auth.getUser(),publicRequest]);
  if(token!==state.loadToken)return;
  state.user=auth.error?null:auth.data?.user||null;
  const pub=await publicRequest;
  if(pub.error)throw pub.error;
  if(token!==state.loadToken)return;
  const oldPublic=new Map(state.public.map(t=>[t.track_id,t.updated_at]));
  state.public=pub.data||[];
  for(const t of state.public)if(oldPublic.get(t.track_id)!==t.updated_at){for(const k of state.covers.keys())if(k.startsWith('public:'+t.track_id+':'))state.covers.delete(k);if(state.current?.kind==='public'&&state.current.id===t.track_id){$('playerArt').dataset.song='';$('lyricArt').dataset.song=''}}
  if(state.view==='home'&&!state.search)render();
  if(state.user){
   const results=await Promise.all([
    sb.from('radio_tracks').select(PRIVATE_COLS).is('deleted_at',null).eq('sync_state','ready').order('created_at',{ascending:false}),
    sb.from('radio_public_favorites').select('track_id').eq('user_id',state.user.id),
    sb.from('radio_listener_playlists').select('id,name,description,created_at').order('created_at',{ascending:false}),
    sb.from('radio_listener_playlist_tracks').select('playlist_id,track_id,sort_order,added_at').order('sort_order'),
    sb.from('radio_listener_history').select('track_id,played_at,play_count').order('played_at',{ascending:false}).limit(100)
   ]);
   if(token!==state.loadToken)return;
   for(const r of results)if(r.error)throw r.error;
   const oldPrivate=new Map(state.private.map(t=>[t.id,t.cover_path]));
   state.private=results[0].data||[];
   for(const t of state.private)if(oldPrivate.get(t.id)!==t.cover_path){for(const k of state.covers.keys())if(k.startsWith('private:'+t.id+':'))state.covers.delete(k);if(state.current?.kind==='private'&&state.current.id===t.id){$('playerArt').dataset.song='';$('lyricArt').dataset.song=''}}
   state.favorites=new Set((results[1].data||[]).map(x=>x.track_id));
   state.playlists=results[2].data||[];
   state.items=results[3].data||[];
   state.history=results[4].data||[];
  }else{state.private=[];state.favorites.clear();state.history=[];state.playlists=[];state.items=[]}
  $('connection').textContent=state.user?'云端已登录':'公开模式';
  $('accountBtn').textContent=state.user?(state.user.email||'我的账号'):'登录 / 注册';
  if(state.current){const refreshed=state.current.kind==='public'?findPublic(state.current.id):state.current.kind==='private'?findPrivate(state.current.id):findLocal(state.current.id);if(refreshed)state.current=refreshed}
  const current=state.current;
  if(current&&current.kind==='public'&&!state.public.some(t=>t.track_id===current.id)){
   audio.pause();audio.removeAttribute('src');audio.load();state.current=null;state.queue=[];state.index=-1;
   say('当前歌曲已被管理员撤回公开，播放已停止。');
  }
  render();updatePlayer();renderQueue();subscribe();
  restoreLocalQueue();
  if(state.user)await restoreCloudCheckpoint();else{state.cloudUser=null;state.cloudStamp=null}
  if(!current||current.kind!=='public'||state.public.some(t=>t.track_id===current.id))silent();
 }catch(e){if(token!==state.loadToken)return;say('在线音乐馆连接失败：'+e.message);render()}
}
const favoriteBusy=new Set();
async function toggleFavorite(t){
 if(t?.kind==='local'){
  const original=localTrackData(t.id);if(!original)return;
  try{await saveLocalSong({...original,fav:!original.fav});await loadLocalLibrary();render();updatePlayer()}
  catch(error){say('本地收藏更新失败：'+error.message)}
  return;
 }
 if(!requireUser())return;
 const songKey=key(t),userId=state.user.id;
 if(favoriteBusy.has(songKey))return;
 favoriteBusy.add(songKey);
 try{
  if(t.kind==='public'){
   if(state.favorites.has(t.id)){
    safeError(await sb.from('radio_public_favorites').delete().eq('track_id',t.id).eq('user_id',userId),'取消收藏');
    if(state.user?.id===userId)state.favorites.delete(t.id);
   }else{
    safeError(await sb.from('radio_public_favorites').insert({track_id:t.id,user_id:userId}),'收藏歌曲');
    if(state.user?.id===userId)state.favorites.add(t.id);
   }
  }else{
   const next=!isLiked(t);
   safeError(await sb.from('radio_tracks').update({is_favorite:next}).eq('id',t.id).eq('user_id',userId),'私人曲库收藏');
   if(state.user?.id===userId){const saved=state.private.find(x=>x.id===t.id);if(saved)saved.is_favorite=next}
  }
  if(state.user?.id===userId){render();updatePlayer()}
 }catch(e){say(e.message)}
 finally{favoriteBusy.delete(songKey)}
}
async function addPrompt(t){
 if(!requireUser())return;
 state.pendingAdd=t;
 const list=$('addTarget');list.replaceChildren();
 if(!state.playlists.length){list.append(empty('暂无歌单','先创建一张歌单，然后再添加歌曲。','创建歌单',()=>{$('addDialog').close();$('playlistDialog').showModal()}))}
 else for(const p of state.playlists){
  const exists=state.items.some(i=>i.track_id===t.id&&i.playlist_id===p.id);
  const row=el('div','playlist-item'),label=el('strong','',p.name);
  row.append(label,button(exists?'已添加':'加入','',()=>addPlaylistTrack(p.id,t.id),exists?'已添加':'添加 '+t.title));
  list.append(row);
 }
 $('addDialog').showModal();
}
async function addPlaylistTrack(playlistId,trackId){
 if(state.items.some(i=>i.playlist_id===playlistId&&i.track_id===trackId)){say('歌曲已经在这张歌单中。');return}
 try{
  const next=Math.max(-1,...state.items.filter(i=>i.playlist_id===playlistId).map(i=>Number(i.sort_order)||0))+1;
  safeError(await sb.from('radio_listener_playlist_tracks').insert({playlist_id:playlistId,track_id:trackId,sort_order:next}),'添加歌单');
  state.items.push({playlist_id:playlistId,track_id:trackId,sort_order:next});
  $('addDialog').close();say('歌曲已添加到个人在线歌单。');render();
 }catch(e){say(e.message)}
}
async function removePlaylistTrack(trackId){
 if(!state.selectedPlaylist)return;
 try{
  safeError(await sb.from('radio_listener_playlist_tracks').delete().eq('playlist_id',state.selectedPlaylist).eq('track_id',trackId),'移除歌曲');
  state.items=state.items.filter(i=>!(i.playlist_id===state.selectedPlaylist&&i.track_id===trackId));render();
 }catch(e){say(e.message)}
}
const playlistMoveBusy=new Set();
async function movePlaylistTrack(playlistId,trackId,direction){
 if(!state.user||![-1,1].includes(direction)||playlistMoveBusy.has(playlistId))return;
 const entries=state.items.filter(i=>i.playlist_id===playlistId).sort((a,b)=>a.sort_order-b.sort_order);
 const index=entries.findIndex(i=>i.track_id===trackId),other=index+direction;
 if(index<0||other<0||other>=entries.length)return;
 playlistMoveBusy.add(playlistId);
 try{
  const result=await sb.rpc('radio_move_playlist_track',{
   p_playlist_id:playlistId,p_track_id:trackId,p_direction:direction,
   p_expected_order:entries.map(i=>i.track_id)
  });
  safeError(result,'更新歌单顺序');
  const order=new Map((result.data||[]).map(i=>[i.track_id,i.sort_order]));
  for(const item of state.items)if(item.playlist_id===playlistId&&order.has(item.track_id))item.sort_order=order.get(item.track_id);
  render();say('歌单顺序已安全保存至云端。');
 }catch(e){
  say('歌单顺序可能已在其他设备改变，正在重新同步。');
  await loadAll();
 }finally{playlistMoveBusy.delete(playlistId)}
}
async function renamePlaylist(id,oldName){
 if(!state.user)return;
 const next=prompt('输入新的歌单名称',oldName);
 if(next===null)return;
 const name=next.trim();
 if(!name||name.length>80){say('歌单名称须为 1 至 80 个字符。');return}
 if(name===oldName)return;
 try{
  safeError(await sb.from('radio_listener_playlists').update({name}).eq('id',id).eq('user_id',state.user.id),'重命名歌单');
  const playlist=state.playlists.find(p=>p.id===id);if(playlist)playlist.name=name;
  render();say('歌单已重命名，其他设备登录后可同步。');
 }catch(e){say(e.message)}
}
async function deletePlaylist(id,name){
 if(!confirm('确认删除歌单「'+name+'」？仅删除歌单，不会删除原始音乐。'))return;
 try{
  safeError(await sb.from('radio_listener_playlists').delete().eq('id',id).eq('user_id',state.user.id),'删除歌单');
  state.playlists=state.playlists.filter(p=>p.id!==id);state.items=state.items.filter(i=>i.playlist_id!==id);
  render();say('歌单已删除，歌曲文件保持不变。');
 }catch(e){say(e.message)}
}
/* v0.8.4.1: account-scoped cloud playback checkpoint, never sync protected media URLs. */
/* v0.8.6: local queue fallback + short-lived next-track URL preparation. */
const ENGINE_QUEUE_KEY='ayer-music-queue-v086';
let nextSource=null,networkRetry=null;
function persistLocalQueue(){
 try{localStorage.setItem(ENGINE_QUEUE_KEY,JSON.stringify({queue:state.queue.filter(t=>t&&['public','private','local'].includes(t.kind)).slice(0,200).map(t=>({kind:t.kind,id:t.id})),current:state.current?{kind:state.current.kind,id:state.current.id}:null,position:audio.currentTime||state.pendingResume||recoveryPosition||0,shuffle:state.shuffle,repeat:state.repeat,updated:Date.now()}))}catch(_e){}
}
function restoreLocalQueue(){
 if(state.current)return;
 try{
  const data=JSON.parse(localStorage.getItem(ENGINE_QUEUE_KEY)||'null');
  if(!data||!Array.isArray(data.queue))return;
  const resolve=ref=>ref?.kind==='local'?findLocal(ref.id):cloudTrack(ref);
  const q=data.queue.slice(0,200).map(resolve).filter(Boolean);
  const current=resolve(data.current);
  if(!current)return;
  state.current=current;state.queue=q.some(t=>key(t)===key(current))?q:[current,...q];
  state.index=state.queue.findIndex(t=>key(t)===key(current));
  state.pendingResume=Math.max(0,Number(data.position)||0);
  state.shuffle=!!data.shuffle;state.repeat=!!data.repeat;
  updatePlayer();renderQueue();renderLyric();
 }catch(e){console.warn('本地播放队列恢复失败',e)}
}
async function prepareNextSource(){
 const next=state.queue[state.index+1]||state.queue[0];
 if(!next||next.kind==='local'||!navigator.onLine){nextSource=null;return}
 const signature=key(next),token=state.playToken;
 try{
  const url=await sourceFor(next);
  if(token===state.playToken&&state.queue.some(t=>key(t)===signature))nextSource={signature,url,expires:Date.now()+180000};
 }catch(_e){nextSource=null}
}
let wantsPlayback=false,recoveryBusy=false,recoveryAttempts=0,recoveryPosition=0,lastLocalSave=0;
function cancelRecovery(){clearTimeout(networkRetry);networkRetry=null;recoveryAttempts=0}
function scheduleNetworkRecovery(){
 if(networkRetry||recoveryBusy||!wantsPlayback||!state.current||!navigator.onLine||recoveryAttempts>=3)return;
 networkRetry=setTimeout(()=>{networkRetry=null;void retryCurrentSource()},[1200,3500,8000][recoveryAttempts]);
}
async function retryCurrentSource(){
 const t=state.current,token=state.playToken;
 if(!t||!wantsPlayback||recoveryBusy||!navigator.onLine)return;
 recoveryBusy=true;recoveryAttempts++;
 const position=Math.max(audio.currentTime||0,recoveryPosition,state.pendingResume||0);
 try{
  const url=await sourceFor(t);
  if(token!==state.playToken||!wantsPlayback)return;
  audio.src=url;
  audio.addEventListener('loadedmetadata',()=>{if(token===state.playToken&&Number.isFinite(audio.duration))audio.currentTime=Math.min(position,Math.max(0,audio.duration-0.1))},{once:true});
  audio.load();
  await audio.play();
 }catch(e){if(token===state.playToken&&wantsPlayback)say('播放恢复失败，正在尝试重新连接。')}
 finally{recoveryBusy=false;if(token===state.playToken&&wantsPlayback&&(audio.paused||audio.error))scheduleNetworkRecovery()}
}
function pausePlayback(){wantsPlayback=false;cancelRecovery();audio.pause();persistLocalQueue()}
async function requestPlayback(){
 wantsPlayback=true;
 if(audio.src){if(!audio.paused)return;if(audio.error){recoveryAttempts=0;await retryCurrentSource();return}try{await audio.play()}catch(e){say('无法开始播放：'+e.message)}return}
 const t=state.current||availablePublic()[0]||availablePrivate()[0];if(t)await start(t,state.queue);else wantsPlayback=false;
}
function cloudTrack(ref){
 if(!ref||!['public','private'].includes(ref.kind))return null;
 return ref.kind==='public'?findPublic(ref.id):findPrivate(ref.id);
}
function cloudQueueRefs(){
 return state.queue.filter(t=>t&&['public','private'].includes(t.kind)).slice(0,200).map(t=>({kind:t.kind,id:t.id}));
}
async function saveCloudCheckpoint(force=false){
 if(!state.user||state.cloudRestoring||!state.current||state.current.kind==='local')return;
 const now=Date.now();if(!force&&now-state.lastSyncAt<12000)return;
 state.lastSyncAt=now;
 const userId=state.user.id;
 const data={user_id:userId,current_kind:state.current.kind,current_track_id:state.current.id,
  position_seconds:Math.max(0,Number.isFinite(audio.currentTime)?audio.currentTime:0),
  queue:cloudQueueRefs(),shuffle:state.shuffle,repeat_one:state.repeat,updated_at:new Date().toISOString()};
 try{
  const r=await sb.from('radio_listener_sync').upsert(data,{onConflict:'user_id'});
  if(r.error)throw r.error;
  if(state.user?.id===userId)state.cloudStamp=data.updated_at;
 }catch(e){console.warn('云端播放状态保存失败',e)}
}
async function restoreCloudCheckpoint(){
 const user=state.user;if(!user||state.current?.kind==='local'||state.cloudUser===user.id)return;
 state.cloudUser=user.id;
 try{
  const r=await sb.from('radio_listener_sync').select('current_kind,current_track_id,position_seconds,queue,shuffle,repeat_one,updated_at').eq('user_id',user.id).maybeSingle();
  if(r.error)throw r.error;
  if(state.user?.id!==user.id||!r.data)return;
  const saved=r.data;
  if(state.current&&!audio.paused)return;
  state.cloudRestoring=true;
  const q=Array.isArray(saved.queue)?saved.queue.slice(0,200).map(cloudTrack).filter(Boolean):[];
  const selected=cloudTrack({kind:saved.current_kind,id:saved.current_track_id});
  if(selected){
   state.current=selected;
   state.queue=q.some(t=>key(t)===key(selected))?q:[selected,...q];
   state.index=state.queue.findIndex(t=>key(t)===key(selected));
   state.shuffle=!!saved.shuffle;state.repeat=!!saved.repeat_one;
   state.pendingResume=Math.max(0,Number(saved.position_seconds)||0);
   // Restore only metadata. Browser autoplay policy requires a user gesture to start audio.
   updatePlayer();renderQueue();renderLyric();
   say('已同步上次播放：'+selected.title+'。点击播放继续收听。');
  }
  state.cloudStamp=saved.updated_at;
 }catch(e){console.warn('跨浏览器播放状态恢复失败',e)}
 finally{state.cloudRestoring=false}
}
let lastMediaPositionSecond=-1;
function updateMediaPosition(){
 if(!('mediaSession' in navigator)||typeof navigator.mediaSession.setPositionState!=='function')return;
 if(!state.current||!Number.isFinite(audio.duration)||audio.duration<=0)return;
 const second=Math.floor(audio.currentTime);
 if(second===lastMediaPositionSecond)return;
 lastMediaPositionSecond=second;
 try{navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate||1,position:Math.max(0,Math.min(audio.duration,audio.currentTime))})}catch(_e){}
}
function seekBy(seconds){
 if(!Number.isFinite(audio.duration)||audio.duration<=0)return;
 audio.currentTime=Math.max(0,Math.min(audio.duration, audio.currentTime+seconds));
 updateMediaPosition();
}
function updateMiniProgress(){
 const duration=audio.duration;
 const progress=Number.isFinite(duration)&&duration>0?Math.max(0,Math.min(1,audio.currentTime/duration)):0;
 $('miniProgressFill').style.transform='scaleX('+progress+')';
}
function setMobileSearchOpen(open,clearOnClose=false){
 const bar=document.querySelector('.topbar');
 bar.classList.toggle('search-open',open);
 $('mobileSearchToggle').setAttribute('aria-expanded',String(open));
 $('mobileSearchToggle').setAttribute('aria-label',open?'关闭搜索':'展开搜索');
 if(open)$('searchInput').focus();
 else if(clearOnClose&&state.search){state.search='';$('searchInput').value='';render()}
}
function updatePlayer(){
 updateMiniProgress();
 const t=state.current;
 $('nowTitle').textContent=t?t.title:'等待播放';
 $('nowArtist').textContent=t?displayName(t):'在音乐馆选择一首歌曲';
 $('playBtn').textContent=audio.paused?'▶':'Ⅱ';
 $('detailPlay').textContent=audio.paused?'▶':'Ⅱ';
 $('detailPlay').setAttribute('aria-label',audio.paused?'播放':'暂停');
 $('playBtn').setAttribute('aria-label',audio.paused?'播放':'暂停');
 $('likeNow').textContent=t&&isLiked(t)?'♥':'♡';
 $('likeNow').classList.toggle('active',!!(t&&isLiked(t)));
 $('shuffleBtn').classList.toggle('active',state.shuffle);
 $('repeatBtn').classList.toggle('active',state.repeat);
 $('repeatBtn').textContent=state.repeat?'↻¹':'↻';
 $('detailShuffle').classList.toggle('active',state.shuffle);
 $('detailRepeat').classList.toggle('active',state.repeat);
 $('detailRepeat').textContent=state.repeat?'↻¹':'↻';
 $('vinyl').classList.toggle('is-playing',!!t&&!audio.paused&&!audio.ended&&audio.readyState>=2);
 $('lyricDisc').classList.toggle('is-playing',!!t&&!audio.paused&&!audio.ended&&audio.readyState>=2);
 $('tonearm').classList.toggle('is-playing',!!t&&!audio.paused&&!audio.ended&&audio.readyState>=2);
 $('lyricHeading').textContent=t?t.title:'实时歌词';
 $('lyricArtist').textContent=t?displayName(t):'星音电台';
 $('timeNow').textContent=formatTime(audio.currentTime);
 $('timeTotal').textContent=formatTime(audio.duration);
 $('detailTimeNow').textContent=formatTime(audio.currentTime);
 $('detailTimeTotal').textContent=formatTime(audio.duration);
 if(Number.isFinite(audio.duration)&&audio.duration>0)$('detailSeek').value=String(100*audio.currentTime/audio.duration);
 if(t){
  const signature=key(t);
  if($('playerArt').dataset.song!==signature){
   $('playerArt').dataset.song=signature;$('lyricArt').dataset.song=signature;
   setArt(t,$('playerArt'));setArt(t,$('lyricArt'));
   artwork(t).then(url=>{if(state.current&&key(state.current)===signature)$('detailBackdrop').style.backgroundImage=url?'url("'+url.replace(/"/g,'%22')+'")':'none'});
  }
 }else{
  $('playerArt').dataset.song='';$('lyricArt').dataset.song='';
  $('playerArt').textContent='✦';$('lyricArt').textContent='✦';$('detailBackdrop').style.backgroundImage='none';
 }
 if('mediaSession' in navigator&&t){
  navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:displayName(t),album:albumName(t)});
  navigator.mediaSession.playbackState=audio.paused?'paused':'playing';
  updateMediaPosition();
 }
}
function parseLyrics(raw){
 const entries=[],map=new Map();
 for(const line of String(raw||'').split(/\r?\n/)){
  const m=line.trim().match(/^\[(\d{1,3}):(\d\d)[.:](\d{1,3})\](.*)$/);
  if(!m)continue;
  const sec=Number(m[1])*60+Number(m[2])+Number(m[3])/Math.pow(10,m[3].length),k=sec.toFixed(2);
  const s=m[4].trim(),translated=/^(?:\[tr\]|\[译\]|译[:：])/.test(s),txt=s.replace(/^(?:\[tr\]|\[译\]|译[:：])\s*/,'');
  if(!map.has(k)){const obj={sec,main:'',translation:''};entries.push(obj);map.set(k,obj)}
  if(translated)map.get(k).translation=txt;else if(!map.get(k).main)map.get(k).main=txt;
 }
 if(!entries.length&&String(raw||'').trim())return String(raw).split(/\r?\n/).filter(Boolean).map((s,i)=>({sec:i*7,main:s,translation:''}));
 return entries.sort((a,b)=>a.sec-b.sec);
}
function renderLyric(){
 const root=$('lyricLines');root.replaceChildren();
 state.lyricIndex=-1;state.lyrics=parseLyrics(state.current?.lyrics||'');
 if(!state.lyrics.length){root.append(empty('暂无歌词','可以在云音乐管理中为歌曲填写 LRC 时间轴歌词。'));return}
 for(let i=0;i<state.lyrics.length;i++){
  const l=state.lyrics[i],n=button(l.main||'♪','lyric-line',()=>{audio.currentTime=l.sec});
  n.dataset.index=i;if(l.translation)n.append(el('span','lyric-translation',l.translation));
  root.append(n);
 }
 updateLyric();
}
let lyricScrollFrame=0;
function updateLyric(){
 let index=-1;for(let i=0;i<state.lyrics.length;i++){if(audio.currentTime+0.09>=state.lyrics[i].sec)index=i;else break}
 if(index===state.lyricIndex)return;state.lyricIndex=index;
 const children=$('lyricLines').querySelectorAll('.lyric-line');
 children.forEach((node,i)=>node.classList.toggle('active',i===index));
 if(index>=0&&detailIsOpen()&&$('lyricsDialog').classList.contains('mode-lyrics')){
  cancelAnimationFrame(lyricScrollFrame);
  lyricScrollFrame=requestAnimationFrame(()=>children[index]?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}));
 }
}
async function start(t,scope){
 if(!t)return;
 wantsPlayback=true;cancelRecovery();recoveryPosition=0;lastLocalSave=0;
 const list=Array.isArray(scope)&&scope.length?scope:state.search?availablePublic().concat(state.user?availablePrivate():[],availableLocal()):(state.view==='local'?availableLocal():state.view==='private'?availablePrivate():availablePublic());
 state.queue=list.filter(x=>x&&x.id);
 if(!state.queue.some(x=>key(x)===key(t)))state.queue.unshift(t);
 state.index=state.queue.findIndex(x=>key(x)===key(t));
 state.current=t;state.recordedKey=null;
 const resumePosition=state.pendingResume;state.pendingResume=0;
 const token=++state.playToken;
 audio.pause();audio.removeAttribute('src');audio.load();
 if(t.kind!=='local'&&state.localAudioUrl){
  URL.revokeObjectURL(state.localAudioUrl);state.localAudioUrl=null;state.localAudioId=null;
 }
 recoveryPosition=resumePosition;persistLocalQueue();
 $('seekBar').value=0;$('timeNow').textContent='0:00';updatePlayer();renderLyric();renderQueue();
 try{
  const cached=nextSource&&nextSource.signature===key(t)&&nextSource.expires>Date.now()?nextSource.url:null;
  nextSource=null;
  const source=cached||await sourceFor(t);if(token!==state.playToken||!wantsPlayback)return;
  audio.src=source;audio.load();
  if(resumePosition>0){const resume=resumePosition;audio.addEventListener('loadedmetadata',()=>{if(token===state.playToken&&Number.isFinite(audio.duration))audio.currentTime=Math.min(resume,Math.max(0,audio.duration-1))},{once:true})}
  void prepareNextSource();
  try{await audio.play();void saveCloudCheckpoint(true)}catch(e){if(e.name!=='AbortError')say('曲目已就绪，请再次点击播放键。')}
 }catch(e){if(token===state.playToken)say('无法播放「'+t.title+'」：'+e.message)}
}
async function togglePlay(){if(wantsPlayback&&!audio.paused)pausePlayback();else await requestPlayback()}
function advance(back=false,fromEnded=false){
 const arr=state.queue;if(!arr.length)return;
 if(back&&audio.currentTime>3){audio.currentTime=0;return}
 if(fromEnded&&state.repeat){audio.currentTime=0;audio.play().catch(()=>{});return}
 let ix=state.index;
 if(!back&&state.shuffle&&arr.length>1){const options=arr.map((_,i)=>i).filter(i=>i!==ix);ix=options[Math.floor(Math.random()*options.length)]}
 else ix=back?(ix<=0?arr.length-1:ix-1):(ix+1);
 if(ix>=arr.length){if(fromEnded){pausePlayback();updatePlayer();return}ix=0}
 if(ix<0)ix=arr.length-1;
 start(arr[ix],arr);
}
function renderQueue(){
 const box=$('queueItems');box.replaceChildren();$('queueCount').textContent=state.queue.length;
 if(!state.queue.length){box.append(empty('播放列表为空','点击任何歌曲开始播放。'));return}
 for(let i=0;i<state.queue.length;i++)box.append(row(state.queue[i],i,state.queue));
}
async function recordPlay(){
 const t=state.current;if(!t||state.recordedKey===key(t))return;
 if(t.kind==='local'){
  state.recordedKey=key(t);
  const original=localTrackData(t.id);if(!original)return;
  try{await saveLocalSong({...original,lastPlayed:Date.now()});original.lastPlayed=Date.now()}
  catch(error){console.warn('本地播放历史更新失败',error)}
  return;
 }
 if(!state.user)return;
 state.recordedKey=key(t);
 try{
  if(t.kind==='private'){
   const date=new Date().toISOString();
   const r=await sb.from('radio_tracks').update({last_played_at:date}).eq('id',t.id).eq('user_id',state.user.id);
   if(!r.error){const x=state.private.find(x=>x.id===t.id);if(x)x.last_played_at=date}
  }else{
   const date=new Date().toISOString(),found=state.history.find(h=>h.track_id===t.id);
   const r=await sb.from('radio_listener_history').upsert({user_id:state.user.id,track_id:t.id,played_at:date,play_count:Math.min((found?.play_count||0)+1,100000000)},{onConflict:'user_id,track_id'});
   if(!r.error){state.history=state.history.filter(h=>h.track_id!==t.id);state.history.unshift({track_id:t.id,played_at:date,play_count:(found?.play_count||0)+1})}
  }
 }catch(e){console.warn('播放记录同步失败',e)}
}
function subscribe(){
 if(state.channel)sb.removeChannel(state.channel);
 const channel=sb.channel('ayer-star-music-v080')
  .on('postgres_changes',{event:'*',schema:'public',table:'radio_publications'},()=>loadAll());
 if(state.user){
  channel.on('postgres_changes',{event:'*',schema:'public',table:'radio_tracks',filter:'user_id=eq.'+state.user.id},()=>loadAll());
  channel.on('postgres_changes',{event:'*',schema:'public',table:'radio_listener_playlists',filter:'user_id=eq.'+state.user.id},()=>loadAll());
  channel.on('postgres_changes',{event:'*',schema:'public',table:'radio_listener_playlist_tracks'},()=>loadAll());
  channel.on('postgres_changes',{event:'*',schema:'public',table:'radio_public_favorites',filter:'user_id=eq.'+state.user.id},()=>loadAll());
  channel.on('postgres_changes',{event:'*',schema:'public',table:'radio_listener_history',filter:'user_id=eq.'+state.user.id},()=>loadAll());
  // Cross-browser favorites/playlists already refresh via Realtime. Playback is restored on login.
 }
 state.channel=channel.subscribe();
}
function openAuth(){
 if(!sb){say('当前离线状态无法登录；本机音乐不需要登录。');return}
 $('authDialog').showModal();$('signedIn').hidden=!state.user;$('authForm').hidden=!!state.user;
 $('signedInEmail').textContent=state.user?'已登录：'+(state.user.email||''):''; 
}
function syncVisualViewport(){
 const vv=window.visualViewport;
 if(!vv)return;
 const bottom=Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop));
 document.documentElement.style.setProperty('--visual-bottom',bottom+'px');
}
let detailCloseTimer=0;
let detailLastFocus=null;
function detailIsOpen(){return !$('lyricsDialog').hidden}
function setDetailMode(mode){
 const lyrics=mode==='lyrics';
 $('lyricsDialog').classList.toggle('mode-lyrics',lyrics);
 $('showDisc').classList.toggle('active',!lyrics);
 $('showLyrics').classList.toggle('active',lyrics);
 $('showDisc').setAttribute('aria-pressed',String(!lyrics));
 $('showLyrics').setAttribute('aria-pressed',String(lyrics));
 if(lyrics){state.lyricIndex=-1;updateLyric();}
}
function openPlayerDetail(){
 const d=$('lyricsDialog');if(detailIsOpen())return;
 clearTimeout(detailCloseTimer);detailLastFocus=document.activeElement;
 d.hidden=false;d.setAttribute('aria-hidden','false');
 setDetailMode('disc');
 const origin=$('vinyl').getBoundingClientRect();
 const disc=$('lyricDisc');
 disc.style.setProperty('--disc-from-x',Math.round(origin.left+origin.width/2-window.innerWidth/2)+'px');
 disc.style.setProperty('--disc-from-y',Math.round(origin.top+origin.height/2-window.innerHeight/2)+'px');
 document.body.classList.add('detail-open');renderLyric();updatePlayer();
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!d.hidden)d.classList.add('detail-visible')}));
 $('closeLyrics').focus({preventScroll:true});
}
function closePlayerDetail(){
 const d=$('lyricsDialog');if(d.hidden)return;
 d.classList.remove('detail-visible');document.body.classList.remove('detail-open');
 cancelAnimationFrame(lyricScrollFrame);
 d.setAttribute('aria-hidden','true');clearTimeout(detailCloseTimer);
 const finish=()=>{if(d.classList.contains('detail-visible'))return;d.hidden=true;if(detailLastFocus?.isConnected)detailLastFocus.focus({preventScroll:true})};
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
 detailCloseTimer=setTimeout(finish,420);
}
function attach(){
 syncVisualViewport();
 if(window.visualViewport){
  window.visualViewport.addEventListener('resize',syncVisualViewport,{passive:true});
  window.visualViewport.addEventListener('scroll',syncVisualViewport,{passive:true});
 }
 window.addEventListener('resize',syncVisualViewport,{passive:true});
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.view)));
 $('searchInput').addEventListener('input',e=>{state.search=e.target.value;render()});
 $('localImport').addEventListener('change',event=>{const files=Array.from(event.target.files||[]);event.target.value='';void importLocalFiles(files)});
 $('mobileSearchToggle').onclick=()=>setMobileSearchOpen(!document.querySelector('.topbar').classList.contains('search-open'),true);
 $('searchInput').addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.topbar').classList.contains('search-open')){e.stopPropagation();setMobileSearchOpen(false,true);$('mobileSearchToggle').focus()}});
 $('accountBtn').onclick=openAuth;
 $('closeAuth').onclick=()=>$('authDialog').close();
 $('closePlaylist').onclick=()=>$('playlistDialog').close();
 $('closeAdd').onclick=()=>{$('addDialog').close();state.pendingAdd=null};
 $('closeLyrics').onclick=closePlayerDetail;
 $('showDisc').onclick=()=>setDetailMode('disc');
 $('showLyrics').onclick=()=>setDetailMode('lyrics');
 let detailTouchStart=null;
 $('lyricsDialog').addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('button,input,.lyric-lines,.detail-controls'))return;detailTouchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
 $('lyricsDialog').addEventListener('touchcancel',()=>{detailTouchStart=null},{passive:true});
 $('lyricsDialog').addEventListener('touchend',e=>{if(!detailTouchStart||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-detailTouchStart.x,dy=e.changedTouches[0].clientY-detailTouchStart.y;detailTouchStart=null;if(dy>100&&Math.abs(dy)>Math.abs(dx)*1.3)closePlayerDetail();else if(Math.abs(dx)>95&&Math.abs(dx)>Math.abs(dy)*1.3)advance(dx>0)},{passive:true});
 $('openPlayer').addEventListener('click',e=>{if(e.target.closest('#likeNow'))return;openPlayerDetail()});
 $('openPlayer').addEventListener('keydown',e=>{if(e.target!==$('openPlayer'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();openPlayerDetail()}});
 $('likeNow').addEventListener('click',e=>e.stopPropagation());
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&detailIsOpen()){e.preventDefault();closePlayerDetail()}});
 $('lyricsDialog').addEventListener('click',e=>{if(e.target===$('lyricsDialog'))closePlayerDetail()});
 $('detailPlay').onclick=togglePlay;
 $('detailPrev').onclick=()=>advance(true);
 $('detailNext').onclick=()=>advance(false);
 $('detailShuffle').onclick=()=>{state.shuffle=!state.shuffle;updatePlayer();void saveCloudCheckpoint(true)};
 $('detailRepeat').onclick=()=>{state.repeat=!state.repeat;updatePlayer();void saveCloudCheckpoint(true)};
 $('detailQueueBtn').onclick=()=>{closePlayerDetail();$('queueDrawer').hidden=false;renderQueue()};
 $('detailSeek').oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)/100*audio.duration};
 $('authForm').onsubmit=async e=>{
  e.preventDefault();$('signIn').disabled=true;
  try{safeError(await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}),'登录失败');$('authDialog').close();$('password').value='';await loadAll()}
  catch(e){say(e.message);alert(e.message)}finally{$('signIn').disabled=false}
 };
 $('signUp').onclick=async()=>{
  const email=$('email').value.trim(),password=$('password').value;
  if(!email||password.length<6){say('请填写邮箱及至少 6 位密码。');return}
  $('signUp').disabled=true;
  try{
   const r=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
   safeError(r,'注册失败');say('注册请求已提交。若启用邮箱验证，请查收邮件完成验证后登录。');
   alert('注册请求已提交；如收到验证邮件，请先完成邮箱验证。');
  }catch(e){say(e.message);alert(e.message)}finally{$('signUp').disabled=false}
 };
 $('signOut').onclick=async()=>{await sb.auth.signOut();$('authDialog').close();clearArtObjects();state.current=null;state.playToken++;pausePlayback();audio.removeAttribute('src');audio.load();await loadAll()};
 $('playlistForm').onsubmit=async e=>{
  e.preventDefault();if(!requireUser())return;
  const name=$('playlistName').value.trim();if(!name)return;
  const submit=$('playlistForm').querySelector('button[type=submit]');submit.disabled=true;
  try{
   const r=await sb.from('radio_listener_playlists').insert({name,user_id:state.user.id}).select('id,name,description,created_at').single();
   const created=safeError(r,'创建歌单');state.playlists.unshift(created);$('playlistDialog').close();$('playlistName').value='';
   if(state.pendingAdd){const pending=state.pendingAdd;state.pendingAdd=null;await addPlaylistTrack(created.id,pending.id)}
   else{state.view='playlists';render();say('个人在线歌单已创建。')}
  }catch(e){say(e.message)}finally{submit.disabled=false}
 };
 $('playBtn').onclick=togglePlay;
 $('prevBtn').onclick=()=>advance(true);
 $('nextBtn').onclick=()=>advance(false);
 $('shuffleBtn').onclick=()=>{state.shuffle=!state.shuffle;updatePlayer()};
 $('repeatBtn').onclick=()=>{state.repeat=!state.repeat;updatePlayer()};
 $('likeNow').onclick=()=>{if(state.current)toggleFavorite(state.current)};
 $('queueBtn').onclick=()=>{$('queueDrawer').hidden=!$('queueDrawer').hidden;renderQueue()};
 $('closeQueue').onclick=()=>{$('queueDrawer').hidden=true};
 $('lyricsBtn').onclick=openPlayerDetail;
 $('seekBar').oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)/100*audio.duration};
 function setVolume(value){
  const v=Math.max(0,Math.min(1,Number(value)||0));
  audio.volume=v;
  $('volume').value=String(v);
  $('detailVolume').value=String(v);
  $('detailVolumeValue').textContent=Math.round(v*100)+'%';
  try{localStorage.setItem('ayer-music-volume-v2',String(v))}catch(_e){}
 }
 $('volume').oninput=e=>setVolume(e.target.value);
 $('detailVolume').oninput=e=>setVolume(e.target.value);
 let savedVolume=1;
 try{const saved=localStorage.getItem('ayer-music-volume-v2');if(saved!==null&&Number.isFinite(Number(saved)))savedVolume=Number(saved)}catch(_e){}
 setVolume(savedVolume);
 audio.addEventListener('timeupdate',()=>{
  updateMiniProgress();
  if(Number.isFinite(audio.duration)&&audio.duration>0)$('seekBar').value=String(100*audio.currentTime/audio.duration);
  $('timeNow').textContent=formatTime(audio.currentTime);
  $('detailTimeNow').textContent=formatTime(audio.currentTime);
  if(Number.isFinite(audio.duration)&&audio.duration>0)$('detailSeek').value=String(100*audio.currentTime/audio.duration);
  updateLyric();
  updateMediaPosition();
  if(!audio.paused){recoveryPosition=audio.currentTime;void saveCloudCheckpoint();if(Date.now()-lastLocalSave>=10000){lastLocalSave=Date.now();persistLocalQueue()}}
 });
 audio.addEventListener('durationchange',()=>{lastMediaPositionSecond=-1;updatePlayer()});
 audio.addEventListener('seeked',()=>{void saveCloudCheckpoint(true);persistLocalQueue()});
 audio.addEventListener('pause',()=>{void saveCloudCheckpoint(true);persistLocalQueue()});
 window.addEventListener('online',scheduleNetworkRecovery);
 window.addEventListener('pagehide',persistLocalQueue);
 window.addEventListener('offline',()=>{if(wantsPlayback)recoveryPosition=audio.currentTime||recoveryPosition;persistLocalQueue()});
 for(const ev of ['playing','play','pause','waiting','canplay','ended','seeking'])audio.addEventListener(ev,()=>{updatePlayer();if(ev==='playing'){cancelRecovery();recordPlay()}});
 audio.addEventListener('ended',()=>advance(false,true));
 audio.addEventListener('error',()=>{if(state.current){say('音频加载失败，请确认网络与音乐的发布状态。');scheduleNetworkRecovery()}});
 $('mobileMenu').onclick=()=>{document.querySelector('.sidebar').classList.toggle('open');$('backdrop').hidden=!document.querySelector('.sidebar').classList.contains('open')};
 $('backdrop').onclick=()=>{document.querySelector('.sidebar').classList.remove('open');$('backdrop').hidden=true};
 if('mediaSession' in navigator){
  const actions={play:requestPlayback,pause:pausePlayback,previoustrack:()=>advance(true),nexttrack:()=>advance(false),seekbackward:details=>seekBy(-(Number(details?.seekOffset)||10)),seekforward:details=>seekBy(Number(details?.seekOffset)||10),seekto:details=>{if(Number.isFinite(details.seekTime)&&Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration,details.seekTime))}};
  for(const [name,fn] of Object.entries(actions)){try{navigator.mediaSession.setActionHandler(name,fn)}catch(_e){}}
 }
 if(sb)sb.auth.onAuthStateChange((event,session)=>{if(event==='INITIAL_SESSION')return;const next=session?.user?.id||null;if(next!==state.user?.id)queueMicrotask(()=>{clearArtObjects();loadAll()})});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(wantsPlayback&&(audio.error||audio.paused))scheduleNetworkRecovery();loadAll()}else persistLocalQueue()});
 setInterval(()=>{if(document.visibilityState==='visible')loadAll()},60000);
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
attach();void loadLocalLibrary().then(()=>loadAll());
