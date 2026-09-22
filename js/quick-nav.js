(function () {
  "use strict";
  const ownScript = document.currentScript;
  const root = new URL("../", ownScript.src);
  const path = location.pathname.toLowerCase();
  const landingHash = location.hash;
  const returnStorageKey = "wijipedia:return-source:v1";
  const returnQueryKey = "_wij_back";
  const arrivalUrl = new URL(location.href);
  const explicitReturnSource = arrivalUrl.searchParams.get(returnQueryKey) || "";
  const links = [
    ["⌂", "主页", "index.html", "home"],
    ["TL", "时间线", "timeline/index.html", "timeline"],
    ["S", "曲目", "songs/index.html", "songs"],
    ["D", "唱片", "discography/index.html", "discography"],
    ["L", "Live", "live/index.html", "live"],
    ["I", "访谈", "interview/index.html", "interview"],
    ["G", "画廊", "gallery/index.html", "gallery"],
    ["＋", "Upcoming", "upcoming/index.html", "upcoming"]
  ];
  const nav = document.createElement("nav");
  nav.className = "quick-nav";
  nav.setAttribute("aria-label", "快捷导航");

  function hasInternalHistory() {
    if (history.length <= 1 || !document.referrer) return false;
    try { return new URL(document.referrer).origin === location.origin; } catch (error) { return false; }
  }

  function cameFromAnotherInternalPage() {
    if (!hasInternalHistory()) return false;
    try {
      const source = new URL(document.referrer);
      return source.pathname !== location.pathname || source.search !== location.search;
    } catch (error) {
      return false;
    }
  }

  function routeKey(url) {
    return url.pathname + url.search + url.hash;
  }

  function isDetailUrl(url) {
    const targetPath = url.pathname.toLowerCase();
    if (targetPath.includes("/songs/")) return url.hash.startsWith("#song=");
    if (targetPath.includes("/live/")) return url.hash.startsWith("#live=");
    if (targetPath.includes("/discography/")) return url.hash.startsWith("#discography=");
    if (targetPath.includes("/timeline/")) return url.hash.startsWith("#timeline=");
    if (targetPath.includes("/gallery/")) return url.hash.startsWith("#gallery=");
    if (targetPath.includes("/interview/")) return url.hash.length > 1;
    return false;
  }

  function rememberReturnSource(url) {
    if (url.origin !== location.origin || url.pathname === location.pathname || !isDetailUrl(url)) return url;
    url.searchParams.set(returnQueryKey, location.href);
    try {
      sessionStorage.setItem(returnStorageKey, JSON.stringify({
        source: location.href,
        target: routeKey(url),
        createdAt: Date.now()
      }));
    } catch (error) {
      /* Navigation still works when session storage is unavailable. */
    }
    return url;
  }

  function readReturnSource() {
    try {
      const record = JSON.parse(sessionStorage.getItem(returnStorageKey) || "null");
      if (!record || Date.now() - Number(record.createdAt) > 7200000) return null;
      return record.target === routeKey(new URL(location.href)) ? record : null;
    } catch (error) {
      return null;
    }
  }

  const storedReturnSource = readReturnSource();
  if (explicitReturnSource) {
    arrivalUrl.searchParams.delete(returnQueryKey);
    history.replaceState(null, "", arrivalUrl.pathname + arrivalUrl.search + arrivalUrl.hash);
  }

  function isDetailLanding() {
    if ((!explicitReturnSource && !storedReturnSource && !cameFromAnotherInternalPage()) || !landingHash) return false;
    if (path.includes("/songs/")) return landingHash.startsWith("#song=");
    if (path.includes("/live/")) return landingHash.startsWith("#live=");
    if (path.includes("/discography/")) return landingHash.startsWith("#discography=");
    if (path.includes("/timeline/")) return landingHash.startsWith("#timeline=");
    if (path.includes("/gallery/")) return landingHash.startsWith("#gallery=");
    if (path.includes("/interview/")) return landingHash.length > 1;
    return false;
  }

  function returnToSource() {
    const fallbackSource = explicitReturnSource || (storedReturnSource && storedReturnSource.source);
    try { sessionStorage.removeItem(returnStorageKey); } catch (error) { /* Ignore storage restrictions. */ }
    if (history.length > 1) {
      const currentUrl = location.href;
      history.back();
      if (fallbackSource) {
        window.setTimeout(function () {
          if (location.href === currentUrl) location.replace(fallbackSource);
        }, 400);
      }
      return;
    }
    if (fallbackSource) location.replace(fallbackSource);
    else location.href = new URL("index.html", root).href;
  }

  function clickVisibleClose(selectors) {
    for (let index = 0; index < selectors.length; index += 1) {
      const button = document.querySelector(selectors[index]);
      if (button) {
        button.click();
        return true;
      }
    }
    return false;
  }

  function closeAuxiliaryLayer() {
    return clickVisibleClose([
      ".shared-interview-lightbox.active .shared-interview-lightbox-close",
      ".shared-live-kv-lightbox.shared-live-active .shared-live-kv-lightbox-close",
      ".shared-live-mc-modal.shared-live-active .shared-live-mc-modal-close",
      "#tlLightbox.active .tl-lightbox-close"
    ]);
  }

  function managedLayerDepth() {
    return window.OverlayManager ? window.OverlayManager.depth() : 0;
  }

  function landingLayerIsCurrent() {
    if (!isDetailLanding() || location.hash !== landingHash) return false;
    if (managedLayerDepth() === 1) return true;
    return !!document.querySelector("#tlModalOverlay.open, #lightbox.active");
  }

  function closeTopLayer() {
    if (managedLayerDepth() > 0) {
      const stack = window.OverlayManager.snapshot();
      const top = stack[stack.length - 1];
      if (top) {
        window.OverlayManager.close(top.type, top.id);
        return true;
      }
    }

    return clickVisibleClose([
      "#statsOverlay.active #statsCloseBtn",
      "#tlModalOverlay.open #tlModalClose",
      "#lightbox.active .lightbox-close",
      ".lyrics-atlas-overlay.active .lyrics-atlas-close"
    ]);
  }

  function goBack(event) {
    if (event && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    if (closeAuxiliaryLayer()) {
      if (event) event.preventDefault();
      return;
    }
    if (landingLayerIsCurrent()) {
      if (event) event.preventDefault();
      returnToSource();
      return;
    }
    if (closeTopLayer()) {
      if (event) event.preventDefault();
      return;
    }
    if (!hasInternalHistory()) return;
    if (event) event.preventDefault();
    history.back();
  }

  const back = document.createElement("a");
  back.className = "quick-nav-back";
  back.href = new URL("index.html", root).href;
  back.textContent = "←Back";
  back.dataset.label = "返回上一级";
  back.setAttribute("aria-label", "返回上一级");
  back.addEventListener("click", goBack);
  nav.appendChild(back);

  links.forEach(function (entry) {
    const link = document.createElement("a");
    link.href = new URL(entry[2], root).href;
    link.textContent = entry[0];
    link.dataset.label = entry[1];
    link.setAttribute("aria-label", entry[1]);
    if (entry[3] !== "home" && path.includes("/" + entry[3] + "/")) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
    }
    nav.appendChild(link);
  });
  document.body.appendChild(nav);

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.classList.contains("quick-nav-back")) return;
    try { link.href = rememberReturnSource(new URL(link.href, location.href)).href; } catch (error) { /* Ignore malformed links. */ }
  }, true);
})();
