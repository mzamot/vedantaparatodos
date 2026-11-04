/* Hierarchical contents. Chapter pages stay readable if this file fails. */
(function () {
  var menu = document.getElementById("menu");
  var toggle = document.getElementById("abrir-menu");
  var backdrop = document.getElementById("fondo-menu");
  if (!menu) return;

  var root = document.body.dataset.root || "";
  var current = document.body.dataset.href || "";
  var wide = window.matchMedia("(min-width: 800px)");

  function desktopHidden() {
    return document.documentElement.classList.contains("nav-hidden");
  }

  var lockY = 0;

  function labelToggle() {
    if (!toggle) return;
    var open = wide.matches ? !desktopHidden() : document.body.classList.contains("menu-open");
    var label = wide.matches
      ? (open ? "Ocultar índice lateral" : "Mostrar índice lateral")
      : (open ? "Cerrar índice" : "Abrir índice");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }

  function persistNav(shown) {
    if (window.KathamritaPrefs) {
      window.KathamritaPrefs.update({ nav: shown });
    } else {
      try {
        var key = "kathamrita-preferencias";
        var prefs = JSON.parse(localStorage.getItem(key) || "{}") || {};
        prefs.nav = shown;
        localStorage.setItem(key, JSON.stringify(prefs));
      } catch (error) { /* storage off */ }
    }
    var box = document.getElementById("pref-menu");
    if (box) box.checked = shown;
    document.dispatchEvent(new CustomEvent("kathamrita-nav", { detail: shown }));
  }

  function lockPage(open) {
    if (open) {
      lockY = window.scrollY;
      document.body.style.top = "-" + lockY + "px";
      document.body.classList.add("drawer-lock");
      var main = document.getElementById("contenido");
      if (main) main.inert = true;
      return;
    }
    document.body.classList.remove("drawer-lock");
    document.body.style.top = "";
    var page = document.getElementById("contenido");
    if (page) page.inert = false;
    window.scrollTo(0, lockY);
  }

  function setDrawer(open) {
    var was = document.body.classList.contains("menu-open");
    document.body.classList.toggle("menu-open", open);
    if (!wide.matches) lockPage(open);
    labelToggle();
    if (open) {
      var first = menu.querySelector("a, button");
      if (first) first.focus();
      return;
    }
    if (was && toggle) toggle.focus();
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      if (wide.matches) {
        var hidden = document.documentElement.classList.toggle("nav-hidden");
        persistNav(!hidden);
        labelToggle();
        return;
      }
      setDrawer(!document.body.classList.contains("menu-open"));
    });
  }
  if (backdrop) backdrop.addEventListener("click", function () { setDrawer(false); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.body.classList.contains("menu-open")) {
      setDrawer(false);
      return;
    }
    if (event.key !== "Tab" || wide.matches || !document.body.classList.contains("menu-open")) return;
    var nodes = menu.querySelectorAll("a, button");
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  wide.addEventListener("change", function () {
    document.body.classList.remove("menu-open");
    labelToggle();
  });
  document.addEventListener("kathamrita-prefs", labelToggle);
  menu.addEventListener("click", function (event) {
    if (!wide.matches && event.target.closest("a")) setDrawer(false);
  });

  function contains(node) {
    if (node.href === current) return true;
    return (node.children || []).some(contains);
  }

  var treeSeq = 0;

  function chevron() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M9 6l6 6-6 6");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function twist(label, open, controls) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "twist";
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-controls", controls);
    button.setAttribute("aria-label", (open ? "Ocultar " : "Mostrar ") + label);
    button.appendChild(chevron());
    return button;
  }

  function themeList(node) {
    var themes = document.createElement("ol");
    themes.className = "themes";
    node.themes.forEach(function (theme) {
      var item = document.createElement("li");
      var themeLink = document.createElement("a");
      themeLink.href = root + node.href + "#" + theme.id;
      themeLink.textContent = theme.title;
      item.appendChild(themeLink);
      themes.appendChild(item);
    });
    return themes;
  }

  function bindTwist(button, list, label) {
    button.addEventListener("click", function () {
      var next = list.hidden;
      list.hidden = !next;
      button.setAttribute("aria-expanded", next ? "true" : "false");
      button.setAttribute("aria-label", (next ? "Ocultar " : "Mostrar ") + label);
    });
  }

  function render(nodes) {
    var ol = document.createElement("ol");
    nodes.forEach(function (node) {
      var li = document.createElement("li");
      var row = document.createElement("div");
      row.className = "row";
      var kids = node.children || [];
      var themes = node.themes || [];
      var childList = null;
      var headings = null;
      if (kids.length) {
        var open = contains(node);
        var listId = "nav-" + (++treeSeq);
        childList = render(kids);
        childList.id = listId;
        childList.hidden = !open;
        var button = twist(node.title, open, listId);
        bindTwist(button, childList, node.title);
        row.appendChild(button);
      } else if (themes.length) {
        var themeOpen = node.href === current;
        var themeId = "nav-" + (++treeSeq);
        var themeLabel = "los encabezados de " + node.title;
        headings = themeList(node);
        headings.id = themeId;
        headings.hidden = !themeOpen;
        var themeButton = twist(themeLabel, themeOpen, themeId);
        bindTwist(themeButton, headings, themeLabel);
        row.appendChild(themeButton);
      } else {
        var spacer = document.createElement("span");
        spacer.className = "twist twist-spacer";
        spacer.setAttribute("aria-hidden", "true");
        row.appendChild(spacer);
      }
      var link = document.createElement("a");
      link.href = root + node.href;
      link.textContent = node.title;
      if (node.href === current) {
        link.setAttribute("aria-current", "page");
        li.classList.add("is-current");
      }
      row.appendChild(link);
      li.appendChild(row);
      if (childList) li.appendChild(childList);
      if (headings) li.appendChild(headings);
      ol.appendChild(li);
    });
    return ol;
  }

  function markTheme() {
    var links = menu.querySelectorAll(".themes a");
    if (!links.length) return;
    var line = 120;
    var best = null;
    for (var i = 0; i < links.length; i++) {
      var id = (links[i].getAttribute("href") || "").split("#")[1];
      var node = id && document.getElementById(id);
      if (!node) continue;
      if (node.getBoundingClientRect().top <= line) best = links[i];
    }
    for (var j = 0; j < links.length; j++) {
      if (links[j] === best) links[j].setAttribute("aria-current", "location");
      else if (links[j].getAttribute("aria-current") === "location") links[j].removeAttribute("aria-current");
    }
  }

  function show(data) {
    var built = render(data);
    built.setAttribute("aria-label", "Volúmenes, secciones y capítulos");
    var fallback = document.getElementById("menu-simple");
    if (fallback) fallback.hidden = true;
    menu.querySelector(".menu-inner").appendChild(built);
    markTheme();
    if (current) {
      var here = menu.querySelector('[aria-current="page"]');
      if (here && here.scrollIntoView) here.scrollIntoView({ block: "nearest" });
    }
  }

  labelToggle();

  var header = document.querySelector(".top");
  var lastY = window.scrollY;
  window.addEventListener("scroll", function () {
    if (!header) return;
    var y = window.scrollY;
    var prefsOpen = document.querySelector(".prefs[open]");
    var locked = document.body.classList.contains("menu-open") || prefsOpen;
    if (locked || y < 48 || y < lastY - 6) header.classList.remove("top-away");
    else if (y > lastY + 10) header.classList.add("top-away");
    lastY = y;
    markTheme();
  }, { passive: true });

  var build = document.body.dataset.build || "";
  var cacheKey = "kathamrita-nav-" + build;

  function recall() {
    try {
      var raw = sessionStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function remember(data) {
    try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); }
    catch (error) { /* unavailable or full; reading progress is left untouched */ }
  }

  function covers(data) {
    if (!current || current === "index.html") return Array.isArray(data);
    var stack = Array.isArray(data) ? data.slice() : [];
    while (stack.length) {
      var node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (node.href === current) return true;
      if (node.children) stack.push.apply(stack, node.children);
    }
    return false;
  }

  var cached = recall();
  if (cached) {
    try {
      if (covers(cached)) {
        show(cached);
        return;
      }
    } catch (error) { /* the stored index is unusable */ }
  }
  var navUrl = root + "assets/nav.json" + (build ? "?v=" + encodeURIComponent(build) : "");
  fetch(navUrl)
    .then(function (response) { if (!response.ok) throw new Error("nav"); return response.json(); })
    .then(function (data) {
      if (!covers(data)) throw new Error("nav");
      remember(data);
      show(data);
    })
    .catch(function () { /* the plain volume list stays */ });
})();
