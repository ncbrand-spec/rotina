'use strict';

// ---------- datas ----------
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const deISO = s => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const somaDias = (s, n) => { const d = deISO(s); d.setDate(d.getDate() + n); return iso(d); };
const difDias = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);
const fmtCurto = s => s.slice(8, 10) + '/' + s.slice(5, 7);
const fmtDiaMes = s => { const d = deISO(s); return d.getDate() + ' ' + MESES_CURTOS[d.getMonth()]; };
const fmtLongo = s => { const d = deISO(s); return DIAS_SEMANA[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; };
const fmtHora = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const segundaDaSemana = s => somaDias(s, -((deISO(s).getDay() + 6) % 7));

// ?hoje=AAAA-MM-DD no endereço serve para testar outras datas
function hojeISO() {
  const q = new URLSearchParams(location.search).get('hoje');
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : iso(new Date());
}

// ---------- dados guardados no aparelho ----------
const CHAVE = 'rotina-skincare-v1';

function novoEstado() {
  const produtos = {};
  for (const p of PRODUTOS) produtos[p.id] = { estado: p.inicial };
  return { versao: 1, produtos, feitos: {}, completos: {}, estufa: { semanas: [], meses: [] }, diario: [], spf: {}, adiados: {} };
}

function carregar() {
  try {
    const t = localStorage.getItem(CHAVE);
    if (t) {
      const s = JSON.parse(t);
      for (const p of PRODUTOS) if (!s.produtos[p.id]) s.produtos[p.id] = { estado: p.inicial };
      s.feitos = s.feitos || {}; s.completos = s.completos || {}; s.estufa = s.estufa || { semanas: [], meses: [] }; s.diario = s.diario || []; s.spf = s.spf || {}; s.adiados = s.adiados || {};
      return s;
    }
  } catch (e) { /* começa do zero */ }
  return novoEstado();
}

let S = carregar();
let HOJE = hojeISO();

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(S)); }
  catch (e) { aviso('Não consegui guardar. Faça um backup na aba Guia.'); }
}

// ---------- regras da rotina ----------
const P = id => PRODUTOS.find(p => p.id === id);
const E = id => S.produtos[id];
const emViagem = d => d >= VIAGEM.inicio && d <= VIAGEM.fim;
const rotinaEstavel = d => d >= VIAGEM.estavelDesde && d <= VIAGEM.fim;
const faseDe = d => FASES.find(f => d >= f.de && (!f.ate || d <= f.ate)) || null;

function itensDoTurno(turno, dia) {
  const ordem = turno === 'manha' ? ORDEM_MANHA : ORDEM_NOITE;
  const itens = [];
  for (const id of ordem) {
    const p = P(id), e = E(id);
    let etiqueta = '';
    if (e.estado === 'em_uso') {
      // nada a acrescentar
    } else if (e.estado === 'introduzindo') {
      if (e.inicio && dia < e.inicio) continue;
      if (p.intro.tipo === 'adaptacao') {
        if (turno !== (e.turno || 'manha')) continue;
        const n = difDias(e.inicio, dia) + 1;
        etiqueta = n <= p.intro.dias ? `Novo · dia ${n} de ${p.intro.dias}` : '1 vez ao dia';
      } else {
        const nv = p.intro.niveis[e.nivel || 0];
        if (!nv.dias.includes(deISO(dia).getDay())) continue;
        etiqueta = nv.nome;
      }
    } else continue;
    itens.push({ p, etiqueta, opcional: !!p.opcional });
  }
  return itens;
}

function feitosDe(dia, turno) { return (S.feitos[dia] && S.feitos[dia][turno]) || {}; }

function progresso(dia, turno) {
  const itens = itensDoTurno(turno, dia).filter(i => !i.opcional);
  const f = feitosDe(dia, turno);
  const feitos = itens.filter(i => f[i.p.id]).length;
  return { feitos, total: itens.length, completo: itens.length > 0 && feitos === itens.length };
}

// ---------- o contador ----------
// Um dia conta quando manhã e noite ficaram completas. Fica guardado no momento da marcação,
// assim um produto novo na rotina não apaga os dias que já valeram.
function registrarDia(d) {
  S.completos[d] = { manha: progresso(d, 'manha').completo, noite: progresso(d, 'noite').completo };
}
const diaCompleto = d => !!(S.completos[d] && S.completos[d].manha && S.completos[d].noite);

function metaDaSemana(d) {
  const ini = segundaDaSemana(d);
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(ini, i));
  return { dias, feitos: dias.filter(diaCompleto).length };
}

// dias seguidos até hoje (se hoje ainda não está completo, conta até ontem)
function seguidos() {
  let d = diaCompleto(HOJE) ? HOJE : somaDias(HOJE, -1), n = 0;
  while (diaCompleto(d)) { n++; d = somaDias(d, -1); }
  return n;
}

function recorde() {
  let melhor = 0, atual = 0, antes = null;
  for (const d of Object.keys(S.completos).filter(diaCompleto).sort()) {
    atual = antes && difDias(antes, d) === 1 ? atual + 1 : 1;
    melhor = Math.max(melhor, atual);
    antes = d;
  }
  return melhor;
}

function podeIntroduzir(p, hoje) {
  if (p.liberaEm && hoje < p.liberaEm)
    return { ok: false, quando: p.liberaEm, motivo: `Pelo plano, começa a partir de ${fmtLongo(p.liberaEm)}.` };
  if (emViagem(hoje))
    return { ok: false, motivo: `Durante a viagem não estreamos nada novo. Pode começar a partir de ${fmtDiaMes(somaDias(VIAGEM.fim, 1))}.` };
  for (const q of PRODUTOS) {
    if (q.id === p.id) continue;
    const e = E(q.id);
    if (e.inicio && difDias(e.inicio, hoje) >= 0 && difDias(e.inicio, hoje) < 7) {
      const livre = somaDias(e.inicio, 7);
      return { ok: false, quando: livre, motivo: `Uma novidade por semana: ${q.curto} começou em ${fmtCurto(e.inicio)}. Pode começar a partir de ${fmtLongo(livre)}.` };
    }
  }
  const faltam = difDias(hoje, VIAGEM.inicio);
  if (faltam > 0 && faltam <= 9)
    return { ok: true, aviso: `Faltam ${faltam} dias para a viagem. Só comece se der tempo de observar como a pele reage; se não, espere até depois de ${fmtCurto(VIAGEM.fim)}.` };
  return { ok: true };
}

function horasDeTeste(e) { return (Date.now() - e.testeEm) / 3600000; }

function acoesDeHoje() {
  const a = [];
  const faltam = difDias(HOJE, VIAGEM.inicio);
  if (emViagem(HOJE)) a.push({ tipo: 'viagem' });
  else if (faltam > 0 && faltam <= 14) a.push({ tipo: 'preViagem', faltam });
  else if (HOJE > VIAGEM.fim && difDias(VIAGEM.fim, HOJE) <= 14 && !S.adiados.reavaliar) a.push({ tipo: 'reavaliar' });

  for (const p of PRODUTOS) {
    const e = E(p.id);
    if (e.estado === 'pausado') a.push({ tipo: 'pausado', p, e });
    else if (e.estado === 'teste') a.push({ tipo: 'teste', p, e });
    else if (e.estado === 'pronto' && p.intro) {
      const g = podeIntroduzir(p, HOJE);
      if (g.ok) a.push({ tipo: 'comecar', p, g });
      else if (g.quando && difDias(HOJE, g.quando) <= 7) a.push({ tipo: 'embreve', p, g });
      else if (!g.quando) a.push({ tipo: 'bloqueado', p, g });
    } else if (e.estado === 'introduzindo' && !(S.adiados[p.id] && HOJE < S.adiados[p.id])) {
      if (p.intro.tipo === 'adaptacao') {
        if (difDias(e.inicio, HOJE) >= p.intro.dias) a.push({ tipo: 'confirmar', p, e });
      } else {
        const nv = e.nivel || 0;
        if (nv < p.intro.niveis.length - 1 && difDias(e.nivelDesde || e.inicio, HOJE) >= p.intro.subirApos && !rotinaEstavel(HOJE))
          a.push({ tipo: 'subir', p, e });
      }
    }
  }
  return a;
}

// ---------- tela ----------
const vista = { aba: 'hoje', dia: HOJE, mes: HOJE.slice(0, 7), abertos: {}, form: { sintomas: [], produto: '', nota: '' }, resultado: null, desde: null, dica: 0, festa: null };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONES = {
  hoje: '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.4l2.6 2.6 5-5.2"/>',
  produtos: '<path d="M10 2.8h4v3.4l2.2 2.3V20a1.2 1.2 0 0 1-1.2 1.2H9A1.2 1.2 0 0 1 7.8 20V8.5L10 6.2z"/><path d="M7.8 12.5h8.4"/>',
  calendario: '<rect x="3.6" y="5" width="16.8" height="15.4" rx="2.4"/><path d="M3.6 10h16.8M8.2 2.8v4M15.8 2.8v4"/>',
  diario: '<path d="M6.5 3.2h10.3a1.8 1.8 0 0 1 1.8 1.8v14a1.8 1.8 0 0 1-1.8 1.8H6.5z"/><path d="M6.5 3.2v17.6M10.2 8h5M10.2 11.8h5"/>',
  guia: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.6M12 7.6v.2"/>',
  sol: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
  lua: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z"/>',
  check: '<path d="M6.5 12.4l3.6 3.6 7.4-7.6"/>',
  mais: '<circle cx="12" cy="12" r="8.5"/><path d="M12 10.8v5.4M12 7.7v.2"/>',
  esq: '<path d="M14.5 6l-6 6 6 6"/>',
  dir: '<path d="M9.5 6l6 6-6 6"/>'
};
const icone = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[n]}</svg>`;

// as piante della Serra: si disegnano una volta sola e poi si ricopiano a ogni render
const DECOR = document.documentElement.dataset;
const cachePlantas = {};
function plantas(raiz) {
  raiz.querySelectorAll('svg[data-pianta], svg[data-folha]').forEach(svg => {
    const k = ['pianta', 'folha', 'stile', 'vaso', 'appeso', 'colore', 'variegata'].map(a => svg.dataset[a]).join('|');
    if (!cachePlantas[k]) {
      if (svg.dataset.folha && window.Folhas) Folhas.riempi(svg);
      else if (svg.dataset.pianta && window.Piante) Piante.riempi(svg);
      cachePlantas[k] = [svg.getAttribute('viewBox'), svg.innerHTML];
      return;
    }
    svg.setAttribute('viewBox', cachePlantas[k][0]); svg.setAttribute('aria-hidden', 'true'); svg.innerHTML = cachePlantas[k][1];
  });
}

// a folha do cartão da fase: uma diferente a cada abertura do app (nunca a mesma da vez anterior)
const FOLHAS_SERRA = { 'foglia-monstera': 'Costela-de-adão', 'foglia-alocasia': 'Alocásia', 'foglia-filodendro': 'Filodendro Brasil', 'foglia-stromanthe': 'Maranta Triostar', 'foglia-begonia': 'Begônia maculata' };
const folhaDaVez = (() => {
  const pedida = new URLSearchParams(location.search).get('folha') || DECOR.ramoFase;
  if (!pedida || pedida !== 'variada') return pedida || null;
  const todas = [...Object.keys(FOLHAS_SERRA), ...(window.Folhas ? Folhas.nomes : [])];
  let ultima = null;
  try { ultima = localStorage.getItem('rotina-folha'); } catch (e) { /* sem memória: tanto faz */ }
  const opcoes = todas.filter(x => x !== ultima);
  const escolha = opcoes[Math.floor(Math.random() * opcoes.length)];
  try { localStorage.setItem('rotina-folha', escolha); } catch (e) { /* idem */ }
  return escolha;
})();
const nomeDaFolha = k => FOLHAS_SERRA[k] || (window.Folhas && Folhas.nome(k)) || '';
const folhaDaFase = () => {
  if (!folhaDaVez) return '';
  const attr = folhaDaVez.startsWith('foglia-') ? `data-pianta="${folhaDaVez}" data-stile="linea"` : `data-folha="${folhaDaVez}"`;
  return `<svg class="ramo" ${attr} data-colore="${DECOR.ramoCor || '#c98f1f'}" data-tratto="1.4"></svg>`;
};
const plantaAppesa = () => DECOR.plantaTopo ? `<svg class="planta-appesa" data-pianta="${DECOR.plantaTopo}" data-stile="colore" data-vaso="crema" data-appeso="si"></svg>` : '';
const prateleira = () => DECOR.plantasRodape ? `<div class="prateleira">${DECOR.plantasRodape.split(',').map(x => { const [n, v] = x.split(':'); return `<svg data-pianta="${n}" data-stile="colore" data-vaso="${v}"></svg>`; }).join('')}</div>` : '';

function render() {
  const mesmaAba = render.ultimaAba === vista.aba;
  const y = window.scrollY;
  const telas = { hoje: telaHoje, estufa: telaEstufa, produtos: telaProdutos, calendario: telaCalendario, diario: telaDiario, guia: telaGuia };
  const tela = document.getElementById('tela');
  tela.innerHTML = telas[vista.aba]() + (vista.festa ? festaHTML() : '');
  plantas(tela);
  document.querySelectorAll('#abas button').forEach(b => b.setAttribute('aria-current', b.dataset.aba === vista.aba ? 'page' : 'false'));
  window.scrollTo(0, mesmaAba ? y : 0);
  render.ultimaAba = vista.aba;
}

// ---------- Hoje ----------
function saudacao() { const h = new Date().getHours(); return h < 12 ? 'Bom dia.' : h < 18 ? 'Boa tarde.' : 'Boa noite.'; }

function resumo(d) {
  const m = progresso(d, 'manha'), n = progresso(d, 'noite');
  const faltam = (p, quando) => { const x = p.total - p.feitos; return `${x === 1 ? 'Falta 1 passo' : `Faltam ${x} passos`} ${quando}.`; };
  if (d > HOJE) return 'Dia futuro: só para consultar.';
  if (m.completo && n.completo) return 'Rotina completa. Muito bem!';
  if (d < HOJE) return `Manhã ${m.feitos} de ${m.total} · noite ${n.feitos} de ${n.total}.`;
  if (new Date().getHours() < 15) return m.completo ? `Manhã feita. À noite são ${n.total} passos.` : faltam(m, 'de manhã');
  return n.completo ? 'Noite feita.' : faltam(n, 'à noite');
}

function telaHoje() {
  const d = vista.dia, ehHoje = d === HOJE, dd = deISO(d);
  const fase = faseDe(d);
  let h = `<div class="tela-hoje"><header class="testata">
    ${plantaAppesa()}
    <p class="giorno">${ehHoje ? DIAS_SEMANA[dd.getDay()] : (d < HOJE ? 'Dia passado · ' : 'Dia futuro · ') + DIAS_SEMANA[dd.getDay()]}</p>
    <h1 class="data"><span class="sublinhado">${dd.getDate()} de ${MESES[dd.getMonth()]}</span></h1>
    <p class="saudacao">${ehHoje ? `<b>${saudacao()}</b> ` : ''}${esc(resumo(d))}</p>
    ${ehHoje ? '' : '<button class="link" data-acao="irHoje">Voltar para hoje</button>'}
  </header>`;
  if (ehHoje && window.Visino) h += falaHTML();
  h += semana(d);
  if (fase) h += `<button class="fase${fase.viagem ? ' fase-sol' : ''}" data-acao="aba" data-aba="calendario">
      ${folhaDaFase()}
      <span class="fase-selo">Fase ${FASES.indexOf(fase) + 1} de ${FASES.length}</span>
      <strong>${esc(fase.titulo)}</strong>
      <span class="fase-obj">${esc(fase.objetivo)}${fase.ate ? ` <em>Até ${fmtDiaMes(fase.ate)}.</em>` : ''}</span>
      ${folhaDaVez ? `<span class="fase-folha">Folha de hoje · ${esc(nomeDaFolha(folhaDaVez))}</span>` : ''}
    </button>`;
  const acoes = ehHoje ? acoesDeHoje().map(cartaoAcao).join('') : '';
  if (acoes) h += `<div class="acoes">${acoes}</div>`;
  h += turno('manha', d) + turno('noite', d);
  return h + prateleira() + '</div>';
}

function semana(d) {
  const ini = segundaDaSemana(d);
  let h = `<div class="semana"><div class="semana-linha"><button class="seta" data-acao="semana" data-n="-7" aria-label="Semana anterior">${icone('esq')}</button><div class="dias">`;
  for (let i = 0; i < 7; i++) {
    const x = somaDias(ini, i), dd = deISO(x);
    const m = progresso(x, 'manha'), n = progresso(x, 'noite');
    const ponto = p => p.completo ? 'cheio' : (p.feitos ? 'meio' : '');
    h += `<button class="dia${x === d ? ' sel' : ''}${x === HOJE ? ' hoje' : ''}${emViagem(x) ? ' sol' : ''}" data-acao="verDia" data-dia="${x}" aria-label="${fmtLongo(x)}${diaCompleto(x) ? ', dia completo' : ''}">
      <span class="letra">${DIAS_CURTOS[dd.getDay()]}</span><span class="num">${dd.getDate()}</span>
      ${diaCompleto(x) ? `<span class="ok-dia">${icone('check')}</span>` : `<span class="pontos">${x <= HOJE ? `<i class="${ponto(m)}"></i><i class="${ponto(n)}"></i>` : '<i class="vazio"></i><i class="vazio"></i>'}</span>`}
    </button>`;
  }
  h += `</div><button class="seta" data-acao="semana" data-n="7" aria-label="Próxima semana">${icone('dir')}</button></div>`;
  const meta = metaDaSemana(d), seq = seguidos(), rec = recorde(), perfeita = meta.feitos === 7;
  return h + `<div class="semana-meta${perfeita ? ' perfeita' : ''}">
    <div class="meta-barra" role="progressbar" aria-valuenow="${meta.feitos}" aria-valuemin="0" aria-valuemax="7"><i style="width:${(meta.feitos / 7 * 100).toFixed(1)}%"></i></div>
    <p class="meta-texto">${perfeita ? '<strong>Semana perfeita!</strong> 7 de 7 dias' : `<strong>${meta.feitos} de 7</strong> dias completos na semana`}</p>
    <p class="meta-seq">${seq ? `${seq} ${seq === 1 ? 'dia seguido' : 'dias seguidos'}` : 'Complete hoje e comece a sequência'}${rec > 1 && rec > seq ? ` · recorde ${rec}` : ''}</p>
  </div></div>`;
}

function turno(t, d) {
  const itens = itensDoTurno(t, d);
  const f = feitosDe(d, t), pr = progresso(d, t);
  const futuro = d > HOJE;
  const pct = pr.total ? Math.round(pr.feitos / pr.total * 100) : 0;
  let h = `<section class="turno turno-${t}${pr.completo ? ' completo' : ''}"><span class="turno-selo">${pr.total} ${pr.total === 1 ? 'passo' : 'passos'}</span><div class="turno-topo">
    <h2><span class="turno-icone">${icone(t === 'manha' ? 'sol' : 'lua')}</span>${t === 'manha' ? 'Manhã' : 'Noite'}</h2>
    <span class="contagem">${pr.completo ? 'Completa ✓' : pr.feitos + ' de ' + pr.total}</span>
  </div>
  <div class="barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
  <ol class="lista">`;
  let corpo = false, n = 0;
  itens.forEach(it => {
    const p = it.p, feito = !!f[p.id], chave = t + p.id, aberto = vista.abertos[chave];
    if (p.area === 'Corpo' && !corpo) { corpo = true; h += `<li class="separador">Corpo</li>`; }
    n++;
    h += `<li class="item${feito ? ' feito' : ''}${it.opcional ? ' opcional' : ''}">
      <button class="marcar" data-acao="marcar" data-turno="${t}" data-id="${p.id}" ${futuro ? 'disabled' : ''} aria-pressed="${feito}">
        <span class="bola"><span class="num">${n}</span>${icone('check')}</span>
        <span class="texto"><span class="nome">${esc(p.curto)}</span>
        ${it.etiqueta || it.opcional || E(p.id).repor ? `<span class="etiquetas">${it.etiqueta ? `<span class="etiqueta">${esc(it.etiqueta)}</span>` : ''}${it.opcional ? '<span class="etiqueta leve">Se precisar</span>' : ''}${E(p.id).repor ? '<span class="etiqueta aviso">Comprar</span>' : ''}</span>` : ''}</span>
      </button>
      <button class="info${aberto ? ' aberto' : ''}" data-acao="abrir" data-chave="${chave}" aria-label="Como usar ${esc(p.curto)}" aria-expanded="${!!aberto}">${icone('mais')}</button>
      ${aberto ? `<div class="detalhe"><p>${esc(p.como)}</p>${p.obs ? `<p class="obs">${esc(p.obs)}</p>` : ''}</div>` : ''}
    </li>`;
  });
  if (!itens.length) h += '<li class="vazio-lista">Nada neste turno.</li>';
  h += '</ol>';
  if (t === 'manha' && emViagem(d) && d === HOJE) h += spfCartao();
  return h + '</section>';
}

function spfCartao() {
  const vezes = S.spf[HOJE] || [];
  const ultima = vezes[vezes.length - 1];
  return `<div class="spf">
    <div><strong>Protetor ao ar livre</strong>
    <p>${vezes.length ? 'Hoje: ' + vezes.map(fmtHora).join(' · ') + '. Próxima por volta das ' + fmtHora(ultima + 2 * 3600000) + '.' : 'Reaplique a cada 2 horas e depois de água ou suor.'}</p></div>
    <button class="botao" data-acao="spf">Reapliquei agora</button>
  </div>`;
}

function cartaoAcao(a) {
  const p = a.p;
  switch (a.tipo) {
    case 'viagem': {
      const dia = difDias(VIAGEM.inicio, HOJE) + 1, total = difDias(VIAGEM.inicio, VIAGEM.fim) + 1;
      return cartao('sol', `Modo ${VIAGEM.lugar} · dia ${dia} de ${total}`, 'Só produtos já tolerados, nada novo. Protetor em quantidade generosa, reaplicado a cada 2 horas ao ar livre e depois de água ou suor. Chapéu e sombra ajudam.');
    }
    case 'preViagem':
      return cartao('sol', `Faltam ${a.faltam} dias para ${VIAGEM.lugar}`, TEXTOS.preViagem);
    case 'reavaliar':
      return cartao('', 'De volta: hora de reavaliar', TEXTOS.reavaliar,
        `<button class="botao leve" data-acao="aba" data-aba="calendario">Ver o plano</button><button class="botao leve" data-acao="adiar" data-id="reavaliar">Ok</button>`);
    case 'comecar': {
      const txt = p.intro.tipo === 'teste'
        ? 'Primeiro o teste: um pouco numa área pequena e discreta da pele externa, depois observar por 48–72 horas.'
        : p.intro.tipo === 'adaptacao'
          ? `Começar 1 vez ao dia por ${p.intro.dias} dias. Se a pele estiver bem, passa para manhã e noite.`
          : `Começar ${p.intro.niveis[0].nome} (${diasTexto(p.intro.niveis[0].dias)}).`;
      const titulo = p.intro.tipo === 'teste' ? `Pode fazer o teste do ${p.curto.split(' (')[0]}` : `Pode começar: ${p.curto}`;
      const outra = vista.desde === p.id
        ? `<form class="desde" data-form="desde" data-id="${p.id}"><label>Comecei em <input type="date" name="data" max="${HOJE}" value="${HOJE}"></label><button class="botao">Salvar</button></form>`
        : `<button class="botao leve" data-acao="desde" data-id="${p.id}">Já comecei antes</button>`;
      return cartao('novo', titulo, txt + (a.g.aviso ? `<span class="nota-aviso">${esc(a.g.aviso)}</span>` : ''),
        `<button class="botao" data-acao="comecar" data-id="${p.id}">${p.intro.tipo === 'teste' ? 'Fiz o teste hoje' : 'Comecei hoje'}</button>${outra}`);
    }
    case 'embreve':
      return cartao('espera', `Em breve: ${p.curto}`, a.g.motivo);
    case 'bloqueado':
      return cartao('espera', `${p.curto}: esperar`, a.g.motivo);
    case 'teste': {
      const h = horasDeTeste(a.e), pronto = h >= p.intro.horas;
      const resta = Math.ceil(p.intro.horas - h);
      return cartao('novo', `Teste do ${p.curto.split(' (')[0]} em andamento`,
        pronto ? `Já se passaram ${Math.floor(h)} horas. Sem ardência, coceira, vermelhidão ou inchaço? Então pode começar ${p.intro.niveis[0].nome}.`
          : `Observe a área por 48–72 horas. Daqui a cerca de ${resta} ${resta === 1 ? 'hora' : 'horas'} você já pode decidir.`,
        `${pronto ? `<button class="botao" data-acao="testeOk" data-id="${p.id}">Sem reação, começar</button>` : ''}<button class="botao leve perigo" data-acao="testeReacao" data-id="${p.id}">Tive reação</button>`);
    }
    case 'confirmar':
      return cartao('novo', `${p.curto}: ${p.intro.dias} dias completos`, 'A pele está confortável? Se sim, passa a usar manhã e noite.',
        `<button class="botao" data-acao="confirmar" data-id="${p.id}">Sim, manhã e noite</button><button class="botao leve" data-acao="adiar" data-id="${p.id}">Esperar mais uma semana</button>`);
    case 'subir': {
      const prox = p.intro.niveis[(a.e.nivel || 0) + 1];
      return cartao('novo', `${p.curto}: aumentar?`, `Já faz ${difDias(a.e.nivelDesde || a.e.inicio, HOJE)} dias em ${p.intro.niveis[a.e.nivel || 0].nome}. Se a pele estiver confortável, pode passar para ${prox.nome} (${diasTexto(prox.dias)}).`,
        `<button class="botao" data-acao="subir" data-id="${p.id}">Aumentar</button><button class="botao leve" data-acao="adiar" data-id="${p.id}">Manter assim</button>`);
    }
    case 'pausado':
      return cartao('alerta', `${p.curto} em pausa desde ${fmtCurto(a.e.pausadoEm)}`, 'Só retome quando a pele estiver normal.',
        `<button class="botao leve" data-acao="retomar" data-id="${p.id}">Retomar</button>`);
  }
  return '';
}

function cartao(tipo, titulo, texto, botoes = '') {
  return `<div class="cartao ${tipo}"><strong>${esc(titulo)}</strong><p>${texto.includes('<span') ? texto : esc(texto)}</p>${botoes ? `<div class="botoes">${botoes}</div>` : ''}</div>`;
}

function diasTexto(dias) {
  if (dias.length === 7) return 'todos os dias';
  const n = dias.map(d => DIAS_CURTOS[d]);
  return n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1];
}

// ---------- Produtos ----------
const ROTULOS = {
  em_uso: 'Na rotina', introduzindo: 'Começando', pronto: 'Pode começar', teste: 'Em teste',
  aguardando: 'Esperando', pausado: 'Em pausa', acabou: 'Acabou', futuro: 'Depois da viagem'
};

function telaProdutos() {
  let h = `<header class="topo"><p class="sobre">Produtos</p><h1>O que você usa</h1></header>`;
  const repor = PRODUTOS.filter(p => E(p.id).repor);
  if (repor.length) h += `<div class="cartao aviso"><strong>Para comprar</strong><ul class="compras">${repor.map(p => `<li><span>${esc(p.curto)}</span><button class="botao leve" data-acao="comprei" data-id="${p.id}">Comprei</button></li>`).join('')}</ul></div>`;
  const grupos = [
    ['Na rotina', p => ['em_uso', 'introduzindo'].includes(E(p.id).estado) && !p.gesto],
    ['Próximos', p => ['pronto', 'teste', 'aguardando'].includes(E(p.id).estado)],
    ['Em pausa', p => E(p.id).estado === 'pausado'],
    ['Acabaram', p => E(p.id).estado === 'acabou'],
    ['Depois da viagem', p => E(p.id).estado === 'futuro']
  ];
  for (const [nome, filtro] of grupos) {
    const lista = PRODUTOS.filter(filtro);
    if (!lista.length) continue;
    h += `<section class="grupo grupo-produtos"><h2>${nome}</h2>${lista.map(cartaoProduto).join('')}</section>`;
  }
  return h;
}

function cartaoProduto(p) {
  const e = E(p.id), chave = 'prod' + p.id, aberto = vista.abertos[chave];
  let estado = ROTULOS[e.estado], extra = '', botoes = '';
  if (e.estado === 'introduzindo') {
    if (p.intro.tipo === 'adaptacao') {
      extra = `Desde ${fmtCurto(e.inicio)} · 1 vez ao dia, de ${e.turno === 'noite' ? 'noite' : 'manhã'}`;
      botoes += `<button class="botao leve" data-acao="turno" data-id="${p.id}">Passar para ${e.turno === 'noite' ? 'a manhã' : 'a noite'}</button>`;
    } else {
      const nv = p.intro.niveis[e.nivel || 0];
      extra = `${nv.nome} · ${diasTexto(nv.dias)}`;
    }
  }
  if (e.estado === 'em_uso' || e.estado === 'introduzindo') {
    if (!e.repor) botoes += `<button class="botao leve" data-acao="acabou" data-id="${p.id}">Acabou</button>`;
    botoes += `<button class="botao leve perigo" data-acao="pausar" data-id="${p.id}">Pausar</button>`;
  }
  if (e.estado === 'aguardando') extra = `Entra quando o ${P(p.espera).curto} acabar.`;
  if (e.estado === 'teste') extra = `Teste feito em ${fmtCurto(e.inicio)}.`;
  if (e.estado === 'pronto' && p.intro) {
    const g = podeIntroduzir(p, HOJE);
    extra = g.ok ? 'Pode começar quando quiser.' : g.motivo;
    if (g.ok) botoes += `<button class="botao" data-acao="comecar" data-id="${p.id}">${p.intro.tipo === 'teste' ? 'Fiz o teste hoje' : 'Comecei hoje'}</button>`;
  }
  if (e.estado === 'pausado') { extra = `Desde ${fmtCurto(e.pausadoEm)}. Só retome quando a pele estiver normal.`; botoes += `<button class="botao leve" data-acao="retomar" data-id="${p.id}">Retomar</button>`; }
  if (e.estado === 'acabou') {
    extra = `Acabou em ${fmtCurto(e.acabouEm)}.`;
    if (!p.substituto || ['aguardando', 'pronto'].includes(E(p.substituto).estado)) botoes += `<button class="botao leve" data-acao="desfazerAcabou" data-id="${p.id}">Desfazer</button>`;
  }
  return `<article class="produto">
    <button class="produto-topo" data-acao="abrir" data-chave="${chave}" aria-expanded="${!!aberto}">
      <span class="area">${p.area}</span>
      <span class="nome">${esc(p.curto)}</span>
      <span class="selo ${e.estado}">${estado}</span>
    </button>
    ${extra ? `<p class="extra">${esc(extra)}</p>` : ''}
    ${aberto ? `<dl class="ficha"><dt>Nome completo</dt><dd>${esc(p.nome)}</dd><dt>Como usar</dt><dd>${esc(p.como)}</dd><dt>Frequência</dt><dd>${esc(p.freq)}</dd>${p.obs ? `<dt>Observações</dt><dd>${esc(p.obs)}</dd>` : ''}</dl>` : ''}
    ${botoes ? `<div class="botoes">${botoes}</div>` : ''}
  </article>`;
}

// ---------- Calendário ----------
function telaCalendario() {
  const [a, m] = vista.mes.split('-').map(Number);
  const primeiro = `${vista.mes}-01`;
  const diasNoMes = new Date(a, m, 0).getDate();
  const vazio = (deISO(primeiro).getDay() + 6) % 7;
  let h = `<header class="topo"><p class="sobre">Calendário</p><h1>O plano</h1></header>
  <div class="cal-grade"><section class="mes"><div class="mes-topo">
    <button class="seta" data-acao="mes" data-n="-1" aria-label="Mês anterior">${icone('esq')}</button>
    <h2>${MESES[m - 1]} ${a}</h2>
    <button class="seta" data-acao="mes" data-n="1" aria-label="Próximo mês">${icone('dir')}</button>
  </div><div class="grade">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(l => `<span class="cab">${l}</span>`).join('')}`;
  for (let i = 0; i < vazio; i++) h += '<span></span>';
  for (let n = 1; n <= diasNoMes; n++) {
    const x = `${vista.mes}-${String(n).padStart(2, '0')}`;
    const pm = progresso(x, 'manha'), pn = progresso(x, 'noite');
    const ponto = p => p.completo ? 'cheio' : (p.feitos ? 'meio' : '');
    h += `<button class="cel${x === HOJE ? ' hoje' : ''}${emViagem(x) ? ' sol' : ''}${x > HOJE ? ' depois' : ''}" data-acao="verDia" data-dia="${x}" aria-label="${fmtLongo(x)}">
      <span>${n}</span><span class="pontos">${x <= HOJE ? `<i class="${ponto(pm)}"></i><i class="${ponto(pn)}"></i>` : ''}</span></button>`;
  }
  const completosMes = Array.from({ length: diasNoMes }, (_, i) => `${vista.mes}-${String(i + 1).padStart(2, '0')}`).filter(diaCompleto).length;
  h += `</div><p class="mes-conta"><strong>${completosMes}</strong> ${completosMes === 1 ? 'dia completo' : 'dias completos'} em ${MESES[m - 1]}</p><p class="legenda"><span><i class="cheio"></i>completa</span><span><i class="meio"></i>em parte</span><span><i class="faixa"></i>${VIAGEM.lugar}</span></p></section>`;
  h += '<section class="grupo"><h2>As fases</h2><ol class="fases">';
  const atual = faseDe(HOJE);
  for (const f of FASES) {
    const agora = f === atual, passou = f.ate && f.ate < HOJE;
    h += `<li class="fase-item${agora ? ' agora' : ''}${passou ? ' passou' : ''}${f.viagem ? ' sol' : ''}">
      <p class="datas">${fmtDiaMes(f.de)}${f.ate ? ' – ' + fmtDiaMes(f.ate) : ' em diante'}${agora ? ' <span class="agora-selo">Agora</span>' : ''}</p>
      <h3>${esc(f.titulo)}</h3>
      <p>${esc(f.plano)}</p>
      <p class="nao"><strong>Não fazer:</strong> ${esc(f.naoFazer)}</p>
      <p class="obj"><strong>Objetivo:</strong> ${esc(f.objetivo)}</p>
    </li>`;
  }
  return h + '</ol></section></div>';
}

// ---------- Diário ----------
function telaDiario() {
  const fm = vista.form;
  const candidatos = PRODUTOS.filter(p => ['introduzindo', 'teste', 'em_uso'].includes(E(p.id).estado) && !p.gesto);
  let h = `<header class="topo"><p class="sobre">Diário da pele</p><h1>Como está a pele?</h1></header>
  <div class="diario-grade"><div class="diario-col">${vista.resultado || ''}
  <section class="cartao form-diario">
    <p class="rotulo">Hoje a pele está</p>
    <div class="chips">${SINTOMAS_LEVES.map(s => chip(s, fm.sintomas.includes(s), false)).join('')}</div>
    <p class="rotulo">Algum sinal de reação?</p>
    <div class="chips">${SINTOMAS_ALERTA.map(s => chip(s, fm.sintomas.includes(s), true)).join('')}</div>
    <label class="rotulo" for="produto">Desconfia de algum produto?</label>
    <select id="produto" data-campo="produto"><option value="">Nenhum / não sei</option>${candidatos.map(p => `<option value="${p.id}"${fm.produto === p.id ? ' selected' : ''}>${esc(p.curto)}${E(p.id).estado !== 'em_uso' ? ' (novo)' : ''}</option>`).join('')}</select>
    <label class="rotulo" for="nota">Anotação</label>
    <textarea id="nota" data-campo="nota" rows="3" placeholder="Ex.: olheiras mais claras, pele seca no queixo…">${esc(fm.nota)}</textarea>
    <button class="botao largo" data-acao="salvarDiario">Salvar no diário</button>
  </section></div><div class="diario-col">`;
  const lista = [...S.diario].sort((a, b) => b.criado - a.criado);
  if (lista.length) {
    h += '<section class="grupo"><h2>Anotações</h2>';
    for (const r of lista) {
      const alerta = r.sintomas.some(s => SINTOMAS_ALERTA.includes(s));
      h += `<article class="registro${alerta ? ' alerta' : ''}"><div class="reg-topo"><strong>${fmtLongo(r.dia)}</strong><button class="link perigo" data-acao="apagarRegistro" data-id="${r.criado}">Apagar</button></div>
        ${r.sintomas.length ? `<p class="tags">${r.sintomas.map(s => `<span>${esc(s)}</span>`).join('')}</p>` : ''}
        ${r.produto ? `<p class="extra">Produto: ${esc(P(r.produto) ? P(r.produto).curto : r.produto)}</p>` : ''}
        ${r.nota ? `<p>${esc(r.nota)}</p>` : ''}</article>`;
    }
    h += '</section>';
  }
  return h + '</div></div>';
}

const chip = (s, on, alerta) => `<button class="chip${on ? ' on' : ''}${alerta ? ' alerta' : ''}" data-acao="sintoma" data-s="${esc(s)}" aria-pressed="${on}">${esc(s)}</button>`;

// ---------- o Visinho fala ----------
const numeroDoDia = d => difDias('2026-01-01', d);

function falaDoVisinho() {
  const meta = metaDaSemana(HOJE), seq = seguidos(), h = new Date().getHours();
  const carinho = CARINHOS[(numeroDoDia(HOJE) + vista.dica) % CARINHOS.length];
  const reagiu = S.diario.some(r => r.dia === HOJE && r.sintomas.some(x => SINTOMAS_ALERTA.includes(x)));
  if (reagiu) return { estado: 'cuidado', texto: '<b>Vi no diário que a pele reagiu hoje.</b> Vá com calma: nada de produto novo e, se não passar, fale com a dermatologista.' };
  if (meta.feitos === 7) return { estado: 'semana', texto: '<b>Semana perfeita!</b> A sua Estufa ganhou um presente.' };
  if (diaCompleto(HOJE)) return { estado: 'feliz', texto: `<b>Dia completo!</b> ${meta.feitos} de 7 nesta semana. ${carinho}` };
  if (emViagem(HOJE)) return { estado: 'sol', texto: `<b>Modo ${esc(VIAGEM.lugar)}!</b> Chapéu, sombra e protetor reaplicado a cada 2 horas ao ar livre.` };
  if (h >= 19) return { estado: 'noite', texto: `<b>Hora da rotina da noite.</b> ${carinho}` };
  return { estado: 'dica', texto: `<b>${carinho}</b>${seq > 1 ? ` Já são ${seq} dias seguidos!` : ''}` };
}

function falaHTML() {
  const f = falaDoVisinho();
  const dica = DICAS[(numeroDoDia(HOJE) + vista.dica) % DICAS.length];
  return `<div class="fala">${Visino.desenha(f.estado)}<div class="balao">
    <p class="fala-msg">${f.texto}</p>
    <p class="fala-dica"><em>Dica do dia:</em> ${esc(dica)}</p>
    <button class="fala-outra" data-acao="outraDica">Outra dica →</button>
  </div></div>`;
}

// ---------- a Estufa: um prêmio para cada semana perfeita, para sempre ----------
// Fase 1: 28 plantas novas. Fase 2: cada planta cresce (muda → adulta → florida). Fase 3: versões raras, sem fim.
const CATALOGO = [
  { tipo: 'muda', folha: 'alocasia-polly', nome: 'Alocasia Polly' },
  { tipo: 'planta', pianta: 'monstera', vaso: 'giallo', nome: 'Costela-de-adão' },
  { tipo: 'planta', pianta: 'begonia', vaso: 'crema', nome: 'Begônia maculata' },
  { tipo: 'muda', folha: 'alocasia-frydek', nome: 'Alocasia Frydek' },
  { tipo: 'planta', pianta: 'alocasia', vaso: 'malva', nome: 'Alocásia' },
  { tipo: 'muda', folha: 'anturio', nome: 'Antúrio' },
  { tipo: 'planta', pianta: 'filodendro', vaso: 'crema', nome: 'Filodendro Brasil' },
  { tipo: 'muda', folha: 'pilea', nome: 'Pilea' },
  { tipo: 'planta', pianta: 'stromanthe', vaso: 'terracotta', nome: 'Maranta Triostar' },
  { tipo: 'muda', folha: 'alocasia-zebrina', nome: 'Alocasia Zebrina' },
  { tipo: 'muda', folha: 'caladium', nome: 'Caladium' },
  { tipo: 'planta', pianta: 'ceropegia', nome: 'Ceropegia' },
  { tipo: 'muda', folha: 'begonia-rex', nome: 'Begônia rex' },
  { tipo: 'muda', folha: 'monstera-adansonii', nome: 'Monstera adansonii' },
  { tipo: 'planta', pianta: 'senecio', nome: 'Senécio' },
  { tipo: 'muda', folha: 'ginkgo', nome: 'Ginkgo' },
  { tipo: 'muda', folha: 'samambaia', nome: 'Samambaia' },
  { tipo: 'muda', folha: 'bananeira', nome: 'Bananeira' },
  { tipo: 'muda', folha: 'bordo', nome: 'Bordo' },
  { tipo: 'muda', folha: 'carvalho', nome: 'Carvalho' },
  { tipo: 'muda', folha: 'figueira', nome: 'Figueira' },
  { tipo: 'muda', folha: 'palmeira', nome: 'Palmeira-leque' },
  { tipo: 'muda', folha: 'oliveira', nome: 'Oliveira' },
  { tipo: 'muda', folha: 'foglia-monstera', nome: 'Muda de costela-de-adão' },
  { tipo: 'muda', folha: 'foglia-alocasia', nome: 'Muda de alocásia' },
  { tipo: 'muda', folha: 'foglia-filodendro', nome: 'Muda de filodendro' },
  { tipo: 'muda', folha: 'foglia-stromanthe', nome: 'Muda de maranta' },
  { tipo: 'muda', folha: 'foglia-begonia', nome: 'Muda de begônia' }
];
const ESTAGIOS = ['Muda', 'Adulta', 'Florida'];
const RARAS_PLANTA = ['dourado', 'cobalto', 'rosa'];
const RARAS_MUDA = ['variegata', 'dourado', 'cobalto', 'rosa'];
const NOMES_RARA = { variegata: 'folhas variegatas', dourado: 'vaso dourado', cobalto: 'vaso de cerâmica azul', rosa: 'vaso rosa' };
const RARA_CURTO = { variegata: 'variegata', dourado: 'dourada', cobalto: 'azul', rosa: 'rosa' };
const VASOS_MUDA = ['crema', 'terracotta', 'giallo', 'malva'];
const COR_VASO = { crema: ['#f3e4c8', '#e8d5b2'], terracotta: ['#c87a54', '#b86a46'], giallo: ['#fec340', '#f2b324'], malva: ['#b58aa9', '#a57898'],
  dourado: ['#d9a520', '#c18e12'], cobalto: ['#2f5d9e', '#244d86'], rosa: ['#e8a1b3', '#d98aa0'] };
const rarasDe = p => (p.tipo === 'muda' && !p.folha.startsWith('foglia-')) ? RARAS_MUDA : RARAS_PLANTA;

function semanasPerfeitas() {
  const segundas = new Set(Object.keys(S.completos).filter(diaCompleto).map(segundaDaSemana));
  return [...segundas].filter(seg => metaDaSemana(seg).feitos === 7).sort();
}

function mesesPerfeitos() {
  const meses = new Set(Object.keys(S.completos).filter(diaCompleto).map(d => d.slice(0, 7)));
  return [...meses].filter(m => {
    const [a, mm] = m.split('-').map(Number);
    for (let i = 1; i <= new Date(a, mm, 0).getDate(); i++) if (!diaCompleto(`${m}-${String(i).padStart(2, '0')}`)) return false;
    return true;
  }).sort();
}

// o que já foi ganho fica ganho, mesmo se depois uma marcação for desfeita
function verificarPremios() {
  const semanas = semanasPerfeitas().filter(x => !S.estufa.semanas.includes(x));
  const meses = mesesPerfeitos().filter(x => !S.estufa.meses.includes(x));
  S.estufa.semanas.push(...semanas);
  S.estufa.meses.push(...meses);
  return { semanas, meses };
}

// como está cada planta depois de N semanas perfeitas
function estadoDaEstufa(N) {
  const T = CATALOGO.length;
  const plantas = CATALOGO.map((p, i) => ({ ...p, i, ganha: i < N, estagio: 0, rara: null }));
  for (let s = 0; s < Math.min(Math.max(N - T, 0), 2 * T); s++) plantas[s % T].estagio = 1 + Math.floor(s / T);
  for (let k = 0; k < Math.max(N - 3 * T, 0); k++) { const p = plantas[k % T]; const l = rarasDe(p); p.rara = l[Math.floor(k / T) % l.length]; }
  return plantas;
}

// o prêmio da n-ésima semana perfeita (1, 2, 3…)
function premioNumero(n) {
  const T = CATALOGO.length, k = n - 1;
  if (k < T) return { tipo: 'nova', i: k };
  if (k < 3 * T) return { tipo: 'crescer', i: (k - T) % T, estagio: 1 + Math.floor((k - T) / T) };
  const r = k - 3 * T, l = rarasDe(CATALOGO[r % T]);
  return { tipo: 'rara', i: r % T, rara: l[Math.floor(r / T) % l.length] };
}

const flor = (x, y, cor) => [0, 72, 144, 216, 288].map(g => `<circle cx="${(x + 6 * Math.sin(g * Math.PI / 180)).toFixed(1)}" cy="${(y - 6 * Math.cos(g * Math.PI / 180)).toFixed(1)}" r="5" fill="${cor}"/>`).join('') + `<circle cx="${x}" cy="${y}" r="3.6" fill="#fec340"/>`;

function artePlanta(p, silhueta = false) {
  const vaso = p.rara && p.rara !== 'variegata' ? p.rara : (p.vaso || VASOS_MUDA[p.i % VASOS_MUDA.length]);
  let arte;
  if (p.tipo === 'planta') arte = `<svg class="arte-planta" data-pianta="${p.pianta}" data-stile="colore" data-vaso="${vaso}"></svg>`;
  else {
    const [corpo, borda] = COR_VASO[vaso];
    const folha = p.folha.startsWith('foglia-') ? `data-pianta="${p.folha}" data-stile="colore"` : `data-folha="${p.folha}" data-stile="colore"${p.rara === 'variegata' ? ' data-variegata="si"' : ''}`;
    arte = `<span class="muda"><svg class="muda-folha" ${folha}></svg><svg class="muda-vaso" viewBox="0 0 60 34" aria-hidden="true"><path d="M8 8H52L46 32H14Z" fill="${corpo}"/><rect x="4" y="3" width="52" height="9" rx="3" fill="${borda}"/></svg></span>`;
  }
  const flores = p.estagio >= 2 ? `<svg class="flores" viewBox="0 0 100 40" aria-hidden="true">${flor(22, 24, '#b61e42')}${flor(50, 12, '#ffffff')}${flor(78, 24, '#e8a1b3')}</svg>` : '';
  return `<span class="arte estagio-${p.estagio}${p.rara ? ' rara' : ''}${silhueta ? ' silhueta' : ''}">${arte}${flores}${p.rara && !silhueta ? '<span class="brilho-raro" aria-hidden="true">✦</span>' : ''}</span>`;
}

function terrario() {
  return `<svg class="terrario" viewBox="0 0 120 140" aria-hidden="true">
    <ellipse cx="60" cy="132" rx="46" ry="6" fill="rgba(36,24,30,.12)"/>
    <path d="M24 124V72a36 36 0 0 1 72 0v52Z" fill="#dff0ec" fill-opacity=".7" stroke="#24181e" stroke-width="3"/>
    <path d="M26 112q34 -12 68 0v12H26Z" fill="#7a5a3a"/>
    <path d="M44 110c-2-14 4-24 14-28c-2 12-6 20-14 28Z" fill="#4f9a5e"/><path d="M60 108c2-18 12-26 24-26c-4 14-12 22-24 26Z" fill="#86c38a"/>
    <path d="M52 110c-10-6-16-14-14-24c8 4 12 12 14 24Z" fill="#2c7a4b"/><circle cx="76" cy="104" r="4" fill="#b61e42"/>
    <path d="M34 76c2-12 10-20 22-22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    <rect x="18" y="122" width="84" height="10" rx="4" fill="#c87a54" stroke="#24181e" stroke-width="3"/>
    <circle cx="60" cy="33" r="6" fill="#fec340" stroke="#24181e" stroke-width="3"/></svg>`;
}

function telaEstufa() {
  const N = S.estufa.semanas.length, T = CATALOGO.length, plantas = estadoDaEstufa(N);
  const fase = N < T ? 1 : N < 3 * T ? 2 : 3;
  const textoFase = fase === 1 ? `Fase 1 · Coleção: ${N} de ${T} plantas` : fase === 2 ? `Fase 2 · Crescer: ${N - T} de ${2 * T}` : `Fase 3 · Raras: ${N - 3 * T} até agora`;
  const pct = fase === 1 ? N / T : fase === 2 ? (N - T) / (2 * T) : 1;
  const prox = premioNumero(N + 1), pp = CATALOGO[prox.i];
  const proxTexto = prox.tipo === 'nova' ? `Na próxima semana perfeita chega: <b>${pp.nome}</b>.` : prox.tipo === 'crescer' ? `Na próxima semana perfeita, <b>${pp.nome}</b> ${prox.estagio === 1 ? 'cresce' : 'floresce'}.` : `Na próxima semana perfeita, <b>${pp.nome}</b> fica rara.`;
  let h = `<header class="topo"><p class="sobre">A sua coleção</p><h1>Estufa</h1></header>
  <div class="fala">${Visino.desenha(N ? 'feliz' : 'dica')}<div class="balao"><p class="fala-msg"><b>${N === 0 ? 'A sua Estufa está esperando a primeira planta.' : `${N} ${N === 1 ? 'semana perfeita' : 'semanas perfeitas'}!`}</b> ${proxTexto}</p></div></div>
  <section class="cartao estufa-fase"><strong>${textoFase}</strong><div class="meta-barra"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
    <p>Uma semana perfeita = 7 de 7 dias com manhã e noite completas. Depois das 28 plantas, elas crescem; depois, ficam raras.</p></section>
  <section class="prateleiras">`;
  for (const p of plantas) {
    const proxima = !p.ganha && p.i === N;
    h += `<div class="slot${p.ganha ? '' : ' travado'}${proxima ? ' proxima' : ''}">${artePlanta(p, !p.ganha)}
      <span class="slot-nome">${p.ganha ? esc(p.nome) : proxima ? 'A próxima!' : `Semana ${p.i + 1}`}</span>
      ${p.ganha ? `<span class="slot-tag${p.rara ? ' rara' : ''}">${p.rara ? 'Rara · ' + RARA_CURTO[p.rara] : ESTAGIOS[p.estagio]}</span>` : ''}</div>`;
  }
  h += `</section><section class="grupo"><h2>Prêmios do mês</h2><div class="prateleiras">`;
  h += S.estufa.meses.length
    ? S.estufa.meses.map(m => `<div class="slot"><span class="arte">${terrario()}</span><span class="slot-nome">Terrário de ${MESES[Number(m.slice(5, 7)) - 1]}</span><span class="slot-tag">Mês perfeito</span></div>`).join('')
    : `<div class="slot travado"><span class="arte silhueta">${terrario()}</span><span class="slot-nome">Um mês inteiro</span></div>`;
  return h + '</div></section>';
}

// ---------- a festa da semana (e do mês) perfeita ----------
function festaHTML() {
  const { semanas, meses } = vista.festa, N = S.estufa.semanas.length;
  let premios = '';
  semanas.forEach((_, j) => {
    const n = N - semanas.length + j + 1, pr = premioNumero(n), p = estadoDaEstufa(n)[pr.i];
    const legenda = pr.tipo === 'nova' ? 'Nova na sua Estufa' : pr.tipo === 'crescer' ? (pr.estagio === 1 ? 'Cresceu: agora é adulta' : 'Floresceu!') : `Ficou rara: ${NOMES_RARA[pr.rara]}`;
    premios += `<div class="premio">${artePlanta(p)}<b>${esc(p.nome)}</b><span>${legenda}</span></div>`;
  });
  meses.forEach(m => { premios += `<div class="premio"><span class="arte">${terrario()}</span><b>Terrário de ${MESES[Number(m.slice(5, 7)) - 1]}</b><span>Prêmio do mês perfeito</span></div>`; });
  const titulo = semanas.length ? 'Semana perfeita!' : 'Mês perfeito!';
  const texto = semanas.length ? '7 de 7 dias, manhã e noite. Sua pele agradece, e eu também!' : 'Todos os dias do mês completos. Que orgulho!';
  const cores = ['#4f9a5e', '#b61e42', '#fec340', '#b58aa9', '#0a5b58'];
  const confete = ['ginkgo', 'pilea', 'bordo', 'figueira', 'oliveira', 'caladium', 'anturio', 'samambaia']
    .map((f, i) => `<svg class="confete c${i}" data-folha="${f}" data-colore="${cores[i % cores.length]}" data-tratto="1.6"></svg>`).join('');
  return `<div class="festa" role="dialog" aria-label="${titulo}"><div class="festa-caixa">${confete}
    ${Visino.desenha('semana', 'festa-visino')}
    <h2>${titulo}</h2><p>${texto}</p>
    <div class="premios">${premios}</div>
    <div class="botoes"><button class="botao" data-acao="verEstufa">Ver minha Estufa</button><button class="botao leve" data-acao="fecharFesta">Fechar</button></div>
  </div></div>`;
}

// ---------- Guia ----------
function telaGuia() {
  let h = `<header class="topo"><p class="sobre">Guia</p><h1>Regras e dicas</h1></header><section class="grupo guia-dicas">`;
  for (const g of GUIA) h += `<article class="dica${g.destaque ? ' destaque' : ''}"><h3>${esc(g.titulo)}</h3><p>${esc(g.texto)}</p></article>`;
  h += `</section><section class="grupo"><h2>${esc(TEXTOS.etapasTitulo)}</h2><ol class="etapas">`;
  ETAPAS.forEach((c, i) => {
    h += `<li><span class="n">${i + 1}</span><div><h3>${esc(c.etapa)} <span class="quando">${esc(c.quando)}</span></h3><p>${esc(c.fazer)}</p><p class="obs">${esc(c.cuidado)}</p></div></li>`;
  });
  h += `</ol></section><section class="grupo"><h2>Seus dados</h2>
    <div class="cartao"><p>Tudo o que você marca fica guardado só neste aparelho. De vez em quando, faça uma cópia: se trocar de telefone, é só abrir a cópia aqui.</p>
    <div class="botoes"><button class="botao" data-acao="exportar">Fazer cópia</button><label class="botao leve">Abrir cópia<input type="file" accept="application/json,.json" data-campo="importar" hidden></label></div></div>
    <p class="rodape">${esc(TEXTOS.rodape)}</p></section>`;
  return h;
}

// ---------- ações ----------
function toast(t) { aviso(t); }
function aviso(t) {
  const el = document.getElementById('aviso');
  el.textContent = t; el.classList.add('ver');
  clearTimeout(aviso.timer); aviso.timer = setTimeout(() => el.classList.remove('ver'), 2600);
}

function comecar(id, data) {
  const p = P(id), e = E(id);
  e.inicio = data; e.nivel = 0; e.nivelDesde = data;
  if (p.intro.tipo === 'teste') { e.estado = 'teste'; e.testeEm = data === HOJE ? Date.now() : deISO(data).getTime() + 9 * 3600000; }
  else { e.estado = 'introduzindo'; if (p.intro.tipo === 'adaptacao') e.turno = e.turno || 'manha'; }
  vista.desde = null;
  salvar(); render();
  toast(p.intro.tipo === 'teste' ? 'Teste registrado. Observe a área.' : `${p.curto} entrou na rotina.`);
}

const ACOES = {
  aba: el => { vista.aba = el.dataset.aba; if (vista.aba === 'hoje') vista.dia = vista.dia || HOJE; render(); },
  irHoje: () => { vista.dia = HOJE; render(); },
  verDia: el => { vista.dia = el.dataset.dia; vista.aba = 'hoje'; render(); },
  semana: el => { vista.dia = somaDias(vista.dia, Number(el.dataset.n)); render(); },
  mes: el => { const [a, m] = vista.mes.split('-').map(Number); const d = new Date(a, m - 1 + Number(el.dataset.n), 1); vista.mes = iso(d).slice(0, 7); render(); },
  abrir: el => { const c = el.dataset.chave; vista.abertos[c] = !vista.abertos[c]; render(); },
  marcar: el => {
    const d = vista.dia, t = el.dataset.turno, id = el.dataset.id;
    if (d > HOJE) return;
    const antes = diaCompleto(d);
    S.feitos[d] = S.feitos[d] || {}; S.feitos[d][t] = S.feitos[d][t] || {};
    if (S.feitos[d][t][id]) delete S.feitos[d][t][id]; else S.feitos[d][t][id] = true;
    registrarDia(d);
    const novos = verificarPremios();
    if (novos.semanas.length || novos.meses.length) vista.festa = novos;
    salvar(); render();
    if (vista.festa) return;
    if (diaCompleto(d) && !antes) {
      const m = metaDaSemana(d);
      toast(m.feitos === 7 ? 'Semana perfeita! 7 de 7 ✓' : `Dia completo! ${m.feitos} de 7 na semana ✓`);
    } else if (progresso(d, t).completo && S.feitos[d][t][id]) toast(t === 'manha' ? 'Manhã completa ✓' : 'Noite completa ✓');
  },
  outraDica: () => { vista.dica++; render(); },
  verEstufa: () => { vista.festa = null; vista.aba = 'estufa'; render(); },
  fecharFesta: () => { vista.festa = null; render(); },
  comecar: el => comecar(el.dataset.id, HOJE),
  desde: el => { vista.desde = el.dataset.id; render(); },
  testeOk: el => { const e = E(el.dataset.id); e.estado = 'introduzindo'; e.nivel = 0; e.nivelDesde = HOJE; salvar(); render(); toast('Combinado: começa devagar.'); },
  testeReacao: el => {
    const e = E(el.dataset.id);
    e.estado = 'pausado'; e.anterior = 'pronto'; e.pausadoEm = HOJE;
    salvar(); render(); toast('Produto em pausa. Lave a área com água.');
  },
  confirmar: el => { E(el.dataset.id).estado = 'em_uso'; salvar(); render(); toast('Agora manhã e noite.'); },
  subir: el => { const e = E(el.dataset.id); e.nivel = (e.nivel || 0) + 1; e.nivelDesde = HOJE; salvar(); render(); toast('Frequência aumentada.'); },
  adiar: el => { S.adiados[el.dataset.id] = el.dataset.id === 'reavaliar' ? true : somaDias(HOJE, 7); salvar(); render(); },
  pausar: el => {
    const p = P(el.dataset.id), e = E(p.id);
    if (!confirm(`Pausar ${p.curto}? Ele sai da rotina até você retomar.`)) return;
    e.anterior = e.estado; e.estado = 'pausado'; e.pausadoEm = HOJE; salvar(); render();
  },
  retomar: el => {
    const e = E(el.dataset.id);
    e.estado = e.anterior === 'teste' ? 'pronto' : (e.anterior || 'em_uso');
    delete e.pausadoEm; delete e.anterior; salvar(); render(); toast('De volta à rotina.');
  },
  acabou: el => {
    const p = P(el.dataset.id), e = E(p.id);
    if (p.ateAcabar) {
      const sub = P(p.substituto);
      if (!confirm(`O ${p.curto} acabou? No lugar dele entra o ${sub.curto}, aos poucos.`)) return;
      e.estado = 'acabou'; e.acabouEm = HOJE;
      if (E(sub.id).estado === 'aguardando') E(sub.id).estado = 'pronto';
      salvar(); vista.aba = 'hoje'; vista.dia = HOJE; render(); toast(`${sub.curto}: veja quando começar.`);
    } else {
      e.repor = true; salvar(); render(); toast('Está na lista de compras.');
    }
  },
  desfazerAcabou: el => {
    const p = P(el.dataset.id), e = E(p.id);
    e.estado = 'em_uso'; delete e.acabouEm;
    if (p.substituto && E(p.substituto).estado === 'pronto') E(p.substituto).estado = 'aguardando';
    salvar(); render();
  },
  comprei: el => { E(el.dataset.id).repor = false; salvar(); render(); },
  turno: el => { const e = E(el.dataset.id); e.turno = e.turno === 'noite' ? 'manha' : 'noite'; salvar(); render(); },
  spf: () => { (S.spf[HOJE] = S.spf[HOJE] || []).push(Date.now()); salvar(); render(); toast('Anotado. Próxima em 2 horas.'); },
  sintoma: el => {
    const s = el.dataset.s, l = vista.form.sintomas;
    if (s === 'Pele bem') vista.form.sintomas = l.includes(s) ? [] : [s];
    else vista.form.sintomas = l.includes(s) ? l.filter(x => x !== s) : [...l.filter(x => x !== 'Pele bem'), s];
    render();
  },
  salvarDiario: () => {
    const fm = vista.form;
    if (!fm.sintomas.length && !fm.nota.trim()) { toast('Escolha um sinal ou escreva algo.'); return; }
    S.diario.push({ criado: Date.now(), dia: HOJE, sintomas: fm.sintomas, produto: fm.produto, nota: fm.nota.trim() });
    const alerta = fm.sintomas.some(s => SINTOMAS_ALERTA.includes(s));
    vista.resultado = alerta ? conselho(fm.produto) : null;
    vista.form = { sintomas: [], produto: '', nota: '' };
    salvar(); render(); window.scrollTo(0, 0); toast('Salvo no diário.');
  },
  apagarRegistro: el => {
    if (!confirm('Apagar esta anotação?')) return;
    S.diario = S.diario.filter(r => String(r.criado) !== el.dataset.id); salvar(); render();
  },
  pausarSuspeito: el => {
    const e = E(el.dataset.id);
    e.anterior = e.estado; e.estado = 'pausado'; e.pausadoEm = HOJE;
    vista.resultado = null; salvar(); render(); toast('Produto em pausa.');
  },
  exportar: () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const nome = `velvet-copia-${HOJE}.json`;
    const arquivo = new File([blob], nome, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      navigator.share({ files: [arquivo], title: 'Cópia da rotina' }).catch(() => {});
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  }
};

function conselho(prodId) {
  const novos = PRODUTOS.filter(p => ['introduzindo', 'teste'].includes(E(p.id).estado));
  const suspeito = prodId && E(prodId) && ['introduzindo', 'teste', 'em_uso'].includes(E(prodId).estado) ? P(prodId) : null;
  const alvo = suspeito || (novos.length === 1 ? novos[0] : null);
  let botoes = alvo ? `<button class="botao" data-acao="pausarSuspeito" data-id="${alvo.id}">Pausar ${esc(alvo.curto)}</button>` : '';
  const texto = alvo
    ? `Regra principal: suspenda o produto novo. Pause ${alvo.curto} e só retome quando a pele estiver normal.`
    : novos.length > 1
      ? 'Regra principal: suspenda o produto novo. Você está introduzindo mais de um: pause o que começou por último.'
      : 'Observe com calma e evite esfregar a pele. Se não houver produto novo, pense no que mudou nos últimos dias.';
  return cartao('alerta', 'Sinal de reação', texto + ' Se a reação for forte ou não passar, procure um dermatologista.', botoes);
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  if (el.tagName === 'BUTTON' && el.form) ev.preventDefault();
  const f = ACOES[el.dataset.acao];
  if (f) f(el);
});

document.addEventListener('input', ev => {
  const c = ev.target.dataset.campo;
  if (c === 'nota') vista.form.nota = ev.target.value;
});

document.addEventListener('change', ev => {
  const c = ev.target.dataset.campo;
  if (c === 'produto') vista.form.produto = ev.target.value;
  if (c === 'importar' && ev.target.files[0]) {
    ev.target.files[0].text().then(t => {
      const s = JSON.parse(t);
      if (!s || !s.produtos || !s.feitos) throw new Error('formato');
      if (!confirm('Substituir os dados deste aparelho pela cópia?')) return;
      localStorage.setItem(CHAVE, t); S = carregar(); render(); toast('Cópia aberta.');
    }).catch(() => toast('Este arquivo não é uma cópia da rotina.'));
  }
});

document.addEventListener('submit', ev => {
  const f = ev.target;
  if (f.dataset.form !== 'desde') return;
  ev.preventDefault();
  const d = f.elements.data.value;
  if (!d || d > HOJE) { toast('Escolha uma data até hoje.'); return; }
  comecar(f.dataset.id, d);
});

// ao voltar para o app num dia novo, a tela acompanha
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const novo = hojeISO();
  if (novo !== HOJE) { if (vista.dia === HOJE) vista.dia = novo; HOJE = novo; }
  render();
});

// os dias marcados antes do contador existir também contam
for (const d of Object.keys(S.feitos)) if (!S.completos[d] && d <= HOJE) registrarDia(d);
verificarPremios();
render();
// quando chega uma versão nova do app, recarrega uma vez sozinho para mostrá-la logo
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const tinhaVersao = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    let ja = false;
    try { ja = sessionStorage.getItem('rotina-recarregou') === '1'; sessionStorage.setItem('rotina-recarregou', '1'); } catch (e) { ja = true; }
    if (tinhaVersao && !ja) location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
