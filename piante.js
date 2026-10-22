// Piante tropicali disegnate in SVG (copiate dalla Serra).
// Due stili: «linea» (tratto sottile) e «colore» (illustrazione piena).
// Uso nella pagina:
//   <svg class="pianta" data-pianta="monstera" data-stile="linea" data-colore="#fff0d8"></svg>
// piante.js riempie ogni <svg data-pianta> con la sua pianta e il suo viewBox.
(function () {
  'use strict';
  const { sin, cos, PI, pow, exp, abs, hypot } = Math;

  // ---------- Geometria ----------

  const pt = (x, y, a) => ({ x, y, a });
  const lerp = (p, q, t) => pt(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);

  // Sposta, ruota (gradi) e scala un gruppo di punti. Le foglie nascono con la base in (0,0) e la punta verso l'alto.
  function trasforma(punti, { x = 0, y = 0, ang = 0, s = 1, sx = 1 } = {}) {
    const a = (ang * PI) / 180, c = cos(a), si = sin(a);
    return punti.map((p) => {
      const px = p.x * s * sx, py = p.y * s;
      return pt(x + px * c - py * si, y + px * si + py * c, p.a);
    });
  }

  // Curva morbida (Catmull-Rom → Bézier) che passa per i punti; quelli con a=true restano spigoli.
  function d(punti, chiuso = false) {
    const n = punti.length;
    if (n < 2) return '';
    const f = (v) => v.toFixed(2);
    const get = (i) => (chiuso ? punti[(i + n) % n] : punti[Math.max(0, Math.min(n - 1, i))]);
    let s = `M${f(punti[0].x)} ${f(punti[0].y)}`;
    for (let i = 0; i < (chiuso ? n : n - 1); i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      let c1 = pt(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6);
      let c2 = pt(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6);
      if (p1.a) c1 = lerp(p1, p2, 1 / 3);
      if (p2.a) c2 = lerp(p2, p1, 1 / 3);
      s += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
    }
    return s + (chiuso ? 'Z' : '');
  }

  // Numeri a caso ma sempre uguali (così la pianta non cambia a ogni apertura).
  function caso(seme) {
    let t = seme >>> 0;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Forme delle foglie (base in 0,0, punta verso -y, lunghezza 1) ----------

  // Lanceolata: Stromanthe, Begonia. base<1 sposta la parte larga verso il picciolo.
  function lanceolata({ larg = 0.26, piega = 0.12, base = 0.8, punta = 1, asim = 0, n = 20 } = {}) {
    const dx = [], sx = [], mid = [], w = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const m = pt(piega * t * t, -t);
      const tx = 2 * piega * t, ty = -1, L = hypot(tx, ty);
      const nx = -ty / L, ny = tx / L;
      const ww = larg * pow(sin(PI * pow(t, base)), punta);
      dx.push(pt(m.x + nx * ww * (1 + asim), m.y + ny * ww * (1 + asim)));
      sx.push(pt(m.x - nx * ww * (1 - asim), m.y - ny * ww * (1 - asim)));
      mid.push(m); w.push({ nx, ny, ww });
    }
    dx[0].a = true; dx[n].a = true;
    const contorno = [...dx, ...sx.slice(1, n).reverse()];
    const laterali = [];
    for (let k = 1; k <= 5; k++) {
      const i = Math.round((k / 6.2) * n), j = Math.min(n - 1, i + 3);
      for (const lato of [dx, sx]) laterali.push([mid[i], lerp(mid[i], lato[j], 0.55), lerp(mid[i], lato[j], 0.9)]);
    }
    const dentro = (t, s) => {   // un punto dentro la foglia: t lungo la nervatura, s da -1 a 1 di traverso
      const i = Math.max(0, Math.min(n, Math.round(t * n)));
      const m = mid[i], q = w[i], k = s > 0 ? 1 + asim : 1 - asim;
      return pt(m.x + q.nx * q.ww * s * k, m.y + q.ny * q.ww * s * k);
    };
    return { contorno, nervatura: mid, laterali, dentro };
  }

  // A cuore: Philodendron, Ceropegia. Dalla curva del cuore classica, con la punta allungata.
  function cuore({ allung = 1.25, larg = 0.62, n = 44 } = {}) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * PI;
      const x = 16 * pow(sin(t), 3);
      let y = (13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t) - 5) / 22;
      if (y < 0) y *= allung;
      pts.push(pt((x / 22) * larg, y / allung, i === 0 || i === n / 2));
    }
    return { contorno: pts, nervatura: [pt(0, 0), pt(0.01, -0.5), pt(0, -1)] };
  }

  // Sagittata (a freccia): Alocasia, con i due lobi a punta sotto il picciolo.
  function sagittata() {
    const destra = [pt(0, -1, true), pt(0.1, -0.88), pt(0.22, -0.68), pt(0.32, -0.45), pt(0.385, -0.2),
      pt(0.4, 0.02), pt(0.375, 0.17), pt(0.33, 0.29, true), pt(0.22, 0.22), pt(0.1, 0.1)];
    const notch = pt(0, 0.02, true);
    const sinistra = destra.slice(1).reverse().map((p) => pt(-p.x, p.y, p.a));
    const contorno = [...destra, notch, ...sinistra];
    const laterali = [];
    const coppie = [[-0.14, pt(0.37, -0.3)], [-0.34, pt(0.33, -0.5)], [-0.54, pt(0.26, -0.68)], [-0.74, pt(0.15, -0.85)]];
    for (const [y, m] of coppie) {
      for (const k of [1, -1]) {
        const a = pt(0, y), b = pt(m.x * k * 0.92, m.y + 0.02);
        laterali.push([a, pt((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.06), b]);
      }
    }
    for (const k of [1, -1]) laterali.push([pt(0, 0.0), pt(0.16 * k, 0.12), pt(0.3 * k, 0.26)]);
    return { contorno, nervatura: [pt(0, 0.02), pt(0, -0.5), pt(0, -0.97)], laterali };
  }

  // Monstera: foglia larga a cuore; i tagli entrano dal bordo verso la nervatura centrale seguendo le
  // nervature laterali (che salgono verso la punta), e i buchi stanno in fila tra un taglio e l'altro.
  function monstera({ seme = 7, tagli = 6, profondita = 0.72 } = {}) {
    const rnd = caso(seme);
    const C = pt(0, -0.5);
    const r = (g) => {
      const a = abs(g > PI ? 2 * PI - g : g);
      return 0.5 + 0.03 * cos(a) + 0.06 * exp(-pow(a / 0.2, 2)) - 0.17 * exp(-pow((a - PI) / 0.22, 2));
    };
    const M = (g) => pt(C.x + sin(g) * r(g) * 0.94, C.y - cos(g) * r(g));     // punto del bordo, g da 0 (punta) in senso orario
    const angoli = [];
    for (let k = 0; k < tagli; k++) angoli.push(0.55 + (k * 1.9) / (tagli - 1) + (rnd() - 0.5) * 0.08);
    const tuttiTagli = [...angoli, ...angoli.map((g) => 2 * PI - g).reverse()];
    const taglio = (g) => {
      const E = M(g);
      const lato = E.x > 0 ? 1 : -1;
      const a = abs(g > PI ? 2 * PI - g : g);
      const N = pt(0, E.y + 0.06 + 0.13 * cos(a));                          // dove la nervatura laterale parte dalla centrale
      const u = { x: N.x - E.x, y: N.y - E.y }, L = hypot(u.x, u.y);
      const v = pt((-u.y / L) * lato, (u.x / L) * lato);
      const fondo = lerp(E, N, profondita * (0.85 + rnd() * 0.25));
      return { E, N, fondo, v, larg: 0.03 + rnd() * 0.015 };
    };
    const dati = tuttiTagli.map((g) => ({ g, ...taglio(g) }));
    const pts = [Object.assign(M(0), { a: true })];
    let g = 0.07;
    for (const t of dati) {
      const dg = t.larg / r(t.g);
      for (; g < t.g - dg; g += 0.07) {
        if (abs(g - PI) < 0.035) { pts.push(Object.assign(M(PI), { a: true })); continue; }
        pts.push(M(g));
      }
      if (g > PI - 0.07 && t.g > PI && !pts.some((q) => q.notch)) pts.push(Object.assign(M(PI), { a: true, notch: true }));
      pts.push(Object.assign(M(t.g - dg), { a: true }));
      pts.push(pt(t.fondo.x - t.v.x * 0.008, t.fondo.y - t.v.y * 0.008));
      pts.push(lerp(t.E, t.N, Math.min(0.97, hypot(t.fondo.x - t.E.x, t.fondo.y - t.E.y) / hypot(t.N.x - t.E.x, t.N.y - t.E.y) + 0.025)));
      pts.push(pt(t.fondo.x + t.v.x * 0.008, t.fondo.y + t.v.y * 0.008));
      pts.push(Object.assign(M(t.g + dg), { a: true }));
      g = t.g + dg + 0.05;
      if (t.g < PI && dati[dati.indexOf(t) + 1].g > PI) {                    // la tacca del picciolo, tra destra e sinistra
        for (; g < PI - 0.03; g += 0.07) pts.push(M(g));
        pts.push(Object.assign(M(PI), { a: true, notch: true }));
        g = PI + 0.07;
      }
    }
    for (; g < 2 * PI - 0.05; g += 0.07) pts.push(M(g));

    // buchi: tra due tagli vicini, a un terzo della strada dalla nervatura, allungati come la nervatura laterale
    const buchi = [], laterali = [];
    for (let i = 0; i < dati.length - 1; i++) {
      const a = dati[i], b = dati[i + 1];
      if ((a.g < PI) !== (b.g < PI)) continue;
      const E = lerp(a.E, b.E, 0.5), N = lerp(a.N, b.N, 0.5);
      laterali.push([N, lerp(N, E, 0.5), lerp(N, E, 0.93)]);
      if (rnd() < 0.25) continue;
      const c = lerp(N, E, 0.3 + rnd() * 0.08);
      const ang = Math.atan2(E.y - N.y, E.x - N.x);
      const e = [];
      for (let k = 0; k < 10; k++) {
        const w = (k / 10) * 2 * PI, lx = 0.05 * cos(w), ly = 0.016 * sin(w);
        e.push(pt(c.x + lx * cos(ang) - ly * sin(ang), c.y + lx * sin(ang) + ly * cos(ang)));
      }
      buchi.push(e);
    }
    const notch = M(PI);
    const sposta = (q) => pt(q.x - notch.x, q.y - notch.y, q.a);
    return {
      contorno: pts.map(sposta),
      buchi: buchi.map((b) => b.map(sposta)),
      laterali: laterali.map((l) => l.map(sposta)),
      nervatura: [sposta(notch), sposta(pt(0.012, -0.45)), sposta(M(0.02))],
    };
  }

  // ---------- Disegnare ----------

  let contaClip = 0;

  function stileTratto(o, spessore = 1) {
    return `fill="none" stroke="${o.colore}" stroke-width="${(o.tratto * spessore).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  }

  function stelo(punti, o, colore, spessore = 2.2) {
    if (o.stile === 'linea') return `<path d="${d(punti)}" ${stileTratto(o, 1)}/>`;
    return `<path d="${d(punti)}" fill="none" stroke="${colore}" stroke-width="${spessore}" stroke-linecap="round"/>`;
  }

  // Una foglia già messa al suo posto: forma, colori, nervature.
  function foglia(geo, posto, o, colori) {
    const c = trasforma(geo.contorno, posto);
    const buchi = (geo.buchi || []).map((b) => d(trasforma(b, posto), true)).join('');
    const nerv = geo.nervatura ? d(trasforma(geo.nervatura, posto)) : '';
    const lat = (geo.laterali || []).map((l) => d(trasforma(l, posto))).join('');
    if (o.stile === 'linea') {
      return `<path d="${d(c, true)}${buchi}" ${stileTratto(o)}/>` +
        (nerv ? `<path d="${nerv}" ${stileTratto(o, 0.8)}/>` : '') +
        (lat && colori.lateraliInLinea !== false ? `<path d="${lat}" ${stileTratto(o, 0.6)} opacity=".75"/>` : '');
    }
    return `<path d="${d(c, true)}${buchi}" fill="${colori.foglia}" fill-rule="evenodd"${colori.bordo ? ` stroke="${colori.bordo}" stroke-width="${colori.spessoreBordo || 1}"` : ''}/>` +
      (nerv && colori.vena ? `<path d="${nerv}" fill="none" stroke="${colori.vena}" stroke-width="${colori.spessoreVena || 1.4}" stroke-linecap="round"/>` : '') +
      (lat && colori.vena ? `<path d="${lat}" fill="none" stroke="${colori.vena}" stroke-width="${colori.spessoreLaterali || 1}" stroke-linecap="round" opacity="${colori.opacitaLaterali || 0.9}"/>` : '');
  }

  function vaso(x, y, w, h, o, colore) {
    const corpo = [pt(x - w / 2 + 4, y + 14, true), pt(x + w / 2 - 4, y + 14, true), pt(x + w * 0.36, y + h, true), pt(x - w * 0.36, y + h, true)];
    const orlo = `M${x - w / 2} ${y + 3}Q${x - w / 2} ${y} ${x - w / 2 + 3} ${y}H${x + w / 2 - 3}Q${x + w / 2} ${y} ${x + w / 2} ${y + 3}V${y + 12}Q${x + w / 2} ${y + 15} ${x + w / 2 - 3} ${y + 15}H${x - w / 2 + 3}Q${x - w / 2} ${y + 15} ${x - w / 2} ${y + 12}Z`;
    if (o.stile === 'linea') return `<path d="${d(corpo, true)}" ${stileTratto(o)}/><path d="${orlo}" ${stileTratto(o)}/>`;
    const scuro = colore.ombra || 'rgba(0,0,0,.12)';
    return `<path d="${d(corpo, true)}" fill="${colore.corpo}"/>` +
      `<path d="M${x - w * 0.36} ${y + h}L${x - w / 2 + 4} ${y + 14}H${x - w / 2 + 16}L${x - w * 0.3} ${y + h}Z" fill="#fff" opacity=".12"/>` +
      `<path d="${orlo}" fill="${colore.orlo}"/><rect x="${x - w / 2}" y="${y + 13}" width="${w}" height="3" fill="${scuro}"/>`;
  }

  const VASI = {
    giallo: { corpo: '#fec340', orlo: '#f2b324' },
    malva: { corpo: '#b58aa9', orlo: '#a57898' },
    terracotta: { corpo: '#c87a54', orlo: '#b86a46' },
    crema: { corpo: '#f3e4c8', orlo: '#e8d5b2', ombra: 'rgba(36,24,30,.10)' },
    verde: { corpo: '#0a5b58', orlo: '#08494a' },
    // i vasi rari della Estufa di Velvet
    dourado: { corpo: '#d9a520', orlo: '#c18e12' },
    cobalto: { corpo: '#2f5d9e', orlo: '#244d86' },
    rosa: { corpo: '#e8a1b3', orlo: '#d98aa0' },
  };

  // ---------- La collezione ----------

  const SPECIE = {
    // Monstera deliciosa in vaso: tre foglie grandi con tagli e buchi.
    monstera: {
      box: '0 0 240 300',
      disegna(o) {
        const col = { foglia: '#1d6a52', vena: '#4f8f73', spessoreVena: 1.6, lateraliInLinea: false };
        const terra = pt(120, 226);
        const foglie = [
          { geo: monstera({ seme: 3 }), posto: { x: 122, y: 104, ang: 4, s: 78 } },
          { geo: monstera({ seme: 11 }), posto: { x: 80, y: 128, ang: -32, s: 112 } },
          { geo: monstera({ seme: 5 }), posto: { x: 166, y: 138, ang: 36, s: 96 } },
        ];
        let s = '';
        for (const f of foglie) s += stelo([pt(terra.x + (f.posto.x - 120) * 0.12, terra.y), lerp(terra, pt(f.posto.x, f.posto.y), 0.55), pt(f.posto.x, f.posto.y)], o, '#3e7d5f', 2.6);
        for (const f of foglie) s += foglia(f.geo, f.posto, o, col);
        return s + vaso(120, 224, 116, 70, o, VASI[o.vaso || 'giallo']);
      },
    },

    // Alocasia «Polly»: foglie a freccia scure con le nervature chiare.
    alocasia: {
      box: '0 0 240 300',
      disegna(o) {
        const col = { foglia: '#173a30', vena: '#eee6c8', spessoreVena: 2.2, spessoreLaterali: 1.5, bordo: '#e3dcc0', spessoreBordo: 1.1 };
        const terra = pt(120, 226);
        const foglie = [
          { posto: { x: 120, y: 92, ang: 6, s: 92 } },
          { posto: { x: 74, y: 126, ang: -34, s: 82 } },
          { posto: { x: 170, y: 132, ang: 38, s: 74 } },
        ];
        let s = '';
        for (const f of foglie) s += stelo([pt(terra.x + (f.posto.x - 120) * 0.1, terra.y), lerp(terra, pt(f.posto.x, f.posto.y), 0.5), pt(f.posto.x, f.posto.y)], o, '#58745f', 2.4);
        for (const f of foglie) s += foglia(sagittata(), f.posto, o, col);
        return s + vaso(120, 224, 106, 70, o, VASI[o.vaso || 'malva']);
      },
    },

    // Begonia maculata: canne con le foglie ad ala d'angelo, a pois argento, rosse sotto.
    begonia: {
      box: '0 0 240 300',
      disegna(o) {
        const rnd = caso(19);
        const col = { foglia: '#2f4b3e', bordo: '#b61e42', spessoreBordo: 1.3, lateraliInLinea: false };
        let s = '';
        const canne = [
          { da: pt(108, 226), a: pt(78, 40), foglie: [[0.3, 1], [0.55, -1], [0.8, 1], [1, -1]] },
          { da: pt(128, 226), a: pt(166, 78), foglie: [[0.4, -1], [0.68, 1], [1, 1]] },
        ];
        for (const c of canne) {
          const curva = [c.da, lerp(c.da, c.a, 0.5), c.a];
          curva[1] = pt(curva[1].x + (c.a.x < c.da.x ? 8 : -6), curva[1].y);
          s += stelo(curva, o, '#7e8f63', 3);
          if (o.stile !== 'linea') for (const k of [0.3, 0.55, 0.8]) { const n = lerp(c.da, c.a, k); s += `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="2.4" fill="#9aa778"/>`; }
          for (const [k, lato] of c.foglie) {
            const n = lerp(c.da, c.a, k);
            const geo = lanceolata({ larg: 0.17, base: 0.5, piega: 0.22 * lato, asim: 0.4 * lato, punta: 0.9 });
            const posto = { x: n.x, y: n.y, ang: lato * (112 + rnd() * 30), s: 78 + rnd() * 18 };
            s += foglia(geo, posto, o, col);
            const pois = [];
            for (let i = 0; i < 18; i++) pois.push(geo.dentro(0.1 + rnd() * 0.78, (rnd() * 2 - 1) * 0.72));
            const p = trasforma(pois, posto);
            const colPois = o.stile === 'linea' ? o.colore : '#e7eee9';
            s += p.map((q) => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${(1.2 + rnd() * 1).toFixed(1)}" fill="${colPois}"/>`).join('');
          }
        }
        return s + vaso(120, 224, 100, 70, o, VASI[o.vaso || 'crema']);
      },
    },

    // Stromanthe «Triostar»: foglie a lancia con le strisce crema e rosa, il rovescio magenta.
    stromanthe: {
      box: '0 0 240 300',
      disegna(o) {
        const rnd = caso(23);
        let s = '';
        const terra = pt(120, 226);
        const angoli = [-52, -30, -12, 6, 22, 40, 58];
        angoli.forEach((ang, i) => {
          const rovescio = i === 1 || i === 5;
          const geo = lanceolata({ larg: 0.2, base: 0.9, piega: (ang > 0 ? 1 : -1) * 0.1 });
          const posto = { x: terra.x + ang * 0.25, y: terra.y - 34 - (60 - abs(ang)) * 0.5, ang, s: 96 + rnd() * 34 };
          s += stelo([pt(terra.x + ang * 0.12, terra.y), pt(posto.x, posto.y)], o, '#8a4a5e', 2);
          if (o.stile === 'linea') {
            s += foglia(geo, posto, o, { lateraliInLinea: true });
            return;
          }
          const id = `clip-stromanthe-${++contaClip}`;
          const contorno = d(trasforma(geo.contorno, posto), true);
          s += `<clipPath id="${id}"><path d="${contorno}"/></clipPath>`;
          s += `<g clip-path="url(#${id})"><path d="${contorno}" fill="${rovescio ? '#a3245b' : '#2f5f47'}"/>`;
          for (let k = 0; k < 9; k++) {
            const t = 0.12 + rnd() * 0.8, lato = rnd() < 0.5 ? 1 : -1;
            const linea = trasforma([geo.dentro(t, 0), geo.dentro(Math.min(1, t + 0.18), lato * 1.4)], posto);
            const colore = rovescio ? '#e39ab4' : (rnd() < 0.55 ? '#f4ecd3' : '#e39ab4');
            s += `<path d="${d(linea)}" stroke="${colore}" stroke-width="${(2 + rnd() * 5).toFixed(1)}" stroke-linecap="round" fill="none" opacity=".95"/>`;
          }
          s += `<path d="${d(trasforma(geo.nervatura, posto))}" stroke="${rovescio ? '#f0b9cc' : '#f4ecd3'}" stroke-width="1.2" fill="none"/></g>`;
        });
        return s + vaso(120, 224, 104, 70, o, VASI[o.vaso || 'terracotta']);
      },
    },

    // Philodendron «Brasil» che ricade dal vaso: foglie a cuore con la striscia lime.
    filodendro: {
      box: '0 0 220 340',
      boxAppeso: '0 -58 220 398',
      disegna(o) {
        const rnd = caso(31);
        let s = '';
        const rami = [
          [pt(76, 58), pt(54, 120), pt(62, 190), pt(48, 262), pt(56, 320)],
          [pt(98, 58), pt(112, 130), pt(102, 200), pt(116, 250)],
          [pt(128, 56), pt(160, 96), pt(172, 160), pt(166, 214)],
        ];
        const geo = cuore({ allung: 1.35, larg: 0.6 });
        for (const ramo of rami) {
          s += stelo(ramo, o, '#5f8a4e', 1.8);
          const lungo = ramo.length - 1;
          for (let i = 0; i < lungo * 2; i++) {
            const k = (i + 0.7) / (lungo * 2);
            const seg = Math.min(lungo - 1, Math.floor(k * lungo));
            const p = lerp(ramo[seg], ramo[seg + 1], k * lungo - seg);
            const lato = i % 2 ? 1 : -1;
            const posto = { x: p.x, y: p.y, ang: 180 + lato * (38 + rnd() * 30), s: 26 + rnd() * 10 };
            s += foglia(geo, posto, o, { foglia: '#2c7a4b' });
            if (o.stile !== 'linea') s += foglia(lanceolata({ larg: 0.09 + rnd() * 0.07, base: 0.7, piega: (rnd() - 0.5) * 0.1 }), { ...posto, s: posto.s * 0.92 }, o, { foglia: '#c4d36a' });
          }
        }
        // appeso: tre corde dal gancio in alto al bordo del vaso
        const corde = o.appeso ? [57, 100, 143].map((x) => `<path d="M100 -50L${x} 12" ${o.stile === 'linea' ? stileTratto(o, 0.8) : 'stroke="#b9a58a" stroke-width="1.2" fill="none"'}/>`).join('') +
          `<circle cx="100" cy="-50" r="4" fill="none" stroke="${o.stile === 'linea' ? o.colore : '#b9a58a'}" stroke-width="1.6"/>` : '';
        if (o.stile === 'linea') return corde + vaso(100, 10, 86, 56, o, null) + s;
        return corde + vaso(100, 10, 86, 56, o, VASI[o.vaso || 'crema']) + s;
      },
    },

    // Ceropegia woodii (collana di cuori): fili sottili con coppie di cuoricini, appesa dall'alto.
    ceropegia: {
      box: '0 0 120 360',
      disegna(o) {
        const rnd = caso(41);
        let s = '';
        const geo = cuore({ allung: 0.95, larg: 0.8 });
        const fili = [[38, 290], [64, 350], [88, 240]];
        for (const [x0, lung] of fili) {
          const punti = [];
          for (let y = 0; y <= lung; y += 30) punti.push(pt(x0 + sin(y / 55 + x0) * 7, y));
          s += stelo(punti, o, '#7a4a5c', 1.1);
          for (let y = 26; y < lung - 6; y += 34 + rnd() * 8) {
            const p = pt(x0 + sin(y / 55 + x0) * 7, y);
            for (const lato of [1, -1]) {
              const posto = { x: p.x, y: p.y, ang: 180 + lato * (60 + rnd() * 18), s: 17 + rnd() * 4 };
              s += foglia(geo, posto, o, { foglia: '#7b9583', bordo: '#d3ded6', spessoreBordo: 0.9 });
              if (o.stile !== 'linea') s += foglia(cuore({ allung: 0.9, larg: 0.42 }), { ...posto, s: posto.s * 0.55 }, o, { foglia: '#c3d2c7' });
            }
          }
        }
        return s;
      },
    },

    // Senecio rowleyanus (collana di perle): fili di palline verdi, appeso dall'alto.
    senecio: {
      box: '0 0 120 360',
      disegna(o) {
        let s = '';
        const fili = [[34, 270], [58, 340], [84, 300]];
        for (const [x0, lung] of fili) {
          const punti = [];
          for (let y = 0; y <= lung; y += 30) punti.push(pt(x0 + sin(y / 60 + x0 * 2) * 8, y));
          s += stelo(punti, o, '#5d7b4b', 1);
          for (let y = 12, i = 0; y < lung; y += 11, i++) {
            const lato = i % 2 ? 1 : -1;
            const p = pt(x0 + sin(y / 60 + x0 * 2) * 8 + lato * 3.8, y);
            const r = 5.2 * (0.65 + 0.35 * sin(PI * Math.min(1, y / lung)));
            if (o.stile === 'linea') s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" ${stileTratto(o)}/>`;
            else s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#6e9b58"/><circle cx="${(p.x - r * 0.3).toFixed(1)}" cy="${(p.y - r * 0.3).toFixed(1)}" r="${(r * 0.35).toFixed(1)}" fill="#b8d79b"/>`;
          }
        }
        return s;
      },
    },
  };

  // Germoglio: due foglioline su un gambo. È il segno di «Nuova app»: un'app che nasce.
  SPECIE.germoglio = {
    box: '0 0 100 140',
    disegna(o) {
      const col = { foglia: '#3f8a5a', vena: '#a7cf8f', spessoreVena: 1.2, lateraliInLinea: false };
      return stelo([pt(50, 136), pt(51, 110), pt(50, 84)], o, '#3f8a5a', 3) +
        foglia(lanceolata({ larg: 0.3, base: 0.7, piega: -0.12 }), { x: 50, y: 92, ang: -58, s: 46 }, o, col) +
        foglia(lanceolata({ larg: 0.3, base: 0.7, piega: 0.12 }), { x: 50, y: 86, ang: 52, s: 40 }, o, col);
    },
  };

  // Foglie singole, per l'«erbario»: una specie diversa accanto a ogni sezione.
  const SINGOLE = {
    'foglia-monstera': () => monstera({ seme: 9, tagli: 4 }),
    'foglia-alocasia': () => sagittata(),
    'foglia-filodendro': () => cuore({ allung: 1.35, larg: 0.6 }),
    'foglia-stromanthe': () => lanceolata({ larg: 0.2, base: 0.9, piega: 0.1 }),
    'foglia-begonia': () => lanceolata({ larg: 0.24, base: 0.55, piega: 0.2, asim: 0.35 }),
  };
  const COLORI_SINGOLE = {
    'foglia-monstera': { foglia: '#1d6a52', vena: '#4f8f73', lateraliInLinea: false },
    'foglia-alocasia': { foglia: '#173a30', vena: '#eee6c8', spessoreVena: 2, bordo: '#e3dcc0' },
    'foglia-filodendro': { foglia: '#2c7a4b', vena: '#6fa37a', spessoreVena: 1.4 },
    'foglia-stromanthe': { foglia: '#2f5f47', vena: '#f4ecd3' },
    'foglia-begonia': { foglia: '#2f4b3e', bordo: '#b61e42', spessoreBordo: 1.3, lateraliInLinea: false },
  };
  for (const [nome, forma] of Object.entries(SINGOLE)) {
    SPECIE[nome] = {
      box: '0 0 100 140',
      disegna(o) {
        const posto = { x: 50, y: 128, ang: Number(o.ang || 0), s: 104 };
        const geo = forma();
        let s = stelo([pt(50, 140), pt(50, 128)], o, '#4f7a5f', 2) + foglia(geo, posto, o, COLORI_SINGOLE[nome]);
        if (nome === 'foglia-begonia') {                  // i pois argento della maculata
          const rnd = caso(5), pois = [];
          for (let i = 0; i < 22; i++) pois.push(geo.dentro(0.1 + rnd() * 0.8, (rnd() * 2 - 1) * 0.72));
          const colPois = o.stile === 'linea' ? o.colore : '#e7eee9';
          s += trasforma(pois, posto).map((q) => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${(1.6 + rnd() * 1.4).toFixed(1)}" fill="${colPois}"/>`).join('');
        }
        return s;
      },
    };
  }

  function riempi(svg) {
    const nome = svg.dataset.pianta;
    const specie = SPECIE[nome];
    if (!specie) return;
    const o = {
      stile: svg.dataset.stile || 'colore',
      colore: svg.dataset.colore || '#0a5b58',
      tratto: Number(svg.dataset.tratto || 1.3),
      vaso: svg.dataset.vaso,
      appeso: svg.dataset.appeso === 'si',
      ang: svg.dataset.ang,
    };
    svg.setAttribute('viewBox', o.appeso && specie.boxAppeso ? specie.boxAppeso : specie.box);
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = specie.disegna(o);
    if (nome.startsWith('foglia-') || nome === 'germoglio' || svg.dataset.adatta === 'si') {
      const b = svg.getBBox(), m = 3;
      svg.setAttribute('viewBox', `${(b.x - m).toFixed(1)} ${(b.y - m).toFixed(1)} ${(b.width + 2 * m).toFixed(1)} ${(b.height + 2 * m).toFixed(1)}`);
    }
  }

  window.Piante = { riempi, specie: Object.keys(SPECIE) };
  const tutte = () => document.querySelectorAll('svg[data-pianta]').forEach(riempi);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tutte);
  else tutte();
})();
