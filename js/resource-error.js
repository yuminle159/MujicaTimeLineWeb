(function () {
  "use strict";
  window.addEventListener("error", function (event) {
    const target = event.target;
    if (!target || target.tagName !== "SCRIPT" || !target.src || target.async) return;
    if (document.getElementById("pageResourceError")) return;
    const status = document.createElement("div");
    status.id = "pageResourceError";
    status.setAttribute("role", "alert");
    status.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100001;max-width:calc(100vw - 32px);padding:14px 18px;background:#24202b;color:#fff;border-radius:10px;box-shadow:0 8px 28px #0006";
    status.textContent = "页面资料载入失败，请检查网络后重试。 ";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "重试";
    button.style.cssText = "margin-left:8px;color:inherit;background:transparent;border:1px solid currentColor;border-radius:4px;cursor:pointer";
    button.addEventListener("click", function () { location.reload(); });
    status.appendChild(button);
    document.body.appendChild(status);
  }, true);
})();
