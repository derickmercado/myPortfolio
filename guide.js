/* ═══════════════════════════════════════════════════════════
   Tour guide — an original inline-SVG character (a developer in
   a green hoodie, glasses and headphones) who walks visitors
   through the page and speaks each section's intro.

   • He sits on the top edge of a card in each section, sneakers
     dangling over it, so he scrolls with the page like he's
     perched on that div. When the next section arrives he jumps
     down onto its card and says that section's line.
   • Each section's line lives in its data-guide attribute; the
     card he sits on is listed in PERCH below.
   • No scroll listener and no rAF loop: an IntersectionObserver
     picks the section and CSS transitions do the jumping, so it
     can't compete with the 3D scene (gl3d.js) for frames. Card
     positions are measured only on load/resize, never mid-scroll.
   • Reduced motion: no jumping, text appears instantly.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = 'dmm-guide-hidden';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wideMq = window.matchMedia('(min-width: 1100px)');

  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-guide]'));
  if (!sections.length || !('IntersectionObserver' in window)) return;

  // the card he sits on in each section (same order as the sections)
  var PERCH = ['.hero__actions .btn:last-child', '.entries > .entry', '.projects > .proj',
               '.skills > .skills__row', '.flash', '.contact'];

  function store(get, val) {
    try {
      if (get) return localStorage.getItem(KEY) === '1';
      if (val) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY);
    } catch (e) { return false; }
  }

  /* ── the character (viewBox 0 4 120 140; he sits on the line y=126) ── */
  var SKIN = '#C98B5E', SKIN_D = '#A86F47', HAIR = '#141414', HOOD = '#138A4C', HOOD_D = '#0E6B3A',
      NEON = '#22E57A', INK = '#0C0F0D', JEANS = '#1C2A22';
  var VB_TOP = 4, VB_H = 140, SEAT = 126;
  var SVG =
    '<svg class="guide__svg" viewBox="0 ' + VB_TOP + ' 120 ' + VB_H + '" focusable="false">' +
      '<g class="g-body">' +
        // knees resting on the ledge, shins + sneakers dangling over it
        '<rect x="42" y="116" width="16" height="14" rx="6" fill="' + JEANS + '"/>' +
        '<rect x="62" y="116" width="16" height="14" rx="6" fill="' + JEANS + '"/>' +
        '<g class="g-shin g-shin--l"><rect x="44.5" y="126" width="11" height="9" rx="4" fill="' + JEANS + '"/>' +
          '<path d="M41 133.5h16a3 3 0 0 1 3 3v3.5H42a4 4 0 0 1-1-6.5z" fill="#E9F5EC"/>' +
          '<rect x="41" y="138.4" width="19" height="2.4" rx="1.2" fill="' + NEON + '"/></g>' +
        '<g class="g-shin g-shin--r"><rect x="64.5" y="126" width="11" height="9" rx="4" fill="' + JEANS + '"/>' +
          '<path d="M60 136.5a3 3 0 0 1 3-3h16a4 4 0 0 1 1 6.5H60z" fill="#E9F5EC"/>' +
          '<rect x="60" y="138.4" width="19" height="2.4" rx="1.2" fill="' + NEON + '"/></g>' +
        // back arm
        '<g class="g-arm g-arm--l"><rect x="27" y="77" width="13" height="37" rx="6.5" fill="' + HOOD_D + '"/>' +
          '<rect x="27" y="106" width="13" height="5" rx="2.5" fill="' + INK + '" opacity=".35"/>' +
          '<circle cx="33.5" cy="116" r="6" fill="' + SKIN + '"/></g>' +
        // hoodie
        '<path d="M35 81Q37 69 60 68Q83 69 85 81L88 119Q60 127 32 119Z" fill="' + HOOD + '"/>' +
        '<path d="M43 103h34l2.5 14Q60 122 40.5 117z" fill="' + HOOD_D + '"/>' +
        '<path d="M44 71Q60 84 76 71" stroke="' + HOOD_D + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M55 77v15M65 77v15" stroke="' + NEON + '" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="55" cy="93" r="1.8" fill="' + NEON + '"/><circle cx="65" cy="93" r="1.8" fill="' + NEON + '"/>' +
        // front arm (waves)
        '<g class="g-arm g-arm--r"><rect x="80" y="77" width="13" height="37" rx="6.5" fill="' + HOOD + '"/>' +
          '<rect x="80" y="106" width="13" height="5" rx="2.5" fill="' + INK + '" opacity=".25"/>' +
          '<circle cx="86.5" cy="116" r="6" fill="' + SKIN + '"/></g>' +
        // head
        '<g class="g-head">' +
          '<rect x="54" y="58" width="12" height="13" rx="4" fill="' + SKIN_D + '"/>' +
          '<circle cx="36" cy="44" r="5" fill="' + SKIN_D + '"/><circle cx="84" cy="44" r="5" fill="' + SKIN_D + '"/>' +
          '<circle cx="60" cy="42" r="24" fill="' + SKIN + '"/>' +
          '<path d="M36 41Q34 16 60 15Q86 15 85 39Q79 28 67 27Q57 34 45 30Q39 34 36 41Z" fill="' + HAIR + '"/>' +
          '<path d="M33 45Q32 11 60 11Q88 11 87 45" stroke="' + NEON + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
          '<rect x="27.5" y="36" width="10" height="17" rx="4" fill="' + INK + '" stroke="' + NEON + '" stroke-width="2"/>' +
          '<rect x="82.5" y="36" width="10" height="17" rx="4" fill="' + INK + '" stroke="' + NEON + '" stroke-width="2"/>' +
          '<path d="M46 33q5-3.4 9.5 0M64.5 33q5-3.4 9.5 0" stroke="' + HAIR + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
          '<g class="g-eyes"><ellipse cx="50.5" cy="41.5" rx="2.3" ry="2.7" fill="' + HAIR + '"/>' +
            '<ellipse cx="69.5" cy="41.5" rx="2.3" ry="2.7" fill="' + HAIR + '"/></g>' +
          '<rect x="43" y="35.5" width="15" height="11.5" rx="4" fill="rgba(255,255,255,.1)" stroke="' + INK + '" stroke-width="2"/>' +
          '<rect x="62" y="35.5" width="15" height="11.5" rx="4" fill="rgba(255,255,255,.1)" stroke="' + INK + '" stroke-width="2"/>' +
          '<path d="M58 40.5h4" stroke="' + INK + '" stroke-width="2"/>' +
          '<circle cx="45.5" cy="52" r="3" fill="#E07A6A" opacity=".35"/><circle cx="74.5" cy="52" r="3" fill="#E07A6A" opacity=".35"/>' +
          '<g class="g-mouth">' +
            '<path class="g-mouth__shut" d="M53 54Q60 60 67 54" stroke="#5A2A1E" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
            '<g class="g-mouth__open"><ellipse cx="60" cy="56" rx="5" ry="4.2" fill="#4A1F17"/>' +
              '<ellipse cx="60" cy="58.2" rx="3" ry="1.6" fill="#D9655A"/></g>' +
          '</g>' +
        '</g>' +
      '</g>' +
    '</svg>';

  var guide = document.createElement('div');
  guide.className = 'guide bubble-left';
  guide.innerHTML =
    '<div class="guide__mover">' +
      '<p class="guide__bubble" aria-hidden="true"><span class="guide__text"></span><span class="guide__caret"></span></p>' +
      '<button type="button" class="guide__fig" aria-label="Guide: replay the last message">' + SVG + '</button>' +
      '<button type="button" class="guide__close" aria-label="Hide guide">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
    '</div>';
  var showBtn = document.createElement('button');
  showBtn.type = 'button';
  showBtn.className = 'guide-show';
  showBtn.setAttribute('aria-label', 'Show guide');
  showBtn.innerHTML = '<span aria-hidden="true">👋</span> Guide';
  document.body.appendChild(guide);
  document.body.appendChild(showBtn);

  var mover = guide.querySelector('.guide__mover');
  var textEl = guide.querySelector('.guide__text');

  /* ── perches (measured on load/resize only, never during scroll) ── */
  var spots = [];            // per section: { x, y, side, bw }
  var figW = 120;

  // layout offsets ignore transforms, so reveal slides and hover lifts don't skew them
  function abs(el) {
    var x = 0, y = 0;
    for (var e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function measure() {
    var wide = wideMq.matches;
    figW = wide ? 120 : 86;
    var figH = figW * VB_H / 120;
    var sink = (VB_TOP + VB_H - SEAT) * figW / 120;   // how far the sneakers hang over the edge
    guide.style.setProperty('--fig-w', figW + 'px');
    guide.style.setProperty('--sink', sink.toFixed(1) + 'px');
    var vw = root.clientWidth;
    spots = sections.map(function (s, i) {
      var el = s.querySelector(PERCH[i]);
      if (!el) return spots[i - 1] || { x: 16, y: 120, side: 'right', bw: 220 };
      var a = abs(el);
      // sit near the right end of the card; on the hero button he perches on its
      // corner, sneakers hanging off the end so they never sit over the label
      var x = i === 0 ? a.x + a.w - figW * .35 : a.x + a.w - figW - (wide ? 24 : 8);
      x = Math.max(8, Math.min(vw - figW - 8, x));
      var room = x - Math.max(12, a.x) - 12;                  // space for the bubble on the left
      var side = room >= 150 ? 'left' : 'right';
      var bw = Math.min(wide ? 270 : 240, side === 'left' ? room : vw - (x + figW) - 22);
      return { x: Math.round(x), y: Math.round(a.y + sink - figH), side: side, bw: Math.max(140, Math.round(bw)) };
    });
  }

  function place(i, animate) {
    var p = spots[i];
    if (!p) return;
    if (!animate) mover.style.transition = 'none';
    mover.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)';
    guide.classList.toggle('bubble-left', p.side === 'left');
    guide.classList.toggle('bubble-right', p.side === 'right');
    guide.style.setProperty('--bubble-w', p.bw + 'px');
    if (!animate) requestAnimationFrame(function () { mover.style.transition = ''; });
  }

  /* ── speech ──────────────────────────────────────────── */
  var timers = [], mouthTimer = 0;
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function quiet() {
    timers.forEach(clearTimeout); timers = [];
    clearInterval(mouthTimer);
    guide.classList.remove('is-mouth');
  }

  function say(text) {
    clearInterval(mouthTimer);
    guide.classList.add('is-saying');
    guide.classList.remove('is-done');
    if (reduced) { textEl.textContent = text; done(); return; }
    var chars = Array.from(text), n = 0;   // Array.from keeps emoji whole
    textEl.textContent = '';
    mouthTimer = setInterval(function () { guide.classList.toggle('is-mouth'); }, 110);
    (function tick() {
      textEl.textContent = chars.slice(0, ++n).join('');
      if (n < chars.length) later(tick, chars[n - 1] === '.' || chars[n - 1] === ',' ? 220 : 28);
      else done();
    })();
  }
  function done() {
    clearInterval(mouthTimer);
    guide.classList.remove('is-mouth');
    guide.classList.add('is-done');
  }

  function poseFor(i) {
    guide.classList.remove('pose-wave', 'pose-point', 'pose-cheer');
    guide.classList.add(i === 0 ? 'pose-wave' : i === sections.length - 1 ? 'pose-cheer' : 'pose-point');
  }

  /* ── jumping between sections ────────────────────────── */
  var current = -1;
  function go(i) {
    if (i === current || hidden) return;
    var first = current === -1;
    current = i;
    quiet();
    guide.classList.remove('is-saying');
    var line = sections[i].getAttribute('data-guide');

    if (first || reduced) {
      place(i, false);
      poseFor(i);
      later(function () { say(line); }, first && !reduced ? 650 : 0);
      return;
    }
    guide.classList.add('is-fly');
    place(i, true);
    later(function () {
      guide.classList.remove('is-fly');
      poseFor(i);
      say(line);
    }, 900);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) go(sections.indexOf(e.target));
    });
  }, { rootMargin: '-45% 0px -45% 0px' });   // the section crossing the middle of the screen

  /* ── hide / show ─────────────────────────────────────── */
  var hidden = store(true);
  function apply() {
    root.classList.toggle('guide-on', !hidden);
    guide.hidden = hidden;
    showBtn.hidden = !hidden;
  }
  function setHidden(h) {
    hidden = h;
    store(false, h);
    quiet();
    apply();
    if (h) { current = -1; io.disconnect(); return; }
    measure();
    start();
  }
  guide.querySelector('.guide__close').addEventListener('click', function () {
    setHidden(true);
    showBtn.focus();
  });
  showBtn.addEventListener('click', function () {
    setHidden(false);
    guide.querySelector('.guide__fig').focus();
  });
  guide.querySelector('.guide__fig').addEventListener('click', function () {
    if (current < 0 || guide.classList.contains('is-fly')) return;
    quiet();
    poseFor(current);
    say(sections[current].getAttribute('data-guide'));
  });

  function start() {
    if (!reduced) {
      guide.classList.add('is-enter');
      later(function () { guide.classList.remove('is-enter'); }, 950);
    }
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ── boot ─────────────────────────────────────────────── */
  apply();
  measure();
  if (!hidden) start();

  // re-measure when the layout changes (fonts, images, resize, the flash deck
  // changing height) — then snap to the current perch without a jump
  var mt;
  function remeasure() {
    clearTimeout(mt);
    mt = setTimeout(function () {
      if (hidden) return;
      measure();
      if (current >= 0 && !guide.classList.contains('is-fly')) place(current, false);
    }, 120);
  }
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
})();
