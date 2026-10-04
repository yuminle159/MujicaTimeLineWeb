(function () {
  "use strict";

  const typeNames = {
    song: "歌曲",
    live: "演出",
    discography: "实体发行物",
    animation: "动画相关",
    activity: "线上/线下活动"
  };
  const filters = document.getElementById("upcomingFilters");
  const list = document.getElementById("upcomingList");
  const count = document.getElementById("upcomingCount");
  const todayLabel = document.getElementById("todayLabel");

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getFullYear() === Number(match[1]) && date.getMonth() + 1 === Number(match[2]) && date.getDate() === Number(match[3]) ? date : null;
  }

  function atDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function dateText(date) {
    return date.getFullYear() + "." + String(date.getMonth() + 1).padStart(2, "0") + "." + String(date.getDate()).padStart(2, "0");
  }

  function dateISO(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function daysFromToday(date) {
    const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((target - current) / 86400000);
  }

  function countdownFor(item) {
    const days = daysFromToday(item.start);
    if (days > 0) return { text: "距今 " + days + " 天", state: "future" };
    if (days === 0) return { text: "今天", state: "today" };
    const remaining = daysFromToday(item.end);
    return { text: remaining === 0 ? "进行中 · 最后一天" : "进行中 · 剩余 " + remaining + " 天", state: "ongoing" };
  }

  const events = (window.WIJIPEDIA_UPCOMING_EVENTS || []).flatMap(item => {
    const start = parseDate(item.date);
    if (!start || !typeNames[item.type] || !item.url) return [];
    const parsedEnd = parseDate(item.endDate);
    return [{
      type: item.type,
      start,
      end: parsedEnd && parsedEnd >= start ? parsedEnd : start,
      title: item.title || "未命名事件",
      url: item.url
    }];
  });
  let today = atDay(new Date());
  let activeType = "all";

  function visibleEvents() {
    return events.filter(item => item.end >= today && (activeType === "all" || item.type === activeType))
      .sort((left, right) => Math.max(left.start, today) - Math.max(right.start, today) || left.start - right.start || left.title.localeCompare(right.title));
  }

  function makeRow(item) {
    const countdown = countdownFor(item);
    const row = document.createElement("a");
    row.className = "upcoming-row";
    row.dataset.type = item.type;
    row.href = item.url;
    row.setAttribute("aria-label", dateText(item.start) + "，" + typeNames[item.type] + "，" + item.title + "，" + countdown.text);

    const date = document.createElement("time");
    date.className = "row-date";
    date.dateTime = dateISO(item.start);
    const day = document.createElement("strong");
    day.textContent = String(item.start.getDate()).padStart(2, "0");
    const month = document.createElement("span");
    month.textContent = String(item.start.getMonth() + 1).padStart(2, "0") + " / " + item.start.getFullYear();
    date.append(day, month);
    if (item.end > item.start) {
      const range = document.createElement("small");
      range.textContent = "至 " + dateText(item.end);
      date.appendChild(range);
    }

    const type = document.createElement("span");
    type.className = "row-type";
    type.textContent = typeNames[item.type];

    const title = document.createElement("span");
    title.className = "row-title";
    title.textContent = item.title;

    const countdownLabel = document.createElement("span");
    countdownLabel.className = "row-countdown is-" + countdown.state;
    countdownLabel.textContent = countdown.text;

    const arrow = document.createElement("span");
    arrow.className = "row-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    row.append(date, type, title, countdownLabel, arrow);
    return row;
  }

  function render() {
    const items = visibleEvents();
    todayLabel.textContent = "AS OF " + dateText(today);
    count.textContent = String(items.length).padStart(2, "0") + " EVENTS";
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "list-empty";
      empty.textContent = "当前筛选下暂无已登记的未来档期。";
      list.appendChild(empty);
      return;
    }

    let monthKey = "";
    let monthRows = null;
    items.forEach(item => {
      const displayDate = item.start > today ? item.start : today;
      const key = displayDate.getFullYear() + "-" + displayDate.getMonth();
      if (key !== monthKey) {
        monthKey = key;
        const section = document.createElement("section");
        section.className = "month-group";
        const heading = document.createElement("h3");
        heading.className = "month-heading";
        heading.textContent = displayDate.getFullYear() + " / " + String(displayDate.getMonth() + 1).padStart(2, "0");
        monthRows = document.createElement("div");
        monthRows.className = "month-rows";
        section.append(heading, monthRows);
        list.appendChild(section);
      }
      monthRows.appendChild(makeRow(item));
    });
  }

  filters.addEventListener("click", event => {
    const button = event.target.closest("button[data-type]");
    if (!button || !filters.contains(button)) return;
    activeType = button.dataset.type;
    filters.querySelectorAll("button[data-type]").forEach(item => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    render();
  });

  function refreshToday() {
    const currentDay = atDay(new Date());
    if (currentDay.getTime() === today.getTime()) return;
    today = currentDay;
    render();
  }
  window.setInterval(refreshToday, 60 * 1000);
  window.addEventListener("focus", refreshToday);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshToday();
  });
  render();
})();
