import React, { useState, useEffect } from 'react';
import { List, NavBar, Icon, Button, Popover, FloatingBubble, Space, Modal, Input, Popup, Card, Form, Toast, SwipeAction, CenterPopup, Divider } from 'antd-mobile';
import { AiOutlineDelete, AiOutlineExport, AiOutlineImport, AiOutlineMenu, AiOutlineMore, AiOutlinePlus } from 'react-icons/ai';
import useLocalStorageState from 'use-local-storage-state';
import NetworkList from './NetworksList';
import { networks } from '../../utils/networks';
import { convertAddress, formatAddress, pasteFromClipboard } from '../../utils/format';
import { saveAs } from 'file-saver';
import { FaAddressBook } from 'react-icons/fa6';
import { getAccount } from '../getAccount';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AddOutline, DownlandOutline, LinkOutline, LockFill, MailOutline, MessageOutline, ScanCodeOutline, SystemQRcodeOutline, UploadOutline, UserAddOutline, UserCircleOutline, UserContactOutline, UserOutline } from 'antd-mobile-icons';
import { useWindowDimensions } from '../../hooks/use-windows-dimensions';
import ProfilePicture from '../messaging/components/profile/ProfilePicture';
import { useWallet } from '../Popup';
import ProfileName from '../messaging/components/profile/ProfileName';
import { ResponsivePopup } from '../Settings';
import { Scanner } from './Scanner';
import useSWR from 'swr';
import { fetcherAccount } from '../messaging/fetcher';
import { useInviteFriends } from '../messaging/hooks/use-invite-friends';
import ImportContactsFromShare, { useContacts } from '../messaging/components/contacts/ImportContactsFromShare';
import BackupContacts, { useBackupContacts } from '../messaging/components/contacts/BackupContacts';
import ChatInputTip from '../messaging/components/ChatInputTip';
import { defaultContacts, findNanoAddress, showAccountQRCode } from '../messaging/utils';
import { Capacitor } from '@capacitor/core';
import { CardAddNewContact, InputAddressAndNetwork } from '../messaging/components/contacts/AddNewContact';
import AddContacts from './AddContacts';

import { useScrollRestoration } from 'use-scroll-restoration';
import { t } from 'i18next';
import PasteAction from './PasteAction';


export const ImportContacts = ({showAdd = false}) => {
    const [popupVisible, setPopupVisible] = useState(false);
    const [importMethod, setImportMethod] = useState('');
    const {addContacts} = useContacts();
    const navigate = useNavigate();
    function decodeBase64Utf16LE(base64String) {
        // Step 1: Convert Base64 to binary data
        const binaryString = atob(base64String);
        
        // Step 2: Create a Uint8Array from the binary string
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Step 3: Decode the bytes as UTF-16LE
        const decoder = new TextDecoder('utf-16le');
        const decodedString = decoder.decode(bytes);
        
        return decodedString;
      }

    const PopupContentNault = () => {
        const [step, setStep] = useState(0);
        const parseNault = (urlNaultExport) => {
            try {
                if (!urlNaultExport.startsWith('https://nault.cc/import-address-book#')) {
                    Toast.show({
                        icon: 'fail',
                        content: 'Invalid data. Make sure you copied the data correctly from Nault. URL should start with https://nault.cc/import-address-book#',
                        duration: 5000,
                    });
                    return;
                }
                const parsed = urlNaultExport?.split('https://nault.cc/import-address-book#')[1];
                const text = decodeBase64Utf16LE(parsed);

                addContacts(text)
            } catch (error) {
                console.error(error);
                Toast.show({
                    icon: 'fail',
                    content: 'Invalid data. Make sure you copied the data correctly from Nault. URL should start with https://nault.cc/import-address-book#',
                    duration: 5000,
                });                            
            }
        }
        return <div>
            <div className='text-xl text-center mb-4'>
                Import Contacts from Nault
            </div>
            <List>
                <List.Item>
                    1) Open Nault and go to Address Book
                </List.Item>
                <List.Item>
                    2) Click on "IMPORT / EXPORT" at the top, select "Export Address Book" and click "COPY TO CLIPBOARD"
                </List.Item>
                <List.Item>
                    3) Click on "Paste from Clipboard" below
                </List.Item>
            </List>
            <div className='w-full text-center' style={{paddingRight: 16, paddingLeft: 16}}>
            <Button
            className='mt-4 w-full'
            color={step === 0 ? 'primary' : 'default'}
            size='large'
            shape='rounded'
            onClick={() => {
                window.open('https://nault.cc/address-book', '_blank');
                setStep(1);
            }}
            >
                Open Nault
            </Button>
            <Button
            className='mt-4 w-full'
            color={step === 1 ? 'primary' : 'default'}
            size='large'
            shape='rounded'
            onClick={() => {
                pasteFromClipboard().then((urlNaultExport) => {
                   parseNault(urlNaultExport)
                });
            }}
            >
                Paste from Clipboard
            </Button>
            <Scanner
            onScan={(result) => {
                parseNault(result);
            }}>
            <Button
            className='mt-4 mb-4 w-full'
            color={'default'}
            size='large'
            shape='rounded'
            onClick={() => {
                
            }}
            >
                Or Scan QR Code
            </Button>
            </Scanner>
            
            </div>
        </div>;
    }
    const PopupContentNatriumKalium = () => {
        return <div>
            <div className='text-xl text-center mb-4'>
                Import Contacts from {importMethod}
            </div>
            <List>
                <List.Item>
                    1) Open {importMethod} and go to Contacts
                </List.Item>
                <List.Item>
                    2) Click on <UploadOutline style={{display: 'inline'}}/> button at the top right
                </List.Item>
                <List.Item>
                    3) Select open in NanChat
                </List.Item>
            </List>
            <div className='w-full text-center'>
            <Button
            className='mt-4 mb-4'
            color='primary'
            size='large'
            shape='rounded'
            onClick={() => {
                window.location.href = importMethod === 'Natrium' ? 'manta://contacts' : 'banano://contacts';
            }}
            >
                Open {importMethod}
            </Button>
            </div>
        </div>;
    }
    return  <div className=''>
        <List header="Import Contacts">
         

        {
            Capacitor.getPlatform() !== 'web' &&<>
        <List.Item
        clickable
        onClick={() => {
            setPopupVisible(true);
            setImportMethod('Natrium');
        }}
        >
            Contacts from Natrium
        </List.Item>
        <List.Item
        clickable
        onClick={() => {
            setPopupVisible(true);
            setImportMethod('Kalium');
        }}
        >
            Contacts from Kalium
        </List.Item></>
    }
        <List.Item
        clickable
        onClick={() => {
            setPopupVisible(true);
            setImportMethod('Nault');
        }}
        >
            Contacts from Nault
        </List.Item>
        </List>
    <label htmlFor="file_input" className='cursor-pointer   space-x-2  '>
        <List 
        style={{paddingBottom: 'var(--safe-area-inset-bottom)'}}
        mode='default'>
        <List.Item
        clickable
        // description="Nault, Natrium and Kalium export file supported"
        >
            Contacts from file
            <div className="text-xs" style={{color: "var(--adm-color-text-secondary)"}}>
            Nault, Natrium and Kalium export file supported
                        </div>
        </List.Item>
        {
                showAdd && 
        <List.Item
        clickable
        onClick={() => {
            navigate('/contacts?add=true'); // eventually this should be a popup
        }}
        >
            Add contact manually
        </List.Item>
        }
        </List>
    </label>
    <input
        onChange={(e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                
                addContacts(text)


            };
            reader.readAsText(file);
        }}
        accept='.json,.txt'
        className='hidden'
        id="file_input" type="file" />
        <ResponsivePopup
        showCloseButton
            visible={popupVisible}
            onClose={() => {
                setPopupVisible(false)
                setImportMethod('');
            }}
            closeOnMaskClick={true}
            >
            {importMethod === 'Nault' && <PopupContentNault /> }
            {(importMethod === 'Kalium' || importMethod === 'Natrium') && <PopupContentNatriumKalium /> }
        </ResponsivePopup>

</div>
}

export const InviteContactButton = ({ addresses }) => {
    const {data: name, isLoading} = useSWR(findNanoAddress(addresses), fetcherAccount);
    const {inviteFriends} = useInviteFriends()
    const navigate = useNavigate();
    if (isLoading) {
        return null
    }
    if (name?.username) {
        return null
    }
    return <>
    <List.Item
    style={{color: 'var(--adm-color-primary)'}}
     onClick={() => {
        inviteFriends()
    }}
    >
        Invite to NanChat
    </List.Item>
                </>
}
export const MessageButton = ({ addresses }) => {
    const {data: name, isLoading} = useSWR(findNanoAddress(addresses), fetcherAccount);
    const {inviteFriends} = useInviteFriends()
    const navigate = useNavigate();
    if (isLoading) {
        return null
    }
    if (name?.username) {
        return <List.Item
        // color='default'
        // className='w-full mt-4'
        onClick={() => {
            navigate(
                `/chat/${findNanoAddress(addresses)}`
            ); // always navigate to chat with nano equivalent address, in case of eg: only banano contact
        }}
        size='large'
    >
        <MessageOutline style={{display: 'inline', marginRight: 8}} />
         Messages
    </List.Item>
    }
    return null
}


const Contacts: React.FC = ({onlyImport = false}) => {
    const [searchParams] = useSearchParams();
    const [addContactVisible, setAddContactVisible] = useState( searchParams.get("add") === "true" );
    const navigate = useNavigate();
    const {contactsOnNanChatMergedWithLocalContacts, contactsNotOnNanChat} = useContacts()
    console.log({contactsOnNanChatMergedWithLocalContacts})
    const [contacts, setContacts] = useLocalStorageState('contacts', {defaultValue: defaultContacts});
    const [contactToEdit, setContactToEdit] = useState(null);
    const { activeAccount } = useWallet()
    const {data: me} = useSWR(activeAccount, fetcherAccount);
    const [scanOpen, setScanOpen] = useState(false)
  const {isMobile} = useWindowDimensions()
  const { ref, setScroll } = useScrollRestoration('contacts', {
    persist: 'localStorage',
  });
    const {backupContacts} = useBackupContacts()
    const {inviteFriends} = useInviteFriends()
    const handleExport = () => {
        // Handle export logic here
        const blob = new Blob([JSON.stringify(contacts)], { type: 'application/json' });
        saveAs(blob, 'nanwallet-contacts.json');
    };

    const right = (
        <div style={{ fontSize: 24, marginTop: 6 }}>
            <Popover.Menu
          mode='dark'
          actions={[
              { key: 'my_qr', icon: <SystemQRcodeOutline />, text: t('myQrCode') },
              { key: 'scan_qr', icon: <ScanCodeOutline />, text: t('scanQrCode') },
              { key: 'new_contact', icon: <UserAddOutline />, text: t('createNewContact') },
          ]}
        //   placement='left'
          onAction={(node) => {
            if (node.key === 'new_contact') {
              setAddContactVisible(true);
            }
            if (node.key === 'invite') {
              inviteFriends();
            }
            if (node.key === 'my_qr') {
              showAccountQRCode(me);
            }
            if (node.key === 'scan_qr') {
              setScanOpen(true)
                return 
        }}}

          trigger='click'
        >
          <Space style={{ '--gap': '16px' }}>
            <UserAddOutline
                    style={{cursor: "pointer"}} className="hoverable" 
                    /> 
          </Space>
        </Popover.Menu>
        <PasteAction mode="scan" text={" "} scanOpen={scanOpen} setScanOpen={setScanOpen}/>
        </div>
      )
    if (onlyImport && contacts.length > 0) {
        return null
    }
    if (onlyImport) {
        return <ImportContacts />
    }
    

    return (
        <div >
            <NavBar
                className="app-navbar "
                // onBack={() => navigate('/me')}
                backIcon={false}
                right={right} 
            >
                {t('contacts')}
            </NavBar>
             <div ref={ref} style={{ height:
                isMobile ? "calc(100vh - 45px - 58px - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))" : "calc(100vh - 45px - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))"
                // 47px for the header, 58px for the menu
                , overflow: "auto" }}>
            {
                contacts.length === 0 && 
                <>
                <div className='text-center text-xl p-4'>
                    No contacts
                    </div>
                               
                        </>
                //     <div className='text-center text-lg text-gray-500 mt-4'>
                //     Add or import contacts (Nault/Natrium/Kalium export files supported)
                //     <br/>
                //     <div className='text-center text-lg text-gray-500 mt-4 w-full'>
                //         <ImportContacts />
                //         </div>
                //     </div>
                // </div>
            }
            
                <List>
                    <List.Item
                    onClick={() => inviteFriends()}
                     arrowIcon>
            <div
            style={{display: 'flex', alignItems: "center", color: 'var(--adm-color-primary)', }}
            ><MailOutline style={{marginRight: 4}}/>
                {t('inviteFriends')}
            </div>
            </List.Item>
            </List>
            <List header={contactsOnNanChatMergedWithLocalContacts?.length > 0 ? 'Your NanChat contacts' : null}>
                {contactsOnNanChatMergedWithLocalContacts?.sort((a, b) => a.name?.localeCompare(b.name)).map((contact, index) => (
                    <SwipeAction
                        key={index}
                        rightActions={[
                            {
                                key: 'delete',
                                color: 'danger',
                                text: 'Delete',
                                onClick: () => {
                                    Modal.confirm({
                                        title: `Delete ${contact.name}?`,
                                        content: `Are you sure you want to delete this contact?`,
                                        onConfirm: async () => {
                                            let newContacts = contacts.filter((c) => c.name !== contact.name);
                                            setContacts(newContacts);
                                            Toast.show({
                                                icon: 'success',
                                            });
                                            await backupContacts(newContacts)
                                        },
                                        confirmText: 'Delete',
                                        cancelText: 'Cancel',
                                    });
                                },
                            }
                        ]}>

                        <List.Item
                        style={{}}
                        prefix={
                        <div style={{paddingTop: 8, paddingBottom: 8}}>
                            <ProfilePicture address={contact.addresses[0]?.address} width={48} src={contact?.profilePicture?.url} />
                            </div>}
                         key={index}
                            onClick={() => {
                                navigate(`/${contact.addresses[0].address}/info`);
                                // setContactToEdit(contact);
                                // setEditContactVisible(true);
                                // form.setFieldsValue({ newName: contact.name });
                            }}
                        >
                            <ProfileName
                                address={contact.addresses[0]?.address}
                                />
                        </List.Item>
                    </SwipeAction>
                ))}
                </List>

                <List header={contactsNotOnNanChat?.length > 0 ? "Your contacts not yet on NanChat" : null}>

                {contactsNotOnNanChat.sort((a, b) => a.name?.localeCompare(b.name)).map((contact, index) => (
                    <SwipeAction
                        key={index}
                        rightActions={[
                            {
                                key: 'delete',
                                color: 'danger',
                                text: 'Delete',
                                onClick: () => {
                                    Modal.confirm({
                                        title: `Delete ${contact.name}?`,
                                        content: `Are you sure you want to delete this contact?`,
                                        onConfirm: async () => {
                                            let newContacts = contacts.filter((c) => c.name !== contact.name);
                                            setContacts(newContacts);
                                            Toast.show({
                                                icon: 'success',
                                            });
                                            await backupContacts(newContacts)
                                        },
                                        confirmText: 'Delete',
                                        cancelText: 'Cancel',
                                    });
                                },
                            }
                        ]}>

                        <List.Item
                        style={{}}
                        prefix={
                        <div style={{paddingTop: 8, paddingBottom: 8}}>
                            <ProfilePicture address={contact.addresses[0]?.address} width={48}  src={false}/>
                            </div>}
                         key={index}
                            onClick={() => {
                                navigate(`/${contact.addresses[0].address}/info`);
                                // setContactToEdit(contact);
                                // setEditContactVisible(true);
                                // form.setFieldsValue({ newName: contact.name });
                            }}
                        >{contact.name}</List.Item>
                    </SwipeAction>
                ))}
            </List>
            <AddContacts
                defaultName={""}
                defaultAddress={""}
                defaultNetwork={""}
                setAddContactVisible={setAddContactVisible}
                addContactVisible={addContactVisible}
                setContactToEdit={setContactToEdit}
                contactToEdit={contactToEdit}
                 />
            <ImportContacts />

            <ImportContactsFromShare />
            <BackupContacts />
            </div>
        </div>
    );
};

export const SelectContact = ({ ticker, onSelect }) => {
    const [visible, setVisible] = useState(false);
    const [contacts, setContacts] = useLocalStorageState('contacts', {
        defaultValue: defaultContacts
    });
    let filtered = contacts.filter((contact) => contact?.addresses?.find((address) => address?.network === ticker));
    const {wallet} = useWallet()
    // if (filtered.length === 0) {
    //     return null;
    // }
    
    return <>
        {/* <FaAddressBook fontSize={32} 
        className="cursor-pointer text-gray-200 mr-4 mt-4" onClick={() => {
            setVisible(true);
        }} /> */}
        <UserContactOutline className="cursor-pointer" fontSize={22} onClick={() => {
            setVisible(true);
        }} />
        <ResponsivePopup
        closeOnSwipe={true}
        showCloseButton
            bodyStyle={{ maxHeight: '90vh', overflow: 'auto' }}
            destroyOnClose
            visible={visible}
            onClose={() => setVisible(false)}
            closeOnMaskClick={true}
        >
            <div className='text-xl p-2 text-center'>
                Contacts for {networks[ticker].name}
            </div>
            <List
            style={{paddingBottom: 'var(--safe-area-inset-bottom)'}}
            >
            {
                    wallet?.accounts?.map((account, index) => (
                        <List.Item
                        prefix={<ProfilePicture address={account.address} width={48} />}
                         key={index}
                            onClick={() => {
                                onSelect({ name: `Account ${account.accountIndex + 1}`, addresses: [{ network: ticker, address: convertAddress(account.address, ticker) }] });
                                setVisible(false);
                            }}
                        >
                            <ProfileName address={account.address} fallback={`Account ${account.accountIndex + 1}`} />
                        </List.Item>
                    ))
                }
                {filtered.map((contact, index) => (
                    <List.Item
                    prefix={<ProfilePicture address={contact.addresses[0]?.address} />}
                     key={index}
                        onClick={() => {
                            onSelect(contact);
                            setVisible(false);
                        }}
                    >{contact.name}</List.Item>
                ))}
            </List>
        </ResponsivePopup>
    </>
}
export default Contacts;
