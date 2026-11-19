const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const html=readFileSync(new URL('../index.html', 'file:///'+__filename.replaceAll('\\','/')), 'utf8');
const [,script]=html.match(/<script>([\s\S]+?)<\/script>/);
new vm.Script(script);
const context=vm.createContext({document:{getElementById:()=>({})},localStorage:{getItem:()=>null}});
vm.runInContext(script.slice(0,script.indexOf('init().catch(')),context);
vm.runInContext(`
 const fixture='[00:02.20]歌<00:02.40>う\\n[00:02.20][tr]歌唱\\n[00:08.00]間奏\\n[00:30.00]帰る\\n[00:30.00][tr]归去\\n[00:40.00]歌う\\n[00:40.00][tr]歌唱';
 const rows=aiReadRows(fixture);
 const previous=rows[2].sec;
 rows[0].sec=3.4;
 globalThis.result={
  size:rows.length, previous, repeat:aiInspectRows(rows,rows,60).occurrences.get(2).number,
  instrumental:aiInspectRows(rows,rows,60).flags[1].includes('间奏后首句候选'),
  roundtrip:parseLyrics(aiReviewedLRC(rows)), old:parseLyrics(fixture),
  invalid:aiInspectRows([rows[0],{...rows[1],sec:2},rows[2]],rows,39).errors,
  collision:aiReadRows('[00:02.00]一\\n[00:02.00][tr]一\\n[00:02.00]二\\n[00:02.00][tr]二').length,
  timestamp:aiReviewTime(59.999),
  peak:aiMakePeaks({length:4,numberOfChannels:2,getChannelData:i=>i?[0,.5,0,0]:[0,0,-1,0]})[2]
 };
`,context);
const result=context.result;
assert.equal(result.size,3);
assert.equal(result.previous,40);
assert.equal(result.repeat,2);
assert.equal(result.instrumental,true);
assert.equal(result.roundtrip[0].sec,3.4);
assert.equal(result.roundtrip[0].translation,'歌唱');
assert.equal(result.roundtrip[0].words[1].sec,3.6);
assert.equal(result.old[2].translation,'归去');
assert.equal(result.invalid.length,2);
assert.equal(result.collision,2);
assert.equal(result.timestamp,'01:00.00');
assert.equal(result.peak,1);
console.log('Lyric workbench regression checks passed.');
