// Guarda o app no telefone para funcionar sem internet.
// Ao publicar uma versão nova, mude o número abaixo.
const VERSAO = 'rotina-v9';
const ARQUIVOS = ['./', 'index.html', 'estilo.css', 'temas/mista.css', 'piante.js', 'folhas.js', 'cadeado.js', 'instalar.js', 'app.js', 'dados.cifrados.json',
  'manifest.webmanifest', 'icones/icone-180.png', 'icones/icone-192.png', 'icones/icone-512.png'];
const FONTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const origem = new URL(e.request.url).origin;
  // os caracteres do Google não mudam: guardados na primeira vez, depois sempre do telefone
  if (FONTES.includes(origem)) {
    e.respondWith(caches.open(VERSAO).then(async c => {
      const guardado = await c.match(e.request);
      if (guardado) return guardado;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  if (origem !== location.origin) return;
  // o resto: responde com a cópia guardada e, por trás, busca a versão mais nova para a próxima vez
  e.respondWith(caches.open(VERSAO).then(async c => {
    const guardado = await c.match(e.request, { ignoreSearch: true });
    const rede = fetch(e.request).then(r => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }).catch(() => guardado);
    return guardado || rede;
  }));
});
