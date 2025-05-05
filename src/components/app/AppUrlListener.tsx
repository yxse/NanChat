import React, { useEffect, useState } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import PasteAction from './PasteAction';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';
import { InAppBrowser } from '@capgo/inappbrowser';
import { WebviewOverlay } from '@teamhive/capacitor-webview-overlay';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getSharedKey } from '../../services/sharedkey';
import { box, wallet } from 'multi-nano-web';
import { getSeed } from '../../utils/storage';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';


const isContactImport = (url: string) => {
  const contactsFileName = ["natriumcontacts_", "kaliumcontacts_"];
  const urlData = new URL(url);
  const searchParams = urlData.searchParams;
  const title = searchParams.get('title');
  const urlFile = searchParams.get('url');
  if (urlFile && title && contactsFileName.find((name) => title.startsWith(name))){
    const urlFileDecoded = decodeURIComponent(urlFile);
    return urlFileDecoded;
  }
  return false;
}

const AppUrlListener: React.FC<any> = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [uri, setUri] = useState('');
    useEffect(() => {
      const handleOpenUrl = async () => {
        await onOpenUrl((urls) => {
          let url = urls[0];
          setUri(url);
        });
      };

      if (isTauri()){
        handleOpenUrl();
      }
      if (Capacitor.isNativePlatform()){
        App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
          WebviewOverlay.toggleSnapshot(true);
          let contactsFile = isContactImport(event.url);
          if (contactsFile){
            navigate("/contacts?import_url=" + contactsFile);
            return;
          }
          if (event.url.startsWith("https://nanwallet.com/") && !event.url.includes("?uri=")){
            // no valid action detected, we just open the app and redirect to the correct page
            navigate(event.url.replace("https://nanwallet.com/", "/"));
            return; 
          }
          InAppBrowser.hideWebView();
          setUri(event.url);
          try {
            // InAppBrowser.close()
          } catch (error) {
            console.log(error)
          }
            // Toast.show({
            //     content: "Opening URL: " + event.url
            // });
          });
        }

    }, []);
    useEffect(() => {

      FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
        console.log("notificationActionPerformed: ", { event });
        // Toast.show({
        //   content: "action" + event.notification.title + " " + event.notification.body + " " + event.notification.data.url
        // })
        navigate('/') // to prevent bug when navigating back
        navigate(event.notification.data.url);
        
        FirebaseMessaging.getDeliveredNotifications().then((notifications) => {
          // remove notification of the chat
          const notificationsChat = notifications.notifications.filter((notification) => notification.data?.url === event.notification.data.url);
          console.log("notification filtered", notificationsChat);
          FirebaseMessaging.removeDeliveredNotifications({notifications: notificationsChat});
        });
      }
      );
      FirebaseMessaging.addListener("notificationReceived", (event) => {
        console.log("notificationReceived: ", { event });
        // focus window
        // window.focus();
        if (window.location.pathname === event.notification.data.url) {
          return // prevent showing notification if already on the page
        }
        if (!event.notification.body?.includes("New message")) { // only show toast notification for message since already showing toast when receiving crypto
          return 
        }
        Toast.show({
          position: "top",
          content: <div>
            {/* <div><b>{event.notification.data.url}</b></div> */}
            {/* <div><b>{window.location.pathname }</b></div> */}
            <div><b>{event.notification.title}</b></div>
            <div>{event.notification.body}</div>
          </div>
        })
        
        
        // navigate(event.notification.data.url);
      });
      if (Capacitor.getPlatform() === "web") {
        // return
        console.log("adding service worker web event listenerw");
        navigator.serviceWorker.addEventListener("message", (event: any) => {
          console.log("serviceWorker message: ", { event });
          if (event.data.messageType === "notification-clicked" && event.data.data.url) {
            navigate(event.data.data.url); // navigate to url only when clicked
          }
        });
      }
  
FirebaseMessaging.addListener("notificationReceived", async (event) => {
  
  try {

    let {isActive} = await App.getState();
  console.log("notificationReceived: ", { event });
  let chatId = event.notification.data.chatId;
  let url = event.notification.data.url;
  if (url == null || ((location.pathname === "/chat" || location.pathname === "/") && isActive)) {
    return
  }
  console.log("path", location.pathname, url);

  if (location.pathname === url && isActive) {
    return; // do not show notification if the user is already in the chat
  }
  // return
  // focus window
  // window.focus();
  let seed = await getSeed();
  seed = seed?.seed;
  
  
  let message = event.notification.data.message;
  let idInt = event.notification.data.idInt;
  let idMessage = event.notification.data.idMessage;
  let fromAccount = event.notification.data.fromAccount;
  let sharedAccount = event.notification.data.sharedAccount;
  let fromAccountName = event.notification.data.fromAccountName;
  let toAccount = event.notification.data.toAccount;
  // let title = event.notification.data.aps.alert.title;
  let title = event.notification.data.title;
  let targetAccount = fromAccount;
  let isGroupMessage = event.notification.data.type === "group";
  // console.log("decryption", message, targetAccount, accounts[0].privateKey);
  
  let activeAddresses = localStorage.getItem("activeAddresses") || "[]";
  activeAddresses = JSON.parse(activeAddresses);
  const index = activeAddresses?.findIndex((address) => address === toAccount);
  let accounts = seed?.length === 128 ? wallet.accounts(seed, index, index) : wallet.legacyAccounts(seed, index, index );
  let decryptionKey = accounts[0].privateKey;
  console.log("decryptionKey", decryptionKey);
  console.log("accounts", accounts);
  console.log("activeAddresses", activeAddresses);
  console.log("index", index);
  console.log("targetAccount", targetAccount);
  if (isGroupMessage) {
    decryptionKey = await getSharedKey(chatId, sharedAccount, decryptionKey);
  }

  let decrypted = message
  try {
    decrypted = box.decrypt(message, targetAccount, decryptionKey);
    localStorage.setItem(`message-${idMessage}`, decrypted);
    decrypted 
  } catch (error) {
    console.error('Message decryption failed:', error); // could happen for sticker or special message

  }
  
  decryptionKey = null; 
  accounts = null;
  seed = null; // remove seed from memory
  console.log("decrypted: ", decrypted);
    // localStorage.setItem(`message-${message._id}`, decrypted);
    LocalNotifications.schedule({
          notifications: [
            {
              threadIdentifier: chatId,
              title: title,
              body: 
              isGroupMessage ? `${fromAccountName}: ${decrypted}` : decrypted,
              id: +idInt,
              schedule: { at: new Date(Date.now() + 100) },
              extra: {
                url: url,
              }
            }
          ]
        })

      } catch (error) {
        console.log(error.stack);
        Toast.show({content: error.message, icon: 'fail'})
      }

})
      LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
        const notification = event.notification;
        const extra = notification.extra
        console.log("localNotificationActionPerformed", notification);
        console.log("extra", extra);
        // navigate to the url
        navigate("/");
        navigate(extra.url);
        LocalNotifications.getDeliveredNotifications().then((notifications) => {
          // remove notification of the chat
          const notificationsChat = notifications.notifications.filter((notification) => notification.extra?.url === extra.url);
          console.log("notification filtered", notificationsChat);
          LocalNotifications.removeDeliveredNotifications({notifications: notificationsChat});
        });
      });

      return () => {
        FirebaseMessaging.removeAllListeners();
      }
    }

    , [location.pathname]);
    return <PasteAction mode="invisible" uri={uri} setUri={setUri} />;
  };
  
  export default AppUrlListener;