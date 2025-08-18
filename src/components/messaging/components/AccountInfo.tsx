import { EditSOutline, InformationCircleOutline, LockFill, LockOutline, MessageOutline, PhoneFill, QuestionCircleOutline, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, copyToClipboard, formatAddress } from "../../../utils/format";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, Card, Divider, DotLoading, Input, List, Modal, NavBar, Popup, Toast } from "antd-mobile";
import useSWR from "swr";
import { fetcherAccount, fetcherMessages, fetcherMessagesPost } from "../fetcher";
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
import { useTranslation } from 'react-i18next';
import MuteNotif from "./MuteNotif";

const AccountInfo: React.FC<{}> = ({ onlineAccount }) => {
    const { t } = useTranslation();
    const {
        account
    } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const ticker = searchParams.get('ticker');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
 
    const {chats} = useChats();
    const chat =  chats?.find((chat) => chat.type === "private" && chat?.participants?.find((participant) => participant._id === account));
    const chatsInCommon = chats?.filter(
        (chat) => chat.type === "group" && chat?.participants?.find((participant) => participant._id === account) && chat?.accepted === true && chat?.blocked === false)
    const chatsInCommonLength = chatsInCommon?.length || 0;
    const { data: name } = useSWR<Chat[]>('nano_' + account?.split('_')[1], fetcherAccount);
    const {data: isBlocked} = useSWR(`/is-blocked?address=${account}`, fetcherMessages, {fallback: false});

    const nameOrAccount = name?.name || formatAddress(account);
    const {getContact} = useContact();
    const [visible, setVisible] = useState(false);
    const messageInputRef = useRef(null);

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
    const inContacts = contacts?.find((contact) => contact.addresses?.find((address) => address.address === account));

    const inOnNanchat = name?._id === convertAddress(account, 'XNO');
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
                    inContacts && t('edit')
                }
            </div>}
            onBack={() => {
                if (window.history?.length && window.history.length > 1) {
                    navigate(-1);
                 } else {
                    navigate('/chat', { replace: true });
                 }
            }}
            >{t('contacts')}
            </NavBar>
                <div style={{marginRight: 12, marginLeft: 12, marginTop: 16}}>
            <Card style={{maxWidth: 576, margin: 'auto'}}>
             
             {
                inOnNanchat ? 
                <div>
                    <div style={{display: "flex", alignItems: "center", gap: 8}} className="text-2xl">
                <ProfilePicture address={convertAddress(account, 'XNO')} width={72} clickable/>
                <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                <ProfileName address={convertAddress(account, 'XNO')} />
                <div style={{color: 'var(--adm-color-text-secondary)'}} className="text-base">
                    {t('nanChatId')}: {name?.username}
                </div>
                {
                    chatsInCommonLength > 0 ?
                <div style={{color: 'var(--adm-color-text-secondary)'}} className="text-base">
                    {chatsInCommonLength} {t('group')}{chatsInCommonLength > 1 ? 's' : ''} {t('inCommon')}
                </div>
                :
                <div style={{color: 'var(--adm-color-warning)'}} className="text-base">
                    {t('noGroupInCommon')}
                </div>
                }
                </div>
                </div>
                </div>
                : 
                <div>
                <div style={{display: "flex", alignItems: "center", gap: 8}} className="text-2xl">
            <ProfilePicture address={convertAddress(account, 'XNO')} width={72} clickable/>
            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
            {contact ? contact.name : "Unknown"}
            <div style={{color: 'var(--adm-color-text-secondary)'}} className="text-base">
                {t('notOnNanChat')}
            </div>
            </div>
            </div>
            </div>
                }
                </Card>
                </div>
                {
                    isBlocked?.blocked ? <div className="text-center "><div className="mt-4 mb-4" style={{wordBreak: 'break-all', padding: 16}}>
                        {t('blockedAccount', { account })}
                        </div>
                        <div className="text-sm" style={{color: 'var(--adm-color-text-secondary)'}}>
                        {t('unblockAccount', { account })}
                        </div>
                        </div>
                        : 
                
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
                                name: inOnNanchat ? nameOrAccount : "",
                                network: inOnNanchat ? 'ALL': (ticker || 'XNO'),
                                address: account
                            });
                            // navigate(`/contacts/?address=${account}&name=${nameOrAccount}&add=true&network=XNO`);
                        }}>
                            {t('createNewContact')}
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
                    inContacts ? 
                    contact?.addresses[0].network === 'ALL' ? [] : (inOnNanchat ? [] : [contact?.addresses[0].network])
                    : (inOnNanchat ? [] : [ticker || 'XNO'])
                } 
                mode={"list"}
                toAddress={account} onTipSent={(ticker, hash) => {
                    if (inOnNanchat){ // send the tip message only if in nanchat
                        messageInputRef?.sendTip(ticker, hash, account);
                    }
                    }} />
                </List>
                <ChatInputMessage 
                hideInput
                    onSent={async () => {
                        // Toast.show({
                        //     icon: "success",
                        //     content: "Sent",
                        //     duration: 1000
                        // })
                    }}
                        defaultNewMessage={undefined}
                        defaultChatId={chat?.id}
                        messageInputRef={messageInputRef}
                    />
                    {
                        name?.bio && <List mode="card" >
                            <List.Item style={{wordBreak: "break-all"}}>
                                <InformationCircleOutline style={{display: "inline", marginRight: 8}} />
                                {/* About */}
                                {name?.bio}
                            </List.Item>
                        </List>
                    }
                    {
                        inOnNanchat && 
                    <MuteNotif />
                    }
                    <List mode="card" style={{}}>
                <List.Item
                    extra={formatAddress(account)}
                    onClick={() => {
                        Modal.show({
                            showCloseButton: true,
                            closeOnMaskClick: true,
                            closeOnAction: true,
                            title: `${nameOrAccount}'s account:`,
                            content: (
                                <div className="text-center">
                                    <p className="break-all  p-4">
                                        {account}
                                    </p>
                                    <p style={{color: 'var(--adm-color-text-secondary)'}} className="text-sm">
                                        {t('verifyWithAndSave', { nameOrAccount })}
                                    </p>
                                </div>
                            ),
                            actions: [
                                {
                                    key: 'copy',
                                    text: t('copyAddress'),
                                },
                                {
                                    key: 'cancel',
                                    text: t('cancel'),
                                },
                            ],
                            onAction: (action) => {
                                if (action.key === 'copy') {
                                    copyToClipboard(account);
                                    Toast.show({
                                        icon: 'success',
                                        content: t('addressCopiedToClipboard'),
                                    });
                                }
                            },
                        });
                    }}
                            // onClick={() => {
                            //     setVisible(true);
                            // }}
                            >
                                <LockOutline style={{display: 'inline-block', marginRight: 8}} />
                                {t('address')}
                    </List.Item></List>
                   
              <div style={{ marginBottom: 16}}>
                    
                            <BlockChatButton 
                            mode="list"
                            chat={
                            inOnNanchat ? chat :
                             {id: account} // if not on nanchat, can still block the account (chatId = account)
                            } onSuccess={() => {
                                navigate(-1);
                            }} />
                                        </div>
                </div>
                }

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