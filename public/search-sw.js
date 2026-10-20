/*
 * The search page's offline copy (registered by src/lib/home-offline.ts, scope /search).
 *
 *   the /search document   the copy from last time at once; the network's answer replaces it behind
 *   /assets, /fonts        cache first: hashed or versioned names change when the bytes do
 *   /home/scenes           cache first, and the other two photos at the same size as well,
 *                          so whichever one the next page picks is there offline
 *   /api/auth/me           network first; the last answer when offline, so the page stays signed in
 *   everything else        untouched (the page keeps /api/home-index itself)
 *
 * A redirect to sign-in or a 401 means the session is over, and every copy is
 * dropped: they hold who is signed in and their accounts. Log out drops them too.
 */
const PREFIX = 'showcase-home-';
const SHELL = `${PREFIX}shell-v1`;
const FILES = `${PREFIX}files-v1`;
const DATA = `${PREFIX}data-v1`; // shared with the page (src/lib/home-offline.ts)
const KEEP = [SHELL, FILES, DATA];

const PAGE = '/search';
const ME = '/api/auth/me';
const SCENE = /^\/home\/scenes\/(v\d+)\/([a-z-]+?)-(wide|tall)-(\d+)\.(avif|webp)$/;
const SCENES = ['river', 'red-rock', 'mountain'];
/* Sizes kept per device: one for portrait and one for landscape is the usual pair. */
const SCENE_SIZES_KEPT = 2;

self.addEventListener('install', (event) => {
  event.waitUntil(refreshPage().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (url.pathname === PAGE || url.pathname === `${PAGE}/`) event.respondWith(page(event));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(event, request));
    return;
  }
  const scene = SCENE.exec(url.pathname);
  if (scene) {
    event.respondWith(cacheFirst(event, request));
    event.waitUntil(keepOtherScenes(scene).catch(() => {}));
    return;
  }
  if (url.pathname === ME) event.respondWith(me(request));
});

/* The page's first visit loads its photo before this worker is running; the
   page names it once the worker is ready (src/lib/home-offline.ts). */
self.addEventListener('message', (event) => {
  const src = event.data && event.data.scene;
  if (typeof src !== 'string') return;
  const url = new URL(src, self.location.origin);
  const scene = url.origin === self.location.origin && SCENE.exec(url.pathname);
  if (!scene) return;
  event.waitUntil(
    (async () => {
      const files = await caches.open(FILES);
      if (!(await files.match(url.pathname))) {
        const r = await fetch(url.pathname);
        if (r.ok) await files.put(url.pathname, r);
      }
      await keepOtherScenes(scene);
    })().catch(() => {}),
  );
});

async function dropEverything() {
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith(PREFIX)).map((n) => caches.delete(n)));
}

async function page(event) {
  const kept = await caches.match(PAGE, { cacheName: SHELL });
  if (kept) {
    event.waitUntil(refreshPage().catch(() => {}));
    return kept;
  }
  // Nothing kept yet: the network, as if there were no worker (offline: the browser's own page).
  const res = await fetch(event.request);
  event.waitUntil(keepPage(res.clone()).catch(() => {}));
  return res;
}

async function refreshPage() {
  const res = await fetch(PAGE, { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' });
  await keepPage(res);
}

/** Keep a fresh /search and every file it names; drop the files the old one named. */
async function keepPage(res) {
  if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) return dropEverything();
  if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return;
  const html = await res.clone().text();
  const named = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/(?:assets|fonts)\/[^"?#]+)"/g)) named.add(m[1]);

  const files = await caches.open(FILES);
  await Promise.all(
    [...named].map(async (path) => {
      if (await files.match(path)) return;
      const r = await fetch(path);
      if (r.ok) await files.put(path, r);
    }),
  );
  for (const req of await files.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/assets/') && !named.has(path)) await files.delete(req);
  }
  await (await caches.open(SHELL)).put(PAGE, res);
}

async function cacheFirst(event, request) {
  const files = await caches.open(FILES);
  const hit = await files.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') event.waitUntil(files.put(request, res.clone()).catch(() => {}));
  return res;
}

/** The photo the page showed, in the other two scenes too; older sizes go. */
async function keepOtherScenes([, version, id, cut, width, format]) {
  const files = await caches.open(FILES);
  const size = `-${cut}-${width}.${format}`;
  for (const other of SCENES) {
    if (other === id) continue;
    const path = `/home/scenes/${version}/${other}${size}`;
    if (await files.match(path)) continue;
    const r = await fetch(path);
    if (r.ok) await files.put(path, r);
  }
  // Newest sizes last (keys come back in the order they were put): keep the last few.
  const sizes = [];
  const reqs = (await files.keys()).filter((r) => SCENE.test(new URL(r.url).pathname));
  for (const r of reqs) {
    const m = SCENE.exec(new URL(r.url).pathname);
    const s = `${m[1]}-${m[3]}-${m[4]}.${m[5]}`;
    const at = sizes.indexOf(s);
    if (at >= 0) sizes.splice(at, 1);
    sizes.push(s);
  }
  const keep = new Set([...sizes.slice(-(SCENE_SIZES_KEPT - 1)), `${version}${size}`]);
  for (const r of reqs) {
    const m = SCENE.exec(new URL(r.url).pathname);
    if (!keep.has(`${m[1]}-${m[3]}-${m[4]}.${m[5]}`)) await files.delete(r);
  }
}

async function me(request) {
  try {
    const res = await fetch(request);
    if (res.status === 401) await dropEverything();
    else if (res.ok) await (await caches.open(DATA)).put(ME, res.clone());
    return res;
  } catch {
    return (await caches.match(ME, { cacheName: DATA })) || Response.error();
  }
}
