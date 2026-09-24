(function () {
  "use strict";
  const button = document.getElementById("dailyArchiveTrigger");
  if (!button) return;
  const ownScript = document.currentScript;
  const siteRoot = new URL("../", ownScript.src);
  const returnStorageKey = "wijipedia:return-source:v1";
  const returnQueryKey = "_wij_back";
  let indexPromise = null;

  function isDetailUrl(url) {
    const path = url.pathname.toLowerCase();
    if (path.includes("/songs/")) return url.hash.startsWith("#song=");
    if (path.includes("/live/")) return url.hash.startsWith("#live=");
    if (path.includes("/discography/")) return url.hash.startsWith("#discography=");
    if (path.includes("/timeline/")) return url.hash.startsWith("#timeline=");
    if (path.includes("/gallery/")) return url.hash.startsWith("#gallery=");
    if (path.includes("/interview/")) return url.hash.length > 1;
    return false;
  }

  function rememberReturnSource(url) {
    if (url.origin !== location.origin || !isDetailUrl(url)) return url;
    url.searchParams.set(returnQueryKey, location.href);
    try {
      sessionStorage.setItem(returnStorageKey, JSON.stringify({
        source: location.href,
        target: url.pathname + url.search + url.hash,
        createdAt: Date.now()
      }));
    } catch (error) {
      /* Navigation still works when session storage is unavailable. */
    }
    return url;
  }

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank") return;
    try { link.href = rememberReturnSource(new URL(link.href, location.href)).href; } catch (error) { /* Ignore malformed links. */ }
  }, true);

  function dayKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = {};
    parts.forEach(function (part) { values[part.type] = part.value; });
    return values.year + "-" + values.month + "-" + values.day;
  }

  function loadIndex() {
    if (window.WIJIPEDIA_DAILY_ARCHIVE) return Promise.resolve(window.WIJIPEDIA_DAILY_ARCHIVE);
    if (indexPromise) return indexPromise;
    indexPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      const url = new URL("daily-archive.js", siteRoot);
      url.search = new URL(ownScript.src).search;
      script.src = url.href;
      script.onload = function () {
        if (Array.isArray(window.WIJIPEDIA_DAILY_ARCHIVE)) resolve(window.WIJIPEDIA_DAILY_ARCHIVE);
        else { indexPromise = null; reject(new Error("每日档案索引无效")); }
      };
      script.onerror = function () { indexPromise = null; script.remove(); reject(new Error("每日档案索引载入失败")); };
      document.head.appendChild(script);
    });
    return indexPromise;
  }

  function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    return match ? Number(match[1] + String(match[2]).padStart(2, "0") + String(match[3]).padStart(2, "0")) : 0;
  }

  function chooseArchive(items, dateKey) {
    const numericToday = Number(dateKey.replaceAll("-", ""));
    const supportedTypes = ["song", "live", "timeline", "interview", "discography"];
    const candidates = items.filter(function (item) {
      const itemDate = parseDate(item.date);
      return item && item.url && item.key && supportedTypes.includes(item.type) && (!itemDate || itemDate <= numericToday);
    });
    if (!candidates.length) return null;

    const groups = supportedTypes.map(function (type) {
      return candidates.filter(function (item) { return item.type === type; });
    }).filter(function (group) { return group.length; });
    const storageKey = "wijipedia:daily-archive:v2";
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && saved.date === dateKey) {
        const storedItem = candidates.find(function (item) { return item.key === saved.key; });
        if (storedItem) return storedItem;
      }
      const selectedGroup = groups[hashText(dateKey + ":type") % groups.length];
      const selected = selectedGroup[hashText(dateKey + ":" + selectedGroup[0].type) % selectedGroup.length];
      localStorage.setItem(storageKey, JSON.stringify({ date: dateKey, key: selected.key }));
      return selected;
    } catch (error) {
      const selectedGroup = groups[hashText(dateKey + ":type") % groups.length];
      return selectedGroup[hashText(dateKey + ":" + selectedGroup[0].type) % selectedGroup.length];
    }
  }

  function resetButton() {
    button.disabled = false;
    button.classList.remove("is-loading");
  }

  window.addEventListener("load", function () {
    window.setTimeout(function () {
      const warmIndex = function () { loadIndex().catch(function () { /* 点击时可重试。 */ }); };
      if (window.requestIdleCallback) window.requestIdleCallback(warmIndex, { timeout: 3000 });
      else warmIndex();
    }, 1200);
  }, { once: true });

  window.addEventListener("pageshow", resetButton);

  button.addEventListener("click", function () {
    button.disabled = true;
    button.classList.add("is-loading");
    loadIndex().then(function (items) {
      const selected = chooseArchive(items, dayKey());
      if (!selected) throw new Error("No archive item available");
      const target = new URL(selected.url, siteRoot);
      rememberReturnSource(target);
      resetButton();
      location.href = target.href;
    }).catch(function () {
      resetButton();
      button.dataset.tooltip = "档案载入失败，点击重试";
    });
  });
})();
