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
