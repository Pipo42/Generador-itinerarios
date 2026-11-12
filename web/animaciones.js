/* Animaciones de la web (canvas 2D, sin dependencias):
   - AnimacionesBus.fondo(canvas): líneas discontinuas que se dibujan muy despacio entre un punto A y un punto B, como trazadas en un mapa.
   - AnimacionesBus.viaje(canvas, paradas, {alLlegar, alTerminar}): el bus recorre A -> B antes de abrir Google Maps. */
(function () {
  'use strict';
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = u => Math.min(1, Math.max(0, u));
  const suave = u => .5 - .5 * Math.cos(Math.PI * clamp01(u));
  const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- geometría ---------- */
  function muestrear(pts) {
    const acum = [0];
    for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, acum, total: acum[acum.length - 1] || 1 };
  }
  function curva(a, b, k) {                       // curva suave con una sola panza lateral
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    const c = [mx - dy * k, my + dx * k], pts = [];
    for (let i = 0; i <= 90; i++) { const u = i / 90, v = 1 - u; pts.push([0, 1].map(d => v * v * a[d] + 2 * v * u * c[d] + u * u * b[d])); }
    return muestrear(pts);
  }
  function enDistancia(R, s) {
    const { pts, acum } = R; s = Math.min(Math.max(s, 0), R.total); let i = 1;
    while (i < pts.length - 1 && acum[i] < s) i++;
    const a = pts[i - 1], b = pts[i], seg = acum[i] - acum[i - 1] || 1, u = clamp01((s - acum[i - 1]) / seg);
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  function trazoTramo(ctx, R, s0, s1) {           // dibuja la parte del recorrido entre s0 y s1
    if (s1 - s0 < .5) return;
    const p0 = enDistancia(R, s0), p1 = enDistancia(R, s1);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
    for (let i = 0; i < R.pts.length; i++) if (R.acum[i] > s0 && R.acum[i] < s1) ctx.lineTo(R.pts[i][0], R.pts[i][1]);
    ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }

  /* ---------- dibujo ---------- */
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function marca(ctx, x, y, esc, letra) {
    if (esc <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(esc, esc);
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fillStyle = '#FAF5E9'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.fillStyle = '#000'; ctx.font = '700 12px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letra, 0, .5);
    ctx.restore();
  }
  function equis(ctx, x, y, esc, alfa) {
    if (esc <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(esc, esc); ctx.globalAlpha *= alfa; ctx.lineCap = 'round';
    const s = 9; ctx.strokeStyle = '#000'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke();
    ctx.strokeStyle = '#e6002b'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke(); ctx.restore();
  }
  function bus(ctx, x, y, ang, t) {               // autobús escolar visto desde arriba (delante = derecha)
    ctx.save(); ctx.translate(x, y + Math.sin(t * 22) * .5); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; rrect(ctx, -16, -6, 34, 16, 5); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.fillStyle = '#F6B91A'; rrect(ctx, -17, -8, 34, 16, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FAF5E9'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.rect(-13 + i * 7, -5, 5, 10); ctx.fill(); ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = '#3d4b55'; ctx.beginPath(); ctx.rect(12, -6, 3.5, 12); ctx.fill();
    ctx.restore();
  }
  function ajustarLienzo(cv) {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W, H };
  }

  /* ---------- fondo: líneas discontinuas que se dibujan despacio ---------- */
  const TRAZO = { dibuja: 5.5, pausa: 2.5, desvanece: 3.5 };        // segundos
  const DURACION = TRAZO.dibuja + TRAZO.pausa + TRAZO.desvanece;
  const MAX_SIMULTANEOS = 2, ESPERA = [4, 8];                        // pocas líneas y muy espaciadas
  function dentro(p, r) { return p[0] > r.left && p[0] < r.right && p[1] > r.top && p[1] < r.bottom; }
  function puntosAleatorios(W, H, columna, contenido) {   // A y B aleatorios; primero fuera de toda la columna, luego fuera del contenido actual
    const m = Math.min(50, W * .08), k = Math.min(1, Math.min(W, H) / 700);
    for (let n = 0; n < 80; n++) {
      const a = [rand(m, W - m), rand(m, H - m)], ang = rand(0, 7), d = rand(260, 520) * k, b = [a[0] + Math.cos(ang) * d, a[1] + Math.sin(ang) * d];
      if (b[0] < m || b[0] > W - m || b[1] < m || b[1] > H - m) continue;
      const zona = n < 40 ? columna : n < 65 ? contenido : null;                // 3 niveles: estricto -> contenido -> sin restricción
      if (zona) {
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (dentro(a, zona) || dentro(b, zona) || dentro(mid, zona)) continue;
      }
      return [a, b];
    }
    return null;
  }
  function dibujarTrazo(ctx, v, tl) {
    const R = v.R, s = suave(tl / TRAZO.dibuja) * R.total, apaga = clamp01((tl - TRAZO.dibuja - TRAZO.pausa) / TRAZO.desvanece);
    ctx.globalAlpha = .5 * (1 - suave(apaga));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#191919'; ctx.lineWidth = 2; ctx.setLineDash([8, 9]);
    trazoTramo(ctx, R, 0, s); ctx.setLineDash([]);
    const ap = suave(tl / 1.2), bp = suave((tl - TRAZO.dibuja) / .9);                // A al empezar, B al llegar
    marca(ctx, v.a[0], v.a[1], ap, 'A');
    marca(ctx, v.b[0], v.b[1], bp, 'B');
  }
  function fondo(cv) {
    if (!cv || quieto()) return;
    const ctx = cv.getContext('2d'); let W = 0, H = 0, activos = [], proximo = 0;
    const medir = () => { ({ W, H } = ajustarLienzo(cv)); };
    addEventListener('resize', medir); medir();
    const main = document.querySelector('main');
    (function frame(ms) {
      const t = ms / 1000;
      if (proximo === 0) proximo = t + 1.2;                                          // la primera línea empieza enseguida, sin prisa
      if (t >= proximo && activos.length < MAX_SIMULTANEOS && !document.hidden) {
        let columna = null, contenido = null;
        if (main) {
          const r = main.getBoundingClientRect();
          contenido = { left: r.left - 24, right: r.right + 24, top: r.top - 24, bottom: r.bottom + 24 };
          columna = { left: contenido.left, right: contenido.right, top: -1e9, bottom: 1e9 };   // el contenido puede crecer: se reserva toda la columna
        }
        const p = puntosAleatorios(W, H, columna, contenido);
        if (p) activos.push({ a: p[0], b: p[1], R: curva(p[0], p[1], (Math.random() < .5 ? -1 : 1) * rand(.1, .25)), t0: t });
        proximo = t + rand(...ESPERA);
      }
      activos = activos.filter(v => t - v.t0 < DURACION);
      ctx.clearRect(0, 0, W, H);
      for (const v of activos) { ctx.save(); dibujarTrazo(ctx, v, t - v.t0); ctx.restore(); }
      requestAnimationFrame(frame);
    })(performance.now());
  }

  /* ---------- animación del botón: el bus recorre A -> B y se abre Maps ---------- */
  const VIAJE_MS = 1300, LLEGADA_MS = 325;
  function viaje(cv, paradas, cb) {
    cb = cb || {};
    const ctx = cv.getContext('2d'), { W, H } = ajustarLienzo(cv), pad = 46;
    const sube = paradas[paradas.length - 1].lat >= paradas[0].lat;                  // B al norte de A -> B más arriba
    const A = [pad, H * (sube ? .66 : .34)], B = [W - pad, H * (sube ? .34 : .66)];
    const c1 = [W * .38, A[1]], c2 = [W * .62, B[1]], pts = [];
    for (let i = 0; i <= 140; i++) { const u = i / 140, v = 1 - u; pts.push([0, 1].map(d => v * v * v * A[d] + 3 * v * v * u * c1[d] + 3 * v * u * u * c2[d] + u * u * u * B[d])); }
    const R = muestrear(pts);
    function cuadro(prog, t, llegada) {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(25,25,25,.07)'; ctx.lineWidth = 1; ctx.setLineDash([]);
      for (let x = 20; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 20; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const s = prog * R.total, pos = enDistancia(R, s);
      if (llegada < 0) equis(ctx, B[0], B[1], 1, .28);                                // destino "fantasma"
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.setLineDash([9, 9]);
      trazoTramo(ctx, R, 0, s); ctx.setLineDash([]);
      marca(ctx, A[0], A[1], 1, 'A');
      if (llegada < 0) bus(ctx, pos.x, pos.y, pos.ang, t);
      else {                                                                           // llegada: la X salta
        const q = clamp01(llegada / .22);
        bus(ctx, B[0] - Math.cos(pos.ang) * 16 * q, B[1] - Math.sin(pos.ang) * 16 * q, pos.ang, 0);
        equis(ctx, B[0], B[1], 1 + Math.sin(q * Math.PI) * .55 * (1 - q * .4), 1);
      }
    }
    const t0 = performance.now(); let avisado = false;
    (function frame(ahora) {
      const ms = ahora - t0;
      if (ms < VIAJE_MS) { cuadro(suave(ms / VIAJE_MS), ms / 1000, -1); requestAnimationFrame(frame); return; }
      const ll = (ms - VIAJE_MS) / 1000; cuadro(1, 0, Math.min(ll, 5));
      if (!avisado && ll > .03) { avisado = true; if (cb.alLlegar) cb.alLlegar(); }
      if (ms < VIAJE_MS + LLEGADA_MS) { requestAnimationFrame(frame); return; }
      if (cb.alTerminar) cb.alTerminar();
    })(t0);
  }

  window.AnimacionesBus = { fondo, viaje };
})();
