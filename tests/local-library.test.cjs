const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {File}=require('node:buffer');

const adapter=fs.readFileSync('local-library.js','utf8');
let seq=0;
const songs=new Map();
const playlists=new Map();
const stores=new Map([['songs',songs],['playlists',playlists]]);
let storesCreated=0;
const db={
 objectStoreNames:{contains:name=>stores.has(name)},
 createObjectStore(name){storesCreated++;stores.set(name,new Map());return {}},
 transaction(name){
  const store=stores.get(name);if(!store)throw Error('Unknown store '+name);
  const tx={error:null,oncomplete:null,onerror:null,onabort:null};
  function request(action){
   const req={result:null,error:null,onsuccess:null,onerror:null};
   queueMicrotask(()=>{
    try{req.result=action();req.onsuccess?.()}catch(error){req.error=error;req.onerror?.()}
    queueMicrotask(()=>tx.oncomplete?.());
   });
   return req;
  }
  tx.objectStore=()=>({
   getAll:()=>request(()=>[...store.values()]),
   put:value=>request(()=>{store.set(value.id,value);return value.id})
  });
  return tx;
 },
 close(){}
};
const fakeIndexedDB={
 open(name,version){
  assert.equal(name,'ayer-star-radio');assert.equal(version,2);
  const req={result:db,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
  queueMicrotask(()=>req.onsuccess?.());
  return req;
 }
};
global.window={indexedDB:fakeIndexedDB};
global.indexedDB=fakeIndexedDB;

let modulePromise;
function library(){
 if(!modulePromise)modulePromise=import('data:text/javascript;base64,'+Buffer.from(adapter).toString('base64'));
 return modulePromise;
}

test('uses legacy database name, version and stores with no destructive migration',async()=>{
 const lib=await library();
 assert.equal(lib.LEGACY_DB_NAME,'ayer-star-radio');
 assert.equal(lib.LEGACY_DB_VERSION,2);
 await lib.openLocalDatabase();
 assert.equal(storesCreated,0);
 assert.doesNotMatch(adapter,/\.clear\(|deleteDatabase|\.delete\(/);
});
test('reads existing songs and playlists including original blobs and metadata',async()=>{
 const lib=await library();
 const existingAudio=new Blob([new Uint8Array(18)],{type:'audio/mpeg'});
 const record={id:'legacy-track',title:'旧版旋律',artist:'艾耶尔大陆',album:'神之谷',blob:existingAudio,lyrics:'[00:02.00]旅途的旋律',cover:'data:image/png;base64,abcd',fav:true,lastPlayed:123456,addedAt:23456,tags:'原声',lyricCorrections:[{time:2}],extra:{keeper:true}};
 const playlist={id:'legacy-list',name:'原有本地歌单',songIds:['legacy-track'],description:'保留'};
 songs.set(record.id,record);playlists.set(playlist.id,playlist);
 const result=await lib.readLocalLibrary();
 assert.equal(result.songs.length,1);
 assert.equal(result.playlists.length,1);
 assert.equal(result.songs[0].blob,existingAudio);
 assert.deepEqual(result.songs[0],record);
 assert.deepEqual(result.playlists[0],playlist);
});
test('new local imports preserve existing tracks, avoid duplicates, and keep original IDs',async()=>{
 const lib=await library();
 const dupe=new File([new Uint8Array(18)],'旧版旋律.mp3',{type:'audio/mpeg'});
 const newFile=new File([new Uint8Array(31)],'新旋律.wav',{type:'audio/wav'});
 const report=await lib.importLocalSongs([dupe,newFile],[...songs.values()]);
 assert.equal(report.saved,1);
 assert.equal(report.skipped.length,1);
 assert.equal(songs.size,2);
 assert.ok(songs.has('legacy-track'));
 assert.equal(songs.get('legacy-track').fav,true);
 const added=[...songs.values()].find(t=>t.id!=='legacy-track');
 assert.ok(added.blob instanceof Blob);
 assert.equal(added.title,'新旋律');
 assert.equal(added.blob.size,31);
 assert.equal(added.album,'本地音乐');
 assert.ok(![...songs.values()].some(t=>t.id===null));
});
test('existing playlist metadata and song IDs remain intact after adding local track',async()=>{
 const lib=await library();
 const original=playlists.get('legacy-list');
 const newTrack=[...songs.values()].find(t=>t.id!=='legacy-track');
 await lib.saveLocalPlaylist({...original,songIds:[...original.songIds,newTrack.id]});
 assert.deepEqual(playlists.get('legacy-list').songIds,['legacy-track',newTrack.id]);
 assert.equal(playlists.get('legacy-list').description,'保留');
 assert.equal(songs.get('legacy-track').lyrics,'[00:02.00]旅途的旋律');
 assert.equal(storesCreated,0);
});
