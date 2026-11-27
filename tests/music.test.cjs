const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');

const read = path => fs.readFileSync(path,'utf8');
const html = read('music.html');
const script = read('music.js');
const css = read('music.css');
const serviceWorker = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

test('new platform shell is installed and linked', () => {
  assert.match(html, /<script type="module" src="\.\/music\.js\?v=0998"><\/script>/);
  assert.match(html, /href="\.\/music\.css\?v=0998"/);
  assert.equal(manifest.start_url,'./music.html');
  assert.match(serviceWorker, /'\.\/music\.html'/);
  assert.match(serviceWorker, /'\.\/music\.css\?v=0998'/);
  assert.match(serviceWorker, /'\.\/music\.js\?v=0998'/);
});

test('every UI element referenced by music.js exists', () => {
  const present = new Set(Array.from(html.matchAll(/id="([^"]+)"/g),m=>m[1]));
  const referenced = Array.from(script.matchAll(/\$\('([^']+)'\)/g),m=>m[1]);
  assert.ok(referenced.length>25,'UI is expected to be wired');
  assert.deepEqual([...new Set(referenced)].filter(id=>!present.has(id)),[]);
});

test('music.js has valid ES module syntax including top-level offline fallback', () => {
  const checked=spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
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

test('v0.9.0 public music discovery filters and sort',()=>{assert.match(script,/function sortPublicTracks/);assert.match(script,/discoverFilter:'all'/);assert.match(script,/音乐旅途的创作者/);assert.match(script,/state\.discoverFilter\.startsWith\('album:'\)/);assert.match(css,/\.music-filter-tabs/)});

test('v0.9.1 grouped music search respects public/private navigation',()=>{assert.match(script,/function normalizedSearch/);assert.match(script,/function searchCatalog/);assert.match(script,/匹配专辑/);assert.match(script,/匹配创作者/);assert.match(script,/tracks\.filter\(t=>t\.kind==='public'\)/)});

test('v0.9.2 personal center and cloud playlist rename',()=>{assert.match(html,/data-view="profile"/);assert.match(script,/function renderProfile/);assert.match(script,/async function renamePlaylist/);assert.match(script,/radio_listener_playlists'\)\.update\(\{name\}\)/);assert.match(css,/\.profile-stats/)});

test('v0.9.2.1 playlist ordering and mobile profile entry',()=>{assert.match(html,/data-view="profile" aria-label="我的"/);assert.match(script,/async function movePlaylistTrack/);assert.match(script,/removePlaylistTrack\(track.id\)/);assert.match(css,/\.playlist-edit-row/)});

test('v0.9.3 uses atomic server-side playlist ordering with stale-order protection',()=>{assert.match(script,/sb\.rpc\('radio_move_playlist_track'/);assert.match(script,/p_expected_order:entries\.map/);assert.match(script,/playlistMoveBusy/);assert.doesNotMatch(script,/sort_order:temp/)});

test('v0.9.4 guards repeated favorite requests and sparse playlist positions',()=>{assert.match(script,/const favoriteBusy=new Set/);assert.match(script,/favoriteBusy\.has\(songKey\)/);assert.match(script,/finally\{favoriteBusy\.delete\(songKey\)\}/);assert.match(script,/Math\.max\(-1,\.\.\.state\.items/)});

test('v0.9.5 Android media session position and seek actions',()=>{assert.match(script,/function updateMediaPosition/);assert.match(script,/setPositionState/);assert.match(script,/seekbackward:details/);assert.match(script,/seekforward:details/);assert.match(script,/lastMediaPositionSecond/)});

test('v0.9.6 recovery respects playback intent and bounded retries',()=>{assert.match(script,/recoveryAttempts>=3/);assert.match(script,/play:requestPlayback,pause:pausePlayback/);assert.match(script,/function pausePlayback/);assert.match(script,/addEventListener\('pagehide',persistLocalQueue\)/);assert.match(script,/token!==state.playToken\|\|!wantsPlayback/);assert.match(html,/id="detailVolume"/);});

test('v0.9.8 fantasy music home uses published songs and responsive rails',()=>{
 assert.match(script,/function renderHome\(root\)/);
 assert.match(script,/ayer-home-tabs/);
 assert.match(script,/ayer-featured-rail/);
 assert.match(script,/ayer-recommend/);
 assert.match(script,/sortPublicTracks\(availablePublic\(\),'newest'\)/);
 assert.match(script,/state\.favorites\.has\(t\.id\)/);
 assert.match(script,/state\.user\&\&state\.private\.length|if\(state\.user\)/);
 assert.match(css,/\.ayer-feature-card/);
 assert.match(css,/@media\(max-width:720px\)/);
});

test('v0.9.8.1 mobile search is interactive without changing music access',()=>{
 assert.match(html,/id="mobileSearchToggle"[^>]*aria-expanded="false"/);
 assert.match(script,/function setMobileSearchOpen\(open,clearOnClose=false\)/);
 assert.match(script,/setMobileSearchOpen\(false\)/);
 assert.match(script,/\.classList\.contains\('search-open'\)/);
 assert.match(css,/\.topbar\.search-open \.search-wrap\{display:flex\}/);
 assert.match(css,/\.mobile-search-toggle\{display:none!important\}/);
});
test('v0.9.8.1 floating player stays above Android navigation and shows progress',()=>{
 assert.match(html,/id="miniProgressFill"/);
 assert.match(script,/function updateMiniProgress\(\)/);
 assert.match(script,/updateMiniProgress\(\);/);
 assert.match(css,/bottom:calc\(var\(--visual-bottom,0px\) \+ var\(--nav-height,62px\) \+ 9px\)!important/);
 assert.match(css,/\.player \.mini-progress-fill/);
 assert.match(css,/\.ayer-recommend \.track-actions \.mini-action:nth-child\(3\)\{display:none\}/);
});

test('v0.9.8.1 service worker parses and avoids caching protected media',()=>{
 assert.doesNotThrow(()=>new vm.Script(serviceWorker,{filename:'sw.js'}));
 assert.match(serviceWorker,/url\.pathname\.includes\('\/storage\/'\)/);
 assert.match(serviceWorker,/url\.pathname\.includes\('\/functions\/'\)/);
 assert.match(serviceWorker,/caches\.open\(CACHE\)\.then\(cache=>cache\.put\(path,copy\)\)\)/);
});

test('v0.9.8.2 My Music uses responsive traveler profile, account-safe stats and playlists',()=>{
 assert.match(script,/function renderProfile\(root\)/);
 assert.match(script,/if\(!user\)\{/);
 assert.match(script,/profile-v2-hero/);
 assert.match(script,/profile-v2-stats/);
 assert.match(script,/profile-v2-now/);
 assert.match(script,/profile-v2-actions/);
 assert.match(script,/profile-v2-playlists/);
 assert.match(script,/state\.history\.map/);
 assert.match(script,/state\.favorites\.has\(t\.id\)/);
 assert.match(script,/availablePrivate\(\)/);
 assert.match(script,/goto\('playlists'\);state\.selectedPlaylist=p\.id;render\(\)/);
 assert.match(css,/\.profile-v2-hero\{/);
 assert.match(css,/\.profile-v2-stat\{/);
 assert.match(css,/\.profile-v2-action\{/);
 assert.match(css,/\.profile-v2-editor\[hidden\]\{display:none!important\}/);
 assert.match(css,/@media\(max-width:540px\)/);
});
test('v0.9.8.2 nickname editing requires signed-in account and does not expose private tracks',()=>{
 assert.match(script,/sb\.auth\.updateUser\(\{data:\{display_name:name\}\}\)/);
 assert.match(script,/if\(state\.user\?\.id!==user\.id\)return/);
 assert.match(script,/name\.length>28/);
 assert.match(script,/field\.type='text'/);
 assert.match(script,/editor\.onsubmit=async event/);
 assert.match(script,/if\(!user\)\{[\s\S]*?openAuth/);
 assert.doesNotMatch(script,/profileDisplayName.*innerHTML/);
 assert.match(script,/只有管理员明确发布的歌曲才会进入公开音乐馆/);
});

test('v0.9.9 preserves legacy IndexedDB and routes primary entry to unified player',()=>{
 const index=read('index.html'),local=read('local-library.js');
 assert.match(index,/get\('legacy'\)!=='1'/);
 assert.match(index,/location\.replace\(new URL\('\.\/music\.html'/);
 assert.match(index,/indexedDB\.open\(DB_NAME,2\)/);
 assert.match(local,/LEGACY_DB_NAME='ayer-star-radio'/);
 assert.match(local,/LEGACY_DB_VERSION=2/);
 assert.match(local,/SONG_STORE='songs', PLAYLIST_STORE='playlists'/);
 assert.match(local,/createObjectStore\(SONG_STORE,\{keyPath:'id'\}\)/);
 assert.match(local,/createObjectStore\(PLAYLIST_STORE,\{keyPath:'id'\}\)/);
 assert.doesNotMatch(local,/deleteDatabase|\.clear\(/);
 assert.equal(manifest.start_url,'./music.html');
 assert.equal(manifest.short_name,'星音电台');
});
test('v0.9.9 serves local library through both desktop and Android views',()=>{
 assert.match(html,/<button[^>]*data-view="local"/);
 assert.match(html,/id="localImport"[^>]*multiple hidden/);
 assert.match(html,/index\.html\?legacy=1/);
 assert.match(script,/function renderLocal\(root\)/);
 assert.match(script,/function availableLocal\(\)/);
 assert.match(script,/function loadLocalLibrary\(\)/);
 assert.match(script,/async function importLocalFiles\(files\)/);
 assert.match(script,/function addLocalToPlaylist\(t\)/);
 assert.match(script,/function removeLocalFromPlaylist\(playlist\)/);
 assert.match(script,/function createLocalPlaylist\(\)/);
 assert.match(css,/\.unified-local/);
 assert.match(css,/\.local-playlist-grid/);
 assert.match(serviceWorker,/local-library\.js\?v=0998/);
});
test('v0.9.9 offline playback does not expose local tracks through cloud APIs',()=>{
 assert.match(script,/await import\('https:\/\/esm\.sh\/@supabase\/supabase-js@2\.49\.4'\)/);
 assert.match(script,/if\(!sb\)\{state\.user=null;render\(\);say\('离线模式/);
 assert.match(script,/t\.kind==='local'/);
 assert.match(script,/URL\.createObjectURL\(song\.blob\)/);
 assert.match(script,/state\.current\.kind==='local'\)return/);
 assert.match(script,/\['public','private'\]\.includes\(t\.kind\)/);
 assert.match(script,/ref\?\.kind==='local'\?findLocal/);
 assert.match(script,/next\.kind==='local'\|\|/);
 assert.match(script,/if\(t\.kind!=='local'&&state\.localAudioUrl\)/);
 assert.match(script,/if\(sb\)sb\.auth\.onAuthStateChange/);
});

test('v0.9.9.1 Ayer fantasy homepage keeps live controls and new decorative assets',()=>{
 assert.match(script,/ayer-illustrated-hero/);
 assert.match(script,/ayer-hero-message/);
 assert.match(script,/ayer-hero-buttons/);
 assert.match(script,/goto\('discover'\)/);
 assert.match(script,/goto\('local'\)/);
 assert.match(css,/url\('\.\/assets\/ayer-home-sky\.svg'\)/);
 assert.match(css,/\.ayer-hero-primary/);
 assert.match(css,/\.ayer-feature-medallion/);
 assert.match(serviceWorker,/assets\/ayer-home-sky\.svg/);
 assert.match(script,/sortPublicTracks\(availablePublic\(\),'newest'\)/);
});

test('v0.9.9.2 high-detail sky-hall illustrated musician remains decorative',()=>{
 const harp=read('assets/ayer-harpist.svg');
 assert.match(harp,/<svg[^>]*viewBox="0 0 460 520"/);
 assert.match(harp,/竖琴/);
 assert.match(harp,/id="harp"/);
 assert.match(script,/ayer-hero-musician/);
 assert.match(script,/heroineArtwork\.src='\.\/assets\/ayer-harpist\.svg'/);
 assert.match(script,/heroine\.setAttribute\('aria-hidden','true'\)/);
 assert.match(script,/hero\.append\(heroSky,ornamental,heroine,heroContent\)/);
 assert.match(css,/\.ayer-hero-musician\{/);
 assert.match(css,/\.ayer-hero-ornaments/);
 assert.match(css,/\.topbar \.pill\.accent/);
 assert.match(css,/\.player \.disc-wrap/);
 assert.match(serviceWorker,/assets\/ayer-harpist\.svg/);
});

test('v0.9.9.3 original harpist artwork replaces vector only after successful load',()=>{
 assert.match(script,/officialBanner\.src='\.\/assets\/ayer_home_harpist\.webp'/);
 assert.match(script,/officialBanner\.onload=\(\)=>/);
 assert.match(script,/officialBanner\.onerror=\(\)=>/);
 assert.match(script,/hero\.classList\.add\('ayer-original-art-ready'\)/);
 assert.match(css,/\.ayer-illustrated-hero\.ayer-original-art-ready/);
 assert.match(css,/\.ayer-original-art-ready \.ayer-hero-musician\{display:none\}/);
 assert.match(css,/url\('\.\/assets\/ayer_home_harpist\.webp'\)/);
 assert.match(script,/heroineArtwork\.src='\.\/assets\/ayer-harpist\.svg'/);
});

test('production harpist illustration exists, is a valid WebP and is cached offline',()=>{
 const art=fs.readFileSync('assets/ayer_home_harpist.webp');
 assert.ok(art.length>100000&&art.length<600000,'Expected optimized original painting');
 assert.equal(art.toString('ascii',0,4),'RIFF');
 assert.equal(art.toString('ascii',8,12),'WEBP');
 assert.match(script,/officialBanner\.src='\.\/assets\/ayer_home_harpist\.webp'/);
 assert.match(css,/\.ayer-illustrated-hero\.ayer-original-art-ready/);
 assert.match(serviceWorker,/'\.\/assets\/ayer_home_harpist\.webp'/);
});

test('v0.9.9.4 preserves the full banner and caches only versioned public covers',()=>{
 assert.match(css,/aspect-ratio:3\/1;background:url\('\.\/assets\/ayer_home_harpist\.webp'\) center\/contain/);
 assert.match(script,/const COVER_CACHE='ayer-public-cover-v1'/);
 assert.match(script,/coverPending\.has\(k\)/);
 assert.match(script,/if\(hit\)return await hit\.blob\(\)/);
 assert.match(script,/holder\.dataset\.coverIdentity!==identity/);
 assert.match(script,/img\.loading='eager'/);
 assert.match(script,/if\(epoch!==coverEpoch\)return null/);
 assert.match(html,/rel="preload" as="image" href="\.\/assets\/ayer_home_harpist\.webp"/);
});

test('v0.9.9.5 overlays the title onto the original art without a separate pale panel',()=>{
 assert.match(css,/v0\.9\.9\.5 — unified painted hero/);
 assert.match(css,/\.ayer-illustrated-hero\.ayer-original-art-ready\{\s*position:relative;isolation:isolate;display:flex/);
 assert.match(css,/\.ayer-original-art-ready \.ayer-hero-sky\{\s*position:absolute;inset:0/);
 assert.match(css,/background-size:100% 100%,contain/);
 assert.match(css,/\.ayer-original-art-ready \.ayer-hero-message\{[\s\S]*?background:transparent;color:#fff/);
 assert.match(css,/\.ayer-original-art-ready \.ayer-hero-message p\{display:none\}/);
 assert.match(css,/\.ayer-original-art-ready \.ayer-hero-buttons\{gap:7px;flex-wrap:nowrap\}/);
 assert.match(html,/music\.css\?v=0998/);
 assert.match(serviceWorker,/ayer-star-radio-v0998-clean-nav-20261127/);
});

test('v0.9.9.6 official five-tab image-backed navigation routes and accessibility',()=>{
 const nav=html.match(/<nav class="mobile-nav ayer-celestial-nav"[\s\S]*?<\/nav>/);
 assert.ok(nav);
 assert.equal((nav[0].match(/data-view="/g)||[]).length,5);
 for(const route of ['home','discover','playlists','favorites','profile'])assert.match(nav[0],new RegExp('data-view="'+route+'"'));
 assert.doesNotMatch(nav[0],/data-view="local"/);
 for(const label of ['首页','音乐馆','歌单','收藏','我的'])assert.match(nav[0],new RegExp('aria-label="'+label+'"'));
 assert.ok(css.includes('decorative background contains no baked-in labels or icons'));
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/--nav-height:calc\(82px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(css,/\.mobile-nav\.ayer-celestial-nav button\.active/);
 assert.match(serviceWorker,/assets\/ayer-bottom-nav\.webp/);
 assert.match(html,/music\.css\?v=0998/);
});

test('v0.9.9.7 removes rectangular tap feedback',()=>{assert.ok(css.includes('-webkit-tap-highlight-color:transparent'));assert.ok(css.includes('radial-gradient(ellipse at 50% 42%'));assert.ok(css.includes('button:active{transform:none;background:transparent!important}'))});

test('v0.9.9.8 removes baked navigation silhouettes',()=>{assert.ok(!css.includes("background:url('./assets/ayer-bottom-nav.webp')"));assert.ok(css.includes('decorative background contains no baked-in labels or icons'))});
