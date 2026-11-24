/* Shared legacy-compatible local music storage for the unified v0.9.9 player.
   IMPORTANT: never clear/recreate the IndexedDB stores and never change saved track IDs. */
export const LEGACY_DB_NAME='ayer-star-radio';
export const LEGACY_DB_VERSION=2;
const SONG_STORE='songs', PLAYLIST_STORE='playlists';

export function openLocalDatabase(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(Error('当前浏览器没有 IndexedDB 存储支持'));return}
  // Same database name, version and key paths as the original offline player.
  const request=indexedDB.open(LEGACY_DB_NAME,LEGACY_DB_VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(SONG_STORE))db.createObjectStore(SONG_STORE,{keyPath:'id'});
   if(!db.objectStoreNames.contains(PLAYLIST_STORE))db.createObjectStore(PLAYLIST_STORE,{keyPath:'id'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('本机曲库无法打开'));
  request.onblocked=()=>reject(Error('本机音乐数据库被其他页面占用，请关闭旧版音乐馆后重试'));
 });
}
async function withStore(store,mode,callback){
 const db=await openLocalDatabase();
 try{
  return await new Promise((resolve,reject)=>{
   let result,completed=false;
   const tx=db.transaction(store,mode);
   tx.oncomplete=()=>{completed=true;resolve(result)};
   tx.onabort=()=>{if(!completed)reject(tx.error||Error('本机保存事务中断'))};
   tx.onerror=()=>{if(!completed)reject(tx.error||Error('本机保存失败'))};
   try{
    const req=callback(tx.objectStore(store));
    if(req&&'onsuccess' in req){req.onsuccess=()=>{result=req.result};req.onerror=()=>reject(req.error||Error('读取本机曲库失败'))}
   }catch(error){tx.abort();reject(error)}
  });
 }finally{db.close()}
}
export async function readLocalLibrary(){
 const [songs,playlists]=await Promise.all([withStore(SONG_STORE,'readonly',store=>store.getAll()),withStore(PLAYLIST_STORE,'readonly',store=>store.getAll())]);
 return {songs:songs||[],playlists:playlists||[]};
}
export async function saveLocalSong(song){
 if(!song||song.id==null)throw Error('歌曲 ID 无效');
 return withStore(SONG_STORE,'readwrite',store=>store.put(song));
}
export async function saveLocalPlaylist(playlist){
 if(!playlist||playlist.id==null)throw Error('歌单 ID 无效');
 return withStore(PLAYLIST_STORE,'readwrite',store=>store.put(playlist));
}
export function localAudioFileName(name){
 return String(name||'').replace(/\.[^.]+$/,'').trim();
}
export function localAudioSupported(file){
 return file instanceof Blob && (/^audio\//i.test(file.type)||/\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name||''));
}
export function makeLocalSong(file){
 const title=localAudioFileName(file.name)||'本地音乐';
 return {id:crypto.randomUUID(),title,artist:'艾耶尔大陆 · 本地音乐',album:'本地音乐',fav:false,lastPlayed:0,addedAt:Date.now(),blob:file,lyrics:'',tags:''};
}
export async function importLocalSongs(files,existing=[]){
 const report={saved:0,skipped:[],failed:[]},known=[...existing];
 for(const file of files){
  if(!localAudioSupported(file)){report.skipped.push((file?.name||'音频')+'：格式不支持');continue}
  const title=localAudioFileName(file.name);
  if(known.some(t=>t.title===title&&t.blob?.size===file.size)){report.skipped.push(file.name+'：同名同大小，已跳过');continue}
  const track=makeLocalSong(file);
  try{await saveLocalSong(track);known.push(track);report.saved++}
  catch(error){report.failed.push(file.name+'：'+error.message)}
 }
 return report;
}
