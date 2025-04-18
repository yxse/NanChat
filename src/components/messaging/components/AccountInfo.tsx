import { LockFill, LockOutline, MessageOutline, PhoneFill, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, copyToClipboard, formatAddress } from "../../../utils/format";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, Card, Divider, DotLoading, Input, List, Modal, NavBar, Popup, Toast } from "antd-mobile";
import useSWR from "swr";
import { fetcherMessages, fetcherMessagesPost } from "../fetcher";
import { box } from "multi-nano-web";
import ChatInputMessage from "./ChatInputMessage";
import { showActionSheet } from "antd-mobile/es/components/action-sheet/action-sheet";
import useLocalStorageState from "use-local-storage-state";
import ProfilePicture from "./profile/ProfilePicture";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { HeaderStatus } from "./HeaderStatus";
import { useChats } from "../hooks/use-chats";
import ProfileName from "./profile/ProfileName";
import { BlockChatButton } from "./NewMessageWarning";
import { findNanoAddress, InviteContactButton, MessageButton } from "../../app/Contacts";
import ChatInputTip from "./ChatInputTip";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { useContact } from "./contacts/ImportContactsFromShare";
import { CardAddNewContact } from "./contacts/AddNewContact";
import AddContacts from "../../app/AddContacts";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";

const AccountInfo: React.FC<{}> = ({ onlineAccount }) => {
    const {
        account
    } = useParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const {blockChat} = useChats();
    const { data: names } = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const name = names?.[0];
    const nameOrAccount = name?.name || formatAddress(account);
    const {getContact} = useContact();
    const [visible, setVisible] = useState(false);
    const [contacts, setContacts] = useLocalStorageState('contacts', {
        defaultValue: []
    });
    const [newContactVisible, setNewContactVisible] = useState(false);
    const [contactToEdit, setContactToEdit] = useState(null);
    const [newContactDefaultValues, setNewContactDefaultValues] = useState({
        name: '',
        network: 'ALL',
        address: ''
    });
    const {isMobile} = useWindowDimensions();
    const inContacts = contacts.find((contact) => contact.addresses.find((address) => address.address === account));

    const inOnNanchat = names?.find((name) => name._id === account);
    const contact = getContact(account);
    useHideNavbarOnMobile(true)
    return (
        <div className="">
            <NavBar
            right={<div 
                style={{cursor: 'pointer'}}
                onClick={() => {
                    // navigate(`/contacts/?address=${account}&name=${nameOrAccount}&add=true&network=XNO`); // 
                    setContactToEdit(contact);
                    // setNewContactVisible(true);
                }}
            className="">
                {
                    inContacts && "Edit"
                }
            </div>}
            onBack={() => {
                if (window.history?.length && window.history.length > 1) {
                    navigate(-1);
                 } else {
                    navigate('/chat', { replace: true });
                 }
            }}
            >Contact
            </NavBar>
                <div style={{marginRight: 12, marginLeft: 12, marginTop: 16}}>
            <Card style={{maxWidth: 576, margin: 'auto'}}>
             
             {
                inOnNanchat ? 
                <div>
                    <div style={{display: "flex", alignItems: "center", gap: 8}} className="text-2xl">
                <ProfilePicture address={account} width={72} clickable/>
                <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                <ProfileName address={account} />
                <div style={{color: 'var(--adm-color-text-secondary)'}} className="text-base">
                    NanChat ID: {name?.username}
                </div>
                </div>
                </div>
                
                </div>
                : 
                <div style={{display: "flex", alignItems: "center", gap: 8, flexDirection: "column"}} className="text-2xl">
                    <div>

                    {contact?.name}
                    </div>
                <div 
                className="text-base text-center"
                onClick={() => {
                    copyToClipboard(account);
                    Toast.show({
                        icon: 'success',
                        content: 'Address copied to clipboard',
                    });
                }}
                style={{ wordBreak: 'break-all'}} >
                        {account}
                    </div>
                    </div>
                }
                </Card>
                </div>
                <div style={{maxWidth: 600, margin: 'auto', marginTop: 16}}>
                    {
                        !inContacts &&
                <List 
                mode="card"
                style={{marginBottom: 16}}>
                        <List.Item
                        style={{color: 'var(--adm-color-primary)'}}
                        arrowIcon={false}
                        onClick={() => {
                            setNewContactVisible(true);
                            setNewContactDefaultValues({
                                name: nameOrAccount,
                                network: 'ALL',
                                address: account
                            });
                            // navigate(`/contacts/?address=${account}&name=${nameOrAccount}&add=true&network=XNO`);
                        }}>
                                    Create new contact
                                    </List.Item>
                                    </List>
                                }
                <List mode="card">
                <InviteContactButton
                addresses={[{
                    address: account,
                    network: 'XNO'
                }]}
                />
                    
                <MessageButton
                addresses={[{
                    address: account,
                    network: 'XNO'
                }]}
                />
                <ChatInputTip
                filterTickers={
                    inContacts ? contact?.addresses[0].network === 'ALL' ? [] : [contact?.addresses[0].network]
                    : []
                } 
                mode={"list"}
                toAddress={account} onTipSent={() => {
                }} />
                </List>
                {
                    inOnNanchat && 
                
                    <List mode="card" style={{marginTop: 16}}>
                <List.Item
                    extra={formatAddress(account)}
                    onClick={() => {
                        Modal.show({
                            closeOnMaskClick: true,
                            closeOnAction: true,
                            title: `${nameOrAccount}'s account:`,
                            content: (
                                <div className="text-center">
                                    <p className="break-all  p-4">
                                        {account}
                                    </p>
                                    <p style={{color: 'var(--adm-color-text-secondary)'}} className="text-sm">
                                        Verify it with {nameOrAccount} and save it in your contacts for a guaranteed end-to-end encryption.
                                    </p>
                                </div>
                            ),
                            actions: [
                                {
                                    key: 'copy',
                                    text: 'Copy',
                                },
                                {
                                    key: 'cancel',
                                    text: 'Ok',
                                },
                            ],
                            onAction: (action) => {
                                if (action.key === 'copy') {
                                    copyToClipboard(account);
                                    Toast.show({
                                        icon: 'success',
                                        content: 'Address copied to clipboard',
                                    });
                                }
                            },
                        });
                    }}
                            // onClick={() => {
                            //     setVisible(true);
                            // }}
                            >
                                🔒 Address 
                    </List.Item></List>
                    }
                    {
                        inOnNanchat &&
              <div style={{marginTop: 16, marginBottom: 16}}>
                    
                            <BlockChatButton 
                            mode="list"
                            chat={{
                                id: account
                            }} onSuccess={() => {
                                navigate('/chat');
                            }} />
                                        </div>
                        }
                </div>

                <AddContacts
                defaultName={newContactDefaultValues.name}
                defaultAddress={newContactDefaultValues.address}
                defaultNetwork={newContactDefaultValues.network}
                setAddContactVisible={setNewContactVisible}
                addContactVisible={newContactVisible}
                setContactToEdit={setContactToEdit}
                contactToEdit={contactToEdit}
                 />

        </div>
    );
};

export default AccountInfo;