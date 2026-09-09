(function (global) {
  "use strict";

  let overlay;
  let activeRelease = null;
  let activeEdition = 0;
  let activeCoverIndex = 0;
  let currentOptions = {};

  function escapeHTML(value) {
    const node = document.createElement("div");
    node.textContent = value == null ? "" : String(value);
    return node.innerHTML;
  }

  function dataFrom(options) {
    return (options && options.discography) || global.discographyData || [];
  }

  function ensureMarkup() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "shared-discography-modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<article class="shared-discography-modal" role="dialog" aria-modal="true" aria-labelledby="sharedDiscographyTitle">' +
      '<button class="shared-discography-close" type="button" aria-label="关闭">&times;</button>' +
      '<div class="shared-discography-body">' +
        '<section class="shared-discography-detail-hero">' +
          '<div class="shared-discography-detail-cover"><div class="shared-discography-cover-viewport"><img class="shared-discography-cover-image" alt=""><div class="shared-discography-cover-fallback"></div></div><div class="shared-discography-cover-controls"><button class="shared-discography-cover-nav prev" type="button" data-discography-cover-nav="-1" aria-label="上一张">&lt;</button><button class="shared-discography-cover-nav next" type="button" data-discography-cover-nav="1" aria-label="下一张">&gt;</button></div></div>' +
          '<div class="shared-discography-detail-summary"><div class="shared-discography-detail-type"></div><h2 id="sharedDiscographyTitle"></h2><div class="shared-discography-detail-title"></div><div class="shared-discography-detail-date"></div><p class="shared-discography-detail-description"></p><dl class="shared-discography-metadata"></dl></div>' +
        '</section>' +
        '<section class="shared-discography-detail-section"><div class="shared-discography-section-heading"><span>PHYSICAL CONFIGURATION</span><h3>Versions</h3></div><div class="shared-discography-edition-tabs"></div><dl class="shared-discography-edition-meta"></dl></section>' +
        '<section class="shared-discography-detail-section"><div class="shared-discography-section-heading"><span>EDITION DIFFERENCES</span><h3>Edition Matrix</h3></div><div class="shared-discography-matrix-scroll"><table class="shared-discography-edition-matrix"></table></div></section>' +
        '<section class="shared-discography-detail-section"><div class="shared-discography-section-heading"><span>RECORDED CONTENTS</span><h3>Contents</h3></div><div class="shared-discography-contents-grid"></div></section>' +
        '<section class="shared-discography-detail-section"><div class="shared-discography-section-heading"><span>PACKAGE / PERFORMANCE</span><h3>Bonus &amp; Chart</h3></div><div class="shared-discography-bottom-grid">' +
          '<article class="shared-discography-bonus-panel"><h4>[ INCLUDED ITEMS ]</h4><ul class="shared-discography-bonus-list"></ul></article>' +
          '<article class="shared-discography-chart-panel"><h4>[ SALES ]</h4><div class="shared-discography-chart-grid"></div><p class="shared-discography-chart-source"></p></article>' +
        '</div></section>' +
        '<section class="shared-discography-detail-section shared-discography-bonus-content-section"><div class="shared-discography-section-heading"><span>PURCHASE BONUS</span><h3>Bonus CD</h3></div><div class="shared-discography-bonus-content-list"></div></section>' +
      '</div></article>';
    document.body.appendChild(overlay);
    overlay.querySelector(".shared-discography-close").addEventListener("click", close);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
      handleClick(event);
    });
  }

  function handleClick(event) {
    const coverNav = event.target.closest("[data-discography-cover-nav]");
    if (coverNav) {
      changeCover(Number(coverNav.dataset.discographyCoverNav));
      return;
    }
    const edition = event.target.closest("[data-discography-edition]");
    if (edition) {
      activeEdition = Number(edition.dataset.discographyEdition);
      renderEdition();
      return;
    }
    const song = event.target.closest("[data-discography-song]");
    if (song) {
      openSong(Number(song.dataset.discographySong));
      return;
    }
    const live = event.target.closest("[data-discography-live]");
    if (live) openLive(Number(live.dataset.discographyLive));
  }

  function renderRelease() {
    const release = activeRelease;
    overlay.querySelector(".shared-discography-detail-type").textContent = release.type || "";
    const mainTitle = release.title_jp || release.title || "";
    overlay.querySelector("#sharedDiscographyTitle").textContent = mainTitle;
    overlay.querySelector(".shared-discography-detail-title").textContent = release.title && release.title !== mainTitle ? release.title : "";
    overlay.querySelector(".shared-discography-detail-date").textContent = release.release_date || "";
    overlay.querySelector(".shared-discography-detail-description").textContent = release.description || "";
    overlay.querySelector(".shared-discography-metadata").innerHTML = metadataHTML([
      ["LABEL", release.label || "—"],
      ["FORMAT", (release.formats || []).join(" / ") || "—"],
      ["EDITIONS", (release.editions || []).length || "—"]
    ]);
    overlay.querySelector(".shared-discography-edition-tabs").innerHTML = (release.editions || []).map(function (edition, index) {
      return '<button class="shared-discography-edition-tab" type="button" data-discography-edition="' + index + '"><img src="' + escapeHTML(edition.cover || release.cover) + '" alt="" loading="lazy"><span><small>VERSION ' + String(index + 1).padStart(2, "0") + '</small>' + escapeHTML(edition.name) + '<em>' + escapeHTML(edition.catalog_no) + '</em></span></button>';
    }).join("") || '<p class="shared-discography-empty">暂无版本资料</p>';
    renderEdition();
    renderChart();
    renderBonusContents();
  }

  function metadataHTML(rows) {
    return rows.filter(function (row) { return row[1]; }).map(function (row) {
      return '<div><dt>' + escapeHTML(row[0]) + '</dt><dd>' + escapeHTML(row[1]) + '</dd></div>';
    }).join("");
  }

  function renderEdition() {
    if (!activeRelease) return;
    const edition = (activeRelease.editions || [])[activeEdition] || {};
    const gallery = (edition.cover_gallery || []).filter(Boolean);
    const covers = gallery.length ? gallery : [edition.cover || activeRelease.cover || ""];
    activeCoverIndex = 0;
    overlay.querySelectorAll("[data-discography-edition]").forEach(function (button, index) {
      button.classList.toggle("active", index === activeEdition);
    });
    const image = overlay.querySelector(".shared-discography-cover-image");
    image.src = covers[activeCoverIndex];
    image.alt = activeRelease.title + " " + (edition.name || "");
    image.style.display = covers[activeCoverIndex] ? "block" : "none";
    overlay.querySelectorAll("[data-discography-cover-nav]").forEach(function (button) {
      button.hidden = covers.length < 2;
    });
    overlay.querySelector(".shared-discography-cover-fallback").textContent = activeRelease.title || "";
    overlay.querySelector(".shared-discography-edition-meta").innerHTML = metadataHTML([
      ["CATALOG NO.", edition.catalog_no], ["PRICE", edition.price], ["FORMAT", edition.format],
      ["DISTRIBUTION", edition.distribution], ["LIMITATION", edition.limited]
    ]);
    overlay.querySelector(".shared-discography-bonus-list").innerHTML = (edition.bonus || []).map(function (item) { return '<li>' + escapeHTML(item) + '</li>'; }).join("");
    renderContents([].concat(activeRelease.contents || [], edition.contents || []));
    renderMatrix();
  }

  function changeCover(step) {
    if (!activeRelease) return;
    const edition = (activeRelease.editions || [])[activeEdition] || {};
    const covers = (edition.cover_gallery || []).filter(Boolean);
    if (covers.length < 2) return;
    activeCoverIndex = (activeCoverIndex + step + covers.length) % covers.length;
    const image = overlay.querySelector(".shared-discography-cover-image");
    image.classList.remove("is-switching");
    void image.offsetWidth;
    image.src = covers[activeCoverIndex];
    image.classList.add("is-switching");
  }

  function renderMatrix() {
    const rows = [["MUSIC CD", "cd"], ["BLU-RAY VIDEO", "bluray"], ["SPECIAL BOX", "box"], ["EXCLUSIVE GOODS", "goods"]];
    const editions = activeRelease.editions || [];
    overlay.querySelector(".shared-discography-edition-matrix").innerHTML = '<thead><tr><th>CONTENT</th>' + editions.map(function (edition, index) {
      return '<th class="' + (index === activeEdition ? 'selected' : '') + '">' + escapeHTML(edition.name) + '</th>';
    }).join("") + '</tr></thead><tbody>' + rows.map(function (row) {
      return '<tr><td>' + row[0] + '</td>' + editions.map(function (edition, index) {
        const included = edition.features && edition.features[row[1]];
        return '<td class="' + (included ? 'yes' : 'no') + (index === activeEdition ? ' selected' : '') + '">' + (included ? '&#9679;' : '—') + '</td>';
      }).join("") + '</tr>';
    }).join("") + '</tbody>';
  }

  function renderChart() {
    const chart = activeRelease.chart || {};
    const values = [["FIRST-DAY RANK", chart.first_day_rank], ["FIRST-WEEK SALES", chart.first_week_sales], ["FIRST-WEEK RANK", chart.first_week_rank], ["TOTAL SALES", chart.total_sales]];
    overlay.querySelector(".shared-discography-chart-grid").innerHTML = values.map(function (row) {
      return '<div><b>' + escapeHTML(row[1] || "—") + '</b><span>' + row[0] + '</span></div>';
    }).join("");
    overlay.querySelector(".shared-discography-chart-source").textContent = chart.source || "暂无公开榜单数据";
  }

  function renderBonusContents() {
    const items = activeRelease && activeRelease.bonus_contents || [];
    const section = overlay.querySelector(".shared-discography-bonus-content-section");
    const container = overlay.querySelector(".shared-discography-bonus-content-list");
    if (!items.length) {
      section.hidden = true;
      container.innerHTML = "";
      return;
    }
    section.hidden = false;
    const groups = items.reduce(function (map, item) {
      const key = item.bonus_id || item.disc_name || "bonus";
      (map[key] || (map[key] = [])).push(item);
      return map;
    }, {});
    container.innerHTML = Object.keys(groups).map(function (key) {
      const group = groups[key];
      const discs = group.reduce(function (map, item) {
        const disc = item.disc_name || "BONUS CD";
        (map[disc] || (map[disc] = [])).push(item);
        return map;
      }, {});
      const trackHTML = Object.keys(discs).map(function (discName) {
        return discs[discName].map(function (row) {
          return '<div class="shared-discography-bonus-track"><strong>' + escapeHTML(discName) + '</strong><b>' + escapeHTML(row.track_no || "") + '</b><span class="shared-discography-bonus-track-name">' + escapeHTML(row.song_name || "") + '</span>' + (row.note ? '<small>' + escapeHTML(row.note) + '</small>' : '') + '</div>';
        }).join("");
      }).join("");
      return '<article class="shared-discography-bonus-content-card"><div class="shared-discography-bonus-content-body">' + trackHTML + '</div></article>';
    }).join("");
  }

  function renderContents(items) {
    const groups = items.reduce(function (map, item) {
      const key = (item.disc_no || "01") + "|" + (item.disc_type || "CONTENTS");
      (map[key] || (map[key] = [])).push(item);
      return map;
    }, {});
    const songs = currentOptions.songs || global.songsData || [];
    const lives = currentOptions.lives || global.livesData || [];
    overlay.querySelector(".shared-discography-contents-grid").innerHTML = Object.keys(groups).map(function (key) {
      const parts = key.split("|");
      return '<article class="shared-discography-disc-panel"><header>DISC ' + escapeHTML(parts[0]) + ' <span>' + escapeHTML(parts[1]) + '</span></header><ol>' + groups[key].map(function (row) {
        const songIndex = songs.findIndex(function (item) { return item.name === row.song_name || item.name_jp === row.song_name; });
        const liveIndex = !row.song_name && row.content_title && global.LiveDrawer ? global.LiveDrawer.findByTitle(row.content_title, lives) : -1;
        const title = row.song_name || row.content_title;
        let titleHTML = '<span>' + escapeHTML(title) + '</span>';
        if (songIndex >= 0) titleHTML = '<button class="shared-discography-content-link" type="button" data-discography-song="' + songIndex + '">' + escapeHTML(title) + '</button>';
        else if (liveIndex >= 0) titleHTML = '<button class="shared-discography-content-link" type="button" data-discography-live="' + liveIndex + '">' + escapeHTML(title) + '</button>';
        return '<li><b>' + escapeHTML(row.track_no || "") + '</b>' + titleHTML + (row.duration ? '<em>' + escapeHTML(row.duration) + '</em>' : '') + (row.note ? '<small>' + escapeHTML(row.note) + '</small>' : '') + '</li>';
      }).join("") + '</ol></article>';
    }).join("") || '<p class="shared-discography-empty">暂无收录内容</p>';
  }

  function openSong(index) {
    if (!global.SongModal) return;
    global.SongModal.open(index, {
      songs: currentOptions.songs || global.songsData || [],
      discography: currentOptions.discography || global.discographyData || [],
      lives: currentOptions.lives || global.livesData || []
    });
  }

  function openLive(index) {
    if (!global.LiveDrawer) return;
    global.LiveDrawer.open(index, {
      lives: currentOptions.lives || global.livesData || [],
      songs: currentOptions.songs || global.songsData || [],
      discography: currentOptions.discography || global.discographyData || [],
      updateHash: false
    });
  }

  function open(idOrRelease, options) {
    ensureMarkup();
    const settings = options || {};
    const data = dataFrom(settings);
    const release = typeof idOrRelease === "number" ? data[idOrRelease]
      : (typeof idOrRelease === "string" ? data.find(function (item) { return item.id === idOrRelease || item.hash_id === idOrRelease; }) : idOrRelease);
    if (!release) return false;
    if (typeof settings.beforeOpen === "function") settings.beforeOpen(release);
    let savedEdition = 0;
    let savedScrollTop = 0;

    function activate() {
      currentOptions = settings;
      activeRelease = release;
      activeEdition = savedEdition;
      renderRelease();
      overlay.querySelector(".shared-discography-modal").scrollTop = savedScrollTop;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
    }

    if (global.OverlayManager) {
      return global.OverlayManager.open({
        type: "discography",
        id: release.hash_id || release.id || release.title,
        hash: "#discography=" + encodeURIComponent(release.hash_id),
        manageHash: !!settings.updateHash,
        activate: activate,
        capture: function () {
          if (activeRelease !== release) return;
          savedEdition = activeEdition;
          savedScrollTop = overlay.querySelector(".shared-discography-modal").scrollTop;
        },
        deactivate: function () {
          overlay.classList.remove("open");
          overlay.setAttribute("aria-hidden", "true");
        },
        getElement: function () { return overlay; },
        onRemove: function () {
          if (activeRelease === release) {
            activeRelease = null;
            currentOptions = {};
          }
          if (typeof settings.afterClose === "function") settings.afterClose();
        }
      });
    }

    activate();
    document.body.style.overflow = "hidden";
    if (settings.updateHash) history.replaceState(null, "", "#discography=" + encodeURIComponent(release.hash_id));
    return true;
  }

  function close() {
    if (!overlay || !overlay.classList.contains("open")) return;
    if (global.OverlayManager && activeRelease) {
      global.OverlayManager.close("discography", activeRelease.hash_id || activeRelease.id || activeRelease.title);
      return;
    }
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    const options = currentOptions;
    if (options.updateHash && location.hash.startsWith("#discography=")) history.replaceState(null, "", location.pathname + location.search);
    activeRelease = null;
    currentOptions = {};
    if (typeof options.afterClose === "function") options.afterClose();
    else document.body.style.overflow = document.querySelector(".shared-song-modal-overlay.open, .shared-live-drawer-overlay.shared-live-active") ? "hidden" : "";
  }

  function normalizeTitle(value) {
    return String(value || "").replace(/[\s\u00a0]+/g, "").toLowerCase();
  }

  function findByTitle(title, data) {
    const target = normalizeTitle(title);
    if (!target) return -1;
    return (data || global.discographyData || []).findIndex(function (release) {
      return normalizeTitle(release.title) === target || normalizeTitle(release.title_jp) === target;
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !overlay || !overlay.classList.contains("open")) return;
    if (global.OverlayManager && !global.OverlayManager.isTop("discography", activeRelease && (activeRelease.hash_id || activeRelease.id || activeRelease.title))) return;
    if (!global.OverlayManager && ((global.InterviewOverlay && global.InterviewOverlay.isOpen()) || (global.LiveDrawer && global.LiveDrawer.isOpen()) || (global.SongModal && global.SongModal.isOpen()))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }, true);

  global.DiscographyModal = {
    open: open,
    close: close,
    isOpen: function () { return !!(overlay && overlay.classList.contains("open")); },
    findByTitle: findByTitle,
    openByTitle: function (title, options) {
      const settings = options || {};
      const data = dataFrom(settings);
      const index = findByTitle(title, data);
      return index >= 0 ? open(index, settings) : false;
    }
  };
})(window);
