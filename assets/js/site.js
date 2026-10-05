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

// Home: the name fills the width, letters rise in on load and lift towards
// the cursor; markers pop up short notes when the cursor comes near.
(function () {
  var root = document.querySelector(".intro");
  if (!root) return;
  var nameEl = root.querySelector(".intro-name");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var narrow = window.matchMedia("(max-width: 700px)");
  var full = nameEl.getAttribute("data-name");
  nameEl.setAttribute("aria-label", full);

  // Build letters: one line on wide screens, "Tae Hyun / Kim" on narrow ones.
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
  // Size the name so its longest line spans the content width.
  function fit() {
    nameEl.style.fontSize = "100px";
    var widest = 0;
    nameEl.querySelectorAll(".nm-line").forEach(function (l) {
      var r = document.createRange(); r.selectNodeContents(l);
      widest = Math.max(widest, r.getBoundingClientRect().width);
    });
    var avail = root.clientWidth;
    var size = Math.min(avail / widest * 100, window.innerHeight * (narrow.matches ? 0.2 : 0.3));
    nameEl.style.fontSize = size.toFixed(1) + "px";
  }

  function intro() {
    if (reduce || !nameEl.animate) return;
    letters.forEach(function (l, i) {
      l.el.animate([{ transform: "translateY(105%)" }, { transform: "translateY(0)" }],
        { duration: 900, delay: 120 + i * 45, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    });
    root.querySelectorAll(".note-pin").forEach(function (p, i) {
      p.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }],
        { duration: 500, delay: 900 + i * 110, easing: "cubic-bezier(.2,1.5,.3,1)", fill: "backwards" });
    });
  }

  build();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  intro();
  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { build(); place(open); }, 120);
  });

  // Letters lift slightly towards the cursor (transform only, so it stays smooth).
  var mx = -9999, my = -9999, raf = 0, centres = null;
  function measure() {
    centres = letters.map(function (l) {
      var r = l.el.parentNode.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
  }
  window.addEventListener("scroll", function () { centres = null; }, { passive: true });
  window.addEventListener("resize", function () { centres = null; });
  function tick() {
    raf = 0;
    var moving = false;
    if (!centres) measure();
    letters.forEach(function (l, i) {
      var d = Math.hypot(mx - centres[i][0], my - centres[i][1]);
      var f = Math.max(0, 1 - d / 280);
      l.ty = -f * f * 0.12;
      l.y += (l.ty - l.y) * 0.18;
      if (Math.abs(l.ty - l.y) > 0.0005) moving = true;
      l.el.style.transform = "translateY(" + l.y.toFixed(4) + "em)";
    });
    if (moving) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  // Notes
  var notes = Array.prototype.slice.call(root.querySelectorAll(".note")).map(function (li, i) {
    var pin = li.querySelector(".note-pin");
    var card = li.querySelector(".note-card");
    pin.style.setProperty("--d", (i * 0.45) + "s");
    card.setAttribute("role", "note");
    return { li: li, pin: pin, card: card };
  });
  var open = null, closeT = null, openedAt = 0;
  function place(n) {
    if (!n) return;
    var rb = root.getBoundingClientRect();
    var pb = n.pin.getBoundingClientRect();
    var cw = n.card.offsetWidth, chh = n.card.offsetHeight;
    var px = pb.left + pb.width / 2 - rb.left, py = pb.top + pb.height / 2 - rb.top;
    var x = px + 24, y = py + 20;
    if (x + cw > rb.width) x = px - 24 - cw;
    if (x < 0) x = Math.max(0, Math.min(rb.width - cw, px - cw / 2));
    var foot = root.querySelector(".intro-foot");
    var limit = foot ? foot.getBoundingClientRect().top - rb.top - 8 : rb.height - 8;
    if (y + chh > limit) y = py - 20 - chh;
    if (y < 0) y = 8;
    n.card.style.left = (x - (n.li.offsetLeft)) + "px";
    n.card.style.top = (y - (n.li.offsetTop)) + "px";
    n.card.style.transformOrigin = (px - x) + "px " + (py - y) + "px";
  }
  function show(n) {
    clearTimeout(closeT);
    if (open === n) return;
    if (open) hide(open, true);
    open = n;
    place(n);
    openedAt = Date.now();
    n.card.classList.add("is-open");
    n.pin.setAttribute("aria-expanded", "true");
    if (!reduce && n.card.animate) {
      n.card.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: 420, easing: "cubic-bezier(.2,1.25,.3,1)" });
    }
  }
  function hide(n, instant) {
    if (!n) return;
    n.pin.setAttribute("aria-expanded", "false");
    if (open === n) open = null;
    if (!reduce && !instant && n.card.animate) {
      var a = n.card.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.85)" }],
        { duration: 160, easing: "ease-in" });
      a.onfinish = function () { if (open !== n) n.card.classList.remove("is-open"); };
    } else {
      n.card.classList.remove("is-open");
    }
  }
  function scheduleClose() {
    clearTimeout(closeT);
    closeT = setTimeout(function () { hide(open); }, 140);
  }

  notes.forEach(function (n) {
    n.pin.addEventListener("click", function () {
      // On touch, a tap focuses (opens) then clicks; don't let the click close it again.
      if (open === n && !finePointer && Date.now() - openedAt > 350) hide(n);
      else show(n);
    });
    n.pin.addEventListener("focus", function () { show(n); });
    n.card.addEventListener("pointerenter", function () { clearTimeout(closeT); });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(open); });
  document.addEventListener("click", function (e) {
    if (open && !e.target.closest(".note")) hide(open);
  });

  var hint = root.querySelector(".intro-hint");
  if (hint && !finePointer) hint.textContent = "Tap the markers";

  if (finePointer) {
    root.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!reduce) kick();
      if (e.target.closest(".note-card")) { clearTimeout(closeT); return; }
      var best = null, bestD = 120;
      notes.forEach(function (n) {
        var r = n.pin.getBoundingClientRect();
        var d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        if (d < bestD) { bestD = d; best = n; }
      });
      if (best) show(best);
      else if (open) scheduleClose();
    });
    root.addEventListener("pointerleave", function () {
      mx = my = -9999;
      if (!reduce) kick();
      if (open) scheduleClose();
    });
  }
})();
