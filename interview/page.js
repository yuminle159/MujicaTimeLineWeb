(function () {
  "use strict";

  const gallery = document.getElementById("gallery");
  const noResults = document.getElementById("noResults");
  const resultCount = document.getElementById("resultCount");
  const sortButton = document.getElementById("interviewSortBtn");
  const translatedFilterButton = document.getElementById("filterTranslated");
  let searchQuery = "";
  let interviewSortReverse = false;
  let showTranslatedOnly = false;

  function formatDate(dateStr) {
    if (!dateStr) return "";
    dateStr = dateStr.replace(/\s[\d:]+$/, "").trim();
    const match = dateStr.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})[日]?/);
    return match ? match[1] + "/" + match[2].padStart(2, "0") + "/" + match[3].padStart(2, "0") : dateStr;
  }

  function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = value || "";
    return element.innerHTML;
  }

  function readingIndicator(state) {
    if (!state || state.scrollTop <= 20) return "";
    const known = Number.isFinite(state.progress);
    const percent = known ? Math.max(1, Math.round(state.progress * 100)) : 0;
    const label = known && state.progress >= .98 ? "上次读至末尾" : (known ? `继续阅读 · ${percent}%` : "继续阅读");
    return '<span class="card-reading-track" aria-hidden="true"><i style="width:' + (known ? percent : 0) + '%"></i></span><span class="card-reading-label">' + label + '</span>';
  }

  function updateReadingIndicator(card, state) {
    const indicator = card.querySelector(".card-reading-state");
    indicator.innerHTML = readingIndicator(state);
    indicator.hidden = !indicator.innerHTML;
  }

  function renderCards(data) {
    const sorted = data.slice().sort(function (a, b) {
      const comparison = (a.date || "").localeCompare(b.date || "");
      return interviewSortReverse ? -comparison : comparison;
    });
    const query = searchQuery.toLowerCase();
    const filtered = sorted.filter(function (item) {
      const matchesTranslation = !showTranslatedOnly || String(item.if_translated || "").toLowerCase() === "yes";
      const matchesSearch = !query ||
        (item.title && item.title.toLowerCase().includes(query)) ||
        (item.interviewee && item.interviewee.toLowerCase().includes(query));
      return matchesTranslation && matchesSearch;
    });

    resultCount.textContent = filtered.length + " 条结果";
    noResults.style.display = filtered.length ? "none" : "block";
    gallery.innerHTML = "";

    filtered.forEach(function (item, visibleIndex) {
      const originalIndex = data.indexOf(item);
      const card = document.createElement("div");
      card.className = "interview-card";
      card.dataset.interviewKey = item.hash_id || item.title || String(originalIndex);
      card.style.cursor = "pointer";
      card.addEventListener("click", function () { InterviewOverlay.open(originalIndex); });
      card.innerHTML =
        '<div class="card-image">' +
          (item.poster ? '<img src="' + escapeHTML(item.poster) + '" alt="' + escapeHTML(item.title) + '" loading="' + (visibleIndex < 4 ? 'eager' : 'lazy') + '" decoding="async">' : '<div class="card-placeholder"></div>') +
          (String(item.if_translated || "").toLowerCase() === "yes" ? '<span class="interview-status">CN</span>' : '') +
        '</div>' +
        '<div class="card-info">' +
          '<div class="card-date">' + formatDate(item.date) + '</div>' +
          '<div class="card-title">' + escapeHTML(item.title) + '</div>' +
          '<div class="card-interviewee">' + escapeHTML(item.interviewee) + '</div>' +
          '<div class="card-reading-state" hidden></div>' +
        '</div>';
      updateReadingIndicator(card, InterviewOverlay.getReadingState(item, originalIndex));
      gallery.appendChild(card);
    });
  }

  document.getElementById("searchInput").addEventListener("input", function () {
    searchQuery = this.value.trim();
    renderCards(interviewData);
  });

  translatedFilterButton.addEventListener("click", function () {
    showTranslatedOnly = !showTranslatedOnly;
    translatedFilterButton.classList.toggle("active", showTranslatedOnly);
    translatedFilterButton.setAttribute("aria-pressed", String(showTranslatedOnly));
    renderCards(interviewData);
  });

  sortButton.addEventListener("click", function () {
    interviewSortReverse = !interviewSortReverse;
    sortButton.innerHTML = interviewSortReverse ? "<span>时间正序</span>" : "<span>时间倒序</span>";
    renderCards(interviewData);
  });

  InterviewOverlay.configure({ data: interviewData, manageHash: true, includePageScroll: true });
  document.addEventListener("interviewreadingchange", function (event) {
    gallery.querySelectorAll(".interview-card").forEach(function (card) {
      if (card.dataset.interviewKey === event.detail.key) updateReadingIndicator(card, event.detail.state);
    });
  });
  window.addEventListener("storage", function (event) {
    if (event.key && !event.key.startsWith("wijipedia:interview-reading:v1:")) return;
    gallery.querySelectorAll(".interview-card").forEach(function (card) {
      const index = interviewData.findIndex(function (item) { return (item.hash_id || item.title) === card.dataset.interviewKey; });
      if (index >= 0) updateReadingIndicator(card, InterviewOverlay.getReadingState(interviewData[index], index));
    });
  });
  renderCards(interviewData);

  // Something New 入口：使用可读的 title 定位，并直接打开采访组件。
  const directInterviewTitle = new URLSearchParams(window.location.search).get("interview");
  if (directInterviewTitle) {
    const directIndex = interviewData.findIndex(function (item) { return item.title === directInterviewTitle; });
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("interview");
    history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    if (directIndex >= 0) InterviewOverlay.open(directIndex, { manageHash: false });
  }

  if (!directInterviewTitle && window.location.hash) {
    let hashId = window.location.hash.slice(1);
    try { hashId = decodeURIComponent(hashId); } catch (error) { hashId = ""; }
    if (hashId && !/^(song|live|discography)=/.test(hashId)) {
      setTimeout(function () { InterviewOverlay.openByHash(hashId); }, 200);
    }
  }
})();
