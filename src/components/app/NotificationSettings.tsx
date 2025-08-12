
import { Button, Toast, CheckList, Modal, List, Input, Form, NavBar, Divider, Switch } from "antd-mobile";
import { MdOutlineFingerprint, MdOutlinePassword, MdOutlineTimer } from "react-icons/md";
import * as webauthn from '@passwordless-id/webauthn';
import { decrypt, encrypt } from "../../worker/crypto";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useEffect, useState } from "react";
import { getSeed, removeSeed, setSeed } from "../../utils/storage";
import {BiometricAuth} from '@aparajita/capacitor-biometric-auth'
import { authenticate, biometricAuthIfAvailable, webauthnAuthIfAvailable } from "../../utils/biometrics";
import { Capacitor } from "@capacitor/core";
import { askPermission } from "../../nano/notifications";
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import useSWR from "swr";
import { fetcherChat, fetcherMessages, fetcherMessagesPost } from "../messaging/fetcher";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { HapticsImpact } from "../../utils/haptic";
import { useTranslation } from 'react-i18next';
import { App } from "@capacitor/app";
import NotificationIsDisabled from "./NotificationIsDisabled";

function NotificationSettings() {
    const navigate = useNavigate();
    // const [
    //   notificationSettings,
    //   setNotificationSettings,
    // ] = useLocalStorageState("notification-settings", {defaultValue:
    //   {
    //     "new-receive": true,
    //     "new-message": true,
    //     "price-alerts": true,
    //   }
    // });
    const {data: notificationSettings, mutate, isLoading } = useSWR("/config-notification", fetcherMessages);
    const [isGranted, setIsGranted] = useState(true);
    const { t } = useTranslation();


    async function updateNotificationSettings(key, value) {
      mutate({ ...notificationSettings, [key]: value }, false); // optimistic update
      let r = await fetcherMessagesPost("/config-notification", {key: key, value: value});
      mutate();
    }

    const ItemNotication = ({title, description, keyNotification}) => {

      if (isLoading) {
        return (
          <List.Item
            description={description}
            key={keyNotification}
            arrow={null}
            extra={<Switch checked={false} />}
          >
            {title}
          </List.Item>
        )
      }
      return (
        <List.Item
        description={description}
        disabled={!isGranted}
          key={keyNotification}
          arrow={null}
          extra={
            <Switch
              checked={isGranted && notificationSettings?.[keyNotification]}
              onChange={(checked) => {
                HapticsImpact({
                  style: ImpactStyle.Medium
                });
                updateNotificationSettings(keyNotification, checked)
              }
            }
            />
          }
        >
          {title}
        </List.Item>
      )
    }

    useEffect(() => {
      App.addListener('resume', () => {
        askPermission().then((isGranted) => { // refresh to check if the user has enabled notifications in the settings
                console.log({isGranted});
                setIsGranted(isGranted);
              });
      })
      askPermission().then((isGranted) => {
        console.log({isGranted});
        setIsGranted(isGranted);
      });
    }
    , []);


  return (
    <div>
        <NavBar
        className="app-navbar "
        onBack={() => {
          navigate("/me/settings");
        }}
        backArrow={true}>
          <span className="">{t('notificationSettings')}</span>
        </NavBar>

     <NotificationIsDisabled />
        <List mode="card">
        <ItemNotication
          title={t('newReceive')}
          description={t('newReceiveDesc')}
          keyNotification={"newReceive"}
        />
        <ItemNotication
          title={t('newChatRequest')}
          description={t('newChatRequestDesc')}
          keyNotification={"newMessage"}
        />
        <ItemNotication
          title={t('messagePreview')}
          description={t('messagePreviewDesc')}
          keyNotification={"messagePreview"}
        />    
        </List>
        <List mode="card" className="mt-4">
        <ItemNotication
          title={t('priceAlert')}
          description={t('priceAlertDesc')}
          keyNotification={"priceAlert"}
        />    
        </List>
    </div>
  )
}

export default NotificationSettings