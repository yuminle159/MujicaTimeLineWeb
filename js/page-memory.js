(function () {
  "use strict";
  if (!window.localStorage) return;
  const key = "wijipedia:page-state:v1:" + location.pathname;
  const searchSelector = 'input[type="search"]';

  function controlIdentity(element) {
    const scope = element.closest("[id]");
    const attributes = ["filter", "tag", "type", "year"];
    for (let index = 0; index < attributes.length; index += 1) {
      const name = attributes[index];
      if (Object.prototype.hasOwnProperty.call(element.dataset, name)) {
        return { scope: scope ? scope.id : "", attribute: name, value: element.dataset[name] };
      }
    }
    return { scope: scope ? scope.id : "", text: element.textContent.trim() };
  }

  function findControl(identity) {
    const scope = identity.scope ? document.getElementById(identity.scope) : document;
    if (!scope) return null;
    if (identity.attribute) {
      return Array.from(scope.querySelectorAll("[data-" + identity.attribute + "]")).find(function (item) {
        return item.dataset[identity.attribute] === identity.value;
      }) || null;
    }
    return Array.from(scope.querySelectorAll("button")).find(function (item) {
      return item.textContent.trim() === identity.text;
    }) || null;
  }

  function snapshot() {
    const inputs = Array.from(document.querySelectorAll(searchSelector)).map(function (input, index) {
      return { id: input.id || "", placeholder: input.placeholder || "", index: index, value: input.value };
    });
    const active = Array.from(document.querySelectorAll("button.active,button[aria-pressed='true'],.pagination-btn.active"))
      .filter(function (button) { return !button.closest("[role='dialog']"); })
      .map(controlIdentity);
    const sorts = Array.from(document.querySelectorAll(".sort-btn")).map(function (button) {
      return { identity: controlIdentity(button), text: button.textContent.trim() };
    });
    localStorage.setItem(key, JSON.stringify({ scrollY: window.scrollY, inputs: inputs, active: active, sorts: sorts }));
  }

  function restore() {
    let state;
    try { state = JSON.parse(localStorage.getItem(key) || "null"); } catch (error) { return; }
    if (!state) return;
    (state.inputs || []).forEach(function (saved) {
      const input = saved.id ? document.getElementById(saved.id) : Array.from(document.querySelectorAll(searchSelector)).find(function (item, index) {
        return (saved.placeholder && item.placeholder === saved.placeholder) || index === saved.index;
      });
      if (!input || !saved.value) return;
      input.value = saved.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    (state.active || []).forEach(function (identity) {
      const button = findControl(identity);
      if (button && !button.classList.contains("active") && button.getAttribute("aria-pressed") !== "true") button.click();
    });
    (state.sorts || []).forEach(function (saved) {
      const button = findControl(saved.identity);
      if (button && button.textContent.trim() !== saved.text) button.click();
    });
    const targetY = Number(state.scrollY) || 0;
    [0, 90, 260].forEach(function (delay) {
      window.setTimeout(function () { window.scrollTo(0, targetY); }, delay);
    });
  }

  window.addEventListener("pagehide", snapshot);
  window.addEventListener("beforeunload", snapshot);
  window.setTimeout(restore, 0);
})();
