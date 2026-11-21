const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = path => fs.readFileSync(path,'utf8');
const html = read('music.html');
const script = read('music.js');
const css = read('music.css');
const serviceWorker = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

test('new platform shell is installed and linked', () => {
  assert.match(html, /<script type="module" src="\.\/music\.js\?v=0841"><\/script>/);
  assert.match(html, /href="\.\/music\.css\?v=0841"/);
  assert.equal(manifest.start_url,'./music.html');
  assert.match(serviceWorker, /'\.\/music\.html'/);
  assert.match(serviceWorker, /'\.\/music\.css\?v=0841'/);
  assert.match(serviceWorker, /'\.\/music\.js\?v=0841'/);
});

test('every UI element referenced by music.js exists', () => {
  const present = new Set(Array.from(html.matchAll(/id="([^"]+)"/g),m=>m[1]));
  const referenced = Array.from(script.matchAll(/\$\('([^']+)'\)/g),m=>m[1]);
  assert.ok(referenced.length>25,'UI is expected to be wired');
  assert.deepEqual([...new Set(referenced)].filter(id=>!present.has(id)),[]);
});

test('music.js has valid syntax', () => {
  const body = script.replace(/^import\s+\{createClient\}\s+from\s+['"][^'"]+['"];\s*/m,'');
  assert.doesNotThrow(()=>new vm.Script(body,{filename:'music.js'}));
});

test('streaming uses explicit publication gate and protected private storage', () => {
  assert.match(script,/radio_publications/);
  assert.match(script,/\.eq\('published',true\)/);
  assert.match(script,/functions\/v1\/ayer-public-media/);
  assert.match(script,/from\('ayer-audio'\)\.createSignedUrl/);
  assert.doesNotMatch(script,/service_role|SUPABASE_SECRET|sb_secret_/i);
});

test('vinyl animation pauses when audio is paused', () => {
  assert.match(css,/\.vinyl\.is-playing\{animation-play-state:running\}/);
  assert.match(css,/animation-play-state:paused/);
});

test('v0.8.4 player detail uses full-screen layer',()=>{assert.match(html,/<section id="lyricsDialog"[^>]*role="dialog"/);assert.doesNotMatch(html,/<dialog id="lyricsDialog"/);assert.match(script,/function openPlayerDetail\(\)/);assert.match(script,/d.hidden=false/);assert.match(css,/\.player-detail\[hidden\]\{display:none!important\}/)});

test('cross-browser sync uses account-scoped cloud checkpoints',()=>{assert.match(script,/radio_listener_sync/);assert.match(script,/function restoreCloudCheckpoint/);assert.match(script,/function saveCloudCheckpoint/);assert.match(script,/current_track_id/);assert.match(script,/onConflict:'user_id'/)});
