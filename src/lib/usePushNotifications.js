'use client';
import { useEffect } from 'react';
import { requestNotificationPermission, getFirebaseMessaging, onMessage } from './firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function saveToken(token) {
  const access = localStorage.getItem('access_token');
  if (!access || !token) return;
  await fetch(`${API_BASE}/api/notifications/token/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
    body:    JSON.stringify({ token, platform: 'web' }),
  }).catch(() => {});
}

export function usePushNotifications() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const access = localStorage.getItem('access_token');
    if (!access) return;

    requestNotificationPermission()
      .then(saveToken)
      .catch(() => {});

    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const unsub = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (Notification.permission === 'granted') {
        new Notification(title || 'Vistara Realty', { body: body || '', icon: '/image-WBG.png' });
      }
    });

    return unsub;
  }, []);
}
