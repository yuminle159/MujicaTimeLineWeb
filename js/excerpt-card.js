(function (global) {
  'use strict';
  const rootUrl = new URL('../', document.currentScript.src);
  const version = new URL(document.currentScript.src).search;
  const sources = new Map();
  let trigger, dialog, draft, currentBlob, currentUrl, renderTimer, renderId = 0, qrLoading;
  let pointerSelecting = false, selectionAllowed = false, lastPointerType = '', touchSelectionTimer;
  let lyricMode = '', lyricEdits = {};
  let separateBoundary = null, previousLyricText = '';
  const $ = name => dialog.querySelector('[data-excerpt="' + name + '"]');

  function publicUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !/^(localhost|127\.|\[?::1\]?$)/.test(url.hostname) ? url.href : '';
    } catch (_) { return ''; }
  }
  function pageUrl(path, hash) {
    const url = new URL(path, rootUrl);
    url.hash = hash || '';
    return publicUrl(url.href);
  }
  function registerSource(element, options) {
    sources.set(element, options);
    if (trigger) return;
    trigger = document.createElement('div');
    trigger.className = 'excerpt-selection-trigger';
    trigger.setAttribute('role', 'toolbar');
    trigger.setAttribute('aria-label', '所选文字操作');
    trigger.innerHTML = '<button type="button" data-excerpt-action="excerpt">摘录</button><button type="button" data-excerpt-action="copy">复制</button>';
    trigger.hidden = true;
    document.body.appendChild(trigger);
    trigger.addEventListener('pointerdown', event => event.preventDefault());
    trigger.addEventListener('click', event => {
      const action = event.target.closest('[data-excerpt-action]');
      if (!action || !draft) return;
      if (action.dataset.excerptAction === 'excerpt') open(draft);
      else copySelection(action);
    });
    document.addEventListener('pointerdown', event => {
      if (trigger.contains(event.target)) return;
      pointerSelecting = true;
      lastPointerType = event.pointerType;
      selectionAllowed = Array.from(sources.keys()).some(root => root.contains(event.target));
      trigger.hidden = true;
      clearTimeout(touchSelectionTimer);
    }, true);
    document.addEventListener('selectionchange', () => {
      selectionChanged(false);
      clearTimeout(touchSelectionTimer);
      if (lastPointerType === 'touch' && !pointerSelecting && selectionAllowed) touchSelectionTimer = setTimeout(() => selectionChanged(true), 150);
    });
    document.addEventListener('pointerup', () => {
      pointerSelecting = false;
      if (selectionAllowed) setTimeout(() => selectionChanged(true), 30);
    });
    document.addEventListener('pointercancel', () => { pointerSelecting = false; trigger.hidden = true; });
    document.addEventListener('keyup', event => {
      if ((event.shiftKey && /^(Arrow|Home|End)/.test(event.key)) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')) selectionChanged(true);
    });
    document.addEventListener('scroll', () => { trigger.hidden = true; }, true);
  }
  function selectionChanged(showAction) {
    if (!trigger || (dialog && dialog.open)) return;
    if (pointerSelecting) { trigger.hidden = true; return; }
    const selection = global.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      if (!trigger.contains(document.activeElement)) trigger.hidden = true;
      return;
    }
    if (!showAction && trigger.hidden) return;
    const range = selection.getRangeAt(0);
    const element = node => node.nodeType === 1 ? node : node.parentElement;
    for (const [root, source] of sources) {
      if (!root.isConnected || root.closest('[inert]') || !root.contains(range.startContainer) || !root.contains(range.endContainer)) continue;
      if (source.allowNode && (!source.allowNode(element(range.startContainer)) || !source.allowNode(element(range.endContainer)))) continue;
      const metadata = source.getMetadata();
      const text = selection.toString().trim();
      if (!metadata || !text) continue;
      draft = Object.assign({}, metadata, source.getSelectionData ? source.getSelectionData(range) : {}, { text });
      const rect = range.getBoundingClientRect();
      trigger.hidden = false;
      const width = trigger.offsetWidth;
      trigger.style.left = Math.max(12, Math.min(innerWidth - width - 12, rect.left)) + 'px';
      trigger.style.top = Math.max(12, Math.min(innerHeight - 90, rect.bottom + 9)) + 'px';
      return;
    }
    trigger.hidden = true;
  }
  async function copySelection(button) {
    const text = draft.text;
    let copied = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); copied = true; } } catch (_) {}
    if (!copied) {
      const selection = global.getSelection();
      const ranges = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
      const input = document.createElement('textarea');
      input.value = text; input.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(input); input.select();
      try { copied = document.execCommand('copy'); } catch (_) {}
      input.remove(); selection.removeAllRanges(); ranges.forEach(range => selection.addRange(range));
    }
    button.textContent = copied ? '已复制' : '复制失败';
    setTimeout(() => { button.textContent = '复制'; }, 1200);
  }
  function mount() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'excerpt-dialog';
    dialog.setAttribute('aria-labelledby', 'excerptDialogTitle');
    dialog.innerHTML = '<header class="excerpt-header"><div><small>WIJIPEDIA / EXCERPT</small><h2 id="excerptDialogTitle">摘录卡片</h2></div><button type="button" data-excerpt="close" aria-label="关闭摘录卡片">×</button></header>' +
      '<div class="excerpt-workspace"><section class="excerpt-editor" aria-label="编辑摘录"><label data-excerpt="language-field" hidden>歌词语言模式<select data-excerpt="language"><option value="cn">仅中文</option><option value="jp">仅日文</option><option value="paired">逐句中日对照</option><option value="separate">中日分段</option></select><small>按选中的歌词行整理，内容仍可编辑。</small></label><label>摘录内容<textarea data-excerpt="text" rows="8" maxlength="1800"></textarea></label>' +
      '<label>来源标题<input data-excerpt="title" maxlength="240"></label><label>来源信息<input data-excerpt="people" maxlength="200"></label>' +
      '<label>分享链接（可选）<input data-excerpt="url" type="url" placeholder="填写公开网址，可生成二维码"></label>' +
      '<label class="excerpt-checkbox"><input data-excerpt="qr" type="checkbox"> 显示原文二维码</label><p class="excerpt-hint">保留换行，图片高度随内容调整。手机也可以长按预览保存。</p><p class="excerpt-error" data-excerpt="error" role="status"></p></section>' +
      '<section class="excerpt-preview" aria-label="摘录图片预览"><img data-excerpt="preview" alt="摘录卡片预览" hidden><span data-excerpt="loading">正在生成预览…</span></section></div>' +
      '<footer class="excerpt-actions"><span data-excerpt="size"></span><button type="button" data-excerpt="save" disabled>保存图片</button></footer>';
    document.body.appendChild(dialog);
    $('close').addEventListener('click', () => dialog.close());
    global.addEventListener('keydown', event => {
      if (dialog.open && event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); dialog.close();
      }
    }, true);
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { renderId++; clearTimeout(renderTimer); });
    for (const name of ['text', 'title', 'people', 'url', 'qr']) $(name).addEventListener('input', scheduleRender);
    $('language').addEventListener('change', () => {
      if (lyricMode) lyricEdits[lyricMode] = { text: $('text').value, boundary: separateBoundary };
      lyricMode = $('language').value;
      const saved = lyricEdits[lyricMode];
      $('text').value = saved ? saved.text : lyricText(draft.lyricRows, lyricMode);
      separateBoundary = saved ? saved.boundary : defaultBoundary(draft.lyricRows, lyricMode);
      previousLyricText = $('text').value;
      scheduleRender();
    });
    $('text').addEventListener('input', trackSeparateBoundary);
    $('save').addEventListener('click', saveImage);
  }
  function open(metadata) {
    mount();
    draft = Object.assign({}, metadata);
    const lyrics = metadata.kind === 'lyrics' && Array.isArray(metadata.lyricRows) && metadata.lyricRows.length > 0;
    lyricMode = lyrics ? 'paired' : '';
    lyricEdits = {};
    $('language-field').hidden = !lyrics;
    $('language').value = 'paired';
    for (const mode of ['cn', 'jp']) $('language').querySelector('option[value="' + mode + '"]').disabled = lyrics && !metadata.lyricRows.some(row => String(row[mode] || '').trim());
    $('text').value = lyrics ? lyricText(metadata.lyricRows, lyricMode) : String(metadata.text || '');
    separateBoundary = null;
    previousLyricText = $('text').value;
    $('title').value = String(metadata.title || '');
    $('people').value = String(metadata.people || '');
    $('url').value = publicUrl(metadata.url);
    $('qr').checked = !!$('url').value;
    trigger && (trigger.hidden = true);
    global.getSelection().removeAllRanges();
    if (!dialog.open) dialog.showModal();
    scheduleRender();
  }
  function lyricText(rows, mode) {
    const jp = rows.map(row => row.jp || '').join('\n').trim();
    const cn = rows.map(row => row.cn || '').join('\n').trim();
    if (mode === 'jp') return jp;
    if (mode === 'cn') return cn;
    if (mode === 'separate') return [cn, jp].filter(Boolean).join('\n\n');
    return rows.map(row => [row.jp, row.cn].filter(Boolean).join('\n')).join('\n\n').trim();
  }
  function defaultBoundary(rows, mode) {
    if (mode !== 'separate') return null;
    const cn = rows.map(row => row.cn || '').join('\n').trim();
    const jp = rows.map(row => row.jp || '').join('\n').trim();
    return cn && jp ? cn.length : null;
  }
  function trackSeparateBoundary() {
    const next = $('text').value;
    if (lyricMode === 'separate' && separateBoundary !== null) {
      let prefix = 0, suffix = 0;
      while (prefix < previousLyricText.length && prefix < next.length && previousLyricText[prefix] === next[prefix]) prefix++;
      while (suffix < previousLyricText.length - prefix && suffix < next.length - prefix && previousLyricText[previousLyricText.length - suffix - 1] === next[next.length - suffix - 1]) suffix++;
      const removedEnd = previousLyricText.length - suffix;
      if (removedEnd <= separateBoundary) separateBoundary += next.length - previousLyricText.length;
      else if (prefix < separateBoundary + 2) separateBoundary = null;
      if (separateBoundary !== null && next.slice(separateBoundary, separateBoundary + 2) !== '\n\n') separateBoundary = null;
    }
    previousLyricText = next;
  }
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderId++;
    currentBlob = null;
    $('save').disabled = true;
    $('loading').hidden = false;
    $('preview').hidden = true;
    renderTimer = setTimeout(() => render(renderId), 100);
  }
  function loadQr() {
    if (global.qrcodegen) return Promise.resolve(global.qrcodegen);
    if (!qrLoading) qrLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const url = new URL('js/vendor/qrcodegen.js', rootUrl);
      url.search = version;
      script.src = url.href;
      script.onload = () => global.qrcodegen ? resolve(global.qrcodegen) : reject(new Error('二维码组件未能载入'));
      script.onerror = () => { script.remove(); qrLoading = null; reject(new Error('二维码组件未能载入，请重试或取消二维码')); };
      document.head.appendChild(script);
    });
    return qrLoading;
  }
  function wrap(context, text, width) {
    const lines = [];
    const segmenter = global.Intl && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
      let line = '';
      const chars = segmenter ? Array.from(segmenter.segment(paragraph), part => part.segment) : Array.from(paragraph);
      for (const char of chars) {
        if (line && context.measureText(line + char).width > width) {
          const space = line.lastIndexOf(' ');
          if (space > line.length / 3) {
            lines.push(line.slice(0, space));
            line = line.slice(space + 1) + char;
          } else { lines.push(line.trimEnd()); line = char.trimStart(); }
        } else line += char;
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }
  async function render(id) {
    try {
      const text = $('text').value.trim();
      const title = $('title').value.trim();
      const people = $('people').value.trim();
      const url = publicUrl($('url').value.trim());
      if (!text) throw new Error('请先选择或填写摘录内容');
      if (text.length > 1800) throw new Error('摘录较长，请精简至 1800 字以内');
      if (!title) throw new Error('请填写来源标题');
      if ($('url').value.trim() && !url) throw new Error('请填写可以公开访问的 http 或 https 链接');
      if ($('qr').checked && !url) throw new Error('添加公开链接后才能生成二维码');
      if (document.fonts) await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 800))]);
      const encoder = $('qr').checked ? await loadQr() : null;
      if (id !== renderId || !dialog.open) return;
      const qr = encoder ? encoder.QrCode.encodeText(url, encoder.QrCode.Ecc.MEDIUM) : null;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const quoteFont = '20px "Noto Serif SC", "Noto Serif JP", "Songti SC", serif';
      const metaFont = '14px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      context.font = quoteFont;
      let quoteLines = wrap(context, text, 452);
      if (lyricMode === 'separate' && separateBoundary !== null) {
        const raw = $('text').value;
        const cn = raw.slice(0, separateBoundary).trim();
        const jp = raw.slice(separateBoundary + 2).trim();
        if (cn && jp) quoteLines = [...wrap(context, cn, 452), null, ...wrap(context, jp, 452)];
      }
      context.font = metaFont;
      const titleLines = wrap(context, title, 452);
      context.font = '11px "Noto Sans SC", sans-serif';
      const peopleLines = people ? wrap(context, people, qr ? 340 : 452) : [];
      const footerY = 144 + quoteLines.length * 32 + 30;
      const date = String(draft.date || '').replace(/\s[\d:]+$/, '');
      const infoStart = footerY + 50 + titleLines.length * 23;
      const metadataBottom = Math.max(infoStart + peopleLines.length * 19 + (date ? 37 : 14), qr ? infoStart + 88 : 0);
      const height = Math.max(420, metadataBottom + 90);
      canvas.width = 1080;
      canvas.height = height * 2;
      context.scale(2, 2);
      context.fillStyle = '#141416'; context.fillRect(0, 0, 540, height);
      context.strokeStyle = '#49433c'; context.lineWidth = .7; context.strokeRect(24.5, 24.5, 491, height - 49);
      context.fillStyle = '#9e3e3d'; context.fillRect(44, 52, 28, 2);
      context.font = '10px "Space Grotesk", sans-serif'; context.fillStyle = '#b3a48d';
      context.fillText('WIJIPEDIA / ' + (draft.kind === 'lyrics' ? 'LYRICS' : 'READING NOTES'), 86, 57);
      context.font = '48px Georgia, serif'; context.fillStyle = '#8e7e6355'; context.fillText('“', 42, 114);
      context.font = quoteFont; context.fillStyle = '#e6dfd4';
      quoteLines.forEach((line, index) => {
        if (line !== null) context.fillText(line, 44, 145 + index * 32);
        else {
          context.save(); context.strokeStyle = 'rgba(163,150,126,.25)'; context.lineWidth = .5;
          context.beginPath(); context.moveTo(64, 137 + index * 32); context.lineTo(476, 137 + index * 32); context.stroke(); context.restore();
        }
      });
      context.strokeStyle = '#5d5345'; context.lineWidth = .5; context.beginPath(); context.moveTo(44, footerY); context.lineTo(496, footerY); context.stroke();
      context.font = '10px "Noto Sans SC", sans-serif'; context.fillStyle = '#aa8b78';
      context.fillText(draft.kind === 'lyrics' ? '歌词摘录' : '访谈书摘', 44, footerY + 25);
      context.font = metaFont; context.fillStyle = '#d0c5b5';
      titleLines.forEach((line, index) => context.fillText(line, 44, footerY + 50 + index * 23));
      const infoY = footerY + 50 + titleLines.length * 23;
      context.font = '11px "Noto Sans SC", sans-serif'; context.fillStyle = '#938a7d';
      peopleLines.forEach((line, index) => context.fillText(line, 44, infoY + 9 + index * 19));
      if (date) context.fillText(date, 44, infoY + peopleLines.length * 19 + 29);
      if (qr) drawQr(context, qr, 412, infoY - 4);
      context.font = '12px "Noto Sans SC", sans-serif'; context.fillStyle = '#b6a88d'; context.fillText('唯鸡百科', 44, height - 53);
      context.font = '9px "Space Grotesk", sans-serif'; context.fillStyle = '#797369';
      context.fillText(url ? new URL(url).host + ' / ' + (qr ? '扫码阅读全文' : '摘录分享') : '摘录分享', 44, height - 36);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('图片生成失败，请重试');
      if (id !== renderId || !dialog.open) return;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentBlob = blob; currentUrl = URL.createObjectURL(blob);
      $('preview').src = currentUrl; $('preview').hidden = false; $('loading').hidden = true;
      $('size').textContent = canvas.width + ' × ' + canvas.height + ' PNG';
      $('error').textContent = '';
      $('save').disabled = false;
    } catch (error) {
      if (id !== renderId) return;
      $('error').textContent = error.message || '生成失败，请重试';
      $('loading').hidden = true;
    }
  }
  function drawQr(context, qr, x, y) {
    const pixels = Math.max(1, Math.floor(168 / (qr.size + 8)));
    const unit = pixels / 2;
    context.fillStyle = '#f4f1e9'; context.fillRect(x, y, (qr.size + 8) * unit, (qr.size + 8) * unit);
    context.fillStyle = '#151515';
    for (let row = 0; row < qr.size; row++) for (let col = 0; col < qr.size; col++) {
      if (qr.getModule(col, row)) context.fillRect(x + (col + 4) * unit, y + (row + 4) * unit, unit, unit);
    }
  }
  function saveImage() {
    if (!currentBlob) return;
    const link = document.createElement('a');
    link.href = currentUrl;
    link.download = ($('title').value.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 60) || '唯鸡百科') + '-摘录.png';
    document.body.appendChild(link); link.click(); link.remove();
  }
  global.ExcerptCard = { registerSource, open, pageUrl };
})(window);
