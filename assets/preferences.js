/* One store for theme, type size, leading and the side index.
   The key is global for this origin. file:// gives each file its own
   origin in several browsers, so a preference set there does not travel
   from one chapter to another. Serve the site over HTTP. */
(function (global) {
  var KEY = "kathamrita-preferencias";
  var defaults = { scale: 1, leading: 1.6, theme: "", nav: true };

  function storageOn() {
    try {
      var probe = "kathamrita-probe";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sanitize(raw) {
    var prefs = {
      scale: defaults.scale,
      leading: defaults.leading,
      theme: defaults.theme,
      nav: defaults.nav
    };
    if (!raw || typeof raw !== "object") return prefs;
    if (typeof raw.scale === "number") prefs.scale = clamp(raw.scale, 0.85, 1.4);
    if (typeof raw.leading === "number") prefs.leading = clamp(raw.leading, 1.45, 1.9);
    if (raw.theme === "light" || raw.theme === "dark" || raw.theme === "sepia" || raw.theme === "") {
      prefs.theme = raw.theme;
    }
    if (typeof raw.nav === "boolean") prefs.nav = raw.nav;
    return prefs;
  }

  function read() {
    if (!storageOn()) return sanitize(null);
    try { return sanitize(JSON.parse(localStorage.getItem(KEY) || "null")); }
    catch (error) { return sanitize(null); }
  }

  function write(prefs) {
    if (!storageOn()) return;
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); }
    catch (error) { /* full or blocked; reading still works */ }
  }

  function paint(prefs) {
    var html = document.documentElement;
    html.style.setProperty("--scale", String(prefs.scale));
    html.style.setProperty("--leading", String(prefs.leading));
    if (prefs.theme) html.dataset.theme = prefs.theme;
    else delete html.dataset.theme;
    html.classList.toggle("nav-hidden", prefs.nav === false);
    document.querySelectorAll("button[data-theme]").forEach(function (button) {
      var selected = (button.dataset.theme || "") === prefs.theme;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    var menuBox = document.getElementById("pref-menu");
    if (menuBox) menuBox.checked = prefs.nav !== false;
    var size = document.getElementById("pref-size");
    if (size) size.textContent = Math.round(prefs.scale * 100) + "%";
    var leading = document.getElementById("pref-leading");
    if (leading) leading.textContent = prefs.leading.toFixed(2).replace(".", ",");
  }

  var current = read();
  paint(current);
  document.addEventListener("DOMContentLoaded", function () { paint(current); });

  function update(partial) {
    current = sanitize(Object.assign({}, current, partial));
    write(current);
    paint(current);
    document.dispatchEvent(new CustomEvent("kathamrita-prefs", { detail: current }));
  }

  global.addEventListener("storage", function (event) {
    if (event.key !== KEY) return;
    current = read();
    paint(current);
    document.dispatchEvent(new CustomEvent("kathamrita-prefs", { detail: current }));
  });

  global.KathamritaPrefs = {
    key: KEY,
    get: function () { return Object.assign({}, current); },
    update: update
  };
})(window);
