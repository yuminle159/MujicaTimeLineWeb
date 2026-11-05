(function () {
  "use strict";

  // 共用剧透名单：增删条目即可同时更新 Interview 和 Something New。
  // id 对应 hash_id，title 对应访谈标题；独立于自动生成的数据。
  const entries = [];
  const ids = new Set(entries.map(function (entry) { return entry.id; }));
  const titles = new Set(entries.map(function (entry) { return entry.title; }));
  window.InterviewSpoilers = {
    has: function (item) {
      if (!item || (item.type && item.type !== "interview")) return false;
      return ids.has(item.hash_id) || titles.has(item.ref || item.title);
    },
    markup: '<span class="card-spoiler-warning"><span class="spoiler-warning-label" aria-hidden="true">⚠ SPOILER WARNING</span><strong>剧透注意！</strong></span>'
  };
})();
