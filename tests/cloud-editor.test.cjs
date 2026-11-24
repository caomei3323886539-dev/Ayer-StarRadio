const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('cloud.html','utf8');
const moduleSource=html.split('<script type="module">')[1]?.split('</script>')[0];
test('cloud editor module and feedback elements exist',()=>{
 assert.ok(moduleSource);
 assert.doesNotThrow(()=>new vm.Script(moduleSource.replace(/^import .*?;\s*/gm,'')));
 assert.match(html,/id="trackSaveMessage"[^>]*role="status"/);
 assert.match(html,/\.track-save-message\[data-state="error"\]/);
 assert.match(moduleSource,/function editorMessage\(message,kind='info'\)/);
 assert.match(moduleSource,/setEditorBusy\(true\)/);
 assert.match(moduleSource,/setEditorBusy\(false\)/);
 assert.match(moduleSource,/trackSaveBusy/);
});
test('editor messages update visible inline text with accessible state',()=>{
 const match=moduleSource.match(/function editorMessage\(message,kind='info'\)\{[\s\S]*?\n\}/);
 assert.ok(match,'editorMessage function');
 const box={hidden:true,dataset:{},textContent:''};
 const editorMessage=Function('$',match[0]+';return editorMessage')(id=>id==='trackSaveMessage'?box:null);
 editorMessage('上传失败：超过限制','error');
 assert.equal(box.hidden,false);
 assert.equal(box.dataset.state,'error');
 assert.equal(box.textContent,'上传失败：超过限制');
 editorMessage('');
 assert.equal(box.hidden,true);
});
test('database update verifies ownership result before reporting success',()=>{
 assert.match(moduleSource,/\.eq\('id',id\)\.eq\('user_id',userId\)\.select\('id'\)/);
 assert.match(moduleSource,/if\(!response\.data\?\.some\(item=>item\.id===id\)\)throw Error/);
 assert.match(moduleSource,/committed=true;/);
 assert.match(moduleSource,/uploadedCoverPath&&!committed/);
 assert.match(moduleSource,/if\(coverFile\)\{/);
 assert.match(moduleSource,/await optimizeEditorCover\(coverFile\)/);
 assert.match(moduleSource,/setTimeout\(\(\)=>\{if\(trackSaveBusy\)editorMessage/);
});
test('oversized cover optimization preserves original data and validates formats',async()=>{
 const match=moduleSource.match(/async function optimizeEditorCover\(file\)\{[\s\S]*?\n\}/);
 assert.ok(match,'cover optimization function');
 const messages=[];
 let closed=false;
 const fakeCanvas={width:0,height:0,getContext:()=>({drawImage:()=>{},fillRect:()=>{},globalCompositeOperation:'source-over',fillStyle:''}),toBlob:(cb,mime)=>cb(new Blob([new Uint8Array(1200)],{type:mime}))};
 const optimize=Function('editorMessage','createImageBitmap','document','COVER_LIMIT',match[0]+';return optimizeEditorCover')(
  (msg)=>messages.push(msg),
  async()=>({width:2600,height:1800,close(){closed=true}}),
  {createElement:()=>fakeCanvas},
  3*1024*1024
 );
 const small={type:'image/png',size:500000};
 assert.equal(await optimize(small),small);
 const big={type:'image/png',size:5000000};
 const result=await optimize(big);
 assert.equal(result.type,'image/webp');
 assert.ok(result.size<3*1024*1024);
 assert.equal(closed,true);
 assert.ok(messages.some(msg=>msg.includes('优化')));
 await assert.rejects(()=>optimize({type:'application/pdf',size:400}),/仅支持/);
});
