/* ═══════════════════════════════════════════════════════════
   3D scroll scene — raw WebGL2, no libraries (~12 KB).

   A few hundred cubes ("data blocks") re-assemble into a new
   shape for every section as you scroll:
     0 hero      → </>  (a developer)
     1 work      → briefcase
     2 projects  → an app window
     3 skills    → gear (tools)
     4 record    → award medal
     5 contact   → envelope
   Each icon is drawn on a tiny 2D canvas and voxelized into cubes.

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
    '  float glow = smoothstep(0.55, 0.9, max(vCol.r - vCol.b, 0.0));', // neon cubes self-light a little
    '  vec3 c = vCol * (0.28 + 0.72 * d) + vec3(0.06, 0.05, 0.03) * h;',
    '  c += vec3(0.95, 0.69, 0.24) * rim * 0.28;',                        // subtle amber rim on the dark page
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

  /* ── palette (matches styles.css: accent #F2B13C) ─────── */
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  //            deep amber  brown      graphite   near-black  amber      light amber
  var PAL = ['#B9802A', '#5A4024', '#35302B', '#161310', '#F2B13C', '#FFD27A'].map(hex);
  var PAL_W = [.30, .26, .18, .14, .08, .04];
  gl.uniform3fv(U.uPal, new Float32Array([].concat.apply([], PAL)));
  // 0 = tumbling freely, 1 = locked to the grid
  gl.uniform1fv(U.uOrder, new Float32Array([1, 1, 1, 1, 1, 1]));

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

  /* ── icons (drawn in a 100×70 box; thick shapes survive coarse grids) ── */
  var ICONS = [
    { sweep: 'x', draw: function (c) {             // 0 hero: < > tag brackets around the photo (fitHero)
      c.lineWidth = 8; c.lineJoin = 'miter'; c.lineCap = 'square';
      c.beginPath(); c.moveTo(22, 12); c.lineTo(10, 35); c.lineTo(22, 58);
      c.moveTo(78, 12); c.lineTo(90, 35); c.lineTo(78, 58); c.stroke();
    } },
    { sweep: 'y', draw: function (c) {             // 1 work: briefcase
      c.lineWidth = 6; c.strokeRect(37, 6, 26, 14);
      c.fillRect(6, 18, 88, 46);
      c.globalCompositeOperation = 'destination-out'; c.fillRect(6, 36, 88, 5);
      c.globalCompositeOperation = 'source-over'; c.fillRect(43, 31, 14, 15);
    } },
    { sweep: 'y', draw: function (c) {             // 2 projects: an app window
      c.lineWidth = 6; c.strokeRect(5, 5, 90, 60); c.fillRect(5, 5, 90, 13);
      c.globalCompositeOperation = 'destination-out';
      [14, 24, 34].forEach(function (x) { c.beginPath(); c.arc(x, 11.5, 3, 0, 7); c.fill(); });
      c.globalCompositeOperation = 'source-over';
      c.fillRect(14, 27, 30, 29);
      c.fillRect(52, 27, 34, 7); c.fillRect(52, 39, 26, 7); c.fillRect(52, 51, 30, 5);
    } },
    { sweep: 'y', draw: function (c) {             // 3 skills: a gear (tools)
      c.translate(50, 35);
      for (var k = 0; k < 8; k++) { c.rotate(Math.PI / 4); c.fillRect(-6.5, -33, 13, 14); }
      c.beginPath(); c.arc(0, 0, 23, 0, 7); c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.arc(0, 0, 10, 0, 7); c.fill();
    } },
    { sweep: 'y', draw: function (c) {             // 4 record: an award medal
      c.beginPath(); c.moveTo(30, 0); c.lineTo(44, 0); c.lineTo(56, 28); c.lineTo(42, 28); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(70, 0); c.lineTo(56, 0); c.lineTo(44, 28); c.lineTo(58, 28); c.closePath(); c.fill();
      c.beginPath(); c.arc(50, 46, 22, 0, 7); c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      for (var k = 0; k < 10; k++) {
        var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 6 : 14;
        c.lineTo(50 + Math.cos(a) * rr, 47 + Math.sin(a) * rr);
      }
      c.closePath(); c.fill();
    } },
    { sweep: 'y', draw: function (c) {             // 5 contact: an envelope
      c.lineWidth = 7; c.lineJoin = 'round';
      c.strokeRect(7, 9, 86, 52);
      c.beginPath(); c.moveTo(7, 9); c.lineTo(50, 40); c.lineTo(93, 9); c.stroke();
    } }
  ];

  // Rasterises an icon and picks the grid step that lands closest to (but
  // under) ~85% of the cube budget. World size: about 9 × 6.3 units.
  function voxelize(draw, n) {
    var BW = 100, BH = 70, S = 3, WORLD = 9;
    var cv2 = document.createElement('canvas'); cv2.width = BW * S; cv2.height = BH * S;
    var c = cv2.getContext('2d');
    c.scale(S, S); c.fillStyle = c.strokeStyle = '#fff';
    draw(c);
    var img = c.getImageData(0, 0, cv2.width, cv2.height).data;
    function on(px, py) { return img[(Math.floor(py * S) * cv2.width + Math.floor(px * S)) * 4 + 3] > 127; }
    function sample(step) {
      var pts = [];
      for (var y = step / 2; y < BH; y += step) for (var x = step / 2; x < BW; x += step) if (on(x, y)) pts.push([x, y]);
      return pts;
    }
    var layers = n >= 400 ? 2 : 1, budget = n * .85 / layers, lo = 1.2, hi = 20, best = sample(hi), step = hi;
    for (var it = 0; it < 18; it++) {           // binary search on the grid step
      var mid = (lo + hi) / 2, p = sample(mid);
      if (p.length <= budget) { hi = mid; best = p; step = mid; } else lo = mid;
    }
    var k = WORLD / BW, out = [];
    best.forEach(function (p) {
      for (var l = 0; l < layers; l++) out.push({ x: (p[0] - BW / 2) * k, y: (BH / 2 - p[1]) * k, l: l });
    });
    return { pts: out, sp: step * k, layers: layers, w: WORLD, h: BH * k };
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

    // Each section's cubes assemble into a voxel icon for that section.
    // ICONS (above) draw on a small 2D canvas; voxelize() samples it into
    // a grid sized to the cube budget, and leftover cubes drift around it.
    ICONS.forEach(function (icon, stage) {
      var cells = voxelize(icon.draw, N), o = order(), half = cells.layers > 1 ? .5 : 0;
      for (var i = 0; i < N; i++) {
        if (i < cells.pts.length) {
          var c = cells.pts[i];
          var stag = icon.sweep === 'x' ? (c.x / cells.w + .5) : (.5 - c.y / cells.h);
          put(stage, o[i], c.x, c.y, (c.l - half) * cells.sp, cells.sp * .86, stag);
        } else {                                   // spare cubes: a loose halo of dust
          var th = r() * Math.PI * 2, rr = Math.max(cells.w, cells.h) * (.62 + r() * .35), u = r() * 2 - 1;
          put(stage, o[i], Math.cos(th) * rr, Math.sin(th) * rr * .7, u * 2.2 - 1.5, .08 + .1 * r(), r());
        }
      }
    });

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
  // near-frontal so each icon reads; the target shifts the icon left/right of the content
  var CAM = [
    [[-1.4, .8, 15], [-3.0, 0, 0]],
    [[4.4, .6, 15],  [3.2, 0, 0]],
    [[-4.4, .9, 15], [-3.2, 0, 0]],
    [[4.4, .4, 15],  [3.2, 0, 0]],
    [[-4.4, .8, 15], [-3.2, 0, 0]],
    [[-1.6, .6, 14], [-2.6, 0, 0]]
  ];
  function camAt(s, narrow) {
    var a = Math.min(5, Math.floor(s)), b = Math.min(5, a + 1), f = s - a;
    f = f * f * (3 - 2 * f);
    var e = [], t = [];
    for (var j = 0; j < 3; j++) {
      e[j] = CAM[a][0][j] + (CAM[b][0][j] - CAM[a][0][j]) * f;
      t[j] = CAM[a][1][j] + (CAM[b][1][j] - CAM[a][1][j]) * f;
    }
    if (narrow) {                                // phones: centred and pulled back, except the
      var m = Math.min(1, s);                    // hero, which fitHero already lines up with the photo
      t[0] *= 1 - m; e[0] *= 1 - m * .5; e[2] += 7 * m; e[1] += m;
    }
    return [e, t];
  }

  // Hero camera: put the "< >" brackets either side of the photo ring, at
  // any screen size. Inner gap of the brackets ≈ 4.5 world units.
  var ring = document.querySelector('.hero .ring');
  function fitHero() {
    if (!ring || !ring.offsetWidth) return;
    var vw = window.innerWidth, vh = window.innerHeight, D = ring.offsetWidth;
    // the ring spins, but its bounding box stays centred on it
    var b = ring.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2 + window.pageYOffset;
    // brackets hug the photo inside the ring; on small screens they also must fit the width
    var k = Math.min(D * .86 / 4.32, (vw - cx - 10) / 4.2, (cx - 10) / 4.2);   // px per world unit
    var d = vh / (2 * Math.tan((vw < 820 ? .95 : .8) / 2) * k);
    var tx = (vw / 2 - cx) / k, ty = (cy - vh / 2) / k;
    CAM[0] = [[tx, ty, d], [tx, ty, 0]];
  }

  /* ── scroll → stage ──────────────────────────────────── */
  // Each shape holds while its section fills the screen, and morphs only
  // while the border between two sections crosses the middle of the screen.
  var secs = ['.hero', '#work', '#systems', '#skills', '#record', '#contact'].map(function (s) { return document.querySelector(s); });
  var bounds = [1, 2, 3, 4, 5], band = 1;
  function absTop(el) { var t = 0; for (; el; el = el.offsetParent) t += el.offsetTop; return t; }

  // Sections 1–5: park the icon in the empty margin beside the content
  // when there's room for it; otherwise it sits behind the content.
  var SIDE = [0, -1, 1, -1, 1, 1];                  // -1 = left margin, 1 = right
  function fitSide(k, vw, vh) {
    var el = secs[k];
    if (!el) return;
    var lo = vw, hi = 0;
    Array.prototype.forEach.call(el.children, function (c) {
      if (!c.offsetWidth || c.classList.contains('sr-only')) return;
      var r = c.getBoundingClientRect();
      lo = Math.min(lo, r.left); hi = Math.max(hi, r.right);
    });
    var gut = [lo, vw - hi], side = SIDE[k];
    if (gut[side < 0 ? 0 : 1] < 230 && gut[side < 0 ? 1 : 0] >= 230) side = -side;
    var g = gut[side < 0 ? 0 : 1], k0 = vh / (2 * Math.tan(.4) * 15), x, kp;
    if (g >= 230) { kp = Math.min(k0 * 1.15, (g - 36) / 9.4); x = side < 0 ? g / 2 : vw - g / 2; }
    else { kp = k0; x = vw / 2 + side * Math.min(vw * .22, 3.2 * k0); }
    var d = vh / (2 * Math.tan(.4) * kp), tx = (vw / 2 - x) / kp;
    CAM[k] = [[tx - side * 1.2, .6, d], [tx, 0, 0]];
  }

  function measure() {
    var vw = window.innerWidth, vh = window.innerHeight, max = Math.max(1, root.scrollHeight - vh);
    fitHero();
    for (var k = 1; k < 6; k++) fitSide(k, vw, vh);
    band = vh * .5;
    var prev = -Infinity;
    bounds = secs.slice(1).map(function (el) {
      var b = el ? absTop(el) - vh / 2 : prev + band;
      b = Math.min(b, max - band / 2);           // the last morph must finish before the page ends
      b = Math.max(b, prev + band, band / 2);    // in order, and never before the hero starts
      prev = b; return b;
    });
  }
  function stageFor(y) {
    var s = 0;
    for (var k = 0; k < 5; k++) s += Math.max(0, Math.min(1, (y - bounds[k] + band / 2) / band));
    return s;
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
  measure();   // real anchors first, so a reload mid-page starts on the right shape
  var shown = stageFor(window.pageYOffset), t0 = performance.now(), last = t0, lastDraw = 0;
  var probe = { start: t0 + 1500, frames: 0, sum: 0 };

  function setTier(t) {
    tier = t;
    build(TIERS[tier].n);
    resize(true);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    // rAF's timestamp can be a little older than t0 on the first frame; a negative dt would overshoot
    var dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now;

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
    gl.uniformMatrix4fv(U.uModel, false, rotYX(Math.sin(time * .3) * .14, Math.sin(time * .2) * .04));
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

  window.__gl3d = { tier: function () { return tier; }, n: function () { return N; }, stage: function () { return shown; }, target: function () { return stageFor(window.pageYOffset); } };   // for debugging
})();
