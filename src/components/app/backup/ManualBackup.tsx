import { Badge, Button, Input, List, Modal, Toast } from 'antd-mobile'
import { wallet as walletLib } from 'multi-nano-web';
import React, { useContext, useState } from 'react'
import { MdOutlineSettingsBackupRestore } from 'react-icons/md'
import { MnemonicWords } from '../../Initialize/create/Mnemonic';
import useLocalStorageState from 'use-local-storage-state';
import { WalletContext } from '../../Popup';
import { PinAuthPopup } from '../../Lock/PinLock';
import { ResponsivePopup } from '../../Settings';
import { ExclamationCircleOutline } from 'antd-mobile-icons';
import { MnemonicInput } from '../../Initialize/restore/MnemonicInput';

function ManualBackup({visible, onClose, setVisible}: {visible: boolean, onClose: () => void, setVisible: (visible: boolean) => void}) {
    const [seedVerified, setSeedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
    const [backupActive, setBackupActive] = useLocalStorageState('backupActive', {
        defaultValue: {
            manual: false,
            icloud: false,
            googleDrive: false,
            encryptedFile: false
        }
    })
    const [seedVerifyVisible, setSeedVerifyVisible] = useState(false)
    const walletContext = useContext(WalletContext);
    const wallet = walletContext ? walletContext.wallet : null;
    
    let mnemonic = ""
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

    return (
        <>
            
            <ResponsivePopup
                bodyStyle={{maxHeight: '100dvh', overflowY: 'auto', zIndex: 1000}}
                destroyOnClose
                showCloseButton
                visible={visible}
                onClose={onClose}
                closeOnMaskClick
                closeOnSwipe
            >
                <div className="text-2xl text-center p-2">
                    Backup Secret Phrase
                </div>
                <div className="p-2 mb-2" style={{ color: 'var(--adm-color-warning)', textAlign: 'center' }}>
                    <ExclamationCircleOutline style={{display: 'inline-block', marginRight: 4}} />
                    Never share your secret phrase. Anyone with access to your secret phrase can steal your funds. Write it down and store it securely.
                </div>
                <div className="text-center p-2 mb-4">
                    <MnemonicWords 
                        mnemonic={mnemonic} 
                        defaultIsRevealed={false} 
                        showHideButton 
                        colorCopy={false} 
                    />
                    <div>
                        {
                            !seedVerified &&
                            <Button
                                shape='rounded'
                                color='primary'
                                size="large"
                                onClick={() => {
                                    setSeedVerifyVisible(true)
                                }}
                                className="w-full mt-4"
                            >
                                Verify Secret Phrase
                            </Button>
                        }
                    </div>
                </div>
            </ResponsivePopup>
            <ResponsivePopup
                visible={seedVerifyVisible}
                onClose={() => setSeedVerifyVisible(false)}
                closeOnMaskClick
                closeOnSwipe
                showCloseButton
                bodyStyle={{maxHeight: '90dvh', overflowY: 'auto'}}
            >
                <div className='p-4'>
                    <div className='mb-4'>
                        Verify that you correctly saved your secret phrase by entering it below.
                    </div>
                <MnemonicInput mode="verify" onImport={(mnemonicInputs) => {
                    // verify mnemonic is same as seed
                    if (mnemonicInputs.join(' ') === mnemonic) {
                        Toast.show({
                            icon: "success",
                            content: "Secret Phrase Verified",
                        })
                        setSeedVerified(true)
                        setSeedVerifyVisible(false)
                        setBackupActive({...backupActive, manual: true})
                        setVisible(false)
                    }
                    else {
                        Toast.show({
                            icon: "fail",
                            content: "Incorrect words entered. Make sure you saved your secret phrase correctly.",
                        })
                    }
                }}  />
                </div>
            </ResponsivePopup>
        </>
    )
}

export default ManualBackup

