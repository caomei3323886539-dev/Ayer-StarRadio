const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const approved=JSON.parse(fs.readFileSync('docs/alpha2-approved-art.json','utf8'));
const html=fs.readFileSync('music.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
test('Alpha 2 imports all 15 approved artwork files byte-for-byte',()=>{
 assert.equal(Object.keys(approved.assets).length,15);
 for(const [path,expected] of Object.entries(approved.assets)){
  const data=fs.readFileSync(path);
  const actual=crypto.createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
  assert.equal(actual,expected,path+' differs from approved original');
  assert.ok(sw.includes("'./"+path+"'"),path+' missing from offline shell');
  if(path.endsWith('.png')){
   assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',path);
   if(path.startsWith('assets/navigation/')){
    assert.equal(data.readUInt32BE(16),384,path+' width');
    assert.equal(data.readUInt32BE(20),384,path+' height');
   }
  }else{
   assert.equal(data.subarray(0,4).toString('ascii'),'RIFF');
   assert.equal(data.subarray(8,12).toString('ascii'),'WEBP');
  }
 }
 const nav=html.match(/<nav class="mobile-nav ayer-celestial-nav"[\s\S]*?<\/nav>/)[0];
 for(const name of ['home','discover','playlists','favorites','profile']){
  assert.ok(nav.includes('assets/navigation/'+name+'.png'));
  assert.ok(nav.includes('assets/navigation/'+name+'-active.png'));
 }
 assert.ok(!nav.includes('.svg'));
});
