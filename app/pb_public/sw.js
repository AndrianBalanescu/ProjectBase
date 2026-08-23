/* pb_public/sw.js
 * ProjectBase Service Worker — offline-capable app shell.
 *
 * Strategy:
 *  - Precache the complete static app shell (index.html, CSS, vendor bundles,
 *    and every component/API script) so the SPA boots even fully offline.
 *  - Static assets: cache-first (fast, offline-capable) with background refresh.
 *  - API/SSE requests (/api/*): network-first, falling back to the cached shell so
 *    the UI still renders when the backend is unreachable.
 *  - Everything else: network-first with a cache fallback.
 *
 * FOSS/offline mission alignment: this is what makes ProjectBase usable on an
 * air-gapped LAN / Raspberry Pi — no CDN round-trips, no network requirement.
 */

const CACHE_NAME = 'projectbase-shell-v2';

// The complete app shell. Keep in sync with index.html's asset list.
const PRECACHE_PATHS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/icon-192.png',
  './vendor/icon-512.png',
  './css/style.css',
  './css/app.css',
  './vendor/milkdown.css',
  './vendor/pocketbase.umd.js',
  './vendor/vue.global.prod.js',
  './vendor/sortable.min.js',
  './vendor/lucide.js',
  './vendor/marked.min.js',
  './vendor/purify.min.js',
  './vendor/confetti.min.js',
  './vendor/milkdown.js',
  './js/api.js',
  './js/app.js',
  './js/components/SearchableSelect.js',
  './js/components/Multiselect.js',
  './js/components/MilkdownEditor.js',
  './js/components/Header.js',
  './js/components/KanbanBoard.js',
  './js/components/ListView.js',
  './js/components/CyclesView.js',
  './js/components/MilestonesView.js',
  './js/components/ProjectsView.js',
  './js/components/StatsView.js',
  './js/components/DocsView.js',
  './js/components/MarketplaceView.js',
  './js/components/IssueDrawer.js',
  './js/components/CommandPalette.js',
  './js/components/NewIssueModal.js',
  './js/components/ImportModal.js',
  './js/components/ProjectModal.js',
  './js/components/CycleModal.js',
  './js/components/CustomFieldsModal.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(resolvePrecachePaths()))
      .then(() => self.skipWaiting())
  );
});

function resolvePrecachePaths() {
  // Resolve relative paths against the SW scope so it works regardless of mount path.
  return PRECACHE_PATHS.map((p) => new URL(p, self.registration.scope).href);
}

self.addEventListener('activate', (event) => {
  // Delete any stale caches from previous versions.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // only cache safe, idempotent GETs

  const url = new URL(req.url);

  // Never try to serve the admin UI or external origins from cache.
  if (url.origin !== self.location.origin) return;
  // PocketBase admin UI (/_/...): a separate app — never intercept, or an
  // offline navigation would wrongly receive the ProjectBase SPA shell.
  if (url.pathname.startsWith('/_/')) return;

  // Real-time SSE stream (EventSource): never intercept. The stream is
  // long-lived and unbounded, so caching a clone would hang the fetch handler.
  if (url.pathname.startsWith('/api/realtime')) return;

  // API / realtime traffic: network-first, fall back to any cached copy.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Navigation requests (the SPA shell): network-first so a fresh deploy is
  // picked up, but fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  // Everything else (JS/CSS/vendor/images): cache-first for instant offline load,
  // with a background network refresh to keep caches warm.
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    // Best-effort cache update for offline reuse.
    const copy = fresh.clone();
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, copy);
    return fresh;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Last resort: fall back to the cached app shell for navigations.
    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) {
    // Stale-while-revalidate: serve the cached copy instantly (offline-safe),
    // then refresh the cache in the background so deploys heal without
    // requiring a manual CACHE_NAME bump.
    fetch(req).then((fresh) => {
      if (fresh && fresh.ok) {
        caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh.clone()));
      }
    }).catch(() => { /* offline: keep serving the cached copy */ });
    return cached;
  }
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    return Response.error();
  }
}
