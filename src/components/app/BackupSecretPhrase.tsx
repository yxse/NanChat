import { Badge, Button, Input, List, Modal, Popup, Toast } from 'antd-mobile'
import { wallet as walletLib } from 'multi-nano-web';
import React, { useContext, useState } from 'react'
import { MdBackup, MdOutlineSettingsBackupRestore } from 'react-icons/md'
import { CopyButton } from './Icons';
import { MnemonicWords } from '../Initialize/create/Mnemonic';
import { saveAs } from 'file-saver';
import useLocalStorageState from 'use-local-storage-state';
import { WalletContext } from '../Popup';
function BackupSecretPhrase() {
    const [seedVerified, setSeedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })
    const [visible, setVisible] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
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
   
    return (
        <>
            <List.Item prefix={icon} onClick={() => setVisible(true)}>
                Backup Secret Phrase
            </List.Item>
            <Popup
                showCloseButton
                visible={visible}
                onClose={() => setVisible(false)}
                closeOnMaskClick
                closeOnSwipe
            >
                <div className="text-2xl  text-center p-2">
                    Backup Secret Phrase
                </div>
                <div className="text-center p-2 mb-4">
                    <MnemonicWords mnemonic={mnemonic} defaultIsRevealed={false} showHideButton colorCopy={seedVerified ? "primary" : "default"} />
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
                                            if (mnemonic.length === 128 && word1 === mnemonic) { // 128 car seed doesn't have a mnemonic
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

                                <Badge content={Badge.dot}
                                    // style={{ '--right': '110%', '--top': '50%' }}
                                >
                                    Verify Secret Phrase
                                </Badge>
                            </Button>
                        }
                        {/* <Button
                    size="large"
                    onClick={() => {
                        Modal.confirm({
                            closeOnMaskClick: true,
                            title: 'Do not lose your password',
                            content: 'Secret phrase will be encrypted with your wallet password. Do not lose your password or secret phrase will be unrecoverable.',
                            confirmText: 'Download Encrypted Secret Phrase',
                            cancelText: 'Cancel',
                        })
                        // const blob = new Blob([mnemonic], { type: 'text/plain;charset=utf-8' });
                        // saveAs(blob, 'cesium-secret-phrase.txt');
                    }}
                    className="w-full mt-4"
                >
                    Download Encrypted Secret Phrase
                </Button> */}

                    </div>
                </div>
            </Popup>

        </>
    )
}

export default BackupSecretPhrase