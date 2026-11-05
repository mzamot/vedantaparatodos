/* Reading position and preferences. Stored only in this browser. */
(function () {
  var READ = "kathamrita-lectura";
  var PREF = "kathamrita-preferencias";
  var root = document.body.dataset.root || "";
  var href = document.body.dataset.href || "";
  var place = document.body.dataset.place || "";
  var title = document.body.dataset.title || "";
  var reading = document.body.dataset.reading === "chapter";
  var prefs = { scale: 1, leading: 1.6, theme: "", nav: true };
  var anchor = null;
  var timer = 0;
  var allowSave = true;
  var userMoved = false;
  var explicit = false;
  var programmatic = 0;
  var ready = false;
  var baseY = 0;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function storageOn() {
    try {
      var key = "kathamrita-probe";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }
  var canStore = storageOn();

  function readJSON(key) {
    if (!canStore) return null;
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch (error) { return null; }
  }
  function writeJSON(key, value) {
    if (!canStore) return;
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { /* full or blocked */ }
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function applyPrefs() {
    var html = document.documentElement;
    html.style.setProperty("--scale", String(prefs.scale));
    html.style.setProperty("--leading", String(prefs.leading));
    if (prefs.theme) html.dataset.theme = prefs.theme;
    else delete html.dataset.theme;
    html.classList.toggle("nav-hidden", prefs.nav === false);
    document.querySelectorAll("button[data-theme]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.theme === (prefs.theme || "") ? "true" : "false");
    });
    var menuBox = document.getElementById("pref-menu");
    if (menuBox) menuBox.checked = prefs.nav !== false;
    document.dispatchEvent(new Event("kathamrita-prefs"));
  }

  function livePrefs() {
    return window.KathamritaPrefs ? window.KathamritaPrefs.get() : prefs;
  }
  function commitPrefs(next) {
    if (window.KathamritaPrefs) {
      window.KathamritaPrefs.update(next);
      prefs = window.KathamritaPrefs.get();
      return;
    }
    prefs = next;
    writeJSON(PREF, prefs);
    applyPrefs();
  }

  if (window.KathamritaPrefs) {
    prefs = window.KathamritaPrefs.get();
  } else {
    var storedPrefs = readJSON(PREF);
    if (storedPrefs) {
      if (typeof storedPrefs.scale === "number") prefs.scale = clamp(storedPrefs.scale, 0.85, 1.4);
      if (typeof storedPrefs.leading === "number") prefs.leading = clamp(storedPrefs.leading, 1.45, 1.9);
      if (typeof storedPrefs.theme === "string") prefs.theme = storedPrefs.theme;
      if (typeof storedPrefs.nav === "boolean") prefs.nav = storedPrefs.nav;
    }
    applyPrefs();
  }

  function currentBlock() {
    var nodes = document.querySelectorAll("[data-block]");
    if (!nodes.length) return null;
    var line = 96;
    var best = nodes[0];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getBoundingClientRect().top <= line) best = nodes[i];
      else break;
    }
    var rect = best.getBoundingClientRect();
    var ratio = rect.height > 0 ? clamp((line - rect.top) / rect.height, 0, 1) : 0;
    return { id: best.getAttribute("data-block"), ratio: Math.round(ratio * 1000) / 1000 };
  }

  function chapterProgress() {
    var article = document.querySelector("article");
    if (!article || !reading) return 0;
    var start = article.offsetTop;
    var span = article.offsetHeight - window.innerHeight;
    if (span <= 0) return 100;
    return clamp((window.scrollY - start) / span * 100, 0, 100);
  }

  function paintBar(value) {
    var bar = document.querySelector(".progress > span");
    var meter = document.querySelector(".progress");
    if (!bar) return;
    var shown = Math.round(value);
    bar.style.width = shown + "%";
    if (meter) meter.setAttribute("aria-valuenow", String(shown));
  }

  function loadStore() {
    var raw = readJSON(READ);
    if (!raw || typeof raw !== "object") return { current: null, chapters: {} };
    if (raw.href && !raw.chapters) {
      var chapters = {};
      chapters[raw.href] = raw;
      return { current: raw, chapters: chapters };
    }
    return { current: raw.current || null, chapters: raw.chapters || {} };
  }

  function saveReading() {
    if (!allowSave || !reading) return;
    var block = currentBlock();
    if (!block) return;
    var progress = Math.round(chapterProgress());
    paintBar(progress);
    anchor = block;
    var record = {
      href: href,
      block: block.id,
      ratio: block.ratio,
      progress: progress,
      place: place,
      title: title,
      updated: new Date().toISOString()
    };
    var store = loadStore();
    var previous = store.chapters[href];
    var engaged = userMoved || explicit || progress > 8;
    if (!engaged && previous) return;
    if (!engaged && progress <= 2) return;
    store.chapters[href] = record;
    if (engaged) store.current = record;
    writeJSON(READ, store);
  }

  function schedule() {
    paintBar(chapterProgress());
    window.clearTimeout(timer);
    timer = window.setTimeout(saveReading, 800);
  }

  function markProgrammatic() {
    programmatic += 1;
    window.setTimeout(function () { programmatic = Math.max(0, programmatic - 1); }, 500);
  }

  function restore(data) {
    var id = data && (data.block || data.id);
    if (!id) return false;
    var node = document.getElementById(id);
    if (!node) return false;
    var top = node.getBoundingClientRect().top + window.scrollY;
    var y = top + (data.ratio || 0) * node.offsetHeight - 96;
    markProgrammatic();
    window.scrollTo(0, Math.max(0, y));
    anchor = { id: id, ratio: data.ratio || 0 };
    return true;
  }

  function reanchor() {
    if (!anchor) return;
    restore(anchor);
    window.requestAnimationFrame(function () { restore(anchor); });
  }

  function hideBanner() {
    var banner = document.getElementById("reanudar");
    if (banner) banner.hidden = true;
  }

  function flush() {
    window.clearTimeout(timer);
    saveReading();
  }

  document.addEventListener("kathamrita-nav", function (event) {
    prefs.nav = event.detail !== false;
  });
  function onScroll() {
    if (!ready || programmatic) {
      paintBar(chapterProgress());
      return;
    }
    if (!userMoved && Math.abs(window.scrollY - baseY) > 32) {
      userMoved = true;
      allowSave = true;
      hideBanner();
    }
    if (allowSave) schedule();
    else paintBar(chapterProgress());
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);

  var store = loadStore();
  var saved = (store.chapters && store.chapters[href]) || null;
  if (!saved && store.current && store.current.href === href) saved = store.current;
  var params = new URLSearchParams(location.search);
  if (reading && params.get("continuar") === "1" && saved && saved.href === href) {
    explicit = true;
    restore(saved);
    params.delete("continuar");
    var clean = location.pathname + (params.toString() ? "?" + params.toString() : "") + location.hash;
    history.replaceState(null, "", clean);
  } else if (reading && saved && saved.href === href && saved.progress > 8 && saved.progress < 97) {
    var slot = document.getElementById("reanudar");
    if (slot) {
      slot.className = "resume";
      slot.hidden = false;
      slot.textContent = "";
      var text = document.createElement("span");
      text.textContent = "Progreso guardado · " + Math.round(saved.progress) + " % — ";
      var go = document.createElement("button");
      go.type = "button";
      go.textContent = "Retomar";
      go.addEventListener("click", function () {
        explicit = true;
        restore(saved);
        hideBanner();
        saveReading();
      });
      slot.append(text, go);
    }
  }

  var home = document.getElementById("continuar");
  var latest = store.current;
  if (home && latest && latest.href) {
    home.hidden = false;
    var link = home.querySelector("a") || document.createElement("a");
    link.href = root + latest.href + "?continuar=1";
    if (!link.parentNode) home.appendChild(link);
    var placeNode = home.querySelector(".continue-place");
    var progressNode = home.querySelector(".continue-progress");
    if (placeNode) {
      placeNode.textContent = latest.place || "";
      if (progressNode && typeof latest.progress === "number") {
        progressNode.textContent = latest.progress + "% del capítulo";
      }
      link.textContent = "Continuar leyendo";
    } else {
      link.textContent = "Continuar leyendo — " + (latest.place || latest.title || "el capítulo");
    }
  }
  document.querySelectorAll("[data-chapters]").forEach(function (item) {
    var hrefs = (item.getAttribute("data-chapters") || "").split(/\s+/).filter(Boolean);
    var known = hrefs.filter(function (itemHref) { return store.chapters && store.chapters[itemHref]; });
    var slot = item.querySelector(".volume-progress");
    if (!slot || !known.length) return;
    var sum = 0;
    hrefs.forEach(function (itemHref) {
      var record = store.chapters[itemHref];
      if (record && typeof record.progress === "number") sum += record.progress;
    });
    var percent = Math.round(sum / hrefs.length);
    if (percent < 1) return;
    slot.hidden = false;
    slot.textContent = percent + "% leído";
  });

  document.querySelectorAll("[data-size]").forEach(function (button) {
    button.addEventListener("click", function () {
      anchor = currentBlock() || anchor;
      var now = livePrefs();
      now.scale = clamp(Math.round((now.scale + Number(button.dataset.size) * 0.05) * 100) / 100, 0.85, 1.4);
      commitPrefs(now);
      reanchor();
    });
  });
  document.querySelectorAll("[data-lead]").forEach(function (button) {
    button.addEventListener("click", function () {
      anchor = currentBlock() || anchor;
      var now = livePrefs();
      now.leading = clamp(Math.round((now.leading + Number(button.dataset.lead) * 0.05) * 100) / 100, 1.45, 1.9);
      commitPrefs(now);
      reanchor();
    });
  });
  document.querySelectorAll("button[data-theme]").forEach(function (button) {
    button.addEventListener("click", function () {
      var now = livePrefs();
      now.theme = button.dataset.theme || "";
      commitPrefs(now);
    });
  });
  var resetPrefs = document.getElementById("pref-reset");
  if (resetPrefs) {
    resetPrefs.addEventListener("click", function () {
      var now = livePrefs();
      now.scale = 1;
      now.leading = 1.6;
      commitPrefs(now);
      reanchor();
    });
  }
  var menuBox = document.getElementById("pref-menu");
  if (menuBox) {
    menuBox.addEventListener("change", function () {
      var now = livePrefs();
      now.nav = menuBox.checked;
      commitPrefs(now);
    });
  }
  document.addEventListener("kathamrita-prefs", function () {
    if (window.KathamritaPrefs) prefs = window.KathamritaPrefs.get();
  });

  baseY = window.scrollY;
  ready = true;
  paintBar(chapterProgress());
})();
