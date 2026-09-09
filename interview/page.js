(function () {
  "use strict";

  const gallery = document.getElementById("gallery");
  const noResults = document.getElementById("noResults");
  const resultCount = document.getElementById("resultCount");
  const sortButton = document.getElementById("interviewSortBtn");
  let searchQuery = "";
  let interviewSortReverse = false;

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

  function renderCards(data) {
    const sorted = data.slice().sort(function (a, b) {
      const comparison = (a.date || "").localeCompare(b.date || "");
      return interviewSortReverse ? -comparison : comparison;
    });
    const query = searchQuery.toLowerCase();
    const filtered = sorted.filter(function (item) {
      return !query ||
        (item.title && item.title.toLowerCase().includes(query)) ||
        (item.interviewee && item.interviewee.toLowerCase().includes(query));
    });

    resultCount.textContent = filtered.length + " 条结果";
    noResults.style.display = filtered.length ? "none" : "block";
    gallery.innerHTML = "";

    filtered.forEach(function (item) {
      const originalIndex = data.indexOf(item);
      const card = document.createElement("div");
      card.className = "interview-card";
      card.style.cursor = "pointer";
      card.addEventListener("click", function () { InterviewOverlay.open(originalIndex); });
      card.innerHTML =
        '<div class="card-image">' +
          (item.poster ? '<img src="' + escapeHTML(item.poster) + '" alt="' + escapeHTML(item.title) + '" loading="lazy">' : '<div class="card-placeholder"></div>') +
        '</div>' +
        '<div class="card-info">' +
          '<div class="card-date">' + formatDate(item.date) + '</div>' +
          '<div class="card-title">' + escapeHTML(item.title) + '</div>' +
          '<div class="card-interviewee">' + escapeHTML(item.interviewee) + '</div>' +
        '</div>';
      gallery.appendChild(card);
    });
  }

  document.getElementById("searchInput").addEventListener("input", function () {
    searchQuery = this.value.trim();
    renderCards(interviewData);
  });

  sortButton.addEventListener("click", function () {
    interviewSortReverse = !interviewSortReverse;
    sortButton.innerHTML = interviewSortReverse ? "<span>时间正序</span>" : "<span>时间倒序</span>";
    renderCards(interviewData);
  });

  InterviewOverlay.configure({ data: interviewData, manageHash: true, includePageScroll: true });
  renderCards(interviewData);
  InterviewOverlay.preRender(interviewData);

  if (window.location.hash) {
    let hashId = window.location.hash.slice(1);
    try { hashId = decodeURIComponent(hashId); } catch (error) { hashId = ""; }
    if (hashId && !/^(song|live|discography)=/.test(hashId)) {
      setTimeout(function () { InterviewOverlay.openByHash(hashId); }, 200);
    }
  }
})();
