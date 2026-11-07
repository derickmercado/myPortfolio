/* ═══════════════════════════════════════════════════════════
   Tour guide — an original inline-SVG character (a developer in
   a green hoodie, glasses and headphones) who walks visitors
   through the page and speaks each section's intro.

   • Each section's line lives in its data-guide attribute.
   • Wide screens (≥1100px): rides in a reserved left rail and
     hops to a new spot as each section arrives, pointing at it.
   • Small screens: a slim dock at the bottom (head-and-torso
     figure + its line), so the speech never floats over the
     page; the page is padded so nothing stays hidden under it.
   • No scroll listener and no rAF loop: an IntersectionObserver
     picks the section, CSS transitions do the moving, so it
     can't compete with the 3D scene (gl3d.js) for frames.
   • Reduced motion: static figure, text appears instantly.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = 'dmm-guide-hidden';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wideMq = window.matchMedia('(min-width: 1100px)');

  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-guide]'));
  if (!sections.length || !('IntersectionObserver' in window)) return;

  function store(get, val) {
    try {
      if (get) return localStorage.getItem(KEY) === '1';
      if (val) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY);
    } catch (e) { return false; }
  }

  /* ── the character ───────────────────────────────────── */
  var SKIN = '#C98B5E', SKIN_D = '#A86F47', HAIR = '#141414', HOOD = '#138A4C', HOOD_D = '#0E6B3A',
      NEON = '#22E57A', INK = '#0C0F0D';
  var SVG =
    '<svg class="guide__svg" viewBox="0 0 120 176" focusable="false">' +
      '<ellipse class="g-shadow" cx="60" cy="169" rx="27" ry="4.5" fill="#000" opacity=".5"/>' +
      '<g class="g-body">' +
        // legs + sneakers
        '<g class="g-leg g-leg--l"><rect x="46" y="120" width="13" height="38" rx="6" fill="#1C2A22"/>' +
          '<path d="M41 156h18a3 3 0 0 1 3 3v3.5H42a4 4 0 0 1-1-6.5z" fill="#E9F5EC"/>' +
          '<rect x="41" y="161" width="21" height="2.6" rx="1.3" fill="' + NEON + '"/></g>' +
        '<g class="g-leg g-leg--r"><rect x="61" y="120" width="13" height="38" rx="6" fill="#1C2A22"/>' +
          '<path d="M58 159a3 3 0 0 1 3-3h18a4 4 0 0 1 1 6.5H58z" fill="#E9F5EC"/>' +
          '<rect x="58" y="161" width="21" height="2.6" rx="1.3" fill="' + NEON + '"/></g>' +
        // back arm
        '<g class="g-arm g-arm--l"><rect x="27" y="77" width="13" height="37" rx="6.5" fill="' + HOOD_D + '"/>' +
          '<rect x="27" y="106" width="13" height="5" rx="2.5" fill="' + INK + '" opacity=".35"/>' +
          '<circle cx="33.5" cy="116" r="6" fill="' + SKIN + '"/></g>' +
        // hoodie
        '<path d="M35 81Q37 69 60 68Q83 69 85 81L89 121Q60 130 31 121Z" fill="' + HOOD + '"/>' +
        '<path d="M43 105h34l3 15Q60 125 40 120z" fill="' + HOOD_D + '"/>' +
        '<path d="M44 71Q60 84 76 71" stroke="' + HOOD_D + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M55 77v15M65 77v15" stroke="' + NEON + '" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="55" cy="93" r="1.8" fill="' + NEON + '"/><circle cx="65" cy="93" r="1.8" fill="' + NEON + '"/>' +
        // front arm (waves / points)
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
  guide.className = 'guide';
  guide.innerHTML =
    '<div class="guide__mover">' +
      '<p class="guide__bubble" aria-hidden="true"><span class="guide__text"></span><span class="guide__caret"></span></p>' +
      '<button type="button" class="guide__fig" aria-label="Guide: replay the last message">' +
        '<span class="guide__flip">' + SVG + '</span></button>' +
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

  /* ── layout (computed on resize only, never during scroll) ── */
  var wide = false, spots = [];
  var FIG_H = 141;                          // 96px-wide figure at 120:176
  var FRACS = [.44, .52, .46, .56, .48, .54];

  var svgEl = guide.querySelector('.guide__svg');
  function layout() {
    wide = wideMq.matches;
    root.classList.toggle('guide-full', wide && !hidden);
    root.classList.toggle('guide-compact', !wide && !hidden);
    // dock mode shows head and torso only, so the figure fits the 64px bar
    svgEl.setAttribute('viewBox', wide ? '0 0 120 176' : '16 4 88 104');
    if (!wide) return;
    var vh = window.innerHeight;
    var rail = parseFloat(getComputedStyle(root).getPropertyValue('--rail')) || 236;
    var x = 20;
    guide.style.setProperty('--bubble-w', Math.max(150, rail - x - 30) + 'px');
    spots = FRACS.map(function (f) {
      var y = Math.round(vh * f - FIG_H / 2);
      return Math.max(230, Math.min(vh - FIG_H - 24, y));   // keep room above for the bubble, below for the feet
    });
    mover.style.transform = 'translate3d(' + x + 'px,' + (spots[current] || spots[0]) + 'px,0)';
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
    quiet();
    guide.classList.add('is-saying');
    guide.classList.remove('is-done');
    if (reduced) { textEl.textContent = text; done(); return; }
    var chars = Array.from(text), i = 0;   // Array.from keeps emoji whole
    textEl.textContent = '';
    mouthTimer = setInterval(function () { guide.classList.toggle('is-mouth'); }, 110);
    (function tick() {
      textEl.textContent = chars.slice(0, ++i).join('');
      if (i < chars.length) later(tick, chars[i - 1] === '.' || chars[i - 1] === ',' ? 220 : 28);
      else done();
    })();
  }
  function done() {
    clearInterval(mouthTimer);
    guide.classList.remove('is-mouth');
    guide.classList.add('is-done');
  }

  function pose(name) {
    guide.classList.remove('pose-wave', 'pose-point', 'pose-cheer');
    if (name) guide.classList.add('pose-' + name);
  }

  /* ── moving between sections ─────────────────────────── */
  var current = -1;
  function go(i) {
    if (i === current || hidden) return;
    var first = current === -1;
    current = i;
    var p = i === 0 ? 'wave' : i === sections.length - 1 ? 'cheer' : 'point';

    if (wide && !first) {
      mover.style.transform = 'translate3d(20px,' + spots[i] + 'px,0)';
    }
    if (!reduced && !first) {
      // restart the hop without a forced reflow: drop the class, re-add it two frames later
      guide.classList.remove('is-hop', 'is-walk');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          guide.classList.add('is-hop', 'is-walk');
          later(function () { guide.classList.remove('is-hop', 'is-walk'); }, 720);
        });
      });
    }
    pose(p);
    var line = sections[i].getAttribute('data-guide');
    if (first) later(function () { say(line); }, reduced ? 0 : 650);
    else later(function () { say(line); }, reduced ? 0 : 380);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) go(sections.indexOf(e.target));
    });
  }, { rootMargin: '-45% 0px -45% 0px' });   // the section crossing the middle of the screen

  /* ── hide / show ─────────────────────────────────────── */
  var hidden = store(true);
  function setHidden(h) {
    hidden = h;
    store(false, h);
    quiet();
    guide.hidden = h;
    showBtn.hidden = !h;
    if (h) { current = -1; io.disconnect(); layout(); return; }
    layout();
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
    if (current < 0) return;
    pose(current === 0 ? 'wave' : current === sections.length - 1 ? 'cheer' : 'point');
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
  guide.hidden = hidden;
  showBtn.hidden = !hidden;
  layout();
  if (!hidden) start();

  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(layout, 150);
  });
  wideMq.addEventListener('change', function () {
    layout();
    if (!hidden && current >= 0) say(sections[current].getAttribute('data-guide'));
  });
})();
