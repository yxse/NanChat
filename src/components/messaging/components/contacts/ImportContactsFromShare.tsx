import React from 'react'
import { useEffect } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { List, Modal, Toast } from 'antd-mobile';
import PasteAction from './PasteAction';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';
import { InAppBrowser } from '@capgo/inappbrowser';
import { WebviewOverlay } from '@teamhive/capacitor-webview-overlay';
import { Filesystem } from '@capacitor/filesystem';
import useLocalStorageState from 'use-local-storage-state';
import { networks } from '../../../../utils/networks';
import ProfilePicture from './../profile/ProfilePicture';
import { formatAddress } from '../../../../utils/format';
import { useBackupContacts } from './BackupContacts';
import { defaultContacts } from '../../utils';


export const useContacts = () => {
    const [contacts, setContacts] = useLocalStorageState('contacts', {defaultValue: defaultContacts});
    const {backupContacts} = useBackupContacts()

    const parseContacts = (text) => {
        const data = JSON.parse(text);
        let newContacts = [];
        let count = 0;
        data.forEach((contact) => {
            const exists = contacts.find((c) => c.name === contact.name);
            if (!exists) {
                let addressesFormatted = [];
                let addresses = []
                if (contact.addresses !== undefined) { // nanwallet export file
                    addresses = contact.addresses
                }
                else if (contact.account) { // Nault export file
                    addresses = [{ address: contact.account }]
                }
                else if (contact.address) { // Natrium export file
                    addresses = [{ address: contact.address }]
                }
                addresses.forEach((address) => {
                    if (address.network in networks) {
                        addressesFormatted.push({ network: address.network, address: address.address })
                    }
                    else if (address.network == null && address.address?.includes('_')) {
                        // retrieve network from address prefix
                        let prefix = address.address.split('_')[0]
                        let network = Object.keys(networks).find((ticker) => networks[ticker].prefix === prefix)
                        if (network) {
                            addressesFormatted.push({ network: network, address: address.address })
                        }
                    }
                });

                newContacts.push({
                    name: contact.name,
                    addresses: addressesFormatted
                });
                count++;
            }
        });
        
        return {
            newContacts: newContacts,
            count: count
        }
    }

    const addContacts = (text) => {
        const { newContacts, count } = parseContacts(text);
        if (count === 0) {
            Toast.show({
                content: "No new contacts found",
                duration: 2000,
            });
            return;
        }
        Modal.confirm({
            title: `Import ${count} new contact(s)?`,
            content: <div>
                    <List>
                        {newContacts.map((contact) => {
                            return <List.Item
                            description={contact.addresses.map((address) => {
                                return <div key={address.address}>
                                    {formatAddress(address.address)}
                                </div>
                            })}
                            prefix={<ProfilePicture 
                                address={contact.addresses[0]?.address} width={48}  />}
                             key={contact.name}>
                                {contact.name}
                            </List.Item>
                        })}
                    </List>
                </div>,
            onConfirm: async () => {
                let newContactsAll = [...contacts, ...newContacts];
                setContacts(newContactsAll);
                Toast.show({
                    content: `${count} new contacts imported`,
                    icon: 'success',
                });
                await backupContacts(newContactsAll);
            },
            onCancel: () => {
                return;
            },
            confirmText: 'Confirm',
            cancelText: 'Cancel',
        });
       
    }
    


    return {
        addContacts
    }
}


function ImportContactsFromShare() {
    const contactsFileName = ["natriumcontacts_", "kaliumcontacts_"];
    const [searchParams] = useSearchParams();
    const urlFile = searchParams.get('import_url');
    const { addContacts } = useContacts();
    useEffect(() => {
        const handleOpenUrl = async () => {
            try {
                const file = await Filesystem.readFile({
                    path: urlFile,
                });
                const data = file.data; // base64 encoded string
                const dataText = atob(data);
                const contacts = JSON.parse(dataText);
                addContacts(dataText);
             
                //
                // Toast.show({
                //     content: "Contacts file data: " + JSON.stringify(contacts),
                //     duration: 10000,
                // });
            } catch (error) {
                Toast.show({
                    content: "Error reading contacts file: " + error,
                    duration: 10000,
                });
            }
        }
        if (urlFile) {
            handleOpenUrl();
        }
    }, [urlFile]);

    return (
        null
    )
}

export default ImportContactsFromShare