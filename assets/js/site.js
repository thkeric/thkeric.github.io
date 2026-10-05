// Play looping clips only while they are on screen; respect reduced motion.
(function () {
  var clips = document.querySelectorAll("video[data-autoplay]");
  if (!clips.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  clips.forEach(function (v) {
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    if (reduce) { v.controls = true; v.preload = "none"; }
  });
  if (reduce || !("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (v.preload === "none") v.preload = "auto";
        var p = v.play();
        if (p && p.catch) p.catch(function () { v.controls = true; });
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.35 });
  clips.forEach(function (v) { io.observe(v); });
})();

// Carousels: swipe or drag on touch/trackpad, arrows and dots on desktop,
// left/right keys when focused. One "position" per step; --per-view sets how
// many slides are visible at once.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ARROW_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  document.querySelectorAll("[data-carousel]").forEach(function (root) {
    var track = root.querySelector(".carousel-track");
    if (!track) return;
    var slides = Array.prototype.slice.call(track.children);
    var label = root.getAttribute("aria-label") || "Gallery";

    var bar = document.createElement("div");
    bar.className = "carousel-bar";
    bar.innerHTML =
      '<button type="button" class="carousel-btn" data-dir="-1" aria-label="Previous">' + ARROW_L + "</button>" +
      '<div class="carousel-dots" role="group" aria-label="' + label + ' position"></div>' +
      '<span class="carousel-count" aria-live="polite"></span>' +
      '<button type="button" class="carousel-btn" data-dir="1" aria-label="Next">' + ARROW_R + "</button>";
    root.appendChild(bar);
    var prev = bar.querySelector('[data-dir="-1"]');
    var next = bar.querySelector('[data-dir="1"]');
    var dotsWrap = bar.querySelector(".carousel-dots");
    var count = bar.querySelector(".carousel-count");

    function perView() {
      var v = parseFloat(getComputedStyle(root).getPropertyValue("--per-view"));
      return Math.max(1, Math.floor(v || 1));
    }
    function positions() { return Math.max(1, slides.length - perView() + 1); }
    function step() {
      if (slides.length < 2) return track.clientWidth;
      return slides[1].offsetLeft - slides[0].offsetLeft;
    }
    function current() { return Math.min(positions() - 1, Math.max(0, Math.round(track.scrollLeft / step()))); }
    function go(i) {
      i = Math.max(0, Math.min(positions() - 1, i));
      track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: reduce ? "auto" : "smooth" });
    }

    var lastPositions = -1;
    function buildDots() {
      var n = positions();
      if (n === lastPositions) return;
      lastPositions = n;
      dotsWrap.innerHTML = "";
      for (var i = 0; i < n; i++) {
        var d = document.createElement("button");
        d.type = "button";
        d.className = "carousel-dot";
        d.setAttribute("aria-label", "Show item " + (i + 1) + " of " + n);
        d.addEventListener("click", go.bind(null, i));
        dotsWrap.appendChild(d);
      }
      root.classList.toggle("carousel--static", n < 2);
    }
    function update() {
      buildDots();
      var i = current(), n = positions();
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
      Array.prototype.forEach.call(dotsWrap.children, function (d, k) {
        if (k === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
      });
      count.textContent = (i + 1) + " / " + n;
      slides.forEach(function (s, k) {
        var visible = k >= i && k < i + perView();
        s.classList.toggle("is-active", visible);
        s.setAttribute("aria-hidden", visible ? "false" : "true");
      });
    }

    prev.addEventListener("click", function () { go(current() - 1); });
    next.addEventListener("click", function () { go(current() + 1); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(current() - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(current() + 1); }
    });

    // Mouse drag to swipe on desktop (touch and trackpads scroll natively).
    var dragging = false, startX = 0, startLeft = 0, moved = false;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      dragging = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
      track.classList.add("is-dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startLeft - dx;
    });
    window.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("is-dragging");
      var dx = e.clientX - startX, base = Math.round(startLeft / step());
      if (dx < -40) go(base + 1); else if (dx > 40) go(base - 1); else go(base);
    });
    track.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    track.addEventListener("dragstart", function (e) { e.preventDefault(); });

    var ticking = false;
    track.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }, { passive: true });
    window.addEventListener("resize", update);
    root.classList.add("is-ready");
    update();
  });
})();

// Back-to-top button: appears after scrolling down, returns to the top.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "to-top";
  btn.setAttribute("aria-label", "Back to top");
  btn.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 L18 16 L2 16 Z" fill="currentColor"/></svg>';
  document.body.appendChild(btn);
  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    var skip = document.querySelector(".site-head .name");
    if (skip) skip.focus({ preventScroll: true });
  });
  var shown = false, ticking = false;
  function check() {
    ticking = false;
    var show = window.scrollY > Math.min(600, window.innerHeight * 0.8);
    if (show !== shown) { shown = show; btn.classList.toggle("is-visible", show); }
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(check); }
  }, { passive: true });
  check();
})();

// Section indicator: a dot per numbered chapter, fixed on the right.
// The dot for the section in the middle of the screen stretches into a pill.
(function () {
  var heads = Array.prototype.slice.call(document.querySelectorAll(".chap-head h2[id]"));
  if (heads.length < 3 || !("IntersectionObserver" in window)) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nav = document.createElement("nav");
  nav.className = "section-rail";
  nav.setAttribute("aria-label", "Sections on this page");
  var list = document.createElement("ol");
  var items = heads.map(function (h, i) {
    var section = h.closest("section") || h;
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "#" + h.id;
    var num = (i + 1 < 10 ? "0" : "") + (i + 1);
    a.innerHTML = '<span class="rail-label"><span class="rail-num">' + num + "</span>" + h.textContent + '</span><span class="rail-dot" aria-hidden="true"></span>';
    a.addEventListener("click", function (e) {
      e.preventDefault();
      section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", "#" + h.id);
    });
    li.appendChild(a);
    list.appendChild(li);
    return { section: section, link: a };
  });
  nav.appendChild(list);
  document.body.appendChild(nav);

  function setActive(idx) {
    items.forEach(function (it, k) {
      if (k === idx) it.link.setAttribute("aria-current", "true");
      else it.link.removeAttribute("aria-current");
    });
  }
  var visible = new Map();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { visible.set(e.target, e.isIntersecting); });
    var idx = -1;
    items.forEach(function (it, k) { if (visible.get(it.section)) idx = k; });
    setActive(idx);
  }, { rootMargin: "-45% 0px -54% 0px" });
  items.forEach(function (it) { io.observe(it.section); });

  // Show the rail once the reader has moved past the page header.
  var first = items[0].section, ticking = false;
  function check() {
    ticking = false;
    nav.classList.toggle("is-visible", first.getBoundingClientRect().top < window.innerHeight * 0.9);
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(check); }
  }, { passive: true });
  check();
})();

// Old links to the home page's work section now go to the Work page.
if (location.hash === "#work" && !document.querySelector("#work")) {
  location.replace(new URL("work/", location.href.split("#")[0]).href);
}

// Space pages (home, about): a twinkling starfield on one canvas, with one or
// more orbit systems. Each system has a centre element and notes that travel
// as planets on tilted orbits; bringing the cursor near slows the system and
// pops a note open. One animation loop drives everything.
(function () {
  if (!document.body.classList.contains("space-page")) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var narrow = window.matchMedia("(max-width: 700px)");
  var mx = -9999, my = -9999;
  var hooks = [];

  /* ---------- home name: letters, sizing, entrance, lift ---------- */
  var nameEl = document.querySelector(".intro-name");
  var letters = [], centres = null, built = false;
  function buildName() {
    if (!nameEl) return;
    var full = nameEl.getAttribute("data-name");
    nameEl.setAttribute("aria-label", full);
    var lines = narrow.matches ? ["Tae Hyun", "Kim"] : [full];
    nameEl.innerHTML = ""; letters = [];
    if (built) nameEl.classList.add("is-revealed");
    built = true;
    lines.forEach(function (text) {
      var line = document.createElement("span");
      line.className = "nm-line"; line.setAttribute("aria-hidden", "true");
      text.split("").forEach(function (c) {
        if (c === " ") { var sp = document.createElement("span"); sp.className = "nm-sp"; line.appendChild(sp); return; }
        var mask = document.createElement("span"); mask.className = "nm-mask";
        var ch = document.createElement("span"); ch.className = "nm-ch"; ch.textContent = c;
        mask.appendChild(ch); line.appendChild(mask);
        letters.push({ el: ch, y: 0, ty: 0 });
      });
      nameEl.appendChild(line);
    });
    fitName();
  }
  function fitName() {
    if (!nameEl) return;
    nameEl.style.fontSize = "100px";
    var widest = 0;
    nameEl.querySelectorAll(".nm-line").forEach(function (l) {
      var r = document.createRange(); r.selectNodeContents(l);
      widest = Math.max(widest, r.getBoundingClientRect().width);
    });
    var box = nameEl.parentNode.clientWidth;
    // leave room for the planets to circle the name on every screen size
    var target = narrow.matches ? ((box / 2 - 18) * 0.82 - 24) * 2 : box * 0.62;
    var size = Math.min(target / widest * 100, window.innerHeight * (narrow.matches ? 0.14 : 0.19));
    nameEl.style.fontSize = size.toFixed(1) + "px";
    centres = null;
  }
  if (nameEl) {
    buildName();
    if (!reduce && nameEl.animate) {
      var anims = letters.map(function (l, i) {
        return l.el.animate([{ transform: "translateY(105%)" }, { transform: "translateY(0)" }],
          { duration: 900, delay: 120 + i * 45, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
      });
      var lastAnim = anims[anims.length - 1];
      if (lastAnim) lastAnim.onfinish = function () { nameEl.classList.add("is-revealed"); };
    } else {
      nameEl.classList.add("is-revealed");
    }
    if (finePointer && !reduce) hooks.push(function () {
      if (!centres) centres = letters.map(function (l) {
        var r = l.el.parentNode.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      });
      letters.forEach(function (l, i) {
        var d = Math.hypot(mx - centres[i][0], my - centres[i][1]);
        var f = Math.max(0, 1 - d / 280);
        l.ty = -f * f * 0.12;
        l.y += (l.ty - l.y) * 0.18;
        l.el.style.transform = "translateY(" + l.y.toFixed(4) + "em)";
      });
    });
  }

  /* ---------- orbit systems ---------- */
  var SIZES = [18, 24, 16, 28, 20, 22];
  var PERIODS = [80, 105, 130, 155, 185, 210];
  var START = [3.6, 5.5, 0.35, 2.1, 1.1, 4.5];

  function makeSystem(root, index) {
    var centreEl = root.querySelector("[data-orbit-centre]");
    var mode = root.getAttribute("data-orbit");
    var sys = { root: root, centreEl: centreEl, mode: mode, rings: root.getAttribute("data-rings") !== "false", speed: reduce ? 0 : 1, open: null, closeT: null, openedAt: 0, geo: null, visible: true };
    sys.notes = Array.prototype.slice.call(root.querySelectorAll(".note")).map(function (li, i) {
      var pin = li.querySelector(".note-pin"), card = li.querySelector(".note-card");
      pin.querySelector(".planet-body").style.setProperty("--s", SIZES[i % SIZES.length] + "px");
      pin.style.setProperty("--d", (i * 0.6) + "s");
      card.setAttribute("role", "note");
      return { li: li, pin: pin, card: card, a: START[(i + index * 2) % START.length], period: PERIODS[i % PERIODS.length], x: 0, y: 0, vx: 0, vy: 0, front: false };
    });

    sys.geometry = function () {
      var rb = root.getBoundingClientRect(), cb = centreEl.getBoundingClientRect();
      var lines = centreEl.querySelectorAll(".nm-line");
      if (lines.length) {
        // measure the glyphs themselves, not the full-width heading box
        var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
        Array.prototype.forEach.call(lines, function (l) {
          var rg = document.createRange(); rg.selectNodeContents(l);
          var r = rg.getBoundingClientRect();
          L = Math.min(L, r.left); T = Math.min(T, r.top); R = Math.max(R, r.right); B = Math.max(B, r.bottom);
        });
        cb = { left: L, top: T, width: R - L, height: B - T };
      }
      var cx = cb.left + cb.width / 2, cy = cb.top + cb.height / 2;
      var n = sys.notes.length, orbits = [];
      if (mode === "name") {
        // Every orbit encloses the name with clearance, so planets circle it
        // and never pass behind or over it.
        var pad = narrow.matches ? 24 : 36, edge = narrow.matches ? 18 : 30;
        var aM = cb.width / 2 + pad, bM = cb.height / 2 + pad;
        var foot = root.querySelector(".intro-foot");
        var footTop = foot ? foot.getBoundingClientRect().top : rb.bottom;
        var Hh = Math.min(cx - rb.left, rb.right - cx) - edge;
        var Hv = Math.min(cy - rb.top, footTop - cy) - edge;
        var ryMin = Math.max(bM * 1.15, bM / Math.sqrt(Math.max(0.04, 1 - Math.pow(Math.min(0.98, aM / Hh), 2))));
        var ryMax = Math.max(ryMin + 8, Hv);
        for (var i = 0; i < n; i++) {
          var t = i / Math.max(1, n - 1);
          var ry = ryMin + (ryMax - ryMin) * t;
          var need = aM / Math.sqrt(Math.max(0.04, 1 - Math.pow(Math.min(0.98, bM / ry), 2)));
          var rx = Math.min(Hh, need + Math.max(0, Hh - need) * (0.2 + 0.6 * t));
          orbits.push([rx, ry]);
        }
      } else {
        var maxRx = Math.min(cx - rb.left, rb.right - cx) - (narrow.matches ? 22 : 34);
        var maxRy = Math.min(cy - rb.top, rb.bottom - cy) - 26;
        var ratio = Math.max(0.45, Math.min(1, maxRy / maxRx));
        var minRx = Math.min(maxRx * 0.8, cb.width / 2 + 44);
        for (var j = 0; j < n; j++) {
          var r = minRx + (maxRx - minRx) * (j / Math.max(1, n - 1));
          orbits.push([r, r * ratio]);
        }
      }
      sys.geo = { cx: cx, cy: cy, left: rb.left, top: rb.top, bottom: rb.bottom, orbits: orbits };
    };

    sys.update = function (dt) {
      var g = sys.geo, near = false;
      sys.visible = g.bottom > 0 && g.top < window.innerHeight;
      sys.notes.forEach(function (n, i) {
        var o = g.orbits[i];
        n.vx = g.cx + Math.cos(n.a) * o[0];
        n.vy = g.cy + Math.sin(n.a) * o[1];
        if (finePointer && Math.hypot(mx - n.vx, my - n.vy) < 150) near = true;
      });
      var target = reduce ? 0 : (sys.open ? 0 : (near ? 0.15 : 1));
      sys.speed += (target - sys.speed) * Math.min(1, dt * 4);
      sys.notes.forEach(function (n) {
        n.a += sys.speed * dt * (6.2832 / n.period) * (narrow.matches ? 0.75 : 1);
        var depth = (Math.sin(n.a) + 1) / 2;
        n.x = n.vx - g.left; n.y = n.vy - g.top;
        n.li.style.transform = "translate3d(" + n.x.toFixed(1) + "px," + n.y.toFixed(1) + "px,0)";
        n.pin.style.transform = "scale(" + (0.8 + depth * 0.3).toFixed(3) + ")";
        n.pin.style.opacity = (0.7 + depth * 0.3).toFixed(3);
        var front = depth > 0.5;
        if (front !== n.front) { n.front = front; n.li.classList.toggle("is-front", front); }
      });
      if (sys.open && sys.speed > 0.002) place(sys.open);
    };

    function place(n) {
      var rw = root.clientWidth, rh = root.clientHeight;
      var cw = n.card.offsetWidth, chh = n.card.offsetHeight;
      var foot = root.querySelector(".intro-foot");
      var limit = foot ? foot.offsetTop - 8 : rh - 8;
      var x = n.x + 26, y = n.y + 18;
      if (x + cw > rw) x = n.x - 26 - cw;
      if (x < 0) x = Math.max(0, Math.min(rw - cw, n.x - cw / 2));
      if (y + chh > limit) y = n.y - 18 - chh;
      if (y < 0) y = 8;
      n.card.style.left = (x - n.x).toFixed(1) + "px";
      n.card.style.top = (y - n.y).toFixed(1) + "px";
    }
    function show(n) {
      clearTimeout(sys.closeT);
      if (sys.open === n) return;
      if (sys.open) hide(sys.open, true);
      sys.open = n; sys.openedAt = Date.now();
      n.li.classList.add("is-open");
      place(n);
      n.card.classList.add("is-open");
      n.pin.setAttribute("aria-expanded", "true");
      if (!reduce && n.card.animate) {
        n.card.animate([{ opacity: 0, transform: "translateY(6px) scale(.9)" }, { opacity: 1, transform: "none" }],
          { duration: 380, easing: "cubic-bezier(.2,1.2,.3,1)" });
      }
    }
    function hide(n, instant) {
      if (!n) return;
      n.pin.setAttribute("aria-expanded", "false");
      if (sys.open === n) sys.open = null;
      var done = function () { if (sys.open !== n) { n.card.classList.remove("is-open"); n.li.classList.remove("is-open"); } };
      if (!reduce && !instant && n.card.animate) {
        n.card.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.94)" }], { duration: 150, easing: "ease-in" }).onfinish = done;
      } else done();
    }
    sys.hide = hide;
    sys.notes.forEach(function (n) {
      n.pin.addEventListener("click", function () {
        if (sys.open === n && !finePointer && Date.now() - sys.openedAt > 350) hide(n); else show(n);
      });
      n.pin.addEventListener("focus", function () { show(n); });
      n.card.addEventListener("pointerenter", function () { clearTimeout(sys.closeT); });
    });
    sys.onPointer = function (e) {
      if (e.target.closest && e.target.closest(".note-card")) { clearTimeout(sys.closeT); return; }
      var best = null, bestD = 70;
      sys.notes.forEach(function (n) {
        var d = Math.hypot(e.clientX - n.vx, e.clientY - n.vy);
        if (d < bestD) { bestD = d; best = n; }
      });
      if (best) show(best);
      else if (sys.open) { clearTimeout(sys.closeT); sys.closeT = setTimeout(function () { hide(sys.open); }, 160); }
    };
    if (!reduce && root.animate) {
      sys.notes.forEach(function (n, i) {
        n.pin.querySelector(".planet-body").animate([{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
          { duration: 700, delay: 900 + i * 140, easing: "cubic-bezier(.2,1.4,.3,1)", fill: "backwards" });
      });
    }
    var hint = document.querySelector(".orbit-hint");
    if (hint && !finePointer) hint.textContent = hint.textContent.replace(/^Hover over/, "Tap");
    return sys;
  }
  var systems = Array.prototype.slice.call(document.querySelectorAll(".orbit-system")).map(makeSystem);

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") systems.forEach(function (s) { s.hide(s.open); }); });
  document.addEventListener("click", function (e) {
    systems.forEach(function (s) { if (s.open && !e.target.closest(".note")) s.hide(s.open); });
  });
  if (finePointer) {
    document.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      systems.forEach(function (s) { s.onPointer(e); });
      if (reduce) draw(performance.now());
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { mx = my = -9999; });
  }

  /* ---------- canvas ---------- */
  var canvas = document.createElement("canvas");
  canvas.className = "space"; canvas.setAttribute("aria-hidden", "true");
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, stars = [], px = 0, py = 0;
  function layout() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.min(420, Math.round(W * H / 5200));
    stars = [];
    for (var i = 0; i < count; i++) {
      var big = Math.random() < 0.08;
      stars.push({ x: Math.random() * W, y: Math.random() * H, r: big ? 0.9 + Math.random() * 0.9 : 0.3 + Math.random() * 0.7,
        a: 0.25 + Math.random() * 0.6, p: Math.random() * 6.283, s: 0.4 + Math.random() * 1.6, z: 0.2 + Math.random() * 0.8 });
    }
    systems.forEach(function (s) { s.geometry(); });
  }
  function draw(now) {
    var t = now / 1000;
    var tx = finePointer && mx > -9000 ? mx - W / 2 : 0, ty = finePointer && my > -9000 ? my - H / 2 : 0;
    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    ctx.clearRect(0, 0, W, H);
    systems.forEach(function (s) {
      if (!s.visible) return;
      var g = s.geo, rad = Math.max(W, H) * (s.mode === "name" ? 0.55 : 0.4);
      var gr = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, rad);
      gr.addColorStop(0, "rgba(120,140,255,0.10)"); gr.addColorStop(0.45, "rgba(80,90,200,0.04)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    });
    ctx.fillStyle = "#fff";
    for (var k = 0; k < stars.length; k++) {
      var st = stars[k];
      var tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * st.s + st.p);
      ctx.globalAlpha = st.a * tw;
      ctx.beginPath(); ctx.arc(st.x - px * 0.02 * st.z, st.y - py * 0.02 * st.z, st.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
    systems.forEach(function (s) {
      if (!s.visible) return;
      var g = s.geo;
      if (!s.rings) return;
      g.orbits.forEach(function (o) {
        var rx = o[0], ry = o[1];
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath(); ctx.ellipse(g.cx, g.cy, rx, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath(); ctx.ellipse(g.cx, g.cy, rx, ry, 0, 0, Math.PI); ctx.stroke();
      });
    });
  }

  /* ---------- loop ---------- */
  var last = performance.now(), frameId = 0, running = true;
  function frame(now) {
    frameId = 0;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    systems.forEach(function (s) { s.update(dt); });
    hooks.forEach(function (h) { h(); });
    draw(now);
    if (running && !reduce) frameId = requestAnimationFrame(frame);
  }
  function kick() { if (!frameId) { last = performance.now(); frameId = requestAnimationFrame(frame); } }

  layout();
  if (!reduce) canvas.animate && canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1600, easing: "ease-out" });
  frame(performance.now());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
    fitName(); systems.forEach(function (s) { s.geometry(); }); if (reduce) frame(performance.now());
  });
  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (nameEl) buildName(); layout(); if (reduce) frame(performance.now()); }, 120);
  });
  window.addEventListener("scroll", function () {
    centres = null;
    systems.forEach(function (s) { s.geometry(); });
    if (reduce) frame(performance.now());
  }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running && !reduce) kick();
  });
})();
