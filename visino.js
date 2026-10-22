// O Visinho, o mascote do Velvet: o mesmo rostinho do ícone, com expressões e acessórios.
// Uso: Visino.desenha('feliz') devolve um <svg>. Estados: serena, acordada, dica, feliz, semana, noite, sol, cuidado.
(function () {
  'use strict';
  const INK = '#24181e', CREMA = '#fff0d8', ROSA = '#f19aa9', GIALLO = '#fec340', VERDE = '#0a5b58', CREMISI = '#b61e42', MALVA = '#b58aa9';
  const traco = (w = 6) => `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const brilho = (x, y, r, cor) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${cor}"/>`;

  const folhas = `<path d="M100 48C82 46 69 32 68 13C87 13 99 28 100 48Z" fill="#4f9a5e" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M100 48C118 46 131 32 132 13C113 13 101 28 100 48Z" fill="#86c38a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  const rosto = `<circle cx="100" cy="122" r="74" fill="${CREMA}" stroke="${INK}" stroke-width="6"/>`;
  const bochechas = `<circle cx="62" cy="140" r="12" fill="${ROSA}"/><circle cx="138" cy="140" r="12" fill="${ROSA}"/>`;
  const olhosFechados = `<path d="M56 118q14 13 28 0M116 118q14 13 28 0" ${traco(7)}/>`;
  const olhosAbertos = `<ellipse cx="72" cy="117" rx="8" ry="10" fill="${INK}"/><ellipse cx="128" cy="117" rx="8" ry="10" fill="${INK}"/>
    <circle cx="75" cy="113" r="3" fill="#fff"/><circle cx="131" cy="113" r="3" fill="#fff"/>`;
  const olhosRindo = `<path d="M56 122q14 -15 28 0M116 122q14 -15 28 0" ${traco(7)}/>`;
  const piscando = `<ellipse cx="72" cy="117" rx="8" ry="10" fill="${INK}"/><circle cx="75" cy="113" r="3" fill="#fff"/><path d="M116 120q14 -12 28 0" ${traco(7)}/>`;
  const sorriso = `<path d="M88 148q12 11 24 0" ${traco(6)}/>`;
  const sorrisao = `<path d="M82 144q18 26 36 0Z" fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M92 156q8 6 16 0" fill="none" stroke="${ROSA}" stroke-width="6" stroke-linecap="round"/>`;

  const ESTADOS = {
    serena: () => folhas + rosto + bochechas + olhosFechados + sorriso,
    acordada: () => folhas + rosto + bochechas + olhosAbertos + sorriso,
    dica: () => folhas + rosto + bochechas + piscando + sorriso +
      // uma lampadinha: é hora da dica
      `<g transform="translate(156 40)"><path d="M-12 4a16 16 0 1 1 24 0c-4 4-5 7-5 11h-14c0-4-1-7-5-11z" fill="${GIALLO}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
       <path d="M-6 20h12M-4 26h8" ${traco(4.5)}/><path d="M-24 -18l-6 -5M24 -18l6 -5M0 -26v-8" ${traco(4)}/></g>`,
    feliz: () => folhas + rosto + bochechas + olhosRindo + sorrisao + brilho(28, 70, 14, GIALLO) + brilho(176, 92, 10, GIALLO) + brilho(170, 40, 7, MALVA),
    semana: () => rosto + bochechas + olhosRindo + sorrisao +
      `<path d="M58 54L66 20L86 42L100 12L114 42L134 20L142 54Z" fill="${GIALLO}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
       <circle cx="100" cy="36" r="6" fill="${CREMISI}"/>` + brilho(24, 98, 14, GIALLO) + brilho(178, 104, 12, GIALLO) + brilho(30, 40, 8, MALVA) + brilho(172, 44, 9, MALVA),
    noite: () => folhas + rosto + bochechas + olhosFechados + `<circle cx="100" cy="152" r="6" fill="${INK}"/>` +
      `<path d="M40 84Q100 60 160 84L156 102Q100 80 44 102Z" fill="${MALVA}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
      `<text x="158" y="70" font-family="Georgia, serif" font-weight="700" font-size="26" fill="${VERDE}">z</text><text x="176" y="48" font-family="Georgia, serif" font-weight="700" font-size="18" fill="${VERDE}">z</text>`,
    sol: () => folhas + rosto + bochechas + sorriso +
      `<path d="M30 92Q100 70 170 92" fill="none" stroke="${INK}" stroke-width="5"/>
       <rect x="46" y="102" width="44" height="30" rx="12" fill="${INK}"/><rect x="110" y="102" width="44" height="30" rx="12" fill="${INK}"/><path d="M90 112h20" ${traco(5)}/>
       <path d="M54 108l10 -2" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>
       <ellipse cx="100" cy="66" rx="84" ry="16" fill="${GIALLO}" stroke="${INK}" stroke-width="5"/>
       <path d="M58 64Q60 26 100 24Q140 26 142 64Z" fill="${GIALLO}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
       <path d="M60 56Q100 46 140 56" fill="none" stroke="${CREMISI}" stroke-width="9"/>`,
    cuidado: () => folhas + rosto + bochechas +
      `<ellipse cx="72" cy="120" rx="7" ry="8" fill="${INK}"/><ellipse cx="128" cy="120" rx="7" ry="8" fill="${INK}"/>
       <path d="M58 106l24 -7M142 106l-24 -7" ${traco(6)}/><path d="M86 152q7 -6 14 0t14 0" ${traco(6)}/>
       <path d="M160 80c0 0-8 10-8 16a8 8 0 0 0 16 0c0-6-8-16-8-16z" fill="#9fd3e6" stroke="${INK}" stroke-width="4"/>`
  };

  function desenha(estado = 'serena', classe = '') {
    const f = ESTADOS[estado] || ESTADOS.serena;
    return `<svg class="visino ${classe}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Visinho">${f()}</svg>`;
  }

  window.Visino = { desenha, estados: Object.keys(ESTADOS) };
})();
