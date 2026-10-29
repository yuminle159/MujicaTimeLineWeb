(function (global) {
  'use strict';
  const normal = s => String(s || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const project = v => [v.lon * 80.9, -v.lat * 100];
  const mapBounds = [10380,-4590,1500,1530];
  const boxes = {kanto:[11195,-3625,175,135], japan:mapBounds, kansai:[10915,-3520,125,95], chubu:[11020,-3560,130,100], kyushu:[10465,-3410,150,115]};
  const state = {period:'all', selected:null, region:'kanto', box:boxes.kanto.slice(), query:''};
  let root, options, records = [], cleanup = () => {};

  function constrainBox(box) {
    const [left,top,width,height]=mapBounds;
    const scale=Math.min(1,width/box[2],height/box[3]);
    const w=box[2]*scale,h=box[3]*scale;
    return [Math.max(left,Math.min(left+width-w,box[0])),Math.max(top,Math.min(top+height-h,box[1])),w,h];
  }
  function withinMap(venue) {
    const [x,y]=project(venue),[left,top,width,height]=mapBounds;
    return x>=left && x<=left+width && y>=top && y<=top+height;
  }

  function model(lives, catalogue, today, scope, scopeOf, dayOf) {
    const lookup = new Map();
    catalogue.forEach(v => [v.name, ...(v.aliases || [])].forEach(n => lookup.set(normal(n), v)));
    const groups = new Map();
    lives.forEach(live => {
      if (scope !== 'all' && scopeOf(live) !== scope) return;
      const day = dayOf(live);
      const venue = lookup.get(normal(live.venue)) || {id:'unknown-'+normal(live.venue), name:live.venue || '场馆待公布', region:'unknown', area:'地点待确认', kind:'未定位', description:'演出地点尚未完成定位，记录保留在此。'};
      if (!groups.has(venue.id)) groups.set(venue.id, {venue, events:[], past:0, future:0, undated:0});
      const group = groups.get(venue.id);
      const status = day == null ? 'undated' : day < today ? 'past' : 'future';
      group[status]++;
      group.events.push({live, day, status});
    });
    return [...groups.values()].sort((a,b) => b.events.length-a.events.length || a.venue.name.localeCompare(b.venue.name));
  }
  function visibleEvents(record) {
    return record.events.filter(e => state.period === 'all' || e.status === state.period);
  }
  function visibleRecords() { return records.filter(r => visibleEvents(r).length); }
  function badge(r) { return r.past ? (r.future ? 'mixed' : 'past') : 'future'; }
  function recordButton(r) {
    return `<button type="button" class="va-place ${r.venue.id === state.selected ? 'selected' : ''}" data-venue="${esc(r.venue.id)}" aria-pressed="${r.venue.id === state.selected}"><i class="va-dot ${badge(r)}"></i><span><b>${esc(r.venue.name)}</b><small>${esc(r.venue.area)}</small></span><em>${visibleEvents(r).length}</em></button>`;
  }
  function setRegion(region) { state.region=region; state.box=boxes[region].slice(); drawMap(); updateRegionButtons(); }
  function updateRegionButtons() {
    root.querySelectorAll('[data-region]').forEach(b => { b.classList.toggle('active', b.dataset.region === state.region); b.setAttribute('aria-pressed', b.dataset.region === state.region); });
  }
  function summary() {
    const all = visibleRecords(), jp=all.filter(r=>r.venue.region==='jp');
    const totals = records.reduce((a,r)=>{a.past+=r.past;a.future+=r.future;return a;},{past:0,future:0});
    root.querySelector('.va-metrics').innerHTML = `<div><strong>${jp.length}</strong><span>日本场馆</span></div><div><strong>${new Set(jp.map(r=>r.venue.area.split(' · ')[0])).size}</strong><span>都道府县</span></div><div><strong>${totals.past}</strong><span>已举行演出</span></div><div><strong>${totals.future}</strong><span>未来演出</span></div>`;
    const selected = all.find(r=>r.venue.id === state.selected);
    if (!selected) state.selected = null;
    root.querySelectorAll('[data-period]').forEach(b=>{b.classList.toggle('active', b.dataset.period === state.period);b.setAttribute('aria-pressed',b.dataset.period === state.period);});
    list(); detail(); drawMap();
  }
  function list() {
    const all = visibleRecords().filter(r=>normal(r.venue.name+' '+r.venue.area+' '+(r.venue.aliases||[]).join(' ')).includes(normal(state.query)));
    for (const region of ['jp','overseas','unknown']) {
      const entries = all.filter(r=>r.venue.region===region);
      const target = root.querySelector('[data-list="'+region+'"]');
      target.innerHTML = entries.map(recordButton).join('') || '<p class="va-empty">当前筛选下没有记录</p>';
    }
    root.querySelector('.va-list-count').textContent = `${all.length} 个地点`;
  }
  function detail() {
    const target=root.querySelector('.va-detail');
    target.scrollTop=0;
    const r=visibleRecords().find(r=>r.venue.id===state.selected);
    if (!r) {
      target.innerHTML='<span class="va-kicker">VENUE DOSSIER</span><div class="va-intro"><span class="va-cross">⌖</span><h3>欢迎来到，<br>Ave Mujica 的世界。</h3><p>点击地图上的场馆，或从下方列表选择，查看场馆介绍与演出履历。</p><div class="va-mini-legend"><span><i class="va-dot past"></i>已到访</span><span><i class="va-dot future"></i>未来到访</span><span><i class="va-dot mixed"></i>再次前往</span></div></div>';
      return;
    }
    const v=r.venue, events=visibleEvents(r).slice().sort((a,b)=>(b.day||0)-(a.day||0));
    const first=r.events.filter(e=>e.status==='past').sort((a,b)=>a.day-b.day)[0];
    const future=r.events.filter(e=>e.status==='future').sort((a,b)=>a.day-b.day)[0];
    const capacity=v.capacity || (/户外|复合/.test(v.kind)?'依活动配置':'官方容量暂未确认');
    const links=[v.source,v.capacity_source].filter((x,i,a)=>x&&a.indexOf(x)===i);
    const photo = v.photo ? `<figure class="va-photo"><a href="${esc(v.photo)}" target="_blank" rel="noopener noreferrer" aria-label="查看 ${esc(v.name)} 图片"><img src="${esc(v.photo)}" alt="${esc(v.photo_caption || v.name)}" loading="lazy" width="960" height="640"></a><figcaption>${esc(v.photo_caption || '场馆实景')}<span>© ${esc(v.photo_author)} · <a href="${esc(v.photo_source)}" target="_blank" rel="noopener noreferrer">图片来源</a> · <a href="${esc(v.photo_license_url)}" target="_blank" rel="noopener noreferrer">${esc(v.photo_license)}</a></span></figcaption></figure>` : '';
    target.innerHTML=`<span class="va-kicker">VENUE DOSSIER / ${esc(v.id.toUpperCase())}</span><div class="va-location">${esc(v.area)} <span>${esc(v.kind)}</span></div><h3>${esc(v.name)}</h3>${v.aliases?.length ? `<p class="va-alias">亦称 ${esc(v.aliases.join(' / '))}</p>`:''}${photo}<p class="va-description">${esc(v.description)}</p><div class="va-capacity"><small>场馆公开容量</small><strong>${esc(capacity)}</strong><p>场馆规格参考，实际开放席数依演出配置。</p></div><div class="va-history-metrics"><span>已举行 <b>${r.past}</b></span><span>未来 <b>${r.future}</b></span></div><p class="va-dates">${first?'首次到访 '+esc(first.live.date):'尚无已举行演出'}${future?'<br>下次演出 '+esc(future.live.date):''}</p><div class="va-kicker va-history-heading">PERFORMANCE HISTORY / ${events.length}</div><ol class="va-events">${events.map(e=>`<li class="${e.status}"><small>${esc(e.live.date||'日期待定')} <b>${({past:'已举行',future:'未来',undated:'日期待定'})[e.status]}</b></small><button type="button" data-event="${options.lives.indexOf(e.live)}">${esc(e.live.name)} <span>↗</span></button><em>${esc(e.live.tag||'其他')}</em>${e.live.venue!==v.name?`<span class="va-event-venue">当时场馆名：${esc(e.live.venue)}</span>`:''}</li>`).join('')}</ol><div class="va-sources">${links.map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${i?'容量出处':'官方资料'} ↗</a>`).join('')} ${v.checked?'<span>核对 '+esc(v.checked)+'</span>':''}</div>`;
  }
  function select(id, focusMap) {
    state.selected=id;
    const r=records.find(r=>r.venue.id===id);
    if (focusMap && r?.venue.region==='jp' && withinMap(r.venue)) {
      const [x,y]=project(r.venue);
      state.box=[x-36,y-28,72,56]; state.region='custom';
    }
    list(); detail(); drawMap(); updateRegionButtons();
  }
  function drawMap() {
    if (!root) return;
    const svg=root.querySelector('.va-map');
    if (!svg) return;
    state.box=constrainBox(state.box);
    const [x,y,w,h]=state.box;
    svg.setAttribute('viewBox',state.box.join(' '));
    const width=svg.clientWidth||800, height=svg.clientHeight||550;
    const unit=Math.max(w/width,h/height);
    const groups=[];
    visibleRecords().filter(r=>r.venue.region==='jp' && withinMap(r.venue)).forEach(r=>{
      const [px,py]=project(r.venue);
      if (px<x-15*unit||px>x+w+15*unit||py<y-15*unit||py>y+h+15*unit) return;
      let group=groups.find(g=>Math.hypot(g.x-px,g.y-py)<28*unit);
      if (!group) {group={x:px,y:py,items:[]};groups.push(group);}
      group.items.push(r);
    });
    svg.querySelector('.va-points').innerHTML=groups.map((g,i)=>{
      const multi=g.items.length>1, r=g.items[0], selected=g.items.some(r=>r.venue.id===state.selected);
      const title=multi?g.items.map(r=>r.venue.name).join(' / '):`${r.venue.name} · 已举行 ${r.past} / 未来 ${r.future}`;
      return `<g role="button" tabindex="0" class="va-point ${multi?'cluster':badge(r)} ${selected?'selected':''}" ${multi?`data-cluster="${i}"`:`data-venue="${esc(r.venue.id)}"`} aria-label="${esc(title)}" transform="translate(${g.x} ${g.y})"><title>${esc(title)}</title><circle class="va-hit" r="${20*unit}"/><circle class="va-halo" r="${(multi?15:12)*unit}"/><circle class="va-core" r="${(multi?11:5)*unit}"/>${multi?`<text text-anchor="middle" dy="${3.5*unit}" font-size="${10*unit}">${g.items.length}</text>`:''}${selected&&!multi?`<text class="va-point-label" x="${13*unit}" y="${-12*unit}" font-size="${12*unit}">${esc(r.venue.name)}</text>`:''}</g>`;
    }).join('');
    svg._clusters=groups;
    const labels=[['東京都',139.48,35.83],['神奈川県',139.23,35.42],['千葉県',140.20,35.55],['埼玉県',139.35,36.02],['山梨県',138.55,35.70]];
    svg.querySelector('.va-map-labels').innerHTML=w<330?labels.map(([name,lon,lat])=>`<text x="${lon*80.9}" y="${-lat*100}" font-size="${11*unit}">${name}</text>`).join(''):'';
    root.querySelector('.va-locator rect').setAttribute('x',x);
    root.querySelector('.va-locator rect').setAttribute('y',y);
    root.querySelector('.va-locator rect').setAttribute('width',w);
    root.querySelector('.va-locator rect').setAttribute('height',h);
    root.querySelector('.va-map-count').textContent=`当前视野 ${groups.reduce((n,g)=>n+g.items.length,0)} 个场馆`;
  }
  function zoom(factor, center) {
    const [x,y,w,h]=state.box, nw=Math.max(5,Math.min(mapBounds[2],w*factor)), ratio=nw/w;
    const c=center||[x+w/2,y+h/2];
    state.box=[c[0]-(c[0]-x)*ratio,c[1]-(c[1]-y)*ratio,nw,h*ratio];state.region='custom';
    drawMap();updateRegionButtons();
  }
  function mount(target, config) {
    cleanup(); root=target;options=config;
    records=model(config.lives,global.VENUE_ATLAS_DATA.venues,config.today,config.scope,config.scopeOf,config.dayOf);
    const paths=global.VENUE_ATLAS_MAP.map(p=>`<path d="${p.path}"><title>${esc(p.name)}</title></path>`).join('');
    root.innerHTML=`<section class="venue-atlas"><header class="va-toolbar"><div class="va-metrics"></div><div class="va-period" aria-label="演出时间筛选">${[['all','全部'],['past','已举行'],['future','未来']].map(([id,label])=>`<button type="button" data-period="${id}">${label}</button>`).join('')}</div></header><div class="va-layout"><div class="va-explore"><div class="va-map-panel"><nav class="va-regions" aria-label="地图区域">${[['japan','日本概览'],['kanto','首都圈'],['kansai','关西'],['chubu','中部'],['kyushu','九州']].map(([id,label])=>`<button type="button" data-region="${id}">${label}</button>`).join('')}</nav><svg class="va-map" aria-label="日本主要岛屿场馆示意图，可在限定范围内拖动和缩放" tabindex="0"><g class="va-land">${paths}</g><g class="va-map-labels"></g><g class="va-points"></g></svg><button type="button" class="va-locator-button" data-region="japan" aria-label="返回日本概览"><svg class="va-locator" viewBox="${mapBounds.join(' ')}" aria-hidden="true"><g>${paths}</g><rect/></svg><span>JAPAN ↗</span></button><div class="va-zoom"><button type="button" data-zoom="0.65" aria-label="放大地图">+</button><button type="button" data-zoom="1.54" aria-label="缩小地图">−</button></div><div class="va-map-footer"><span class="va-map-count"></span><span>场馆示意 · 点击圆点</span></div></div><div class="va-legend"><span><i class="va-dot past"></i>已到访</span><span><i class="va-dot future"></i>未来到访</span><span><i class="va-dot mixed"></i>再次前往</span><span>数字圆点可点击展开</span></div><section class="va-beyond"><span class="va-kicker">BEYOND JAPAN / 日本以外</span><div data-list="overseas"></div></section><details class="va-unknown"><summary>未定位的演出记录</summary><div data-list="unknown"></div></details><section class="va-directory"><header><span class="va-kicker">VENUE INDEX / 日本场馆</span><span class="va-list-count"></span></header><input type="search" class="va-search" aria-label="搜索场馆或城市" placeholder="搜索场馆、城市或旧名称" value="${esc(state.query)}"><div data-list="jp"></div></section><footer class="va-credit">按日本日期区分已举行与未来（含当天）；场次遵循上方演出类型筛选。<br>地图：<a href="https://www.gsi.go.jp/kankyochiri/gm_jpn.html" target="_blank" rel="noopener noreferrer">国土地理院・地球地図日本</a> / <a href="https://github.com/dataofjapan/land" target="_blank" rel="noopener noreferrer">dataofjapan</a>，仅示意四个主要岛屿；点位为场馆附近位置，其余场馆可从列表查看。</footer></div><aside class="va-detail" tabindex="0" aria-label="场馆介绍与演出履历" aria-live="polite"></aside></div></section>`;
    summary();updateRegionButtons();
    root.onclick=e=>{
      const b=e.target.closest('button,[data-venue],[data-cluster]');if(!b)return;
      if(b.dataset.period){state.period=b.dataset.period;summary();}
      else if(b.dataset.region)setRegion(b.dataset.region);
      else if(b.dataset.zoom)zoom(Number(b.dataset.zoom));
      else if(b.dataset.venue){select(b.dataset.venue,!b.closest('svg'));if(innerWidth<900)root.querySelector('.va-detail').scrollIntoView({behavior:'smooth',block:'start'});}
      else if(b.dataset.cluster!=null){const g=root.querySelector('.va-map')._clusters[Number(b.dataset.cluster)];zoom(0.4,[g.x,g.y]);const [,,w,h]=state.box;state.box=[g.x-w/2,g.y-h/2,w,h];drawMap();}
      else if(b.dataset.event!=null)config.openLive(Number(b.dataset.event));
    };
    root.onkeydown=e=>{if(e.target.matches('.va-point')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
    root.querySelector('.va-search').oninput=e=>{state.query=e.target.value;list();};
    const svg=root.querySelector('.va-map');let drag=null,moved=false;
    svg.onpointerdown=e=>{if(e.target.closest('.va-point'))return;drag={x:e.clientX,y:e.clientY,box:state.box.slice()};moved=false;svg.setPointerCapture(e.pointerId);};
    svg.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;const scale=Math.max(drag.box[2]/svg.clientWidth,drag.box[3]/svg.clientHeight);moved ||=Math.abs(dx)+Math.abs(dy)>4;state.box=[drag.box[0]-dx*scale,drag.box[1]-dy*scale,drag.box[2],drag.box[3]];state.region='custom';drawMap();};
    svg.onpointerup=svg.onpointercancel=()=>{drag=null;if(moved)updateRegionButtons();};
    svg.onkeydown=e=>{if(e.target!==svg)return;if(e.key==='+'||e.key==='=')zoom(.7);else if(e.key==='-')zoom(1.4);else if(/^Arrow/.test(e.key)){const d=state.box[2]*.12;state.box[0]+=e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0;state.box[1]+=e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0;drawMap();}else return;e.preventDefault();};
    const scrollArea=root.closest('.stats-body');
    const toolbar=root.querySelector('.va-toolbar');
    const resize=new ResizeObserver(()=>{
      drawMap();
      if (!scrollArea || !root.clientHeight) return;
      // Subtract the toolbar so the entire detail panel fits below the fixed stats controls.
      const offset=root.querySelector('.va-layout').getBoundingClientRect().top-root.getBoundingClientRect().top;
      root.style.setProperty('--va-detail-height',Math.max(160,scrollArea.clientHeight-offset-16)+'px');
    });
    resize.observe(svg);resize.observe(toolbar);
    if(scrollArea)resize.observe(scrollArea);
    cleanup=()=>resize.disconnect();
  }
  global.VenueAtlas={mount, model, normalize:normal};
})(window);
