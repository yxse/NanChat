import React, { useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList, { LedgerNotCompatible } from './ChatList';
import { socket } from '../socket';
import { LedgerContext, useWallet, WalletContext } from '../../Popup';
import { convertAddress } from '../../../utils/format';
import { AccountIcon } from '../../app/Home';
import { Button, Form, ImageUploader, Input, Modal, NavBar, Toast } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import { fetcherAccount, fetcherChat, fetcherMessages, fetcherMessagesPost, getNewChatToken } from '../fetcher';
import useSWR, { preload } from 'swr';
import { LockOutline } from 'antd-mobile-icons';
import { useHideNavbarOnMobile } from '../../../hooks/use-hide-navbar';
import { useChats } from '../hooks/use-chats';
import { PinAuthPopup } from '../../Lock/PinLock';
import { CreatePin } from '../../Lock/CreatePin';
import { isTauri } from '@tauri-apps/api/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import * as webauthn from '@passwordless-id/webauthn'
import { setSeed } from '../../../utils/storage';
import { wallet as walletLib } from "multi-nano-web";
import { initWallet } from '../../../nano/accounts';
import { networks } from '../../../utils/networks';
import { ProfilePictureUploadButton } from './icons/ProfilePictureUploadButton';
import ReusableImageUploader from './profile/reusable-image-uploader';

const Register: React.FC = ({setW, onCreated, setWalletState}) => {
    // const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {mutateChats} = useChats();
    const [pinVisible, setPinVisible] = useState(false);
    const [createPinVisible, setCreatePinVisible] = useState(false);
    const {dispatch, wallet, activeAccount, activeAccountPk} = useWallet();
    const [name, setName] = useState<string>("");
    const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);
    const [currentAvatar, setCurrentAvatar] = useState(null);
    const [skip, setSkip] = useState(false);
    useHideNavbarOnMobile(true);
    useEffect(() => {
        const generatedWallet = walletLib.generateLegacy()
        for (let ticker of Object.keys(networks)) {
          dispatch({ type: "ADD_WALLET", payload: { ticker, wallet: initWallet(ticker, generatedWallet.seed, mutate, dispatch) } });
        }
        setSeed(generatedWallet.seed, false).then(async () => {
        })
        getNewChatToken(generatedWallet.accounts[0].address, generatedWallet.accounts[0].privateKey)
      }, []);

      const authRegisterCanceled = ({}) => {
        let modal = Modal.show({
            title: "Biometrics authentication canceled",
            closeOnMaskClick: false,
            closeOnAction: false,
            content: 'You canceled the biometrics authentication. Do you want to try again or create a PIN Code?',
            actions: [
              {
                key: "settings", text: "Try again", onClick: async () => {
                    modal.close()
                }
              },
              {
                key: "cancel", text: "Create PIN Code", onClick: async () => {
                    modal.close()
                    setPinVisible(false)
                    setCreatePinVisible(true)
                    localStorage.setItem('confirmation-method', '"pin"')
                }
    }]
})
}
const register = async () => {
    if (skip){
        setWalletState("unlocked");
        onCreated({callback: "/wallet"});
        preload('/services', fetcherChat);
        return
    }
    Toast.show({icon: 'loading'});
                    await setSeed(wallet.wallets["XNO"].seed, false)
        fetcherMessagesPost('/set-name', {
            name: name,
            account: activeAccount
        }).then(async (res) => {
            console.log(res);
            // Toast.show({icon: 'success'});
            await mutate({name: name});
            await mutateChats(); // preload chats
                // navigate('/chat');
                // setW(3);
                setWalletState("unlocked");
                onCreated()
                Toast.show({icon: 'success'})
                preload('/services', fetcherChat);
        }).catch((err) => {
            console.log(err);
            Toast.show({icon: 'fail', content: err.message});
        })
    }
 const handleProfilePictureSuccess = (data) => {
    setCurrentAvatar(data.url);
    mutate();
  };

  const enablePin = async () => {
    if (Capacitor.isNativePlatform()) { // on native version, we skip password encryption since secure storage is already used
        let biometricAuth = await BiometricAuth.checkBiometry()
        let webauthnAuth = webauthn.client.isAvailable()
        
        // Toast.show({icon: "success", content: biometricAuth.strongBiometryIsAvailable})
        // const hasStrongAuth = biometricAuth.strongBiometryIsAvailable || webauthnAuth
        const hasStrongAuth = biometricAuth.strongBiometryIsAvailable
        if (hasStrongAuth){
          localStorage.setItem('confirmation-method', '"enabled"')
          setPinVisible(true)
        }
        else{
          localStorage.setItem('confirmation-method', '"pin"')
          setCreatePinVisible(true)
        }
      }
      else{
        setW(2)
      }
    }
    return (
        <div>
            <NavBar
                            onBack={() => setW(0)}
                            // onBack={() => navigate('/me')}
                    className="app-navbar "
                    backArrow={true}>
                      Create an account
                    </NavBar>
        <div className="flex flex-col items-center justify-center h-full">
            <div style={{margin: 16}}>
       
        <ReusableImageUploader
        showButton={false}
        endpoint="/upload/upload-profile-picture"
        additionalFormData={{ account: activeAccount }}
        onUploadSuccess={handleProfilePictureSuccess}
        buttonText="Upload Profile Picture"
        loadingText="Uploading..."
      />
        </div>
            <Form 
            style={{width: '100%', maxWidth: 500}}
            initialValues={{name: me?.name}}
            mode='card'
            onFinish={async (values) => {
                setName(values.name)
                enablePin()
            }}

            footer={
                <>
                <div style={{textAlign: "center"}}>
                <Button 
                shape='rounded'
                className='w-full'
                // style={{width: 128}}
                type='submit' color='primary' size='large'>
                   Next
                </Button>
                <div 
                onClick={() => {
                    enablePin()
                    setSkip(true)
                }}
                style={{marginTop: 48, color: "var(--adm-color-primary)", cursor: "pointer"}}>
                    Skip to wallet
                    </div>
                </div>
                    </>
            }>
                
                <Form.Item
                rules={[{required: true, min: 1, max: 24, message: 'Name must be between 1 and 24 characters'}]}
                 extra='' name={'name'}>
                    <Input
                    enterKeyHint='next'
                    clearable
                    autoFocus
                        placeholder="Name"
                    />
                </Form.Item>
            </Form>
            </div>
             <PinAuthPopup
             onCancel={() => {
                authRegisterCanceled({})
             }}
                  location={"create-wallet"}
                  visible={pinVisible}
                  setVisible={setPinVisible}
                  onAuthenticated={async () => {
                    await register()
                  }
                  } />
                  <CreatePin visible={createPinVisible} setVisible={setCreatePinVisible} onAuthenticated={async () => {
                    await register()
                  }
                  } />
            </div>
    );
};


export default Register;