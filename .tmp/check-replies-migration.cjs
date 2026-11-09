const fs=require('fs'),vm=require('vm'),assert=require('assert');
function read(file){const ctx={};vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);return ctx.timelineData;}
const before=read('.tmp/timeline-before-replies-batch.js'),after=read('timeline/data.js');
const plan=JSON.parse(fs.readFileSync('_reports/timeline-replies-migration.json','utf8'));
const map=new Map(plan.map(e=>[e.id,e]));
assert.equal(before.length,after.length);
const normal=x=>JSON.parse(JSON.stringify(x));
let removed=0;
for(let i=0;i<before.length;i++){
 const a=normal(before[i]),b=normal(after[i]);
 assert.equal(a.hash_id,b.hash_id);
 const entry=map.get(a.hash_id);
 if(entry){
  assert.equal(b.description,entry.after);
  assert.equal(a.description,entry.before);
  a.description=b.description;
  const media=a.media||[];
  a.media=media.filter(m=>!(m.type==='image'&&m.src.includes('-推特回复')));
  removed+=media.length-a.media.length;
  if(!a.media.length)delete a.media;
 }
 assert.deepStrictEqual(a,b,`Unexpected change: ${a.date} ${a.title}`);
}
assert.equal(removed,32);
const source=fs.readFileSync('timeline/page.js','utf8'),ctx={};
vm.runInNewContext(source.slice(source.indexOf('  function renderDescription('),source.indexOf('  const detailNavigation')),ctx);
for(const e of plan){const rendered=ctx.renderDescription(e.after);assert(!/(?:回复|引用)[|｜]/.test(rendered));assert(!/(?:佐佐木李子|高尾奏音)[①-⑳]/.test(rendered));}
assert(after.some(e=>(e.media||[]).some(m=>m.src?.includes('-ins点赞'))));
assert(after.some(e=>(e.media||[]).some(m=>m.src?.includes('-ins.webp'))));
console.log(`PASS: ${plan.length} reviewed entries, 32 screenshots removed from presentation; all IDs and unrelated fields preserved; numbered speakers and quote/reply labels rendered.`);
