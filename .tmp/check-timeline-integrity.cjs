const fs=require('fs'),vm=require('vm'),path=require('path');
const c={};vm.runInNewContext(fs.readFileSync('timeline/data.js','utf8'),c);
const issues={duplicateEvents:[],duplicateIds:[],missingImages:[],duplicateMedia:[],badMarkers:[],obsoleteImages:[],quoteMarkers:[]};
const groups=new Map(),ids=new Set();
for(const e of c.timelineData){
 const key=e.date+'|'+e.title.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
 if(!groups.has(key))groups.set(key,[]);groups.get(key).push({id:e.hash_id,date:e.date,title:e.title});
 if(ids.has(e.hash_id))issues.duplicateIds.push(e.hash_id);ids.add(e.hash_id);
 const seen=new Set();
 for(const m of e.media||[]){
  const key=m.type+'|'+(m.src||m.url);if(seen.has(key))issues.duplicateMedia.push({date:e.date,title:e.title,media:m});seen.add(key);
  if(m.type==='image'&&!fs.existsSync(path.resolve('timeline',m.src)))issues.missingImages.push({date:e.date,title:e.title,src:m.src});
  if(m.type==='image'&&/-(ins|推特回复)/i.test(m.src))issues.obsoleteImages.push({date:e.date,title:e.title,src:m.src});
 }
 for(const line of (e.description||'').split(/\r?\n/)){
  if(/引用[|｜]/.test(line))issues.quoteMarkers.push({date:e.date,title:e.title,line});
  if(/^(回复|点赞)[|｜]/.test(line)&&!(/^(回复)[|｜](佐佐木李子|高尾奏音)[：:]/.test(line)||/^点赞[|｜](佐佐木李子|高尾奏音)(?:[：:]|\s*$)/.test(line)))issues.badMarkers.push({date:e.date,title:e.title,line});
  if(/(佐佐木李子|高尾奏音)[①-⑳][：:]/.test(line))issues.badMarkers.push({date:e.date,title:e.title,line});
 }
}
issues.duplicateEvents=[...groups.values()].filter(g=>g.length>1);
console.log(JSON.stringify({events:c.timelineData.length,...issues},null,2));
fs.writeFileSync('.tmp/timeline-integrity.json',JSON.stringify(issues,null,2));
