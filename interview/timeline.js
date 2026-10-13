(function () {
  "use strict";
  const trigger = document.getElementById("interviewTimelineTrigger");
  if (!trigger) return;
  const model = window.InterviewTimelineModel;
  let overlay, scroll, content, years, main, lastFocus;
  let events = null;
  let loading = false;
  let query = "";
  let translatedOnly = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function today() {
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  }

  function close() { OverlayManager.close("interview-timeline", "main"); }

  function create() {
    overlay = element("section", "it-overlay");
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "interviewTimelineTitle");
    overlay.innerHTML = '<header class="it-header"><div><div class="it-file">FILE // INTERVIEW_TIMELINE</div><h2 id="interviewTimelineTitle">Interview Timeline</h2><div class="it-subtitle">VOICES, PERFORMANCES &amp; MILESTONES</div></div><button class="it-close" type="button" aria-label="关闭访谈时间轴">&times;</button></header>' +
      '<div class="it-controls"><nav class="it-years" aria-label="跳转年份"></nav><label class="it-search"><input type="search" placeholder="搜索访谈或受访者…" aria-label="搜索时间轴中的访谈" autocomplete="off"></label><label class="it-filter"><input type="checkbox">仅已翻译</label></div>' +
      '<div class="it-scroll" tabindex="0" aria-label="访谈与重要事件时间轴"><div class="it-content"></div></div>';
    document.body.appendChild(overlay);
    main = document.querySelector(".interview-page");
    scroll = overlay.querySelector(".it-scroll");
    content = overlay.querySelector(".it-content");
    years = overlay.querySelector(".it-years");
    overlay.querySelector(".it-close").addEventListener("click", close);
    overlay.querySelector(".it-search input").addEventListener("input", function () { query = this.value; render(); });
    overlay.querySelector(".it-filter input").addEventListener("change", function () { translatedOnly = this.checked; render(); });
    scroll.addEventListener("scroll", updateYear, { passive: true });
    overlay.addEventListener("keydown", function (event) {
      if (!OverlayManager.isTop("interview-timeline", "main") || event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === "Tab") {
        const nodes = Array.from(overlay.querySelectorAll('button, input, [tabindex="0"]')).filter(function (node) { return !node.disabled && node.getClientRects().length; });
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.addEventListener("interviewreadingchange", function () {
      content.querySelectorAll(".it-card").forEach(function (card) { updateReading(card, Number(card.dataset.index)); });
    });
  }

  function updateReading(card, index) {
    const state = InterviewOverlay.getReadingState(interviewData[index], index);
    const label = card.querySelector(".it-card-state");
    label.textContent = state && state.scrollTop > 20 ? (state.progress >= .98 ? "上次读至末尾" : "继续阅读" + (Number.isFinite(state.progress) ? " · " + Math.max(1, Math.round(state.progress * 100)) + "%" : "")) : "";
    label.hidden = !label.textContent;
  }

  function interviewCard(record) {
    const item = record.item;
    const card = element("button", "it-card");
    card.type = "button";
    card.dataset.index = String(record.index);
    const cover = element("span", "it-cover");
    if (item.poster) {
      const image = element("img");
      image.alt = "";
      image.loading = "lazy";
      let retried = false;
      image.addEventListener("error", function () {
        if (retried) { image.remove(); return; }
        retried = true;
        const url = new URL(item.poster, document.baseURI);
        url.searchParams.set("retry", String(Date.now()));
        image.src = url.href;
      });
      image.src = item.poster;
      cover.appendChild(image);
    }
    const copy = element("span", "it-card-copy");
    copy.appendChild(element("span", "it-card-title", item.title));
    copy.appendChild(element("span", "it-card-meta", [item.interviewee, String(item.if_translated).toLowerCase() === "yes" ? "已翻译" : "未翻译"].filter(Boolean).join(" · ")));
    copy.appendChild(element("span", "it-card-state"));
    card.append(cover, copy);
    updateReading(card, record.index);
    card.addEventListener("click", function () {
      lastFocus = card;
      InterviewOverlay.open(record.index, { manageHash: false });
    });
    return card;
  }

  function eventCard(item) {
    const future = item.date > today();
    const card = element("article", "it-event" + (item.key ? " is-key" : "") + (future ? " is-future" : ""));
    card.dataset.kind = item.kind.toLowerCase();
    const range = item.endDate !== item.date ? " · " + item.date.slice(5).replace("-", "/") + "–" + item.endDate.slice(5).replace("-", "/") : "";
    const meta = element("small", "it-event-meta");
    meta.appendChild(element("span", "it-kind", item.kind));
    if (range || future) meta.appendChild(element("span", "", range.replace(/^ · /, "") + (future ? (range ? " · " : "") + "预定" : "")));
    card.append(meta, element("h4", "", item.title));
    return card;
  }

  function updateYear() {
    if (!content) return;
    const headings = Array.from(content.querySelectorAll(".it-year-heading"));
    const top = scroll.getBoundingClientRect().top;
    let active = headings[0];
    headings.forEach(function (heading) { if (heading.getBoundingClientRect().top <= top + 60) active = heading; });
    years.querySelectorAll("button").forEach(function (button) { button.setAttribute("aria-current", String(!!active && button.dataset.year === active.dataset.year)); });
  }

  function render() {
    if (!events) return;
    const rows = model.rows(events, interviewData, query, translatedOnly);
    const count = rows.reduce(function (sum, row) { return sum + row.interviews.length; }, 0);
    content.replaceChildren();
    years.replaceChildren();
    const note = element("p", "it-note", count + " 篇访谈 · " + events.length + " 个重要节点。访谈按档案收录日期定位，不代表实际采访时间；空白时段已压缩。" + (!count ? " 没有匹配的访谈，可调整搜索或翻译筛选。" : ""));
    note.setAttribute("role", "status");
    content.appendChild(note);
    const columns = element("div", "it-columns");
    columns.setAttribute("aria-hidden", "true");
    columns.append(element("span", "", "MILESTONES / 重要事件"), element("span", "", "INTERVIEWS / 访谈"));
    content.appendChild(columns);
    let section, previousYear;
    rows.forEach(function (row) {
      const year = row.date === "unknown" ? "日期待确认" : row.date.slice(0, 4);
      if (year !== previousYear) {
        section = element("section", "it-year");
        const heading = element("h3", "it-year-heading");
        heading.dataset.year = year;
        heading.appendChild(element("span", "", year));
        section.appendChild(heading);
        content.appendChild(section);
        const jump = element("button", "", year);
        jump.type = "button";
        jump.dataset.year = year;
        jump.addEventListener("click", function () {
          scroll.scrollTo({ top: heading.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 12, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        });
        years.appendChild(jump);
      }
      const node = element("div", "it-row");
      const date = element(row.date === "unknown" ? "span" : "time", "it-date", row.date === "unknown" ? "—" : row.date.slice(5).replace("-", "."));
      if (row.date !== "unknown") { date.dateTime = row.date; date.setAttribute("aria-label", row.date); }
      node.appendChild(date);
      if (row.events.length) {
        const left = element("div", "it-events");
        row.events.forEach(function (item) { left.appendChild(eventCard(item)); });
        node.appendChild(left);
      }
      if (row.interviews.length) {
        const right = element("div", "it-interviews");
        row.interviews.forEach(function (item) { right.appendChild(interviewCard(item)); });
        node.appendChild(right);
      }
      section.appendChild(node);
      previousYear = year;
    });
    updateYear();
  }

  function load() {
    if (loading || events) return;
    loading = true;
    const message = element("p", "it-message", "正在载入演出与动画节点…");
    message.setAttribute("role", "status");
    content.replaceChildren(message);
    WijipediaData.load(["live", "timeline"]).then(function (data) {
      events = model.milestones(data.live, data.timeline);
      render();
    }).catch(function () {
      const error = element("p", "it-message", "重要节点载入失败，请重试。");
      error.setAttribute("role", "alert");
      const retry = element("button", "it-retry", "重试");
      retry.type = "button";
      retry.addEventListener("click", load);
      error.appendChild(retry);
      content.replaceChildren(error);
    }).finally(function () { loading = false; });
  }

  trigger.addEventListener("click", function () {
    if (!overlay) create();
    OverlayManager.open({
      type: "interview-timeline", id: "main", manageHash: false,
      getElement: function () { return overlay; },
      activate: function () { overlay.hidden = false; main.inert = true; },
      deactivate: function () { overlay.hidden = true; main.inert = false; trigger.focus(); },
      setInteractive: function (interactive) {
        if (interactive) (lastFocus && lastFocus.isConnected ? lastFocus : overlay.querySelector(".it-close")).focus({ preventScroll: true });
      }
    });
    load();
    updateYear();
  });
})();
