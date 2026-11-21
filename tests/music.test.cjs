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
  assert.match(html, /<script type="module" src="\.\/music\.js\?v=092"><\/script>/);
  assert.match(html, /href="\.\/music\.css\?v=092"/);
  assert.equal(manifest.start_url,'./music.html');
  assert.match(serviceWorker, /'\.\/music\.html'/);
  assert.match(serviceWorker, /'\.\/music\.css\?v=092'/);
  assert.match(serviceWorker, /'\.\/music\.js\?v=092'/);
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

test('v0.8.5 immersive player mode and gestures',()=>{assert.match(html,/id="showDisc"/);assert.match(html,/id="showLyrics"/);assert.match(html,/id="detailBackdrop"/);assert.match(script,/function setDetailMode/);assert.match(script,/touchstart/);assert.match(script,/touchend/);assert.match(css,/\.player-detail\.mode-lyrics/)});

test('v0.8.5.1 smooth vinyl transition and safe lyric scroll',()=>{assert.match(css,/@keyframes detail-disc-enter/);assert.match(script,/cancelAnimationFrame\(lyricScrollFrame\)/);assert.match(script,/touchcancel/);assert.match(css,/prefers-reduced-motion:reduce/)});

test('v0.8.6 playback engine has local queue, next source preparation and reconnect recovery',()=>{assert.match(script,/ENGINE_QUEUE_KEY/);assert.match(script,/prepareNextSource/);assert.match(script,/retryCurrentSource/);assert.match(script,/addEventListener\('online'/);assert.match(css,/\.player-detail \.lyric-disc \.vinyl-label\{width:62%/)});

test('full-screen vinyl spin is not overwritten by entry transition',()=>{assert.doesNotMatch(css,/\.player-detail\.detail-visible \.lyric-disc\{animation:detail-disc-enter/);assert.match(css,/\.player-detail\.detail-visible \.lyric-art\{animation:detail-disc-enter/);assert.match(css,/\.player-detail \.lyric-disc\.vinyl\.is-playing\{animation-play-state:running\}/)});

test('v0.8.6.2 turntable tonearm and elevated disc',()=>{assert.match(html,/id="tonearm"/);assert.match(html,/class="turntable-stage"/);assert.match(script,/\$\('tonearm'\)\.classList\.toggle\('is-playing'/);assert.match(css,/\.tonearm\.is-playing \.tonearm-moving/);assert.match(css,/translateY\(clamp\(-145px/)});

test('v0.8.6.3 extended stylus reaches vinyl grooves',()=>{assert.match(html,/viewBox="0 0 220 300"/);assert.match(html,/L58 267/);assert.match(css,/\.player-detail \.tonearm\{height:75%/)});

test('v0.9.0 public music discovery filters and sort',()=>{assert.match(script,/function sortPublicTracks/);assert.match(script,/discoverFilter:'all'/);assert.match(script,/音乐创作者/);assert.match(script,/state\.discoverFilter\.startsWith\('album:'\)/);assert.match(css,/\.music-filter-tabs/)});

test('v0.9.1 grouped music search respects public/private navigation',()=>{assert.match(script,/function normalizedSearch/);assert.match(script,/function searchCatalog/);assert.match(script,/匹配专辑/);assert.match(script,/匹配创作者/);assert.match(script,/tracks\.filter\(t=>t\.kind==='public'\)/)});

test('v0.9.2 personal center and cloud playlist rename',()=>{assert.match(html,/data-view="profile"/);assert.match(script,/function renderProfile/);assert.match(script,/async function renamePlaylist/);assert.match(script,/radio_listener_playlists'\)\.update\(\{name\}\)/);assert.match(css,/\.profile-stats/)});
