(function () {
  "use strict";

  const trigger = document.getElementById("lyricsAtlasTrigger");
  if (!trigger || typeof songsData === "undefined") return;

  const state = { language: "jp", word: "" };
  let corpus = null;
  let overlay = null;
  let cloudObserver = null;
  let atlasIntroLocked = false;
  let introUnlockTimer = null;
  const coverageWeight = 0.35;

  function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = value || "";
    return element.innerHTML;
  }

  function buildCorpus() {
    const source = window.LYRICS_ATLAS_DATA || {};
    const result = { jp: new Map(), cn: new Map(), songs: { jp: 0, cn: 0 } };
    ["jp", "cn"].forEach(function (language) {
      const data = source[language] || {};
      result.songs[language] = data.track_count || 0;
      (data.terms || []).forEach(function (item) {
        const songs = new Map(Object.entries(item.songs || {}));
        result[language].set(item.word, {
          word: item.word,
          count: item.count,
          songs: songs,
          score: wordCloudScore(songs)
        });
      });
    });
    return result;
  }

  function wordCloudScore(songs) {
    const saturatedCount = Array.from(songs.values()).reduce(function (total, count) {
      return total + Math.log1p(Number(count) || 0);
    }, 0);
    return saturatedCount + coverageWeight * Math.log1p(songs.size);
  }

  function entriesFor(language) {
    const entries = Array.from(corpus[language].values()).sort(function (a, b) {
      return b.score - a.score || b.count - a.count || b.songs.size - a.songs.size || a.word.localeCompare(b.word);
    });
    const repeated = entries.filter(function (entry) { return entry.count >= 2; });
    return (repeated.length >= 24 ? repeated : entries).slice(0, 50);
  }

  function wordSize(entry, entries) {
    const top = entries[0] ? entries[0].score : 1;
    const bottom = entries[entries.length - 1] ? entries[entries.length - 1].score : 1;
    const range = top - bottom;
    const ratio = range ? (entry.score - bottom) / range : 0.5;
    const fontSize = 17 + ratio * 35;
    return Math.round(fontSize * (state.language === "jp" ? 1.12 : 1));
  }

  function render(options) {
    const keepCloud = options && options.keepCloud;
    const language = state.language;
    const entries = entriesFor(language);
    if (!entries.some(function (entry) { return entry.word === state.word; })) state.word = "";
    const active = entries.find(function (entry) { return entry.word === state.word; }) || null;
    const lyricCount = corpus.songs[language];
    overlay.dataset.language = language;
    const sources = active ? Array.from(active.songs.entries()).map(function (pair) {
      const song = songsData.find(function (item) { return item.hash_id === pair[0]; });
      return song ? { song: song, count: pair[1] } : null;
    }).filter(Boolean).sort(function (a, b) { return b.count - a.count; }).slice(0, 8) : [];

    overlay.querySelector(".lyrics-atlas-tabs").innerHTML =
      '<button type="button" data-language="jp" class="' + (language === "jp" ? 'active' : '') + '">日本語</button>' +
      '<button type="button" data-language="cn" class="' + (language === "cn" ? 'active' : '') + '">中文</button>';
    overlay.querySelector(".lyrics-atlas-kicker").textContent = language === "jp" ? "JAPANESE LEXICON" : "CHINESE LEXICON";
    overlay.querySelector(".lyrics-atlas-count").textContent = lyricCount + " ORIGINAL TRACKS · " + entries.length + " TERMS";
    if (!keepCloud) {
      overlay.querySelector(".lyrics-atlas-cloud").innerHTML = entries.length ? '<div class="lyrics-atlas-dom-cloud" aria-label="Lyrics word cloud"></div>' : '<p class="lyrics-atlas-empty">NO LYRIC DATA</p>';
      layoutWordCloud({ animate: true });
    } else {
      syncWordSelection();
    }
    overlay.querySelector(".lyrics-atlas-detail").innerHTML = active
      ? '<div class="lyrics-atlas-detail-word">' + escapeHTML(active.word) + '</div><div class="lyrics-atlas-detail-meta">' + active.count + ' OCCURRENCES · ' + active.songs.size + ' TRACKS</div><div class="lyrics-atlas-detail-rule"></div><div class="lyrics-atlas-detail-label">SONG INDEX</div><div class="lyrics-atlas-song-list">' + sources.map(function (item) {
          return '<button type="button" data-song="' + escapeHTML(item.song.hash_id) + '"><span>' + escapeHTML(item.song.name_jp || item.song.name) + '</span><small>×' + item.count + '</small></button>';
        }).join("") + '</div>'
      : '<div class="lyrics-atlas-detail-empty"><span>SELECT A WORD</span><p>查看词频和它出现过的原创曲目。</p></div>';
  }

  function syncWordSelection() {
    if (!overlay) return;
    overlay.querySelectorAll(".lyrics-atlas-dom-cloud [data-word]").forEach(function (word) {
      if (!word.dataset.baseColor) word.dataset.baseColor = word.style.color || "";
      const selected = word.dataset.word === state.word;
      if (word.classList.contains("active") === selected) return;
      word.classList.toggle("active", selected);
      word.style.color = selected ? "#ff6b6b" : word.dataset.baseColor;
    });
  }

  function selectWord(word) {
    if (atlasIntroLocked) return;
    state.word = word;
    syncWordSelection();
    renderSelectedWordDetail();
  }

  function renderSelectedWordDetail() {
    const active = entriesFor(state.language).find(function (entry) { return entry.word === state.word; }) || null;
    if (!active) return;
    const sources = Array.from(active.songs.entries()).map(function (pair) {
      const song = songsData.find(function (item) { return item.hash_id === pair[0]; });
      return song ? { song: song, count: pair[1] } : null;
    }).filter(Boolean).sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
    overlay.querySelector(".lyrics-atlas-detail").innerHTML =
      '<div class="lyrics-atlas-detail-word">' + escapeHTML(active.word) + '</div><div class="lyrics-atlas-detail-meta">' + active.count + ' OCCURRENCES · ' + active.songs.size + ' TRACKS</div><div class="lyrics-atlas-detail-rule"></div><div class="lyrics-atlas-detail-label">SONG INDEX</div><div class="lyrics-atlas-song-list">' + sources.map(function (item) {
        return '<button type="button" data-song="' + escapeHTML(item.song.hash_id) + '"><span>' + escapeHTML(item.song.name_jp || item.song.name) + '</span><small>×' + item.count + '</small></button>';
      }).join("") + '</div>';
  }

  function layoutWordCloud(options) {
    const cloud = overlay.querySelector(".lyrics-atlas-cloud");
    const wordHost = cloud.querySelector(".lyrics-atlas-dom-cloud");
    const entries = entriesFor(state.language);
    if (!wordHost || !entries.length || typeof window.WordCloud !== "function") return;
    const width = cloud.clientWidth;
    const height = cloud.clientHeight;
    wordHost.style.width = width + "px";
    wordHost.style.height = height + "px";

    window.WordCloud.stop();
    wordHost.innerHTML = "";
    if (cloudObserver) cloudObserver.disconnect();
    const shouldAnimate = !!(options && options.animate);
    if (introUnlockTimer) window.clearTimeout(introUnlockTimer);
    introUnlockTimer = null;
    if (!shouldAnimate) atlasIntroLocked = false;
    let introAnimationDone = !shouldAnimate;
    let cloudLayoutDone = false;
    let unlockQueued = false;
    function finishIntroWhenReady() {
      if (!shouldAnimate || !introAnimationDone || !cloudLayoutDone || unlockQueued) return;
      unlockQueued = true;
      wordHost.querySelectorAll(".lyrics-atlas-term").forEach(function (word) {
        word.classList.remove("lyrics-atlas-term");
        word.style.removeProperty("--word-intro-delay");
      });
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          atlasIntroLocked = false;
          wordHost.classList.remove("is-intro-running");
        });
      });
    }
    if (shouldAnimate) {
      atlasIntroLocked = true;
      wordHost.classList.add("is-intro-running");
      introUnlockTimer = window.setTimeout(function () {
        introAnimationDone = true;
        finishIntroWhenReady();
      }, Math.ceil(entries.length / 3) * 105 + 500);
      let revealIndex = 0;
      cloudObserver = new MutationObserver(function (records) {
        records.forEach(function (record) {
          record.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1 || node.tagName !== "SPAN") return;
            node.classList.add("lyrics-atlas-term");
            node.style.setProperty("--word-intro-delay", (Math.floor(revealIndex / 3) * 105) + "ms");
            revealIndex += 1;
          });
        });
      });
      cloudObserver.observe(wordHost, { childList: true });
    }
    wordHost.addEventListener("wordcloudstop", function () {
      cloudLayoutDone = true;
      syncWordSelection();
      finishIntroWhenReady();
    }, { once: true });
    window.WordCloud(wordHost, {
      list: entries.map(function (entry) {
        return { word: entry.word, weight: entry.score, attributes: { "data-word": entry.word, role: "button", tabindex: "0" } };
      }),
      fontFamily: state.language === "jp" ? '"Noto Serif JP", "Yu Mincho", serif' : '"Noto Serif SC", "Songti SC", serif',
      fontWeight: 500,
      color: function (word, count, fontSize, distance) {
        return distance < 0.28 ? "rgba(236, 230, 228, 0.86)" : "rgba(196, 188, 187, 0.66)";
      },
      weightFactor: function (score) { return wordSize({ score: score }, entries); },
      minSize: 12,
      gridSize: 16,
      backgroundColor: "transparent",
      clearCanvas: true,
      rotateRatio: 0,
      shuffle: false,
      shape: "square",
      ellipticity: 0.72,
      drawOutOfBound: false,
      shrinkToFit: true,
      wait: 0,
      abortThreshold: 2500
    });
  }

  function close() {
    if (!overlay) return;
    if (introUnlockTimer) window.clearTimeout(introUnlockTimer);
    introUnlockTimer = null;
    atlasIntroLocked = false;
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    trigger.focus();
  }

  function open() {
    if (!corpus) corpus = buildCorpus();
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "lyrics-atlas-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = '<article class="lyrics-atlas-panel" role="dialog" aria-modal="true" aria-labelledby="lyricsAtlasTitle">' +
        '<header class="lyrics-atlas-header"><div><div class="lyrics-atlas-file">FILE // LYRICS_ARCHIVE</div><h2 id="lyricsAtlasTitle">Lyrics Atlas</h2><p>ORIGINAL LYRICS · WORD FREQUENCY INDEX</p></div><button type="button" class="lyrics-atlas-close" aria-label="关闭">&times;</button></header>' +
        '<div class="lyrics-atlas-deck"><div class="lyrics-atlas-tabs"></div><div class="lyrics-atlas-scope">ORIGINALS ONLY</div></div>' +
        '<div class="lyrics-atlas-content"><section class="lyrics-atlas-field"><div class="lyrics-atlas-field-head"><div class="lyrics-atlas-kicker"></div><div class="lyrics-atlas-count"></div></div><div class="lyrics-atlas-cloud"></div></section><aside class="lyrics-atlas-detail"></aside></div>' +
        '</article>';
      document.body.appendChild(overlay);
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay || event.target.closest(".lyrics-atlas-close")) {
          close();
          return;
        }
        if (atlasIntroLocked) return;
        const tab = event.target.closest(".lyrics-atlas-tabs button[data-language]");
        if (tab) { state.language = tab.dataset.language; state.word = ""; render(); }
        const word = event.target.closest("[data-word]");
        if (word) selectWord(word.dataset.word);
        const songButton = event.target.closest("[data-song]");
        if (songButton) {
          const index = songsData.findIndex(function (song) { return song.hash_id === songButton.dataset.song; });
          if (index >= 0) window.openModal(index);
        }
      });
      overlay.addEventListener("keydown", function (event) {
        const word = event.target.closest("[data-word]");
        if (word && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          selectWord(word.dataset.word);
        }
      });
    }
    render();
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    overlay.querySelector(".lyrics-atlas-close").focus();
  }

  trigger.addEventListener("click", open);
  window.addEventListener("resize", function () {
    if (overlay && overlay.classList.contains("active")) layoutWordCloud({ animate: false });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay && overlay.classList.contains("active")) close();
  });
})();
