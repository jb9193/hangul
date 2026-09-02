/* 우리 한글 교실 — 오프라인 서비스 워커
   빌드 때 8db7df47c6 이 실제 값으로 바뀝니다.

   - 화면(index.html 등)은 인터넷이 되면 새것을 먼저 받고, 안 되면 저장해 둔 것을 씁니다.
   - 소리 파일은 이름이 내용에 따라 정해지므로(내용이 같으면 이름도 같음)
     한 번 저장하면 그대로 씁니다. 지우거나 다시 받을 필요가 없습니다.
*/
'use strict';

var SHELL = 'hangul-shell-8db7df47c6';
var AUDIO = 'hangul-audio';                 // 판이 바뀌어도 그대로 둔다
var KEEP = [SHELL, AUDIO];

var SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL)
      .then(function (c) { return c.addAll(SHELL_FILES); })
      .catch(function () { /* 한 개라도 실패해도 설치는 진행 */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (n) {
          return KEEP.indexOf(n) === -1 ? caches.delete(n) : null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function isAudio(url) {
  return url.pathname.indexOf('/audio/') !== -1;
}

// 소리·아이콘: 저장해 둔 것 먼저 (없으면 받아서 저장)
function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      });
    });
  });
}

// 화면: 인터넷 먼저(4초까지 기다림), 안 되면 저장해 둔 것
function networkFirst(req) {
  return caches.open(SHELL).then(function (c) {
    var fromNet = fetch(req).then(function (res) {
      if (res && res.ok) c.put(req, res.clone());
      return res;
    });
    var timeout = new Promise(function (resolve) {
      setTimeout(function () { resolve(null); }, 4000);
    });
    return Promise.race([fromNet.catch(function () { return null; }), timeout])
      .then(function (res) {
        if (res) return res;
        return c.match(req).then(function (hit) {
          return hit || c.match('./index.html') || fromNet;
        });
      });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  if (isAudio(url) || /\.(png|webmanifest)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(req, isAudio(url) ? AUDIO : SHELL));
    return;
  }
  if (req.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(req));
  }
});
