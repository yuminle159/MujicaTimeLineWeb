const fs=require('fs'),vm=require('vm');const c={};vm.runInNewContext(fs.readFileSync('timeline/data.js','utf8'),c);
const events=c.timelineData.filter(e=>(e.media||[]).some(m=>m.type==='image'&&m.src.includes('-推特回复')));
fs.writeFileSync('.tmp/reply-events.json',JSON.stringify(events,null,2));
for(const [i,e] of events.entries())console.log(`${i+1}. ${e.date} ${e.hash_id} ${e.title}\n${e.description}\n${e.media.filter(m=>m.src?.includes('-推特回复')).map(m=>m.src).join(', ')}`);
