import { useContext } from "react";
import { getAccounts } from "../components/getAccount";
import { getAccount } from "../components/getAccount";
import { WalletContext } from "../components/Popup";
import { networks } from "../utils/networks";
import { convertAddress } from "../utils/format";
import { box, wallet } from "multi-nano-web";

const SERVER_NOTIFICATIONS = import.meta.env.VITE_PUBLIC_SERVER_NOTIFICATIONS_URL;

async function askPermission() {
    const activeAddressesLs = localStorage.getItem("activeAddresses");
    const activeAddresses = activeAddressesLs ? JSON.parse(activeAddressesLs) : [];
    const accounts = activeAddresses || [];
    const tickers = Object.keys(networks).filter((ticker) => !networks[ticker].custom);

    const allAccounts = []
    for (let account of accounts) {
        const accountsWithTicker = tickers.map((ticker) => {
            return {
                ticker,
                address: convertAddress(account, ticker),
            }
        })
        allAccounts.push(...accountsWithTicker);
    }
    console.log({allAccounts});
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        registerServiceWorker(allAccounts);
    }
}

async function registerServiceWorker(accounts) {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
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


const bc = new BroadcastChannel("notification_channel");
bc.onmessage = (event) => {
    return;
  console.log(event);
  const data = event.data;
  console.log(localStorage.getItem('seed'));
  
};


export { askPermission, registerServiceWorker, saveSubscription, getPublicKey };