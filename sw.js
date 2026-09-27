/* =========================================================
   Service Worker：電波がない場所でもアプリを起動できるようにする
   - index.html … ネットワーク優先（更新をすぐ反映）。つながらなければ保存済みのものを使う
   - Firebase SDK（gstatic）… バージョン固定の URL なので保存済みのものを優先
   データの同期は Firestore のオフラインキャッシュが担当する（ここでは扱わない）
   ========================================================= */
const CACHE = 'sake-collection-v1';
const SDK_VERSION = '12.18.0';   // index.html の import と合わせる
const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/`;
const SDK_FILES = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((f) => SDK_BASE + f);
const PAGE_URL = new URL('./', self.registration.scope).href;
const NETWORK_TIMEOUT = 5000;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all([PAGE_URL, ...SDK_FILES].map((u) =>
    c.add(new Request(u, { mode: u.startsWith(SDK_BASE) ? 'cors' : 'same-origin' })).catch(() => { /* 次回に取得 */ })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase SDK：キャッシュ優先
  if (url.href.startsWith(SDK_BASE)) {
    e.respondWith(caches.match(req.url).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req.url, copy)); }
      return res;
    })));
    return;
  }

  // アプリ本体（画面遷移）：ネットワーク優先・一定時間で応答がなければキャッシュ
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(PAGE_URL, res.clone());
        return res;
      });
      network.catch(() => { /* 下でキャッシュを使う */ });
      const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT));
      try {
        const res = await Promise.race([network, timeout]);
        if (res) return res;
      } catch (_) { /* オフライン */ }
      const cached = await cache.match(PAGE_URL);
      if (cached) return cached;
      return network;   // キャッシュも無ければネットワークの結果を待つ
    })());
  }
});
