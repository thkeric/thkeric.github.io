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

// Home: the name sits at the centre of a slow solar system. Stars twinkle on
// a canvas behind it; each note is a planet on its own orbit. Bringing the
// cursor near a planet slows the system and pops its note open.
(function () {
  var root = document.querySelector(".intro");
  if (!root) return;
  var nameEl = root.querySelector(".intro-name");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var narrow = window.matchMedia("(max-width: 700px)");
  var full = nameEl.getAttribute("data-name");
  nameEl.setAttribute("aria-label", full);

  /* ---- name: letters, sizing, intro ---- */
  var letters = [];
  function build() {
    var lines = narrow.matches ? ["Tae Hyun", "Kim"] : [full];
    nameEl.innerHTML = "";
    letters = [];
    lines.forEach(function (text) {
      var line = document.createElement("span");
      line.className = "nm-line";
      line.setAttribute("aria-hidden", "true");
      text.split("").forEach(function (c) {
        if (c === " ") { var sp = document.createElement("span"); sp.className = "nm-sp"; line.appendChild(sp); return; }
        var mask = document.createElement("span"); mask.className = "nm-mask";
        var ch = document.createElement("span"); ch.className = "nm-ch"; ch.textContent = c;
        mask.appendChild(ch); line.appendChild(mask);
        letters.push({ el: ch, y: 0, ty: 0 });
      });
      nameEl.appendChild(line);
    });
    fit();
  }
  function fit() {
    nameEl.style.fontSize = "100px";
    var widest = 0;
    nameEl.querySelectorAll(".nm-line").forEach(function (l) {
      var r = document.createRange(); r.selectNodeContents(l);
      widest = Math.max(widest, r.getBoundingClientRect().width);
    });
    var size = Math.min(root.clientWidth / widest * 100, window.innerHeight * (narrow.matches ? 0.2 : 0.3));
    nameEl.style.fontSize = (size * (narrow.matches ? 1 : 0.86)).toFixed(1) + "px";
    centres = null;
  }

  /* ---- planets ---- */
  var SIZES = [18, 24, 16, 28, 20];
  var PERIODS = [80, 105, 130, 155, 185];          // seconds per orbit
  var START = [3.6, 5.5, 0.35, 2.1, 1.1];          // starting angle (radians)
  var notes = Array.prototype.slice.call(root.querySelectorAll(".note")).map(function (li, i) {
    var pin = li.querySelector(".note-pin");
    var card = li.querySelector(".note-card");
    pin.querySelector(".planet-body").style.setProperty("--s", SIZES[i % SIZES.length] + "px");
    pin.style.setProperty("--d", (i * 0.6) + "s");
    card.setAttribute("role", "note");
    return { li: li, pin: pin, card: card, a: START[i % START.length], period: PERIODS[i % PERIODS.length], x: 0, y: 0, vx: 0, vy: 0, front: false };
  });

  /* ---- canvas ---- */
  var canvas = document.createElement("canvas");
  canvas.className = "space";
  canvas.setAttribute("aria-hidden", "true");
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, stars = [], sys = null;

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
    geometry();
  }
  function geometry() {
    var rb = root.getBoundingClientRect();
    var nb = nameEl.getBoundingClientRect();
    var cx = nb.left + nb.width / 2, cy = nb.top + nb.height / 2;
    var maxRx = Math.min(cx - rb.left, rb.right - cx) - (narrow.matches ? 22 : 34);
    var ratio = Math.max(0.4, Math.min(1.05, (rb.height / rb.width) * 0.5));
    if (narrow.matches) ratio = Math.max(0.95, Math.min(1.4, (rb.height - 200) / rb.width * 0.75));
    var minRx = narrow.matches ? maxRx * 0.42 : Math.max(maxRx * 0.42, nb.height * 0.9 / ratio);
    var radii = notes.map(function (_, i) { return minRx + (maxRx - minRx) * (i / Math.max(1, notes.length - 1)); });
    sys = { cx: cx, cy: cy, ratio: ratio, radii: radii, rootLeft: rb.left, rootTop: rb.top };
  }

  /* ---- pointer, speed ---- */
  var mx = -9999, my = -9999, speed = reduce ? 0 : 1, open = null, closeT = null, openedAt = 0;
  var px = 0, py = 0;   // smoothed parallax
  var centres = null;
  function measure() {
    centres = letters.map(function (l) {
      var r = l.el.parentNode.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
  }

  /* ---- frame ---- */
  var last = performance.now(), running = true, frameId = 0;
  function frame(now) {
    frameId = 0;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = now / 1000;
    var near = false;

    // planets: position on their orbit
    notes.forEach(function (n, i) {
      var rx = sys.radii[i], ry = rx * sys.ratio;
      n.vx = sys.cx + Math.cos(n.a) * rx;
      n.vy = sys.cy + Math.sin(n.a) * ry;
      if (finePointer && Math.hypot(mx - n.vx, my - n.vy) < 150) near = true;
    });
    var target = reduce ? 0 : (open ? 0 : (near ? 0.15 : 1));
    speed += (target - speed) * Math.min(1, dt * 4);
    notes.forEach(function (n) {
      n.a += speed * dt * (6.2832 / n.period) * (narrow.matches ? 0.75 : 1);
      var depth = (Math.sin(n.a) + 1) / 2;             // 0 = far side (top), 1 = near side (bottom)
      n.x = n.vx - sys.rootLeft; n.y = n.vy - sys.rootTop;
      n.li.style.transform = "translate3d(" + n.x.toFixed(1) + "px," + n.y.toFixed(1) + "px,0)";
      n.pin.style.transform = "scale(" + (0.7 + depth * 0.45).toFixed(3) + ")";
      n.pin.style.opacity = (0.55 + depth * 0.45).toFixed(3);
      var front = depth > 0.5;
      if (front !== n.front) { n.front = front; n.li.classList.toggle("is-front", front); }
    });

    // background
    var tx = finePointer ? (mx > -9000 ? (mx - W / 2) : 0) : 0, ty = finePointer ? (my > -9000 ? (my - H / 2) : 0) : 0;
    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    ctx.clearRect(0, 0, W, H);
    var g = ctx.createRadialGradient(sys.cx, sys.cy, 0, sys.cx, sys.cy, Math.max(W, H) * 0.55);
    g.addColorStop(0, "rgba(120,140,255,0.10)");
    g.addColorStop(0.45, "rgba(80,90,200,0.04)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (var k = 0; k < stars.length; k++) {
      var st = stars[k];
      var tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * st.s + st.p);
      var sx = st.x - px * 0.02 * st.z, sy = st.y - py * 0.02 * st.z;
      ctx.globalAlpha = st.a * tw;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(sx, sy, st.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // orbits: far half dimmer than near half
    ctx.lineWidth = 1;
    sys.radii.forEach(function (rx) {
      var ry = rx * sys.ratio;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.ellipse(sys.cx, sys.cy, rx, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.ellipse(sys.cx, sys.cy, rx, ry, 0, 0, Math.PI); ctx.stroke();
    });

    // name letters lift towards the cursor
    if (finePointer && !reduce) {
      if (!centres) measure();
      letters.forEach(function (l, i) {
        var d = Math.hypot(mx - centres[i][0], my - centres[i][1]);
        var f = Math.max(0, 1 - d / 280);
        l.ty = -f * f * 0.12;
        l.y += (l.ty - l.y) * 0.18;
        l.el.style.transform = "translateY(" + l.y.toFixed(4) + "em)";
      });
    }
    if (open && speed > 0.002) place(open);
    if (running && !reduce) frameId = requestAnimationFrame(frame);
  }
  function start() { if (!frameId) { last = performance.now(); frameId = requestAnimationFrame(frame); } }

  /* ---- cards ---- */
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
    clearTimeout(closeT);
    if (open === n) return;
    if (open) hide(open, true);
    open = n; openedAt = Date.now();
    n.li.classList.add("is-open");
    place(n);
    n.card.classList.add("is-open");
    n.pin.setAttribute("aria-expanded", "true");
    if (!reduce && n.card.animate) {
      n.card.animate([{ opacity: 0, transform: "translateY(6px) scale(.9)" }, { opacity: 1, transform: "none" }],
        { duration: 380, easing: "cubic-bezier(.2,1.2,.3,1)" });
    }
    if (reduce) frame(performance.now());
  }
  function hide(n, instant) {
    if (!n) return;
    n.pin.setAttribute("aria-expanded", "false");
    if (open === n) open = null;
    var done = function () { if (open !== n) { n.card.classList.remove("is-open"); n.li.classList.remove("is-open"); } };
    if (!reduce && !instant && n.card.animate) {
      n.card.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.94)" }], { duration: 150, easing: "ease-in" }).onfinish = done;
    } else done();
  }
  function scheduleClose() { clearTimeout(closeT); closeT = setTimeout(function () { hide(open); }, 160); }

  notes.forEach(function (n) {
    n.pin.addEventListener("click", function () {
      if (open === n && !finePointer && Date.now() - openedAt > 350) hide(n); else show(n);
    });
    n.pin.addEventListener("focus", function () { show(n); });
    n.card.addEventListener("pointerenter", function () { clearTimeout(closeT); });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(open); });
  document.addEventListener("click", function (e) { if (open && !e.target.closest(".note")) hide(open); });

  var hint = root.querySelector(".intro-hint");
  if (hint && !finePointer) hint.textContent = "Tap the planets";

  if (finePointer) {
    document.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (e.target.closest && e.target.closest(".note-card")) { clearTimeout(closeT); return; }
      var best = null, bestD = 70;
      notes.forEach(function (n) {
        var d = Math.hypot(e.clientX - n.vx, e.clientY - n.vy);
        if (d < bestD) { bestD = d; best = n; }
      });
      if (best) show(best); else if (open) scheduleClose();
      if (reduce) frame(performance.now());
    }, { passive: true });
    document.addEventListener("pointerleave", function () { mx = my = -9999; if (open) scheduleClose(); });
  }

  /* ---- entrance ---- */
  function intro() {
    if (reduce || !nameEl.animate) return;
    letters.forEach(function (l, i) {
      l.el.animate([{ transform: "translateY(105%)" }, { transform: "translateY(0)" }],
        { duration: 900, delay: 120 + i * 45, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    });
    notes.forEach(function (n, i) {
      n.pin.querySelector(".planet-body").animate([{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
        { duration: 700, delay: 900 + i * 140, easing: "cubic-bezier(.2,1.4,.3,1)", fill: "backwards" });
    });
    canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1600, easing: "ease-out" });
  }

  /* ---- go ---- */
  build();
  layout();
  intro();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); geometry(); if (reduce) frame(performance.now()); });
  frame(performance.now());
  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { build(); layout(); if (reduce) frame(performance.now()); }, 120);
  });
  window.addEventListener("scroll", function () { centres = null; geometry(); if (reduce) frame(performance.now()); }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running && !reduce) start();
  });
})();
