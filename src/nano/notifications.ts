import { getAccounts } from "../components/getAccount";
import { getAccount } from "../components/getAccount";

const SERVER_NOTIFICATIONS = import.meta.env.VITE_PUBLIC_SERVER_NOTIFICATIONS_URL;

async function askPermission() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        const accounts = await getAccounts()
        registerServiceWorker(accounts);
    }
}

async function registerServiceWorker(accounts) {
    const registration = await navigator.serviceWorker.getRegistration('/src/service-worker.js');
    let subscription = await registration.pushManager.getSubscription();
    // user is not already subscribed, we subscribe him to push notifications
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: await getPublicKey(),
        });
    }
    await saveSubscription(subscription, accounts);
}

async function getPublicKey() {
    return import.meta.env.VITE_PUBLIC_SERVER_NOTIFICATIONS_PUBLIC_KEY;
    const { key } = await fetch(SERVER_NOTIFICATIONS + "/push/public-key", {
        headers: {
            Accept: "application/json",
        },
    }).then((r) => r.json());
    return key;
}

/**
* @param {PushSubscription} subscription
* @returns {Promise<void>}
*/
async function saveSubscription(subscription, accounts) {
    let body = subscription.toJSON();
    body.addresses = accounts;
    console.log(body);
    await fetch(SERVER_NOTIFICATIONS + "/push/subscribe", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(body),
    });
}

export { askPermission, registerServiceWorker, saveSubscription, getPublicKey };