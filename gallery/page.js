    // ==================== 动态生成筛选器 ====================
    const catMap = {}; // { CATEGORY: Set of subtags }
    galleryData.forEach(item => {
      Object.entries(item.tags).forEach(([cat, subs]) => {
        if (!catMap[cat]) catMap[cat] = new Set();
        subs.forEach(s => catMap[cat].add(s));
      });
    });
    const dimensionOrder = ['类型', 'LIVE', '人物', '关联人物', '作品', '节目', '来源'];
    const categories = Object.keys(catMap).sort((a, b) => {
      const rank = value => dimensionOrder.includes(value) ? dimensionOrder.indexOf(value) : 99;
      return rank(a) - rank(b) || a.localeCompare(b, 'zh-CN');
    });

    const filterBar = document.getElementById('filterBar');

    // ALL 组
    const allGroup = document.createElement('div');
    allGroup.className = 'filter-group';
    const allBtn = document.createElement('button');
    allBtn.className = 'main-tag active';
    allBtn.setAttribute('data-filter', 'all');
    allBtn.innerHTML = '<span class="diamond">&#9670;</span> 全部 / 清除筛选';
    allBtn.setAttribute('aria-pressed', 'true');
    allBtn.addEventListener('click', () => filterBy('all', allBtn));
    allGroup.appendChild(allBtn);
    filterBar.appendChild(allGroup);

    // 分类 + 子标签
    categories.forEach(cat => {
      const group = document.createElement('div');
      group.className = 'filter-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', cat);

      const catBtn = document.createElement('button');
      catBtn.className = 'main-tag';
      catBtn.setAttribute('data-filter', cat);
      catBtn.textContent = cat;
      catBtn.title = '清除此分类的筛选';
      catBtn.addEventListener('click', () => filterBy(cat, catBtn));
      group.appendChild(catBtn);

      const subs = Array.from(catMap[cat]).sort();
      subs.forEach(sub => {
        const subBtn = document.createElement('button');
        subBtn.className = 'sub-tag pill';
        subBtn.setAttribute('data-filter', cat + ':' + sub);
        subBtn.textContent = sub;
        subBtn.setAttribute('aria-pressed', 'false');
        subBtn.addEventListener('click', () => filterBy(cat + ':' + sub, subBtn));
        group.appendChild(subBtn);
      });

      filterBar.appendChild(group);
    });

    let currentPage = 1;
    const PER_PAGE = 50;
    const activeGalleryFilters = new Map();
    let gallerySearchQuery = '';

    document.getElementById('gallerySearchInput').addEventListener('input', function () {
      gallerySearchQuery = this.value.trim().toLocaleLowerCase();
      currentPage = 1;
      applyGalleryFilters();
    });

    function filterBy(target, clickedBtn) {
      if (target === 'all') {
        activeGalleryFilters.clear();
      } else if (!target.includes(':')) {
        activeGalleryFilters.delete(target);
      } else {
        const separator = target.indexOf(':');
        const category = target.slice(0, separator);
        const value = target.slice(separator + 1);
        const selected = activeGalleryFilters.get(category) || new Set();
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
        if (selected.size) activeGalleryFilters.set(category, selected);
        else activeGalleryFilters.delete(category);
      }
      filterBar.querySelectorAll('[data-filter]').forEach(button => {
        const value = button.dataset.filter;
        const separator = value.indexOf(':');
        const active = value === 'all' ? activeGalleryFilters.size === 0
          : separator < 0 ? activeGalleryFilters.has(value)
          : Boolean(activeGalleryFilters.get(value.slice(0, separator))?.has(value.slice(separator + 1)));
        button.classList.toggle('active', active);
        if (separator >= 0 || value === 'all') button.setAttribute('aria-pressed', String(active));
      });
      currentPage = 1;
      applyGalleryFilters();
    }

    function applyGalleryFilters() {
      document.querySelectorAll('.masonry-item').forEach(card => {
        const cardTags = JSON.parse(card.getAttribute('data-tags'));
        // 同一维度任选其一，不同维度同时满足。
        const tagMatches = [...activeGalleryFilters].every(([category, selected]) =>
          [...selected].some(value => (cardTags[category] || []).includes(value)));
        const textMatches = !gallerySearchQuery || card.dataset.search.includes(gallerySearchQuery);
        const show = tagMatches && textMatches;
        card.classList.toggle('hidden', !show);
      });
      const visibleCount = document.querySelectorAll('.masonry-item:not(.hidden)').length;
      document.getElementById('galleryResultCount').textContent = visibleCount + ' 条结果';
      paginate();
    }

    function paginate() {
      const allCards = document.querySelectorAll('.masonry-item');
      const visibleCards = [...allCards].filter(c => !c.classList.contains('hidden'));
      const totalPages = Math.ceil(visibleCards.length / PER_PAGE) || 1;
      if (currentPage > totalPages) currentPage = totalPages;

      // 隐藏所有卡片，再显示当前页的
      allCards.forEach(c => c.style.display = 'none');
      const start = (currentPage - 1) * PER_PAGE;
      const end = start + PER_PAGE;
      visibleCards.slice(start, end).forEach(c => {
        c.style.display = '';
        const image = c.querySelector('img[data-src]');
        if (image && !image.getAttribute('src')) image.src = image.dataset.src;
      });

      renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
      const bar = document.getElementById('paginationBar');
      if (totalPages <= 1) { bar.innerHTML = ''; return; }

      let html = '';
      // 上一页
      html += `<button class="pagination-btn arrow" ${currentPage === 1 ? 'disabled' : ''} onclick="window._galleryGoPage(${currentPage - 1})">&#10094;</button>`;

      // 页码按钮（最多显示 7 个）
      const maxVisible = 7;
      let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

      if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="window._galleryGoPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="pagination-dots">...</span>`;
      }

      for (let p = startPage; p <= endPage; p++) {
        html += `<button class="pagination-btn${p === currentPage ? ' active' : ''}" onclick="window._galleryGoPage(${p})">${p}</button>`;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-dots">...</span>`;
        html += `<button class="pagination-btn" onclick="window._galleryGoPage(${totalPages})">${totalPages}</button>`;
      }

      // 下一页
      html += `<button class="pagination-btn arrow" ${currentPage === totalPages ? 'disabled' : ''} onclick="window._galleryGoPage(${currentPage + 1})">&#10095;</button>`;

      html += `<span class="pagination-info">${currentPage} / ${totalPages}</span>`;
      bar.innerHTML = html;
    }

    window._galleryGoPage = function(page) {
      currentPage = page;
      paginate();
      document.getElementById('masonryGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // ==================== 动态生成图片卡片 ====================
    const grid = document.getElementById('masonryGrid');
    galleryData.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'masonry-item';
      card.dataset.galleryIndex = String(index);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', '查看图片：' + (item.title || item.filename.split('/').pop()));
      card.setAttribute('data-tags', JSON.stringify(item.tags));
      card.dataset.search = [item.title, item.date, item.description, JSON.stringify(item.tags)]
        .join(' ').toLocaleLowerCase();

      const img = document.createElement('img');
      img.dataset.src = item.thumbnail || item.filename;
      img.alt = item.title;
      img.loading = index < 4 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.onerror = () => {
        if (img.src !== new URL(item.filename, location.href).href) img.src = item.filename;
        else card.classList.add('loaded');
      };
      img.onload = () => card.classList.add('loaded');
      // 如果图片已缓存，onload 可能不触发
      if (img.getAttribute('src') && img.complete) card.classList.add('loaded');

      const cornerTL = document.createElement('div');
      cornerTL.className = 'corner-tl';
      const cornerBR = document.createElement('div');
      cornerBR.className = 'corner-br';

      const overlay = document.createElement('div');
      overlay.className = 'item-overlay';
      overlay.innerHTML = `
        <div class="item-date">${formatDate(item.date)}</div>
        <div class="item-desc">${item.title}</div>
      `;

      card.appendChild(img);
      card.appendChild(cornerTL);
      card.appendChild(cornerBR);
      card.appendChild(overlay);

      card.addEventListener('click', () => openLightbox(item));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(item);
        }
      });

      grid.appendChild(card);
    });

    // 初始分页
    applyGalleryFilters();

    function formatDate(dateStr) {
      if (!dateStr) return "";
      var d = String(dateStr).replace(/[年月]/g, "/").replace(/[日]/g, "");
      var parts = d.split(/[\/\-\.]/);
      if (parts.length === 3) {
        var y = parseInt(parts[0], 10);
        var m = String(parseInt(parts[1], 10)).padStart(2, "0");
        var day = String(parseInt(parts[2], 10)).padStart(2, "0");
        return y + "/" + m + "/" + day;
      }
      return dateStr;
    }

    // ==================== 灯箱 ====================
    const lightbox = document.getElementById('lightbox');
    let lightboxImg = document.getElementById('lightboxImg');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxLoader = document.getElementById('lightboxLoader');
    const lightboxLoadMessage = document.getElementById('lightboxLoadMessage');
    const lightboxRetry = document.getElementById('lightboxRetry');
    let imageRequest = 0;
    let activeItem = null;
    let lightboxItems = [];
    let lightboxIndex = 0;
    let returnFocus = null;
    let previousOverflow = '';
    let touchStart = null;
    let suppressClickUntil = 0;

    function filteredGalleryImages() {
      // hidden 标记筛选结果；display:none 只是分页，不应限制轮播范围。
      return [...document.querySelectorAll('.masonry-item:not(.hidden)')]
        .map(card => galleryData[Number(card.dataset.galleryIndex)]);
    }

    function loadLightboxImage(item) {
      const request = ++imageRequest;
      const previous = lightboxImg;
      previous.removeAttribute('id');
      lightboxImg = document.createElement('img');
      const current = lightboxImg;
      current.id = 'lightboxImg';
      current.className = 'lightbox-img';
      current.alt = '图片 ' + (lightboxIndex + 1) + ' / ' + lightboxItems.length;
      current.src = item.thumbnail || item.filename;
      previous.after(current);
      // Start the transition immediately, independently of the full-size request.
      void current.offsetWidth;
      previous.classList.remove('active');
      current.classList.add('active');
      setTimeout(() => previous.remove(), 300);
      lightboxLoader.hidden = true;
      lightboxLoader.classList.remove('is-error');
      lightboxRetry.hidden = true;

      const nextImage = new Image();
      nextImage.onload = () => {
        if (request !== imageRequest || !lightbox.classList.contains('active')) return;
        current.src = nextImage.src;
        lightboxImg.alt = '图片 ' + (lightboxIndex + 1) + ' / ' + lightboxItems.length;
        lightboxImg.hidden = false;
        lightboxLoader.hidden = true;
      };
      nextImage.onerror = () => {
        if (request !== imageRequest || !lightbox.classList.contains('active')) return;
        lightboxLoader.hidden = false;
        lightboxLoader.classList.add('is-error');
        lightboxLoadMessage.textContent = '图片加载失败，请检查网络后重试。';
        lightboxRetry.hidden = false;
      };
      nextImage.src = item.filename;
      // Only warm adjacent originals; opening a gallery must not fetch every file.
      [-1, 1].forEach(offset => {
        const neighbor = lightboxItems[(lightboxIndex + offset + lightboxItems.length) % lightboxItems.length];
        if (neighbor && neighbor !== item) { const image = new Image(); image.src = neighbor.filename; }
      });
    }

    function openLightbox(item) {
      hidePageTop();
      if (!lightbox.classList.contains('active')) {
        returnFocus = document.activeElement;
        previousOverflow = document.body.style.overflow;
      }
      lightboxItems = filteredGalleryImages();
      lightboxIndex = lightboxItems.indexOf(item);
      // 外部直达链接若不在当前筛选中，仅打开该图。
      if (lightboxIndex < 0) {
        lightboxItems = [item];
        lightboxIndex = 0;
      }
      lightboxPrev.hidden = lightboxNext.hidden = lightboxItems.length < 2;
      lightbox.classList.add('active');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      showLightboxItem();
      lightboxClose.focus({ preventScroll: true });
    }

    function showLightboxItem() {
      const item = lightboxItems[lightboxIndex];
      if (!item) return;
      history.replaceState(null, '', '#gallery=' + encodeURIComponent(item.hash_id));
      activeItem = item;
      loadLightboxImage(item);
    }

    function moveLightbox(direction) {
      if (!lightbox.classList.contains('active') || lightboxItems.length < 2) return;
      lightboxIndex = (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
      showLightboxItem();
    }

    function closeLightbox() {
      if (!lightbox.classList.contains('active')) return;
      imageRequest += 1;
      activeItem = null;
      lightboxItems = [];
      touchStart = null;
      lightboxImg.hidden = true;
      lightboxImg.removeAttribute('src');
      lightboxLoader.hidden = true;
      lightbox.classList.remove('active');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = previousOverflow;
      if (location.hash.startsWith('#gallery=')) {
        history.replaceState(null, '', location.pathname + location.search);
      }
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', () => moveLightbox(-1));
    lightboxNext.addEventListener('click', () => moveLightbox(1));
    lightboxRetry.addEventListener('click', () => {
      if (activeItem) loadLightboxImage(activeItem);
    });
    lightbox.addEventListener('click', (e) => {
      if (performance.now() < suppressClickUntil) return;
      if (!e.target.closest('.lightbox-img, button')) closeLightbox();
    });
    lightbox.addEventListener('touchstart', event => {
      touchStart = event.touches.length === 1 && !event.target.closest('button')
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    lightbox.addEventListener('touchcancel', () => { touchStart = null; });
    lightbox.addEventListener('touchend', event => {
      if (!touchStart || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        suppressClickUntil = performance.now() + 400;
        moveLightbox(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Escape') closeLightbox();
        else moveLightbox(e.key === 'ArrowLeft' ? -1 : 1);
      } else if (e.key === 'Tab') {
        const controls = [...lightbox.querySelectorAll('button')].filter(button => button.getClientRects().length);
        const next = controls[(controls.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + controls.length) % controls.length];
        e.preventDefault();
        next.focus();
      }
    });

    function openGalleryFromHash() {
      if (!location.hash.startsWith('#gallery=')) {
        if (lightbox.classList.contains('active')) closeLightbox();
        return;
      }
      const id = location.hash.slice(9);
      const item = galleryData.find(image => image.hash_id === id);
      if (item) openLightbox(item);
    }

    window.addEventListener('hashchange', openGalleryFromHash);

    // ==================== 返回顶部按钮 ====================
    const pageTopBtn = document.getElementById("pageTopBtn");
    let pageTopLastScrollY = window.scrollY;
    let pageTopUpwardDistance = 0;
    let pageTopHideTimer = 0;
    let pageTopIsReturning = false;

    function hidePageTop(resetIntent = true) {
      pageTopBtn.classList.remove("show");
      window.clearTimeout(pageTopHideTimer);
      if (resetIntent) pageTopUpwardDistance = 0;
    }

    function showPageTop() {
      pageTopBtn.classList.add("show");
      window.clearTimeout(pageTopHideTimer);
      pageTopHideTimer = window.setTimeout(hidePageTop, 4000);
    }

    function pageTopMinScroll() {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.min(800, Math.max(240, maxScroll * 0.25));
    }

    window.addEventListener("scroll", () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - pageTopLastScrollY;
      if (pageTopIsReturning || currentScrollY < pageTopMinScroll() || lightbox.classList.contains("active")) {
        hidePageTop();
      } else if (delta > 2) {
        hidePageTop();
      } else if (delta < -2) {
        pageTopUpwardDistance += -delta;
        if (pageTopUpwardDistance >= 160) showPageTop();
      }
      pageTopLastScrollY = currentScrollY;
    }, { passive: true });

    document.addEventListener("pointerdown", (event) => {
      if (!pageTopBtn.contains(event.target)) hidePageTop();
    }, true);

    pageTopBtn.addEventListener("click", () => {
      pageTopIsReturning = true;
      hidePageTop();
      document.body.style.overflowAnchor = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => {
        pageTopIsReturning = false;
        pageTopLastScrollY = window.scrollY;
        document.body.style.overflowAnchor = "auto";
      }, 1200);
    });

    openGalleryFromHash();
