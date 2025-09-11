
import { Button, Toast, CheckList, Modal, List, Input, Form, NavBar, Divider, Switch, DotLoading } from "antd-mobile";
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
import { useChats } from "../messaging/hooks/use-chats";
import { useWallet } from "../useWallet";
import { ChatName, ItemChat } from "../messaging/components/ItemChat";

function BlockedChats() {
    const navigate = useNavigate();
    const {activeAccount} = useWallet();
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
    // const {data: privacySettings, mutate, isLoading } = useSWR("/config-privacy", fetcherMessages);
    const {mutateChats} = useChats();
    const {data: chats, isLoading, mutate} = useSWR("/blocked-chats", fetcherMessages);

    // async function updatePrivacySettings(key, value) {
    //   mutate({ ...privacySettings, [key]: value }, false); // optimistic update
    //   let r = await fetcherMessagesPost("/config-privacy", {key: key, value: value});
    //   mutate();
    // }



  return (
    <div>
       <NavBar
        className="app-navbar "
        onBack={() => {
          navigate("/settings/security");
        }}
        backArrow={true}>
          <span className="">Blocked Accounts & Chats</span>
        </NavBar>
        {
          chats?.length === 0 && <div className="text-center mt-4 mb-4">
            No blocked chats
          </div>
        }
            <List
                          //  value={selectedAccounts}
                            >
                              {
                                isLoading ? <DotLoading /> : 
                              
                                   chats?.map(chat => (
                                      <ItemChat key={chat.id} chat={chat} onClick={() => {
                                        Modal.show({
                                          closeOnMaskClick: true,
                                          closeOnAction: true,
                                          title: <div>Unblock <ChatName chat={chat} activeAccount={activeAccount}/>?</div>,
                                          actions: [
                                            {
                                              key: "confirm",
                                              text: "Unblock",
                                              danger: true,
                                              onClick: async () => {
                                                await fetcherMessagesPost("/unblock-chat", {chatId: chat.id});
                                                await mutateChats();
                                                await mutate();
                                                Toast.show({icon: 'success'});
                                              }
                                            },
                                            {
                                              key: "cancel",
                                              text: "Cancel",
                                            },
                                          ]
                                        });
                                      }} />
                                   ))
                               }
                           </List>
    </div>
  )
}

export default BlockedChats