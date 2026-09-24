(function (global) {
  "use strict";

  const ownScript = document.currentScript;
  const siteRoot = new URL("../", ownScript.src);
  const version = new URL(ownScript.src).search;
  const modules = {
    songs: { path: "songs/data.js", globalName: "songsData" },
    live: { path: "live/data.js", globalName: "livesData" },
    interview: { path: "interview/data.js", globalName: "interviewData" },
    discography: { path: "discography/data.js", globalName: "discographyData" },
    timeline: { path: "timeline/data.js", globalName: "timelineData" },
    gallery: { path: "gallery/data.js", globalName: "galleryData" }
  };
  const pending = {};

  function definition(name) {
    const item = modules[name];
    if (!item) throw new Error("未知数据模块：" + name);
    return item;
  }

  function get(name) {
    return global[definition(name).globalName];
  }

  function loadOne(name) {
    const item = definition(name);
    if (Array.isArray(global[item.globalName])) return Promise.resolve(global[item.globalName]);
    if (pending[name]) return pending[name];

    pending[name] = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      const url = new URL(item.path, siteRoot);
      url.search = version;
      script.src = url.href;
      script.async = true;
      script.dataset.dataModule = name;
      script.addEventListener("load", function () {
        if (Array.isArray(global[item.globalName])) resolve(global[item.globalName]);
        else {
          delete pending[name];
          reject(new Error(name + " 数据文件未导出 " + item.globalName));
        }
      }, { once: true });
      script.addEventListener("error", function () {
        delete pending[name];
        reject(new Error("无法载入 " + item.path));
      }, { once: true });
      document.head.appendChild(script);
    });
    return pending[name];
  }

  function load(names) {
    const requested = Array.isArray(names) ? names : [names];
    return Promise.all(requested.map(loadOne)).then(function (values) {
      return requested.reduce(function (result, name, index) {
        result[name] = values[index];
        return result;
      }, {});
    });
  }

  function loadRelated(names, onReady) {
    function attempt() {
      load(names).then(function (data) {
        if (notice) notice.remove();
        notice = null;
        onReady(data);
      }).catch(function (error) {
        console.error(error);
        if (!notice) {
          notice = document.createElement("div");
          notice.setAttribute("role", "status");
          notice.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100000;background:#24202b;color:white;padding:12px 16px;border-radius:8px;box-shadow:0 8px 28px #0005";
          document.body.appendChild(notice);
        }
        notice.textContent = "关联资料载入失败，主内容仍可浏览。 ";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "重试";
        retry.style.cssText = "margin-left:8px;color:inherit;background:transparent;border:1px solid currentColor;border-radius:4px;cursor:pointer";
        retry.addEventListener("click", attempt, { once: true });
        notice.appendChild(retry);
      });
    }
    let notice = null;
    window.setTimeout(attempt, 350);
  }

  global.WijipediaData = {
    get: get,
    load: load,
    loadRelated: loadRelated,
    isLoaded: function (name) { return Array.isArray(get(name)); }
  };
})(window);
