import { Badge, Button, Divider, Input, List, Modal, Popup, Space, Toast } from 'antd-mobile'
import { wallet as walletLib } from 'multi-nano-web';
import React, { useContext, useState } from 'react'
import { MdBackup, MdCloud, MdOutlineSettingsBackupRestore } from 'react-icons/md'
import { CopyButton } from './Icons';
import { MnemonicWords } from '../Initialize/create/Mnemonic';
import { saveAs } from 'file-saver';
import useLocalStorageState from 'use-local-storage-state';
import { useWallet, WalletContext } from '../Popup';
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
import { ImportFromFile } from '../Initialize/restore/ImportFromFile';
import { PasswordImport } from '../Initialize/restore/PasswordImport';
import { ImportFromGoogleDrive } from '../Initialize/restore/ImportFromGoogleDrive';
import { ImportFromICloud } from '../Initialize/restore/ImportFromICloud';

function getTimestampFilename() {
    const now = new Date();

    // Get components with padding for single digits
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // Format as yyyy-mm-dd-hh-mm.txt
    const filename = `${year}-${month}-${day}-${hours}-${minutes}`;

    return filename;
}

function BackupSecretPhrase() {
    const [seedVerified, setSeedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
    const [backupActive, setBackupActive] = useLocalStorageState('backupActive', {
        defaultValue: {
            manual: false,
            icloud: false,
            googleDrive: false,
            encryptedFile: false
        }
    })
    const [visible, setVisible] = useState(false);
    const [pinVisible, setPinVisible] = useState(true);
    const [isRevealed, setIsRevealed] = useState(false);
    const [backupType, setBackupType] = useState<'manual' | 'cloud' | 'encrypted-file' | null>(null)
    const [backupVisible, setBackupVisible] = useState(false);
    const [backupTypeVisible, setBackupTypeVisible] = useState(false);
    const [passwordImportVisible, setPasswordImportVisible] = useState(false);
    const [encryptedSeed, setEncryptedSeed] = useState<string | null>(null);
    const { activeAccount } = useWallet()
    const { wallet } = useContext(WalletContext)
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
    let textList = "Download"
    let textSave = "Download"
    const BackupNow = <div style={{ color: 'var(--adm-color-primary)' }}>Backup now</div>
    let description = backupActive.encryptedFile ? 'Active' : BackupNow
    let passwordBackupActive = backupActive.encryptedFile
    if (Capacitor.getPlatform() === 'ios') {
        iconDownloadBackup = <AiFillApple />
        textList = 'iCloud'
        textSave = 'Save to iCloud'
        description = backupActive.icloud ? 'Active' : BackupNow
        passwordBackupActive = backupActive.icloud
    }
    else if (Capacitor.getPlatform() === 'android') {
        iconDownloadBackup = <AiFillAndroid />
        textList = 'Google Drive'
        textSave = 'Save to Google Drive'
        description = backupActive.googleDrive ? 'Active' : BackupNow
        passwordBackupActive = backupActive.googleDrive
    }


    const handleVerifyWallet = (encryptedSeed: string) => {
        setPasswordImportVisible(true)
        setEncryptedSeed(encryptedSeed)
    }

    return (
        <>

            <ResponsivePopup
                bodyStyle={{ maxHeight: '100dvh', overflowY: 'auto' }}
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
                <div className="p-2 mt-2" style={{ color: 'var(--adm-color-text-secondary)' }}>
                    {
                        !seedVerified ? <>
                            <Badge content={Badge.dot} style={{ marginRight: 8 }}>
                            </Badge>
                            Backup your wallet
                        </>

                            : "Backup your wallet"
                    }
                </div>

                <List style={{ marginTop: 16, marginBottom: 16 }}>

                    <List.Item
                        description={description}
                        prefix={iconDownloadBackup} onClick={async () => {
                            setBackupType('encrypted-file')
                            setBackupVisible(true)
                            // setVisible(false)

                            // const blob = new Blob([mnemonic], { type: 'text/plain;charset=utf-8' });
                            // saveAs(blob, 'cesium-secret-phrase.txt');
                        }}>
                        {textList}
                    </List.Item>

                    <List.Item
                        description={backupActive.manual ? 'Active' : BackupNow}
                        prefix={<FingerdownOutline />} onClick={() => {
                            setBackupType('manual')
                            setBackupVisible(true)
                        }}>
                        Manual
                    </List.Item>
                </List>
                <div className="text-sm p-2" style={{ color: 'var(--adm-color-text-secondary)', marginBottom: 32 }}>
                    It is recommended to complete both backup options to help prevent loss of funds.
                </div>


            </ResponsivePopup>
            <List.Item prefix={icon} onClick={() => {
                setVisible(true)
            }}>
                Backup Wallet
            </List.Item>
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
                bodyStyle={{ maxHeight: '100dvh', overflowY: 'auto' }}
            >

                {
                    !passwordBackupActive ?
                        <BackupWithPassword setBackupVisible={setBackupVisible} setBackupType={setBackupType} setVisible={setVisible} text={textSave} /> :
                        <div>
                            
                            <div className="flex flex-col gap-2 p-4 mt-4 mb-4">
                                {
                                    Capacitor.getPlatform() === "web" &&
                                    <div className="flex flex-col gap-2">
                                        <ImportFromFile onWalletSelected={handleVerifyWallet} mode="verify" />
                                    </div>
                                }
                                {
                                    Capacitor.getPlatform() === "ios" &&
                                    <div className="flex flex-col" style={{ gap: 16 }}>
                                        <ImportFromICloud onWalletSelected={handleVerifyWallet} mode="verify" />
                                        <ImportFromICloud onWalletSelected={() => {
                                            setBackupActive({ ...backupActive, icloud: false })
                                            setBackupVisible(false)
                                        }} mode="delete" />
                                    </div>
                                }
                                {
                                    Capacitor.getPlatform() === "android" &&
                                    <div className="flex flex-col gap-2">
                                        <ImportFromGoogleDrive onWalletSelected={handleVerifyWallet} mode="verify" />
                                        <ImportFromGoogleDrive onWalletSelected={() => {
                                            setBackupActive({ ...backupActive, googleDrive: false })
                                            setBackupVisible(false)
                                        }} mode="delete" />
                                    </div>
                                }
                            </div>
                        </div>
                }
            </ResponsivePopup>
            <ManualBackup
                setVisible={setBackupVisible}
                visible={backupVisible && backupType === 'manual'}
                onClose={() => {
                    setBackupVisible(false)
                    setBackupType(null)

                }}
            />

            <PasswordImport
                mode="verify"
                visible={passwordImportVisible}
                onClose={() => {
                    setPasswordImportVisible(false)
                }}
                encryptedSeed={encryptedSeed}
                onImportSuccess={(importedSeed) => {
                    console.log({ importedSeed })
                    console.log({ seed })
                    if (importedSeed === seed) {
                        Toast.show({
                            icon: 'success',
                            content: 'Backup file verified.',
                            duration: 5000,
                        });
                        setPasswordImportVisible(false)
                        setBackupVisible(false)
                    }
                    else {
                        Toast.show({
                            icon: 'fail',
                            content: 'Backup file does not match your wallet secret phrase.',
                            duration: 5000,
                        });
                    }
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



const BackupWithPassword = ({ setBackupVisible, setBackupType, setVisible, text }: { setBackupVisible: any, setBackupType: any, setVisible: any }) => {
    const { activeAccount } = useWallet()
    const { wallet } = useContext(WalletContext)
    let seed = wallet?.wallets['XNO']?.seed
    if (seed == null) {
        return null
    }
    const [backupActive, setBackupActive] = useLocalStorageState('backupActive', {
        defaultValue: {
            manual: false,
            icloud: false,
            googleDrive: false,
            encryptedFile: false
        }
    })

    return (
        <div className="">
            <div className="text-2xl text-center p-2">
                Create Password
            </div>
            <div className='p-2 mb-2 text-center'>
                This password will encrypt your secret phrase file.
                <div style={{ color: 'var(--adm-color-warning)' }}>
                    Do not lose your password or your backup will be unrecoverable.
                </div>
                <PasswordForm
                    onFinish={async (values) => {

                        let encryptedSeed = await encrypt(seed, values.password)
                        let fileName = 'nanchat-backup-' + getTimestampFilename() + '-' + activeAccount?.replace('nano_', '').slice(0, 8) + '.txt'
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
                                    setBackupActive({ ...backupActive, icloud: true })
                                }
                            }
                            else if (Capacitor.getPlatform() === 'android') {
                                await backupWalletGoogleDrive(encryptedSeed, fileName)
                                success = true
                                setBackupActive({ ...backupActive, googleDrive: true })
                            }
                            else {
                                const blob = new Blob([encryptedSeed], { type: 'text/plain;charset=utf-8' });
                                saveAs(blob, fileName);
                                success = true
                                setBackupActive({ ...backupActive, encryptedFile: true })
                            }

                            if (success) {
                                Toast.show({
                                    icon: 'success',
                                });
                                setBackupVisible(false)
                                setBackupType(null)

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
            </div>


        </div>
    )
}

export default BackupSecretPhrase