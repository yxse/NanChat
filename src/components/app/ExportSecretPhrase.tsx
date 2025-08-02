import { Badge, Button, Divider, DotLoading, Input, List, Modal, Popup, Space, Toast } from 'antd-mobile'
import { wallet as walletLib } from 'multi-nano-web';
import React, { useContext, useEffect, useState } from 'react'
import { MdBackup, MdCloud, MdOutlineSettingsBackupRestore } from 'react-icons/md'
import { CopyButton } from './Icons';
import { MnemonicWords } from '../Initialize/create/Mnemonic';
import { saveAs } from 'file-saver';
import useLocalStorageState from 'use-local-storage-state';
import { useWallet, WalletContext } from '../Popup';
import { authenticate } from '../../utils/biometrics';
import { PinAuthPopup } from '../Lock/PinLock';
import { ResponsivePopup } from '../Settings';
import { DownlandOutline, EditSOutline, ExclamationCircleOutline, EyeFill, EyeInvisibleFill, FingerdownOutline, UploadOutline } from 'antd-mobile-icons';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { encrypt, decrypt } from '../../worker/crypto';
import ManualBackup from './backup/ManualBackup';
import { AiFillAndroid, AiFillApple } from 'react-icons/ai';
import { PasswordForm } from '../Initialize/create/Password';
import { Capacitor } from '@capacitor/core';
import { backupWallet, backupWalletGoogleDrive, backupWalletICloud } from '../../services/capacitor-chunked-file-writer';
import { ImportFromFile } from '../Initialize/restore/ImportFromFile';
import { PasswordImport } from '../Initialize/restore/PasswordImport';
import { ImportFromGoogleDrive } from '../Initialize/restore/ImportFromGoogleDrive';
import { ImportFromICloud } from '../Initialize/restore/ImportFromICloud';
import { generateSecurePassword, SeedVerifiedBadge } from '../messaging/utils';
import { convertAddress } from '../../utils/format';
import { QRCodeSVG } from 'qrcode.react';
import IOSPasswordInput from './backup/PasswordInputExportNewDevice';
import { useTranslation } from 'react-i18next';


function EncryptedSeedQrCode() {
    const { wallet } = useWallet()
    const seed = wallet?.wallets['XNO']?.seed
    // we generate a secure password to encrypt the seed in order to not expose the raw seed directly in the QRCode which could be scanned by a malicious app or that could stay in history
    const [encryptionPassword] = useState(() => generateSecurePassword()) 
    const [seedEncrypted, setSeedEncrypted] = useState<string | null>(null)
    const [isRevealed, setIsRevealed] = useState(false)
    useEffect(() => {
        encrypt(seed, encryptionPassword).then((encrypted) => {
            setSeedEncrypted(encrypted)
        })
    }, [])

    const { t } = useTranslation();

    if (!seedEncrypted) {
        return <DotLoading />
    }
    return (
        <div className="p-2">
            
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <QRCodeSVG 
            includeMargin={true}
            value={seedEncrypted} size={256} />
            </div>
            <div className="p-2 text-center" style={{  }}>
                {t('selectImportAccountInstruction')}
            </div>
            <div 
            onClick={() => {
                setIsRevealed(!isRevealed)  
            }}
            className="text-xl text-center my-4" style={{  }}>
                <span style={{ 
                    fontFamily: 'monospace',
                 }}>
                    {isRevealed ? encryptionPassword : '******-******-******'}
                </span>

            <div className="mt-2 cursor-pointer text-base text-center w-full" onClick={() => {
                setIsRevealed(!isRevealed)
            }}>
                    {isRevealed ? 
                    <div className="flex items-center gap-2 justify-center">
                      <EyeInvisibleFill /> 
                      {t('clickToHide')}
                    </div>
                    :
                    <div className="flex items-center gap-2 justify-center">
                      <EyeFill /> 
                      {t('clickToReveal')}
                    </div>
                    }
                     
                </div>
            </div>
        </div>
    )
}


function ExportSecretPhrase() {
    
    const [visible, setVisible] = useState(false);
    const [pinVisible, setPinVisible] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [backupType, setBackupType] = useState<'manual' | 'cloud' | 'encrypted-file' | null>(null)
    const [backupVisible, setBackupVisible] = useState(false);
    const [backupTypeVisible, setBackupTypeVisible] = useState(false);
    const [passwordImportVisible, setPasswordImportVisible] = useState(false);
    const [encryptedSeed, setEncryptedSeed] = useState<string | null>(null);

    const { t } = useTranslation();


    return (
        <>
 <PinAuthPopup
                    location={"backup-secret-phrase"}
                    description={"Backup secret phrase"}
                    visible={pinVisible}
                    setVisible={setPinVisible}
                    onAuthenticated={() => {
                        setVisible(true)
                       
                    }}
                />
            <ResponsivePopup
            showCloseButton={true}
                bodyStyle={{ maxHeight: '100vh', overflowY: 'auto' }}
                destroyOnClose
                visible={visible}
                onClose={() => {
                    setVisible(false)
                    setBackupType(null)
                    setBackupVisible(false)
                    setBackupTypeVisible(false)
                }}
            >
                <div className="p-2 mt-2 text-xl text-center">
                 {t('exportAccountToAnotherDevice')}
                </div>
               
                <EncryptedSeedQrCode />
                <div className="p-2" style={{ color: 'var(--adm-color-warning)', marginBottom: 32 }}>
                    {t('doNotShareQrCodeWarning')}
                </div>
            </ResponsivePopup>
            <List.Item
             prefix={ <UploadOutline fontSize={24} />} onClick={() => {
                setPinVisible(true)
            }}>
                {t('exportToAnotherDevice')}
            </List.Item>
          
           

        </>
    )
}


export default ExportSecretPhrase