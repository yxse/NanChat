// Logic for the custom in-app browser title bar.
// The current page URL and the host window label are injected by Rust via an
// initialization script as `window.__BROWSER_URL__` / `window.__WINDOW_LABEL__`.
// The custom button opens that URL in the user's system browser, and the window
// control buttons drive the (decoration-less) host window.
(function () {
  "use strict";

  var invoke =
    window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;

  var currentUrl = window.__BROWSER_URL__ || "";
  var windowLabel = window.__WINDOW_LABEL__ || "";

  function hostnameOrUrl(url) {
    try { return new URL(url).hostname || url; } catch (_) { return url; }
  }

  var urlEl = document.getElementById("url");
  if (urlEl) urlEl.textContent = window.__BROWSER_TITLE__ || hostnameOrUrl(currentUrl);

  // Rust pushes URL updates by calling this global (via webview.eval) whenever
  // the content webview navigates (real loads + SPA history changes). This is
  // more reliable than the Tauri event system for cross-webview updates.
  window.__setBrowserUrl = function (url) {
    if (!url) return;
    currentUrl = url;
    if (urlEl) urlEl.textContent = window.__BROWSER_TITLE__ || hostnameOrUrl(url);
  };

  function winInvoke(cmd) {
    if (!invoke) return Promise.resolve();
    return invoke("plugin:window|" + cmd, { label: windowLabel }).catch(
      function (err) {
        console.error("[browser-toolbar] " + cmd + " failed", err);
      }
    );
  }

  var actionBtn = document.getElementById("action");
  if (actionBtn) {
    actionBtn.addEventListener("click", function () {
      if (!invoke) return;
      // Notify the main app window so it can open the share popup
      // (setVisible(true) in Discover). The toolbar runs in an isolated
      // webview, so we cross over via a Tauri event.
      invoke("plugin:event|emit", {
        event: "browser-share",
        payload: currentUrl,
      }).catch(function (err) {
        console.error("[browser-toolbar] failed to emit share event", err);
      });
    });
  }

  var minBtn = document.getElementById("min");
  if (minBtn) {
    minBtn.addEventListener("click", function () {
      winInvoke("minimize");
    });
  }

  var maxBtn = document.getElementById("max");
  if (maxBtn) {
    maxBtn.addEventListener("click", function () {
      winInvoke("toggle_maximize");
    });
  }

  var closeBtn = document.getElementById("close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      winInvoke("close");
    });
  }
})();
