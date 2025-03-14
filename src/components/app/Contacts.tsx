import React, { useState, useEffect } from 'react';
import { List, NavBar, Icon, Button, Popover, FloatingBubble, Space, Modal, Input, Popup, Card, Form, Toast, SwipeAction, CenterPopup } from 'antd-mobile';
import { AiOutlineDelete, AiOutlineExport, AiOutlineImport, AiOutlineMenu, AiOutlineMore, AiOutlinePlus } from 'react-icons/ai';
import useLocalStorageState from 'use-local-storage-state';
import NetworkList from './NetworksList';
import { networks } from '../../utils/networks';
import { convertAddress, formatAddress } from '../../utils/format';
import { saveAs } from 'file-saver';
import { FaAddressBook } from 'react-icons/fa6';
import { getAccount } from '../getAccount';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AddOutline, MessageOutline, UserAddOutline, UserCircleOutline, UserContactOutline, UserOutline } from 'antd-mobile-icons';
import { useWindowDimensions } from '../../hooks/use-windows-dimensions';
import ProfilePicture from '../messaging/components/profile/ProfilePicture';
import { useWallet } from '../Popup';
import ProfileName from '../messaging/components/profile/ProfileName';
import { ResponsivePopup } from '../Settings';


const defaultContacts = [
        {
            name: 'NanWallet Team',
            addresses: [
                { network: 'XNO', address: 'nano_1aotdujz8ypijprua9fkerxr9nifbj8bbq5edgztjif45qr3g6fbd1cxenij' },
            ]
        },
]
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

    const handleExport = () => {
        // Handle export logic here
        const blob = new Blob([JSON.stringify(contacts)], { type: 'application/json' });
        saveAs(blob, 'nanwallet-contacts.json');
    };

    const handleAddContact = () => {
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
        setContacts([...contacts, newContact]);
        setAddContactVisible(false);
        Toast.show({
            icon: 'success',
        });
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
                    onClick={() => {
                        Modal.confirm({
                            title: 'Delete Address',
                            content: 'Are you sure you want to delete this address?',
                            onConfirm: () => {
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

     const ImportContacts = () => {
        return  <div className='text-white mb-4'>
        <label htmlFor="file_input" className='cursor-pointer   space-x-2  '>
            <List mode='default'>
            <List.Item
            className='w-full'
            clickable
                prefix={<UserContactOutline />}
                description="Nault, Natrium and Kalium export file supported"
            >
                Import from file
            </List.Item>
            </List>
        </label>
        <input
            onChange={(e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = JSON.parse(e.target.result);

                    let newContacts = [...contacts];
                    let count = 0;
                    data.forEach((contact) => {
                        const exists = newContacts.find((c) => c.name === contact.name);
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
                    setContacts(newContacts);
                    Toast.show({
                        content: `${count} new contacts imported`,
                        icon: 'success',
                    });

                };
                reader.readAsText(file);
            }}
            accept='.json,.txt'
            className='hidden'
            id="file_input" type="file" />

    </div>
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
             <ImportContacts />
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
                                        onConfirm: () => {
                                            let newContacts = contacts.filter((c) => c.name !== contact.name);
                                            setContacts(newContacts);
                                            Toast.show({
                                                icon: 'success',
                                            });
                                        },
                                        confirmText: 'Delete',
                                        cancelText: 'Cancel',
                                    });
                                },
                            }
                        ]}>

                        <List.Item
                        prefix={<ProfilePicture address={contact.addresses[0]?.address} />}
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
                            onClick={() => {
                                let newContactName = form.getFieldValue('newName');
                                let newContacts = contacts.filter((contact) => contact.name !== contactToEdit.name);
                                let newContact = { name: newContactName, addresses: contactToEdit.addresses };
                                newContacts.push(newContact);
                                setContacts(newContacts);
                                setEditContactVisible(false);
                                setContactToEdit(null);
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

                    <Button
                        className='w-full mt-4 mb-4'
                        onClick={() => {
                            form.setFieldsValue({ name: contactToEdit.name, network: '', address: '' });
                            setIsEditingAddress(false);
                            setAddContactVisible(true)
                        }}
                        size='large'
                        color='default'
                    >
                         <Space align='center' justify='center'>
                            <AddOutline fontSize={20} />
                            Add Address
                        </Space>
                    </Button>
                    <Button
                        color='default'
                        className='w-full'
                        onClick={() => {
                            navigate('/chat/' + contactToEdit.addresses.find((address) => address.network === 'XNO')?.address);
                        }}
                        size='large'
                    >
                        <Space align='center' justify='center'>
                            <MessageOutline fontSize={20} />
                            Messages
                        </Space>
                    </Button>
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
        showCloseButton
            bodyStyle={{ maxHeight: '50vh', overflow: 'auto' }}
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
                        prefix={<ProfilePicture address={account.address} />}
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
