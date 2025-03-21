// import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.

importScripts(
  "https://www.gstatic.com/firebasejs/9.7.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.7.0/firebase-messaging-compat.js",
);
const firebaseConfig = {
    apiKey: "AIzaSyAHy_2GatOSvUTcrcyqJrxE_Xy7BbJ54cw",
    authDomain: "nanwallet-efce5.firebaseapp.com",
    projectId: "nanwallet-efce5",
    storageBucket: "nanwallet-efce5.firebasestorage.app",
    messagingSenderId: "137198054925",
    appId: "1:137198054925:web:7ca07d199b5f0c912aaf44",
    measurementId: "G-1GKPS9V51B"
  };
firebase.initializeApp(firebaseConfig);
  
// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// messaging.onBackgroundMessage((payload) => {
//   console.log(
//     '[firebase-messaging-sw.js] Received background message ',
//     payload
//   );
//   // Customize notification here
//   const notificationTitle = payload.notification.title;
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: '/icons/icon.png'
//   };

//   return self.registration.showNotification(notificationTitle, notificationOptions);
// //   self.addEventListener('notificationclick', function(event) {
// //     // console.log('On notification click: ', event.notification.tag);
// //     // console.log(event.notification);
// //     event.notification.close();
// //     event.waitUntil(
// //       openUrl("http://localhost:5173" + payload.data.url)
// //     );
// // });

// });

async function openUrl(url) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    if (client.url === url && 'focus' in client) {
      return client.focus();
    }
  }
  if (self.clients.openWindow) {
    return self.clients.openWindow(url);
  }
}
