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
import { AddOutline, DownlandOutline, LockFill, MessageOutline, UploadOutline, UserAddOutline, UserCircleOutline, UserContactOutline, UserOutline } from 'antd-mobile-icons';
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
import { defaultContacts } from '../messaging/utils';
import { Capacitor } from '@capacitor/core';



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
        <List>
         

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
        <List mode='default'>
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
            {importMethod === 'Kalium' || importMethod === 'Natrium' && <PopupContentNatriumKalium /> }
        </ResponsivePopup>

</div>
}

const Contacts: React.FC = ({onlyImport = false}) => {
    const [searchParams] = useSearchParams();
    const [addContactVisible, setAddContactVisible] = useState( searchParams.get("add") === "true" );
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [selectNetworkVisible, setSelectNetworkVisible] = useState(false);
    const [form] = Form.useForm();
    const name = Form.useWatch('newName', form)
    const network = Form.useWatch('network', form)
    const navigate = useNavigate();
    const [contacts, setContacts] = useLocalStorageState('contacts', {defaultValue: defaultContacts});
    const [contactToEdit, setContactToEdit] = useState(null);
    const [editContactVisible, setEditContactVisible] = useState(false);
  const {isMobile} = useWindowDimensions()
  const ResponsivePopup = isMobile ? Popup : CenterPopup;
    const {addContacts} = useContacts();
    const {backupContacts} = useBackupContacts()
    const handleExport = () => {
        // Handle export logic here
        const blob = new Blob([JSON.stringify(contacts)], { type: 'application/json' });
        saveAs(blob, 'nanwallet-contacts.json');
    };

    const handleAddContact = async () => {
        // Handle add contact logic here
        const values = form.getFieldsValue();
        console.log(values);
        if (contactToEdit !== null) {
            let contactNewAddresses = [...contactToEdit.addresses, { network: values.network, address: values.address }];
            let newContact = { name: values.newName, addresses: contactNewAddresses };
            let newContacts = contacts.filter((contact) => contact.name !== contactToEdit.name);
            newContacts.push(newContact);
            setContacts(newContacts);
            setAddContactVisible(false);
            setContactToEdit(newContact);
            Toast.show({
                icon: 'success',
            });
            await backupContacts(newContacts)
            return;
        }
        // check if name already exists
        const exists = contacts.find((contact) => contact.name === values.name);
        if (exists) {
            Modal.alert({
                title: 'Name already exists',
                confirmText: 'OK',
            });
            return;
        }
        let newContact = { name: values.name, addresses: [{ network: values.network, address: values.address }] };
        let newContacts = [...contacts, newContact];
        setContacts(newContacts);
        setAddContactVisible(false);
        Toast.show({
            icon: 'success',
        });
        await backupContacts(newContacts)
    };

    console.log(contacts)
    const InputAddressAndNetwork = ({ form }) => {
        return (<>
            <Form.Item
                name={'network'}
                label='Network' onClick={() => setSelectNetworkVisible(true)}>
                <Input
                    placeholder='Network'
                />
            </Form.Item>
            {
                networks[network] &&
                <Form.Item label='Address' name={'address'}>
                    <Input
                        placeholder={networks[network].prefix + '_'}
                    />
                </Form.Item>
            }
        </>);
    };

    const CardAddNewContact = () => {
        return <Card>
            <div className="text-center text-xl p-2 mb-4">
                Add Contact
            </div>

            <Form 
            initialValues={{
                name: searchParams.get("name") || "",
                network: searchParams.get("network") || "",
                address: searchParams.get("address") || "",
            }}
            layout='horizontal' form={form}>
                <Form.Item label='Name' name={'name'}>
                    <Input
                    autoFocus
                        placeholder='Name'
                    />
                </Form.Item>
                <InputAddressAndNetwork form={form} />
            </Form>
            <Button
                className='w-full mt-4'
                onClick={handleAddContact}
                size='large'
                color='primary'
                shape='rounded'
            >
                Add Contact
            </Button>
            <Button
                className='w-full my-4'
                onClick={() => setAddContactVisible(false)}
                size='large'
                shape='rounded'

            >
                Close
            </Button>
        </Card>
    }

    const CardEditAddress = () => {
        return <Card>
            <div className='text-xl p-2 mb-4 flex justify-between items-center'>
                <span>
                    Edit Address
                </span>
                <Button
                    onClick={async () => {
                        Modal.confirm({
                            title: 'Delete Address',
                            content: 'Are you sure you want to delete this address?',
                            onConfirm: async () => {
                                let newAddresses = contactToEdit.addresses.filter((address) => address.address !== form.getFieldValue('address'));
                                let newContact = { name: contactToEdit.name, addresses: newAddresses };
                                let newContacts = contacts.filter((contact) => contact.name !== contactToEdit.name);
                                newContacts.push(newContact);
                                setContacts(newContacts);
                                setIsEditingAddress(false);
                                setAddContactVisible(false);
                                setContactToEdit(newContact);
                                Toast.show({
                                    icon: 'success',
                                });
                                await backupContacts(newContacts)
                            },
                            confirmText: 'Delete',
                            cancelText: 'Cancel',
                            onCancel: () => { }
                        });
                    }}
                >
                    <AiOutlineDelete />
                </Button>
            </div>
            <Form layout='horizontal' form={form}>
                <InputAddressAndNetwork form={form} />
            </Form>
            <Button
                className='w-full mt-4'
                onClick={handleAddContact}
                size='large'
                color='primary'
            >
                Save Address
            </Button>
            <Button
                className='w-full my-4'
                onClick={() => setAddContactVisible(false)}
                size='large'
            >
                Cancel
            </Button>
        </Card>
    }
    const CardNewAddress = () => {
        return <Card>
            <div className="text-center text-xl p-2 mb-4">
                Add Address
            </div>

            <Form layout='horizontal' form={form}>
                <InputAddressAndNetwork form={form} />
            </Form>
            <Button
                className='w-full mt-4'
                onClick={handleAddContact}
                size='large'
                color='primary'
            >
                Save Address
            </Button>
            <Button
                className='w-full my-4'
                onClick={() => setAddContactVisible(false)}
                size='large'
            >
                Cancel
            </Button>
        </Card>
    }

     

    const findNanoAddress = (addresses) => {
        if (addresses == null) return null;
        if (addresses.find((address) => address.network === 'XNO')) {
            return addresses.find((address) => address.network === 'XNO').address;
        }
        return convertAddress(addresses[0].address, 'XNO');
    }
    const NotYetOnNanChat = ( {addresses} ) => {
        const {data: name, isLoading} = useSWR(findNanoAddress(addresses), fetcherAccount);
        if (isLoading) {
            return null
        }
        if (!name?.username) {
            return  <div style={{color: "var(--adm-color-text-secondary)"}} className='text-center text-lg mt-4 mb-4'>
            This account is not yet on NanChat
        </div>
        }
    }
    const InviteContactButton = ({ addresses }) => {
        const {data: name, isLoading} = useSWR(findNanoAddress(addresses), fetcherAccount);
        const {inviteFriends} = useInviteFriends()
        if (isLoading) {
            return null
        }
        if (name?.username) {
            return  <div className='text-center'><Button
            // color='default'
            // className='w-full mt-4'
            style={{borderRadius: 12}}
            onClick={() => {
                navigate(
                    `/chat/${findNanoAddress(contactToEdit.addresses)}`
                ); // always navigate to chat with nano equivalent address, in case of eg: only banano contact
                
            }}
            size='large'
        >
            <div style={{fontSize: 34}}>
            💬
            </div>
            <div className='mt-2'>
            Messages
          </div>
        </Button></div>
        }
        return <>
        
                    <div className='text-center'>
                    <Button
                        color='primary'
                        style={{borderRadius: 12}}
                        onClick={() => {
                            inviteFriends()
                        }}
                        size='large'
                    >
                        <div style={{fontSize: 34}}>
                        ✉️
                        </div>
                        
                    </Button>
                    <div className='mt-2'>
                        Invite
                        </div>
                    </div>
                    </>
    }
    if (onlyImport && contacts.length > 0) {
        return null
    }
    if (onlyImport) {
        return <ImportContacts />
    }

    return (
        <div>
            <NavBar
                className="app-navbar "
                onBack={() => window.history.back()}
                // right={<Popover.Menu
                //     trigger='click'
                //     mode='dark'
                //     actions={[
                //         {
                //             text: <ImportContacts />, key: 'import'
                //         },
                //         { text: 'Export', icon: <AiOutlineExport size={20} />, onClick: handleExport, key: 'export' },
                //     ]}
                // >
                //     <Button size='mini' shape='rounded'>
                //         Import/Export
                //     </Button>
                // </Popover.Menu>}
                right={
                    <div style={{ fontSize: 24, marginTop: 6 }}>
                    <UserAddOutline
                    style={{float: 'right'}}
                    onClick={() => setAddContactVisible(true)}
                    /> 
                </div>
                }
            >
                Contacts
            </NavBar>
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
                {contacts.sort((a, b) => a.name.localeCompare(b.name)).map((contact, index) => (
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
                        prefix={<ProfilePicture address={contact.addresses[0]?.address} width={48}  />}
                         key={index}
                            onClick={() => {
                                setContactToEdit(contact);
                                setEditContactVisible(true);
                                form.setFieldsValue({ newName: contact.name });
                            }}
                        >{contact.name}</List.Item>
                    </SwipeAction>
                ))}
            </List>
            <Divider>
            Import Contacts
            </Divider>
            <ImportContacts />

            {/* <Button
                shape='rounded'
                size='large'
                color='primary'
                onClick={() => setAddContactVisible(true)}
                style={{ position: 'fixed', bottom: 100, right: 16 }}
            >
                <Space className='flex items-center'>
                    <UserAddOutline/> Add Contact
                </Space>
            </Button> */}
            <ResponsivePopup
                destroyOnClose
                visible={addContactVisible}
                onClose={() => {
                    setAddContactVisible(false)
                    setIsEditingAddress(false)
                }}
                closeOnMaskClick={true}
            >
                {
                    contactToEdit === null ? <CardAddNewContact /> : isEditingAddress ? <CardEditAddress /> : <CardNewAddress />
                }
            </ResponsivePopup>

            <ResponsivePopup
                visible={editContactVisible}
                onClose={() => {
                    setEditContactVisible(false)
                    setContactToEdit(null)
                    form.resetFields()
                }}
                closeOnMaskClick={true}
            >
                <Card>
                    <div className='text-xl p-2 mb-4 flex justify-between items-center'>
                        <span>
                            Edit Contact
                        </span>
                        <Button
                            onClick={async () => {
                                let newContactName = form.getFieldValue('newName');
                                let newContacts = contacts.filter((contact) => contact.name !== contactToEdit.name);
                                let newContact = { name: newContactName, addresses: contactToEdit.addresses };
                                newContacts.push(newContact);
                                setContacts(newContacts);
                                setEditContactVisible(false);
                                setContactToEdit(null);
                                await backupContacts(newContacts)
                            }}
                            color={name === contactToEdit?.name ? 'default' : 'primary'}
                            className='text-sm'>
                            OK
                        </Button>
                    </div>

                    <Form layout='horizontal' form={form}>
                        <Form.Item label='Name' name={'newName'}>
                            <Input
                                placeholder='Name'
                            />
                        </Form.Item>
                    </Form>
                    <List>
                        {contactToEdit?.addresses.map((address, index) => (
                            <List.Item
                                key={index}
                                onClick={() => {
                                    setAddContactVisible(true)
                                    setIsEditingAddress(true);
                                    form.setFieldsValue({ network: address.network, address: address.address });
                                }}
                                prefix={<img
                                    width={42}
                                    src={networks[address.network]?.logo}
                                    alt={`${address.network} logo`} />
                                }
                                description={formatAddress(address.address)}
                            >
                                {address.network}
                            </List.Item>
                        ))}
                    </List>
                    <NotYetOnNanChat addresses={contactToEdit?.addresses} />
                    <div style={{display: "flex", justifyContent: "space-evenly"}}>
                    <InviteContactButton addresses={contactToEdit?.addresses} />
                    <ChatInputTip toAddress={findNanoAddress(contactToEdit?.addresses)} onTipSent={() => {
                    }} />
                    <div className='text-center'>
                    <Button
                        color='default'
                        style={{borderRadius: 12}}
                        onClick={() => {
                            form.setFieldsValue({ name: contactToEdit.name, network: '', address: '' });
                            setIsEditingAddress(false);
                            setAddContactVisible(true)
                        }}
                        size='large'
                    >
                        <div style={{fontSize: 34}}>
                        ➕
                        </div>
                        
                    </Button>
                    <div className='mt-2' style={{maxWidth: 64}}>
                        Address
                        </div>
                    </div>
                    </div>
                </Card>
            </ResponsivePopup>
            <ResponsivePopup
                destroyOnClose
                visible={selectNetworkVisible}
                onClose={() => setSelectNetworkVisible(false)}
                closeOnMaskClick={true}
            >
                <Card>
                    <div className="text-center text-xl p-2 mb-4">
                        Select Network
                    </div>
                    <NetworkList
                        hideActions={true}
                        hideBalance={true}
                        hidePrice={true} onClick={(ticker) => {
                            form.setFieldsValue({ network: ticker });
                            setSelectNetworkVisible(false);

                        }} />
                </Card>
            </ResponsivePopup>
            <ImportContactsFromShare />
            <BackupContacts />
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
            <List>
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
