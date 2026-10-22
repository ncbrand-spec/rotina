'use strict';
// Os dados da rotina são publicados cifrados (AES-GCM, chave tirada da senha com PBKDF2).
// Na primeira vez pede a senha; depois guarda a chave neste aparelho e abre direto.
(() => {
  const CHAVE_SALVA = 'rotina-chave';
  const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const paraB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const form = document.getElementById('cadeado');
  const erro = form.querySelector('.erro');
  let cofre = null;

  async function abrir(chave) {
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(cofre.iv) }, chave, deB64(cofre.dados));
    return JSON.parse(new TextDecoder().decode(claro));
  }

  async function chaveDaSenha(senha) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: deB64(cofre.sal), iterations: cofre.iteracoes, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }

  function iniciar(dados) {
    Object.assign(window, dados);
    form.remove();
    document.body.classList.remove('trancado');
    const s = document.createElement('script');
    s.src = 'app.js';
    document.body.appendChild(s);
  }

  function pedirSenha(msg) {
    erro.textContent = msg || '';
    form.hidden = false;
    form.elements.senha.focus();
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const senha = form.elements.senha.value;
    if (!senha) return;
    const botao = form.querySelector('button');
    botao.disabled = true; botao.textContent = 'Abrindo…'; erro.textContent = '';
    try {
      const chave = await chaveDaSenha(senha);
      const dados = await abrir(chave);
      try { localStorage.setItem(CHAVE_SALVA, JSON.stringify({ sal: cofre.sal, chave: paraB64(await crypto.subtle.exportKey('raw', chave)) })); } catch (e) { /* abre do mesmo jeito */ }
      iniciar(dados);
    } catch (e) {
      botao.disabled = false; botao.textContent = 'Abrir';
      pedirSenha('Senha errada. Tente de novo.');
      form.elements.senha.select();
    }
  });

  (async () => {
    try {
      const r = await fetch('dados.cifrados.json', { cache: 'no-cache' });
      cofre = await r.json();
    } catch (e) {
      pedirSenha('Sem conexão. Abra o app com internet pelo menos uma vez.');
      form.querySelector('button').disabled = true;
      return;
    }
    let salva = null;
    try { salva = JSON.parse(localStorage.getItem(CHAVE_SALVA)); } catch (e) { /* sem chave guardada */ }
    if (salva && salva.sal === cofre.sal) {
      try {
        const chave = await crypto.subtle.importKey('raw', deB64(salva.chave), 'AES-GCM', true, ['decrypt']);
        return iniciar(await abrir(chave));
      } catch (e) { /* chave velha: pede a senha */ }
    }
    pedirSenha(salva ? 'Os dados foram atualizados: digite a senha de novo.' : '');
  })();
})();
