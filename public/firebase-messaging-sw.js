import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

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

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
