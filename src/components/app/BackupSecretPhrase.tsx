import { Badge, Button, Input, List, Modal, Popup, Space, Toast } from 'antd-mobile'
import { wallet as walletLib } from 'multi-nano-web';
import React, { useContext, useState } from 'react'
import { MdBackup, MdCloud, MdOutlineSettingsBackupRestore } from 'react-icons/md'
import { CopyButton } from './Icons';
import { MnemonicWords } from '../Initialize/create/Mnemonic';
import { saveAs } from 'file-saver';
import useLocalStorageState from 'use-local-storage-state';
import { WalletContext } from '../Popup';
import { authenticate } from '../../utils/biometrics';
import { PinAuthPopup } from '../Lock/PinLock';
import { ResponsivePopup } from '../Settings';
import { DownlandOutline, EditSOutline, ExclamationCircleOutline, FingerdownOutline } from 'antd-mobile-icons';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { encrypt } from '../../worker/crypto';
import ManualBackup from './backup/ManualBackup';
import { AiFillAndroid, AiFillApple } from 'react-icons/ai';
import { PasswordForm } from '../Initialize/create/Password';
import { Capacitor } from '@capacitor/core';
import { backupWallet, backupWalletGoogleDrive, backupWalletICloud } from '../../services/capacitor-chunked-file-writer';

function getTimestampFilename() {
  const now = new Date();
  
  // Get components with padding for single digits
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  // Format as yyyy-mm-dd-hh-mm.txt
  const filename = `${year}-${month}-${day}-${hours}-${minutes}-nanchat-backup.txt`;
  
  return filename;
}

function BackupSecretPhrase() {
    const [seedVerified, setSeedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
    const [visible, setVisible] = useState(false);
    const [pinVisible, setPinVisible] = useState(true);
    const [isRevealed, setIsRevealed] = useState(false);
    const [backupType, setBackupType] = useState<'manual' | 'cloud' | 'encrypted-file' | null>(null)
    const [backupVisible, setBackupVisible] = useState(false);
    const [backupTypeVisible, setBackupTypeVisible] = useState(false);
    const {wallet} = useContext(WalletContext)
    let mnemonic = ""
    // let seed = localStorage.getItem('masterSeed')
    let seed = wallet?.wallets['XNO']?.seed
    if (seed == null) {
        return null
    }
    if (seed === null) {
        seed = ""
    }
    else if (seed.length === 128) { // non-legacy seed doesn't have a mnemonic, display the raw seed instead
        mnemonic = seed
    }
    else {
        mnemonic = walletLib.fromLegacySeed(seed).mnemonic
    }

    const icon = seedVerified ? <MdOutlineSettingsBackupRestore size={24} /> : <Badge content={Badge.dot}><MdOutlineSettingsBackupRestore size={24} /></Badge>
   

   let iconDownloadBackup = <DownlandOutline />
   let text = "Download backup file"
   if (Capacitor.getPlatform() === 'ios') {
    iconDownloadBackup = <AiFillApple />
    text='Backup on iCloud'
   }
   else if (Capacitor.getPlatform() === 'android') {
    iconDownloadBackup = <AiFillAndroid />
    text='Backup on Google Drive'
   }
   

    return (
        <>
      <ResponsivePopup
                visible={backupVisible && backupType === 'encrypted-file'}
                closeOnMaskClick
                destroyOnClose
                showCloseButton
                onClose={() => {
                    setBackupType(null)
                    setBackupVisible(false)
                    setVisible(true)
                }}
                bodyStyle={{maxHeight: '100dvh', overflowY: 'auto'}}
            >
                <div className="p-4">
                    <div className="text-xl text-center py-2">
                        Create Password
                    </div>
<div>
                            This password will encrypt your secret phrase file. 
                            <div style={{color: 'var(--adm-color-warning)'}}>
                            Do not lose your password or your backup will be unrecoverable.
                            </div>
                            <PasswordForm
                            onFinish={async (values) => {

                                let encryptedSeed = await encrypt(seed, values.password)
                                let fileName = getTimestampFilename()
                                Toast.show({
                                    icon: 'loading',
                                    duration: 0,
                                })
                                let success = false
                                try {
                                    if (Capacitor.getPlatform() === 'ios') {
                                        let uri = await backupWalletICloud(encryptedSeed, fileName)
                                        if (uri) {
                                            success = true
                                        }
                                    }
                                else if (Capacitor.getPlatform() === 'android') {
                                    await backupWalletGoogleDrive(encryptedSeed, fileName)
                                    success = true
                                }
                                else {
                                    const blob = new Blob([encryptedSeed], { type: 'text/plain;charset=utf-8' });
                                    saveAs(blob, fileName);
                                    success = true
                                }

                                if (success) {
                                        Toast.show({
                                            icon: 'success',
                                        });
                                        setBackupVisible(false)
                                        setBackupType(null)
                                        setVisible(false)
                                    }
                                    else {
                                        Toast.show({
                                            icon: 'fail',
                                            content: 'Failed to backup secret phrase.',
                                        });
                                    }
                                }
                                catch (error) {
                                    Toast.show({
                                        icon: 'fail',
                                        content: 'Failed to backup secret phrase.',
                                    });
                                }
                            }}
                            buttonText={text}
                        />
                        </div></div>
            </ResponsivePopup>
        <ResponsivePopup
            bodyStyle={{maxHeight: '100dvh', overflowY: 'auto'}}
            destroyOnClose
            visible={visible}
            onClose={() => {
                setVisible(false)
                setBackupType(null)
                setBackupVisible(false)
                setBackupTypeVisible(false)
            }}
        >
             <PinAuthPopup
                location={"backup-secret-phrase"}
                description={"Backup secret phrase"}
                visible={pinVisible} 
                setVisible={setPinVisible} 
                onAuthenticated={() => {
                    setBackupVisible(true)
                }} 
            />
            <div className="p-2" style={{color: 'var(--adm-color-text-secondary)'}}>
                Backup your wallet
            </div>
           
            <List style={{marginTop: 16, marginBottom: 16}}>
    
                <List.Item prefix={iconDownloadBackup} onClick={async () => {
                    setBackupType('encrypted-file')
                    setBackupVisible(true)
                    setVisible(false)
                    
                    // const blob = new Blob([mnemonic], { type: 'text/plain;charset=utf-8' });
                    // saveAs(blob, 'cesium-secret-phrase.txt');
                }}>
                    {text}
                </List.Item>
                
                <List.Item prefix={<EditSOutline />} onClick={() => {
                    setBackupType('manual')
                    setBackupVisible(true)
                }}>
                    Write down secret phrase
                </List.Item>
            </List>
            <div className="text-sm p-2" style={{color: 'var(--adm-color-text-secondary)', marginBottom: 32}}>
                It is recommended to complete both backup options to help prevent loss of funds.
            </div>

        </ResponsivePopup>
        <List.Item prefix={icon} onClick={() => {
                setVisible(true)
            }}>
                Backup Wallet
            </List.Item>
            
     <ManualBackup
        visible={backupVisible && backupType === 'manual'}
        onClose={() => {
            setBackupVisible(false)
        }}
      />
                    
                   
                    {/* Modal.confirm({
                        closeOnMaskClick: true,
                        title: 'Do not lose your password',
                        content: 'Secret phrase will be encrypted with your wallet password. Do not lose your password or secret phrase will be unrecoverable.',
                        confirmText: <Space align="center">
                            <DownlandOutline />
                            Download Encrypted Secret Phrase
                        </Space>,
                        cancelText: 'Cancel',

                    }) */}

        </>
    )
}

export default BackupSecretPhrase