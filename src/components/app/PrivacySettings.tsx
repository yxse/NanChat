
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

function PrivacySettings() {
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
    const {data: privacySettings, mutate, isLoading } = useSWR("/config-privacy", fetcherMessages);

    async function updatePrivacySettings(key, value) {
      mutate({ ...privacySettings, [key]: value }, false); // optimistic update
      let r = await fetcherMessagesPost("/config-privacy", {key: key, value: value});
      mutate();
    }



  return (
    <div>
 
        <List mode="card">
            <List.Item
            extra={privacySettings?.lastOnline || "everyone"}
            onClick={() => {
              Modal.show({
                closeOnMaskClick: true,
                title: "Who can see my last seen time?",
                content: (
                  <div>
                    <CheckList
                    defaultValue={[privacySettings?.lastOnline || "everyone"]}
                    onChange={(val) => {
                        if (val.length === 0) {
                          return;
                        }
                    }
                    }>
                      <CheckList.Item
                      value={"everyone"}
                      onClick={async () => {
                        updatePrivacySettings("lastOnline", "everyone")
                        Modal.clear()
                        }}
                      >
                        Everyone
                      </CheckList.Item>
                      <CheckList.Item 
                      value={"nobody"}
                      onClick={async () => {
                        updatePrivacySettings("lastOnline", "nobody")
                        Modal.clear()
                        }}>
                        Nobody
                        </CheckList.Item>
                        </CheckList>
                    </div>
                ),
              });

            }}
            >
                Last seen & online status
            </List.Item>
            </List>
    </div>
  )
}

export default PrivacySettings