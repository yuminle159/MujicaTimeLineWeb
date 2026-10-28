(function () {
  "use strict";

  // 共用剧透名单：增删条目即可同时更新 Interview 和 Something New。
  // id 对应 hash_id，title 对应访谈标题；独立于自动生成的数据。
  const entries = [
    { id: "gUsOq9umi6w", title: "电影「BanG Dream！Ave Mujica prima aurora」场刊 声优访谈部分" },
    { id: "f5ckErYJPuS", title: "SCREENα vol.10 电影「BanG Dream! Ave Mujica prima aurora」特集 佐佐木李子 x 高尾奏音访谈" },
    { id: "yvFZ0YTSvaC", title: "ototoy Ave Mujica 「神の名を」引诱人步入的深邃世界——向故事的前方，向音乐的更深处" },
    { id: "b3R0inuR9IR", title: "2026年10月 リスアニ！ 冈田梦以 x 米泽茜访谈" }
  ];
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
