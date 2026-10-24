/* ═══════════════════════════════════════════════════════════
   Derick Myles M. Mercado — portfolio behaviour
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var hasIO = 'IntersectionObserver' in window;
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ── section headings: wrap so the text can rise out of a mask ── */
  qsa('.sec__head h2').forEach(function (h) {
    h.innerHTML = '<span class="mask"><span>' + h.innerHTML + '</span></span>';
  });

  /* ── stagger siblings so lists cascade in ───────────── */
  ['.entries', '.projects', '.skills'].forEach(function (sel) {
    qsa(sel).forEach(function (list) {
      qsa(':scope > .reveal', list).forEach(function (el, i) { el.dataset.d = i * 1.5; });
    });
  });

  /* ── scroll reveal ──────────────────────────────────── */
  var revealables = qsa('.reveal');

  revealables.forEach(function (el) {
    if (el.dataset.d) el.style.setProperty('--d', el.dataset.d);
  });

  if (hasIO && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ── pause looping animations while they're off screen ── */
  if (hasIO) {
    var pauser = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('is-paused', !e.isIntersecting); });
    });
    qsa('.hero').forEach(function (el) { pauser.observe(el); });
  }

  /* ── phone menu ─────────────────────────────────────── */
  var menuBtn = document.querySelector('.menu');
  var bar0 = document.querySelector('.topbar');
  if (menuBtn && bar0) {
    var setMenu = function (open) {
      bar0.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    menuBtn.addEventListener('click', function () { setMenu(!bar0.classList.contains('is-open')); });
    qsa('.nav a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bar0.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (bar0.classList.contains('is-open') && !bar0.contains(e.target)) setMenu(false);
    });
    window.matchMedia('(min-width: 721px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });
  }

  /* ── flash card deck: Education · Awards · Certifications · Training ── */
  (function () {
    var flash = document.querySelector('.flash');
    var deck  = flash && flash.querySelector('.flash__deck');
    if (!deck) return;
    var cards = qsa('.flash__card', deck);
    var tabs  = qsa('.flash__tab', flash);
    var dots  = qsa('.flash__dots i', flash);
    var num   = document.getElementById('flash-n');
    var cur = 0, busy = false;

    function show(next, dir) {
      if (next === cur || busy) return;
      var from = cards[cur], to = cards[next];
      dir = dir || (next > cur ? 1 : -1);

      to.hidden = false;
      to.classList.add('is-active');
      from.classList.remove('is-active');

      if (reduced) {
        from.hidden = true;
      } else {
        busy = true;
        deck.style.height = from.offsetHeight + 'px';           // freeze at the old card's height…
        from.classList.add(dir > 0 ? 'is-out-next' : 'is-out-prev');
        to.classList.add(dir > 0 ? 'is-in-next' : 'is-in-prev');
        requestAnimationFrame(function () {
          deck.style.height = to.offsetHeight + 'px';           // …then ease to the new one
        });
        setTimeout(function () {
          from.hidden = true;
          from.classList.remove('is-out-next', 'is-out-prev');
          to.classList.remove('is-in-next', 'is-in-prev');
          deck.style.height = '';
          busy = false;
        }, 560);
      }

      cur = next;
      tabs.forEach(function (t, i) {
        t.setAttribute('aria-selected', i === cur ? 'true' : 'false');
        t.tabIndex = i === cur ? 0 : -1;
      });
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === cur); });
      if (num) num.textContent = cur + 1;
    }

    function step(dir) { show((cur + dir + cards.length) % cards.length, dir); }   // wraps around

    qsa('.flash__arrow', flash).forEach(function (b) {
      b.addEventListener('click', function () { step(Number(b.dataset.dir)); });
    });
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });

    // ← / → anywhere in the deck; keep focus on the tab row if that's where it was
    flash.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
      if (tabs.indexOf(document.activeElement) !== -1) tabs[cur].focus();
    });

    // swipe left / right on the card
    var sx = 0, sy = 0, tracking = false;
    deck.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; tracking = true; });
    deck.addEventListener('pointerup', function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1);
    });
    deck.addEventListener('pointercancel', function () { tracking = false; });
  })();

  /* ── current section in the nav (no per-frame layout reads) ── */
  var links = qsa('.nav a[href^="#"]');
  if (hasIO) {
    var byTarget = new Map();
    links.forEach(function (a) {
      var id = a.getAttribute('href');
      var t = id === '#top' ? document.querySelector('.hero') : document.querySelector(id);
      if (t) byTarget.set(t, a);
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-current', a === byTarget.get(e.target)); });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    byTarget.forEach(function (_, t) { spy.observe(t); });
  }

  /* ── scroll-linked motion ───────────────────────────────
     One rAF per scroll, transforms/opacity only, and every
     layout measurement cached up front so a frame never
     forces a reflow. */
  var topbar   = document.querySelector('.topbar');
  var bar      = document.querySelector('.scrollbar i');
  var hero     = document.querySelector('.hero');
  var heroLede = document.querySelector('.hero__lede');
  var heroLines = qsa('.hero__title .line');
  var heroFloat = document.querySelector('.hero__float');
  var contact  = document.querySelector('.sec--contact');
  var m = { vh: 0, max: 1, heroH: 1, cTop: 0 };
  var lastY = -1, scrolled = null, ticking = false, lastContact = '';

  // Layout offsets ignore transforms, so a scaled element still measures true.
  function absTop(el) {
    var t = 0;
    for (; el; el = el.offsetParent) t += el.offsetTop;
    return t;
  }

  function measure() {
    var d = document.documentElement;
    m.vh = window.innerHeight;
    m.max = Math.max(1, d.scrollHeight - m.vh);
    if (hero) m.heroH = Math.max(1, hero.offsetHeight);
    if (contact) m.cTop = absTop(contact);
    lastY = -1;
    frame();
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  function frame() {
    ticking = false;
    var y = window.pageYOffset;
    if (y === lastY) return;
    lastY = y;

    if (bar) bar.style.transform = 'scaleX(' + (y / m.max).toFixed(4) + ')';

    var s = y > 8;
    if (s !== scrolled) { scrolled = s; topbar.classList.toggle('is-scrolled', s); }

    if (reduced) return;

    // Hero: the two headline words drift apart, the photo sinks and shrinks.
    if (y < m.heroH) {
      var p = y / m.heroH;
      if (heroLines[0]) heroLines[0].style.transform = 'translate3d(' + (-p * 22).toFixed(2) + '%,0,0)';
      if (heroLines[1]) heroLines[1].style.transform = 'translate3d(' + (p * 16).toFixed(2) + '%,0,0)';
      if (heroFloat) heroFloat.style.transform = 'translate3d(0,' + (p * 90).toFixed(1) + 'px,0) scale(' + (1 - p * .12).toFixed(4) + ') rotate(' + (p * -6).toFixed(2) + 'deg)';
      if (heroLede) heroLede.style.opacity = (1 - p * 1.1).toFixed(3);
    }

    // Contact card grows into place as it arrives.
    if (contact && y + m.vh > m.cTop) {
      var q = clamp01((y + m.vh - m.cTop) / (m.vh * .7));
      var sc = 'scale(' + (.88 + q * .12).toFixed(3) + ')';
      if (sc !== lastContact) { contact.style.transform = sc; lastContact = sc; }   // skip no-op style writes
    }
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }, { passive: true });

  var rsz;
  window.addEventListener('resize', function () {
    clearTimeout(rsz);
    rsz = setTimeout(measure, 120);
  });
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
})();

/* ═══════════════════════════════════════════════════════════
   Background: a looping data-flow sequence on one canvas
   1. node tree  →  2. data streams  →  3. orbit  →  4. converge & reveal
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var cv = document.querySelector('.bg__canvas');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var LOOP = 13;          // seconds per cycle
  var WORD = 'derick';    // written vertically in the final square
  var RGB = {
    teal: '20,184,166', orange: '249,115,22', yellow: '234,179,8', green: '34,197,94',
    blue: '59,130,246', red: '239,68,68', ink: '31,31,36', accent: '108,12,245'
  };

  var W = 0, H = 0, U = 0, SX = 0;
  var RED = 'rgb(' + RGB.red + ')', ORANGE = 'rgb(' + RGB.orange + ')';

  /* timing helpers */
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function outCubic(p) { return 1 - Math.pow(1 - p, 3); }
  function inCubic(p) { return p * p * p; }
  function inOut(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function backOut(p) { var c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
  function rgba(c, a) { return 'rgba(' + c + ',' + a + ')'; }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* scene 1: a small tree of nodes (x in tree-spread units, y in U, from centre) */
  var NODES = [
    { x: -.42, y:  0,   c: 'teal'   },
    { x: -.12, y: -.2,  c: 'orange' },
    { x: -.12, y:  .2,  c: 'yellow' },
    { x:  .2,  y: -.32, c: 'green'  },
    { x:  .2,  y: -.1,  c: 'teal'   },
    { x:  .2,  y:  .12, c: 'orange' },
    { x:  .2,  y:  .32, c: 'green'  }
  ];
  var EDGES = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];

  /* scene 2: data packets (y as a fraction of the viewport) */
  var STREAMS = [
    { c: 'blue',   y: .28, t0: 3.7 },
    { c: 'yellow', y: .5,  t0: 4.2 },
    { c: 'red',    y: .72, t0: 4.7 },
    { c: 'blue',   y: .62, t0: 5.5 },
    { c: 'red',    y: .38, t0: 5.9 },
    { c: 'yellow', y: .18, t0: 6.2 }
  ];

  /* scene 3: orbiting particles */
  var PARTS = [];
  for (var i = 0; i < 72; i++) {
    PARTS.push({
      r: .1 + Math.random() * .26,              // orbit radius, in U
      a: Math.random() * Math.PI * 2,           // start angle
      v: .7 + Math.random() * .9,               // angular speed
      s: 3 + Math.random() * 4,                 // square size, px
      c: Math.random() < .6 ? RGB.red : RGB.orange,
      o: .45 + Math.random() * .5,              // opacity
      d: Math.random() * .4                     // entrance delay
    });
  }

  /* Drawn at 1× even on retina screens: it's a soft, semi-transparent
     background, and 1× is a quarter of the pixels to fill and upload. */
  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    U = Math.min(W, H);
    SX = Math.min(W * .9, U * 1.7);
    cv.width = W; cv.height = H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* Glows are pre-painted once into small sprites and stamped with drawImage,
     instead of canvas shadowBlur (which re-blurs on every single frame). */
  var glowCache = {};
  function glow(c) {
    if (glowCache[c]) return glowCache[c];
    var g = document.createElement('canvas'), n = 64, gx = g.getContext('2d');
    g.width = g.height = n;
    var grad = gx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, rgba(c, .75));
    grad.addColorStop(.4, rgba(c, .25));
    grad.addColorStop(1, rgba(c, 0));
    gx.fillStyle = grad; gx.fillRect(0, 0, n, n);
    return (glowCache[c] = g);
  }

  function nodeBox(n) {
    var w = U * .19, h = U * .1;
    return { x: W / 2 + n.x * SX - w / 2, y: H / 2 + n.y * U - h / 2, w: w, h: h };
  }

  /* 1 ─ node tree builds itself, then the camera pans away */
  function drawTree(t, clock) {
    if (t > 4.4) return;
    var pan = inOut(seg(t, 3.1, 4.2));
    var fade = 1 - seg(t, 3.6, 4.3);

    ctx.save();
    ctx.translate(-pan * W * .9, 0);
    ctx.globalAlpha = fade;

    var boxes = NODES.map(function (n, i) {
      var b = nodeBox(n);
      b.y += Math.sin(clock * .9 + i) * 4;      // idle float
      return b;
    });

    // right-angle connectors draw themselves in
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(RGB.accent, .45);
    ctx.fillStyle = rgba(RGB.accent, .6);
    EDGES.forEach(function (e, k) {
      var p = seg(t, .5 + k * .15, 1.3 + k * .15);
      if (!p) return;
      var a = boxes[e[0]], b = boxes[e[1]];
      var x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, xm = (x1 + x2) / 2;
      var pts = [[x1, y1], [xm, y1], [xm, y2], [x2, y2]];
      var lens = [xm - x1, Math.abs(y2 - y1), x2 - xm];
      var left = (lens[0] + lens[1] + lens[2]) * p;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      for (var s = 0; s < 3 && left > 0; s++) {
        var f = Math.min(1, left / (lens[s] || 1));
        ctx.lineTo(pts[s][0] + (pts[s + 1][0] - pts[s][0]) * f,
                   pts[s][1] + (pts[s + 1][1] - pts[s][1]) * f);
        left -= lens[s];
      }
      ctx.stroke();
      if (p === 1) { ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill(); }
    });

    // layered, semi-transparent node cards
    boxes.forEach(function (b, i) {
      var p = outCubic(seg(t, .1 + i * .12, .7 + i * .12));
      if (!p) return;
      var c = RGB[NODES[i].c], k = .85 + .15 * p;
      ctx.save();
      ctx.globalAlpha = fade * p;
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(k, k); ctx.translate(-b.w / 2, -b.h / 2);
      rrect(10, 10, b.w, b.h, 12); ctx.fillStyle = rgba(c, .10); ctx.fill();   // card behind
      rrect(0, 0, b.w, b.h, 12);   ctx.fillStyle = rgba(c, .18); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(c, .6); ctx.stroke();
      ctx.fillStyle = rgba(c, .55); rrect(b.w * .12, b.h * .3,  b.w * .5, b.h * .14, 3); ctx.fill();
      ctx.fillStyle = rgba(c, .3);  rrect(b.w * .12, b.h * .58, b.w * .7, b.h * .12, 3); ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }

  /* 2 ─ packets shoot across with fading light trails */
  function drawStreams(t) {
    if (t < 3.6 || t > 7.6) return;
    var trail = Math.max(220, W * .35), size = 10;
    STREAMS.forEach(function (s) {
      var p = seg(t, s.t0, s.t0 + 1.4);
      if (p <= 0 || p >= 1) return;
      // constant speed like a shooting star: head enters at once, tail leaves last
      var x = -size + (W + trail + size * 2) * p, y = s.y * H, c = RGB[s.c];
      var g = ctx.createLinearGradient(x - trail, y, x, y);
      g.addColorStop(0, rgba(c, 0));
      g.addColorStop(1, rgba(c, .75));
      ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - trail, y); ctx.lineTo(x, y); ctx.stroke();
      ctx.drawImage(glow(c), x - 22, y - 22, 44, 44);
      ctx.fillStyle = rgba(c, 1);
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    });
  }

  /* 3 ─ particles orbit a glowing core, then collapse into it */
  function drawOrbit(t) {
    if (t < 6.9 || t > 10.1) return;
    var cx = W / 2, cy = H / 2;
    var inA  = seg(t, 6.9, 7.4);
    var col  = inCubic(seg(t, 9.0, 9.8));
    var spin = t - 6.9;

    // curved arrows in the four corners
    var aA = seg(t, 7.5, 7.9) * (1 - seg(t, 8.9, 9.3));
    if (aA) {
      var R = U * .42;
      ctx.strokeStyle = rgba(RGB.ink, .35 * aA); ctx.lineWidth = 1.5;
      for (var q = 0; q < 4; q++) {
        var mid = Math.PI / 4 + q * Math.PI / 2 + spin * .25, a1 = mid + .32;
        ctx.beginPath(); ctx.arc(cx, cy, R, mid - .32, a1); ctx.stroke();
        var hx = cx + Math.cos(a1) * R, hy = cy + Math.sin(a1) * R, dir = a1 + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(dir - .5) * 10, hy - Math.sin(dir - .5) * 10);
        ctx.moveTo(hx, hy); ctx.lineTo(hx - Math.cos(dir + .5) * 10, hy - Math.sin(dir + .5) * 10);
        ctx.stroke();
      }
    }

    // one setTransform per particle (no save/restore stack churn)
    PARTS.forEach(function (p) {
      var app = outCubic(seg(t, 6.95 + p.d, 7.5 + p.d));
      if (!app) return;
      var r = p.r * U * (.55 + .45 * app) * (1 - col);
      var a = p.a + spin * p.v + col * 4;               // they speed up as they fall in
      var cs = Math.cos(a), sn = Math.sin(a);
      ctx.globalAlpha = p.o * app * (1 - col * .6);
      ctx.fillStyle = p.c === RGB.red ? RED : ORANGE;
      ctx.setTransform(cs, sn, -sn, cs, cx + cs * r, cy + sn * r * .9);
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.globalAlpha = inA;
    var gs = 60 + col * 70;
    ctx.drawImage(glow(RGB.orange), cx - gs / 2, cy - gs / 2, gs, gs);
    ctx.fillStyle = ORANGE;
    ctx.beginPath(); ctx.arc(cx, cy, 6 + col * 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* 4 ─ everything merges into one square and the word appears */
  function drawReveal(t) {
    if (t < 9.6) return;
    var cx = W / 2, cy = H / 2, S = Math.max(130, U * .22);
    var g = seg(t, 9.6, 10.4), k = g < 1 ? backOut(g) : 1;
    var fade = 1 - seg(t, 12.2, 12.95);

    var ring = seg(t, 9.7, 10.5);                        // shock ring on impact
    if (ring > 0 && ring < 1) {
      ctx.strokeStyle = rgba(RGB.orange, .5 * (1 - ring)); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, S * .4 + ring * S * 1.2, 0, Math.PI * 2); ctx.stroke();
    }
    if (k <= 0) return;

    var s = S * k;
    ctx.save();
    ctx.globalAlpha = fade;
    // soft drop shadow faked with two offset layers (no shadowBlur)
    ctx.fillStyle = 'rgba(31,31,36,.05)';
    rrect(cx - s / 2 - 6, cy - s / 2 + 14, s + 12, s + 8, s * .1); ctx.fill();
    rrect(cx - s / 2 - 2, cy - s / 2 + 8, s + 4, s + 2, s * .09); ctx.fill();
    rrect(cx - s / 2, cy - s / 2, s, s, s * .08);
    ctx.fillStyle = '#EADFCB'; ctx.fill();

    var tA = seg(t, 10.3, 10.9);
    if (tA) {
      ctx.globalAlpha = fade * tA;
      ctx.translate(cx, cy); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#1F1F24';
      ctx.font = '600 ' + Math.round(S * .2) + 'px Poppins, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(WORD, 0, (1 - tA) * 8);
    }
    ctx.restore();
  }

  function render(t, clock) {
    ctx.clearRect(0, 0, W, H);
    drawTree(t, clock);
    drawStreams(t);
    drawOrbit(t);
    drawReveal(t);
  }

  /* Frame budget: 30fps normally, 15fps while the page is being scrolled
     (so scrolling gets the CPU), and nothing at all while the payroll
     pop-up covers the page or the tab is hidden. */
  var t0 = performance.now(), lastDraw = 0, lastScroll = 0;
  var root = document.documentElement;
  window.addEventListener('scroll', function () { lastScroll = performance.now(); }, { passive: true });

  function loop(now) {
    requestAnimationFrame(loop);        // browsers stop rAF while the tab is hidden
    if (root.classList.contains('modal-open')) return;
    var gap = now - lastScroll < 200 ? 66 : 33;
    if (now - lastDraw < gap) return;
    lastDraw = now;
    var clock = (now - t0) / 1000;
    render(clock % LOOP, clock);
  }

  function still() { render(3, 0); }    // reduced motion: just the finished node tree

  layout();
  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { layout(); if (reduced) still(); }, 150);
  });

  if (reduced) {
    still();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(still);
  } else {
    requestAnimationFrame(loop);
  }
})();
