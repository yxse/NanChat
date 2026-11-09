import React, { useEffect, useState } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useLocation, useNavigate } from 'react-router-dom';
import PasteAction from './PasteAction';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';
import { WebviewOverlay } from '@teamhive/capacitor-webview-overlay';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { getSharedKey } from '../../services/sharedkey';
import { box, wallet } from 'multi-nano-web';
import { getSeed } from '../../utils/storage';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { useEmit, useEvent } from '../messaging/components/EventContext';
import { expectNewMessages, fetcherMessagesCache } from '../messaging/message-cache';
import { useChats } from '../messaging/hooks/use-chats';
import { focusMainWindow, LIMIT_MESSAGES_INITIAL } from '../messaging/utils';
import { useWallet } from '../useWallet';
import { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { getKey } from '../messaging/hooks/useChat';
import { isSavedContact } from '../messaging/call/call-signaling';
import InAppNotification, { showInAppNotification } from './InAppNotification';
import i18n from '../../i18n';


const contactsFileName = ["natriumcontacts_", "kaliumcontacts_"];

// The iOS share extension (NanChatShare) copies the shared file into the App Group container
// and opens nanchat://;?title=...&url=file:///.../Shared/AppGroup/<uuid>/<file>.
// Any app or website can open such a link too, so only files in that container are accepted:
// the path is read from disk, it must never point to a received attachment or other app files.
const isSharedContactsFile = (fileUrl: string) => {
  let parsed: URL;
  let path: string;
  try {
    parsed = new URL(fileUrl); // also resolves "..", "%2e%2e"
    path = decodeURIComponent(parsed.pathname);
  } catch {
    return false;
  }
  if (parsed.protocol !== "file:" || parsed.host) return false;
  const match = path.match(/\/Containers\/Shared\/AppGroup\/[0-9A-F-]{36}\/([^/]+)$/i);
  return !!match && !path.split("/").includes("..") && contactsFileName.some((name) => match[1].startsWith(name));
}

const isContactImport = (url: string) => {
  if (Capacitor.getPlatform() !== "ios") return false; // android shares go through the send intent (see checkIntent)
  let searchParams: URLSearchParams;
  try {
    searchParams = new URL(url).searchParams;
  } catch {
    return false;
  }
  const title = searchParams.get('title');
  const urlFile = searchParams.get('url');
  if (urlFile && title && contactsFileName.find((name) => title.startsWith(name))){
    let urlFileDecoded: string;
    try {
      urlFileDecoded = decodeURIComponent(urlFile); // percent-encoded twice by the share extension
    } catch {
      return false;
    }
    return isSharedContactsFile(urlFileDecoded) ? urlFileDecoded : false;
  }
  return false;
}

// Where a URI comes from, so the Sign screen can warn about requests the user
// may not have started (outside deep links, QR codes, pasted text).
export type UriOrigin = { source: "in-app" | "external", pageUrl?: string };
const EXTERNAL_ORIGIN: UriOrigin = { source: "external" };
const isWalletDeepLink = (url: string) => /^(nano|nan|nanauth|ban|xdg|ana|xro):/i.test(url);

// Paths under /_capacitor_* are served by the native local server (files on disk, http proxy).
// Putting one in the address bar would let the next page load render a received file
// (e.g. html) on the app origin, so they are never navigated to.
export const isSafeAppPath = (path: unknown): path is string => {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return false;
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  return !decoded.toLowerCase().includes("_capacitor");
};

// Incoming / missed call push. Visible ones are shown by the OS; data-only ones
// are sent to accounts accepting calls from their contacts only, which only
// this app can check (contacts are end-to-end encrypted).
const showCallNotification = (data: Record<string, string>, isActive: boolean) => {
  if (data.silent !== "1" || isActive) return; // in the app, the call screen rings over the socket
  let contacts = [];
  try {
    contacts = JSON.parse(localStorage.getItem("contacts") || "[]");
  } catch (error) {
    console.error(error);
  }
  if (!isSavedContact(contacts, data.fromAccount)) return;
  LocalNotifications.schedule({
    notifications: [{
      id: parseInt(data.callId.slice(-7), 16), // same id: the missed call notification replaces the incoming one
      threadIdentifier: data.chatId,
      title: data.title,
      body: data.body,
      schedule: { at: new Date(Date.now() + 100) },
      extra: { url: data.url },
    }],
  });
};

const AppUrlListener: React.FC<any> = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [uri, setUri] = useState('');
    const [uriOrigin, setUriOrigin] = useState<UriOrigin>(EXTERNAL_ORIGIN);
    const {mutateChats} = useChats()
    const {activeAccount, activeAccountPk} = useWallet()
    const {mutate: globalMutate} = useSWRConfig()
    const eventOpenUrl = useEvent('open-url'); // handle open url from discover nano apps
    const emit = useEmit()
    const handleURL = (url: string, origin: UriOrigin = EXTERNAL_ORIGIN) => {
      console.log("handle", url)
      let contactsFile = isContactImport(url);
      if (contactsFile){
        navigate("/contacts", { state: { contactsImport: contactsFile } });
        return;
      }
      if (
        (url.startsWith("https://nanchat.com/") || (url.startsWith("nan://nanchat.com/")))
        && !url.includes("?uri="))
        {
        // no valid action detected, we just open the app and redirect to the correct page
        const path = url.replace('nan://nanchat.com/', '/').replace("https://nanchat.com/", "/")
        navigate("/")
        if (isSafeAppPath(path)) navigate(path)
        return; 
      }
      setUriOrigin(origin);
      setUri(url);
    }

    // Desktop (WebView2): on minimize the webview is hidden, and when it is shown again on restore the page gets the
    // focus and loses it right after, so typing goes nowhere until a click. After a restore, if the page has not got
    // the focus back, give it to the webview (the focused element, e.g. the message input, keeps it).
    // Only on a restore (page hidden -> visible): switching to another app without minimizing keeps the page visible,
    // so this never takes the focus from another app. Tauri's window isFocused() can't tell: it is false whenever the
    // focus is inside the webview.
    useEffect(() => {
      if (!isTauri()) return;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const refocus = async () => {
        if (document.hasFocus() || document.visibilityState === 'hidden') return;
        try {
          const { getCurrentWebview } = await import('@tauri-apps/api/webview');
          await getCurrentWebview().setFocus();
        } catch (e) {
          console.warn("cannot give the focus back to the webview", e);
        }
      };
      const onVisibility = () => {
        timers.forEach(clearTimeout);
        timers.length = 0;
        if (document.visibilityState !== 'visible') return;
        // after the restore settled (the focus is lost right after it), and once more in case it was lost again
        timers.push(setTimeout(refocus, 150), setTimeout(refocus, 600));
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        timers.forEach(clearTimeout);
      };
    }, []);

    useEffect(() => {
      const handleOpenUrl = async () => {
        await onOpenUrl((urls) => {
          let url = urls[0];
          handleURL(url)
        });
      };

      if (isTauri()){
        handleOpenUrl();
        import('@tauri-apps/api/event').then(({ listen }) => {
          // links from the desktop in-app browser, with the page that triggered them
          listen<{url: string, pageUrl: string}>('nanchat-navigation', (event) => {
            const { url, pageUrl } = event.payload;
            console.log('[nanchat-navigation] intercepted url:', url);
            if (url.startsWith("https://nanchat.com/") || url.startsWith("nan://nanchat.com/") || isWalletDeepLink(url)) {
            handleURL(url, { source: "in-app", pageUrl });
            focusMainWindow();
            }
          }).then((unlisten) => {
            console.log('[nanchat-navigation] listener registered');
            return unlisten;
          });
        });
      }
      if (Capacitor.isNativePlatform()){
        App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
          console.log('appurlopen')
          console.log(event.url)

          WebviewOverlay.toggleSnapshot(true);
         handleURL(event.url)
          try {
            // InAppBrowser.close()
          } catch (error) {
            console.log(error)
          }
          });
        }

    }, []);
    useEffect(() => {
        if (eventOpenUrl && Capacitor.isNativePlatform()) {
          console.log("eventOpenUrl data url", eventOpenUrl);
          WebviewOverlay.toggleSnapshot(true);
          // links from the mobile in-app browser, with the page that triggered them
          handleURL(eventOpenUrl.url, { source: "in-app", pageUrl: eventOpenUrl.pageUrl });
          emit('open-url', null);
      }

    }, [eventOpenUrl]);
    useEffect(() => {

      FirebaseMessaging.addListener("notificationActionPerformed", async (event) => {
        console.log("notificationActionPerformed: ", { event });
        // Toast.show({
          //   content: "action" + event.notification.title + " " + event.notification.body + " " + event.notification.data.url
          // })
          // the chat has a message the store may not have yet (app launched / resumed from the notification): its newest
          // page comes from the server, before navigating so the chat room's first load already asks for it
          expectNewMessages(event.notification.data?.chatId);
          navigate('/') // to prevent bug when navigating back
          if (isSafeAppPath(event.notification.data.url)) navigate(event.notification.data.url);
          // refresh the chats list right away (new heights / unread, which also refresh the open chat, see useChat).
          // Again a bit later: on a cold launch the first call can be made before the chats store is ready
          mutateChats()
          setTimeout(() => mutateChats(), 1000);
        
        FirebaseMessaging.getDeliveredNotifications().then((notifications) => {
          if (Capacitor.getPlatform() === "android"){ // on iOS, threadId of notification allows to already remove all notification of that thread when clicking, on android we remove all notification, grouping notification in android seems to be pain in the ass
            FirebaseMessaging.removeAllDeliveredNotifications()
          }
          // remove notification of the chat
          const notificationsChat = notifications.notifications.filter((notification) => notification.data?.url === event.notification.data.url); // this doesnt seem to work as data is not available
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
        const data = (event.notification.data || {}) as Record<string, string>;
        showInAppNotification({
          title: event.notification.title || "",
          body: event.notification.body || "",
          address: data.type === "group" ? undefined : data.fromAccount, // group avatars need the chat, fall back to app icon
          url: data.url,
        })
        
        
        // navigate(event.notification.data.url);
      });
      if (Capacitor.getPlatform() === "web") {
        // return
        console.log("adding service worker web event listenerw");
        navigator.serviceWorker.addEventListener("message", (event: any) => {
          console.log("serviceWorker message: ", { event });
          if (event.data.messageType === "notification-clicked" && isSafeAppPath(event.data.data.url)) {
            navigate(event.data.data.url); // navigate to url only when clicked
          }
        });
      }
  
FirebaseMessaging.addListener("notificationReceived", async (event) => {
  
  try {

    let {isActive} = await App.getState();
  console.log("notificationReceived: ", { event });
  const callData = event.notification.data as Record<string, string>;
  if (callData?.callId) {
    showCallNotification(callData, isActive);
    return;
  }
  let chatId = event.notification.data.chatId;
  let url = event.notification.data.url;
  let messagePreview = event.notification.data.messagePreview;
  let isMessagePreviewExist = messagePreview != null && messagePreview != undefined; // for backward compatibility, we set url to null to not show double notification on old client
  if ((url == null && !isMessagePreviewExist) || ((location.pathname === "/chat" || location.pathname === "/") && isActive)) {
    return
  }
  console.log("path", location.pathname, url);

  if (location.pathname === url && isActive) {
    return; // do not show notification if the user is already in the chat
  }
  // Preload first page of messages so the chat opens instantly when the user taps the notification.
  // We seed the useSWRInfinite cache directly (under its $inf$ key) so useChat(chatId)
  // mounts with data already present and skips the initial loading state.
  expectNewMessages(chatId); // the store may not have this message yet (socket not connected in background)
  const firstPageKey = `/messages?chatId=${chatId}&limit=${LIMIT_MESSAGES_INITIAL}&cursor=-1&clearCount=false`;
  const infiniteKey = unstable_serialize((index, prev) => getKey(index, prev, chatId));
  globalMutate(
    infiniteKey,
    async () => {
      const firstPage = await fetcherMessagesCache(firstPageKey, activeAccount, activeAccountPk);
      return [firstPage];
    },
    { revalidate: false },
  ).catch((err) => console.warn('preload chat messages failed', err));

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
  let mentioned = event.notification.data.mentioned === "true"; // @mentioned in a group
  // console.log("decryption", message, targetAccount, accounts[0].privateKey);
  
  let activeAddresses = localStorage.getItem("activeAddresses") || "[]";
  activeAddresses = JSON.parse(activeAddresses);
  const index = activeAddresses?.findIndex((address) => address === toAccount);
  let accounts = seed?.length === 128 ? wallet.accounts(seed, index, index) : wallet.legacyAccounts(seed, index, index );
  let decryptionKey = accounts[0].privateKey;
  // console.log("decryptionKey", decryptionKey);
  // console.log("accounts", accounts);
  console.log("activeAddresses", activeAddresses);
  console.log("index", index);
  console.log("targetAccount", targetAccount);
  if (isGroupMessage) {
    decryptionKey = await getSharedKey(chatId, sharedAccount, decryptionKey);
  }

  let decrypted = message
  try {
    decrypted = box.decrypt(message, targetAccount, decryptionKey);
    // localStorage.setItem(`message-${idMessage}`, decrypted);
    // todo save with savemessagecache
  } catch (error) {
    console.error('Message decryption failed:', error); // could happen for sticker or special message

  }
  
  decryptionKey = null; 
  accounts = null;
  seed = null; // remove seed from memory
  console.log("decrypted: ", decrypted);
  if (messagePreview) {
    // localStorage.setItem(`message-${message._id}`, decrypted);
    LocalNotifications.schedule({
          notifications: [
            {
              threadIdentifier: chatId,
              title: title,
              body: 
              (mentioned ? i18n.t('mentionedYouTag') + ' ' : '') +
              (isGroupMessage ? `${fromAccountName}: ${decrypted}` : decrypted),
              id: +idInt,
              schedule: { at: new Date(Date.now() + 100) },
              extra: {
                url: url,
              }
            }
          ]
        })
      }

      } catch (error) {
        console.log(error.stack);
        // Toast.show({content: error.message, icon: 'fail'})
      }

})
      LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
        const notification = event.notification;
        const extra = notification.extra
        console.log("localNotificationActionPerformed", notification);
        console.log("extra", extra);
        // navigate to the url
        navigate("/");
        if (isSafeAppPath(extra?.url)) navigate(extra.url);
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
    return <>
      <PasteAction mode="invisible" uri={uri} uriOrigin={uriOrigin} setUri={setUri} />
      <InAppNotification
        onOpen={(notification) => {
          if (!isSafeAppPath(notification.url)) return;
          navigate('/') // to prevent bug when navigating back
          navigate(notification.url)
        }}
      />
    </>;
  };
  
  export default AppUrlListener;