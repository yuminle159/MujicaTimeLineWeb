(function () {
  'use strict';
  const data = Array.isArray(window.programsData) ? window.programsData : [];
  const $ = id => document.getElementById(id);
  const fields = ['aveOnly', 'search', 'series', 'year', 'sort'];
  const selectedPerformers = new Set();
  let limit = 20;
  const escape = text => String(text || '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const safeUrl = value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  };
  const color = person => /^#[0-9a-f]{6}$/i.test(person.color || '') ? person.color : '#777777';
  const band = person => person.bands.length ? person.bands.join(' / ') : '其他';
  const cast = new Map();
  data.forEach(item => {
    item.performers.forEach(person => {
      cast.set(person.name, person);
    });
  });
  const option = (select, value, title) => select.add(new Option(title || value, value));
  [...new Set(data.map(item => item.program))].forEach(name => option($('series'), name));
  [...new Set(data.map(item => item.date.slice(0, 4)).filter(Boolean))].sort().reverse().forEach(year => option($('year'), year));
  const orderedCast = [...cast.values()].sort((a,b) => Number(!a.bands.length) - Number(!b.bands.length)
    || (a.order ?? Infinity) - (b.order ?? Infinity));
  function renderCastFilters() {
    $('performerOptions').innerHTML = orderedCast.map(person => `<label style="--band-color:${color(person)}"><input type="checkbox" data-performer="${escape(person.name)}" ${selectedPerformers.has(person.name) ? 'checked' : ''}><span>${escape(person.name)}<small>${escape(band(person))}</small></span></label>`).join('');
    $('performerSelection').textContent = selectedPerformers.size ? `已选 ${selectedPerformers.size} 位` : '全部出演者';
  }
  function baseMatches(item) {
    if ($('aveOnly').checked && !item.performers.some(person => person.bands.includes('Ave Mujica'))) return false;
    if (![...selectedPerformers].every(name => item.performers.some(person => person.name === name))) return false;
    if ($('series').value && item.program !== $('series').value) return false;
    if ($('year').value && !item.date.startsWith($('year').value)) return false;
    const query = $('search').value.trim().toLocaleLowerCase();
    const haystack = [item.program, item.episode, item.title, item.date, ...item.performers.flatMap(person => [person.name, ...person.aliases, ...person.bands])].join(' ').toLocaleLowerCase();
    return !query || haystack.includes(query);
  }
  window.ProgramArchive = { current: () => data.filter(baseMatches) };
  function externalLink(url, title) {
    const safe = safeUrl(url);
    return safe ? `<a href="${escape(safe)}" target="_blank" rel="noopener noreferrer">${escape(title)} ↗</a>` : '';
  }
  function card(item) {
    const title = item.title || `${item.program} ${item.episode}`;
    const safeCover = /^\.\.\/images\/[a-zA-Z0-9_./\-\u0080-\uffff]+$/.test(item.cover) ? item.cover : safeUrl(item.cover);
    const image = safeCover ? `<img src="${escape(safeCover)}" alt="${escape(title)} 封面" loading="lazy" width="640" height="360">` : '<div class="cover-fallback">Programs<small>BROADCAST ARCHIVE</small></div>';
    const video = safeUrl(item.video_url);
    const coverContent = image + `<span class="episode-label">${escape(item.episode || 'SPECIAL')}</span>`;
    const cover = video ? `<a class="cover-link" href="${escape(video)}" target="_blank" rel="noopener noreferrer" aria-label="观看 ${escape(title)}">${coverContent}</a>` : `<div class="cover-link">${coverContent}</div>`;
    const tags = item.performers.map(person => `<button type="button" class="cast-tag" data-person="${escape(person.name)}" style="--band-color:${color(person)}" aria-pressed="${selectedPerformers.has(person.name)}" aria-label="筛选 ${escape(person.name)} 出演的节目"><span>${escape(person.name)}</span><small>${escape(band(person))}</small></button>`).join('');
    const clips = item.clips.map((url, index) => externalLink(url, `切片 ${index + 1}`)).filter(Boolean);
    return `<article class="program-card" id="${escape(item.program_id)}">${cover}<div class="card-body"><div class="program-date">${escape(item.date.replaceAll('-', '.') || '日期待确认')}${item.time ? `<span>${escape(item.time)} (UTC${escape(item.timezone)})</span>` : ''}</div><p class="series-label">${escape(item.program)}</p><h3>${escape(title)}</h3><div class="cast-tags">${tags || '<span class="no-clips">出演者待补充</span>'}</div><div class="card-actions">${externalLink(item.video_url, '完整节目')}${clips.join('')}${!clips.length ? '<span class="no-clips">暂无切片</span>' : ''}</div>${item.notes ? `<details class="notes"><summary>节目备注</summary><p>${escape(item.notes)}</p></details>` : ''}</div></article>`;
  }
  function render() {
    const filtered = data.filter(baseMatches);
    filtered.sort((a,b) => {
      if (!a.date || !b.date) return Number(!a.date) - Number(!b.date);
      return $('sort').value === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });
    $('resultCount').textContent = `找到 ${filtered.length} 期 · 全部收录 ${data.length} 期`;
    $('programList').innerHTML = filtered.slice(0, limit).map(card).join('') || '<div class="empty">没有符合条件的节目。<br>可以取消「只看 Ave Mujica」或调整筛选。</div>';
    $('loadMore').hidden = filtered.length <= limit;
    $('loadMore').textContent = `加载更多（还有 ${Math.max(0, filtered.length - limit)} 期）`;
    $('programList').querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      img.replaceWith(Object.assign(document.createElement('div'), {className:'cover-fallback', textContent:'封面暂不可用'}));
    }, {once:true}));
  }
  fields.forEach(id => $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { limit = 20; render(); }));
  function toggleSelection(set, value) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
  }
  function updateSelection() {
    limit = 20;
    renderCastFilters();
    render();
  }
  $('performerOptions').addEventListener('change', event => {
    const input = event.target.closest('[data-performer]');
    if (!input) return;
    toggleSelection(selectedPerformers, input.dataset.performer);
    updateSelection();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.multi-filter')) {
      $('performerFilter').open = false;
    }
    const clear = event.target.closest('[data-clear]');
    if (clear) {
      selectedPerformers.clear();
      updateSelection();
      return;
    }
    const button = event.target.closest('[data-person]');
    if (!button) return;
    toggleSelection(selectedPerformers, button.dataset.person);
    updateSelection();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = document.querySelector('.multi-filter[open]');
    if (open) {
      open.open = false;
      open.querySelector('summary').focus();
    }
  });
  $('reset').addEventListener('click', () => {
    ['search','series','year'].forEach(id => { $(id).value = ''; });
    selectedPerformers.clear();
    $('performerFilter').open = false;
    renderCastFilters();
    $('aveOnly').checked = true;
    $('sort').value = 'newest';
    limit = 20;
    render();
  });
  $('loadMore').addEventListener('click', () => { limit += 20; render(); });
  // Match the timeline's intent-aware PAGE TOP behavior.
  const pageTopBtn = $('pageTopBtn');
  let lastScrollY = window.scrollY;
  let upwardDistance = 0;
  let hideTimer = 0;
  let isReturning = false;
  function hidePageTop() {
    pageTopBtn.classList.remove('show');
    pageTopBtn.tabIndex = -1;
    pageTopBtn.setAttribute('aria-hidden', 'true');
    window.clearTimeout(hideTimer);
    upwardDistance = 0;
  }
  function showPageTop() {
    pageTopBtn.classList.add('show');
    pageTopBtn.tabIndex = 0;
    pageTopBtn.setAttribute('aria-hidden', 'false');
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hidePageTop, 4000);
  }
  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    const delta = current - lastScrollY;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const minScroll = Math.min(800, Math.max(240, maxScroll * .25));
    if (isReturning || current < minScroll || delta > 2) hidePageTop();
    else if (delta < -2) {
      upwardDistance += -delta;
      if (upwardDistance >= 160) showPageTop();
    }
    lastScrollY = current;
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (!pageTopBtn.contains(event.target)) hidePageTop();
  }, true);
  pageTopBtn.addEventListener('click', () => {
    isReturning = true;
    hidePageTop();
    const previousAnchor = document.body.style.overflowAnchor;
    document.body.style.overflowAnchor = 'none';
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    window.setTimeout(() => {
      isReturning = false;
      lastScrollY = window.scrollY;
      document.body.style.overflowAnchor = previousAnchor;
    }, 1200);
  });
  renderCastFilters();
  render();
})();
