  (() => {
    InterviewOverlay.configure({ includePageScroll: true });
    let activeFilter = 'all'; let query = '';
    const archive = document.getElementById('archive');
    const escapeHTML = value => { const el = document.createElement('div'); el.textContent = value || ''; return el.innerHTML; };
    const yearOf = date => (date || '').slice(0, 4) || '未分类';
    const parseDate = date => Number((date || '').replace(/\D/g, '').slice(0, 8)) || 0;
    const JAPAN_OFFSET_MS = 9 * 60 * 60 * 1000;
    const japanTodayTimestamp = () => {
      const today = new Date(Date.now() + JAPAN_OFFSET_MS);
      return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    };
    const releaseTimestamp = date => {
      const match = String(date || '').match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
      if (!match) return NaN;
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    };
    const isComingSoon = release => {
      const timestamp = releaseTimestamp(release.release_date);
      return Number.isFinite(timestamp) && timestamp > japanTodayTimestamp();
    };
    const isReleaseToday = release => {
      return releaseTimestamp(release.release_date) === japanTodayTimestamp();
    };
    const releaseType = release => String(release.type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isCDRelease = release => /single|album/.test(releaseType(release));
    const isBluRayRelease = release => releaseType(release) === 'bluray';
    const isLPRelease = release => releaseType(release) === 'lp';
    const isOtherRelease = release => !isCDRelease(release) && !isBluRayRelease(release) && !isLPRelease(release);
    const matches = release => {
      const haystack = [release.title, release.title_jp, release.type, release.search_keywords].join(' ').toLowerCase();
      const formatMatch = activeFilter === 'all' || (activeFilter === 'cd' && isCDRelease(release)) || (activeFilter === 'blu-ray' && isBluRayRelease(release)) || (activeFilter === 'lp' && isLPRelease(release)) || (activeFilter === 'others' && isOtherRelease(release));
      return formatMatch && (!query || haystack.includes(query));
    };
    function renderArchive() {
      const visible = discographyData.filter(matches).sort((a, b) => parseDate(b.release_date) - parseDate(a.release_date));
      document.getElementById('resultCount').textContent = visible.length ? `共 ${visible.length} 张发行作品` : '';
      document.getElementById('noResults').hidden = visible.length > 0;
      const groups = visible.reduce((map, release) => { (map[yearOf(release.release_date)] ||= []).push(release); return map; }, {});
      archive.innerHTML = Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(year => `<section class="year-section"><div class="year-divider"><span>${year}</span></div><div class="release-grid">${groups[year].map(renderCard).join('')}</div></section>`).join('');
      const releaseById = new Map(visible.map(release => [String(release.id), release]));
      archive.querySelectorAll('.release-row').forEach(card => {
        const release = releaseById.get(String(card.dataset.releaseId));
        if (!release || !isReleaseToday(release) || isComingSoon(release)) return;
        card.classList.add('is-release-today');
        card.setAttribute('aria-label', `Released today: ${release.release_date}`);
        const ribbon = document.createElement('span');
        ribbon.className = 'coming-ribbon today-ribbon'; ribbon.setAttribute('aria-hidden', 'true'); ribbon.textContent = 'Today!';
        card.prepend(ribbon);
        const prompt = document.createElement('div');
        prompt.className = 'today-prompt'; prompt.setAttribute('aria-hidden', 'true');
        prompt.innerHTML = `<strong>RELEASE DATE</strong><span>${escapeHTML(release.release_date)}</span>`;
        card.querySelector('.row-aside').prepend(prompt);
      });
      archive.querySelectorAll('[data-release-id]').forEach(card => card.addEventListener('click', () => openRelease(card.dataset.releaseId)));
    }
    function renderCard(release) {
      const mainTitle = release.title_jp || release.title;
      const editionCovers = release.editions.map(edition => edition.cover).filter(Boolean);
      const covers = [release.cover, ...editionCovers.filter(cover => cover !== release.cover)].filter(Boolean).slice(0, 3);
      const coverStack = covers.map((cover, index) => `<span class="cover-stack-card" style="--i:${index}"><img src="${escapeHTML(cover)}" alt="" loading="lazy"></span>`).join('') || `<div class="cover-fallback"><i></i><strong>${escapeHTML(mainTitle)}</strong><small>UNKNOWN</small></div>`;
      const catalog = release.editions.map(edition => edition.catalog_no).filter(Boolean).join(' / ');
      const chart = release.chart || {};
      const rank = chart.first_week_rank || '—';
      const firstWeekSales = chart.first_week_sales || '—';
      const firstWeekSalesIsNoData = /^no data$/i.test(String(firstWeekSales).trim());
      const comingSoon = isComingSoon(release);
      const secondaryTitle = release.title && release.title !== mainTitle ? release.title : '';
      const prompt = '<div class="coming-prompt" aria-hidden="true"><strong>COMING SOON</strong><span>请关注官方发售并支持购买</span></div>';
      return `<button class="release-row${comingSoon ? ' is-coming-soon' : ''}" data-release-id="${escapeHTML(release.id)}"${comingSoon ? ' aria-label="Coming soon. Please support the official release."' : ''}>${comingSoon ? '<span class="coming-ribbon" aria-hidden="true">COMING SOON</span>' : ''}<div class="row-cover">${coverStack}${covers.length > 1 ? `<span class="cover-count">${covers.length} COVERS</span>` : ''}</div><div class="row-main"><div class="row-type">${escapeHTML(release.type)}</div><h2>${escapeHTML(mainTitle)}</h2>${secondaryTitle ? `<p>${escapeHTML(secondaryTitle)}</p>` : ''}<div class="row-date">${escapeHTML(release.release_date)}</div><div class="release-tags"><span>${release.editions.length} EDITION${release.editions.length === 1 ? '' : 'S'}</span>${release.formats.map(format => `<span class="media">${escapeHTML(format)}</span>`).join('')}</div></div><aside class="row-aside">${comingSoon ? prompt : ''}<div class="catalog">${escapeHTML(catalog)}</div><div class="chart-rank"><small>ORICON WEEKLY</small><span class="chart-summary">${escapeHTML(rank)} - <span class="chart-sales${firstWeekSalesIsNoData ? ' is-no-data' : ''}">${escapeHTML(firstWeekSales)}</span></span></div><div class="open-mark">OPEN ↗</div></aside></button>`;
    }
    function openRelease(id, updateHash = true) {
      return WijipediaData.load(['songs', 'live', 'interview']).then(data => {
        return DiscographyModal.open(id, {
          discography: discographyData,
          songs: data.songs,
          lives: data.live,
          updateHash
        });
      }).catch(error => {
        console.error(error);
        window.alert('关联资料载入失败，请检查网络后重试。');
      });
    }
    document.getElementById('filterGroup').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (!button) return; activeFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button)); renderArchive(); });
    document.getElementById('searchInput').addEventListener('input', event => { query = event.target.value.trim().toLowerCase(); renderArchive(); });
    renderArchive();
    function scheduleDiscographyDateRefresh() {
      const nextDay = japanTodayTimestamp() + 86400000 - JAPAN_OFFSET_MS;
      window.setTimeout(() => {
        renderArchive();
        scheduleDiscographyDateRefresh();
      }, Math.max(1000, nextDay - Date.now() + 1000));
    }
    scheduleDiscographyDateRefresh();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) renderArchive();
    });
    // Something New entry: use the stable, readable release_id rather than hash_id.
    const directReleaseId = new URLSearchParams(location.search).get('release');
    if (directReleaseId) {
      const release = discographyData.find(item => item.id === directReleaseId);
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete('release');
      history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      if (release) openRelease(release.id, false);
    }
    const sharedRelease = location.hash.startsWith('#discography=') ? decodeURIComponent(location.hash.slice(13)) : '';
    if (!directReleaseId && sharedRelease) { const release = discographyData.find(item => item.hash_id === sharedRelease); if (release) openRelease(release.id); }
  })();
