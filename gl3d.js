/* ═══════════════════════════════════════════════════════════
   3D scroll scene — raw WebGL2, no libraries (~12 KB).

   A few hundred cubes ("data blocks") re-assemble into a new
   shape for every section as you scroll:
     0 hero      → floating cloud
     1 work      → double-helix timeline
     2 projects  → 3D bar chart / skyline
     3 skills    → orbit rings
     4 record    → rolling ledger sheet
     5 contact   → everything locks into one solid cube

   Performance:
   • one draw call; every shape lives in a float texture and
     the GPU does the morphing, so scrolling costs ~nothing on JS
   • fewer cubes + lower resolution on phones
   • measures real frame rate and steps quality down by itself
   • stops when the tab is hidden; idles at 30fps when nothing moves
   • no WebGL2 / reduced motion / data saver → the old 2D canvas stays
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var cv = document.querySelector('.bg__gl');
  if (!cv) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (reduced || saveData) { cv.remove(); return; }

  var gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) { cv.remove(); return; }

  root.classList.add('has-3d');   // tells script.js to skip the 2D background

  /* ── device tier ─────────────────────────────────────── */
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var cores = navigator.hardwareConcurrency || 4;
  var TIERS = [
    { n: 220, dpr: 0.75 },
    { n: 420, dpr: 1.0  },
    { n: 640, dpr: 1.25 }
  ];
  var tier = (coarse || window.innerWidth < 720 || cores <= 4) ? 1 : 2;

  /* ── shaders ─────────────────────────────────────────── */
  var VS = [
    '#version 300 es',
    'precision highp float; precision highp int; precision highp sampler2D;',
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aNor;',
    'layout(location=2) in vec4 aSeed;',          // x unused, y phase, z colour, w spin
    'uniform sampler2D uForm;',                    // width N, height 6: xyz pos, w = stagger*1000 + size
    'uniform float uStage, uTime;',
    'uniform float uOrder[6];',
    'uniform vec3 uPal[6];',
    'uniform mat4 uProj, uView, uModel;',
    'out vec3 vNor; out vec3 vCol; out float vDepth;',
    'vec3 rot(vec3 v, vec3 k, float a){ float c=cos(a), s=sin(a); return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c); }',
    'void main(){',
    '  int id = gl_InstanceID;',
    '  float s = clamp(uStage, 0.0, 5.0);',
    '  float fa = floor(s); int a = int(fa); int b = min(a + 1, 5);',
    '  float f = s - fa;',
    '  vec4 A = texelFetch(uForm, ivec2(id, a), 0);',
    '  vec4 B = texelFetch(uForm, ivec2(id, b), 0);',
    '  float st = floor(B.w) / 1000.0 * 0.5;',      // stagger towards the destination shape
    '  float g = clamp((f - st) / 0.5, 0.0, 1.0);',
    '  g = g * g * (3.0 - 2.0 * g);',
    '  float bump = sin(g * 3.14159);',
    '  vec3 sw = vec3(sin(aSeed.y*7.1), cos(aSeed.y*3.3), sin(aSeed.y*5.7));',
    '  vec3 p = mix(A.xyz, B.xyz, g) + sw * bump * 1.4;',   // cubes swoop between shapes
    '  float size = mix(fract(A.w), fract(B.w), g);',
    '  float order = mix(uOrder[a], uOrder[b], g);',
    '  p.y += sin(uTime * 0.7 + aSeed.y * 6.2831) * 0.07 * (1.0 - order * 0.8);',
    '  vec3 axis = normalize(vec3(sin(aSeed.y*12.9), cos(aSeed.y*7.3), sin(aSeed.y*4.1 + 1.0)) + 1e-4);',
    '  float ang = (uTime * aSeed.w * 0.4 + aSeed.y * 6.28) * (1.0 - order) + bump * 2.5;',
    '  vec3 lp = rot(aPos * size, axis, ang);',
    '  vec3 n  = rot(aNor, axis, ang);',
    '  vec4 vp = uView * uModel * vec4(p + lp, 1.0);',
    '  vDepth = -vp.z;',
    '  vNor = mat3(uView) * mat3(uModel) * n;',     // view space, so the rim light hugs silhouettes
    '  vCol = uPal[int(aSeed.z)];',
    '  gl_Position = uProj * vp;',
    '}'
  ].join('\n');

  var FS = [
    '#version 300 es',
    'precision mediump float;',
    'in vec3 vNor; in vec3 vCol; in float vDepth;',
    'uniform vec2 uFog;',
    'out vec4 o;',
    'void main(){',
    '  vec3 n = normalize(vNor);',
    '  float d = max(dot(n, normalize(vec3(0.35, 0.8, 0.55))), 0.0);',   // key light, top-right-front
    '  float h = 0.5 + 0.5 * n.y;',
    '  float rim = pow(1.0 - abs(n.z), 2.2);',                         // faces turned away from camera
    '  float glow = smoothstep(0.55, 0.9, max(vCol.g - vCol.r, 0.0));', // neon cubes self-light a little
    '  vec3 c = vCol * (0.28 + 0.72 * d) + vec3(0.03, 0.06, 0.04) * h;',
    '  c += vec3(0.13, 0.9, 0.48) * rim * 0.32;',                        // subtle green rim on the dark page
    '  c += vCol * glow * 0.35;',
    '  float a = 1.0 - smoothstep(uFog.x, uFog.y, vDepth);',   // far cubes melt into the page
    '  o = vec4(c * a, a);',
    '}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn('[3d] falling back to 2D:', e);
    root.classList.remove('has-3d'); cv.remove(); return;
  }
  gl.useProgram(prog);
  var U = {};
  ['uForm', 'uStage', 'uTime', 'uOrder', 'uPal', 'uProj', 'uView', 'uModel', 'uFog'].forEach(function (k) {
    U[k] = gl.getUniformLocation(prog, k);
  });

  /* ── cube mesh (24 verts, 36 indices) ────────────────── */
  var pos = [], nor = [], idx = [];
  [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].forEach(function (nv, f) {
    var ax = nv[0] ? 0 : nv[1] ? 1 : 2, u = (ax + 1) % 3, v = (ax + 2) % 3;
    var sgn = nv[ax];
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function (c) {
      var p = [0, 0, 0];
      p[ax] = .5 * sgn; p[u] = .5 * c[0] * sgn; p[v] = .5 * c[1];
      pos.push(p[0], p[1], p[2]); nor.push(nv[0], nv[1], nv[2]);
    });
    var o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  function buf(data, loc, size, divisor) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    if (divisor) gl.vertexAttribDivisor(loc, 1);
    return b;
  }
  buf(new Float32Array(pos), 0, 3);
  buf(new Float32Array(nor), 1, 3);
  var seedBuf = buf(new Float32Array(4), 2, 4, true);
  var ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

  var tex = gl.createTexture();

  /* ── palette (matches styles.css: accent #22E57A) ─────── */
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  //            deep green  forest     graphite   near-black  neon       mint
  var PAL = ['#138A4C', '#1D4D33', '#2C3530', '#101411', '#22E57A', '#7CFFB2'].map(hex);
  var PAL_W = [.30, .26, .18, .14, .08, .04];
  gl.uniform3fv(U.uPal, new Float32Array([].concat.apply([], PAL)));
  // 0 = tumbling freely, 1 = locked to the grid
  gl.uniform1fv(U.uOrder, new Float32Array([0, .55, 1, .2, .9, 1]));

  /* ── shapes ──────────────────────────────────────────── */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, r) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var N = 0;
  function build(n) {
    N = n;
    var r = rng(7);
    var data = new Float32Array(N * 6 * 4);
    function put(stage, i, x, y, z, size, stagger) {
      var o = (stage * N + i) * 4;
      data[o] = x; data[o + 1] = y; data[o + 2] = z;
      data[o + 3] = Math.floor(Math.max(0, Math.min(.999, stagger)) * 1000) + Math.min(.999, size);
    }
    // every shape gets its own random instance→slot order, so cubes cross paths when morphing
    function order() { var a = []; for (var i = 0; i < N; i++) a.push(i); return shuffle(a, r); }
    var i, k, o;

    // 0 · cloud
    o = order();
    for (i = 0; i < N; i++) {
      var u = r() * 2 - 1, th = r() * Math.PI * 2, rr = 2.6 + 4.2 * Math.cbrt(r()), q = Math.sqrt(1 - u * u);
      put(0, o[i], Math.cos(th) * q * rr, u * rr * .8, Math.sin(th) * q * rr, .12 + .32 * r() * r(), r());
    }

    // 1 · double helix
    o = order();
    for (i = 0; i < N; i++) {
      var t = i / N, strand = i % 2, rung = i % 7 === 0;
      var ang = t * Math.PI * 9 + strand * Math.PI, x = (t - .5) * 26;
      var rad = rung ? 1.7 * (r() * 2 - 1) : 1.7;
      put(1, o[i], x, Math.cos(ang) * rad, Math.sin(ang) * rad, rung ? .12 : .24, t);
    }

    // 2 · bar chart: columns built bottom-up
    var G = Math.max(5, Math.min(12, Math.round(Math.sqrt(N / 8))));
    var cols = [];
    for (var gx = 0; gx < G; gx++) for (var gz = 0; gz < G; gz++) {
      var w = .35 + .65 * Math.pow(.5 + .5 * Math.sin(gx * .9 + 1) * Math.cos(gz * .7 - .5), 1.5) + r() * .15;
      cols.push({ x: gx, z: gz, w: w });
    }
    var K = 1, cap = function (K) { return cols.reduce(function (s, c) { return s + Math.ceil(c.w * K); }, 0); };
    while (cap(K) < N) K += .25;
    var placed = 0, sp = .56, half = (G - 1) * sp / 2, levels = Math.ceil(K);
    o = order();
    for (var lv = 0; lv < levels && placed < N; lv++) {
      for (k = 0; k < cols.length && placed < N; k++) {
        if (Math.ceil(cols[k].w * K) <= lv) continue;
        put(2, o[placed], cols[k].x * sp - half, -2.4 + lv * sp, cols[k].z * sp - half, .48, lv / levels);
        placed++;
      }
    }

    // 3 · orbit rings around a core
    o = order();
    var rings = [{ r: 3.0, a: .5, b: .2 }, { r: 4.6, a: -.35, b: 1.1 }, { r: 6.2, a: .15, b: -.7 }];
    for (i = 0; i < N; i++) {
      var th3 = r() * Math.PI * 2;
      if (i < N * .12) {
        var cr = 1.1 * Math.cbrt(r()), cu = r() * 2 - 1, cq = Math.sqrt(1 - cu * cu);
        put(3, o[i], Math.cos(th3) * cq * cr, cu * cr, Math.sin(th3) * cq * cr, .14 + .2 * r(), 0);
        continue;
      }
      var R = rings[i % 3], jr = R.r + (r() - .5) * .5;
      var px = Math.cos(th3) * jr, py = (r() - .5) * .3, pz = Math.sin(th3) * jr;
      var y1 = py * Math.cos(R.a) - pz * Math.sin(R.a), z1 = py * Math.sin(R.a) + pz * Math.cos(R.a);
      var x2 = px * Math.cos(R.b) - y1 * Math.sin(R.b), y2 = px * Math.sin(R.b) + y1 * Math.cos(R.b);
      put(3, o[i], x2, y2, z1, .1 + .18 * r(), th3 / (Math.PI * 2));
    }

    // 4 · rolling ledger sheet, ripples out from the centre
    o = order();
    var S = Math.ceil(Math.sqrt(N)), sp4 = .62, h4 = (S - 1) * sp4 / 2;
    for (i = 0; i < N; i++) {
      var ix = i % S, iz = Math.floor(i / S);
      var x4 = ix * sp4 - h4, z4 = iz * sp4 - h4;
      var d4 = Math.sqrt(x4 * x4 + z4 * z4) / (h4 * 1.42);
      put(4, o[i], x4, Math.sin(x4 * .55) * Math.cos(z4 * .45) * 1.1 - .8, z4, .34, d4);
    }

    // 5 · one solid cube; leftovers orbit it
    o = order();
    var kk = Math.floor(Math.cbrt(N)), sp5 = .54, h5 = (kk - 1) * sp5 / 2, solid = kk * kk * kk;
    for (i = 0; i < N; i++) {
      if (i < solid) {
        var a5 = i % kk, b5 = Math.floor(i / kk) % kk, c5 = Math.floor(i / (kk * kk));
        put(5, o[i], a5 * sp5 - h5, b5 * sp5 - h5, c5 * sp5 - h5, .5, c5 / kk);
      } else {
        var th5 = r() * Math.PI * 2, r5 = h5 * 1.9 + 1 + r() * .6;
        put(5, o[i], Math.cos(th5) * r5, (r() - .5) * .4, Math.sin(th5) * r5, .1 + .08 * r(), .5 + r() * .5);
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 6, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var seeds = new Float32Array(N * 4);
    for (i = 0; i < N; i++) {
      var pick = r(), ci = 0, acc = PAL_W[0];
      while (pick > acc && ci < PAL_W.length - 1) acc += PAL_W[++ci];
      seeds[i * 4] = r(); seeds[i * 4 + 1] = r(); seeds[i * 4 + 2] = ci; seeds[i * 4 + 3] = .5 + r() * 1.5;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  }

  /* ── matrices ────────────────────────────────────────── */
  function perspective(fov, asp, n, f) {
    var t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
  }
  function lookAt(e, c) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz);
    zx /= l; zy /= l; zz /= l;
    var xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;   // up = +y
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function rotYX(ay, ax) {
    var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    return [cy, sx * sy, -cx * sy, 0, 0, cx, sx, 0, sy, -sx * cy, cx * cy, 0, 0, 0, 0, 1];
  }

  /* camera per shape: [eye, target]; "narrow" = phones, centred and pulled back */
  var CAM = [
    [[0, .5, 16],   [-3.2, 0, 0]],
    [[-5, 3.5, 14], [0, 0, 0]],
    [[12, 10, 18],  [-1.5, 0, 0]],
    [[0, -2.5, 13], [2.6, 0, 0]],
    [[0, 8.5, 11],  [0, -1, -1]],
    [[5, 3, 10.5],  [-2.4, 0, 0]]
  ];
  function camAt(s, narrow) {
    var a = Math.min(5, Math.floor(s)), b = Math.min(5, a + 1), f = s - a;
    f = f * f * (3 - 2 * f);
    var e = [], t = [];
    for (var j = 0; j < 3; j++) {
      e[j] = CAM[a][0][j] + (CAM[b][0][j] - CAM[a][0][j]) * f;
      t[j] = CAM[a][1][j] + (CAM[b][1][j] - CAM[a][1][j]) * f;
    }
    if (narrow) {
      t[0] = 0; e[0] *= .5; e[2] += 7; e[1] += 1;
      var lift = 2.6 * (1 - Math.min(1, s));   // phone hero: keep the cloud up behind the photo, off the headline
      t[1] -= lift; e[1] -= lift;
    }
    return [e, t];
  }

  /* ── scroll → stage ──────────────────────────────────── */
  var secs = ['.hero', '#work', '#systems', '#skills', '#record', '#contact'].map(function (s) { return document.querySelector(s); });
  var anchors = [0, 1, 2, 3, 4, 5];
  function absTop(el) { var t = 0; for (; el; el = el.offsetParent) t += el.offsetTop; return t; }
  function measure() {
    var vh = window.innerHeight, max = Math.max(1, root.scrollHeight - vh);
    var prev = 0;
    anchors = secs.map(function (el, k) {
      var a = k === 0 || !el ? prev : Math.min(max, Math.max(prev + 1, absTop(el) - vh * .55));
      prev = a; return a;
    });
  }
  function stageFor(y) {
    for (var k = 0; k < 5; k++) {
      if (y < anchors[k + 1]) {
        var p = (y - anchors[k]) / (anchors[k + 1] - anchors[k]);
        return k + Math.max(0, Math.min(1, (p - .35) / .65));   // hold each shape a while, then morph
      }
    }
    return 5;
  }

  /* ── sizing ──────────────────────────────────────────── */
  var W = 0, H = 0, dpr = 1, narrow = false;
  function resize(force) {
    var w = window.innerWidth, h = window.innerHeight;
    // phones: ignore the address bar sliding in and out (it would reallocate the canvas mid-scroll)
    if (!force && w === W && h <= H && H - h < 160) return;
    W = w; H = h;
    narrow = W < 820;
    dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniformMatrix4fv(U.uProj, false, perspective(narrow ? .95 : .8, W / H, .1, 80));
  }

  /* ── input ───────────────────────────────────────────── */
  var mx = 0, my = 0, smx = 0, smy = 0, lastInput = 0;
  if (!coarse) {
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; lastInput = performance.now();
    }, { passive: true });
  }
  window.addEventListener('scroll', function () { lastInput = performance.now(); }, { passive: true });

  /* ── loop ────────────────────────────────────────────── */
  var shown = stageFor(window.pageYOffset), t0 = performance.now(), last = t0, lastDraw = 0;
  var probe = { start: t0 + 1500, frames: 0, sum: 0 };

  function setTier(t) {
    tier = t;
    build(TIERS[tier].n);
    resize(true);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    var dt = Math.min(.1, (now - last) / 1000); last = now;

    var target = stageFor(window.pageYOffset);
    var moving = Math.abs(target - shown) > .001 || now - lastInput < 600;
    // nothing changing → 30fps is plenty and halves battery use
    if (!moving && now - lastDraw < 32) return;

    // frame-rate probe: keeps watching while things move (scrolling is when
    // jank shows); if the page can't hold ~48fps over 60 frames, drop a tier
    if (moving && now > probe.start && tier > 0) {
      probe.frames++; probe.sum += dt;
      if (probe.frames === 60) {
        if (probe.sum / 60 > 1 / 48) { setTier(tier - 1); probe = { start: now + 1000, frames: 0, sum: 0 }; }
        else { probe.frames = 0; probe.sum = 0; }
      }
    }

    shown += (target - shown) * (1 - Math.exp(-dt * 4.5));   // cinematic lag behind the scrollbar
    smx += (mx - smx) * (1 - Math.exp(-dt * 3));
    smy += (my - smy) * (1 - Math.exp(-dt * 3));
    lastDraw = now;

    var time = (now - t0) / 1000;
    var c = camAt(shown, narrow);
    c[0][0] += smx * 1.2; c[0][1] -= smy * .8;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uView, false, lookAt(c[0], c[1]));
    gl.uniformMatrix4fv(U.uModel, false, rotYX(time * .05 + shown * .55, Math.sin(time * .2) * .05));
    gl.uniform1f(U.uStage, shown);
    gl.uniform1f(U.uTime, time);
    var dist = Math.hypot(c[0][0] - c[1][0], c[0][1] - c[1][1], c[0][2] - c[1][2]);
    gl.uniform2f(U.uFog, dist - 2, dist + 9);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, N);
  }

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(U.uForm, 0);
  build(TIERS[tier].n);
  resize(true);
  measure();

  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { resize(false); measure(); }, 150);
  });
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  // batched: the page height can change every frame (e.g. the flash deck animating its height)
  var mq = 0;
  if ('ResizeObserver' in window) new ResizeObserver(function () {
    clearTimeout(mq); mq = setTimeout(measure, 100);
  }).observe(document.body);

  var raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancelAnimationFrame(raf);
    else { last = performance.now(); raf = requestAnimationFrame(loop); }
  });

  cv.addEventListener('webglcontextlost', function (e) {
    e.preventDefault(); cancelAnimationFrame(raf); cv.style.display = 'none';
  });

  window.__gl3d = { tier: function () { return tier; }, n: function () { return N; } };   // for debugging
})();
