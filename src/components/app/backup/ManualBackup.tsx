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

function ManualBackup({visible, onClose}: {visible: boolean, onClose: () => void}) {
    const [seedVerified, setSeedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
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
                bodyStyle={{maxHeight: '100dvh', overflowY: 'auto'}}
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
                                    let modal = Modal.confirm({
                                        confirmText: 'Confirm',
                                        cancelText: 'Cancel',
                                        closeOnMaskClick: false,
                                        title: "Secret Phrase Verification",
                                        content: (
                                            <div>
                                                <div>
                                                    Verify that you correctly saved your recovery phrase by entering the #1, #8, #12 and #24 words below.
                                                </div>
                                                <Input autoComplete='off' id="word-1" placeholder="Word #1" className="mt-4" />
                                                <Input autoComplete='off' id="word-8" placeholder="Word #8" className="mt-4" />
                                                <Input autoComplete='off' id="word-12" placeholder="Word #12" className="mt-4" />
                                                <Input autoComplete='off' id="word-24" placeholder="Word #24" className="mt-4" />
                                            </div>
                                        ),
                                        onConfirm: () => {
                                            let word1 = (document.getElementById('word-1') as HTMLInputElement).value
                                            let word8 = (document.getElementById('word-8') as HTMLInputElement).value
                                            let word12 = (document.getElementById('word-12') as HTMLInputElement).value
                                            let word24 = (document.getElementById('word-24') as HTMLInputElement).value
                                            if (mnemonic.length === 128 && word1 === mnemonic) {
                                                Toast.show({
                                                    icon: "success",
                                                    content: "Secret Phrase Verified",
                                                });
                                                setSeedVerified(true)
                                            }
                                            else if (word1 === mnemonic.split(' ')[0] && word8 === mnemonic.split(' ')[7] && word12 === mnemonic.split(' ')[11] && word24 === mnemonic.split(' ')[23]) {
                                                Toast.show({
                                                    icon: "success",
                                                    content: "Secret Phrase Verified",
                                                });
                                                setSeedVerified(true)
                                            }
                                            else {
                                                Toast.show({
                                                    icon: "fail",
                                                    content: "Incorrect words entered. Make sure you saved your secret phrase correctly.",
                                                });
                                                throw new Error()
                                            }
                                        }
                                    });
                                }}
                                className="w-full mt-4"
                            >
                                Verify Secret Phrase
                            </Button>
                        }
                    </div>
                </div>
            </ResponsivePopup>
        </>
    )
}

export default ManualBackup

