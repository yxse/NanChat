
import localforage from 'localforage';
import { box, wallet } from 'multi-nano-web';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

const bc = new BroadcastChannel("notification_channel");

//https://vite-pwa-org.netlify.app/guide/inject-manifest.html
// precacheAndRoute(self.__WB_MANIFEST)
// cleanupOutdatedCaches()

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING')
        self.skipWaiting()
})

self.addEventListener("install", () => {
    // self.skipWaiting();
});
self.addEventListener('fetch', function (event) {
    console.log('Fetch event for ', event.request.url);
});
self.addEventListener("push", async (event) => {
    return
    const data = event.data ? event.data.json() : {};

    let body = data.body;
    let bodyMessage = data.body.description;
    console.log('Push event', data);

    let userAgent = navigator.userAgent
    // on safari, we can't do async operations so we show notification directly
    // https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers#Enable-push-notifications-for-your-webpage-or-web-app

    if (userAgent.includes('Safari') && !userAgent.includes('Chrome') && body.type === "message") {
        event.waitUntil(self.registration.showNotification(data.title, {
            body: "New message",
            icon: data.body.icon,
        }));
        return;
    }

    const seed = await localforage.getItem('seed') //https://stackoverflow.com/a/60667436
    if (body.type === "message" && seed) {
        // if not protected by password, we can locally decrypt the message and show it
        let accounts = seed?.length === 128 ? wallet.accounts(seed, 0, 5) : wallet.legacyAccounts(seed, 0, 5);
        let privateKey = accounts.find((account) => account.address === data.body.to)?.privateKey;
        bodyMessage = box.decrypt(bodyMessage, data.body.from, privateKey);
    }
    else if (body.type === "message" && !seed) {
        bodyMessage = "New message";
    }
    event.waitUntil(self.registration.showNotification(data.title, {
        // body: "New message" + data.body.description,
        // body: "New message",
        body: bodyMessage,
        icon: data.body.icon,
    }));
    // bc.postMessage(data);
});