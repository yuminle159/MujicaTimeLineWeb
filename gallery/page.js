    // ==================== 动态生成筛选器 ====================
    const catMap = {}; // { CATEGORY: Set of subtags }
    galleryData.forEach(item => {
      Object.entries(item.tags).forEach(([cat, subs]) => {
        if (!catMap[cat]) catMap[cat] = new Set();
        subs.forEach(s => catMap[cat].add(s));
      });
    });
    const categories = Object.keys(catMap).sort();

    const filterBar = document.getElementById('filterBar');

    // ALL 组
    const allGroup = document.createElement('div');
    allGroup.className = 'filter-group';
    const allBtn = document.createElement('button');
    allBtn.className = 'main-tag active';
    allBtn.setAttribute('data-filter', 'all');
    allBtn.innerHTML = '<span class="diamond">&#9670;</span> ALL';
    allBtn.addEventListener('click', () => filterBy('all', allBtn));
    allGroup.appendChild(allBtn);
    filterBar.appendChild(allGroup);

    // 分类 + 子标签
    categories.forEach(cat => {
      const sep = document.createElement('div');
      sep.className = 'separator';
      filterBar.appendChild(sep);

      const group = document.createElement('div');
      group.className = 'filter-group';

      const catBtn = document.createElement('button');
      catBtn.className = 'main-tag';
      catBtn.setAttribute('data-filter', cat);
      catBtn.innerHTML = '<span class="diamond">&#9670;</span> ' + cat;
      catBtn.addEventListener('click', () => filterBy(cat, catBtn));
      group.appendChild(catBtn);

      const subs = Array.from(catMap[cat]).sort();
      subs.forEach(sub => {
        const subBtn = document.createElement('button');
        subBtn.className = 'sub-tag pill';
        subBtn.setAttribute('data-filter', cat + ':' + sub);
        subBtn.textContent = sub;
        subBtn.addEventListener('click', () => filterBy(cat + ':' + sub, subBtn));
        group.appendChild(subBtn);
      });

      filterBar.appendChild(group);
    });

    let currentPage = 1;
    const PER_PAGE = 50;
    let activeGalleryFilter = 'all';
    let gallerySearchQuery = '';

    document.getElementById('gallerySearchInput').addEventListener('input', function () {
      gallerySearchQuery = this.value.trim().toLocaleLowerCase();
      currentPage = 1;
      applyGalleryFilters();
    });

    function filterBy(target, clickedBtn) {
      // 更新激活状态
      document.querySelectorAll('.main-tag, .sub-tag').forEach(b => b.classList.remove('active'));
      clickedBtn.classList.add('active');

      activeGalleryFilter = target;
      currentPage = 1;
      applyGalleryFilters();
    }

    function applyGalleryFilters() {
      document.querySelectorAll('.masonry-item').forEach(card => {
        const cardTags = JSON.parse(card.getAttribute('data-tags'));
        let tagMatches = false;

        if (activeGalleryFilter === 'all') {
          tagMatches = true;
        } else if (activeGalleryFilter.includes(':')) {
          const [cat, sub] = activeGalleryFilter.split(':');
          tagMatches = cardTags[cat] && cardTags[cat].includes(sub);
        } else {
          tagMatches = activeGalleryFilter in cardTags;
        }
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
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxDate = document.getElementById('lightboxDate');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDesc = document.getElementById('lightboxDesc');
    const lightboxClose = document.getElementById('lightboxClose');

    function openLightbox(item) {
      hidePageTop();
      history.replaceState(null, '', '#gallery=' + encodeURIComponent(item.hash_id));
      lightboxImg.src = item.filename;
      lightboxDate.textContent = formatDate(item.date);
      lightboxTitle.textContent = item.title;
      lightboxDesc.textContent = item.description || '';
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      if (location.hash.startsWith('#gallery=')) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
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
