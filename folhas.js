// Folhas do mundo, desenhadas a traço para o cartão amarelo da fase: o app escolhe uma diferente a cada abertura.
// Mesmo traço das folhas da Serra (piante.js): contorno cheio, nervura central e nervuras laterais mais leves.
// Uso: Folhas.riempi(svg) num <svg data-folha="ginkgo" data-colore="#c98f1f" data-tratto="1.4">.
(function () {
  'use strict';
  const { sin, cos, PI, pow, abs, atan2, sqrt, exp } = Math;
  const rad = g => g * PI / 180;
  const pt = (x, y, a) => ({ x, y, a });
  const f = v => v.toFixed(1);
  // ponto a distância r de c, no ângulo g em graus (0 = para cima, positivo = sentido horário)
  const polar = (c, g, r, a) => pt(c.x + r * sin(rad(g)), c.y - r * cos(rad(g)), a);

  // curva suave que passa pelos pontos (Catmull-Rom → Bézier); os pontos com a=true ficam em quina
  function curva(p, fechada) {
    const n = p.length;
    const get = i => (fechada ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
    const lerp = (a, b, t) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    let s = `M${f(p[0].x)} ${f(p[0].y)}`;
    for (let i = 0; i < (fechada ? n : n - 1); i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      let c1 = pt(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6);
      let c2 = pt(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6);
      if (p1.a) c1 = lerp(p1, p2, 1 / 3);
      if (p2.a) c2 = lerp(p2, p1, 1 / 3);
      s += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
    }
    return s + (fechada ? 'Z' : '');
  }
  const reta = (a, b) => `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;

  // folíolo estreito que nasce em b, na direção g, com comprimento l, largura w e uma leve curvatura
  function foliolo(b, g, l, w, curv = 0) {
    const eixo = t => polar(b, g + curv * t, l * t);
    const lado = (t, s) => polar(eixo(t), g + curv * t + 90 * s, w * pow(sin(PI * pow(t, 0.75)), 0.9));
    return [pt(b.x, b.y, true), lado(.2, -1), lado(.45, -1), lado(.7, -1), lado(.88, -1), pt(eixo(1).x, eixo(1).y, true), lado(.88, 1), lado(.7, 1), lado(.45, 1), lado(.2, 1)];
  }

  // curva de Bézier cúbica: ponto e direção (em graus, mesma convenção de polar)
  const bez = (P, t) => { const u = 1 - t; return pt(u * u * u * P[0].x + 3 * u * u * t * P[1].x + 3 * u * t * t * P[2].x + t * t * t * P[3].x, u * u * u * P[0].y + 3 * u * u * t * P[1].y + 3 * u * t * t * P[2].y + t * t * t * P[3].y); };
  const dirBez = (P, t) => { const a = bez(P, Math.max(0, t - .01)), b = bez(P, Math.min(1, t + .01)); return atan2(b.x - a.x, -(b.y - a.y)) * 180 / PI; };
  const caule = (P, n = 16) => curva(Array.from({ length: n + 1 }, (_, i) => bez(P, i / n)));

  const FOLHAS = {
    ginkgo: {
      nome: 'Ginkgo biloba',
      desenha() {
        const B = pt(50, 84);
        const R = g => 54 - 9 * exp(-(g * g) / 40) + 1.4 * sin(rad(g * 7));
        const borda = [-58, -50, -42, -34, -26, -19, -12, -7, -3, 0, 3, 7, 12, 19, 26, 34, 42, 50, 58].map(g => polar(B, g, R(g), g === 0));
        const contorno = [pt(B.x, B.y, true), polar(B, -59, 27), ...borda, polar(B, 59, 27)];
        const veias = [-52, -43, -34, -25, -16, -8, 8, 16, 25, 34, 43, 52].map(g => reta(polar(B, g * .5, 5), polar(B, g, R(g) - 4))).join('');
        return { contorno: curva(contorno, true), nervura: curva([pt(50, 128), pt(51, 106), pt(50, 84)]), laterais: veias };
      }
    },
    samambaia: {
      nome: 'Samambaia',
      desenha() {
        const P = [pt(48, 128), pt(42, 82), pt(64, 44), pt(55, 6)];
        let c = '';
        const N = 12;
        for (let i = 0; i < N; i++) {
          const t = .17 + i * (.77 / (N - 1)), b = bez(P, t), g = dirBez(P, t);
          const l = 34 * pow(1 - t, .85) + 5, w = l * .17;
          c += curva(foliolo(b, g - 60, l, w, 12), true) + curva(foliolo(b, g + 60, l, w, -12), true);
        }
        c += curva(foliolo(bez(P, .985), dirBez(P, .985), 7, 1.8), true);
        return { contorno: c, nervura: caule(P) };
      }
    },
    bananeira: {
      nome: 'Bananeira',
      desenha() {
        const yb = 114, yt = 6, y = t => yb - (yb - yt) * t;
        const w = t => 27 * pow(Math.max(0, 1 - pow(2 * t - 1, 6)), .5);
        const ts = [0, .03, .08, .15, .23, .32, .42, .52, .62, .72, .8, .87, .93, .97, 1];
        const esq = ts.map(t => pt(50 - w(t), y(t), t === 0));
        const dir = [];
        for (const t of [...ts].reverse()) {
          if (t === 1 || t === 0) continue;
          if (t === .52 || t === .32) {   // os rasgos da folha: fendas finas que seguem a nervura, da borda para dentro
            const ye = y(t) - w(t) * .33;
            dir.push(pt(50 + w(t) * .93, ye - 1.3, true), pt(50 + w(t) * .3, y(t) - w(t) * .11, true), pt(50 + w(t) * .93, ye + 1.3, true));
          } else dir.push(pt(50 + w(t) * .93, y(t)));
        }
        const contorno = [...esq, ...dir];
        let lat = '';
        for (let t = .08; t < .95; t += .055) {
          lat += reta(pt(50, y(t)), pt(50 - w(t) * .9, y(t) - w(t) * .32));
          if (abs(t - .52) > .04 && abs(t - .32) > .04) lat += reta(pt(50, y(t)), pt(50 + w(t) * .84, y(t) - w(t) * .3));
        }
        return { contorno: curva(contorno, true), nervura: curva([pt(50, 128), pt(50, yb), pt(51, 60), pt(50, yt + 2)]), laterais: lat };
      }
    },
    bordo: {
      nome: 'Bordo',
      desenha() {
        const C = pt(50, 70);
        const P = [[-165, 10, 1], [-115, 34, 1], [-100, 26, 1], [-84, 19, 0], [-68, 36, 1], [-55, 48, 1], [-42, 38, 1], [-28, 23, 0], [-14, 44, 1], [0, 57, 1],
          [14, 44, 1], [28, 23, 0], [42, 38, 1], [55, 48, 1], [68, 36, 1], [84, 19, 0], [100, 26, 1], [115, 34, 1], [165, 10, 1]];
        const contorno = P.map(([g, r, a]) => polar(C, g, r, !!a));
        const veias = [0, -55, 55, -115, 115].map(g => reta(C, polar(C, g, g === 0 ? 52 : g % 115 === 0 ? 30 : 44))).join('');
        return { contorno: curva(contorno, true), nervura: curva([pt(50, 128), pt(51, 104), pt(50, 80)]), laterais: veias };
      }
    },
    carvalho: {
      nome: 'Carvalho',
      desenha() {
        const esq = [[48, 110, 1], [38, 104], [27, 96], [39, 88], [21, 78], [37, 68], [19, 56], [35, 46], [23, 36], [37, 28], [31, 18]];
        const L = esq.map(([x, y, a]) => pt(x, y, !!a));
        const R = esq.slice().reverse().map(([x, y, a], i) => pt(100 - x + (i % 2 ? 1 : -1), y + 3, !!a));
        const contorno = [...L, pt(50, 6, true), ...R];
        const lobos = [[27, 96], [21, 78], [19, 56], [23, 36], [31, 18]];
        const lat = lobos.map(([x, y]) => reta(pt(50, y + 6), pt(x + 5, y + 1)) + reta(pt(50, y + 8), pt(100 - x - 4, y + 4))).join('');
        return { contorno: curva(contorno, true), nervura: curva([pt(50, 128), pt(50, 110), pt(51, 60), pt(50, 9)]), laterais: lat };
      }
    },
    figueira: {
      nome: 'Figueira',
      desenha() {
        const C = pt(50, 72);
        const P = [[-172, 12, 1], [-140, 26], [-112, 38], [-92, 34], [-76, 21], [-58, 40], [-42, 48], [-28, 40], [-17, 25], [-8, 46], [0, 54],
          [8, 46], [17, 25], [28, 40], [42, 48], [58, 40], [76, 21], [92, 34], [112, 38], [140, 26], [172, 12, 1]];
        const contorno = P.map(([g, r, a]) => polar(C, g, r, !!a));
        const veias = [[0, 50], [-42, 44], [42, 44], [-108, 34], [108, 34]].map(([g, r]) => reta(C, polar(C, g, r))).join('');
        return { contorno: curva(contorno, true), nervura: curva([pt(50, 128), pt(51, 104), pt(50, 84), C]), laterais: veias };
      }
    },
    palmeira: {
      nome: 'Palmeira-leque',
      desenha() {
        const P = pt(50, 96);
        let c = '';
        const bases = [];
        for (let i = 0; i < 11; i++) {
          const g = -78 + i * 15.6, b = polar(P, g, 9);
          bases.push(b);
          c += curva(foliolo(b, g, 50 - 7 * abs(g) / 78, 4.4, Math.sign(g) * 9), true);
        }
        return { contorno: c, nervura: curva([pt(50, 128), pt(51, 110), P]) + curva(bases) };
      }
    },
    oliveira: {
      nome: 'Oliveira',
      desenha() {
        const P = [pt(46, 128), pt(36, 90), pt(64, 46), pt(57, 8)];
        let c = '', n = '';
        for (const t of [.2, .32, .44, .56, .68, .8]) {
          const b = bez(P, t), g = dirBez(P, t), l = 31 - t * 9;
          for (const s of [-1, 1]) {
            const gg = g + s * 40;
            c += curva(foliolo(b, gg, l, 4.2, -s * 7), true);
            n += curva([b, polar(b, gg - s * 3.5, l * .45), polar(b, gg - s * 7, l * .84)]);
          }
        }
        const pb = bez(P, .97), pg = dirBez(P, .97);
        c += curva(foliolo(pb, pg, 20, 3.6), true);
        return { contorno: c, nervura: caule(P), laterais: n };
      }
    }
  };

  function riempi(svg) {
    const folha = FOLHAS[svg.dataset.folha];
    if (!folha) return;
    const cor = svg.dataset.colore || '#0a5b58', tr = Number(svg.dataset.tratto || 1.3);
    const traco = (k, extra = '') => `fill="none" stroke="${cor}" stroke-width="${(tr * k).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"${extra}`;
    const d = folha.desenha();
    svg.setAttribute('viewBox', '0 0 100 130');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path d="${d.contorno}" ${traco(1)}/>` + (d.nervura ? `<path d="${d.nervura}" ${traco(.8)}/>` : '') + (d.laterais ? `<path d="${d.laterais}" ${traco(.6, ' opacity=".75"')}/>` : '');
    try {
      const b = svg.getBBox(), m = 3;
      if (b.width) svg.setAttribute('viewBox', `${f(b.x - m)} ${f(b.y - m)} ${f(b.width + 2 * m)} ${f(b.height + 2 * m)}`);
    } catch (e) { /* fuori dalla pagina: resta la scatola intera */ }
  }

  window.Folhas = { riempi, nomes: Object.keys(FOLHAS), nome: k => (FOLHAS[k] || {}).nome };
})();
