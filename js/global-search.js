(function () {
  "use strict";

  const ownScript = document.currentScript;
  const siteRoot = new URL("../", ownScript.src);
  const workerUrl = new URL("search-worker.js", ownScript.src);
  workerUrl.search = new URL(ownScript.src).search;
  const TYPE_META = {
    all: { label: "全部" }, song: { label: "歌曲", code: "SONG" },
    live: { label: "Live", code: "LIVE" }, timeline: { label: "时间线", code: "TIMELINE" },
    discography: { label: "唱片", code: "DISCOGRAPHY" }, interview: { label: "访谈", code: "INTERVIEW" },
    gallery: { label: "画廊", code: "GALLERY" }
  };
  let overlay, input, results, count, status, searchWorker, debounceTimer, previousFocus;
  let activeType = "all";
  let requestId = 0;
  let latestRenderedId = 0;
  let fallbackMode = false;
  let fallbackIndex = [];
  let fallbackBodies = null;
  let fallbackIndexPromise;
  let fallbackBodiesPromise;

  function normalize(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase()
      .replace(/[\s\u3000]+/g, " ")
      .replace(/[·・,，。.!！?？:：;；'"“”‘’()（）\[\]【】《》<>/\\|_-]+/g, " ").trim();
  }

  function compact(value) { return normalize(value).replace(/\s+/g, ""); }

  function loadDataScript(filename) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      const url = new URL(filename, siteRoot);
      url.search = new URL(ownScript.src).search;
      script.src = url.href;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function startFallback() {
    fallbackMode = true;
    if (!fallbackIndexPromise) {
      status.textContent = "正在载入兼容搜索组件…";
      fallbackIndexPromise = (window.WIJIPEDIA_SEARCH_INDEX ? Promise.resolve() : loadDataScript("search-index.js"))
        .then(function () {
          fallbackIndex = (window.WIJIPEDIA_SEARCH_INDEX || []).map(function (item) {
            item._title = normalize(item.title); item._titleCompact = compact(item.title);
            item._subtitle = normalize(item.subtitle); item._subtitleCompact = compact(item.subtitle);
            item._terms = normalize(item.terms); item._termsCompact = compact(item.terms);
            return item;
          });
          status.textContent = "兼容模式已启用；输入关键词开始搜索";
          sendQuery(true);
        }).catch(function () {
          status.textContent = "搜索索引载入失败，请刷新页面后重试";
        });
    }
  }

  function loadFallbackBodies() {
    if (fallbackBodiesPromise) return fallbackBodiesPromise;
    status.textContent = "正在载入正文索引…";
    fallbackBodiesPromise = (window.WIJIPEDIA_SEARCH_BODIES ? Promise.resolve() : loadDataScript("search-bodies.js"))
      .then(function () {
        fallbackBodies = {};
        Object.keys(window.WIJIPEDIA_SEARCH_BODIES || {}).forEach(function (key) {
          fallbackBodies[key] = normalize(window.WIJIPEDIA_SEARCH_BODIES[key]);
        });
        status.textContent = "已启用歌词、访谈与 MC 正文检索";
        fallbackSearch();
      }).catch(function () {
        fallbackBodies = {};
        status.textContent = "正文索引载入失败，仍可搜索标题与资料";
      });
    return fallbackBodiesPromise;
  }

  function fallbackScore(item, query, queryCompact, tokens, body) {
    let value = 0;
    if (item._title === query || item._titleCompact === queryCompact) value += 1200;
    else if (item._title.startsWith(query) || item._titleCompact.startsWith(queryCompact)) value += 760;
    else if (item._title.includes(query) || item._titleCompact.includes(queryCompact)) value += 560;
    if (item._subtitle.includes(query) || item._subtitleCompact.includes(queryCompact)) value += 320;
    if (item._terms.includes(query) || item._termsCompact.includes(queryCompact)) value += 230;
    if (body && body.includes(query)) value += 110;
    tokens.forEach(function (token) {
      const tokenCompact = token.replace(/\s+/g, "");
      if (item._title.includes(token) || item._titleCompact.includes(tokenCompact)) value += 100;
      else if (item._subtitle.includes(token) || item._terms.includes(token) || item._subtitleCompact.includes(tokenCompact) || item._termsCompact.includes(tokenCompact)) value += 40;
      else if (body && body.includes(token)) value += 18;
    });
    return value;
  }

  function fallbackSearch() {
    if (!fallbackIndex.length) return;
    const rawQuery = input.value.trim();
    const query = normalize(rawQuery);
    let matches;
    if (!query) {
      matches = fallbackIndex.filter(function (item) { return activeType === "all" || item.type === activeType; })
        .slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 12)
        .map(function (item) { return { item: item, snippet: item.subtitle || item.terms || "" }; });
    } else {
      const queryCompact = query.replace(/\s+/g, "");
      const tokens = query.split(" ").filter(Boolean);
      matches = fallbackIndex.map(function (item) {
        const body = fallbackBodies ? (fallbackBodies[item.key] || "") : "";
        return { item: item, value: fallbackScore(item, query, queryCompact, tokens, body), body: body };
      }).filter(function (match) {
        return match.value > 0 && (activeType === "all" || match.item.type === activeType);
      }).sort(function (a, b) {
        return b.value - a.value || String(b.item.date).localeCompare(String(a.item.date));
      }).slice(0, 40).map(function (match) {
        const position = match.body.indexOf(query);
        const snippet = position >= 0 ? (position ? "…" : "") + match.body.slice(Math.max(0, position - 42), position + query.length + 76).trim() + "…" : (match.item.subtitle || "");
        return { item: match.item, snippet: snippet };
      });
      if (!fallbackBodies) loadFallbackBodies();
    }
    renderResults(matches, rawQuery);
  }

  function startWorker() {
    if (searchWorker) return;
    try {
      searchWorker = new Worker(workerUrl);
      searchWorker.addEventListener("message", handleWorkerMessage);
      searchWorker.addEventListener("error", function () {
        searchWorker.terminate();
        searchWorker = null;
        startFallback();
      });
    } catch (error) {
      startFallback();
    }
  }

  function handleWorkerMessage(event) {
    const message = event.data || {};
    if (message.type === "ready") {
      status.textContent = "输入标题、人物、歌词或正文内容";
      sendQuery(true);
    } else if (message.type === "body-loading") {
      status.textContent = "正在后台载入正文索引…";
    } else if (message.type === "body-ready") {
      status.textContent = "已启用歌词、访谈与 MC 正文检索";
    } else if (message.type === "results" && message.id >= latestRenderedId) {
      latestRenderedId = message.id;
      renderResults(message.matches || [], message.query || "");
      if (message.bodyReady) status.textContent = "已启用歌词、访谈与 MC 正文检索";
    }
  }

  function sendQuery(immediate) {
    clearTimeout(debounceTimer);
    const run = function () {
      if (fallbackMode) { fallbackSearch(); return; }
      if (!searchWorker) return;
      requestId += 1;
      searchWorker.postMessage({ type: "query", id: requestId, query: input.value.trim(), filter: activeType });
    };
    if (immediate) run();
    else debounceTimer = setTimeout(run, 110);
  }

  function createResultCard(match) {
    const item = match.item;
    const meta = TYPE_META[item.type] || { label: item.type, code: item.type };
    const link = document.createElement("a");
    link.className = "global-search-result";
    link.href = new URL(item.url, siteRoot).href;
    const visual = document.createElement("span");
    visual.className = "global-search-result-visual";
    if (item.image) {
      const image = document.createElement("img");
      image.src = new URL(item.image, siteRoot).href;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", function () { visual.classList.add("is-empty"); image.remove(); });
      visual.appendChild(image);
    } else visual.classList.add("is-empty");
    const monogram = document.createElement("span");
    monogram.textContent = (meta.code || "FILE").slice(0, 2);
    visual.appendChild(monogram);
    const content = document.createElement("span");
    content.className = "global-search-result-content";
    const resultMeta = document.createElement("span");
    resultMeta.className = "global-search-result-meta";
    const type = document.createElement("b");
    type.textContent = meta.code || meta.label;
    const date = document.createElement("time");
    date.textContent = item.date || "ARCHIVE";
    resultMeta.append(type, date);
    const title = document.createElement("strong");
    title.textContent = item.title;
    const snippet = document.createElement("span");
    snippet.className = "global-search-result-snippet";
    snippet.textContent = match.snippet || item.subtitle || "";
    content.append(resultMeta, title, snippet);
    const arrow = document.createElement("span");
    arrow.className = "global-search-result-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(visual, content, arrow);
    return link;
  }

  function renderResults(matches, query) {
    count.textContent = query ? matches.length + " 条匹配结果" : "最近收录 " + matches.length + " 条";
    results.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "global-search-empty";
      empty.innerHTML = "<span>NO MATCHED FILE</span><strong>没有找到相关档案</strong><p>可以尝试更短的关键词、日文名或人物名。</p>";
      results.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    matches.forEach(function (match) { fragment.appendChild(createResultCard(match)); });
    results.appendChild(fragment);
  }

  function buildShell() {
    overlay = document.createElement("div");
    overlay.className = "global-search-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<section class="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="globalSearchTitle">' +
      '<header class="global-search-header"><div><span class="global-search-file-id">ARCHIVE // GLOBAL_SEARCH</span><h2 id="globalSearchTitle">Search the Archive</h2></div><button class="global-search-close" type="button" aria-label="关闭全局搜索">&times;</button></header>' +
      '<div class="global-search-input-wrap"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" placeholder="搜索歌曲、Live、访谈正文…" aria-label="全站搜索"><kbd>ESC</kbd></div>' +
      '<div class="global-search-controls"><div class="global-search-tabs" role="tablist"></div><span class="global-search-count" aria-live="polite"></span></div>' +
      '<p class="global-search-status" aria-live="polite">正在启动搜索组件…</p><div class="global-search-results"></div></section>';
    document.body.appendChild(overlay);
    input = overlay.querySelector("input");
    results = overlay.querySelector(".global-search-results");
    count = overlay.querySelector(".global-search-count");
    status = overlay.querySelector(".global-search-status");
    const tabs = overlay.querySelector(".global-search-tabs");
    Object.keys(TYPE_META).forEach(function (typeName) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "global-search-tab" + (typeName === "all" ? " is-active" : "");
      button.dataset.searchType = typeName;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", typeName === "all" ? "true" : "false");
      button.textContent = TYPE_META[typeName].label;
      tabs.appendChild(button);
    });
    overlay.querySelector(".global-search-close").addEventListener("click", closeSearch);
    overlay.addEventListener("mousedown", function (event) { if (event.target === overlay) closeSearch(); });
    overlay.addEventListener("click", function (event) {
      const tab = event.target.closest("[data-search-type]");
      if (!tab) return;
      activeType = tab.dataset.searchType;
      overlay.querySelectorAll("[data-search-type]").forEach(function (button) {
        const active = button === tab;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      sendQuery(true);
    });
    input.addEventListener("compositionstart", function () { input.dataset.composing = "true"; });
    input.addEventListener("compositionend", function () { delete input.dataset.composing; sendQuery(false); });
    input.addEventListener("input", function () { if (!input.dataset.composing) sendQuery(false); });
  }

  function openSearch() {
    if (!overlay) buildShell();
    previousFocus = document.activeElement;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("global-search-open");
    requestAnimationFrame(function () { input.focus(); });
    startWorker();
  }

  function closeSearch() {
    if (!overlay || !overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("global-search-open");
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }

  document.addEventListener("click", function (event) { if (event.target.closest("[data-global-search-trigger]")) openSearch(); });
  document.addEventListener("keydown", function (event) {
    const target = event.target;
    const typing = target && (target.matches("input, textarea, select") || target.isContentEditable);
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault(); openSearch();
    } else if (event.key === "/" && !typing && (!overlay || !overlay.classList.contains("is-open"))) {
      event.preventDefault(); openSearch();
    } else if (event.key === "Escape") closeSearch();
  });
})();
