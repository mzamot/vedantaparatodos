/* Loads the search index only after the reader asks for a search. */
(function () {
  var form = document.getElementById("buscar-forma");
  var input = document.getElementById("buscar-texto");
  var out = document.getElementById("buscar-resultado");
  var status = document.getElementById("buscar-estado");
  if (!form || !input || !out) return;

  var index = null;
  var loading = null;

  function foldChar(ch) {
    return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function folded(text) {
    var parts = [];
    var starts = [];
    var cursor = 0;
    var chars = Array.from(text);
    for (var i = 0; i < chars.length; i++) {
      var piece = foldChar(chars[i]);
      starts.push(cursor);
      parts.push(piece);
      cursor += piece.length;
    }
    return { text: parts.join(""), starts: starts, chars: chars };
  }

  function startChar(map, foldAt) {
    var indexAt = 0;
    for (var i = 0; i < map.starts.length; i++) {
      if (map.starts[i] <= foldAt) indexAt = i;
      else break;
    }
    return indexAt;
  }

  function endChar(map, foldAt) {
    for (var i = 0; i < map.starts.length; i++) {
      if (map.starts[i] >= foldAt) return i;
    }
    return map.chars.length;
  }

  function snippet(text, query) {
    var map = folded(text);
    var at = map.text.indexOf(query);
    if (at < 0) return null;
    var from = startChar(map, at);
    var to = endChar(map, at + query.length);
    var rawFrom = startChar(map, Math.max(0, at - 70));
    var rawTo = endChar(map, at + query.length + 70);
    return {
      before: map.chars.slice(rawFrom, from).join(""),
      hit: map.chars.slice(from, to).join(""),
      after: map.chars.slice(to, rawTo).join(""),
      lead: rawFrom > 0,
      tail: rawTo < map.chars.length
    };
  }

  function escapeHTML(text) {
    return text.replace(/[&<>]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch];
    });
  }

  var PAGE = 20;
  var matches = [];
  var shown = 0;
  var more = document.createElement("button");
  more.type = "button";
  more.className = "more";
  more.textContent = "Mostrar más resultados";
  more.hidden = true;
  out.insertAdjacentElement("afterend", more);

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      var build = document.body.dataset.build || "";
      var url = (document.body.dataset.root || "") + "assets/search.json" +
        (build ? "?v=" + encodeURIComponent(build) : "");
      loading = fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error("índice");
          return response.json();
        })
        .then(function (data) { index = data; return data; });
    }
    return loading;
  }

  function chapterCount(count) {
    return count + (count === 1 ? " capítulo con coincidencias." : " capítulos con coincidencias.");
  }

  function paintStatus() {
    if (!matches.length) {
      status.textContent = "No hay coincidencias.";
      return;
    }
    var hits = matches.reduce(function (sum, entry) { return sum + entry.total; }, 0);
    status.textContent = chapterCount(matches.length) + " " + hits +
      (hits === 1 ? " coincidencia." : " coincidencias.") + " Mostrando " + shown + ".";
  }

  function renderSlice() {
    var next = matches.slice(shown, shown + PAGE);
    var html = [];
    next.forEach(function (entry) {
      var chapter = entry.chapter;
      var item = '<article class="hit"><h2><a href="' + chapter.href + "#" + entry.hits[0].id + '">' +
        escapeHTML(chapter.title) + "</a></h2><p>" + escapeHTML(chapter.place) + "</p>";
      entry.hits.forEach(function (hit) {
        item += '<p><a href="' + chapter.href + "#" + hit.id + '">' +
          (hit.piece.lead ? "… " : "") + escapeHTML(hit.piece.before) +
          "<mark>" + escapeHTML(hit.piece.hit) + "</mark>" +
          escapeHTML(hit.piece.after) + (hit.piece.tail ? " …" : "") + "</a></p>";
      });
      item += "</article>";
      html.push(item);
    });
    shown += next.length;
    out.insertAdjacentHTML("beforeend", html.join(""));
    more.hidden = shown >= matches.length;
    paintStatus();
  }

  more.addEventListener("click", renderSlice);

  function exactPiece(text, query) {
    var at = text.toLowerCase().indexOf(query);
    if (at < 0) return null;
    var from = Math.max(0, at - 70);
    var to = Math.min(text.length, at + query.length + 70);
    return {
      before: text.slice(from, at),
      hit: text.slice(at, at + query.length),
      after: text.slice(at + query.length, to),
      lead: from > 0,
      tail: to < text.length
    };
  }

  function volumeOf(chapter) {
    if (chapter.volume) return String(chapter.volume);
    var match = String(chapter.href || "").match(/volumen-(\d+)/);
    return match ? match[1] : "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var raw = input.value.trim();
    var exact = raw.length > 2 && raw.charAt(0) === '"' && raw.charAt(raw.length - 1) === '"';
    var query = exact ? raw.slice(1, -1).toLowerCase() : folded(raw).text;
    var volumePick = document.getElementById("buscar-volumen");
    var titlesOnly = document.getElementById("buscar-titulos");
    var order = document.getElementById("buscar-orden");
    var wanted = volumePick ? volumePick.value : "";
    out.innerHTML = "";
    matches = [];
    shown = 0;
    more.hidden = true;
    if (query.length < 2) {
      status.textContent = "Escribe al menos dos letras.";
      return;
    }
    status.textContent = "Buscando…";
    more.hidden = true;
    load().then(function (books) {
      matches = [];
      shown = 0;
      for (var c = 0; c < books.length; c++) {
        var chapter = books[c];
        if (wanted && volumeOf(chapter) !== wanted) continue;
        var hits = [];
        var total = 0;
        var titleHit = exact
          ? chapter.title.toLowerCase().indexOf(query) >= 0
          : folded(chapter.title).text.indexOf(query) >= 0;
        if (!titlesOnly || !titlesOnly.checked) {
          for (var b = 0; b < chapter.blocks.length; b++) {
            var block = chapter.blocks[b];
            if (titlesOnly && titlesOnly.checked && block.kind !== "heading") continue;
            var piece = exact ? exactPiece(block.text, query) : snippet(block.text, query);
            if (!piece) continue;
            total += 1;
            if (hits.length < 3) hits.push({ id: block.id, piece: piece });
          }
        } else {
          for (var h = 0; h < chapter.blocks.length; h++) {
            var heading = chapter.blocks[h];
            if (heading.kind !== "heading") continue;
            var headingPiece = exact ? exactPiece(heading.text, query) : snippet(heading.text, query);
            if (!headingPiece) continue;
            total += 1;
            if (hits.length < 3) hits.push({ id: heading.id, piece: headingPiece });
          }
          if (!total && titleHit) total = 1;
        }
        if (titleHit && !(titlesOnly && titlesOnly.checked)) total += 1;
        if (!hits.length && !(titlesOnly && titlesOnly.checked && titleHit)) continue;
        if (!hits.length && titleHit) {
          hits.push({
            id: "",
            piece: { before: "", hit: chapter.title, after: "", lead: false, tail: false }
          });
        }
        matches.push({ chapter: chapter, hits: hits, total: total, titleHit: titleHit, order: c });
      }
      if (order && order.value === "relevancia") {
        matches.sort(function (a, b) {
          var scoreA = a.total + (a.titleHit ? 3 : 0);
          var scoreB = b.total + (b.titleHit ? 3 : 0);
          return scoreB - scoreA || a.order - b.order;
        });
      }
      renderSlice();
    }).catch(function () {
      status.textContent = "No se pudo cargar el índice de búsqueda.";
    });
  });
})();
