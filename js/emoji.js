/* Emoji artwork: Twemoji, Copyright Twitter, Inc. and other contributors.
 * https://github.com/jdecked/twemoji — CC BY 4.0.
 * https://creativecommons.org/licenses/by/4.0/
 * Original Unicode text is retained for selection, copying and accessibility.
 */
(function () {
  "use strict";
  if (!window.twemoji) return;

  const assetRoot = new URL("vendor/twemoji/svg/", document.currentScript.src);
  const excluded = "script, style, textarea, input, select, option, pre, code, svg, math, .site-emoji, [data-native-emoji]";
  const failedIcons = new Set();
  const pending = new Set();
  let timer;

  function bindImageFallback(image) {
    const wrapper = image.parentElement;
    const raw = wrapper.querySelector(".site-emoji-text").textContent;
    const icon = new URL(image.src).pathname.split("/").pop().replace(/\.svg$/, "");
    if (failedIcons.has(icon)) {
      wrapper.replaceWith(document.createTextNode(raw));
      return;
    }
    image.onerror = function () {
      failedIcons.add(icon);
      wrapper.replaceWith(document.createTextNode(raw));
    };
  }

  function renderText(node) {
    const parent = node.parentElement;
    const text = node.nodeValue;
    if (!parent || parent.closest(excluded)) return;
    const tokens = [];
    let cursor = 0;
    twemoji.replace(text, function (raw) {
      const index = text.indexOf(raw, cursor);
      cursor = index + raw.length;
      if (raw !== "\ufe0f" && text[cursor] !== "\ufe0e") tokens.push({ raw, index });
      return raw;
    });
    // Some pasted emoji (e.g. 🕊) omit the color selector. Render these too,
    // while respecting an explicit text selector and keeping the original text.
    for (const match of text.matchAll(/\p{Extended_Pictographic}[\uFE0E\uFE0F]?/gu)) {
      if (match[0].endsWith("\ufe0e") || tokens.some(token => match.index >= token.index && match.index < token.index + token.raw.length)) continue;
      if (twemoji.test(match[0] + "\ufe0f")) tokens.push({ raw: match[0], index: match.index });
    }
    if (!tokens.length) return;
    tokens.sort((a, b) => a.index - b.index);
    const fragment = document.createDocumentFragment();
    cursor = 0;
    tokens.forEach(function ({ raw, index }) {
      const icon = twemoji.convert.toCodePoint(raw.includes("\u200d") ? raw : raw.replace(/\ufe0f/g, ""));
      fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
      cursor = index + raw.length;
      // Leave copyright/trademark symbols and standalone variation selectors as text.
      if (!icon || /^(a9|ae|2122)$/.test(icon) || failedIcons.has(icon)) {
        fragment.appendChild(document.createTextNode(raw));
        return;
      }
      const wrapper = document.createElement("span");
      wrapper.className = "site-emoji";
      const original = document.createElement("span");
      original.className = "site-emoji-text";
      original.textContent = raw;
      const image = document.createElement("img");
      image.className = "site-emoji-image";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.draggable = false;
      image.src = new URL(icon + ".svg", assetRoot).href;
      wrapper.append(original, image);
      bindImageFallback(image);
      fragment.appendChild(wrapper);
    });
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }

  function render(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      renderText(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(renderText);
  }

  const observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      if (record.type === "characterData") pending.add(record.target);
      else record.addedNodes.forEach(node => pending.add(node));
    });
    if (timer !== undefined) return;
    timer = setTimeout(function () {
      timer = undefined;
      observer.disconnect();
      const roots = Array.from(pending).filter(node => node.isConnected);
      pending.clear();
      roots.filter(node => !roots.some(other => other !== node && other.contains(node))).forEach(render);
      observe();
    }, 0);
  });

  function observe() {
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  window.WijipediaEmoji = {
    // Detached images start loading here, before the prepared text is displayed.
    prepareText: function (text) {
      const template = document.createElement("div");
      template.textContent = text;
      render(template);
      return template;
    },
    applyText: function (element, template) {
      const content = template.cloneNode(true);
      content.querySelectorAll(".site-emoji-image").forEach(bindImageFallback);
      element.replaceChildren(...content.childNodes);
    }
  };
  document.dispatchEvent(new Event("wijipedia:emoji-ready"));
  render(document.body);
  observe();
})();
