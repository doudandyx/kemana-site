/* Kemana — langue, thème et afficheur à points. Aucune requête réseau, aucun cookie :
   les deux choix (thème, langue) restent dans le navigateur. */
(function () {
  var root = document.documentElement;
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- Langue ---------- */
  var FR = {
    "nav.consulting": "Conseil", "nav.apps": "Applications", "nav.contact": "Contact",
    "hero.title": "La stratégie d'abord. Le logiciel ensuite.",
    "hero.text": "Kemana est un studio parisien. Nous conseillons les entreprises sur leurs produits, leur stratégie et leur technologie, et nous créons nos propres applications.",
    "hero.cta": "Nous écrire",
    "label.consulting": "conseil", "label.apps": "applications", "label.contact": "contact", "label.legal": "mentions légales",
    "c1.title": "Produit et stratégie numérique",
    "c1.text": "D'une première idée à un produit utilisé : positionnement, périmètre, design et lancement.",
    "c2.title": "Stratégie et opérations",
    "c2.text": "Des décisions claires sur les marchés à viser et sur la conduite de l'entreprise au quotidien.",
    "c3.title": "Technologie et IA",
    "c3.text": "Architecture, automatisation et IA, là où elles font gagner un temps réel.",
    "apps.title": "De petits outils qui font bien une seule chose.",
    "apps.text": "Nous concevons, développons et publions nos propres logiciels pour Mac et pour le web, avec le respect de la vie privée comme point de départ.",
    "contact.title": "Parlez-nous de votre projet.",
    "legal.company": "Kemana Consulting, SASU au capital de 1 €. Siège social : 122 rue Amelot, 75011 Paris. RCS Paris 104 050 620. TVA : FR52104050620. Directeur de la publication : le président de la société. Contact : contact@kemana.co.",
    "legal.host": "Hébergement : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.",
    "legal.privacy": "Ce site n'utilise ni cookie ni traceur. Vos choix de thème et de langue restent dans votre navigateur."
  };
  var META = {
    en: { title: "Kemana — Consulting and applications", theme: "Switch between light and dark theme", lang: "Language" },
    fr: { title: "Kemana — Conseil et applications", theme: "Passer du thème clair au thème sombre", lang: "Langue" }
  };
  var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-i18n]"));
  var EN = {};
  nodes.forEach(function (n) { EN[n.getAttribute("data-i18n")] = n.textContent; });
  var lang = "en";
  function setLang(l) {
    lang = l === "fr" ? "fr" : "en";
    root.lang = lang;
    var dict = lang === "fr" ? FR : EN;
    nodes.forEach(function (n) { var k = n.getAttribute("data-i18n"); if (dict[k]) n.textContent = dict[k]; });
    document.title = META[lang].title;
    document.getElementById("theme").setAttribute("aria-label", META[lang].theme);
    document.querySelector(".lang").setAttribute("aria-label", META[lang].lang);
    document.querySelectorAll(".lang button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === lang)); });
    captionShown = -1;
  }
  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.lang); store("kemana-lang", lang); });
  });

  /* ---------- Thème ---------- */
  var dark = window.matchMedia("(prefers-color-scheme: dark)");
  function isDark() { var t = root.getAttribute("data-theme"); return t ? t === "dark" : dark.matches; }
  document.getElementById("theme").addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next); store("kemana-theme", next); dotColor = null;
  });
  if (dark.addEventListener) dark.addEventListener("change", function () { dotColor = null; });

  /* ---------- Afficheur à points ----------
     Une grille de points passe d'un signe au suivant ; le changement part du centre comme une onde.
     Les points proches du pointeur grossissent. */
  function seg(x, y, x1, y1, x2, y2, th) {
    var dx = x2 - x1, dy = y2 - y1, u = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
    u = Math.max(0, Math.min(1, u));
    var ex = x - (x1 + u * dx), ey = y - (y1 + u * dy);
    return ex * ex + ey * ey < th * th;
  }
  var SIGNS = [
    { en: "kemana", fr: "kemana", f: function (x, y) { return seg(x, y, .32, .2, .32, .8, .05) || seg(x, y, .36, .52, .68, .2, .05) || seg(x, y, .42, .48, .7, .8, .05); } },
    { en: "strategy", fr: "stratégie", f: function (x, y) { return seg(x, y, .26, .74, .74, .26, .045) || seg(x, y, .44, .26, .74, .26, .045) || seg(x, y, .74, .26, .74, .56, .045); } },
    { en: "technology", fr: "technologie", f: function (x, y) { return seg(x, y, .4, .28, .2, .5, .045) || seg(x, y, .2, .5, .4, .72, .045) || seg(x, y, .6, .28, .8, .5, .045) || seg(x, y, .8, .5, .6, .72, .045); } },
    { en: "applications", fr: "applications", f: function (x, y) { var ax = Math.abs(x - .5), ay = Math.abs(y - .5), m = Math.max(ax, ay); return (m > .22 && m < .31 && !(ax > .25 && ay > .25)) || Math.sqrt(ax * ax + ay * ay) < .09; } }
  ];
  var N = 23, HOLD = 3400;
  var canvas = document.getElementById("signal"), caption = document.getElementById("caption");
  var ctx = canvas.getContext("2d"), vals = new Float32Array(N * N);
  var w = 0, raf = 0, running = false, dotColor = null, captionShown = -1, pointer = null, t0 = performance.now();
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function size() {
    var r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    w = r.width;
    canvas.width = Math.max(1, Math.round(w * d)); canvas.height = Math.max(1, Math.round(w * d));
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function draw(now) {
    if (w < 8) return;
    var t = reduce ? 0 : now - t0;
    if (!dotColor) dotColor = getComputedStyle(root).getPropertyValue("--dot").trim() || "#888";
    var gi = Math.floor(t / HOLD) % SIGNS.length;
    if (gi !== captionShown) { captionShown = gi; caption.textContent = SIGNS[gi][lang]; }
    ctx.clearRect(0, 0, w, w); ctx.fillStyle = dotColor;
    var cell = w / N;
    for (var r = 0; r < N; r++) for (var q = 0; q < N; q++) {
      var x = (q + .5) / N, y = (r + .5) / N, i = r * N + q;
      var lag = Math.sqrt((x - .5) * (x - .5) + (y - .5) * (y - .5)) * 900;
      var li = reduce ? 0 : ((Math.floor((t - lag) / HOLD) % SIGNS.length) + SIGNS.length) % SIGNS.length;
      var target = SIGNS[li].f(x, y) ? 1 : 0;
      if (pointer) { var pd = Math.sqrt((x - pointer.x) * (x - pointer.x) + (y - pointer.y) * (y - pointer.y)); if (pd < .16) target = Math.max(target, 1 - pd / .16); }
      vals[i] = reduce && !pointer ? target : vals[i] + (target - vals[i]) * .14;
      var v = vals[i];
      ctx.globalAlpha = .16 + .84 * v;
      ctx.beginPath(); ctx.arc(x * w, y * w, cell * (.07 + .3 * v), 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function loop(now) { draw(now); if (running) raf = requestAnimationFrame(loop); }
  function start() { if (running) return; running = true; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  canvas.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    pointer = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  });
  canvas.addEventListener("pointerleave", function () { pointer = null; });

  var visible = true;
  function sync() { if (visible && !document.hidden) start(); else stop(); }
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }).observe(canvas);
  document.addEventListener("visibilitychange", sync);
  if (window.ResizeObserver) new ResizeObserver(function () { size(); draw(performance.now()); }).observe(canvas);
  else window.addEventListener("resize", size);

  var saved = read("kemana-lang");
  setLang(saved || ((navigator.language || "en").toLowerCase().indexOf("fr") === 0 ? "fr" : "en"));
  size(); sync();
})();
