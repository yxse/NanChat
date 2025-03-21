import React, { useEffect, useState } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import PasteAction from './PasteAction';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';
import { InAppBrowser } from '@capgo/inappbrowser';
import { WebviewOverlay } from '@teamhive/capacitor-webview-overlay';


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
  
    return <PasteAction mode="invisible" uri={uri} setUri={setUri} />;
  };
  
  export default AppUrlListener;