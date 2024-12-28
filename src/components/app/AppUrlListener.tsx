import React, { useEffect, useState } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import PasteAction from './PasteAction';

const AppUrlListener: React.FC<any> = () => {
    const navigate = useNavigate();
    const [uri, setUri] = useState('');
    useEffect(() => {
      App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        // Example url: https://beerswift.app/tabs/tab2
        // slug = /tabs/tab2
        setUri(event.url);
        // Toast.show({
        //     content: "Opening URL: " + event.url
        // });
      });
     
    }, []);
  
    return <PasteAction mode="invisible" uri={uri} />;
  };
  
  export default AppUrlListener;