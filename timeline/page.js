(function () {
  // ===== 生成星空背景 =====
  function generateStardust(elementId, count, colorPalette) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const shadows = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 100).toFixed(2);
      const y = (Math.random() * 100).toFixed(2);
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      shadows.push(x + "vw " + y + "vh " + color);
    }
    el.style.boxShadow = shadows.join(", ");
  }

  // 幽暗底色系：白、红、蓝（低透明度）
  const stardustDim = [
    "rgba(255, 255, 255, 0.12)",
    "rgba(204, 41, 41, 0.15)",
    "rgba(80, 120, 180, 0.15)"
  ];
  // 高亮呼吸色系：白、红、金、蓝（较高透明度）
  const stardustBright = [
    "rgba(255, 255, 255, 0.7)",
    "rgba(230, 40, 40, 0.6)",
    "rgba(200, 160, 60, 0.55)",
    "rgba(120, 160, 220, 0.6)"
  ];

  generateStardust("stars-base", 160, stardustDim);
  generateStardust("stars-mid", 90, stardustDim);
  generateStardust("stars-blink-slow", 26, stardustBright);
  generateStardust("stars-blink-fast", 50, stardustBright);

  // 生成少量大颗“尖头十字”亮星（数量少，各自独立闪烁，几乎不占性能）
  (function generateBigStars(count) {
    const container = document.getElementById("stardustSparkles");
    if (!container) return;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.className = "big-star";
      const size = (16 + Math.random() * 20).toFixed(1); // 16 ~ 36 px
      s.style.left = (Math.random() * 100).toFixed(2) + "vw";
      s.style.top = (Math.random() * 100).toFixed(2) + "vh";
      s.style.width = size + "px";
      s.style.height = size + "px";
      s.style.animationDuration = (3.5 + Math.random() * 4).toFixed(2) + "s";
      s.style.animationDelay = (Math.random() * 5).toFixed(2) + "s";
      container.appendChild(s);
    }
  })(11);

  const START_TOP = 80;

  const trackL = document.getElementById("trackLeft");
  const trackR = document.getElementById("trackRight");
  const ticksL = document.getElementById("ticksLeft");
  const ticksR = document.getElementById("ticksRight");
  const wrapper = document.getElementById("timelineWrapper");

  const FM = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  function parseDate(dateStr) {
    // 支持 "2024/7/13 ~ 2024/7/14"，并兼容缓存中的旧连字符格式。
    const first = dateStr.split(/\s+(?:~|-)\s+/)[0].trim();
    return new Date(first);
  }

  const YEAR_LABEL_GAP = 60; // 年份标签与月份刻度的间距（px），可自行调整

  // 生成月度刻度（统一短轴）+ 年份标签（每年第一个月份上方）
  // 左右轨共用同一个刻度位置，确保年份/月份完全对齐
  function generateMonthTicks(mergedMonthMap) {
    const sortedMonths = Object.keys(mergedMonthMap).sort((a, b) => mergedMonthMap[a].minTop - mergedMonthMap[b].minTop);
    let lastYear = null;

    sortedMonths.forEach((mk) => {
      const tickTop = mergedMonthMap[mk].minTop;
      const [y, m] = mk.split('-');
      const monthNum = parseInt(m);
      const year = parseInt(y);
      const label = FM[monthNum - 1];

      // 新年份：在第一个月份刻度上方插入年份标签（左右各一个）
      if (year !== lastYear) {
        lastYear = year;
        const yearTop = tickTop - YEAR_LABEL_GAP;
        ['left', 'right'].forEach(side => {
          const yl = document.createElement("div");
          yl.className = "year-label";
          yl.style.top = yearTop + "px";
          yl.textContent = String(year);
          yl.dataset.side = side;
          (side === 'left' ? ticksL : ticksR).appendChild(yl);
        });
      }

      // 左右各生成一个刻度，位置相同
      ['left', 'right'].forEach(side => {
        const t = document.createElement("div");
        t.className = "tick";
        t.style.top = tickTop + "px";
        t.dataset.side = side;
        if (side === 'left') {
          t.innerHTML = `<span class="tick-line"></span><span class="tick-label">${label}</span>`;
        } else {
          t.innerHTML = `<span class="tick-label">${label}</span><span class="tick-line"></span>`;
        }
        (side === 'left' ? ticksL : ticksR).appendChild(t);
      });
    });
  }

  // 票根类别统一使用文字、色系和同一笔触的线条图标。
  const TICKET_ICONS = {
    live: '<path d="M4 19V8l4-4h8l4 4v11M8 4v15m8-15v15M4 12h16"/>',
    music: '<path d="M9 18V5l11-2v13M9 9l11-2"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    record: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3a9 9 0 0 1 9 9"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M8 5v14m8-14v14M3 9h5m-5 6h5m8-6h5m-5 6h5"/>',
    game: '<path d="M7 8h10a4 4 0 0 1 3.9 3.1l1 5a2 2 0 0 1-3.1 2l-2.3-1.8h-9L5.2 18a2 2 0 0 1-3.1-2l1-5A4 4 0 0 1 7 8Z"/><path d="M7 11v4m-2-2h4"/><circle cx="16" cy="12" r=".7" fill="currentColor" stroke="none"/><circle cx="18" cy="14" r=".7" fill="currentColor" stroke="none"/>',
    ticket: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V7Z"/><path d="M12 7v2m0 2v2m0 2v2"/>',
    person: '<circle cx="12" cy="8" r="3"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
    case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-10 0v2h2v-2"/>'
  };
  const TICKET_TYPES = {
    oml: { label: "单独Live", code: "LIVE", icon: "live", tone: "live" },
    bandori_fes: { label: "邦邦拼盘", code: "BanG Dream!", icon: "live", tone: "live" },
    fes: { label: "出演音乐节", code: "FES", icon: "live", tone: "live" },
    single: { label: "单曲发布", code: "SINGLE", icon: "music", tone: "music" },
    album: { label: "实体唱片", code: "RECORD", icon: "record", tone: "music" },
    anime: { label: "动画相关", code: "ANIME", icon: "film", tone: "anime" },
    game: { label: "游戏相关", code: "GAME", icon: "game", tone: "anime" },
    offline: { label: "线下活动", code: "EVENT", icon: "ticket", tone: "offline" },
    private: { label: "私人行程", code: "PERSONAL", icon: "person", tone: "private" },
    business: { label: "工作行程", code: "WORK", icon: "case", tone: "business" },
    other: { label: "其他事件", code: "EVENT", icon: "ticket", tone: "neutral" }
  };
  // 筛选与搜索沿用票根同一套中文类别名称。
  const TAG_NAMES = Object.fromEntries(
    Object.entries(TICKET_TYPES)
      .filter(([tag]) => tag !== "other")
      .map(([tag, type]) => [tag, type.label])
  );

  // ===== 筛选器 =====
  const filterTags = document.getElementById("filterTags");
  const timelineSearchInput = document.getElementById("timelineSearchInput");
  const timelineResultCount = document.getElementById("timelineResultCount");
  const eventGroups = [];
  let activeFilters = new Set();
  let timelineSearchQuery = "";

  timelineSearchInput.addEventListener("input", function () {
    timelineSearchQuery = this.value.trim().toLocaleLowerCase();
    applyFilter();
  });

  // 生成 ALL 按钮
  const allChip = document.createElement("button");
  allChip.className = "filter-chip active";
  allChip.innerHTML = '<span class="diamond">&#9670;</span> ALL';
  allChip.addEventListener("click", () => {
    activeFilters.clear();
    filterTags.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    allChip.classList.add("active");
    applyFilter();
  });
  filterTags.appendChild(allChip);

  // 生成筛选按钮
  const availableTags = typeof timelineTagOptions !== "undefined" ? timelineTagOptions : Object.keys(TAG_NAMES);
  availableTags.forEach(tag => {
    const chip = document.createElement("button");
    chip.className = "filter-chip";
    chip.dataset.tag = tag;
    chip.innerHTML = '<span class="diamond">&#9670;</span> ' + (TAG_NAMES[tag] || tag);
    chip.addEventListener("click", () => {
      allChip.classList.remove("active");
      chip.classList.toggle("active");
      if (chip.classList.contains("active")) {
        activeFilters.add(tag);
      } else {
        activeFilters.delete(tag);
      }
      if (activeFilters.size === 0) allChip.classList.add("active");
      applyFilter();
    });
    filterTags.appendChild(chip);
  });

  function applyFilter() {
    let visibleCount = 0;
    eventGroups.forEach(g => {
      const tagMatches = activeFilters.size === 0 || activeFilters.has(g.dataset.tag);
      const textMatches = !timelineSearchQuery || g.dataset.search.includes(timelineSearchQuery);
      const yearMatches = activeYear === null || Number(g.dataset.year) === activeYear;
      const visible = tagMatches && textMatches && yearMatches;
      g.classList.toggle("hidden", !visible);
      if (visible) visibleCount += 1;
    });
    timelineResultCount.textContent = visibleCount + " 条结果";
    relayoutTimeline();
  }

  // 创建事件
  timelineData.forEach((ev, idx) => {
    const isOrg = ev.category === "organization";
    const track = isOrg ? trackL : trackR;
    const d = parseDate(ev.date);

    const group = document.createElement("div");
    group.className = "event-group " + (isOrg ? "org" : "per");
    group.dataset.dateKey = String(d.getTime());
    group.dataset.year = String(d.getFullYear());
    group.dataset.index = idx;
    group.dataset.category = ev.category;
    group.dataset.tag = ev.tag || "";
    group.dataset.search = [ev.title, ev.date, ev.description, ev.tag, TAG_NAMES[ev.tag] || ""]
      .join(" ").toLocaleLowerCase();

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.setAttribute("role", "button");
    bubble.tabIndex = 0;
    const ticketType = TICKET_TYPES[ev.tag] || TICKET_TYPES.other;
    bubble.classList.add("ticket-" + ticketType.tone);
    bubble.innerHTML = `<div class="ticket-stub" aria-label="${ticketType.label}">
      <svg class="ticket-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TICKET_ICONS[ticketType.icon]}</svg>
      <span class="ticket-label">${ticketType.label}</span><span class="ticket-code">${ticketType.code}</span>
    </div><div class="ticket-body"><div class="b-date">${ev.date}</div><div class="b-title">${ev.title}</div></div>`;
    bubble.onclick = function () { openTimelineModal(idx); };
    bubble.onkeydown = function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openTimelineModal(idx);
      }
    };

    const connector = document.createElement("div");
    connector.className = "connector";

    const spacer = document.createElement("div");
    spacer.className = "spacer";

    const eventWrap = document.createElement("div");
    eventWrap.className = "event-wrap";
    eventWrap.appendChild(connector);
    eventWrap.appendChild(bubble);
    eventWrap.appendChild(spacer);

    group.appendChild(eventWrap);
    track.appendChild(group);
    eventGroups.push(group);
  });
  timelineResultCount.textContent = timelineData.length + " 条结果";

  // 相邻日期行及同一天的多条事件之间的固定间距。
  const MIN_GAP = 10;

  // ===== 模态框 =====
  const tlModalOverlay = document.getElementById("tlModalOverlay");
  const tlModalBody = document.getElementById("tlModalBody");
  const tlModalClose = document.getElementById("tlModalClose");

  function openTimelineModal(index) {
    const ev = timelineData[index];
    if (!ev) return;
    hidePageTop();
    history.replaceState(null, "", "#timeline=" + encodeURIComponent(ev.hash_id));
    document.body.style.overflow = "hidden";

    // 清除上一次模态框残留的 media-mode class，避免影响新内容
    tlModalBody.classList.remove("media-mode-image", "media-mode-video");

    const mediaItems = ev.media || [];
    const imageItems = mediaItems.filter(m => m.type === "image");
    const videoItems = mediaItems.filter(m => m.type === "video");
    const linkItems = mediaItems.filter(m => m.type === "link");
    const hasBoth = imageItems.length > 0 && videoItems.length > 0;

    let mediaHTML = "";

    // 图片区域（轮播，点击可放大→灯箱）
    if (imageItems.length > 0) {
      if (imageItems.length === 1) {
        const img = imageItems[0];
        mediaHTML += `<div class="tl-modal-img-carousel${hasBoth ? ' tl-media-img' : ''}">
          <div class="tl-img-track">
            <img src="${img.src}" alt="${img.caption || ''}" class="active" onclick="openTlLightbox('${img.src}', ${JSON.stringify(imageItems.map(m => m.src)).replace(/"/g, '&quot;')}, 0)">
          </div>
          ${img.caption ? `<div class="tl-modal-img-cap">${img.caption.replace(/\n/g, "<br>")}</div>` : ""}
        </div>`;
      } else {
        mediaHTML += `<div class="tl-modal-img-carousel${hasBoth ? ' tl-media-img' : ''}" id="tlImgCarousel">`;
        mediaHTML += '<div class="tl-img-track">';
        imageItems.forEach((img, i) => {
          mediaHTML += `<img src="${img.src}" alt="${img.caption || ''}" class="${i === 0 ? 'active' : ''}" loading="lazy" data-index="${i}" onclick="openTlLightbox('${img.src}', ${JSON.stringify(imageItems.map(m => m.src)).replace(/"/g, '&quot;')}, ${i})">`;
        });
        mediaHTML += '</div>';
        mediaHTML += '<div class="tl-img-controls">';
        mediaHTML += '<button class="tl-img-arrow tl-img-prev" onclick="moveTlImg(-1)">&#10094;</button>';
        mediaHTML += `<span class="tl-img-counter">1 / ${imageItems.length}</span>`;
        mediaHTML += '<button class="tl-img-arrow tl-img-next" onclick="moveTlImg(1)">&#10095;</button>';
        mediaHTML += '</div>';
        // caption 跟随当前图片
        mediaHTML += `<div class="tl-modal-img-cap" id="tlImgCaption">${imageItems[0].caption || ""}</div>`;
        mediaHTML += '</div>';
      }
    }

    // 视频区域
    if (videoItems.length > 0) {
      if (videoItems.length === 1) {
        mediaHTML += `<div class="tl-modal-video${hasBoth ? ' tl-media-video' : ''}"><iframe ${hasBoth ? `data-src="${videoItems[0].src}"` : `src="${videoItems[0].src}"`} class="tl-single-video" allowfullscreen></iframe></div>`;
      } else {
        mediaHTML += `<div class="tl-modal-video-carousel${hasBoth ? ' tl-media-video' : ''}" id="tlVideoCarousel">`;
        mediaHTML += '<div class="tl-video-track">';
        videoItems.forEach((v, i) => {
          mediaHTML += `<iframe data-src="${v.src}" class="tl-carousel-video${i === 0 ? ' active' : ''}" allowfullscreen data-index="${i}"></iframe>`;
        });
        mediaHTML += '</div>';
        mediaHTML += '<div class="tl-video-controls">';
        mediaHTML += '<button class="tl-video-arrow tl-video-prev" onclick="moveTlVideo(-1)">&#10094;</button>';
        mediaHTML += `<span class="tl-video-counter">1 / ${videoItems.length}</span>`;
        mediaHTML += '<button class="tl-video-arrow tl-video-next" onclick="moveTlVideo(1)">&#10095;</button>';
        mediaHTML += '</div></div>';
      }
    }

    // 链接区域
    if (linkItems.length > 0) {
      mediaHTML += '<div class="tl-modal-links">';
      linkItems.forEach(l => {
        mediaHTML += `<a class="tl-modal-link" href="${l.url}" target="_blank" rel="noopener">${l.title || l.url}</a>`;
      });
      mediaHTML += '</div>';
    }

    // 切换按钮（同时有图片和视频时显示）
    let toggleHTML = "";
    if (hasBoth) {
      toggleHTML = `<div class="tl-modal-toggle">
        <span class="tl-toggle-tab active" data-mode="image">Image</span>
        <span class="tl-toggle-tab" data-mode="video">Video</span>
      </div>`;
    }

    tlModalBody.innerHTML = `
      <div class="tl-modal-title">${ev.title}</div>
      <div class="tl-modal-header">
        <div class="tl-modal-date">${ev.date}</div>
        ${toggleHTML}
      </div>
      <div class="tl-modal-desc">${(ev.description || "").replace(/\n/g, "<br>")}</div>
      ${mediaHTML}
    `;

    // 绑定切换事件
    if (hasBoth) {
      tlModalBody.classList.add("media-mode-image");
      tlModalBody.querySelectorAll(".tl-toggle-tab").forEach(tab => {
        tab.addEventListener("click", function() {
          const mode = this.dataset.mode;
          tlModalBody.classList.remove("media-mode-image", "media-mode-video");
          tlModalBody.classList.add("media-mode-" + mode);
          tlModalBody.querySelectorAll(".tl-toggle-tab").forEach(t => t.classList.remove("active"));
          this.classList.add("active");
          // 切换到视频时延迟加载首帧
          if (mode === "video") {
            setTimeout(() => {
              const firstVideo = tlModalBody.querySelector(".tl-carousel-video.active") || tlModalBody.querySelector(".tl-single-video[data-src]");
              if (firstVideo && firstVideo.dataset.src) firstVideo.src = firstVideo.dataset.src;
            }, 0);
          } else {
            // 切回图片时停止视频播放
            tlModalBody.querySelectorAll("iframe").forEach(f => { f.src = ""; });
          }
        });
      });
    }

    // 启动视频轮播首帧（无切换按钮时直接加载）
    if (!hasBoth) {
      setTimeout(() => {
        const firstVideo = tlModalBody.querySelector(".tl-carousel-video.active");
        if (firstVideo && firstVideo.dataset.src) firstVideo.src = firstVideo.dataset.src;
      }, 0);
    }

    tlModalOverlay.classList.add("open");
  }

  function closeTimelineModal() {
    tlModalOverlay.classList.remove("open");
    document.body.style.overflow = "";
    if (location.hash.startsWith("#timeline=")) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    // 停止所有视频
    tlModalBody.querySelectorAll("iframe").forEach(f => { f.src = ""; });
  }

  tlModalClose.addEventListener("click", closeTimelineModal);
  tlModalOverlay.addEventListener("click", function(e) {
    if (e.target === tlModalOverlay) closeTimelineModal();
  });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && tlModalOverlay.classList.contains("open")) {
      if (document.getElementById("tlLightbox").classList.contains("active")) {
        closeTlLightbox();
      } else {
        closeTimelineModal();
      }
    }
  });

  // 模态框内视频轮播
  window.moveTlVideo = function(dir) {
    const track = document.getElementById("tlVideoCarousel");
    if (!track) return;
    const videos = track.querySelectorAll(".tl-carousel-video");
    let current = -1;
    videos.forEach((v, i) => { if (v.classList.contains("active")) current = i; });
    if (current < 0) return;
    videos[current].classList.remove("active");
    videos[current].src = "";
    const next = (current + dir + videos.length) % videos.length;
    videos[next].classList.add("active");
    if (videos[next].dataset.src) videos[next].src = videos[next].dataset.src;
    track.querySelector(".tl-video-counter").textContent = (next + 1) + " / " + videos.length;
  };

  // 模态框内图片轮播
  window.moveTlImg = function(dir) {
    const carousel = document.getElementById("tlImgCarousel");
    if (!carousel) return;
    const imgs = carousel.querySelectorAll(".tl-img-track img");
    const total = imgs.length;
    let current = -1;
    imgs.forEach((img, i) => { if (img.classList.contains("active")) current = i; });
    if (current < 0) return;
    imgs[current].classList.remove("active");
    const next = (current + dir + total) % total;
    imgs[next].classList.add("active");
    carousel.querySelector(".tl-img-counter").textContent = (next + 1) + " / " + total;
    const capEl = document.getElementById("tlImgCaption");
    if (capEl) capEl.textContent = imgs[next].alt || "";
  };

  // ===== 灯箱 =====
  let tlLightboxGroup = null;
  let tlLightboxIndex = 0;
  const tlLightboxImages = document.getElementById("tlLightboxImages");

  window.openTlLightbox = function(src, group, index) {
    hidePageTop();
    tlLightboxGroup = (group && group.length > 0) ? group : null;
    tlLightboxIndex = (index !== undefined) ? index : 0;
    const lb = document.getElementById("tlLightbox");

    // 预加载所有图片，只显示当前
    tlLightboxImages.innerHTML = "";
    if (tlLightboxGroup && tlLightboxGroup.length > 0) {
      tlLightboxGroup.forEach((imgSrc, i) => {
        const img = document.createElement("img");
        img.src = imgSrc;
        img.className = i === tlLightboxIndex ? "active" : "";
        tlLightboxImages.appendChild(img);
      });
    } else {
      const img = document.createElement("img");
      img.src = src;
      img.className = "active";
      tlLightboxImages.appendChild(img);
    }

    const counter = document.getElementById("tlLightboxCounter");
    const arrows = lb.querySelectorAll(".tl-lightbox-arrow");
    if (tlLightboxGroup && tlLightboxGroup.length > 1) {
      counter.textContent = (tlLightboxIndex + 1) + " / " + tlLightboxGroup.length;
      counter.style.display = "block";
      arrows.forEach(a => a.style.display = "flex");
    } else {
      counter.style.display = "none";
      arrows.forEach(a => a.style.display = "none");
    }
    lb.classList.add("active");
  };

  window.moveTlLightbox = function(dir) {
    if (!tlLightboxGroup) return;
    const imgs = tlLightboxImages.querySelectorAll("img");
    if (imgs.length === 0) return;
    imgs[tlLightboxIndex].classList.remove("active");
    tlLightboxIndex = ((tlLightboxIndex + dir) % tlLightboxGroup.length + tlLightboxGroup.length) % tlLightboxGroup.length;
    imgs[tlLightboxIndex].classList.add("active");
    document.getElementById("tlLightboxCounter").textContent = (tlLightboxIndex + 1) + " / " + tlLightboxGroup.length;
  };

  window.closeTlLightbox = function() {
    document.getElementById("tlLightbox").classList.remove("active");
    tlLightboxGroup = null;
    tlLightboxIndex = 0;
    // 延迟清理图片，避免关闭时闪烁
    setTimeout(() => { tlLightboxImages.innerHTML = ""; }, 300);
  };

  // 灯箱键盘导航
  document.addEventListener("keydown", function(e) {
    if (!document.getElementById("tlLightbox").classList.contains("active")) return;
    if (e.key === "ArrowLeft") moveTlLightbox(-1);
    if (e.key === "ArrowRight") moveTlLightbox(1);
  });

  // 灯箱点击事件
  document.getElementById("tlLightbox").addEventListener("click", function(e) {
    if (!e.target.closest(".tl-lightbox-images img, .tl-lightbox-close, .tl-lightbox-arrow")) closeTlLightbox();
  });
  document.querySelector("#tlLightbox .tl-lightbox-close").addEventListener("click", closeTlLightbox);
  document.querySelector("#tlLightbox .tl-lightbox-prev").addEventListener("click", function(e) { e.stopPropagation(); moveTlLightbox(-1); });
  document.querySelector("#tlLightbox .tl-lightbox-next").addEventListener("click", function(e) { e.stopPropagation(); moveTlLightbox(1); });

  // ==================== 排序切换 & 年份筛选 ====================
  let sortReverse = false;
  let activeYear = null;

  // 收集所有年份
  const allYears = [...new Set(
    timelineData.map(e => parseDate(e.date).getFullYear())
  )].sort((a, b) => a - b);

  // 年份筛选按钮
  const yearFilterBar = document.getElementById('yearFilterBar');
  const yearFilterTags = document.createElement('div');
  yearFilterTags.className = 'filter-tags';
  yearFilterBar.appendChild(yearFilterTags);

  const allYearBtn = document.createElement('button');
  allYearBtn.className = 'filter-chip active';
  allYearBtn.innerHTML = '<span class="diamond">&#9670;</span> ALL';
  allYearBtn.addEventListener('click', () => {
    activeYear = null;
    yearFilterTags.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    allYearBtn.classList.add('active');
    applyFilter();
  });
  yearFilterTags.appendChild(allYearBtn);

  allYears.forEach(y => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.textContent = String(y);
    btn.addEventListener('click', () => {
      activeYear = y;
      yearFilterTags.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      applyFilter();
    });
    yearFilterTags.appendChild(btn);
  });

  // 排序按钮
  const sortBtn = document.createElement('button');
  sortBtn.className = 'sort-btn';
  sortBtn.innerHTML = '<span>时间倒序</span>';
  sortBtn.addEventListener('click', () => {
    sortReverse = !sortReverse;
    sortBtn.innerHTML = sortReverse ? '<span>时间正序</span>' : '<span>时间倒序</span>';
    relayoutTimeline();
  });
  filterBar.appendChild(sortBtn);

  const emptyState = document.createElement("div");
  emptyState.className = "timeline-empty";
  emptyState.textContent = "没有符合条件的事件";
  wrapper.appendChild(emptyState);

  // 正序、倒序和所有筛选共用这一套双轨日期行布局。
  relayoutTimeline();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayoutTimeline, 120);
  });
  if (document.fonts) document.fonts.ready.then(relayoutTimeline);

  function relayoutTimeline() {
    const visibleGroups = eventGroups.filter(g => !g.classList.contains("hidden"));
    const dateRows = new Map();
    visibleGroups.forEach(g => {
      const key = Number(g.dataset.dateKey);
      if (!dateRows.has(key)) dateRows.set(key, { left: [], right: [] });
      dateRows.get(key)[g.dataset.category === "organization" ? "left" : "right"].push(g);
    });

    const orderedDates = [...dateRows.keys()].sort((a, b) => sortReverse ? b - a : a - b);
    const monthMap = {};
    let currentTop = START_TOP;
    let previousYear = null;

    orderedDates.forEach(dateKey => {
      const date = new Date(dateKey);
      const year = date.getFullYear();
      const monthKey = year + "-" + String(date.getMonth() + 1).padStart(2, "0");
      if (year !== previousYear) currentTop += YEAR_LABEL_GAP;
      previousYear = year;

      const row = dateRows.get(dateKey);
      row.left.sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
      row.right.sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
      const rowCount = Math.max(row.left.length, row.right.length);

      for (let i = 0; i < rowCount; i++) {
        const left = row.left[i];
        const right = row.right[i];
        if (!monthMap[monthKey]) monthMap[monthKey] = { minTop: currentTop };
        if (left) left.style.top = currentTop + "px";
        if (right) right.style.top = currentTop + "px";
        currentTop += Math.max(left?.offsetHeight || 0, right?.offsetHeight || 0) + MIN_GAP;
      }
    });

    ticksL.replaceChildren();
    ticksR.replaceChildren();
    generateMonthTicks(monthMap);
    emptyState.hidden = visibleGroups.length > 0;
    wrapper.classList.toggle("is-empty", visibleGroups.length === 0);

    const contentHeight = visibleGroups.length ? currentTop - MIN_GAP + 80 : 220;
    wrapper.style.minHeight = contentHeight + "px";
    ticksL.style.height = contentHeight + "px";
    ticksR.style.height = contentHeight + "px";
  }

  // ==================== 返回顶部按钮 ====================
  const pageTopBtn = document.getElementById("pageTopBtn");
  let lastScrollY = window.scrollY;
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
    const delta = currentScrollY - lastScrollY;
    const overlayOpen = tlModalOverlay.classList.contains("open") ||
      document.getElementById("tlLightbox").classList.contains("active");

    if (pageTopIsReturning || currentScrollY < pageTopMinScroll() || overlayOpen) {
      hidePageTop();
    } else if (delta > 2) {
      hidePageTop();
    } else if (delta < -2) {
      pageTopUpwardDistance += -delta;
      if (pageTopUpwardDistance >= 160) showPageTop();
    }
    lastScrollY = currentScrollY;
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
      lastScrollY = window.scrollY;
      document.body.style.overflowAnchor = "auto";
    }, 1200);
  });

  function openTimelineFromHash() {
    if (!location.hash.startsWith("#timeline=")) {
      if (tlModalOverlay.classList.contains("open")) closeTimelineModal();
      return;
    }
    const id = location.hash.slice(10);
    const index = timelineData.findIndex(event => event.hash_id === id);
    if (index >= 0) openTimelineModal(index);
  }

  window.addEventListener("hashchange", openTimelineFromHash);
  openTimelineFromHash();

})();
