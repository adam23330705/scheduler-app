/**
 * Service Worker - PWA离线缓存
 * v1.0.9 - 网络优先策略，确保在线时能获取最新代码
 */

const 缓存名 = 'scheduler-v1.0.9';

// ===== 安装：跳过等待，立即激活 =====
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ===== 激活：清理旧缓存，立即接管 =====
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

// ===== 请求拦截：网络优先，缓存回退 =====
// 在线时优先从网络获取最新资源，离线时回退到缓存
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase / DeepSeek API请求不走缓存
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('api.deepseek.com') ||
      url.hostname.includes('api.bilibili.com')) {
    return;
  }

  // 只拦截GET请求
  if (event.request.method !== 'GET') return;

  // 静态资源：网络优先，缓存回退
  event.respondWith(
    fetch(event.request).then((response) => {
      // 网络成功，更新缓存
      if (response.status === 200) {
        const clone = response.clone();
        caches.open(缓存名).then((cache) => {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(() => {
      // 网络失败，回退到缓存
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        // HTML请求回退到index.html
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
        return new Response('离线', { status: 503 });
      });
    })
  );
});

// ===== 推送通知 =====
self.addEventListener('push', (event) => {
  const 数据 = event.data?.json() || {};
  const 标题 = 数据.title || '花蕾传媒';
  const 选项 = {
    body: 数据.body || '你有一条新消息',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 数据.tag || 'reminder',
    data: 数据.url || './',
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
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(event.notification.data || './');
    })
  );
});
