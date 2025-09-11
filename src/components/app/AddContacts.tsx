import React, { useState, useEffect } from 'react';
import { List, NavBar, Icon, Button, Popover, FloatingBubble, Space, Modal, Input, Popup, Card, Form, Toast, SwipeAction, CenterPopup, Divider } from 'antd-mobile';
import { AiOutlineDelete, AiOutlineExport, AiOutlineImport, AiOutlineMenu, AiOutlineMore, AiOutlinePlus } from 'react-icons/ai';
import useLocalStorageState from 'use-local-storage-state';
import NetworkList from './NetworksList';
import { networks } from '../../utils/networks';
import { formatAddress, pasteFromClipboard } from '../../utils/format';
import { saveAs } from 'file-saver';
import { FaAddressBook } from 'react-icons/fa6';
import { getAccount } from '../getAccount';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AddOutline, DownlandOutline, LockFill, MessageOutline, UploadOutline, UserAddOutline, UserCircleOutline, UserContactOutline, UserOutline } from 'antd-mobile-icons';
import { useWindowDimensions } from '../../hooks/use-windows-dimensions';
import ProfilePicture from '../messaging/components/profile/ProfilePicture';
import { useWallet } from "../useWallet";
import ProfileName from '../messaging/components/profile/ProfileName';
import { ResponsivePopup } from '../Settings';
import { Scanner } from './Scanner';
import useSWR from 'swr';
import { fetcherAccount } from '../messaging/fetcher';
import { useInviteFriends } from '../messaging/hooks/use-invite-friends';
import ImportContactsFromShare, { useContacts } from '../messaging/components/contacts/ImportContactsFromShare';
import BackupContacts, { useBackupContacts } from '../messaging/components/contacts/BackupContacts';
import ChatInputTip from '../messaging/components/ChatInputTip';
import { convertAddress, defaultContacts } from '../messaging/utils';
import { Capacitor } from '@capacitor/core';
import { InputAddressAndNetwork } from '../messaging/components/contacts/AddNewContact';



export  const findNanoAddress = (addresses) => {
    if (addresses == null) return null;
    if (addresses.find((address) => address.network === 'XNO')) {
        return addresses.find((address) => address.network === 'XNO').address;
    }
    return convertAddress(addresses[0].address, 'XNO');
}
const AddContacts: React.FC = ({defaultName, defaultAddress, defaultNetwork, setAddContactVisible, addContactVisible,
    setContactToEdit, contactToEdit
    
}) => {
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [selectNetworkVisible, setSelectNetworkVisible] = useState(false);
    const [form] = Form.useForm();
    const name = Form.useWatch('newName', form)
    const network = Form.useWatch('network', form)
    const navigate = useNavigate();
    const [contacts, setContacts] = useLocalStorageState('contacts', {defaultValue: defaultContacts});
    
    const [editContactVisible, setEditContactVisible] = useState(true);
  const {isMobile} = useWindowDimensions()
  const ResponsivePopup = isMobile ? Popup : CenterPopup;
    const {backupContacts} = useBackupContacts()
    const handleExport = () => {
        // Handle export logic here
        const blob = new Blob([JSON.stringify(contacts)], { type: 'application/json' });
        saveAs(blob, 'nanwallet-contacts.json');
    };

    const handleAddContact = async () => {
        // debugger
        const values = form.getFieldsValue();
        console.log(values);

      
        if (values.network == null || values.network === "") {
            Toast.show({
                maskStyle: {zIndex: 99999},
                icon: 'fail',
                content: 'Please select a network',
            });
            return;
        }
        // Handle add contact logic here
        if (contactToEdit !== null) {
            if (values.newName === null || values.newName === "") {
                Toast.show({
                    maskStyle: {zIndex: 99999},
                    icon: 'fail',
                    content: 'Please enter a name',
                });
                return;
            }
            let contactNewAddresses = [{ network: values.network, address: values.address }];
            let newContact = { name: values.newName, addresses: contactNewAddresses };
            let newContacts = contacts.filter((contact) => contact.addresses[0].address !== contactToEdit.addresses[0].address);
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
        if (values.name === null || values.name === "") {
            Toast.show({
                maskStyle: {zIndex: 99999},
                position: 'top',
                icon: 'fail',
                content: 'Please enter a name',
            });
            return;
        }
        // check if name already exists
        const exists = contacts?.find((contact) => contact.addresses[0].address === values.address);
        if (exists) {
            Modal.alert({
                title: 'Contact with same address already exists: ' + exists.name,
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

    // console.log(contacts)
    

    
    const CardAddNewContact = () => {
        return <Card>
            <div className="text-center text-xl p-2 mb-4">
                Add Contact
            </div>

            <Form 
            initialValues={{
                name: defaultName || "",
                network: defaultNetwork || "",
                address: defaultAddress || "",
            }}
            layout='horizontal' form={form}>
                <Form.Item 
                label='Name' name={'name'}>
                    <Input
                    min={1}
                        placeholder='Name'
                    />
                </Form.Item>
                <InputAddressAndNetwork form={form} setSelectNetworkVisible={setSelectNetworkVisible} />
            </Form>
            <Button
                className='w-full mt-4'
                onClick={handleAddContact}
                size='large'
                color='primary'
                shape='rounded'
            >
                Save
            </Button>
            <Button
                className='w-full my-4'
                onClick={() => setAddContactVisible(false)}
                size='large'
                shape='rounded'

            >
                Cancel
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
                            style: { zIndex: 999999 },
                            title: 'Delete contact',
                            content: 'Are you sure you want to delete this contact?',
                            onConfirm: async () => {
                                let newAddresses = contactToEdit.addresses.filter((address) => address.address !== form.getFieldValue('address'));
                                let newContact = { name: contactToEdit.name, addresses: newAddresses };
                                let newContacts = contacts.filter((contact) => contact.addresses[0].address !== contactToEdit.addresses[0].address);
                                // newContacts.push(newContact);
                                setContacts(newContacts);
                                setIsEditingAddress(false);
                                setAddContactVisible(false);
                                setContactToEdit(null);
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
                <InputAddressAndNetwork form={form} setSelectNetworkVisible={setSelectNetworkVisible} />
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
                <InputAddressAndNetwork form={form} setSelectNetworkVisible={setSelectNetworkVisible} />
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

     

   

    return (
        <div>
            <ResponsivePopup
            style={{zIndex: 99999}}
                destroyOnClose
                visible={addContactVisible}
                onClose={() => {
                    setAddContactVisible(false)
                    setIsEditingAddress(false)
                }}
                closeOnMaskClick={true}
            >
                {
                    contactToEdit === null ? <CardAddNewContact />
                      : isEditingAddress ? <CardEditAddress /> : <CardNewAddress />
                }
                
            </ResponsivePopup>
            <ResponsivePopup
            destroyOnClose
                visible={contactToEdit !== null}
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
                                if (newContactName === null || newContactName === "") {
                                    Toast.show({
                                        maskStyle: {zIndex: 99999},
                                        icon: 'fail',
                                        content: 'Please enter a name',
                                    });
                                    return;
                                }
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

                    <Form 
                    initialValues={{
                        newName: contactToEdit?.name,
                        network: contactToEdit?.addresses[0]?.network,
                        address: contactToEdit?.addresses[0]?.address,
                    }}
                    layout='horizontal' form={form}>
                        <Form.Item
                         label='Name' name={'newName'}>
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
                                // prefix={
                                //     address.network === "ALL" ? 
                                //     "@" :
                                // <img
                                //     width={42}
                                //     src={networks[address.network]?.logo}
                                //     alt={`${address.network} logo`} />
                                // }
                                description={`Network: ${address.network}`}
                            >
                                {formatAddress(address.address)}
                            </List.Item>
                        ))}
                    </List>
                </Card>
            </ResponsivePopup>
            <ResponsivePopup 
            style={{zIndex: 99999}}
                destroyOnClose
                visible={selectNetworkVisible}
                onClose={() => setSelectNetworkVisible(false)}
                closeOnMaskClick={true}
            >
                <Card className=''>
                    <div className="text-center text-xl p-2 mb-4">
                        Select Network
                    </div>
                    <List>
                        <List.Item
                        onClick={() => {
                            form.setFieldsValue({ network: 'ALL' });
                            setSelectNetworkVisible(false);
                        }}
                        >
                            All Networks
                        </List.Item>
                    </List>
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

export default AddContacts;
