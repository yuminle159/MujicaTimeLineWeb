(function (global) {
  "use strict";

  const ownScript = document.currentScript;
  const siteRoot = new URL("../", ownScript.src);
  const assetVersion = new URL(ownScript.src).search;
  const articleRequests = new Map();
  let articleStatus;
  let pendingOpenId = null;

  function showArticleStatus(message, retry) {
    if (!articleStatus) {
      articleStatus = document.createElement("div");
      articleStatus.className = "interview-load-status";
      articleStatus.setAttribute("role", "status");
      document.body.appendChild(articleStatus);
    }
    articleStatus.replaceChildren(document.createTextNode(message));
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "重试";
      button.addEventListener("click", retry, { once: true });
      articleStatus.appendChild(button);
    }
    articleStatus.hidden = false;
  }

  function loadArticle(item) {
    if (Object.prototype.hasOwnProperty.call(item, "md_html")) return Promise.resolve(item);
    const id = item.hash_id;
    const cached = global.WIJIPEDIA_INTERVIEW_ARTICLES;
    if (cached && Object.prototype.hasOwnProperty.call(cached, id)) {
      item.md_html = cached[id];
      return Promise.resolve(item);
    }
    if (articleRequests.has(id)) return articleRequests.get(id);
    const request = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      const url = new URL("interview/" + item.article_path, siteRoot);
      url.search = assetVersion;
      script.src = url.href;
      script.onload = function () {
        const articles = global.WIJIPEDIA_INTERVIEW_ARTICLES || {};
        if (Object.prototype.hasOwnProperty.call(articles, id)) {
          item.md_html = articles[id];
          resolve(item);
        } else reject(new Error("访谈正文缺失"));
        script.remove();
      };
      script.onerror = function () { script.remove(); reject(new Error("访谈正文载入失败")); };
      document.head.appendChild(script);
    }).catch(function (error) { articleRequests.delete(id); throw error; });
    articleRequests.set(id, request);
    return request;
  }

  function discoveredData() {
    if (typeof interviewData !== "undefined" && Array.isArray(interviewData)) return interviewData;
    return Array.isArray(global.interviewData) ? global.interviewData : [];
  }

  let interviews = discoveredData();
  let manageHashByDefault = false;
  let includePageScroll = false;
  let activeManageHash = false;
  let activeItem = null;
  let activeItemIndex = -1;
  let previousBodyOverflow = "";
  let showOriginal = true;
  let lightboxGroup = null;
  let lightboxIndex = 0;
  let lastScrollY = 0;
  let pageTopUpwardDistance = 0;
  let pageTopHideTimer = 0;
  let pageTopIsReturning = false;
  const renderedCache = new Map();

  let overlay;
  let body;
  let dateEl;
  let titleEl;
  let intervieweeEl;
  let sectionButton;
  let sectionPopover;
  let originalButton;
  let lightbox;
  let lightboxImages;
  let lightboxCounter;
  let pageTopButton;

  function ensureMounted() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "shared-interview-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML =
      '<div class="shared-interview-header">' +
        '<div class="shared-interview-meta">' +
          '<span class="shared-interview-date"></span>' +
          '<span class="shared-interview-title" id="sharedInterviewTitle"></span>' +
          '<span class="shared-interview-interviewee"></span>' +
        '</div>' +
        '<div class="shared-interview-actions">' +
          '<button class="shared-interview-section-btn" type="button" aria-expanded="false" hidden>章节</button>' +
          '<button class="shared-interview-original-btn" type="button" title="切换原文显示">原文显示</button>' +
          '<button class="shared-interview-close" type="button" aria-label="关闭">&times;</button>' +
          '<div class="shared-interview-section-popover" hidden>' +
            '<span class="shared-interview-section-kicker">CONTENTS / 章节</span>' +
            '<nav class="shared-interview-section-popover-list" aria-label="文章章节"></nav>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="shared-interview-body"></div>';
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "sharedInterviewTitle");

    lightbox = document.createElement("div");
    lightbox.className = "shared-interview-lightbox";
    lightbox.innerHTML =
      '<button class="shared-interview-lightbox-close" type="button" aria-label="关闭图片">&times;</button>' +
      '<button class="shared-interview-lightbox-arrow shared-interview-lightbox-prev" type="button" aria-label="上一张">&#10094;</button>' +
      '<div class="shared-interview-lightbox-images"></div>' +
      '<span class="shared-interview-lightbox-counter"></span>' +
      '<button class="shared-interview-lightbox-arrow shared-interview-lightbox-next" type="button" aria-label="下一张">&#10095;</button>';

    pageTopButton = document.createElement("button");
    pageTopButton.className = "shared-interview-page-top";
    pageTopButton.type = "button";
    pageTopButton.textContent = "↑Page Top";

    document.body.appendChild(overlay);
    document.body.appendChild(lightbox);
    document.body.appendChild(pageTopButton);

    body = overlay.querySelector(".shared-interview-body");
    dateEl = overlay.querySelector(".shared-interview-date");
    titleEl = overlay.querySelector(".shared-interview-title");
    intervieweeEl = overlay.querySelector(".shared-interview-interviewee");
    sectionButton = overlay.querySelector(".shared-interview-section-btn");
    sectionPopover = overlay.querySelector(".shared-interview-section-popover");
    originalButton = overlay.querySelector(".shared-interview-original-btn");
    lightboxImages = lightbox.querySelector(".shared-interview-lightbox-images");
    lightboxCounter = lightbox.querySelector(".shared-interview-lightbox-counter");

    overlay.querySelector(".shared-interview-close").addEventListener("click", close);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    sectionButton.addEventListener("click", function () {
      setSectionPopover(sectionPopover.hidden);
    });
    originalButton.addEventListener("click", toggleOriginal);
    document.addEventListener("pointerdown", function (event) {
      if (!sectionPopover.hidden && !overlay.querySelector(".shared-interview-actions").contains(event.target)) {
        setSectionPopover(false);
      }
    }, true);
    window.addEventListener("resize", function () { setSectionPopover(false); });

    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) closeLightbox();
    });
    lightbox.querySelector(".shared-interview-lightbox-close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".shared-interview-lightbox-prev").addEventListener("click", function (event) {
      event.stopPropagation();
      moveLightbox(-1);
    });
    lightbox.querySelector(".shared-interview-lightbox-next").addEventListener("click", function (event) {
      event.stopPropagation();
      moveLightbox(1);
    });

    pageTopButton.addEventListener("click", function () {
      hidePageTop();
      scrollToTop(getScrollContainer());
    });
    document.addEventListener("pointerdown", function (event) {
      if (!pageTopButton.contains(event.target)) hidePageTop();
    }, true);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("pagehide", persistActiveReadingState);
  }

  function configure(options) {
    options = options || {};
    if (Array.isArray(options.data) && options.data !== interviews) {
      interviews = options.data;
      renderedCache.clear();
    }
    if (typeof options.manageHash === "boolean") manageHashByDefault = options.manageHash;
    if (typeof options.includePageScroll === "boolean") includePageScroll = options.includePageScroll;
    ensureMounted();
    return api;
  }

  function currentData(options) {
    if (options && Array.isArray(options.data)) return options.data;
    if (interviews.length) return interviews;
    return discoveredData();
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    dateStr = dateStr.replace(/\s[\d:]+$/, "").trim();
    const match = dateStr.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})[日]?/);
    return match ? match[1] + "/" + match[2].padStart(2, "0") + "/" + match[3].padStart(2, "0") : dateStr;
  }

  function cacheKey(item, index) {
    return item.hash_id || item.title || String(index);
  }

  function readingStateKey(item, index) {
    return "wijipedia:interview-reading:v1:" + cacheKey(item, index);
  }

  function readReadingState(item, index) {
    try {
      const saved = JSON.parse(localStorage.getItem(readingStateKey(item, index)) || "null");
      return saved && typeof saved === "object" ? saved : null;
    } catch (error) {
      return null;
    }
  }

  function writeReadingState(item, index, scrollTop, originalVisible) {
    if (!item) return;
    try {
      localStorage.setItem(readingStateKey(item, index), JSON.stringify({
        scrollTop: Math.max(0, Math.round(Number(scrollTop) || 0)),
        showOriginal: originalVisible !== false
      }));
    } catch (error) {
      /* Storage may be unavailable in private browsing; reading still works normally. */
    }
  }

  function persistActiveReadingState() {
    if (!activeItem || !body) return;
    writeReadingState(activeItem, activeItemIndex, body.scrollTop, showOriginal);
  }

  function renderedContent(item, index) {
    if (!item.md_html) return '<div class="md-content"><p style="color:#555">暂无访谈内容</p></div>';
    const key = cacheKey(item, index);
    if (!renderedCache.has(key)) {
      renderedCache.set(key, '<div class="md-content">' + global.renderMarkdown(item.md_html) + '</div>');
    }
    return renderedCache.get(key);
  }

  function findInterviewById(id, data) {
    return (data || currentData()).find(function (item) { return item.hash_id === id; });
  }

  function setSectionPopover(opened) {
    if (!sectionButton || !sectionPopover) return;
    const shouldOpen = !!opened && !sectionButton.hidden;
    sectionPopover.hidden = !shouldOpen;
    sectionButton.setAttribute("aria-expanded", String(shouldOpen));
  }

  function makeSectionList(container, sections) {
    container.innerHTML = "";
    sections.forEach(function (section, index) {
      const button = document.createElement("button");
      button.className = "shared-interview-section-link";
      button.type = "button";
      button.dataset.interviewSection = section.id;
      const number = document.createElement("span");
      number.textContent = String(index + 1).padStart(2, "0");
      const label = document.createElement("strong");
      label.textContent = section.title;
      button.appendChild(number);
      button.appendChild(label);
      button.addEventListener("click", function () { scrollToSection(section.id); });
      container.appendChild(button);
    });
  }

  function scrollToSection(sectionId) {
    const heading = body && body.querySelector("#" + sectionId);
    if (!heading) return;
    const bodyRect = body.getBoundingClientRect();
    const destination = body.scrollTop + heading.getBoundingClientRect().top - bodyRect.top - 24;
    setSectionPopover(false);
    body.scrollTo({ top: Math.max(0, destination), behavior: "smooth" });
  }

  function updateActiveSection() {
    if (!overlay || !overlay.classList.contains("active") || !body) return;
    const headings = Array.from(body.querySelectorAll(".md-content h2[id]"));
    if (!headings.length) return;
    const threshold = body.getBoundingClientRect().top + 72;
    let current = headings[0];
    headings.forEach(function (heading) {
      if (heading.getBoundingClientRect().top <= threshold) current = heading;
    });
    overlay.querySelectorAll("[data-interview-section]").forEach(function (link) {
      link.classList.toggle("active", link.dataset.interviewSection === current.id);
    });
  }

  function navigateToInterview(hashId) {
    const data = currentData();
    const targetIndex = data.findIndex(function (item) { return item.hash_id === hashId; });
    if (targetIndex < 0) return;
    const manageHash = activeManageHash;
    setSectionPopover(false);
    persistActiveReadingState();
    open(targetIndex, { data: data, manageHash: manageHash });
  }

  function makeRelatedCard(target, reason) {
    const button = document.createElement("button");
    button.className = "shared-interview-related-card";
    button.type = "button";
    button.addEventListener("click", function () { navigateToInterview(target.hash_id); });

    const visual = document.createElement("span");
    visual.className = "shared-interview-related-visual";
    if (target.poster) {
      const image = document.createElement("img");
      image.src = target.poster;
      image.alt = "";
      image.loading = "lazy";
      visual.appendChild(image);
    } else {
      visual.classList.add("is-placeholder");
      visual.textContent = "INTERVIEW";
    }

    const copy = document.createElement("span");
    copy.className = "shared-interview-related-copy";
    const meta = document.createElement("span");
    meta.className = "shared-interview-related-meta";
    meta.textContent = formatDate(target.date) + (reason ? "  ·  " + reason : "");
    const title = document.createElement("strong");
    title.textContent = target.title || "";
    const people = document.createElement("span");
    people.className = "shared-interview-related-people";
    people.textContent = target.interviewee || "";
    copy.appendChild(meta);
    copy.appendChild(title);
    copy.appendChild(people);

    const arrow = document.createElement("span");
    arrow.className = "shared-interview-related-arrow";
    arrow.textContent = "→";
    button.appendChild(visual);
    button.appendChild(copy);
    button.appendChild(arrow);
    return button;
  }

  function makeChronologyLink(target, direction) {
    const button = document.createElement("button");
    button.className = "shared-interview-chronology-link " + direction;
    button.type = "button";
    button.addEventListener("click", function () { navigateToInterview(target.hash_id); });
    const label = document.createElement("span");
    label.textContent = direction === "previous" ? "← PREVIOUS / 上一篇" : "NEXT / 下一篇 →";
    const date = document.createElement("small");
    date.textContent = formatDate(target.date);
    const title = document.createElement("strong");
    title.textContent = target.title || "";
    button.appendChild(label);
    button.appendChild(date);
    button.appendChild(title);
    return button;
  }

  function buildReadingEnhancements(item, data) {
    const article = body.querySelector(".md-content");
    if (!article) return;
    const sections = Array.isArray(item.sections) ? item.sections : [];
    sectionButton.hidden = sections.length < 2;
    setSectionPopover(false);
    makeSectionList(sectionPopover.querySelector(".shared-interview-section-popover-list"), sections);

    const root = document.createElement("div");
    root.className = "shared-interview-reading-root";
    const layout = document.createElement("div");
    layout.className = "shared-interview-reading-layout";
    const articleColumn = document.createElement("div");
    articleColumn.className = "shared-interview-article-column";
    articleColumn.appendChild(article);

    const relatedItems = (Array.isArray(item.related) ? item.related : []).map(function (entry) {
      const target = findInterviewById(entry.id, data);
      return target ? { target: target, reason: entry.reason || "" } : null;
    }).filter(Boolean);
    if (relatedItems.length) {
      const related = document.createElement("section");
      related.className = "shared-interview-related";
      const heading = document.createElement("div");
      heading.className = "shared-interview-footer-heading";
      heading.innerHTML = "<span>RELATED INTERVIEWS</span><strong>关联访谈</strong>";
      related.appendChild(heading);
      const list = document.createElement("div");
      list.className = "shared-interview-related-list";
      relatedItems.forEach(function (entry) { list.appendChild(makeRelatedCard(entry.target, entry.reason)); });
      related.appendChild(list);
      articleColumn.appendChild(related);
    }

    const previous = findInterviewById(item.previous_id, data);
    const next = findInterviewById(item.next_id, data);
    if (previous || next) {
      const chronology = document.createElement("nav");
      chronology.className = "shared-interview-chronology" + (!previous || !next ? " is-single" : "");
      chronology.setAttribute("aria-label", "上一篇与下一篇访谈");
      if (previous) chronology.appendChild(makeChronologyLink(previous, "previous"));
      if (next) chronology.appendChild(makeChronologyLink(next, "next"));
      articleColumn.appendChild(chronology);
    }

    layout.appendChild(articleColumn);
    if (sections.length >= 2) {
      const navigation = document.createElement("aside");
      navigation.className = "shared-interview-section-nav";
      const kicker = document.createElement("span");
      kicker.className = "shared-interview-section-kicker";
      kicker.textContent = "CONTENTS / 章节";
      const list = document.createElement("nav");
      list.setAttribute("aria-label", "文章章节");
      makeSectionList(list, sections);
      navigation.appendChild(kicker);
      navigation.appendChild(list);
      layout.appendChild(navigation);
    }
    root.appendChild(layout);
    body.appendChild(root);
    window.requestAnimationFrame(updateActiveSection);
  }

  function openLoaded(target, options) {
    options = options || {};
    const data = currentData(options);
    const index = typeof target === "number" ? target : data.indexOf(target);
    const item = typeof target === "number" ? data[target] : target;
    if (!item) return false;

    ensureMounted();
    const manageHash = typeof options.manageHash === "boolean" ? options.manageHash : manageHashByDefault;
    const readingState = readReadingState(item, index);
    let savedShowOriginal = readingState ? readingState.showOriginal !== false : true;
    let savedScrollTop = readingState ? Math.max(0, Number(readingState.scrollTop) || 0) : 0;

    function activate() {
      activeItem = item;
      activeItemIndex = index;
      activeManageHash = manageHash;
      dateEl.textContent = formatDate(item.date);
      titleEl.textContent = item.title || "";
      intervieweeEl.textContent = item.interviewee || "";
      body.innerHTML = renderedContent(item, index);
      buildReadingEnhancements(item, data);
      bindInterviewImages();
      showOriginal = savedShowOriginal;
      originalButton.textContent = showOriginal ? "隐藏原文" : "原文显示";
      originalButton.classList.toggle("hidden-original", !showOriginal);
      body.classList.toggle("hide-original", !showOriginal);
      body.style.overflowAnchor = "auto";
      body.scrollTop = savedScrollTop;
      window.setTimeout(function () {
        if (activeItem === item && overlay.classList.contains("active")) {
          body.scrollTop = savedScrollTop;
          updateActiveSection();
        }
      }, 120);
      lastScrollY = savedScrollTop;
      pageTopButton.classList.remove("show");
      overlay.classList.add("active");
      overlay.setAttribute("aria-hidden", "false");
    }

    if (global.OverlayManager) {
      return global.OverlayManager.open({
        type: "interview",
        id: item.hash_id || item.title,
        hash: "#" + encodeURIComponent(item.hash_id),
        manageHash: manageHash,
        activate: activate,
        capture: function () {
          if (activeItem !== item) return;
          savedShowOriginal = showOriginal;
          savedScrollTop = body.scrollTop;
          writeReadingState(item, index, savedScrollTop, savedShowOriginal);
        },
        deactivate: function () {
          closeLightbox();
          setSectionPopover(false);
          overlay.classList.remove("active");
          overlay.setAttribute("aria-hidden", "true");
          pageTopButton.classList.remove("show");
        },
        getElement: function () { return overlay; },
        setLayer: function (layer) {
          overlay.style.zIndex = String(layer);
          pageTopButton.style.zIndex = String(layer + 100);
          lightbox.style.zIndex = String(layer + 200);
        },
        setInteractive: function (interactive) {
          if (interactive) return;
          closeLightbox();
          pageTopButton.classList.remove("show");
        },
        onRemove: function () {
          if (activeItem === item) {
            activeItem = null;
            activeItemIndex = -1;
            activeManageHash = false;
          }
        }
      });
    }

    if (!overlay.classList.contains("active")) previousBodyOverflow = document.body.style.overflow;
    activate();
    document.body.style.overflow = "hidden";
    if (manageHash && item.hash_id) history.replaceState(null, "", "#" + encodeURIComponent(item.hash_id));
    return true;
  }

  function open(target, options) {
    options = options || {};
    const data = currentData(options);
    const item = typeof target === "number" ? data[target] : target;
    if (!item) return false;
    pendingOpenId = item.hash_id || item.title;
    if (Object.prototype.hasOwnProperty.call(item, "md_html")) {
      if (articleStatus) articleStatus.hidden = true;
      return openLoaded(target, options);
    }
    showArticleStatus("正在载入访谈正文…");
    return loadArticle(item).then(function () {
      if (pendingOpenId !== (item.hash_id || item.title)) return false;
      articleStatus.hidden = true;
      return openLoaded(target, options);
    }).catch(function (error) {
      if (pendingOpenId !== (item.hash_id || item.title)) return false;
      console.error(error);
      showArticleStatus("访谈正文载入失败，请检查网络后重试。", function () { open(target, options); });
      return false;
    });
  }

  function openByTitle(title, options) {
    const data = currentData(options);
    const index = data.findIndex(function (item) { return item.title === title; });
    return index >= 0 ? open(index, options) : false;
  }

  function openByHash(hashId, options) {
    const data = currentData(options);
    const index = data.findIndex(function (item) { return item.hash_id === hashId; });
    return index >= 0 ? open(index, options) : false;
  }

  function hasTitle(title) {
    return currentData().some(function (item) { return item.title === title; });
  }

  function close() {
    if (!overlay || !overlay.classList.contains("active")) return;
    if (global.OverlayManager && activeItem) {
      global.OverlayManager.close("interview", activeItem.hash_id || activeItem.title);
      return;
    }
    persistActiveReadingState();
    closeLightbox();
    setSectionPopover(false);
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    pageTopButton.classList.remove("show");
    document.body.style.overflow = previousBodyOverflow;
    if (activeManageHash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    activeManageHash = false;
  }

  function toggleOriginal() {
    body.style.overflowAnchor = "none";
    const blocks = body.querySelectorAll("p, h1, h2, h3, li, blockquote");
    let anchor = null;
    let minDistance = Infinity;
    const viewCenter = window.innerHeight / 2;

    blocks.forEach(function (block) {
      const rect = block.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const distance = Math.abs(viewCenter - (rect.top + rect.height / 2));
        if (distance < minDistance) {
          minDistance = distance;
          anchor = block;
        }
      }
    });

    const oldTop = anchor ? anchor.getBoundingClientRect().top : 0;
    showOriginal = !showOriginal;
    originalButton.textContent = showOriginal ? "隐藏原文" : "原文显示";
    originalButton.classList.toggle("hidden-original", !showOriginal);
    body.classList.toggle("hide-original", !showOriginal);

    if (anchor) {
      requestAnimationFrame(function () {
        const newTop = anchor.getBoundingClientRect().top;
        body.scrollBy(0, newTop - oldTop);
        body.style.overflowAnchor = "auto";
        updateActiveSection();
      });
    } else {
      body.style.overflowAnchor = "auto";
    }
  }

  function bindInterviewImages() {
    const images = body.querySelectorAll(".md-content img");
    const sources = Array.from(images).map(function (image) { return image.src; });
    images.forEach(function (image, index) {
      image.style.cursor = "zoom-in";
      image.addEventListener("click", function (event) {
        event.stopPropagation();
        openLightbox(sources, index);
      });
    });
  }

  function openLightbox(group, index) {
    ensureMounted();
    hidePageTop();
    lightboxGroup = Array.isArray(group) ? group : [];
    lightboxIndex = typeof index === "number" ? index : 0;
    lightboxImages.innerHTML = "";
    lightboxGroup.forEach(function (source, imageIndex) {
      const image = document.createElement("img");
      image.src = source;
      image.className = imageIndex === lightboxIndex ? "active" : "";
      lightboxImages.appendChild(image);
    });
    updateLightboxControls();
    lightbox.classList.add("active");
  }

  function updateLightboxControls() {
    const multiple = lightboxGroup && lightboxGroup.length > 1;
    lightboxCounter.textContent = multiple ? (lightboxIndex + 1) + " / " + lightboxGroup.length : "";
    lightboxCounter.style.display = multiple ? "block" : "none";
    lightbox.querySelectorAll(".shared-interview-lightbox-arrow").forEach(function (arrow) {
      arrow.style.display = multiple ? "flex" : "none";
    });
  }

  function moveLightbox(direction) {
    if (!lightboxGroup || lightboxGroup.length < 2) return;
    const images = lightboxImages.querySelectorAll("img");
    images[lightboxIndex].classList.remove("active");
    lightboxIndex = ((lightboxIndex + direction) % lightboxGroup.length + lightboxGroup.length) % lightboxGroup.length;
    images[lightboxIndex].classList.add("active");
    updateLightboxControls();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("active");
    lightboxGroup = null;
    lightboxIndex = 0;
    setTimeout(function () {
      if (!lightbox.classList.contains("active")) lightboxImages.innerHTML = "";
    }, 300);
  }

  function getScrollContainer() {
    if (overlay && overlay.classList.contains("active")) return { element: body, isWindow: false };
    return includePageScroll ? { element: window, isWindow: true } : null;
  }

  function scrollTopOf(container) {
    return container.isWindow ? window.scrollY : container.element.scrollTop;
  }

  function pageTopMinScroll(container) {
    const maxScroll = container.isWindow
      ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      : Math.max(0, container.element.scrollHeight - container.element.clientHeight);
    return Math.min(800, Math.max(240, maxScroll * 0.25));
  }

  function handleScroll() {
    if (!pageTopButton) return;
    updateActiveSection();
    const container = getScrollContainer();
    if (!container || (lightbox && lightbox.classList.contains("active"))) {
      hidePageTop();
      return;
    }
    const current = scrollTopOf(container);
    const delta = current - lastScrollY;
    if (pageTopIsReturning || current < pageTopMinScroll(container)) {
      hidePageTop();
    } else if (delta > 2) {
      hidePageTop();
    } else if (delta < -2) {
      pageTopUpwardDistance += -delta;
      if (pageTopUpwardDistance >= 160) showPageTop();
    }
    lastScrollY = current;
  }

  function hidePageTop(resetIntent) {
    if (!pageTopButton) return;
    pageTopButton.classList.remove("show");
    window.clearTimeout(pageTopHideTimer);
    if (resetIntent !== false) pageTopUpwardDistance = 0;
  }

  function showPageTop() {
    pageTopButton.classList.add("show");
    window.clearTimeout(pageTopHideTimer);
    pageTopHideTimer = window.setTimeout(hidePageTop, 4000);
  }

  function scrollToTop(container) {
    if (!container) return;
    pageTopIsReturning = true;
    hidePageTop();
    if (container.isWindow) {
      document.body.style.overflowAnchor = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      container.element.style.overflowAnchor = "none";
      container.element.scrollTo({ top: 0, behavior: "smooth" });
    }
    setTimeout(function () {
      pageTopIsReturning = false;
      lastScrollY = scrollTopOf(container);
      (container.isWindow ? document.body : container.element).style.overflowAnchor = "auto";
    }, 1200);
  }

  function handleKeydown(event) {
    if (global.OverlayManager && overlay && overlay.classList.contains("active") &&
        !global.OverlayManager.isTop("interview", activeItem && (activeItem.hash_id || activeItem.title))) return;
    if (event.key === "Escape" && sectionPopover && !sectionPopover.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setSectionPopover(false);
      return;
    }
    if (event.key === "Escape" && lightbox && lightbox.classList.contains("active")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeLightbox();
      return;
    }
    if (lightbox && lightbox.classList.contains("active")) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopImmediatePropagation();
        moveLightbox(event.key === "ArrowLeft" ? -1 : 1);
      }
      return;
    }
    if (event.key === "Escape" && overlay && overlay.classList.contains("active")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }

  function isOpen() {
    return !!(overlay && overlay.classList.contains("active"));
  }

  const api = {
    configure: configure,
    open: open,
    openByTitle: openByTitle,
    openByHash: openByHash,
    hasTitle: hasTitle,
    close: close,
    isOpen: isOpen
  };

  global.InterviewOverlay = api;
})(window);
