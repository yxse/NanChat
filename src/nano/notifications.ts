import { useContext } from "react";
import { getAccounts } from "../components/getAccount";
import { getAccount } from "../components/getAccount";
import { WalletContext } from "../components/Popup";
import { networks } from "../utils/networks";
import { convertAddress } from "../utils/format";
import { box, wallet } from "multi-nano-web";
import {
    FirebaseMessaging,
    GetTokenOptions,
  } from "@capacitor-firebase/messaging";
import { Toast } from "antd-mobile";
import { Capacitor } from "@capacitor/core";
import { isTauri } from "@tauri-apps/api/core";
import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
  } from '@tauri-apps/plugin-notification';
const SERVER_NOTIFICATIONS = import.meta.env.VITE_PUBLIC_BACKEND + "/notifications";

export async function getToken() {
    const options: GetTokenOptions = {
      vapidKey: import.meta.env.VITE_PUBLIC_firebase_vapidKey,
    };
    if (Capacitor.getPlatform() === "web") {
        options.serviceWorkerRegistration =
          await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      }
    // console.log({options});
    const { token } = await FirebaseMessaging.getToken(options);
    // Toast.show({
    //     content: token
    // });
    // console.log({token});
    return token;
}

export async function sendNotificationTauri(title, body) {
    if (isTauri()) {
        let permissionGranted = await isPermissionGranted();
        if (permissionGranted) {
          sendNotification({ title: title, body: body });
        }
      }
}
async function askPermission() {
    let permissionGranted = false;
    if (isTauri()){
        let permissionGranted = await isPermissionGranted();
        // If not we need to request it
        if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === 'granted';
        }
    }
    const permission = await FirebaseMessaging.requestPermissions();
    // console.log({permission});
    permissionGranted = permission.receive === "granted";
    // Toast.show({
    //     content: permission.receive
    // });
    // return
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
    // console.log({allAccounts});
    // const permission = await Notification.requestPermission();
    if (permission.receive === "granted") {
        const token = await getToken();
        await saveSubscription(token, allAccounts);
    }
    return permissionGranted;
}

async function registerServiceWorker(accounts) {
    let old = localStorage.getItem("subscription");
    // if (old) {
    //     old = JSON.parse(old);
    //     if (old.join() === accounts.join()) { // same accounts, no need to resubscribe
    //         return;
    //     }
    // }
    // const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    // let subscription = await registration.pushManager.getSubscription();
    // // user is not already subscribed, we subscribe him to push notifications
    // if (!subscription) {
    //     subscription = await registration.pushManager.subscribe({
    //         userVisibleOnly: true,
    //         applicationServerKey: await getPublicKey(),
    //     });
    // }
    let r = await saveSubscription(token, accounts);
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

async function saveSubscription(token, accounts) {
    // let old = localStorage.getItem("subscription");
    // if (old) {
    //     old = JSON.parse(old);
    //     if (old.join() === accounts.join()) { // same accounts, no need to resubscribe
    //         return;
    //     }
    // }
    // let body = subscription.toJSON();
    // body.addresses = accounts;
    // console.log(body);
    let r = await fetch(SERVER_NOTIFICATIONS + "/push/subscribe", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify({
            token: token,
            addresses: accounts,
        }),
    });
    if (r.status === 200 || r.status === 201) { // store in local storage only if successful
        localStorage.setItem("subscription", JSON.stringify(accounts));
    }

}


const bc = new BroadcastChannel("notification_channel");
bc.onmessage = (event) => {
    return;
  console.log(event);
  const data = event.data;
  console.log(localStorage.getItem('seed'));
  
};


export { askPermission, registerServiceWorker, saveSubscription, getPublicKey };