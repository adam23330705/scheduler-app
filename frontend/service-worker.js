/**
 * Service Worker - PWA离线缓存 + 推送通知
 */

const 缓存名 = 'scheduler-v1';
const 需缓存文件 = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/store.js',
  '/js/日历.js',
  '/js/任务.js',
  '/js/番茄钟.js',
  '/js/统计.js',
  '/js/app.js',
  '/manifest.json',
];

// ===== 安装：预缓存核心文件 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(缓存名).then((cache) => {
      return cache.addAll(需缓存文件);
    })
  );
  self.skipWaiting();
});

// ===== 激活：清理旧缓存 =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== 缓存名).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ===== 请求拦截：缓存优先，网络回退 =====
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API请求不走缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: '离线模式' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // 成功的GET请求才缓存
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(缓存名).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // 网络失败，返回离线页面（仅HTML请求）
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ===== 推送通知 =====
self.addEventListener('push', (event) => {
  const 数据 = event.data?.json() || {};
  const 标题 = 数据.title || '日程规划';
  const 选项 = {
    body: 数据.body || '你有一条新提醒',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 数据.tag || 'reminder',
    data: 数据.url || '/',
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(标题, 选项)
  );
});

// 点击通知打开应用
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // 如果已有窗口则聚焦
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 否则打开新窗口
      return self.clients.openWindow(event.notification.data || '/');
    })
  );
});
