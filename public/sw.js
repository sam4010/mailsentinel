// MailSentinel Service Worker - Handles background push notifications and offline caching

const CACHE_NAME = 'mailsentinel-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// Install event - Cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  let data = {
    title: 'MailSentinel Alert',
    body: 'You have a new important email!',
    url: '/',
    priority: 'Normal',
    sender: '',
    ruleName: ''
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const priorityBadge = data.priority === 'Critical' ? '🚨 [CRITICAL]' : data.priority === 'High' ? '⚠️ [HIGH]' : '📬';
  const notificationTitle = `${priorityBadge} ${data.title || 'Important Email Alert'}`;

  const options = {
    body: data.body || 'A high-priority email matched your rules.',
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    vibrate: data.priority === 'Critical' ? [200, 100, 200, 100, 300] : [100, 50, 100],
    data: {
      url: data.url || '/',
      gmailUrl: data.gmailUrl || null,
      messageId: data.messageId || null
    },
    tag: `mailsentinel-${data.messageId || Date.now()}`,
    renotify: true,
    actions: [
      {
        action: 'open_gmail',
        title: 'Open in Gmail'
      },
      {
        action: 'view_app',
        title: 'View Details'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.action === 'open_gmail' && event.notification.data.gmailUrl 
    ? event.notification.data.gmailUrl 
    : event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if client is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.action === 'open_gmail' && event.notification.data.gmailUrl) {
            // Open Gmail in a new tab
            return clients.openWindow(event.notification.data.gmailUrl);
          }
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
