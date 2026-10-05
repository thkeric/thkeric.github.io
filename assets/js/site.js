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
