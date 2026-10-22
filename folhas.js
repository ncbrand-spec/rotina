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
    },

    // ---------- a coleção de casa: alocásias, begônia, adansonii, pilea, caladium, antúrio ----------
    'alocasia-polly': {
      nome: 'Alocasia Polly',
      desenha() {
        // borda em «ondas»: os vales (quinas) são onde chegam as nervuras brancas
        const esq = [[40, 13], [36.5, 21, 1], [29, 26], [26.5, 35, 1], [19, 41], [19, 50, 1], [13, 57], [16, 66, 1], [12, 74], [18, 81, 1], [17, 90], [21, 99], [26, 108, 1], [34, 101], [42, 91], [47, 85]];
        const contorno = sagitada(esq, 6, 82);
        const vales = esq.filter(p => p[2]).slice(0, 5);
        const veias = vales.map(([x, y]) => [pt(50, y + 10), pt(50 - (50 - x) * .55, y + 2), pt(x + 1.5, y + .5)]);
        const nerv = [curva([pt(50, 82), pt(50, 40), pt(50, 9)]), ...espelha(veias).map(v => curva(v)), curva([pt(50, 82), pt(40, 92), pt(28, 104)]), curva([pt(50, 82), pt(60, 92), pt(72, 104)])].join('');
        return { contorno, nervura: curva([pt(50, 128), pt(51, 104), pt(50, 82)]) + nerv };
      }
    },
    'alocasia-zebrina': {
      nome: 'Alocasia Zebrina',
      desenha() {
        const esq = [[44, 14], [38, 28], [33, 44], [30, 58], [29, 70], [27, 82], [20, 104, 1], [30, 96], [40, 90]];
        const contorno = sagitada(esq, 4, 86);
        const veias = [[22], [36], [50], [64]].map(([y]) => [pt(50, y + 8), pt(50 - (50 - borda(esq, y)) * .55, y + 2), pt(borda(esq, y) + 2.5, y - 1)]);
        let listras = '';
        for (let y = 92; y < 126; y += 5.5) listras += reta(pt(48.6, y + 1.6), pt(51.4, y - .6));   // o pecíolo listrado de zebra
        return {
          contorno, nervura: reta(pt(48.6, 86), pt(48.6, 128)) + reta(pt(51.4, 86), pt(51.4, 128)) + curva([pt(50, 86), pt(50, 40), pt(50, 7)]),
          laterais: espelha(veias).map(v => curva(v)).join('') + curva([pt(50, 86), pt(36, 92), pt(23, 101)]) + curva([pt(50, 86), pt(64, 92), pt(77, 101)]),
          riscas: listras
        };
      }
    },
    'alocasia-frydek': {
      nome: 'Alocasia Frydek',
      desenha() {
        const esq = [[43, 12], [35, 24], [27, 38], [21, 52], [18, 64], [18, 76], [21, 88], [25, 100], [28, 112, 1], [36, 104], [43, 94], [47, 88]];
        const contorno = sagitada(esq, 4, 84);
        // nervuras largas e claras: cada uma desenhada como faixa de duas linhas
        const faixa = (a, b, c) => [-1.3, 1.3].map(o => curva([pt(a.x, a.y + o), pt(b.x, b.y + o), pt(c.x, c.y + o)])).join('');
        let nerv = reta(pt(48.7, 84), pt(48.7, 8)) + reta(pt(51.3, 84), pt(51.3, 8));
        for (const y of [24, 38, 52, 66]) {
          const xe = borda(esq, y);
          nerv += faixa(pt(50, y + 10), pt(50 - (50 - xe) * .5, y + 2), pt(xe + 3, y - 1)) + faixa(pt(50, y + 10), pt(50 + (50 - xe) * .5, y + 2), pt(100 - xe - 3, y - 1));
        }
        nerv += faixa(pt(50, 84), pt(40, 96), pt(30, 108)) + faixa(pt(50, 84), pt(60, 96), pt(70, 108));
        return { contorno, nervura: curva([pt(50, 128), pt(51, 106), pt(50, 84)]) + nerv };
      }
    },
    'begonia-rex': {
      nome: 'Begônia rex',
      desenha() {
        const S = pt(44, 80);
        const R = g => 26 + 38 * exp(-pow((g - 30) / 50, 2)) + 14 * exp(-pow((g + 100) / 45, 2));
        const contorno = [];
        for (let g = -170, i = 0; g <= 170; g += 10, i++) contorno.push(polar(S, g, R(g) + (i % 2 ? 2.2 : 0), i % 2 === 1 || g === 30));
        contorno.push(polar(S, 180, 8, true));
        const espiral = [];
        for (let t = 0; t <= 3.5 * PI; t += .35) espiral.push(pt(S.x + (1 + t * 1.4) * cos(t), S.y + (1 + t * 1.4) * sin(t)));
        const veias = [30, -30, 90, -95, 150, -145].map(g => curva([polar(S, g, 14), polar(S, g + 6, R(g) * .5), polar(S, g, R(g) * .82)])).join('');
        return { contorno: curva(contorno, true), nervura: curva(espiral) + curva([pt(42, 128), pt(43, 104), polar(S, 180, 8)]), laterais: veias };
      }
    },
    'monstera-adansonii': {
      nome: 'Monstera adansonii',
      desenha() {
        const contorno = [pt(56, 6, true), pt(46, 12), pt(36, 24), pt(29, 40), pt(27, 58), pt(29, 76), pt(35, 92), pt(43, 104), pt(50, 110, true), pt(58, 104), pt(66, 92), pt(71, 76), pt(72, 58), pt(69, 40), pt(63, 24)];
        // os buracos: elipses entre as nervuras, inclinadas como elas
        const elipse = (cx, cy, rx, ry, rot) => { const q = []; for (let k = 0; k < 8; k++) { const a = k * PI / 4; const x = rx * cos(a), y = ry * sin(a); q.push(pt(cx + x * cos(rad(rot)) - y * sin(rad(rot)), cy + x * sin(rad(rot)) + y * cos(rad(rot)))); } return curva(q, true); };
        const buracos = [[38, 36, 30], [35, 54, 24], [36, 72, 18], [41, 89, 12], [63, 38, -30], [65, 56, -24], [64, 74, -18], [59, 90, -12]].map(([x, y, r]) => elipse(x, y, 5.6, 2.5, r)).join('');
        const lat = [[46, 29, 40], [64, 28, 60], [82, 31, 79]].map(([y, xe, y2]) => reta(pt(51, y), pt(xe, y2 - 6)) + reta(pt(51, y), pt(100 - xe + 2, y2 - 6))).join('');
        return { contorno: curva(contorno, true) + buracos, nervura: curva([pt(50, 128), pt(50, 110), pt(52, 60), pt(56, 9)]), laterais: lat };
      }
    },
    pilea: {
      nome: 'Pilea',
      desenha() {
        const C = pt(50, 60), P = pt(50, 66);
        const R = g => 40 + 2.5 * exp(-(g * g) / 80);
        const contorno = [];
        for (let g = -165; g <= 180; g += 15) contorno.push(polar(C, g, R(g)));
        const veias = [0, 40, 80, 120, 160, 200, 240, 280, 320].map(g => curva([P, polar(C, g + 4, R(g) * .5), polar(C, g, R(g) - 5)])).join('');
        return { contorno: curva(contorno, true), nervura: reta(pt(50, 100), pt(50, 128)), laterais: veias, pontos: [{ x: P.x, y: P.y, r: 1.8 }] };
      }
    },
    caladium: {
      nome: 'Caladium',
      desenha() {
        const esq = [[40, 14], [30, 26], [21, 42], [16, 58], [16, 72], [20, 86], [28, 98], [37, 104], [44, 100]];
        const contorno = sagitada(esq, 6, 90);
        const pts = [pt(50, 6), ...esq.map(([x, y]) => pt(x, y)), pt(50, 90), ...esq.slice().reverse().map(([x, y]) => pt(100 - x, y))];
        const veias = espelha([24, 38, 52, 66].map(y => [pt(50, y + 8), pt(50 - (50 - borda(esq, y)) * .5, y + 1), pt(borda(esq, y) + 4, y - 3)])).map(v => curva(v)).join('');
        // as pintinhas, espalhadas de um jeito sempre igual
        let semente = 7;
        const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
        const pontos = [];
        while (pontos.length < 18) {
          const q = pt(18 + rnd() * 64, 16 + rnd() * 80);
          const folga = [[5, 0], [-5, 0], [0, 5], [0, -5]].every(([dx, dy]) => dentro(pt(q.x + dx, q.y + dy), pts));   // longe da borda
          if (folga && abs(q.x - 50) > 4) pontos.push({ x: q.x, y: q.y, r: 1.1 + rnd() * 1.2 });
        }
        return { contorno, nervura: curva([pt(50, 128), pt(51, 106), pt(50, 90), pt(50, 50), pt(50, 9)]) + curva([pt(50, 90), pt(38, 94), pt(27, 90)]) + curva([pt(50, 90), pt(62, 94), pt(73, 90)]), laterais: veias, pontos };
      }
    },
    anturio: {
      nome: 'Antúrio',
      desenha() {
        const esq = [[40, 16], [30, 30], [22, 48], [19, 64], [22, 80], [30, 92], [40, 98], [46, 96]];
        const contorno = sagitada(esq, 8, 90);
        let finas = '';
        for (const k of [-3, -2, -1, 1, 2, 3]) finas += curva([pt(50 + k * 1.2, 88), pt(50 + k * 8.5, 56), pt(50 + k * 3, 16)]);
        // a espádice: o «pendão» que sai do centro do antúrio
        const A = pt(51, 84), B = pt(67, 42), g = atan2(B.x - A.x, -(B.y - A.y)) * 180 / PI;
        const M = pt((A.x + B.x) / 2, (A.y + B.y) / 2);
        const esp = [polar(A, g - 90, 4, true), polar(M, g - 90, 4.4), polar(B, g - 90, 3.4), polar(B, g, 3.6), polar(B, g + 90, 3.4), polar(M, g + 90, 4.4), polar(A, g + 90, 4, true)];
        const pontos = [];
        for (let t = .15; t < .95; t += .1) for (const o of [-1.8, 1.8]) { const q = pt(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t); pontos.push({ ...polar(q, g + 90, o), r: .7 }); }
        return { contorno, partes: [{ d: curva(esp, true), cor: '#fec340' }], nervura: curva([pt(50, 128), pt(51, 106), pt(50, 90)]) + curva([pt(50, 90), pt(50, 50), pt(50, 11)]), laterais: finas, pontos };
      }
    }
  };

  // folha com a ponta em cima e o seio embaixo: recebe o lado esquerdo (do alto até o seio) e espelha o direito
  function sagitada(esq, ponta, seio) {
    const L = esq.map(([x, y, a]) => pt(x, y, !!a));
    const R = esq.slice().reverse().map(([x, y, a]) => pt(100 - x, y, !!a));
    return curva([pt(50, ponta, true), ...L, pt(50, seio, true), ...R], true);
  }
  // x da borda esquerda na altura y (interpolando os pontos do lado esquerdo)
  function borda(esq, y) {
    for (let i = 0; i < esq.length - 1; i++) {
      const [x1, y1] = esq[i], [x2, y2] = esq[i + 1];
      if ((y - y1) * (y - y2) <= 0 && y1 !== y2) return x1 + (x2 - x1) * (y - y1) / (y2 - y1);
    }
    return esq[0][0];
  }
  const espelha = veias => [...veias, ...veias.map(v => v.map(q => pt(100 - q.x, q.y)))];
  function dentro(q, poli) {
    let d = false;
    for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      const a = poli[i], b = poli[j];
      if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) d = !d;
    }
    return d;
  }

  // as cores de cada folha no estilo «colore» (as mudas da Estufa): folha, nervuras, haste, pintinhas
  const CORES = {
    ginkgo: { folha: '#8fbf4f', veia: '#c9e08f' },
    samambaia: { folha: '#4f9a5e', veia: '#2c6b4b' },
    bananeira: { folha: '#6aa84f', veia: '#a9d18e' },
    bordo: { folha: '#c8553d', veia: '#eba088', haste: '#8a3a28' },
    carvalho: { folha: '#7d9a3a', veia: '#b9cc7a' },
    figueira: { folha: '#4a8a4a', veia: '#8fc28a' },
    palmeira: { folha: '#3f7f5a', veia: '#2c5a40' },
    oliveira: { folha: '#8aa38a', veia: '#c6d6c0', haste: '#7a6a4a' },
    'alocasia-polly': { folha: '#1d4b3a', veia: '#e9efe3' },
    'alocasia-zebrina': { folha: '#4f8a4a', veia: '#a7cf8f', riscas: '#2a2a20', haste: '#c9b98a' },
    'alocasia-frydek': { folha: '#1f3d2f', veia: '#dfe8d6' },
    'begonia-rex': { folha: '#6e4362', veia: '#d9cde6', haste: '#8a4a5a' },
    'monstera-adansonii': { folha: '#2c7a4b', veia: '#5fa577' },
    pilea: { folha: '#5aa25a', veia: '#9fd08f', pontos: '#2c6b4b' },
    caladium: { folha: '#f4c7d3', veia: '#b61e42', pontos: '#ffffff' },
    anturio: { folha: '#b61e42', veia: '#8f1233', pontos: '#c98f1f' }
  };

  function riempi(svg) {
    const nomeFolha = svg.dataset.folha, folha = FOLHAS[nomeFolha];
    if (!folha) return;
    const cor = svg.dataset.colore || '#0a5b58', tr = Number(svg.dataset.tratto || 1.3);
    const traco = (k, extra = '') => `fill="none" stroke="${cor}" stroke-width="${(tr * k).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"${extra}`;
    const d = folha.desenha();
    svg.setAttribute('viewBox', '0 0 100 130');
    svg.setAttribute('aria-hidden', 'true');
    if (svg.dataset.stile === 'colore') {
      // folha cheia; as nervuras ficam claras só dentro da folha (recorte), a haste fica verde por fora
      const c = Object.assign({ haste: '#4f7a5f', pontos: '#ffffff', riscas: '#24181e' }, CORES[nomeFolha] || { folha: '#3f8a5a', veia: '#a7cf8f' });
      const id = 'f' + Math.random().toString(36).slice(2, 9);
      let manchas = '';
      if (svg.dataset.variegata === 'si') {      // a versão rara: manchas brancas, sempre iguais para a mesma folha
        let semente = nomeFolha.length * 977;
        const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 7; i++) manchas += `<ellipse cx="${f(15 + rnd() * 70)}" cy="${f(10 + rnd() * 90)}" rx="${f(5 + rnd() * 8)}" ry="${f(3 + rnd() * 6)}" transform="rotate(${f(rnd() * 180)} 50 60)"/>`;
      }
      svg.innerHTML = `<defs><clipPath id="${id}"><path d="${d.contorno}" clip-rule="evenodd"/></clipPath></defs>` +
        (d.nervura ? `<path data-caixa d="${d.nervura}" fill="none" stroke="${c.haste}" stroke-width="2.4" stroke-linecap="round"/>` : '') +
        `<path data-caixa d="${d.contorno}" fill="${c.folha}" fill-rule="evenodd"/>` +
        (manchas ? `<g clip-path="url(#${id})" fill="#f6f1e2" opacity=".92">${manchas}</g>` : '') +
        `<g clip-path="url(#${id})" fill="none" stroke="${c.veia}" stroke-linecap="round">` +
          (d.nervura ? `<path d="${d.nervura}" stroke-width="2.2"/>` : '') + (d.laterais ? `<path d="${d.laterais}" stroke-width="1.3" opacity=".9"/>` : '') + '</g>' +
        (d.partes || []).map(p => `<path d="${p.d}" fill="${p.cor}"/>`).join('') +
        (d.riscas ? `<path d="${d.riscas}" fill="none" stroke="${c.riscas}" stroke-width="1.4" stroke-linecap="round"/>` : '') +
        (d.pontos || []).map(p => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${p.r.toFixed(2)}" fill="${c.pontos}"/>`).join('');
    } else {
      svg.innerHTML = `<path d="${d.contorno}" ${traco(1)}/>` + (d.partes || []).map(p => `<path d="${p.d}" ${traco(1)}/>`).join('') +
        (d.nervura ? `<path d="${d.nervura}" ${traco(.8)}/>` : '') + (d.laterais ? `<path d="${d.laterais}" ${traco(.6, ' opacity=".75"')}/>` : '') +
        (d.riscas ? `<path d="${d.riscas}" ${traco(.6, ' opacity=".75"')}/>` : '') +
        (d.pontos || []).map(p => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${p.r.toFixed(2)}" fill="${cor}" opacity=".8"/>`).join('');
    }
    try {
      // a caixa só da folha (as manchas recortadas da versão rara não contam)
      const so = [...svg.querySelectorAll('[data-caixa]')].map(e => e.getBBox());
      const b = so.length ? so.reduce((a, x) => { const x1 = Math.min(a.x, x.x), y1 = Math.min(a.y, x.y); return { x: x1, y: y1, width: Math.max(a.x + a.width, x.x + x.width) - x1, height: Math.max(a.y + a.height, x.y + x.height) - y1 }; }) : svg.getBBox();
      const m = 3;
      if (b.width) svg.setAttribute('viewBox', `${f(b.x - m)} ${f(b.y - m)} ${f(b.width + 2 * m)} ${f(b.height + 2 * m)}`);
    } catch (e) { /* fuori dalla pagina: resta la scatola intera */ }
  }

  window.Folhas = { riempi, nomes: Object.keys(FOLHAS), nome: k => (FOLHAS[k] || {}).nome };
})();
