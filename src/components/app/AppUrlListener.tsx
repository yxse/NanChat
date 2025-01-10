import React, { useEffect, useState } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import PasteAction from './PasteAction';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';

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
          setUri(event.url);
            // Toast.show({
            //     content: "Opening URL: " + event.url
            // });
          });
        }

    }, []);
  
    return <PasteAction mode="invisible" uri={uri} setUri={setUri} />;
  };
  
  export default AppUrlListener;