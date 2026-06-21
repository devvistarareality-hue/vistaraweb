importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBerqVKDbc9J7SxGrRxPjzRYDIVUcncyhI',
  authDomain:        'vistara-realty.firebaseapp.com',
  projectId:         'vistara-realty',
  storageBucket:     'vistara-realty.firebasestorage.app',
  messagingSenderId: '359609918547',
  appId:             '1:359609918547:web:ca793db361046cd2ca92a6',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Vistara Realty', {
    body:  body  || '',
    icon:  '/image-WBG.png',
    badge: '/image-WBG.png',
    data:  payload.data || {},
  });
});
