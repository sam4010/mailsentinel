import { useState, useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
    } catch (err) {
      console.warn('Error checking push subscription:', err);
    }
  };

  const subscribeUser = async (vapidPublicKey: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupported) {
      return { success: false, error: 'Push notifications are not supported by this browser.' };
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setLoading(false);
        return { success: false, error: 'Notification permission was denied.' };
      }

      if (!vapidPublicKey) {
        setLoading(false);
        return { success: false, error: 'VAPID public key not provided by server.' };
      }

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      // Send subscription to backend
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (!res.ok) {
        throw new Error('Failed to register subscription with server');
      }

      setIsSubscribed(true);
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      return { success: false, error: err?.message || 'Failed to subscribe to push notifications' };
    }
  };

  const sendLocalTestNotification = async (title: string, body: string): Promise<boolean> => {
    try {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') return false;
      }

      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/favicon.svg',
          tag: 'mailsentinel-local-test',
        });
        return true;
      } else {
        new Notification(title, { body, icon: '/icon-192.png' });
        return true;
      }
    } catch (e) {
      console.error('Failed to trigger local notification:', e);
      return false;
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribeUser,
    sendLocalTestNotification,
  };
}
