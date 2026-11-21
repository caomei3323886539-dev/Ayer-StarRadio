import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const API='https://nnoffobuktejgtmwfvbn.supabase.co';
const PUBLISHABLE='sb_publishable_ypAoa0UggQNWR9Rt9HWelQ_ao_Ih5Yw';
const sb=createClient(API,PUBLISHABLE,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const audio=$('audio');
const state={
 user:null,public:[],private:[],favorites:new Set(),history:[],playlists:[],items:[],
 view:'home',search:'',album:null,artist:null,selectedPlaylist:null,
 queue:[],current:null,index:-1,shuffle:false,repeat:false,
 covers:new Map(),coverObjects:[],lyrics:[],lyricIndex:-1,channel:null,
 pendingAdd:null,playToken:0,recordedKey:null,loadToken:0
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
function findPublic(id){const t=state.public.find(t=>t.track_id===id);return t?{...t,kind:'public',id:t.track_id}:null}
function findPrivate(id){const t=state.private.find(t=>t.id===id);return t?{...t,kind:'private'}:null}
function isLiked(t){return t?.kind==='public'?state.favorites.has(t.id):!!state.private.find(x=>x.id===t?.id)?.is_favorite}
function requireUser(){if(state.user)return true;openAuth();say('请先登录星音账号，才能使用个人音乐功能。');return false}
function setActiveNav(){
 document.querySelectorAll('[data-view]').forEach(b=>{
  const active=b.dataset.view===state.view&&!state.search;
  b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
}
function goto(view){
 state.view=view;state.search='';$('searchInput').value='';
 state.album=null;state.artist=null;state.selectedPlaylist=null;
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
 if(t.kind==='public')return mediaUrl(t.id,'audio');
 if(!state.user||!t.audio_path)throw Error('私人曲目无效或尚未登录');
 const result=await sb.storage.from('ayer-audio').createSignedUrl(t.audio_path,3600);
 return safeError(result,'私人音乐访问').signedUrl;
}
async function artwork(t){
 const k=key(t);
 if(state.covers.has(k))return state.covers.get(k);
 let url=null;
 try{
  if(t.kind==='public')url=await mediaUrl(t.id,'cover');
  else if(t.cover_path&&state.user){
   const r=await sb.storage.from('ayer-covers').download(t.cover_path);
   if(r.error)throw r.error;
   url=URL.createObjectURL(r.data);state.coverObjects.push(url);
  }
 }catch(_e){/* Artwork is optional. Keep a neutral placeholder. */}
 state.covers.set(k,url);
 return url;
}
function setArt(t,holder){
 if(!t||!holder)return;
 holder.replaceChildren();
 holder.textContent='✦';
 artwork(t).then(url=>{
  if(!url||!holder.isConnected)return;
  const img=el('img');img.alt=t.title+' 的封面';img.loading='lazy';img.src=url;
  img.onerror=()=>{img.remove();if(!holder.textContent)holder.textContent='✦'};
  holder.replaceChildren(img);
 });
}
function clearArtObjects(){
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
 const songs=availablePublic();
 const hero=el('section','hero'),copy=el('div');
 copy.append(el('span','eyebrow','AYER STAR MUSIC · ORIGINAL OST'),el('h1','','让每一段旅程，都有属于自己的旋律'),el('p','','从艾耶尔大陆的清晨，到神之谷的星空。聆听已正式发布的原创音乐，收藏你喜欢的声音。'));
 const actions=el('div','hero-actions');
 actions.append(button('♫ 发现音乐','primary-btn',()=>goto('discover')));
 actions.append(button('我的音乐','soft-btn',()=>goto('private')));
 copy.append(actions);
 const heroImg=el('div','hero-art','✦');if(songs.length)setArt(songs[0],heroImg);
 hero.append(copy,heroImg);root.append(hero);
 const section=el('section','section');section.append(heading('最新公开歌曲',songs.length+' 首经过正式发布的音乐','查看全部',()=>goto('discover')));
 section.append(songs.length?tiles(songs.slice(0,8)):empty('公开音乐馆等待开幕','管理员尚未正式发布歌曲。现有私人音乐仍保持私有，不会显示在此处。'));
 root.append(section);
 const groups=groupBy(songs,t=>albumName(t));
 const albums=el('section','section');albums.append(heading('探索音乐专辑','以专辑为单位欣赏完整的故事','全部专辑',()=>goto('albums')));
 if(groups.size){const grid=el('div','tiles');
  for(const [name,tracks] of Array.from(groups).slice(0,6))grid.append(collectionTile(name,tracks.length+' 首歌曲',tracks[0],()=>{state.view='albums';state.album=name;render()},'OST'));
  albums.append(grid);
 }else albums.append(empty('尚无公开专辑','管理员发布音乐后，专辑分类会自动出现。'));
 root.append(albums);
 if(state.user&&state.private.length){const mine=el('section','section');
  mine.append(heading('继续欣赏我的音乐','只有当前账号可以读取的私人音频','进入私人曲库',()=>goto('private')));
  mine.append(tiles(availablePrivate().slice(0,4)));root.append(mine);
 }
}
function groupBy(arr,fn){const map=new Map();for(const t of arr){const k=fn(t);if(!map.has(k))map.set(k,[]);map.get(k).push(t)}return map}
function pageHead(root,title,description,right,fn){
 const bar=el('div','summary-top'),left=el('div');left.append(el('h1','',title),el('p','',description));bar.append(left);
 if(right)bar.append(button(right,'primary-btn',fn));root.append(bar);
}
function renderDiscover(root){
 const songs=availablePublic();pageHead(root,'发现音乐','公开音乐馆 · '+songs.length+' 首已发布曲目');
 if(songs.length)root.append(rowList(songs));else root.append(empty('尚无已发布歌曲','只有管理员在云端管理中明确发布的音乐，才会向所有用户开放。'));
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
  if(songs.length){root.append(button('▶ 播放全部','primary-btn',()=>start(songs[0],songs)));root.append(el('div','', ''));root.append(rowList(songs))}
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
function renderSearch(root){
 const term=state.search.trim().toLocaleLowerCase(),all=availablePublic().concat(state.user?availablePrivate():[]);
 const matched=all.filter(t=>[t.title,t.artist,t.album,...(t.tags||[])].join(' ').toLocaleLowerCase().includes(term));
 pageHead(root,'搜索结果','“'+state.search+'” · 找到 '+matched.length+' 首歌曲');
 root.append(matched.length?rowList(matched):empty('没有找到匹配的音乐','可以尝试不同的歌曲名、专辑名或创作者名称。'));
}
function render(){
 setActiveNav();
 const root=$('viewRoot');root.replaceChildren();
 if(state.search.trim()){renderSearch(root);return}
 if(!state.user&&accountRequired.includes(state.view)){
  pageHead(root,({favorites:'我喜欢的音乐',recent:'最近播放',playlists:'我的歌单',private:'私人云音乐库'})[state.view],'请登录账号后继续');
  root.append(loggedOut());return;
 }
 const pages={home:renderHome,discover:renderDiscover,albums:renderAlbums,artists:renderArtists,favorites:renderFavorites,recent:renderRecent,playlists:renderPlaylists,private:renderPrivate};
 (pages[state.view]||renderHome)(root);
}
async function loadAll(){
 const token=++state.loadToken;
 try{
  const auth=await sb.auth.getUser();
  if(token!==state.loadToken)return;
  state.user=auth.error?null:auth.data?.user||null;
  const pub=await sb.from('radio_publications').select(PUBLIC_COLS).eq('published',true).order('published_at',{ascending:false});
  if(pub.error)throw pub.error;
  if(token!==state.loadToken)return;
  const oldPublic=new Map(state.public.map(t=>[t.track_id,t.updated_at]));
  state.public=pub.data||[];
  for(const t of state.public)if(oldPublic.get(t.track_id)!==t.updated_at){state.covers.delete('public:'+t.track_id);if(state.current?.kind==='public'&&state.current.id===t.track_id){$('playerArt').dataset.song='';$('lyricArt').dataset.song=''}}
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
   for(const t of state.private)if(oldPrivate.get(t.id)!==t.cover_path){state.covers.delete('private:'+t.id);if(state.current?.kind==='private'&&state.current.id===t.id){$('playerArt').dataset.song='';$('lyricArt').dataset.song=''}}
   state.favorites=new Set((results[1].data||[]).map(x=>x.track_id));
   state.playlists=results[2].data||[];
   state.items=results[3].data||[];
   state.history=results[4].data||[];
  }else{state.private=[];state.favorites.clear();state.history=[];state.playlists=[];state.items=[]}
  $('connection').textContent=state.user?'云端已登录':'公开模式';
  $('accountBtn').textContent=state.user?(state.user.email||'我的账号'):'登录 / 注册';
  if(state.current){const refreshed=state.current.kind==='public'?findPublic(state.current.id):findPrivate(state.current.id);if(refreshed)state.current=refreshed}
  const current=state.current;
  if(current&&current.kind==='public'&&!state.public.some(t=>t.track_id===current.id)){
   audio.pause();audio.removeAttribute('src');audio.load();state.current=null;state.queue=[];state.index=-1;
   say('当前歌曲已被管理员撤回公开，播放已停止。');
  }
  render();updatePlayer();renderQueue();subscribe();
  if(!current||current.kind!=='public'||state.public.some(t=>t.track_id===current.id))silent();
 }catch(e){if(token!==state.loadToken)return;say('在线音乐馆连接失败：'+e.message);render()}
}
async function toggleFavorite(t){
 if(!requireUser())return;
 try{
  if(t.kind==='public'){
   if(state.favorites.has(t.id)){safeError(await sb.from('radio_public_favorites').delete().eq('track_id',t.id).eq('user_id',state.user.id),'取消收藏');state.favorites.delete(t.id)}
   else{safeError(await sb.from('radio_public_favorites').insert({track_id:t.id}),'收藏歌曲');state.favorites.add(t.id)}
  }else{
   const next=!isLiked(t);
   safeError(await sb.from('radio_tracks').update({is_favorite:next}).eq('id',t.id).eq('user_id',state.user.id),'私人曲库收藏');
   const saved=state.private.find(x=>x.id===t.id);if(saved)saved.is_favorite=next;
  }
  render();updatePlayer();
 }catch(e){say(e.message)}
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
  const next=state.items.filter(i=>i.playlist_id===playlistId).length;
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
async function deletePlaylist(id,name){
 if(!confirm('确认删除歌单「'+name+'」？仅删除歌单，不会删除原始音乐。'))return;
 try{
  safeError(await sb.from('radio_listener_playlists').delete().eq('id',id).eq('user_id',state.user.id),'删除歌单');
  state.playlists=state.playlists.filter(p=>p.id!==id);state.items=state.items.filter(i=>i.playlist_id!==id);
  render();say('歌单已删除，歌曲文件保持不变。');
 }catch(e){say(e.message)}
}
function updatePlayer(){
 const t=state.current;
 $('nowTitle').textContent=t?t.title:'等待播放';
 $('nowArtist').textContent=t?displayName(t):'在音乐馆选择一首歌曲';
 $('playBtn').textContent=audio.paused?'▶':'Ⅱ';
 $('playBtn').setAttribute('aria-label',audio.paused?'播放':'暂停');
 $('likeNow').textContent=t&&isLiked(t)?'♥':'♡';
 $('likeNow').classList.toggle('active',!!(t&&isLiked(t)));
 $('shuffleBtn').classList.toggle('active',state.shuffle);
 $('repeatBtn').classList.toggle('active',state.repeat);
 $('repeatBtn').textContent=state.repeat?'↻¹':'↻';
 $('vinyl').classList.toggle('is-playing',!!t&&!audio.paused&&!audio.ended&&audio.readyState>=2);
 $('lyricDisc').classList.toggle('is-playing',!!t&&!audio.paused&&!audio.ended&&audio.readyState>=2);
 $('lyricHeading').textContent=t?t.title:'实时歌词';
 $('lyricArtist').textContent=t?displayName(t):'星音音乐';
 $('timeNow').textContent=formatTime(audio.currentTime);
 $('timeTotal').textContent=formatTime(audio.duration);
 if(t){
  const signature=key(t);
  if($('playerArt').dataset.song!==signature){
   $('playerArt').dataset.song=signature;$('lyricArt').dataset.song=signature;
   setArt(t,$('playerArt'));setArt(t,$('lyricArt'));
  }
 }else{
  $('playerArt').dataset.song='';$('lyricArt').dataset.song='';
  $('playerArt').textContent='✦';$('lyricArt').textContent='✦';
 }
 if('mediaSession' in navigator&&t){
  navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:displayName(t),album:albumName(t)});
  navigator.mediaSession.playbackState=audio.paused?'paused':'playing';
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
function updateLyric(){
 let index=-1;for(let i=0;i<state.lyrics.length;i++){if(audio.currentTime+0.09>=state.lyrics[i].sec)index=i;else break}
 if(index===state.lyricIndex)return;state.lyricIndex=index;
 const children=$('lyricLines').querySelectorAll('.lyric-line');
 children.forEach((node,i)=>node.classList.toggle('active',i===index));
 if(index>=0&&$('lyricsDialog').open)children[index]?.scrollIntoView({behavior:'smooth',block:'center'});
}
async function start(t,scope){
 if(!t)return;
 const list=Array.isArray(scope)&&scope.length?scope:state.search?availablePublic().concat(state.user?availablePrivate():[]):(state.view==='private'?availablePrivate():availablePublic());
 state.queue=list.filter(x=>x&&x.id);
 if(!state.queue.some(x=>key(x)===key(t)))state.queue.unshift(t);
 state.index=state.queue.findIndex(x=>key(x)===key(t));
 state.current=t;state.recordedKey=null;
 const token=++state.playToken;
 audio.pause();audio.removeAttribute('src');audio.load();
 $('seekBar').value=0;$('timeNow').textContent='0:00';updatePlayer();renderLyric();renderQueue();
 try{
  const source=await sourceFor(t);if(token!==state.playToken)return;
  audio.src=source;audio.load();
  try{await audio.play()}catch(e){if(e.name!=='AbortError')say('曲目已就绪，请再次点击播放键。')}
 }catch(e){if(token===state.playToken)say('无法播放「'+t.title+'」：'+e.message)}
}
async function togglePlay(){
 if(audio.src){if(audio.paused){try{await audio.play()}catch(e){say('无法开始播放：'+e.message)}}else audio.pause();return}
 const t=state.current||availablePublic()[0]||availablePrivate()[0];if(t)start(t);else say('暂无可播放歌曲。');
}
function advance(back=false,fromEnded=false){
 const arr=state.queue;if(!arr.length)return;
 if(back&&audio.currentTime>3){audio.currentTime=0;return}
 if(fromEnded&&state.repeat){audio.currentTime=0;audio.play().catch(()=>{});return}
 let ix=state.index;
 if(!back&&state.shuffle&&arr.length>1){const options=arr.map((_,i)=>i).filter(i=>i!==ix);ix=options[Math.floor(Math.random()*options.length)]}
 else ix=back?(ix<=0?arr.length-1:ix-1):(ix+1);
 if(ix>=arr.length){if(fromEnded){audio.pause();updatePlayer();return}ix=0}
 if(ix<0)ix=arr.length-1;
 start(arr[ix],arr);
}
function renderQueue(){
 const box=$('queueItems');box.replaceChildren();$('queueCount').textContent=state.queue.length;
 if(!state.queue.length){box.append(empty('播放列表为空','点击任何歌曲开始播放。'));return}
 for(let i=0;i<state.queue.length;i++)box.append(row(state.queue[i],i,state.queue));
}
async function recordPlay(){
 const t=state.current;if(!t||!state.user||state.recordedKey===key(t))return;
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
 }
 state.channel=channel.subscribe();
}
function openAuth(){
 $('authDialog').showModal();$('signedIn').hidden=!state.user;$('authForm').hidden=!!state.user;
 $('signedInEmail').textContent=state.user?'已登录：'+(state.user.email||''):''; 
}
function attach(){
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.view)));
 $('searchInput').addEventListener('input',e=>{state.search=e.target.value;render()});
 $('accountBtn').onclick=openAuth;
 $('closeAuth').onclick=()=>$('authDialog').close();
 $('closePlaylist').onclick=()=>$('playlistDialog').close();
 $('closeAdd').onclick=()=>{$('addDialog').close();state.pendingAdd=null};
 $('closeLyrics').onclick=()=>$('lyricsDialog').close();
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
 $('signOut').onclick=async()=>{await sb.auth.signOut();$('authDialog').close();clearArtObjects();state.current=null;audio.pause();audio.removeAttribute('src');audio.load();await loadAll()};
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
 $('lyricsBtn').onclick=()=>{$('lyricsDialog').showModal();renderLyric()};
 $('seekBar').oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)/100*audio.duration};
 $('volume').oninput=e=>{audio.volume=Number(e.target.value)};
 audio.volume=Number($('volume').value);
 audio.addEventListener('timeupdate',()=>{
  if(Number.isFinite(audio.duration)&&audio.duration>0)$('seekBar').value=String(100*audio.currentTime/audio.duration);
  $('timeNow').textContent=formatTime(audio.currentTime);updateLyric();
 });
 audio.addEventListener('durationchange',updatePlayer);
 for(const ev of ['playing','play','pause','waiting','canplay','ended','seeking'])audio.addEventListener(ev,()=>{updatePlayer();if(ev==='playing')recordPlay()});
 audio.addEventListener('ended',()=>advance(false,true));
 audio.addEventListener('error',()=>{if(state.current)say('音频加载失败，请确认网络与音乐的发布状态。')});
 $('mobileMenu').onclick=()=>{document.querySelector('.sidebar').classList.toggle('open');$('backdrop').hidden=!document.querySelector('.sidebar').classList.contains('open')};
 $('backdrop').onclick=()=>{document.querySelector('.sidebar').classList.remove('open');$('backdrop').hidden=true};
 if('mediaSession' in navigator){
  const actions={play:togglePlay,pause:()=>audio.pause(),previoustrack:()=>advance(true),nexttrack:()=>advance(false),seekto:details=>{if(Number.isFinite(details.seekTime))audio.currentTime=details.seekTime}};
  for(const [name,fn] of Object.entries(actions)){try{navigator.mediaSession.setActionHandler(name,fn)}catch(_e){}}
 }
 sb.auth.onAuthStateChange((event,session)=>{if(event==='INITIAL_SESSION')return;const next=session?.user?.id||null;if(next!==state.user?.id)queueMicrotask(()=>{clearArtObjects();loadAll()})});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadAll()});
 setInterval(()=>{if(document.visibilityState==='visible')loadAll()},60000);
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
attach();loadAll();
