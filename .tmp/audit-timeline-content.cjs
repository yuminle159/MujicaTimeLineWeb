const fs=require('fs'),vm=require('vm');const c={};vm.runInNewContext(fs.readFileSync('timeline/data.js','utf8'),c);
for(const e of c.timelineData){
 const d=e.description||'';const prefix=d.split(/^(?:(?:\d{4}[./]\d{1,2}[./]\d{1,2})的)?(?:佐佐木李子|高尾奏音|李子→奏音|奏音→李子)[：:]/m)[0];
 if(prefix.trim())console.log(JSON.stringify({date:e.date,title:e.title,category:e.category,text:prefix}));
}
