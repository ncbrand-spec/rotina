'use strict';
// No iPhone, quando o Rotina está aberto no navegador (e não pelo ícone), mostra como criar o ícone.
// Safari: o botão Compartilhar fica embaixo; Chrome: no alto, à direita da barra do endereço.
// ?instalar=safari|chrome no endereço força o aviso (para testar no computador).
(() => {
  const ua = navigator.userAgent;
  const forcado = new URLSearchParams(location.search).get('instalar');
  const iphone = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const pelaIcone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!forcado && (!iphone || pelaIcone)) return;
  try { if (sessionStorage.getItem('rotina-instalar-fechado')) return; } catch (e) { /* mostra */ }

  const chrome = forcado ? forcado === 'chrome' : /CriOS/.test(ua);
  const partilhar = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const onde = chrome
    ? `no alto, <b>à direita da barra do endereço</b> (ou em <b>⋯</b> → Compartilhar)`
    : `<b>aqui embaixo</b>, na barra do Safari (ou em <b>⋯</b> → Compartilhar)`;
  const caixa = document.createElement('aside');
  caixa.id = 'instalar';
  caixa.className = chrome ? 'em-cima' : 'embaixo';
  caixa.setAttribute('role', 'dialog');
  caixa.setAttribute('aria-label', 'Como colocar o Rotina na tela de início');
  caixa.innerHTML = `
    <div class="instalar-topo"><img src="icones/icone-180.png" alt="" width="48" height="48"><strong>Coloque o Rotina na tela de início</strong></div>
    <ol>
      <li>Toque em <span class="tecla">${partilhar}Compartilhar</span> ${onde}.</li>
      <li>Role a lista para baixo e toque em <b>«Adicionar à Tela de Início»</b> <span class="it">(em italiano «Aggiungi alla schermata Home»)</span>, depois em <b>Adicionar</b>.</li>
      <li>Feche o ${chrome ? 'Chrome' : 'Safari'} e abra o Rotina <b>pelo ícone novo</b>. A senha, digite lá.</li>
    </ol>
    <button type="button" class="instalar-fechar">Agora não</button>
    <span class="seta" aria-hidden="true"></span>`;
  caixa.querySelector('.instalar-fechar').addEventListener('click', () => {
    caixa.remove();
    try { sessionStorage.setItem('rotina-instalar-fechado', '1'); } catch (e) { /* tanto faz */ }
  });
  const pronto = () => document.body.appendChild(caixa);
  if (document.body) pronto(); else document.addEventListener('DOMContentLoaded', pronto);
})();
