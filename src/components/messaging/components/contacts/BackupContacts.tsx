import React from 'react'
import { useEffect } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { List, Modal, Toast } from 'antd-mobile';
import PasteAction from './PasteAction';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';
import { WebviewOverlay } from '@teamhive/capacitor-webview-overlay';
import { Filesystem } from '@capacitor/filesystem';
import useLocalStorageState from 'use-local-storage-state';
import { networks } from '../../../utils/networks';
import ProfilePicture from './profile/ProfilePicture';
import { formatAddress } from '../../../utils/format';
import { LockFill } from 'antd-mobile-icons';
import useSWR from 'swr';
import { fetcherMessages, fetcherMessagesPost } from '../../fetcher';
import { box } from 'multi-nano-web';
import { useWallet } from "../../../useWallet";
import { useSWRConfig } from "swr"
import { defaultContacts } from '../../utils';


export const useBackupContacts = () => {
    const {activeAccount, activeAccountPk} = useWallet()
    const [setContacts] = useLocalStorageState('contacts', {defaultValue: defaultContacts});
    const {mutate} = useSWR('/contacts-length', fetcherMessages);

    async function backupContacts(contacts) {
        try {
            const stringified = JSON.stringify(contacts);
            const length = stringified.length;
            const encrypted = box.encrypt(stringified, activeAccount, activeAccountPk);
            const data = await fetcherMessagesPost('/contacts', {
                contacts: encrypted,
                length: length // for caching purposes
            });
            
            console.log('contacts backed up', data);
            if (!data.success) {
                // Toast.show({content: data.error, icon: 'fail'}); // this can happen if no changes, editing only the network will result in same length, ignoring this case for now
            }
            else {
                mutate()
            }
            return data;
        } catch (error) {
            console.error('Failed to backup contacts:', error);
            Toast.show({content: 'Failed to backup contacts: ' + error?.message,
                icon: 'fail'});
            throw error;
        }
    }
    async function restoreContacts(){
        Toast.show({content: 'Restoring contacts from backup', icon: 'loading'})
        const data = await fetcherMessages('/contacts');
        if (data.encrypted) {
            const decrypted = box.decrypt(data.encrypted, activeAccount, activeAccountPk);
            const parsed = JSON.parse(decrypted)
            setContacts(parsed)
            Toast.show({content: `Restored ${parsed.length} contacts`, icon: 'success'})
        }

    }
   

    return {
        backupContacts,
        restoreContacts
    };
}

function BackupContacts() {
    const {activeAccount, activeAccountPk} = useWallet()
    const {data: contactsBackupLength, isLoading, mutate} = useSWR('/contacts-length', fetcherMessages);
    const [contacts, setContacts] = useLocalStorageState('contacts', {defaultValue: defaultContacts});

    async function saveContacts(){
        const encrypted = box.encrypt(JSON.stringify(contacts), activeAccount, activeAccountPk);
        fetcherMessagesPost('/contacts', {
            contacts: encrypted,
            length: contactsLength
        }).then((data) => {
            console.log('contacts backed up', data)
            if (data.success) {
                mutate()
            }
            else {
                Toast.show({content: data.error, icon: 'fail'})
            }
        })
    }
    async function restoreContacts(){
        Toast.show({content: 'Restoring contacts from backup', icon: 'loading'})
        const data = await fetcherMessages('/contacts');
        if (data.encrypted) {
            const decrypted = box.decrypt(data.encrypted, activeAccount, activeAccountPk);
            const parsed = JSON.parse(decrypted)
            setContacts(parsed)
            Toast.show({content: `Restored ${parsed.length} contacts`, icon: 'success'})
        }

    }
    useEffect(() => {
        if (isLoading) return;
        if (!contacts) return;
        const contactsLength = JSON.stringify(contacts).length;
        if (
            ((contacts.length === defaultContacts.length
            && JSON.stringify(contacts) === JSON.stringify(defaultContacts))
            && contactsBackupLength > 2) // restore if contacts are empty 
            ||
            (contactsBackupLength > 2 && contactsBackupLength !== contactsLength))  // restore if contacts are different
            {
            // restore backup
                restoreContacts()
        }
      
    }, [])

    return (
        <div className="mt-6 pt-4 mb-4 ml-2 text-center" style={{ color: 'var(--adm-color-text-secondary)' }}>
        {contacts.length > 0 && <div className="mt-2 mb-2">You have {contacts.length} contacts</div>}
        <LockFill className="mr-2 inline" />Your contacts are backed up end-to-end encrypted.

        {/* contacts local: 
        {JSON.stringify(contacts).length}
        contacts backup:
        {contactsBackupLength} */}
</div>
    )
}

export default BackupContacts