"use strict";

self.window = self;
importScripts("../search-index.js" + self.location.search);

function normalize(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[\s\u3000]+/g, " ")
    .replace(/[·・,，。.!！?？:：;；'"“”‘’()（）\[\]【】《》<>/\\|_-]+/g, " ").trim();
}
function compact(value) { return normalize(value).replace(/\s+/g, ""); }

const index = (self.WIJIPEDIA_SEARCH_INDEX || []).map(function (item) {
  item._title = normalize(item.title); item._titleCompact = compact(item.title);
  item._subtitle = normalize(item.subtitle); item._subtitleCompact = compact(item.subtitle);
  item._terms = normalize(item.terms); item._termsCompact = compact(item.terms);
  return item;
});
let bodies = {};
let bodiesReady = false;

function loadBodies() {
  if (bodiesReady) return;
  self.postMessage({ type: "body-loading" });
  importScripts("../search-bodies.js" + self.location.search);
  Object.keys(self.WIJIPEDIA_SEARCH_BODIES || {}).forEach(function (key) { bodies[key] = normalize(self.WIJIPEDIA_SEARCH_BODIES[key]); });
  bodiesReady = true;
  self.WIJIPEDIA_SEARCH_BODIES = null;
  self.postMessage({ type: "body-ready" });
}

function score(item, query, queryCompact, tokens, body) {
  let value = 0;
  if (item._title === query || item._titleCompact === queryCompact) value += 1200;
  else if (item._title.startsWith(query) || item._titleCompact.startsWith(queryCompact)) value += 760;
  else if (item._title.includes(query) || item._titleCompact.includes(queryCompact)) value += 560;
  if (item._subtitle.includes(query) || item._subtitleCompact.includes(queryCompact)) value += 320;
  if (item._terms.includes(query) || item._termsCompact.includes(queryCompact)) value += 230;
  if (body && body.includes(query)) value += 110;
  let tokenHits = 0;
  tokens.forEach(function (token) {
    const tc = token.replace(/\s+/g, "");
    if (item._title.includes(token) || item._titleCompact.includes(tc)) { tokenHits += 1; value += 100; }
    else if (item._subtitle.includes(token) || item._terms.includes(token) || item._subtitleCompact.includes(tc) || item._termsCompact.includes(tc)) { tokenHits += 1; value += 40; }
    else if (body && body.includes(token)) { tokenHits += 1; value += 18; }
  });
  if (tokens.length > 1 && tokenHits === tokens.length) value += 130;
  return value;
}

function cleanItem(item) {
  return { key: item.key, type: item.type, title: item.title, subtitle: item.subtitle, date: item.date, image: item.image, url: item.url };
}
function snippetFor(item, body, rawQuery) {
  if (!body) return item.subtitle || item.terms || "";
  const needles = [normalize(rawQuery)].concat(normalize(rawQuery).split(" ")).filter(Boolean);
  let position = -1, needle = "";
  for (let i = 0; i < needles.length; i += 1) {
    position = body.indexOf(needles[i]);
    if (position >= 0) { needle = needles[i]; break; }
  }
  if (position < 0) return item.subtitle || "";
  const start = Math.max(0, position - 42);
  const end = Math.min(body.length, position + needle.length + 76);
  return (start ? "…" : "") + body.slice(start, end).trim() + (end < body.length ? "…" : "");
}

function findMatches(rawQuery, filter, includeBodies) {
  const query = normalize(rawQuery);
  if (!query) {
    return index.filter(function (item) { return filter === "all" || item.type === filter; })
      .slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 12)
      .map(function (item) { return { item: cleanItem(item), snippet: item.subtitle || item.terms || "" }; });
  }
  const queryCompact = query.replace(/\s+/g, "");
  const tokens = query.split(" ").filter(Boolean);
  return index.map(function (item) {
    const body = includeBodies ? (bodies[item.key] || "") : "";
    return { item: item, value: score(item, query, queryCompact, tokens, body), body: body };
  }).filter(function (match) {
    return match.value > 0 && (filter === "all" || match.item.type === filter);
  }).sort(function (a, b) {
    return b.value - a.value || String(b.item.date).localeCompare(String(a.item.date));
  }).slice(0, 40).map(function (match) {
    return { item: cleanItem(match.item), snippet: snippetFor(match.item, match.body, rawQuery) };
  });
}

self.addEventListener("message", function (event) {
  const message = event.data || {};
  if (message.type !== "query") return;
  const rawQuery = String(message.query || "");
  const filter = message.filter || "all";
  self.postMessage({ type: "results", id: message.id, query: rawQuery, matches: findMatches(rawQuery, filter, bodiesReady), bodyReady: bodiesReady });
  if (rawQuery && !bodiesReady) {
    loadBodies();
    self.postMessage({ type: "results", id: message.id, query: rawQuery, matches: findMatches(rawQuery, filter, true), bodyReady: true });
  }
});

self.postMessage({ type: "ready", count: index.length });
