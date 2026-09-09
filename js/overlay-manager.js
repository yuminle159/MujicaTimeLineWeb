(function (global) {
  "use strict";

  const MAX_DEPTH = 4;
  const stack = [];
  let bodyOverflowBeforeOpen = "";
  let ownsRootHash = false;

  function keyOf(entry) {
    return entry.type + ":" + entry.id;
  }

  function replaceUrl(value) {
    history.replaceState(null, "", value);
  }

  function writeRootHash(entry) {
    ownsRootHash = !!entry.hash;
    if (ownsRootHash) replaceUrl(entry.hash);
  }

  function clearRootHash() {
    if (ownsRootHash) replaceUrl(location.pathname + location.search);
    ownsRootHash = false;
  }

  function lastEntryOfType(type) {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].type === type) return stack[index];
    }
    return null;
  }

  function syncLayers() {
    const represented = {};
    stack.forEach(function (entry, index) {
      represented[entry.type] = { entry: entry, index: index };
    });

    Object.keys(represented).forEach(function (type) {
      const representedEntry = represented[type];
      const element = representedEntry.entry.getElement();
      if (!element) return;
      const isTop = representedEntry.index === stack.length - 1;
      const layer = 10000 + representedEntry.index * 1000;
      if (typeof representedEntry.entry.setLayer === "function") representedEntry.entry.setLayer(layer);
      else element.style.zIndex = String(layer);
      element.inert = !isTop;
      element.setAttribute("aria-hidden", isTop ? "false" : "true");
      if (typeof representedEntry.entry.setInteractive === "function") representedEntry.entry.setInteractive(isTop);
    });

    document.body.style.overflow = stack.length ? "hidden" : bodyOverflowBeforeOpen;
  }

  function removeTop() {
    const removed = stack.pop();
    if (!removed) return null;
    if (typeof removed.capture === "function") removed.capture();
    const previousSameType = lastEntryOfType(removed.type);
    if (previousSameType) previousSameType.activate();
    else removed.deactivate();
    if (typeof removed.onRemove === "function") removed.onRemove();
    return removed;
  }

  function open(entry) {
    if (!entry || !entry.type || entry.id == null || typeof entry.activate !== "function" ||
        typeof entry.deactivate !== "function" || typeof entry.getElement !== "function") return false;

    entry.id = String(entry.id);
    const requestedKey = keyOf(entry);
    const existingIndex = stack.findIndex(function (item) { return keyOf(item) === requestedKey; });

    if (existingIndex >= 0) {
      while (stack.length - 1 > existingIndex) removeTop();
      stack[existingIndex].activate();
      syncLayers();
      return true;
    }

    if (!stack.length) {
      bodyOverflowBeforeOpen = document.body.style.overflow;
      writeRootHash(entry);
    } else if (stack.length >= MAX_DEPTH) {
      removeTop();
    }

    const previousSameType = lastEntryOfType(entry.type);
    if (previousSameType && typeof previousSameType.capture === "function") previousSameType.capture();
    stack.push(entry);
    entry.activate();
    syncLayers();
    return true;
  }

  function close(type, id) {
    const top = stack[stack.length - 1];
    if (!top) return false;
    if (type && top.type !== type) return false;
    if (id != null && top.id !== String(id)) return false;
    removeTop();
    if (!stack.length) clearRootHash();
    syncLayers();
    return true;
  }

  function isTop(type, id) {
    const top = stack[stack.length - 1];
    return !!(top && top.type === type && (id == null || top.id === String(id)));
  }

  function snapshot() {
    return stack.map(function (entry) { return { type: entry.type, id: entry.id }; });
  }

  global.OverlayManager = {
    MAX_DEPTH: MAX_DEPTH,
    open: open,
    close: close,
    isTop: isTop,
    depth: function () { return stack.length; },
    snapshot: snapshot
  };
})(window);
