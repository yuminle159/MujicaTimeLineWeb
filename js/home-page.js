    // ==================== 公告轮播 ====================
    let annIdx = 0;
    const annText = document.getElementById('transmission-text');

    function renderAnnouncement(data) {
      const pin = data.pinned ? '<span class="t-pin-icon">[ PINNED ]</span> ' : '';
      annText.innerHTML = pin + '<span class="t-date">' + data.date + '</span> <span class="t-msg">' + data.msg + '</span>';
    }

    // 首页仅轮播最新 5 条非置顶公告；完整历史仍可在公告抽屉中查看。
    const tickerAnnouncements = window.ANNOUNCEMENTS
      .filter(a => !a.pinned)
      .slice(0, 5);

    if (tickerAnnouncements.length > 0) {
      renderAnnouncement(tickerAnnouncements[0]);
    }

    if (tickerAnnouncements.length > 1) {
      setInterval(() => {
        annText.classList.add('trans-fade-out');
        setTimeout(() => {
          annIdx = (annIdx + 1) % tickerAnnouncements.length;
          renderAnnouncement(tickerAnnouncements[annIdx]);
          annText.classList.remove('trans-fade-out');
        }, 500);
      }, 6000);
    }

    // ==================== 侧滑抽屉 ====================
    const drawer = document.getElementById('archiveDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const closeBtn = document.getElementById('closeDrawer');
    const trigger = document.getElementById('drawerTrigger');
    const drawerContent = document.getElementById('drawerContent');

    // 渲染抽屉内容
    const ANN_PER_PAGE = 10;
    let annCurrentPage = 1;
    const allItems = [];

    window.ANNOUNCEMENTS.forEach(a => {
      const item = document.createElement('div');
      item.className = a.pinned ? 'log-item pinned-item' : 'log-item';
      if (a.pinned) {
        item.innerHTML = '<div class="log-meta"><span class="log-date">[ ' + a.date + ' ]</span><span class="pin-badge">PINNED</span></div><div class="log-text">' + a.msg + '</div>';
      } else {
        item.innerHTML = '<div class="log-date">[ ' + a.date + ' ]</div><div class="log-text">' + a.msg + '</div>';
      }
      allItems.push(item);
    });

    function renderAnnPage() {
      const totalPages = Math.ceil(allItems.length / ANN_PER_PAGE) || 1;
      if (annCurrentPage > totalPages) annCurrentPage = totalPages;
      drawerContent.innerHTML = '';
      const start = (annCurrentPage - 1) * ANN_PER_PAGE;
      const end = start + ANN_PER_PAGE;
      allItems.slice(start, end).forEach(item => drawerContent.appendChild(item));
      renderAnnPagination(totalPages);
    }

    function renderAnnPagination(totalPages) {
      const bar = document.getElementById('annPaginationBar');
      if (totalPages <= 1) { bar.innerHTML = ''; return; }

      let html = '';
      html += '<button class="pagination-btn arrow"' + (annCurrentPage === 1 ? ' disabled' : '') + ' onclick="window._annGoPage(' + (annCurrentPage - 1) + ')">&#10094;</button>';

      const maxVisible = 7;
      let startPage = Math.max(1, annCurrentPage - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

      if (startPage > 1) {
        html += '<button class="pagination-btn" onclick="window._annGoPage(1)">1</button>';
        if (startPage > 2) html += '<span class="pagination-dots">...</span>';
      }
      for (let p = startPage; p <= endPage; p++) {
        html += '<button class="pagination-btn' + (p === annCurrentPage ? ' active' : '') + '" onclick="window._annGoPage(' + p + ')">' + p + '</button>';
      }
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="pagination-dots">...</span>';
        html += '<button class="pagination-btn" onclick="window._annGoPage(' + totalPages + ')">' + totalPages + '</button>';
      }
      html += '<button class="pagination-btn arrow"' + (annCurrentPage === totalPages ? ' disabled' : '') + ' onclick="window._annGoPage(' + (annCurrentPage + 1) + ')">&#10095;</button>';
      html += '<span class="pagination-info">' + annCurrentPage + ' / ' + totalPages + '</span>';
      bar.innerHTML = html;
    }

    window._annGoPage = function(page) { annCurrentPage = page; renderAnnPage(); };
    renderAnnPage();

    trigger.addEventListener('click', () => {
      drawer.classList.add('open');
      overlay.classList.add('active');
    });
    closeBtn.addEventListener('click', () => { drawer.classList.remove('open'); overlay.classList.remove('active'); });
    overlay.addEventListener('click', () => { drawer.classList.remove('open'); overlay.classList.remove('active'); });
