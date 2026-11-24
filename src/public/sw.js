// service worker that makes Edna work offline (#16)
//
// - the app page is network-first, so when online you always get the latest
//   version; offline it comes from the cache
// - /assets/* files have a hash in their name so they never change and are
//   served from the cache first
// - other files are network-first with the cache as fallback
// - /api/* etc. always go to the network
//
// The build (vite.config.js) replaces the version and the list of files to
// pre-cache, so that every deploy installs a new service worker and the parts
// of the app that are loaded on demand also work offline.
// A new version is activated when all Edna tabs are closed (no skipWaiting),
// so an open tab never mixes files from different versions.

const kVersion = "dev"; /*__VERSION__*/
const kPrecache = [] /*__PRECACHE__*/;

const kCacheName = "edna-" + kVersion;
// match by URL only: e.g. module scripts are requested with an Origin header
// and servers send Vary: Origin, which would make cached files never match
const kMatchOptions = { ignoreVary: true };

// never cached
function isNetworkOnly(url) {
  let p = url.pathname;
  return p.startsWith("/api/") || p.startsWith("/lejson") || p === "/ping" || p === "/ping.txt" || p === "/sw.js";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      let cache = await caches.open(kCacheName);
      // "/" is the app page; cache: "reload" bypasses the HTTP cache
      await cache.addAll(["/", ...kPrecache].map((url) => new Request(url, { cache: "reload" })));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (let name of await caches.keys()) {
        if (name.startsWith("edna-") && name !== kCacheName) {
          await caches.delete(name);
        }
      }
    })(),
  );
});

async function networkFirst(request, cacheKey) {
  let cache = await caches.open(kCacheName);
  try {
    let response = await fetch(request);
    if (response.ok) {
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (e) {
    let cached = await cache.match(cacheKey, kMatchOptions);
    if (cached) {
      return cached;
    }
    throw e;
  }
}

async function cacheFirst(request) {
  let cache = await caches.open(kCacheName);
  let cached = await cache.match(request, kMatchOptions);
  if (cached) {
    return cached;
  }
  let response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  let request = event.request;
  if (request.method !== "GET") {
    return;
  }
  let url = new URL(request.url);
  if (url.origin !== self.location.origin || isNetworkOnly(url)) {
    return;
  }
  if (request.mode === "navigate") {
    // the note name is in the URL hash so the app is always "/". Other pages
    // (e.g. /help) are cached under their own path when visited
    event.respondWith(networkFirst(request, url.pathname));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request, url.pathname));
});
