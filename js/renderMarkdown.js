/**
 * 统一 Markdown 标签渲染器
 * 用于处理 Python render_md_to_html 预渲染后的 HTML，应用项目自定义标签。
 *
 * 支持标签：
 *   [original]...[/original] → 原文标记（浅灰小字，可被"隐藏原文"按钮控制）
 *   [c1]~[c12]...[/cN]        → 自定义颜色
 *   [br]                       → 空行
 *   [translation]              → 中日双栏分列标记（MC 模式专用）
 *
 * @param {string} html - 预渲染后的 HTML 字符串
 * @param {object} [options] - 可选配置
 * @param {string} [options.mode] - 模式: 'mc'（MC 双栏）或 'default'（默认）
 * @returns {string} 处理后的 HTML
 */
function renderMarkdown(html, options) {
  if (!html) return "";
  const mode = (options && options.mode) || "default";

  // 1. 归一化：移除包裹标签的独立 <p> 标签
  //    （当 md 中标签前后有空行时，render_md_to_html 会将其包入独立 <p>，
  //     导致后续正则替换产生无效 HTML，使样式失效）
  html = html.replace(/<p>\[original\]<\/p>/g, '[original]');
  html = html.replace(/<p>\[\/original\]<\/p>/g, '[/original]');
  html = html.replace(/<p>\[translation\]<\/p>/g, '[translation]');

  // 2. [original]...[/original] → 原文标记
  html = html.replace(/\[original\]([\s\S]*?)\[\/original\]/g, '<span class="md-original">$1</span>');

  // 3. [c1]~[c10] 自定义颜色
  html = html.replace(/\[c(\d+)\](.+?)\[\/c\1\]/g, '<span class="mc-c$1">$2</span>');

  // 4. [br] 空行
  html = html.replace(/\[br\]/g, '<br>');

  // 5. [translation] 中日双栏分列（仅 MC 模式）
  if (mode === "mc") {
    const parts = html.split("[translation]");
    const jp = parts[0] || "";
    const cn = parts.slice(1).join("[translation]") || "";
    if (cn.trim()) {
      return '<div class="mc-columns"><div class="mc-col mc-col-jp">' + jp + '</div><div class="mc-col mc-col-cn">' + cn + '</div></div>';
    }
    return jp;
  }

  return html;
}