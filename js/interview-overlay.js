(function (global) {
  "use strict";

  function discoveredData() {
    if (typeof interviewData !== "undefined" && Array.isArray(interviewData)) return interviewData;
    return Array.isArray(global.interviewData) ? global.interviewData : [];
  }

  let interviews = discoveredData();
  let manageHashByDefault = false;
  let includePageScroll = false;
  let activeManageHash = false;
  let previousBodyOverflow = "";
  let showOriginal = true;
  let lightboxGroup = null;
  let lightboxIndex = 0;
  let lastScrollY = 0;
  const renderedCache = new Map();

  let overlay;
  let body;
  let dateEl;
  let titleEl;
  let intervieweeEl;
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
          '<button class="shared-interview-original-btn" type="button" title="切换原文显示">原文显示</button>' +
          '<button class="shared-interview-close" type="button" aria-label="关闭">&times;</button>' +
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
    originalButton = overlay.querySelector(".shared-interview-original-btn");
    lightboxImages = lightbox.querySelector(".shared-interview-lightbox-images");
    lightboxCounter = lightbox.querySelector(".shared-interview-lightbox-counter");

    overlay.querySelector(".shared-interview-close").addEventListener("click", close);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    originalButton.addEventListener("click", toggleOriginal);

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
      scrollToTop(getScrollContainer());
    });
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeydown, true);
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

  function renderedContent(item, index) {
    if (!item.md_html) return '<div class="md-content"><p style="color:#555">暂无访谈内容</p></div>';
    const key = cacheKey(item, index);
    if (!renderedCache.has(key)) {
      renderedCache.set(key, '<div class="md-content">' + global.renderMarkdown(item.md_html) + '</div>');
    }
    return renderedCache.get(key);
  }

  function open(target, options) {
    options = options || {};
    const data = currentData(options);
    const index = typeof target === "number" ? target : data.indexOf(target);
    const item = typeof target === "number" ? data[target] : target;
    if (!item) return false;

    ensureMounted();
    if (!overlay.classList.contains("active")) previousBodyOverflow = document.body.style.overflow;
    activeManageHash = typeof options.manageHash === "boolean" ? options.manageHash : manageHashByDefault;

    dateEl.textContent = formatDate(item.date);
    titleEl.textContent = item.title || "";
    intervieweeEl.textContent = item.interviewee || "";
    body.innerHTML = renderedContent(item, index);
    bindInterviewImages();

    showOriginal = true;
    originalButton.textContent = "隐藏原文";
    originalButton.classList.remove("hidden-original");
    body.classList.remove("hide-original");
    body.style.overflowAnchor = "auto";
    body.scrollTop = 0;
    lastScrollY = 0;
    pageTopButton.classList.remove("show");

    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (activeManageHash && item.hash_id) {
      history.replaceState(null, "", "#" + encodeURIComponent(item.hash_id));
    }
    return true;
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
    closeLightbox();
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

  function handleScroll() {
    if (!pageTopButton) return;
    const container = getScrollContainer();
    if (!container) {
      pageTopButton.classList.remove("show");
      return;
    }
    const current = scrollTopOf(container);
    if (current < 800 || current > lastScrollY) pageTopButton.classList.remove("show");
    else pageTopButton.classList.add("show");
    lastScrollY = current;
  }

  function scrollToTop(container) {
    if (!container) return;
    if (container.isWindow) {
      document.body.style.overflowAnchor = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      container.element.style.overflowAnchor = "none";
      container.element.scrollTo({ top: 0, behavior: "smooth" });
    }
    setTimeout(function () {
      (container.isWindow ? document.body : container.element).style.overflowAnchor = "auto";
    }, 1000);
  }

  function handleKeydown(event) {
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

  function preRender(data) {
    if (Array.isArray(data)) interviews = data;
    const work = function () {
      currentData().forEach(function (item, index) {
        if (item.md_html) renderedContent(item, index);
      });
    };
    if (global.requestIdleCallback) global.requestIdleCallback(work);
    else setTimeout(work, 100);
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
    isOpen: isOpen,
    preRender: preRender
  };

  global.InterviewOverlay = api;
})(window);
