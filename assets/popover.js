/* Notes and glossary definitions. The link still works if this file fails. */
(function () {
  var root = document.body.dataset.root || "";
  var build = document.body.dataset.build || "";
  var wide = window.matchMedia("(min-width: 800px)");
  var layer = null;
  var lastFocus = null;
  var armed = false;
  var glossary = null;
  var glossaryLoad = null;

  function loadGlossary() {
    if (glossary) return Promise.resolve(glossary);
    if (!glossaryLoad) {
      var url = root + "assets/glosario.json" + (build ? "?v=" + encodeURIComponent(build) : "");
      glossaryLoad = fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error("glosario");
          return response.json();
        })
        .then(function (rows) {
          glossary = {};
          rows.forEach(function (row) { glossary[row.id] = row; });
          return glossary;
        });
    }
    return glossaryLoad;
  }

  function ensure() {
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "popover";
    layer.hidden = true;
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    document.body.appendChild(layer);
    return layer;
  }

  function close() {
    if (!layer || layer.hidden) return;
    armed = false;
    layer.hidden = true;
    layer.innerHTML = "";
    document.body.classList.remove("popover-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function place(anchor) {
    if (!wide.matches) {
      layer.style.left = "";
      layer.style.top = "";
      layer.style.right = "";
      layer.classList.add("sheet");
      return;
    }
    layer.classList.remove("sheet");
    var rect = anchor.getBoundingClientRect();
    var width = Math.min(360, window.innerWidth - 24);
    var left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    layer.style.width = width + "px";
    layer.hidden = false;
    var height = layer.offsetHeight;
    var below = rect.bottom + 8;
    var top = below + height > window.innerHeight - 12 ? Math.max(12, rect.top - height - 8) : below;
    layer.style.left = left + "px";
    layer.style.top = top + "px";
  }

  function open(anchor, title, body, extraHref, extraLabel) {
    lastFocus = anchor;
    var box = ensure();
    box.classList.toggle("sheet", !wide.matches);
    box.innerHTML = "";
    box.removeAttribute("style");
    var head = document.createElement("div");
    head.className = "popover-head";
    var heading = document.createElement("p");
    heading.id = "popover-titulo";
    heading.textContent = title;
    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "icon-button";
    closeButton.setAttribute("aria-label", "Cerrar");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", close);
    head.append(heading, closeButton);
    var text = document.createElement("div");
    text.className = "popover-body";
    text.appendChild(body);
    box.append(head, text);
    if (extraHref) {
      var more = document.createElement("a");
      more.href = extraHref;
      more.textContent = extraLabel;
      box.appendChild(more);
    }
    box.setAttribute("aria-labelledby", "popover-titulo");
    box.hidden = false;
    document.body.classList.add("popover-open");
    armed = false;
    place(anchor);
    closeButton.focus();
    window.requestAnimationFrame(function () { armed = true; });
  }

  function noteBody(id) {
    var note = document.getElementById(id);
    if (!note) return null;
    var clone = note.cloneNode(true);
    clone.querySelectorAll("a.footnote-back").forEach(function (link) { link.remove(); });
    var wrap = document.createElement("div");
    while (clone.firstChild) wrap.appendChild(clone.firstChild);
    return wrap;
  }

  document.addEventListener("click", function (event) {
    var noteLink = event.target.closest("a.footnote-ref");
    if (noteLink) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var id = (noteLink.getAttribute("href") || "").replace(/^.*#/, "");
      var body = noteBody(id);
      if (!body) return;
      event.preventDefault();
      var number = noteLink.textContent.replace(/\s+/g, " ").trim();
      open(noteLink, "Nota " + number, body, noteLink.getAttribute("href"), "Ir a la nota");
      return;
    }
    var termLink = event.target.closest("a.termino");
    if (!termLink) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var href = termLink.getAttribute("href") || "";
    var slug = href.split("#")[1] || "";
    if (!slug) return;
    event.preventDefault();
    loadGlossary().then(function (rows) {
      var entry = rows[slug];
      if (!entry) {
        window.location.href = href;
        return;
      }
      var paragraph = document.createElement("p");
      paragraph.textContent = entry.definition;
      open(termLink, entry.term, paragraph, href, "Ver entrada completa");
    }).catch(function () {
      window.location.href = href;
    });
  });

  document.addEventListener("keydown", function (event) {
    if (!layer || layer.hidden) return;
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab") return;
    var nodes = layer.querySelectorAll("button, a");
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
  document.addEventListener("click", function (event) {
    if (!armed || !layer || layer.hidden) return;
    if (event.target === layer || layer.contains(event.target)) return;
    if (event.target.closest("a.footnote-ref, a.termino")) return;
    close();
  });
  window.addEventListener("resize", function () {
    if (layer && !layer.hidden && lastFocus) place(lastFocus);
  });

  var glossaryFilter = document.getElementById("glosario-filtro");
  if (glossaryFilter) {
    function fold(text) {
      return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }
    glossaryFilter.addEventListener("input", function () {
      var query = fold(glossaryFilter.value.trim());
      var entries = document.querySelectorAll("article.entry");
      entries.forEach(function (entry) {
        var haystack = fold(entry.textContent || "");
        entry.hidden = query.length > 0 && haystack.indexOf(query) < 0;
      });
      document.querySelectorAll("h2.letter").forEach(function (letter) {
        var visible = false;
        var node = letter.nextElementSibling;
        while (node && !node.classList.contains("letter")) {
          if (node.classList.contains("entry") && !node.hidden) visible = true;
          node = node.nextElementSibling;
        }
        letter.hidden = query.length > 0 && !visible;
      });
    });
  }
})();
