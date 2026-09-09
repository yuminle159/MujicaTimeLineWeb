(function (global) {
  "use strict";

  let overlay;
  let left;
  let right;
  let currentSong;
  let currentComments = [];
  let currentOptions = {};

  function escapeHTML(value) {
    const node = document.createElement("div");
    node.textContent = value == null ? "" : String(value);
    return node.innerHTML;
  }

  function stripTime(value) {
    return value ? String(value).replace(/\s[\d:]+$/, "").trim() : "";
  }

  function ensureMarkup() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "shared-song-modal-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<article class="shared-song-modal" role="dialog" aria-modal="true" aria-labelledby="sharedSongModalTitle">' +
      '<button class="shared-song-modal-close" type="button" aria-label="关闭">&times;</button>' +
      '<div class="shared-song-modal-left"></div>' +
      '<div class="shared-song-modal-right"></div>' +
      '</article>';
    document.body.appendChild(overlay);
    left = overlay.querySelector(".shared-song-modal-left");
    right = overlay.querySelector(".shared-song-modal-right");
    overlay.querySelector(".shared-song-modal-close").addEventListener("click", close);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    overlay.addEventListener("click", handleModalClick);
  }

  function sourceHTML(comment) {
    if (!comment.source) return "";
    if (/^(https?:\/\/|[.\/])/i.test(comment.source)) {
      return '<div class="shared-song-source"><a href="' + escapeHTML(comment.source) + '" target="_blank" rel="noopener">&#128279; 出处</a></div>';
    }
    if (global.InterviewOverlay && global.InterviewOverlay.hasTitle(comment.source)) {
      return '<div class="shared-song-source"><button type="button" data-song-interview="' + escapeHTML(comment.source) + '">&#128279; 采访出处</button></div>';
    }
    return '<div class="shared-song-source is-text">' + escapeHTML(comment.source) + '</div>';
  }

  function commentHTML(comment) {
    return (comment.date ? '<div class="shared-song-comment-date">' + escapeHTML(comment.date) + '</div>' : "") +
      escapeHTML(comment.text || "").replace(/\\n/g, "<br>") + sourceHTML(comment);
  }

  function handleModalClick(event) {
    const tab = event.target.closest("[data-song-comment]");
    if (tab) {
      const index = Number(tab.dataset.songComment);
      const comment = currentComments[index];
      const target = overlay.querySelector(".shared-song-comment-text");
      if (comment && target) target.innerHTML = commentHTML(comment);
      overlay.querySelectorAll("[data-song-comment]").forEach(function (item, itemIndex) {
        item.classList.toggle("active", itemIndex === index);
      });
      return;
    }
    const interview = event.target.closest("[data-song-interview]");
    if (interview && global.InterviewOverlay) {
      global.InterviewOverlay.openByTitle(interview.dataset.songInterview, { manageHash: false });
      return;
    }
    const discography = event.target.closest("[data-song-discography]");
    if (discography && global.DiscographyModal) {
      global.DiscographyModal.open(Number(discography.dataset.songDiscography), {
        discography: currentOptions.discography || [],
        songs: currentOptions.songs || [],
        lives: currentOptions.lives || [],
        updateHash: false
      });
    }
  }

  function renderLeft(song) {
    const cnTitle = song.name ? '<div class="shared-song-title-cn">' + escapeHTML(song.name) + '</div>' : "";
    const discographyData = currentOptions.discography || [];
    const appearances = song.appearances && song.appearances.length
      ? '<div class="shared-song-appearances"><span class="shared-song-meta-label">收录CD</span>' + song.appearances.map(function (item) {
        const discographyIndex = global.DiscographyModal ? global.DiscographyModal.findByTitle(item, discographyData) : -1;
        const content = '<i aria-hidden="true"></i>' + escapeHTML(item);
        return discographyIndex >= 0
          ? '<button class="shared-song-cd is-link" type="button" data-song-discography="' + discographyIndex + '">' + content + '</button>'
          : '<span class="shared-song-cd">' + content + '</span>';
      }).join("") + '</div>'
      : "";
    left.innerHTML = (song.cover ? '<img class="shared-song-cover" src="' + escapeHTML(song.cover) + '" alt="' + escapeHTML(song.name_jp || song.name) + '">' : "") +
      '<div class="shared-song-title" id="sharedSongModalTitle">' + escapeHTML(song.name_jp || song.name) + '</div>' + cnTitle +
      (song.type ? '<span class="shared-song-type">' + escapeHTML(song.type) + '</span>' : "") +
      '<div class="shared-song-meta">' +
      (song.release_date ? '<div><span class="shared-song-meta-label">发行日期</span><span>' + escapeHTML(song.release_date) + '</span></div>' : "") +
      (song.album ? '<div><span class="shared-song-meta-label">首发形式</span><span>' + escapeHTML(song.album) + '</span></div>' : "") +
      (song.lyricist ? '<div><span class="shared-song-meta-label">作词</span><span>' + escapeHTML(song.lyricist) + '</span></div>' : "") +
      (song.composer ? '<div><span class="shared-song-meta-label">作曲</span><span>' + escapeHTML(song.composer) + '</span></div>' : "") +
      (song.arranger ? '<div><span class="shared-song-meta-label">编曲</span><span>' + escapeHTML(song.arranger) + '</span></div>' : "") +
      (song.first_stage ? '<div><span class="shared-song-meta-label">首次登台</span><span>' + escapeHTML(song.first_stage) + '</span></div>' : "") +
      (song.mv_url ? '<div><span class="shared-song-meta-label">MV链接</span><a href="' + escapeHTML(song.mv_url) + '" target="_blank" rel="noopener">观看 MV &#8599;</a></div>' : "") +
      appearances + '</div>';
  }

  function renderComments(song) {
    currentComments = song.comments || [];
    if (!currentComments.length) return "";
    const tabs = currentComments.map(function (comment, index) {
      return '<button type="button" class="shared-song-comment-tab' + (index === 0 ? ' active' : '') + '" data-song-comment="' + index + '">' + escapeHTML(comment.from || ('Comment ' + (index + 1))) + '</button>';
    }).join("");
    return '<section class="shared-song-section"><div class="shared-song-section-head shared-song-comment-head"><h3>Comment</h3><div class="shared-song-comment-tabs">' + tabs + '</div></div>' +
      '<div class="shared-song-comment-body"><div class="shared-song-comment-text">' + commentHTML(currentComments[0]) + '</div></div></section>';
  }

  function renderLyrics(song) {
    if (!song.lyrics_jp && !song.lyrics_cn) return "";
    const jp = (song.lyrics_jp || "").split("\\n");
    const cn = (song.lyrics_cn || "").split("\\n");
    const rows = [];
    for (let index = 0; index < Math.max(jp.length, cn.length); index += 1) {
      const empty = !(jp[index] || "").trim() && !(cn[index] || "").trim();
      rows.push('<div class="shared-song-lyrics-row' + (empty ? ' is-empty' : '') + '"><span>' + escapeHTML(jp[index] || "") + '</span><span>' + escapeHTML(cn[index] || "") + '</span></div>');
    }
    return '<section class="shared-song-section shared-song-lyrics"><div class="shared-song-section-head"><h3>Lyrics</h3><div class="shared-song-lyrics-actions"><button type="button" data-song-action="lyrics-mode">Lyrics Mode</button><button type="button" data-song-action="copy">&#128203; 复制</button></div></div><div class="shared-song-lyrics-columns">' + rows.join("") + '</div></section>';
  }

  function renderHistory(song) {
    if (!song.live_history || !song.live_history.length) return "";
    const history = song.live_history.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    const stats = stripTime(history[0].date) + ' ~ ' + stripTime(history[history.length - 1].date) + '，共演奏 ' + history.length + ' 次';
    return '<section class="shared-song-section"><div class="shared-song-section-head"><h3>Performance History</h3><small>' + escapeHTML(stats) + '</small></div><div class="shared-song-live-list">' + history.map(function (item) {
      const name = item.has_video && item.video_url
        ? '<a class="shared-song-live-name" href="' + escapeHTML(item.video_url) + '" target="_blank" rel="noopener">' + escapeHTML(item.name) + '</a>'
        : '<span class="shared-song-live-name">' + escapeHTML(item.name) + '</span>';
      return '<div class="shared-song-live-node' + (item.has_video ? ' has-video' : '') + '"><time>' + escapeHTML(stripTime(item.date)) + '</time>' + name + (item.venue ? '<small>' + escapeHTML(item.venue) + '</small>' : '') + '</div>';
    }).join("") + '</div></section>';
  }

  function wireActions() {
    const lyrics = overlay.querySelector(".shared-song-lyrics");
    const mode = overlay.querySelector('[data-song-action="lyrics-mode"]');
    const copy = overlay.querySelector('[data-song-action="copy"]');
    if (mode && lyrics) {
      mode.addEventListener("click", function () {
        lyrics.classList.toggle("clean-mode");
        mode.textContent = lyrics.classList.contains("clean-mode") ? "退出 Lyrics Mode" : "Lyrics Mode";
      });
    }
    if (copy) {
      copy.addEventListener("click", function () {
        const text = '《' + (currentSong.name_jp || currentSong.name) + '》\n\n[JP]\n' + (currentSong.lyrics_jp || "").replace(/\\n/g, "\n") + '\n\n[CN]\n' + (currentSong.lyrics_cn || "").replace(/\\n/g, "\n");
        const done = function () { copy.textContent = "已复制"; setTimeout(function () { copy.textContent = "📋 复制"; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
        else { fallbackCopy(text); done(); }
      });
    }
  }

  function fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  function open(indexOrSong, options) {
    ensureMarkup();
    const settings = options || {};
    const data = settings.songs || window.songsData || [];
    const song = typeof indexOrSong === "number" ? data[indexOrSong] : indexOrSong;
    if (!song) return false;
    if (typeof settings.beforeOpen === "function") settings.beforeOpen(song);
    let savedScrollTop = 0;

    function activate() {
      currentOptions = settings;
      currentSong = song;
      renderLeft(song);
      right.innerHTML = renderComments(song) + renderLyrics(song) + renderHistory(song) || '<div class="shared-song-empty">暂无更多信息</div>';
      wireActions();
      right.scrollTop = savedScrollTop;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
    }

    if (global.OverlayManager) {
      return global.OverlayManager.open({
        type: "song",
        id: song.hash_id || song.name_jp || song.name,
        hash: "#song=" + encodeURIComponent(song.hash_id),
        manageHash: !!settings.updateHash,
        activate: activate,
        capture: function () {
          if (currentSong === song) savedScrollTop = right.scrollTop;
        },
        deactivate: function () {
          overlay.classList.remove("open");
          overlay.setAttribute("aria-hidden", "true");
        },
        getElement: function () { return overlay; },
        onRemove: function () {
          if (currentSong === song) {
            currentSong = null;
            currentComments = [];
            currentOptions = {};
          }
          if (typeof settings.afterClose === "function") settings.afterClose();
        }
      });
    }

    activate();
    document.body.style.overflow = "hidden";
    if (settings.updateHash) history.replaceState(null, "", "#song=" + encodeURIComponent(song.hash_id));
    return true;
  }

  function close() {
    if (!overlay || !overlay.classList.contains("open")) return;
    if (global.OverlayManager && currentSong) {
      global.OverlayManager.close("song", currentSong.hash_id || currentSong.name_jp || currentSong.name);
      return;
    }
    const options = currentOptions;
    const lyrics = overlay.querySelector(".shared-song-lyrics.clean-mode");
    if (lyrics) lyrics.classList.remove("clean-mode");
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    if (options.updateHash && location.hash.startsWith("#song=")) history.replaceState(null, "", location.pathname + location.search);
    currentSong = null;
    currentComments = [];
    currentOptions = {};
    if (typeof options.afterClose === "function") options.afterClose();
    else document.body.style.overflow = document.querySelector(".shared-live-drawer-overlay.shared-live-active, .shared-discography-modal-overlay.open") ? "hidden" : "";
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay && overlay.classList.contains("open")) {
      if (global.OverlayManager && !global.OverlayManager.isTop("song", currentSong && (currentSong.hash_id || currentSong.name_jp || currentSong.name))) return;
      if (!global.OverlayManager && ((global.InterviewOverlay && global.InterviewOverlay.isOpen()) || (global.LiveDrawer && global.LiveDrawer.isAuxiliaryOpen()))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }, true);

  global.SongModal = { open: open, close: close, isOpen: function () { return !!(overlay && overlay.classList.contains("open")); } };
})(window);
