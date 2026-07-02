
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
import { askPermission, checkPermissionGranted } from "../../nano/notifications";
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import useSWR from "swr";
import { fetcherChat, fetcherMessages, fetcherMessagesPost } from "../messaging/fetcher";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { HapticsImpact } from "../../utils/haptic";
import { useTranslation } from 'react-i18next';
import { App } from "@capacitor/app";

function NotificationIsDisabled() {

    const [isGranted, setIsGranted] = useState(true);
    const { t } = useTranslation();

    useEffect(() => {
      const listenerPromise = App.addListener('resume', () => {
        checkPermissionGranted().then((isGranted) => {
          console.log({isGranted});
          setIsGranted(isGranted);
        });
      });
      askPermission().then((isGranted) => {
        console.log({isGranted});
        setIsGranted(isGranted);
      });
      return () => { listenerPromise.then((l) => l.remove()); };
    }, []);


    if (isGranted) return null
  return (
    <div>
      {
        !isGranted && (
          <div>
            <div className="text-center text-lg mt-4">
                {t('notificationsDisabled')}
            </div>
            <div className="text-center text-sm mb-4">
            {
              Capacitor.getPlatform() === "web" ? (
                  <p>
                    {t('enableNotificationsBrowser')}
                  </p>
              ) : (
                  <p>
                    {t('enableNotificationsDevice')}
                    <div>
                      <Button onClick={() => {
                        NativeSettings.open({
                          optionAndroid: AndroidSettings.AppNotification,
                          optionIOS: IOSSettings.AppNotification
                        })
                      }}>{t('enableNotifications')}</Button>
                    </div>
                  </p>
              )
            }
            </div>
          </div>
        )
      }
       
    </div>
  )
}

export default NotificationIsDisabled