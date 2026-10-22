// Guarda o app no telefone para funcionar sem internet.
// Ao publicar uma versão nova, mude o número abaixo.
const VERSAO = 'rotina-v1';
const ARQUIVOS = ['./', 'index.html', 'estilo.css', 'cadeado.js', 'app.js', 'dados.cifrados.json', 'manifest.webmanifest',
  'icones/icone-180.png', 'icones/icone-192.png', 'icones/icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// responde com a cópia guardada e, por trás, busca a versão mais nova para a próxima vez
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSAO).then(async c => {
    const guardado = await c.match(e.request, { ignoreSearch: true });
    const rede = fetch(e.request).then(r => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }).catch(() => guardado);
    return guardado || rede;
  }));
});
