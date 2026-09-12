(function () {
  "use strict";

  const trigger = document.getElementById("somethingNewTrigger");
  const drawer = document.getElementById("somethingNewDrawer");
  const content = document.getElementById("somethingNewContent");
  const count = document.getElementById("somethingNewCount");
  const closeButton = document.getElementById("closeSomethingNew");
  const overlay = document.getElementById("drawerOverlay");
  const items = Array.isArray(window.SOMETHING_NEW) ? window.SOMETHING_NEW : [];
  const storageKey = "wijipedia:something-new:seen:v1";
  let rendered = false;

  function syncPageActivity() {
    document.documentElement.classList.toggle("page-inactive", document.hidden);
  }
  document.addEventListener("visibilitychange", syncPageActivity);
  syncPageActivity();

  if (!trigger || !drawer || !content || !items.length) return;

  function itemKey(item) {
    return [item.type, item.ref, item.update_date].join("|");
  }

  function readSeen() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return new Set(Array.isArray(stored) ? stored : []);
    } catch (error) {
      return new Set();
    }
  }

  let seen = readSeen();

  function saveSeen() {
    try {
      const currentKeys = new Set(items.map(itemKey));
      localStorage.setItem(storageKey, JSON.stringify(
        Array.from(seen).filter(function (key) { return currentKeys.has(key); })
      ));
    } catch (error) {
      // 禁用存储时不影响内容浏览。
    }
  }

  function updateCount() {
    const unread = items.filter(function (item) { return !seen.has(itemKey(item)); }).length;
    count.textContent = unread ? unread + " NEW" : items.length + " FILES";
    trigger.classList.toggle("has-unread", unread > 0);
  }

  function formatDate(value) {
    const match = String(value || "").match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    return match ? match[1] + "." + match[2].padStart(2, "0") + "." + match[3].padStart(2, "0") : value;
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function renderCards() {
    if (rendered) return;
    const fragment = document.createDocumentFragment();

    items.forEach(function (item) {
      const card = makeElement("a", "something-new-drawer-card");
      card.href = item.href;
      card.setAttribute("aria-label", "打开" + item.title);

      const visual = makeElement("span", "something-new-drawer-visual");
      if (item.image) {
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        visual.appendChild(image);
      } else {
        visual.appendChild(makeElement("span", "something-new-drawer-placeholder", "NO VISUAL DATA"));
      }
      visual.appendChild(makeElement("span", "something-new-drawer-type", item.type.toUpperCase()));

      const body = makeElement("span", "something-new-drawer-card-body");
      body.appendChild(makeElement("span", "something-new-drawer-date", formatDate(item.update_date)));
      body.appendChild(makeElement("strong", "something-new-drawer-title", item.title));
      body.appendChild(makeElement("span", "something-new-drawer-subtitle", item.subtitle));
      body.appendChild(makeElement("span", "something-new-drawer-open", "OPEN FILE  ↗"));

      card.appendChild(visual);
      card.appendChild(body);
      fragment.appendChild(card);
    });

    content.appendChild(fragment);
    rendered = true;
  }

  function markVisibleRead() {
    items.forEach(function (item) { seen.add(itemKey(item)); });
    saveSeen();
    updateCount();
  }

  function openDrawer() {
    renderCards();
    const logsDrawer = document.getElementById("archiveDrawer");
    if (logsDrawer) logsDrawer.classList.remove("open");
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    trigger.setAttribute("aria-expanded", "true");
    overlay.classList.add("active");
    window.requestAnimationFrame(markVisibleRead);
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    trigger.setAttribute("aria-expanded", "false");
    overlay.classList.remove("active");
    trigger.focus({ preventScroll: true });
  }

  trigger.addEventListener("click", openDrawer);
  closeButton.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", function () {
    if (drawer.classList.contains("open")) closeDrawer();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
  });

  trigger.hidden = false;
  updateCount();
})();
