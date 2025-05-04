
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
      askPermission().then((isGranted) => {
        console.log({isGranted});
        setIsGranted(isGranted);
      }
      );
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
          <span className="">Notification Settings</span>
        </NavBar>

      {
        !isGranted && (
          <div>
            <div className="text-center text-lg mt-4">
                Notifications are disabled.
            </div>
            <div className="text-center text-sm mb-4">
            {
              Capacitor.getPlatform() === "web" ? (
                  <p>
                    You need to enable notifications for NanChat in your browser settings.
                  </p>
              ) : (
                  <p>
                    You need to enable notifications for NanChat in your device settings.
                    <div>
                      <Button onClick={() => {
                        // setInterval(() => {
                        //   askPermission().then((isGranted) => {
                        //     console.log({isGranted});
                        //     setIsGranted(isGranted);
                        //   }
                        //   );
                        //   }, 5000); // refresh every 5 seconds to check if the user has enabled notifications in the settings
                        // NativeSettings.open({
                        //   optionAndroid: AndroidSettings.AppNotification,
                        //   optionIOS: IOSSettings.AppNotification
                        // })
                      }}>Enable Notifications</Button>
                    </div>
                  </p>
              )
            }
            </div>
          </div>
        )
      }
        <List mode="card">
        <ItemNotication
          title={"New receive"}
          description={"Get notified when you receive a new transaction"}
          keyNotification={"newReceive"}
        />
        <ItemNotication
          title={"New message"}
          description={"Get notified when you receive a new end-to-end encrypted message"}
          keyNotification={"newMessage"}
        />
        <ItemNotication
          title={"Message preview"}
          description={"Decrypt messages locally and show a preview. Enabling this may reduce the reliability of notification delivery."}
          keyNotification={"messagePreview"}
        />    
        </List>
        <List mode="card" className="mt-4">
        <ItemNotication
          title={"Price alert"}
          description={"Get notified of large price changes"}
          keyNotification={"priceAlert"}
        />    
        </List>
    </div>
  )
}

export default NotificationSettings