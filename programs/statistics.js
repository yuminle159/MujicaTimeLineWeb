(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const all = [...new Map((window.programsData || []).map(item => [item.program_id, item])).values()];
  const cast = new Map();
  all.forEach(item => item.performers.forEach(person => cast.set(person.name, person)));
  const people = [...cast.values()].sort((a,b) => Number(!a.bands.length)-Number(!b.bands.length) || (a.order ?? Infinity)-(b.order ?? Infinity));
  const personBands = p => p.bands.length ? p.bands : ['其他'];
  const bands = [...new Set(people.flatMap(personBands))];
  const validColor = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#87909a';
  const bandColors = new Map();
  people.forEach(person => person.bands.forEach(name => {
    if (!bandColors.has(name)) bandColors.set(name, validColor(person.color));
  }));
  const colorFor = name => bandColors.get(name) || validColor(cast.get(name)?.color);
  const five = ['佐佐木李子','渡濑结月','冈田梦以','米泽茜','高尾奏音'];
  const hasPerson = (item,name) => item.performers.some(p=>p.name===name);
  const hasBand = (item,name) => item.performers.some(p=>personBands(p).includes(name));
  const dialog = $('programStats');
  let view='counts', countType='person', trendUnit='month';
  let isolatedBand='';
  let pairMode='internal', externalBand='MyGO!!!!!', profileName=five[0];
  let actions=[], current=[], previousOverflow='', returnFocus;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function scope() {
    return all.filter(item=>!item.date||item.date<=today());
  }
  function action(records,label) {return `data-records="${actions.push({records,label})-1}"`;}
  function toggle(value,selected,key,text) {return `<button type="button" data-${key}="${esc(value)}" ${key==='profile'?`style="--band-color:${colorFor(value)}"`:''} aria-pressed="${value===selected}">${esc(text||value)}</button>`;}
  const options=(values,selected)=>values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
  function bars(items) {
    const max=Math.max(1,...items.map(item=>item.records.length));
    return `<div class="stats-bars">${items.map(item=>`<button type="button" class="stats-bar-row" style="--band-color:${colorFor(item.label)}" ${action(item.records,item.label)} ${item.records.length?'':'disabled'}><span class="stats-bar-name">${esc(item.label)}${item.note?`<small>${esc(item.note)}</small>`:''}</span><span class="stats-bar-track"><span style="width:${item.records.length/max*100}%"></span></span><span class="stats-bar-number">${item.records.length}<small>期</small></span></button>`).join('')||'<p class="stats-empty">当前范围没有记录。</p>'}</div>`;
  }
  function counts() {
    const items=countType==='person'?people.map(p=>({label:p.name,note:personBands(p).join(' / '),records:current.filter(item=>hasPerson(item,p.name))})):bands.map(name=>({label:name,records:current.filter(item=>hasBand(item,name))}));
    items.sort((a,b)=>b.records.length-a.records.length);
    return `<div class="stats-subtabs">${toggle('person',countType,'count-type','个人')}${toggle('band',countType,'count-type','乐队总体')}</div><p class="stats-description">${countType==='person'?'个人在已收录节目中的出演期数。':'至少一位成员出演即计一期，多位成员同台仍只计一次；各乐队期数之和可能大于节目总数。'}</p>${bars(items.filter(item=>item.records.length))}`;
  }
  function smoothPath(points) {
    if(!points.length)return '';
    if(points.length===1)return `M${points[0][0]},${points[0][1]}`;
    // Monotone cubic interpolation: pass through counts without overshooting.
    const slopes=points.slice(1).map((point,i)=>(point[1]-points[i][1])/(point[0]-points[i][0]));
    const tangents=points.map((_,i)=>i===0?slopes[0]:i===points.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2*slopes[i-1]*slopes[i]/(slopes[i-1]+slopes[i]));
    slopes.forEach((slope,i)=>{
      if(!slope){tangents[i]=tangents[i+1]=0;return;}
      const a=tangents[i]/slope,b=tangents[i+1]/slope,length=Math.hypot(a,b);
      if(length>3){tangents[i]=3/length*a*slope;tangents[i+1]=3/length*b*slope;}
    });
    let path=`M${points[0][0]},${points[0][1]}`;
    points.slice(1).forEach((point,i)=>{
      const previous=points[i],dx=(point[0]-previous[0])/3;
      path+=` C${previous[0]+dx},${previous[1]+tangents[i]*dx} ${point[0]-dx},${point[1]-tangents[i+1]*dx} ${point[0]},${point[1]}`;
    });
    return path;
  }
  function syncTrendVisibility() {
    document.querySelectorAll('.trend-series,.trend-target-series').forEach(series=>series.classList.toggle('series-hidden',!!isolatedBand&&series.dataset.series!==isolatedBand));
    document.querySelectorAll('[data-trend-band]').forEach(button=>button.setAttribute('aria-pressed',String(!isolatedBand||button.dataset.trendBand===isolatedBand)));
    const title=$('statsTrendTitle');
    if(title)title.textContent=`${isolatedBand||'全部乐队'} · 出演趋势`;
  }
  function trend() {
    const dated=current.filter(item=>/^\d{4}-\d{2}-\d{2}$/.test(item.date));
    const periods=[];
    if(dated.length) {
      const dates=dated.map(item=>item.date).sort();
      let y=Number(dates[0].slice(0,4)),m=trendUnit==='year'?1:Number(dates[0].slice(5,7));
      const end=dates.at(-1).slice(0,trendUnit==='year'?4:7);
      while(true) {
        const key=trendUnit==='year'?String(y):`${y}-${String(m).padStart(2,'0')}`;
        if(key>end)break;
        periods.push(key);
        if(trendUnit==='year')y++;else if(++m>12){y++;m=1;}
      }
    }
    const rows=bands.map(name=>{
      const records=dated.filter(item=>hasBand(item,name));
      return {name,records,cells:periods.map(period=>({period,records:records.filter(item=>item.date.startsWith(period))}))};
    });
    const max=Math.max(1,...rows.flatMap(row=>row.cells.map(cell=>cell.records.length)));
    const step=Math.max(1,Math.ceil(max/5)), ceiling=Math.ceil(max/step)*step;
    const width=Math.max(1050,periods.length*56+100),height=420,left=60,right=30,top=28,bottom=350;
    const x=i=>periods.length===1?(width+left-right)/2:left+i*(width-left-right)/Math.max(1,periods.length-1);
    const y=count=>bottom-count/ceiling*(bottom-top);
    const grid=Array.from({length:ceiling/step+1},(_,i)=>i*step).map(count=>`<g class="trend-grid"><line x1="${left}" y1="${y(count)}" x2="${width-right}" y2="${y(count)}"/><text x="${left-16}" y="${y(count)+4}" text-anchor="end">${count}</text></g>`).join('');
    const labels=periods.map((period,i)=>`<text class="trend-axis-label" x="${x(i)}" y="${bottom+27}" text-anchor="middle">${esc(period)}</text>`).join('');
    const lines=rows.map(row=>`<g class="trend-series" data-series="${esc(row.name)}" style="--band-color:${colorFor(row.name)}"><title>${esc(row.name)}</title><path class="trend-curve" d="${smoothPath(row.cells.map((cell,i)=>[x(i),y(cell.records.length)]))}" aria-hidden="true" data-isolate="${esc(row.name)}"/><path class="trend-hit" d="${smoothPath(row.cells.map((cell,i)=>[x(i),y(cell.records.length)]))}" data-isolate="${esc(row.name)}" tabindex="0" role="button" aria-label="只看 ${esc(row.name)} 的出演趋势"/>${row.cells.map((cell,i)=>`<circle class="trend-point" data-point-index="${i}" cx="${x(i)}" cy="${y(cell.records.length)}" r="${cell.records.length?3.3:2}" data-count="${cell.records.length}" ${cell.records.length?`${action(cell.records,`${row.name} · ${cell.period}`)} tabindex="0" role="button"`:''} aria-label="${esc(row.name)} ${esc(cell.period)} ${cell.records.length} 期"><title>${esc(row.name)} · ${esc(cell.period)} · ${cell.records.length} 期</title></circle>`).join('')}</g>`).join('');
    const pointTargets=rows.map(row=>`<g class="trend-target-series" data-series="${esc(row.name)}">${row.cells.map((cell,i)=>`<circle class="trend-point-hit" data-point-index="${i}" cx="${x(i)}" cy="${y(cell.records.length)}" r="14" ${action(cell.records,`${row.name} · ${cell.period}`)} aria-hidden="true"><title>${esc(row.name)} · ${esc(cell.period)} · ${cell.records.length} 期</title></circle>`).join('')}</g>`).join('');
    return `<div class="stats-view-controls"><div class="stats-subtabs">${toggle('month',trendUnit,'trend-unit','按月')}${toggle('year',trendUnit,'trend-unit','按年')}</div></div><h3 id="statsTrendTitle">全部乐队 · 出演趋势</h3><p class="stats-description">每条曲线代表一个乐队。点击曲线或图例只看该乐队，点击空白处恢复全部；点击数据点查看期目。空档期为 0，日期缺失的节目不计入趋势。</p>${periods.length?`<div class="trend-legend" aria-label="乐队图例">${rows.map(row=>`<button type="button" data-trend-band="${esc(row.name)}" aria-pressed="true" style="--band-color:${colorFor(row.name)}"><i aria-hidden="true"></i><span>${esc(row.name)}</span><small>${row.records.length} 期</small></button>`).join('')}</div><div class="stats-line-scroll" tabindex="0" role="region" aria-label="所有乐队出演趋势折线图，可横向滚动"><svg class="stats-line-chart" viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="group" aria-label="各乐队按${trendUnit==='year'?'年':'月'}的出演期数"><text class="trend-axis-title" x="18" y="18">期数</text>${grid}${labels}${lines}${pointTargets}</svg></div>`:'<p class="stats-empty">暂无可用于趋势分析的日期。</p>'}`;
  }

  function matrix(rows,columns) {
    if(!columns.length)return '<p class="stats-empty">当前范围暂无其他出演者。</p>';
    const maxPair=Math.max(1,...rows.flatMap(a=>columns.filter(b=>a!==b).map(b=>current.filter(item=>hasPerson(item,a)&&hasPerson(item,b)).length)));
    return `<div class="stats-matrix-scroll"><table class="stats-matrix"><caption>${pairMode==='internal'?'五人内部共同出演，自己与自己显示为 —，不参与颜色深浅计算。':'Mujica 五人与其他出演者的共同出演期数。'}</caption><thead><tr><th scope="col">共同出演 / 期</th>${columns.map(name=>`<th scope="col" style="--band-color:${colorFor(name)}"><span class="matrix-name">${esc(name)}</span><small>${esc(personBands(cast.get(name) || {bands:[]}).join(' / '))}</small></th>`).join('')}</tr></thead><tbody>${rows.map(a=>`<tr><th scope="row" style="--band-color:${colorFor(a)}"><span class="matrix-name">${esc(a)}</span></th>${columns.map(b=>{
      if(a===b)return '<td class="matrix-self"><span aria-label="自己与自己不统计">—</span></td>';
      const records=current.filter(item=>hasPerson(item,a)&&hasPerson(item,b));
      return `<td><button type="button" ${action(records,a===b?`${a} · 出演节目`:`${a} & ${b}`)} ${records.length?'':'disabled'} aria-label="${esc(a)} 与 ${esc(b)} ${records.length} 期" style="--band-color:${colorFor(b)};--cell-tint:${records.length?12+records.length/maxPair*48:0}%">${records.length}</button></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function together() {
    let content;
    if(pairMode==='bands')content=`<p class="stats-description">同一期出现任意 Mujica 成员及另一乐队的任意成员，即计一次共同出演。</p>${bars(bands.filter(name=>name!=='Ave Mujica').map(name=>({label:name,records:current.filter(item=>hasBand(item,'Ave Mujica')&&hasBand(item,name))})).sort((a,b)=>b.records.length-a.records.length))}`;
    else if(pairMode==='internal')content=matrix(five,five);
    else {
      const others=people.filter(p=>!five.includes(p.name)&&(externalBand==='全部'||personBands(p).includes(externalBand))&&current.some(item=>hasPerson(item,p.name)));
      content=`<label class="stats-inline-field">其他出演者所属乐队<select id="statsExternalBand">${options(['全部',...bands.filter(name=>name!=='Ave Mujica')],externalBand)}</select></label>${matrix(five,others.map(p=>p.name))}`;
    }
    return `<div class="stats-subtabs">${toggle('internal',pairMode,'pair-mode','五人内部')}${toggle('others',pairMode,'pair-mode','五人 × 其他出演者')}${toggle('bands',pairMode,'pair-mode','Mujica × 其他乐队')}</div>${content}`;
  }
  function recordList(records) {
    return records.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(item=>{
      let url='';try{const parsed=new URL(item.video_url);if(['http:','https:'].includes(parsed.protocol))url=parsed.href;}catch(_){}
      return `<li><span class="stats-record-date">${esc(item.date||'日期待确认')}</span><span>${esc(item.title||`${item.program} ${item.episode}`)}<small>${esc(item.performers.map(p=>p.name).join(' / '))}</small></span>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">完整节目 ↗</a>`:''}</li>`;
    }).join('')||'<li class="stats-empty">当前范围没有匹配节目。</li>';
  }
  function profile() {
    const records=current.filter(item=>hasPerson(item,profileName)), dates=records.map(item=>item.date).filter(Boolean).sort();
    const partners=people.filter(p=>p.name!==profileName).map(p=>({label:p.name,note:personBands(p).join(' / '),records:records.filter(item=>hasPerson(item,p.name))})).filter(item=>item.records.length).sort((a,b)=>b.records.length-a.records.length).slice(0,5);
    return `<div class="stats-subtabs">${five.map(name=>toggle(name,profileName,'profile',name)).join('')}</div><h3>${esc(profileName)}</h3><div class="stats-profile-facts" style="--band-color:${colorFor(profileName)}"><p><span>出演期数</span><b>${records.length}</b></p><p><span>范围内最早出演</span><b>${esc(dates[0]||'—')}</b></p><p><span>范围内最近出演</span><b>${esc(dates.at(-1)||'—')}</b></p></div><h4>共同出演最多的五位</h4>${bars(partners)}<h4>出演记录</h4><ol class="stats-episode-list">${recordList(records)}</ol>`;
  }
  function render() {
    actions=[];current=scope();
    $('statsScopeNote').textContent=`全部已收录档案 · ${current.length} 期 · 截至 ${today()}`;
    document.querySelectorAll('[data-stats-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.statsView===view)));
    $('statsRecords').hidden=true;
    $('programStatsBody').style.setProperty('--view-color',view==='profile'?colorFor(profileName):'#df464d');
    $('programStatsBody').innerHTML=({counts,trend,together,profile}[view])();
    if(view==='trend')syncTrendVisibility();
  }
  $('programStatsTrigger').addEventListener('click',()=>{
    returnFocus=document.activeElement;previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';document.querySelector('.programs-page').inert=true;$('pageTopBtn').inert=true;
    dialog.showModal();render();$('programStatsClose').focus();
  });
  $('programStatsClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    document.body.style.overflow=previousOverflow;document.querySelector('.programs-page').inert=false;$('pageTopBtn').inert=false;returnFocus?.focus();
  });
  dialog.addEventListener('click',event=>{
    const curve=event.target.closest('[data-isolate]');
    if(curve){isolatedBand=curve.dataset.isolate;syncTrendVisibility();highlightTrend('');return;}
    const button=event.target.closest('button,[data-records]');
    if(!button){
      if(view==='trend'&&isolatedBand&&!event.target.closest('a,input,select,label,.trend-series,.trend-target-series')){
        isolatedBand='';syncTrendVisibility();highlightTrend('');
        const focused=document.activeElement;if(focused?.matches('.trend-hit'))focused.blur();
      }
      return;
    }
    if(button.dataset.trendBand){isolatedBand=button.dataset.trendBand;syncTrendVisibility();highlightTrend('');return;}
    if(button.dataset.records!==undefined){
      const selected=actions[Number(button.dataset.records)],records=$('statsRecords');records.hidden=false;
      records.innerHTML=`<h3>${esc(selected.label)} <span>${selected.records.length} 期</span></h3><ol class="stats-episode-list">${recordList(selected.records)}</ol>`;
      records.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return;
    }
    if(button.dataset.statsView)view=button.dataset.statsView;
    else if(button.dataset.countType)countType=button.dataset.countType;
    else if(button.dataset.trendUnit)trendUnit=button.dataset.trendUnit;
    else if(button.dataset.pairMode)pairMode=button.dataset.pairMode;
    else if(button.dataset.profile)profileName=button.dataset.profile;
    else return;render();
  });
  dialog.addEventListener('keydown',event=>{
    if(!event.target.matches('.trend-point[data-records],.trend-hit')||!['Enter',' '].includes(event.key))return;
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  });
  function highlightPoint(target) {
    document.querySelectorAll('.trend-point.is-hovered').forEach(point=>point.classList.remove('is-hovered'));
    if(!target?.matches('.trend-point,.trend-point-hit'))return;
    const name=target.closest('[data-series]').dataset.series;
    const series=[...document.querySelectorAll('.trend-series')].find(item=>item.dataset.series===name);
    const point=series?.querySelector(`[data-point-index="${target.dataset.pointIndex}"]`);
    if(point)point.classList.add('is-hovered');
  }
  function highlightTrend(name) {
    document.querySelectorAll('.trend-series').forEach(series=>series.classList.toggle('series-dim',!!name&&series.dataset.series!==name));
  }
  dialog.addEventListener('pointerover',event=>{
    highlightPoint(event.target);
    const legend=event.target.closest('[data-trend-band]'),series=event.target.closest('.trend-series,.trend-target-series');
    if(legend||series)highlightTrend(legend?.dataset.trendBand||series.dataset.series);
  });
  dialog.addEventListener('pointerout',event=>{
    highlightPoint(event.relatedTarget);
    if(!event.relatedTarget?.closest('.trend-series,.trend-target-series,[data-trend-band]'))highlightTrend('');
  });
  dialog.addEventListener('focusin',event=>{
    highlightPoint(event.target);
    const legend=event.target.closest('[data-trend-band]'),series=event.target.closest('.trend-series,.trend-target-series');
    if(legend||series)highlightTrend(legend?.dataset.trendBand||series.dataset.series);
  });
  dialog.addEventListener('focusout',()=>{highlightPoint(null);highlightTrend('');});
  dialog.addEventListener('change',event=>{
    if(event.target.id==='statsExternalBand')externalBand=event.target.value;
    else return;render();
  });
})();
