// 오프라인 플레이용 서비스 워커 (의존성 없음). 같은 출처의 GET 요청을 캐시 우선으로 응답하고, 온라인이면 뒤에서 새로 받아 둔다(stale-while-revalidate).
// 게임은 서버가 없고 저장은 localStorage 라 파일만 간직하면 오프라인에서 그대로 돈다. 새 배포는 캐시 이름을 바꿔 옛 캐시를 지운다.
const CACHE = 'lanista-v1';
const scopeUrl = new URL(self.registration.scope);
const SHELL = [scopeUrl.pathname, scopeUrl.pathname + 'index.html', scopeUrl.pathname + 'manifest.webmanifest'];
// 설치: 껍데기 + index.html 이 가리키는 자산(해시 이름의 js·css)까지 미리 받아 둔다 — 첫 방문 한 번이면 오프라인이 된다
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(async (c) => {
  await c.addAll(SHELL).catch(() => undefined);
  try { const html = await (await fetch(scopeUrl.pathname + 'index.html', { cache: 'no-cache' })).text(); const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|webmanifest))"/g)].map(m => new URL(m[1], scopeUrl).pathname); await c.addAll([...new Set(assets)]).catch(() => undefined); } catch { /* 오프라인 설치는 없다 */ }
}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url); if (url.origin !== location.origin) return;
  const isNav = req.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(isNav ? scopeUrl.pathname + 'index.html' : req, { ignoreSearch: isNav });
    const net = fetch(req).then((res) => { if (res && res.ok && (res.type === 'basic' || res.type === 'default')) c.put(isNav ? scopeUrl.pathname + 'index.html' : req, res.clone()); return res; }).catch(() => undefined);
    return hit ?? (await net) ?? new Response('오프라인입니다. 한 번은 온라인에서 열어야 합니다.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }));
});
