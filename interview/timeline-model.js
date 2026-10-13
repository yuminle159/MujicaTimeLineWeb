(function (global) {
  "use strict";
  const DAY = 86400000;

  function dateKey(value) {
    const match = String(value || "").match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (!match) return null;
    const key = match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0");
    const stamp = Date.parse(key + "T00:00:00Z");
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === key ? key : null;
  }

  function daysBetween(a, b) { return (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY; }

  function milestones(lives, timeline) {
    const joint = "MyGO!!!!!×Ave Mujica 合同ライブ「わかれ道の、その先へ」";
    const twoMan = "MyGO!!!!!×Ave Mujica ツーマンライブ「“moment / memory”」";
    const selected = lives.filter(function (item) {
      return item.tag === "One Man Live" || item.name === twoMan ||
        (item.tag === "BanG Dream!" && (item.name === joint || item.name.startsWith(joint + "DAY")));
    }).map(function (item) {
      return { date: dateKey(item.date), endDate: dateKey(item.date), title: item.name, kind: "LIVE", key: true, ids: [item.hash_id] };
    }).filter(function (item) { return item.date; }).sort(function (a, b) { return a.date.localeCompare(b.date); });

    const grouped = [];
    selected.forEach(function (item) {
      const dayMatch = item.title.match(/\s*DAY([12])(?:\s*:.*)?$/i);
      const base = dayMatch ? item.title.slice(0, dayMatch.index) : item.title;
      const previous = grouped[grouped.length - 1];
      if (dayMatch && dayMatch[1] === "2" && previous && previous.dayOne &&
          previous.base === base && daysBetween(previous.date, item.date) === 1) {
        previous.title = base;
        previous.endDate = item.date;
        previous.ids.push.apply(previous.ids, item.ids);
      } else {
        grouped.push(Object.assign({}, item, { base: base, dayOne: !!dayMatch && dayMatch[1] === "1" }));
      }
    });

    timeline.forEach(function (item) {
      const title = item.title || "";
      const episode = title.match(/^TV动画「BanG Dream! Ave Mujica」#(\d+)\s/);
      const isEpisode = episode && Number(episode[1]) >= 1 && Number(episode[1]) <= 13 && title.includes("播出") && !title.includes("先行上映");
      const isMygo = /^TV动画「BanG Dream! It's MyGO!!!!!」#13\s/.test(title) && title.includes("播出");
      const isFilm = title === "电影「BanG Dream! Ave Mujica prima aurora」上映";
      const date = dateKey(item.date);
      if ((!isEpisode && !isMygo && !isFilm) || !date) return;
      grouped.push({ date: date, endDate: date, title: title, kind: isFilm ? "FILM" : "ANIME", key: !!isFilm || !!isMygo || [1, 13].includes(Number(episode && episode[1])), ids: [item.hash_id] });
    });
    return grouped.sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function rows(events, interviews, query, translatedOnly) {
    const byDate = new Map();
    function row(date) {
      if (!byDate.has(date)) byDate.set(date, { date: date, events: [], interviews: [] });
      return byDate.get(date);
    }
    events.forEach(function (item) { row(item.date).events.push(item); });
    const needle = String(query || "").trim().toLocaleLowerCase();
    interviews.forEach(function (item, index) {
      if (translatedOnly && String(item.if_translated).toLowerCase() !== "yes") return;
      if (needle && !(String(item.title || "") + " " + String(item.interviewee || "")).toLocaleLowerCase().includes(needle)) return;
      row(dateKey(item.date) || "unknown").interviews.push({ item: item, index: index });
    });
    return Array.from(byDate.values()).sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  global.InterviewTimelineModel = { dateKey: dateKey, daysBetween: daysBetween, milestones: milestones, rows: rows };
})(window);
