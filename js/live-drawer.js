(function (global) {
  "use strict";

  let overlay;
  let drawerBody;
  let mcModal;
  let mcBody;
  let lightbox;
  let lightboxImage;
  let lightboxHud;
  let currentLive = null;
  let currentOptions = {};
  let renderedLive = null;
  let mcContent = "";
  let photoGroups = [];
  let lightboxGroup = null;
  let lightboxIndex = 0;
  let lightboxCredits = [];
  let lightboxCreditTexts = [];
  let lightboxSourceUrls = [];
  let lightboxSourceLabels = [];
  let bubbleEl;
  let bubbleTimer;
  let currentLayer = 10000;

  function escapeHTML(value) {
    const node = document.createElement("div");
    node.textContent = value == null ? "" : String(value);
    return node.innerHTML;
  }

  function stripTime(value) {
    return value ? String(value).replace(/\s[\d:]+$/, "").trim() : "";
  }

  function restoreBodyScroll() {
    const anotherLayer = document.querySelector(
      ".shared-song-modal-overlay.open, .shared-interview-overlay.active, .shared-discography-modal-overlay.open, .shared-live-drawer-overlay.shared-live-active"
    );
    document.body.style.overflow = anotherLayer ? "hidden" : "";
  }

  function ensureMarkup() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "shared-live-drawer-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<aside class="shared-live-drawer" role="dialog" aria-modal="true" aria-labelledby="sharedLiveDrawerTitle">' +
      '<button class="shared-live-close-btn" type="button" aria-label="关闭">&times;</button>' +
      '<div class="shared-live-drawer-body"></div>' +
      '</aside>';

    mcModal = document.createElement("div");
    mcModal.className = "shared-live-mc-modal";
    mcModal.setAttribute("aria-hidden", "true");
    mcModal.innerHTML = '<div class="shared-live-mc-modal-container" role="dialog" aria-modal="true">' +
      '<button class="shared-live-mc-modal-close" type="button" aria-label="关闭">&times;</button>' +
      '<div class="shared-live-mc-modal-body"></div>' +
      '</div>';

    lightbox = document.createElement("div");
    lightbox.className = "shared-live-kv-lightbox";
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.innerHTML = '<button class="shared-live-kv-lightbox-close" type="button" aria-label="关闭">&times;</button>' +
      '<button class="shared-live-kv-lightbox-arrow shared-live-kv-lightbox-prev" type="button" data-live-lightbox-move="-1">&#10094;</button>' +
      '<img class="shared-live-kv-lightbox-img" src="" alt="">' +
      '<div class="shared-live-kv-lightbox-hud">' +
        '<div class="shared-live-hud-info-block"><div class="shared-live-hud-title"></div><div class="shared-live-hud-desc"></div></div>' +
        '<div class="shared-live-hud-right"><a class="shared-live-hud-source-btn" href="#" target="_blank" rel="noopener">&#8599; SOURCE</a>' +
          '<div class="shared-live-hud-counter"><span class="shared-live-counter-label">FILE_</span><span class="shared-live-counter-num"></span></div>' +
        '</div>' +
      '</div>' +
      '<button class="shared-live-kv-lightbox-arrow shared-live-kv-lightbox-next" type="button" data-live-lightbox-move="1">&#10095;</button>';

    document.body.appendChild(overlay);
    document.body.appendChild(mcModal);
    document.body.appendChild(lightbox);
    drawerBody = overlay.querySelector(".shared-live-drawer-body");
    mcBody = mcModal.querySelector(".shared-live-mc-modal-body");
    lightboxImage = lightbox.querySelector(".shared-live-kv-lightbox-img");
    lightboxHud = lightbox.querySelector(".shared-live-kv-lightbox-hud");

    overlay.querySelector(".shared-live-close-btn").addEventListener("click", close);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
      handleDrawerClick(event);
    });
    mcModal.addEventListener("click", function (event) {
      if (event.target === mcModal || event.target.closest(".shared-live-mc-modal-close")) closeMc();
    });
    lightbox.addEventListener("click", function (event) {
      const move = event.target.closest("[data-live-lightbox-move]");
      if (move) {
        event.stopPropagation();
        moveLightbox(Number(move.dataset.liveLightboxMove));
        return;
      }
      if (event.target.closest(".shared-live-kv-lightbox-close") || event.target === lightbox) {
        closeLightbox();
        return;
      }
      if (event.target === lightboxImage && lightboxGroup) lightboxHud.classList.toggle("shared-live-hidden");
    });

    document.addEventListener("mouseover", showHighlightBubble);
    document.addEventListener("mouseout", hideHighlightBubble);
  }

  function buildSongLookup(songs) {
    const lookup = {};
    (songs || []).forEach(function (song, index) {
      if (song.name_jp) lookup[song.name_jp] = index;
      if (song.name) lookup[song.name] = index;
    });
    return lookup;
  }

  function groupBackstage(backstage) {
    const groups = [];
    let currentGroup = null;
    (backstage || []).forEach(function (photo) {
      const groupId = photo.group_id || "";
      if (!groupId) {
        groups.push({ photos: [photo], credit: photo.credit, credit_text: photo.credit_text, source_url: photo.source_url, source_label: photo.source_label });
      } else if (currentGroup && currentGroup.id === groupId) {
        currentGroup.photos.push(photo);
      } else {
        currentGroup = { id: groupId, photos: [photo], credit: photo.credit, credit_text: photo.credit_text, source_url: photo.source_url, source_label: photo.source_label };
        groups.push(currentGroup);
      }
    });
    return groups;
  }

  function setlistHTML(live, liveIndex) {
    if (!live.setlist || !live.setlist.length) return "";
    const songLookup = buildSongLookup(currentOptions.songs || global.songsData || []);
    return '<div class="shared-live-col-setlist"><h3 class="shared-live-section-title">Setlist</h3><ul class="shared-live-setlist-list">' +
      live.setlist.map(function (track, trackIndex) {
        const songIndex = track.title !== "Interlude" ? songLookup[track.title] : undefined;
        const hasMc = !!track.mc_content;
        const clickable = songIndex !== undefined || hasMc;
        const labelClass = track.highlight_label ? " shared-live-highlight-" + track.highlight_label.toLowerCase().replace(/\s+/g, "-") : "";
        const linkUrl = track.link && track.link !== "0" && /^https?:\/\//i.test(track.link) ? track.link : "";
        const action = songIndex !== undefined
          ? ' data-live-song-index="' + songIndex + '"'
          : (hasMc ? ' data-live-mc-index="' + trackIndex + '"' : "");
        const eyeIcon = linkUrl ? '<a class="shared-live-track-source" href="' + escapeHTML(linkUrl) + '" target="_blank" rel="noopener" title="查看来源" aria-label="查看来源"><svg class="shared-live-track-link-eye" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path class="shared-live-eye-almond" d="M16,24 Q24,17 32,24 Q24,31 16,24"/><circle class="shared-live-eye-pupil" cx="24" cy="24" r="3"/></svg></a>' : "";
        return '<li class="shared-live-setlist-item' + (clickable ? ' shared-live-setlist-clickable' : '') + '"><div class="shared-live-track-info">' +
          '<span class="shared-live-track-num">' + (track.num || "&nbsp;&nbsp;") + '</span>' +
          '<span class="shared-live-track-title"' + action + '>' + escapeHTML(track.title) + (clickable ? ' <span class="shared-live-track-link-icon">&#8599;</span>' : '') + '</span>' +
          eyeIcon +
          '<span class="shared-live-track-highlight' + labelClass + '"' + (track.highlight_text ? ' data-tooltip="' + escapeHTML(track.highlight_text).replace(/"/g, "&quot;").replace(/\\n/g, "&#10;") + '"' : '') + '>' +
            (track.highlight_label ? '<span class="shared-live-highlight-badge">' + escapeHTML(track.highlight_label) + '</span>' : '') +
            (track.highlight_text ? '<span class="shared-live-highlight-desc">' + escapeHTML(track.highlight_text).replace(/\\n/g, "<br>") + '</span>' : '') +
          '</span></div></li>';
      }).join("") + '</ul></div>';
  }

  function backstageHTML(live) {
    photoGroups = groupBackstage(live.backstage);
    if (!photoGroups.length) return "";
    return '<div class="shared-live-col-gallery"><h3 class="shared-live-section-title">Backstage</h3><div class="shared-live-photo-grid">' +
      photoGroups.map(function (group, groupIndex) {
        const firstPhoto = group.photos[0];
        const multiBadge = group.photos.length > 1 ? '<span class="shared-live-multi-badge">+' + (group.photos.length - 1) + '</span>' : "";
        return '<div class="shared-live-photo-card"><button type="button" data-live-photo-group="' + groupIndex + '"><img src="' + escapeHTML(firstPhoto.photo) + '" alt="' + escapeHTML(group.credit || "") + '"></button>' +
          (group.credit ? '<span class="shared-live-credit-tag">' + escapeHTML(group.credit) + '</span>' : '') + multiBadge + '</div>';
      }).join("") + '</div></div>';
  }

  function render(live, liveIndex) {
    const setlist = setlistHTML(live, liveIndex);
    const backstage = backstageHTML(live);
    drawerBody.innerHTML = '<div class="shared-live-drawer-hero">' +
      (live.kv ? '<button class="shared-live-hero-poster-button" type="button" data-live-hero-image><img class="shared-live-hero-poster" src="' + escapeHTML(live.kv) + '" alt="' + escapeHTML(live.name) + '"></button>' : (live.poster ? '<img class="shared-live-hero-poster" src="' + escapeHTML(live.poster) + '" alt="' + escapeHTML(live.name) + '">' : '')) +
      '<div class="shared-live-hero-info"><div class="shared-live-hero-date">' + stripTime(escapeHTML(live.date)) + '</div>' +
        '<h1 class="shared-live-hero-title" id="sharedLiveDrawerTitle">' + escapeHTML(live.name) + '</h1>' +
        '<div class="shared-live-hero-meta-row">' + (live.tag ? '&#127925; <span class="shared-live-hero-tag">' + escapeHTML(live.tag) + '</span>' : '') + (live.venue ? ' &#128205; ' + escapeHTML(live.venue) : '') + '</div>' +
        '<div class="shared-live-hero-action-row">' +
          (live.video_url ? '<a href="' + escapeHTML(live.video_url) + '" class="shared-live-btn-play" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>WATCH ARCHIVE</a>' : '<span class="shared-live-btn-unrecorded"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>UNRECORDED</span>') +
          (live.description ? '<span class="shared-live-hero-desc">' + escapeHTML(live.description) + '</span>' : '') +
        '</div></div></div>' +
      '<div class="shared-live-drawer-content">' + setlist + backstage + '</div>';
    renderedLive = live;
  }

  function handleDrawerClick(event) {
    const song = event.target.closest("[data-live-song-index]");
    if (song) {
      openSong(Number(song.dataset.liveSongIndex));
      return;
    }
    const mc = event.target.closest("[data-live-mc-index]");
    if (mc) {
      const track = currentLive && currentLive.setlist && currentLive.setlist[Number(mc.dataset.liveMcIndex)];
      if (track) openMc(track.mc_content);
      return;
    }
    const photo = event.target.closest("[data-live-photo-group]");
    if (photo) {
      openPhotoGroup(Number(photo.dataset.livePhotoGroup));
      return;
    }
    if (event.target.closest("[data-live-hero-image]") && currentLive) openLightbox(currentLive.kv);
  }

  function openSong(index) {
    if (!global.SongModal) return;
    global.SongModal.open(index, {
      songs: currentOptions.songs || global.songsData || [],
      discography: currentOptions.discography || global.discographyData || [],
      lives: currentOptions.lives || global.livesData || []
    });
  }

  function openMc(content) {
    if (!content) return;
    mcContent = content;
    mcBody.innerHTML = typeof global.renderMarkdown === "function" ? global.renderMarkdown(mcContent, { mode: "mc" }) : escapeHTML(mcContent).replace(/\n/g, "<br>");
    mcModal.classList.add("shared-live-active");
    mcModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMc() {
    if (!mcModal || !mcModal.classList.contains("shared-live-active")) return;
    mcModal.classList.remove("shared-live-active");
    mcModal.setAttribute("aria-hidden", "true");
    mcContent = "";
    restoreBodyScroll();
  }

  function openPhotoGroup(groupIndex) {
    const group = photoGroups[groupIndex];
    if (!group) return;
    openLightbox(
      group.photos[0].photo,
      group.photos.map(function (photo) { return photo.photo; }),
      0,
      group.photos.map(function (photo) { return photo.credit || group.credit || ""; }),
      group.photos.map(function (photo) { return photo.credit_text || ""; }),
      group.photos.map(function (photo) { return photo.source_url || group.source_url || ""; }),
      group.photos.map(function (photo) { return photo.source_label || group.source_label || ""; })
    );
  }

  function openLightbox(src, group, index, credits, creditTexts, sourceUrls, sourceLabels) {
    lightboxGroup = group && group.length ? group : null;
    lightboxIndex = index === undefined ? 0 : index;
    lightboxCredits = credits || [];
    lightboxCreditTexts = creditTexts || [];
    lightboxSourceUrls = sourceUrls || [];
    lightboxSourceLabels = sourceLabels || [];
    lightboxImage.src = lightboxGroup ? lightboxGroup[lightboxIndex] : src;
    lightboxImage.style.opacity = "0";
    lightboxImage.onload = function () { lightboxImage.style.opacity = "1"; };
    lightbox.querySelectorAll(".shared-live-kv-lightbox-arrow").forEach(function (arrow) { arrow.style.display = lightboxGroup ? "flex" : "none"; });
    lightbox.querySelector(".shared-live-hud-counter").style.display = lightboxGroup ? "flex" : "none";
    lightboxHud.classList.toggle("shared-live-hidden", !lightboxGroup);
    if (lightboxGroup) updateLightboxHud();
    else lightbox.querySelector(".shared-live-hud-source-btn").style.display = "none";
    lightbox.classList.add("shared-live-active");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function updateLightboxHud() {
    lightbox.querySelector(".shared-live-hud-title").textContent = lightboxCredits[lightboxIndex] || "";
    lightbox.querySelector(".shared-live-hud-desc").textContent = lightboxCreditTexts[lightboxIndex] || "";
    lightbox.querySelector(".shared-live-counter-num").textContent = "[ " + (lightboxIndex + 1) + " / " + lightboxGroup.length + " ]";
    const source = lightbox.querySelector(".shared-live-hud-source-btn");
    const label = (lightboxSourceLabels[lightboxIndex] || "").trim().toLowerCase();
    if (label === "yes" && lightboxSourceUrls[lightboxIndex]) {
      source.href = lightboxSourceUrls[lightboxIndex];
      source.style.display = "flex";
    } else source.style.display = "none";
  }

  function moveLightbox(direction) {
    if (!lightboxGroup) return;
    lightboxIndex = ((lightboxIndex + direction) % lightboxGroup.length + lightboxGroup.length) % lightboxGroup.length;
    lightboxImage.style.opacity = "0";
    lightboxImage.src = "";
    requestAnimationFrame(function () {
      lightboxImage.src = lightboxGroup[lightboxIndex];
      lightboxImage.onload = function () { lightboxImage.style.opacity = "1"; };
    });
    updateLightboxHud();
  }

  function closeLightbox() {
    if (!lightbox || !lightbox.classList.contains("shared-live-active")) return;
    lightbox.classList.remove("shared-live-active");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxGroup = null;
    lightboxIndex = 0;
    restoreBodyScroll();
  }

  function showHighlightBubble(event) {
    if (!overlay || !overlay.classList.contains("shared-live-active")) return;
    const trackInfo = event.target.closest(".shared-live-track-info");
    if (!trackInfo) return;
    const highlight = trackInfo.querySelector(".shared-live-track-highlight[data-tooltip]");
    if (!highlight) return;
    clearTimeout(bubbleTimer);
    if (!bubbleEl) {
      bubbleEl = document.createElement("div");
      bubbleEl.className = "shared-live-highlight-bubble";
      bubbleEl.style.zIndex = String(currentLayer + 50);
      document.body.appendChild(bubbleEl);
    }
    bubbleEl.textContent = highlight.getAttribute("data-tooltip") || "";
    bubbleEl.classList.add("shared-live-show");
    const rect = highlight.getBoundingClientRect();
    bubbleEl.style.left = rect.left + "px";
    bubbleEl.style.top = (rect.top - 8) + "px";
    bubbleEl.style.transform = "translateY(-100%)";
  }

  function hideHighlightBubble(event) {
    const trackInfo = event.target.closest(".shared-live-track-info");
    if (trackInfo && event.relatedTarget && trackInfo.contains(event.relatedTarget)) return;
    if (!bubbleEl) return;
    bubbleTimer = setTimeout(function () {
      if (!document.querySelector(".shared-live-track-info:hover .shared-live-track-highlight[data-tooltip]")) bubbleEl.classList.remove("shared-live-show");
    }, 200);
  }

  function open(indexOrLive, options) {
    ensureMarkup();
    const settings = options || {};
    const lives = settings.lives || global.livesData || [];
    const liveIndex = typeof indexOrLive === "number" ? indexOrLive : lives.indexOf(indexOrLive);
    const live = typeof indexOrLive === "number" ? lives[indexOrLive] : indexOrLive;
    if (!live) return false;
    if (typeof settings.beforeOpen === "function") settings.beforeOpen(live);
    let savedScrollTop = 0;
    let photosPreloaded = false;

    function activate() {
      currentOptions = settings;
      currentLive = live;
      if (renderedLive !== live) render(live, liveIndex);
      drawerBody.scrollTop = savedScrollTop;
      overlay.classList.add("shared-live-active");
      overlay.setAttribute("aria-hidden", "false");
      if (!photosPreloaded) {
        photoGroups.forEach(function (group) {
          group.photos.forEach(function (photo) { const image = new Image(); image.src = photo.photo; });
        });
        photosPreloaded = true;
      }
    }

    if (global.OverlayManager) {
      return global.OverlayManager.open({
        type: "live",
        id: live.hash_id || live.name,
        hash: "#live=" + encodeURIComponent(live.hash_id),
        manageHash: !!settings.updateHash,
        activate: activate,
        capture: function () {
          if (currentLive === live) savedScrollTop = drawerBody.scrollTop;
        },
        deactivate: function () {
          closeMc();
          closeLightbox();
          overlay.classList.remove("shared-live-active");
          overlay.setAttribute("aria-hidden", "true");
          if (bubbleEl) bubbleEl.classList.remove("shared-live-show");
        },
        getElement: function () { return overlay; },
        setLayer: function (layer) {
          currentLayer = layer;
          overlay.style.zIndex = String(layer);
          mcModal.style.zIndex = String(layer + 100);
          lightbox.style.zIndex = String(layer + 200);
          if (bubbleEl) bubbleEl.style.zIndex = String(layer + 50);
        },
        setInteractive: function (interactive) {
          if (interactive) return;
          closeMc();
          closeLightbox();
          if (bubbleEl) bubbleEl.classList.remove("shared-live-show");
        },
        onRemove: function () {
          if (currentLive === live) {
            currentLive = null;
            currentOptions = {};
          }
          if (typeof settings.afterClose === "function") settings.afterClose();
        }
      });
    }

    activate();
    document.body.style.overflow = "hidden";
    if (settings.updateHash) history.replaceState(null, "", "#live=" + encodeURIComponent(live.hash_id));
    return true;
  }

  function close() {
    if (!overlay || !overlay.classList.contains("shared-live-active")) return;
    if (global.OverlayManager && currentLive) {
      global.OverlayManager.close("live", currentLive.hash_id || currentLive.name);
      return;
    }
    closeMc();
    closeLightbox();
    overlay.classList.remove("shared-live-active");
    overlay.setAttribute("aria-hidden", "true");
    if (bubbleEl) bubbleEl.classList.remove("shared-live-show");
    const options = currentOptions;
    if (options.updateHash && location.hash.startsWith("#live=")) history.replaceState(null, "", location.pathname + location.search);
    currentLive = null;
    currentOptions = {};
    if (typeof options.afterClose === "function") options.afterClose();
    else restoreBodyScroll();
  }

  function normalizedTitle(value) {
    return String(value || "").replace(/[\s\u00a0]+/g, "").replace(/[「」『』]/g, function (mark) { return mark; }).toLowerCase();
  }

  function findByTitle(title, lives) {
    const target = normalizedTitle(title);
    const data = lives || global.livesData || [];
    if (!target) return -1;
    let index = data.findIndex(function (live) { return normalizedTitle(live.name) === target; });
    if (index >= 0) return index;
    index = data.findIndex(function (live) { return normalizedTitle(live.name).startsWith(target); });
    return index;
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !overlay) {
      if (lightbox && lightbox.classList.contains("shared-live-active")) {
        if (event.key === "ArrowLeft") moveLightbox(-1);
        if (event.key === "ArrowRight") moveLightbox(1);
      }
      return;
    }
    if (global.OverlayManager && !global.OverlayManager.isTop("live", currentLive && (currentLive.hash_id || currentLive.name))) return;
    if (!global.OverlayManager && global.InterviewOverlay && global.InterviewOverlay.isOpen()) return;
    if (mcModal.classList.contains("shared-live-active")) { event.preventDefault(); event.stopImmediatePropagation(); closeMc(); return; }
    if (!global.OverlayManager && global.SongModal && global.SongModal.isOpen()) return;
    if (lightbox.classList.contains("shared-live-active")) { event.preventDefault(); event.stopImmediatePropagation(); closeLightbox(); return; }
    if (overlay.classList.contains("shared-live-active")) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  }, true);

  global.LiveDrawer = {
    open: open,
    close: close,
    isOpen: function () { return !!(overlay && overlay.classList.contains("shared-live-active")); },
    isAuxiliaryOpen: function () { return !!((mcModal && mcModal.classList.contains("shared-live-active")) || (lightbox && lightbox.classList.contains("shared-live-active"))); },
    findByTitle: findByTitle,
    openByTitle: function (title, options) {
      const settings = options || {};
      const lives = settings.lives || global.livesData || [];
      const index = findByTitle(title, lives);
      return index >= 0 ? open(index, settings) : false;
    }
  };
})(window);
