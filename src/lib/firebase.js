import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            'AIzaSyBerqVKDbc9J7SxGrRxPjzRYDIVUcncyhI',
  authDomain:        'vistara-realty.firebaseapp.com',
  projectId:         'vistara-realty',
  storageBucket:     'vistara-realty.firebasestorage.app',
  messagingSenderId: '359609918547',
  appId:             '1:359609918547:web:ca793db361046cd2ca92a6',
  measurementId:     'G-5BWVP699CS',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const VAPID_KEY = '6Rfq-OYZ0d7ub5_MJbPgW2CxX21mB6H1E-4v5nCOOMw';

export function getFirebaseMessaging() {
  if (typeof window === 'undefined') return null;
  return getMessaging(app);
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined') return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const messaging = getFirebaseMessaging();
  if (!messaging) return null;
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
  });
  return token;
}

export { onMessage, getFirebaseMessaging as messaging };
