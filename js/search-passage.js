/* Shared by the global search worker, fallback, and detail pages. */
(function (global) {
  "use strict";

  function prepare(sections, normalize) {
    if (typeof sections === "string") sections = [["", sections]];
    const parts = sections.map(([id, text]) => ({ id, text, folded: normalize(text) }));
    return { parts, body: parts.map(part => part.folded).join(" ") };
  }

  function excerpt(entry, query, rawQuery, subtitle) {
    if (entry) {
      for (const term of [query, ...query.split(" ")]) {
        const part = entry.parts.find(part => part.folded.includes(term));
        if (!part) continue;
        let text = part.text;
        let needle = term === query ? rawQuery.trim() : term;
        let index = text.toLowerCase().indexOf(needle.toLowerCase());
        if (index < 0) {
          text = part.folded;
          needle = term;
          index = text.indexOf(term);
        }
        const start = Math.max(0, index - 42);
        const end = Math.min(text.length, index + needle.length + 76);
        return { part: part.id, needle: text.slice(index, index + needle.length),
          snippet: (start ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "") };
      }
    }
    return { snippet: subtitle || "" };
  }

  let pending;
  if (global.document) {
    const url = new URL(location.href);
    if (url.searchParams.has("hit")) {
      pending = { hash: url.hash, needle: url.searchParams.get("hit"), part: url.searchParams.get("part") };
      url.searchParams.delete("hit");
      url.searchParams.delete("part");
      history.replaceState(history.state, "", url);
    }
  }

  function take(hash) {
    if (!pending || hash !== pending.hash) return null;
    const result = pending;
    pending = null;
    return result;
  }

  function fold(text) {
    return text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}]/gu, "");
  }

  function reveal(roots, needle, beforeScroll) {
    const key = fold(needle);
    if (!key) return;
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let text = "";
      const spans = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const start = text.length;
        text += fold(node.data);
        if (text.length > start) spans.push({ node, start, end: text.length });
      }
      const start = text.indexOf(key);
      if (start < 0) continue;
      const end = start + key.length;
      const first = spans.find(span => span.end > start);
      const last = spans.find(span => span.end >= end);
      function offset(span, position, after) {
        let length = span.start, offset = 0;
        for (const character of span.node.data) {
          length += fold(character).length;
          if (length > position) return offset + (after ? character.length : 0);
          offset += character.length;
        }
        return offset;
      }
      const range = document.createRange();
      range.setStart(first.node, offset(first, start, false));
      range.setEnd(last.node, offset(last, end - 1, true));
      if (beforeScroll) beforeScroll(first.node.parentElement);
      requestAnimationFrame(() => {
        if (!first.node.isConnected) return;
        const marker = document.createElement("span");
        const point = range.cloneRange();
        point.collapse(true);
        point.insertNode(marker);
        marker.scrollIntoView({ block: "center", behavior: "instant" });
        marker.remove();
        if (global.CSS && CSS.highlights) {
          CSS.highlights.set("search-hit", new Highlight(range));
          setTimeout(() => CSS.highlights.delete("search-hit"), 3500);
        } else {
          const selection = getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
      return;
    }
  }
  global.SearchPassage = { prepare, excerpt, take, reveal };
})(self);
