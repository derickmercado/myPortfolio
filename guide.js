/* ═══════════════════════════════════════════════════════════
   Tour guide — an original inline-SVG character (a developer in
   an amber hoodie, glasses and headphones) with a jetpack, who
   flies visitors through the page and speaks each section's intro.

   • He flies in with a loop, then hovers above the first card of
     whichever section is on screen and says that section's line
     (the text lives in each section's data-guide attribute).
   • When that spot scrolls away he cruises down to the bottom-right
     corner and tags along; the next section sends him flying again.
   • Flights follow a curved path, he banks into turns, the jets
     flare while you scroll, and he leaves a short spark trail.
   • One small rAF loop that only runs while he is moving or the
     page is scrolling; it writes transforms only and reads no
     layout (card positions are measured on load/resize).
   • Reduced motion: he stays parked in the corner, text appears
     instantly.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = 'dmm-guide-hidden';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wideMq = window.matchMedia('(min-width: 1100px)');

  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-guide]'));
  if (!sections.length || !('IntersectionObserver' in window)) return;

  // the card he hovers above in each section (same order as the sections)
  var PERCH = ['.hero__actions .btn:last-child', '.entries > .entry', '.projects > .proj',
               '.skills > .skills__row', '.flash', '.contact'];

  function store(get, val) {
    try {
      if (get) return localStorage.getItem(KEY) === '1';
      if (val) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY);
    } catch (e) { return false; }
  }

  /* ── the character (viewBox 0 4 120 146; he hovers; flames end near y=148) ── */
  // Cream hoodie and denim so he stands out on the dark page; amber is kept
  // for the accents (headphones, jetpack, drawstrings) like the rest of the site.
  // Every big shape has a thin dark outline so he reads as one clean sticker.
  var SKIN = '#C98B5E', SKIN_D = '#A86F47', HAIR = '#1B1613', HAIR_L = '#3D322B',
      HOOD = '#EFE6D6', HOOD_D = '#D3C6AF', HOOD_DD = '#B9AA90',
      NEON = '#F2B13C', NEON_D = '#B9802A', INK = '#100E0C', JEANS = '#3C5675', JEANS_D = '#2C4058';
  var OL = ' stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"';
  var VB_TOP = 4, VB_H = 146;
  var SVG =
    '<svg class="guide__svg" viewBox="0 ' + VB_TOP + ' 120 ' + VB_H + '" focusable="false">' +
      '<g class="g-body">' +
        // jetpack: two amber tanks behind the arms, their nozzles and flames
        '<g class="g-jet">' +
          '<path class="g-flame" d="M22.5 124Q21 134 28 149Q35 134 33.5 124Z" fill="' + NEON + '" opacity=".92"/>' +
          '<path class="g-flame" d="M25.2 124Q24.5 130 28 138Q31.5 130 30.8 124Z" fill="#FFF3D6"/>' +
          '<path class="g-flame g-flame--r" d="M86.5 124Q85 134 92 149Q99 134 97.5 124Z" fill="' + NEON + '" opacity=".92"/>' +
          '<path class="g-flame g-flame--r" d="M89.2 124Q88.5 130 92 138Q95.5 130 94.8 124Z" fill="#FFF3D6"/>' +
          '<rect x="20.5" y="92" width="15" height="29" rx="7"' + OL + ' fill="' + NEON + '"/>' +
          '<rect x="84.5" y="92" width="15" height="29" rx="7"' + OL + ' fill="' + NEON + '"/>' +
          '<path d="M24 97v18M88 97v18" stroke="#FFD27A" stroke-width="2.4" stroke-linecap="round"/>' +
          '<path d="M21.5 106h13M85.5 106h13" stroke="' + NEON_D + '" stroke-width="2.4"/>' +
          '<path d="M23 120h10l-1.5 5h-7zM87 120h10l-1.5 5h-7z" fill="#3A332C"' + OL + '/>' +
        '</g>' +
        // legs hang free while he hovers
        '<g class="g-shin g-shin--l"><rect x="44.5" y="112" width="11.5" height="23" rx="5"' + OL + ' fill="' + JEANS + '"/>' +
          '<path d="M47 118v12" stroke="' + JEANS_D + '" stroke-width="2" stroke-linecap="round"/>' +
          '<path d="M41 133.5h16a3 3 0 0 1 3 3v3.5H42a4 4 0 0 1-1-6.5z"' + OL + ' fill="#F4EFE8"/>' +
          '<rect x="41.5" y="138" width="18" height="2.4" rx="1.2" fill="' + NEON + '"/></g>' +
        '<g class="g-shin g-shin--r"><rect x="64" y="112" width="11.5" height="23" rx="5"' + OL + ' fill="' + JEANS + '"/>' +
          '<path d="M73 118v12" stroke="' + JEANS_D + '" stroke-width="2" stroke-linecap="round"/>' +
          '<path d="M60 136.5a3 3 0 0 1 3-3h16a4 4 0 0 1 1 6.5H60z"' + OL + ' fill="#F4EFE8"/>' +
          '<rect x="60.5" y="138" width="18" height="2.4" rx="1.2" fill="' + NEON + '"/></g>' +
        // back arm
        '<g class="g-arm g-arm--l"><rect x="27" y="77" width="13" height="37" rx="6.5"' + OL + ' fill="' + HOOD_D + '"/>' +
          '<rect x="27" y="105" width="13" height="5" rx="2.5" fill="' + HOOD_DD + '"/>' +
          '<circle cx="33.5" cy="116" r="6"' + OL + ' fill="' + SKIN + '"/></g>' +
        // hoodie: body, shading down the left side, kangaroo pocket, hood collar, drawstrings
        '<path d="M35 81Q37 69 60 68Q83 69 85 81L88 119Q60 127 32 119Z"' + OL + ' fill="' + HOOD + '"/>' +
        '<path d="M35.6 84Q38 99 37.5 119.6Q34 119.2 32 119L35 81Z" fill="' + HOOD_D + '"/>' +
        '<path d="M43 103h34l2.5 14Q60 122 40.5 117z" fill="' + HOOD_D + '"/>' +
        '<path d="M45 103.5Q60 107 75 103.5" stroke="' + HOOD_DD + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
        '<path d="M42 71Q60 87 78 71" stroke="' + HOOD_D + '" stroke-width="6" fill="none" stroke-linecap="round"/>' +
        '<path d="M42 71Q60 87 78 71" stroke="' + HOOD_DD + '" stroke-width="1.4" fill="none" stroke-linecap="round" transform="translate(0 2.6)"/>' +
        '<path d="M55 78v14M65 78v14" stroke="' + NEON + '" stroke-width="2.2" stroke-linecap="round"/>' +
        '<rect x="53.2" y="91.5" width="3.6" height="4" rx="1" fill="' + NEON_D + '"/><rect x="63.2" y="91.5" width="3.6" height="4" rx="1" fill="' + NEON_D + '"/>' +
        // front arm (waves)
        '<g class="g-arm g-arm--r"><rect x="80" y="77" width="13" height="37" rx="6.5"' + OL + ' fill="' + HOOD + '"/>' +
          '<rect x="80" y="105" width="13" height="5" rx="2.5" fill="' + HOOD_D + '"/>' +
          '<circle cx="86.5" cy="116" r="6"' + OL + ' fill="' + SKIN + '"/></g>' +
        // head
        '<g class="g-head">' +
          '<rect x="54" y="57" width="12" height="14" rx="4" fill="' + SKIN_D + '"/>' +
          '<circle cx="36" cy="44" r="5"' + OL + ' fill="' + SKIN_D + '"/><circle cx="84" cy="44" r="5"' + OL + ' fill="' + SKIN_D + '"/>' +
          '<circle cx="60" cy="42" r="24"' + OL + ' fill="' + SKIN + '"/>' +
          '<path d="M44 58Q60 68 76 58Q70 65.5 60 65.5Q50 65.5 44 58Z" fill="' + SKIN_D + '" opacity=".45"/>' +
          // hair: a full top with a swept fringe and a light streak
          '<path d="M35.5 44Q31 17 58 13.5Q87 11.5 86 41Q83 32 76 29.5Q73 35 65 31.5Q59 37.5 51 32.5Q44 37 38.5 33.5Q36.5 38 35.5 44Z"' + OL + ' fill="' + HAIR + '"/>' +
          '<path d="M48 20Q60 15 73 19.5" stroke="' + HAIR_L + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
          // headphones
          '<path d="M33 45Q32 11 60 11Q88 11 87 45" stroke="' + INK + '" stroke-width="7" fill="none" stroke-linecap="round"/>' +
          '<path d="M33 45Q32 11 60 11Q88 11 87 45" stroke="' + NEON + '" stroke-width="4" fill="none" stroke-linecap="round"/>' +
          '<rect x="27" y="35.5" width="11" height="18" rx="4.5" fill="#2A2520"' + OL + '/>' +
          '<rect x="82" y="35.5" width="11" height="18" rx="4.5" fill="#2A2520"' + OL + '/>' +
          '<rect x="29.5" y="39" width="6" height="11" rx="3" fill="' + NEON + '"/>' +
          '<rect x="84.5" y="39" width="6" height="11" rx="3" fill="' + NEON + '"/>' +
          // brows, eyes, glasses, nose, cheeks, mouth
          '<path d="M45.5 32.5q5-3.6 10 0M64.5 32.5q5-3.6 10 0" stroke="' + HAIR + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
          '<g class="g-eyes"><ellipse cx="50.5" cy="41.5" rx="2.4" ry="2.8" fill="' + HAIR + '"/>' +
            '<ellipse cx="69.5" cy="41.5" rx="2.4" ry="2.8" fill="' + HAIR + '"/>' +
            '<circle cx="51.4" cy="40.4" r=".8" fill="#fff"/><circle cx="70.4" cy="40.4" r=".8" fill="#fff"/></g>' +
          '<rect x="43" y="35.5" width="15" height="11.5" rx="4" fill="rgba(255,255,255,.12)" stroke="' + INK + '" stroke-width="2.2"/>' +
          '<rect x="62" y="35.5" width="15" height="11.5" rx="4" fill="rgba(255,255,255,.12)" stroke="' + INK + '" stroke-width="2.2"/>' +
          '<path d="M45.5 38.5l3-2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>' +
          '<path d="M64.5 38.5l3-2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>' +
          '<path d="M58 40.5h4" stroke="' + INK + '" stroke-width="2.2"/>' +
          '<path d="M60.5 46.5q1.8 2.6-.6 3.6" stroke="' + SKIN_D + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
          '<ellipse cx="45.5" cy="52" rx="3.4" ry="2.4" fill="#E07A6A" opacity=".4"/><ellipse cx="74.5" cy="52" rx="3.4" ry="2.4" fill="#E07A6A" opacity=".4"/>' +
          '<g class="g-mouth">' +
            '<path class="g-mouth__shut" d="M53.5 54Q60 59.5 66.5 54" stroke="#5A2A1E" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
            '<g class="g-mouth__open"><path d="M54 53.5h12Q66 61 60 61Q54 61 54 53.5Z" fill="#4A1F17"/>' +
              '<path d="M55.5 53.8h9v1.8h-9z" fill="#fff"/>' +
              '<ellipse cx="60" cy="59" rx="3" ry="1.5" fill="#D9655A"/></g>' +
          '</g>' +
        '</g>' +
      '</g>' +
    '</svg>';

  var guide = document.createElement('div');
  guide.className = 'guide bubble-left';
  var sparks = '';
  for (var k = 0; k < 14; k++) sparks += '<i class="guide__spark"></i>';
  guide.innerHTML =
    '<div class="guide__sparks" aria-hidden="true">' + sparks + '</div>' +
    '<div class="guide__mover">' +
      '<p class="guide__bubble" aria-hidden="true"><span class="guide__text"></span><span class="guide__caret"></span></p>' +
      '<div class="guide__tilt"><button type="button" class="guide__fig" aria-label="Guide: replay the last message">' + SVG + '</button></div>' +
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
  var tilt = guide.querySelector('.guide__tilt');
  var textEl = guide.querySelector('.guide__text');
  var sparkEls = Array.prototype.slice.call(guide.querySelectorAll('.guide__spark'));
  var canAnimate = typeof tilt.animate === 'function';

  /* ── geometry (measured on load/resize only, never during scroll) ── */
  var spots = [];            // per section, in page coordinates: { x, y }
  var figW = 104, figH = 126, vw = 0, vh = 0, topSafe = 84;
  var DOCK_SCALE = .72;

  // layout offsets ignore transforms, so reveal slides and hover lifts don't skew them
  function abs(el) {
    var x = 0, y = 0;
    for (var e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function measure() {
    var wide = wideMq.matches;
    figW = wide ? 104 : 74;
    figH = figW * VB_H / 120;
    guide.style.setProperty('--fig-w', figW + 'px');
    vw = root.clientWidth; vh = window.innerHeight;
    var bar = document.querySelector('.topbar');
    topSafe = (bar ? bar.offsetHeight : 72) + 6;
    spots = sections.map(function (s, i) {
      var el = s.querySelector(PERCH[i]);
      if (!el) return spots[i - 1] || { x: vw - figW - 16, y: 200 };
      var a = abs(el), x, y;
      if (i === 0 && wide) {            // hero: hovering just right of the buttons
        x = a.x + a.w + 34; y = a.y + a.h - figH + 62;
      } else {                          // above the card's top-right corner, jets just over its edge
        x = a.x + a.w - figW - (wide ? 28 : 6); y = a.y - figH + (i === 0 || i === 4 ? 2 : 12);   // (kept clear of the buttons / tab row)
      }
      return { x: Math.round(Math.max(8, Math.min(vw - figW - 8, x))), y: Math.round(y) };
    });
  }

  function dockPos() {
    return { x: vw - figW - (wideMq.matches ? 10 : 2), y: vh - figH - 4 };
  }

  /* ── flight state ────────────────────────────────────── */
  var current = -1;                  // section index
  var mode = '';                     // 'spot' (hovering by the section) | 'dock' (corner)
  var pos = { x: 0, y: 0 };          // viewport position of the figure's top-left
  var flight = null;                 // { x0, y0, t0, dur, loop, dir }
  var rot = 0, scale = 1, lag = 0, sv = 0;
  var lastY = window.pageYOffset, lastT = 0, lastScroll = 0, lastSpark = 0, sparkI = 0;
  var raf = 0, pending = null, hideTimer = 0;

  function wantMode() {
    if (current < 0) return 'dock';
    var y = spots[current].y - window.pageYOffset;
    // he stays by the section only while that spot is comfortably on screen
    return (y >= topSafe && y <= vh - figH - 8) ? 'spot' : 'dock';
  }
  function targetFor(m) {
    if (m === 'spot') return { x: spots[current].x, y: spots[current].y - window.pageYOffset };
    return dockPos();
  }

  function setBubbleSide() {
    var docked = mode === 'dock';
    var cx = pos.x + figW / 2;
    var side = cx > vw / 2 ? 'left' : 'right';
    var room = side === 'left' ? pos.x - 18 : vw - (pos.x + figW) - 22;
    guide.classList.toggle('bubble-left', side === 'left');
    guide.classList.toggle('bubble-right', side === 'right');
    guide.classList.toggle('is-docked', docked);
    guide.style.setProperty('--bubble-w', Math.max(140, Math.min(wideMq.matches ? 270 : 236, Math.round(room))) + 'px');
  }

  function write() {
    mover.style.transform = 'translate3d(' + pos.x.toFixed(1) + 'px,' + (pos.y + lag).toFixed(1) + 'px,0)';
    tilt.style.transform = 'rotate(' + rot.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';
  }

  function fly(toMode, loop) {
    mode = toMode;
    var t = targetFor(mode);
    var dist = Math.hypot(t.x - pos.x, t.y - pos.y);
    flight = {
      x0: pos.x, y0: pos.y, s0: scale, t0: performance.now(),
      dur: Math.max(650, Math.min(1500, 480 + dist * 1.05)) + (loop ? 550 : 0),
      loop: !!loop, dir: t.x >= pos.x ? 1 : -1,
      lift: Math.min(190, 40 + dist * .32)
    };
    guide.classList.add('is-fly');
    wake();
  }

  function emitSpark(now) {
    if (!canAnimate || now - lastSpark < 38) return;
    lastSpark = now;
    var el = sparkEls[sparkI++ % sparkEls.length];
    var side = sparkI % 2 ? .3 : .7;
    var x = pos.x + figW * side + (Math.random() - .5) * 6, y = pos.y + lag + figH * .9;
    var dx = (Math.random() - .5) * 26, dy = 22 + Math.random() * 26;
    el.animate([
      { transform: 'translate3d(' + x + 'px,' + y + 'px,0) scale(1)', opacity: .95 },
      { transform: 'translate3d(' + (x + dx) + 'px,' + (y + dy) + 'px,0) scale(.15)', opacity: 0 }
    ], { duration: 520 + Math.random() * 260, easing: 'cubic-bezier(.2,.6,.4,1)' });
  }

  function ease(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function frame(now) {
    raf = 0;
    var dt = Math.min(.05, (now - lastT) / 1000 || .016); lastT = now;

    // scroll speed → jets flare and he lags a little behind the page
    var y = window.pageYOffset;
    var v = (y - lastY) / dt; lastY = y;
    sv += (v - sv) * Math.min(1, dt * 10);
    var lagTo = Math.max(-34, Math.min(34, -sv * .03));
    lag += (lagTo - lag) * Math.min(1, dt * 7);
    var scrolling = now - lastScroll < 160;

    // the spot scrolled away (or came back): change where he lives
    var want = wantMode();
    if (want !== mode && current >= 0) fly(want, false);

    var px = pos.x, rotTo = 0, scaleTo = mode === 'dock' ? DOCK_SCALE : 1;
    var t = targetFor(mode);
    if (flight) {
      var p = Math.min(1, (now - flight.t0) / flight.dur), e = ease(p);
      var arc = Math.sin(e * Math.PI);                       // lifts up and over
      pos.x = flight.x0 + (t.x - flight.x0) * e;
      pos.y = flight.y0 + (t.y - flight.y0) * e - arc * flight.lift;
      scale = flight.s0 + (scaleTo - flight.s0) * e;
      var spin = 0;
      if (flight.loop) {                                     // a loop-the-loop mid-flight
        var u = Math.max(0, Math.min(1, (p - .22) / .5)), ue = ease(u), R = Math.min(84, vh * .12);
        pos.x += Math.sin(ue * Math.PI * 2) * R * flight.dir;
        pos.y += (Math.cos(ue * Math.PI * 2) - 1) * R;
        spin = ue * 360 * flight.dir;
      }
      rot = spin + Math.max(-26, Math.min(26, (pos.x - px) / dt * .05)) * (1 - e * e);
      emitSpark(now);
      if (p >= 1) {
        flight = null; rot = 0;
        guide.classList.remove('is-fly');
        setBubbleSide();
        if (pending) { var f = pending; pending = null; f(); }
      }
    } else {
      pos.x = t.x; pos.y = t.y;
      scale += (scaleTo - scale) * Math.min(1, dt * 8);
      rotTo = Math.max(-12, Math.min(12, -sv * .008));       // leans into the scroll
      rot += (rotTo - rot) * Math.min(1, dt * 8);
      if (scrolling && Math.abs(sv) > 500) emitSpark(now);
    }
    guide.classList.toggle('is-boost', !!flight || (scrolling && Math.abs(sv) > 250));
    write();

    if (flight || scrolling || Math.abs(lag) > .3 || Math.abs(rot) > .2 || Math.abs(scale - scaleTo) > .004) wake();
  }
  function wake() { if (!raf && !hidden && !reduced) raf = requestAnimationFrame(frame); }

  /* ── speech ──────────────────────────────────────────── */
  var timers = [], mouthTimer = 0;
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function quiet() {
    timers.forEach(clearTimeout); timers = [];
    clearInterval(mouthTimer); clearTimeout(hideTimer);
    guide.classList.remove('is-mouth');
  }

  function say(text) {
    clearInterval(mouthTimer); clearTimeout(hideTimer);
    setBubbleSide();
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
    // in the corner the bubble tidies itself away; tap him to hear it again
    hideTimer = setTimeout(function tidy() {
      if (mode === 'dock' && !flight) guide.classList.remove('is-saying');
      else hideTimer = setTimeout(tidy, 1500);
    }, 4200);
  }

  function poseFor(i) {
    guide.classList.remove('pose-wave', 'pose-point', 'pose-cheer');
    guide.classList.add(i === 0 ? 'pose-wave' : i === sections.length - 1 ? 'pose-cheer' : 'pose-point');
  }

  /* ── touring ─────────────────────────────────────────── */
  function go(i) {
    if (i === current || hidden) return;
    var first = current === -1;
    current = i;
    quiet();
    guide.classList.remove('is-saying');
    var line = sections[i].getAttribute('data-guide');

    if (reduced) {
      mode = 'dock'; pos = dockPos(); scale = DOCK_SCALE; write();
      poseFor(i); say(line);
      return;
    }
    if (first) {                      // fly in from off-screen
      pos = { x: -figW - 40, y: vh * .32 }; scale = .8; write();
      guide.classList.add('is-in');
    }
    pending = function () { poseFor(i); say(line); };
    guide.classList.remove('pose-wave', 'pose-point', 'pose-cheer');
    fly(wantMode(), first || i === sections.length - 1);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) go(sections.indexOf(e.target));
    });
  }, { rootMargin: '-45% 0px -45% 0px' });   // the section crossing the middle of the screen

  window.addEventListener('scroll', function () { lastScroll = performance.now(); wake(); }, { passive: true });

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
    if (h) {
      current = -1; flight = null; pending = null; io.disconnect();
      guide.classList.remove('is-fly', 'is-in', 'is-saying');
      return;
    }
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
    if (current < 0 || flight) return;
    quiet();
    poseFor(current);
    say(sections[current].getAttribute('data-guide'));
  });

  function start() {
    lastY = window.pageYOffset; lastT = performance.now();
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ── boot ─────────────────────────────────────────────── */
  apply();
  measure();
  if (!hidden) start();

  // re-measure when the layout changes (fonts, images, resize, the flash deck
  // changing height); he then glides to wherever his spot moved
  var mt;
  function remeasure() {
    clearTimeout(mt);
    mt = setTimeout(function () {
      if (hidden) return;
      measure();
      if (current < 0) return;
      if (reduced) { pos = dockPos(); write(); setBubbleSide(); return; }
      if (!flight) setBubbleSide();
      wake();
    }, 120);
  }
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
})();
