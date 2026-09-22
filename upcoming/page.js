(function () {
  "use strict";

  const DAY = 86400000;
  const typeNames = { song: "SONG", live: "LIVE", discography: "DISC" };
  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const agenda = document.getElementById("upcomingAgenda");
  const agendaCount = document.getElementById("agendaCount");
  const filters = document.getElementById("upcomingFilters");

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function atDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const today = atDay(new Date());
  let shownMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let activeType = "all";

  function itemUrl(section, hashId) {
    const parameters = { songs: "song", live: "live", discography: "discography" };
    return "../" + section + "/index.html#" + parameters[section] + "=" + encodeURIComponent(hashId || "");
  }

  const allEvents = [];
  (window.songsData || []).forEach(function (item) {
    const date = parseDate(item.release_date);
    if (date) allEvents.push({ type: "song", date: date, title: item.name_jp || item.name || "Unknown", url: itemUrl("songs", item.hash_id) });
  });
  (window.livesData || []).forEach(function (item) {
    const date = parseDate(item.date);
    if (date) allEvents.push({ type: "live", date: date, title: item.name || "Unknown", url: itemUrl("live", item.hash_id) });
  });
  (window.discographyData || []).forEach(function (item) {
    const date = parseDate(item.release_date);
    if (date) allEvents.push({ type: "discography", date: date, title: item.title_jp || item.title || "Unknown", url: itemUrl("discography", item.hash_id) });
  });
  allEvents.sort(function (left, right) { return left.date - right.date || left.title.localeCompare(right.title); });

  function visibleEvents() {
    return allEvents.filter(function (item) {
      return item.date >= today && (activeType === "all" || item.type === activeType);
    });
  }

  function sameDay(left, right) {
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  }

  function makeEvent(item) {
    const link = document.createElement("a");
    link.className = "calendar-event";
    link.dataset.type = item.type;
    link.href = item.url;
    link.textContent = item.title;
    link.title = typeNames[item.type] + " · " + item.title;
    return link;
  }

  function renderCalendar() {
    const year = shownMonth.getFullYear();
    const month = shownMonth.getMonth();
    monthLabel.textContent = year + " / " + String(month + 1).padStart(2, "0");
    grid.replaceChildren();

    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows = Math.ceil((firstWeekday + daysInMonth) / 7);
    const startDate = new Date(year, month, 1 - firstWeekday);
    const events = visibleEvents();

    for (let index = 0; index < rows * 7; index += 1) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index);
      const cell = document.createElement("div");
      cell.className = "calendar-day";
      if (date.getMonth() !== month) cell.classList.add("is-outside");
      if (sameDay(date, today)) cell.classList.add("is-today");

      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = date.getDate();
      cell.appendChild(number);

      const list = document.createElement("div");
      list.className = "day-events";
      const dayEvents = events.filter(function (item) { return sameDay(item.date, date); });
      dayEvents.slice(0, 3).forEach(function (item) { list.appendChild(makeEvent(item)); });
      if (dayEvents.length > 3) {
        const more = document.createElement("div");
        more.className = "more-events";
        more.textContent = "+ " + (dayEvents.length - 3) + " MORE";
        list.appendChild(more);
      }
      cell.appendChild(list);
      grid.appendChild(cell);
    }
  }

  function renderAgenda() {
    const events = visibleEvents();
    agendaCount.textContent = String(events.length).padStart(2, "0");
    agenda.replaceChildren();
    if (!events.length) {
      const empty = document.createElement("p");
      empty.className = "agenda-empty";
      empty.textContent = "当前筛选下暂无已登记的未来档期。";
      agenda.appendChild(empty);
      return;
    }
    events.slice(0, 10).forEach(function (item) {
      const link = document.createElement("a");
      link.className = "agenda-item";
      link.dataset.type = item.type;
      link.href = item.url;

      const date = document.createElement("span");
      date.className = "agenda-date";
      date.innerHTML = "<strong>" + String(item.date.getDate()).padStart(2, "0") + "</strong>" + String(item.date.getMonth() + 1).padStart(2, "0") + " / " + item.date.getFullYear();

      const copy = document.createElement("span");
      copy.className = "agenda-copy";
      const type = document.createElement("span");
      type.className = "agenda-type";
      type.textContent = typeNames[item.type];
      const title = document.createElement("span");
      title.className = "agenda-title";
      title.textContent = item.title;
      copy.append(type, title);
      link.append(date, copy);
      agenda.appendChild(link);
    });
  }

  function render() {
    renderCalendar();
    renderAgenda();
  }

  filters.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-type]");
    if (!button) return;
    activeType = button.dataset.type;
    filters.querySelectorAll("button").forEach(function (item) { item.classList.toggle("active", item === button); });
    render();
  });
  document.getElementById("previousMonth").addEventListener("click", function () {
    shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", function () {
    shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  document.getElementById("todayButton").addEventListener("click", function () {
    shownMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderCalendar();
  });

  const nearest = visibleEvents()[0];
  if (nearest) shownMonth = new Date(nearest.date.getFullYear(), nearest.date.getMonth(), 1);
  render();
})();
