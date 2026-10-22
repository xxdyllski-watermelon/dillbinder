/* Service worker DYLL Binder — membuat aplikasi bisa dibuka offline.
   Naikkan angka VERSION setiap kali Anda mengubah file di repository
   agar pengguna langsung mendapat versi terbaru. */
var VERSION = "v1";
var CACHE = "dyll-binder-" + VERSION;

var CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest"
];
var OPTIONAL = [
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(CORE).then(function(){
        return Promise.all(OPTIONAL.map(function(url){
          return cache.add(url).catch(function(){});
        }));
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){
        return k.indexOf("dyll-binder-") === 0 && k !== CACHE;
      }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Cache dulu (cepat & offline), lalu perbarui diam-diam dari jaringan. */
self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  var network = fetch(req).then(function(res){
    if(res && res.status === 200 && res.type === "basic"){
      var copy = res.clone();
      caches.open(CACHE).then(function(cache){ cache.put(req, copy); });
    }
    return res;
  }).catch(function(){ return null; });

  event.waitUntil(network);

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function(cached){
      if(cached) return cached;
      return network.then(function(res){
        if(res) return res;
        if(req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
