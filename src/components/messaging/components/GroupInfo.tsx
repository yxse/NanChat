import { AddOutline, LockFill, LockOutline, MessageOutline, MinusOutline, PhoneFill, SendOutline, SystemQRcodeOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { useWallet, WalletContext } from "../../Popup";
import { convertAddress, copyToClipboard, formatAddress } from "../../../utils/format";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, Card, DotLoading, Input, List, Modal, NavBar, Popup, Toast } from "antd-mobile";
import useSWR from "swr";
import { addParticipants, fetcherMessages, fetcherMessagesPost, removeParticipants } from "../fetcher";
import { box } from "multi-nano-web";
import ChatInputMessage from "./ChatInputMessage";
import { showActionSheet } from "antd-mobile/es/components/action-sheet/action-sheet";
import useLocalStorageState from "use-local-storage-state";
import ProfilePicture from "./profile/ProfilePicture";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { HeaderStatus } from "./HeaderStatus";
import GroupAvatar from "./group-avatar";
import NewChatPopup from "./NewChatPopup";
import { updateSharedKeys } from "../../../services/sharedkey";
import QRCode from "qrcode.react";
import { useChats } from "../hooks/use-chats";
import { AiOutlineCrown } from "react-icons/ai";
import ProfileName from "./profile/ProfileName";
import { BlockChatButton } from "./NewMessageWarning";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";
import { useTranslation } from 'react-i18next';
import icon from "../../../../public/icons/nanchat.svg"
import MuteNotif from "./MuteNotif";

export const AccountCard = ({ account }) => {
const navigate = useNavigate();
return <div 
onClick={() => {
    navigate(`/chat/${account._id}/info`)
}}
className="" style={{ display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer'}}>
                                <ProfilePicture address={account?._id} key={account?._id} width={58} borderRadius={8} src={account?.profilePicture?.url || false}/>
                                <div
                                className="text-sm text-center"
                                style={{ width: '58px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--adm-color-text-secondary)' }}
                                >
                                    {account.name}
                                </div>
                            </div>
}

const GroupInfo: React.FC<{}> = ({  }) => {
    const { t } = useTranslation();
    const {
        account
    } = useParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { data: names } = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const nameOrAccount = names?.[0]?.name || formatAddress(account);
    const [visible, setVisible] = useState(false);
    const [contacts, setContacts] = useLocalStorageState('contacts', {
        defaultValue: []
    });
    const {chat, mutateChats: mutate} = useChats(account);
    const {activeAccountPk, activeAccount} = useWallet()
    const isAdmin = chat?.creator === activeAccount;
    const [visibleAdd, setVisibleAdd] = useState(false);
    const [visibleRemove, setVisibleRemove] = useState(false);
    const sharedAccount = chat?.sharedAccount?.replace('nano_', 'group_') // replace nano_ prefix just in case to prevent confusion
    useHideNavbarOnMobile(true)
    return (
        <div className="">
            <NavBar
            onBack={() => {
                    if (window.history?.length && window.history.length > 1) {
                        navigate(-1);
                     } else {
                        navigate('/chat', { replace: true });
                     }
            }}
            >
            <div className="flex-1 text-center">
                {chat?.name || t('group')} {t('info')} ({chat?.participants.length})
            </div>
            </NavBar>
            <div style={{marginRight: 12, marginLeft: 12, marginTop: 16}}>
            <Card style={{maxWidth: 576, margin: 'auto'}}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' , alignItems: 'center'}}>
                    {
                        chat?.participants.map((participant, index) => {
                            return (
                            <AccountCard
                            key={index}
                            account={participant}
                            />
                        )})
                    }
                     {/* add & remove with border dash */}
                     <Button
                    style={{width: '58px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', '--border-style': 'dashed', '--border-width': '2px', borderRadius: 8}}
                    onClick={() => {
                        setVisibleAdd(true)
                    }}
                    >
                        <AddOutline fontSize={24} />
                    </Button>
                    {
                        isAdmin &&
                    
                    <Button
                    style={{width: '58px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', '--border-style': 'dashed', '--border-width': '2px', borderRadius: 8}}
                    onClick={() => {
                        setVisibleRemove(true)
                    }}
                    >
                        <MinusOutline fontSize={24} />
                    </Button>
                    }
                </div>
                <NewChatPopup 
                alreadySelected={chat?.participants.map((participant) => participant._id)}
                onAccountSelect={async (accounts) => {
                    let newParticipants = chat?.participants?.map((participant) => participant._id) || []
                    newParticipants = newParticipants.concat(accounts)
                    newParticipants = Array.from(new Set(newParticipants)) // unique
                    await updateSharedKeys(chat?.id, newParticipants, activeAccountPk) // we generate new shared keys for all the participants, eventually we could reuse the sared key when adding participant                    
                    let r = await addParticipants(chat?.id, accounts)
                    if (r.error) {
                        Toast.show({icon: 'fail', content: r.error})
                        return
                    }
                    mutate()
                    setVisibleAdd(false)
                }}
                visible={visibleAdd} setVisible={setVisibleAdd} title={t('addParticipant')} />
                <NewChatPopup 
                hideImportContacts
                accounts={chat?.participants}
                onAccountSelect={async (accounts) => {
                    let newParticipants = chat?.participants?.map((participant) => participant._id) || []
                    newParticipants = newParticipants.filter((participant) => !accounts.includes(participant))
                    await updateSharedKeys(chat?.id, newParticipants, activeAccountPk) 
                    let r = await removeParticipants(chat?.id, accounts)
                    if (r.error) {
                        Toast.show({icon: 'fail', content: r.error})
                        return
                    }
                    mutate()
                    setVisibleRemove(false)

                }}
                visible={visibleRemove} setVisible={setVisibleRemove} title={t('removeParticipant')} />
</Card>
</div>
<div style={{maxWidth: 600, margin: 'auto', marginTop: 16, paddingBottom: 32}}>
<List mode="card">
    {isAdmin && 
            <List.Item
            extra={chat?.name || t('notSet')}
            onClick={() => {
                let modal = Modal.show({
                    closeOnMaskClick: true,
                    title: t('updateGroupName'),
                    content: (
                        <div>
                            <Input
                            maxLength={32}
                                id="group-name"
                                type="text"
                                placeholder={t('newGroupName')}
                                className="w-full mt-2 p-2 rounded-lg"
                            />
                        </div>
                    ),
                    actions: [
                        {
                            key: 'cancel',
                            text: t('cancel'),
                            onClick: () => modal.close()
                        },
                        {
                            key: 'update',
                            text: t('done'),
                            primary: true,
                            onClick: async () => {
                                let r = await fetcherMessagesPost('/update-group-name', {
                                    "name": (document.getElementById('group-name') as HTMLInputElement).value,
                                    "chatId": chat?.id
                                })
                                if (r.error) {
                                    Toast.show({icon: 'fail', content: r.error})
                                    return
                                }
                                else{
                                    Toast.show({icon: 'success'})
                                    mutate()
                                    modal.close();
                                }
                            }
                        }
                    ]
                });
            }}
        >
            {t('groupName')}
        </List.Item>}
            <List.Item
            extra={<SystemQRcodeOutline />}
                onClick={() => {
                    let modal = Modal.show({
                        showCloseButton: true,
                        closeOnMaskClick: true,
                        content: (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <GroupAvatar chat={chat} />
                                    {chat?.name || t('newGroup')}
                                </div>
                                <QRCode
                                imageSettings={{
                                              src: icon,
                                              height: 24,
                                              width: 24,
                                              excavate: false,
                                            }}
                                includeMargin
                                value={"https://nanchat.com/chat/" + chat?.id + "?join"}
                                size={256}
                                style={{borderRadius: 8}}
                                />
                                <div style={{color: 'var(--adm-color-text-secondary)', marginTop: 16, textAlign: 'center', maxWidth: 256}}>
                                    {t('validUntil100Members')}
                                </div>
                            </div>
                        ),
                    });
                }}
            >
                {t('groupQrCode')}
            </List.Item>
           
            </List>
            <MuteNotif />
            <List style={{}} mode="card">
            <List.Item
            extra={<div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <AccountIcon account={chat?.creator} width={24} />
                <ProfileName address={chat?.creator} />
                </div>}
                onClick={() => {
                    navigate(`/chat/${chat?.creator}/info`)
                }}
            >
                {t('admin')}
            </List.Item>
            <List.Item
            extra={formatAddress(sharedAccount)}
                onClick={() => {
                    let modal = Modal.show({
                        closeOnMaskClick: true,
                        content: (
                            <div>
                                <div 
                                    style={{wordBreak: 'break-all', textAlign: 'center', maxWidth: "200px", margin: "auto"}}
                                    onClick={() => {
                                        Toast.show({
                                            content: t('copied'),
                                            duration: 2000
                                        });
                                        copyToClipboard(sharedAccount);
                                    }}>
                                        {sharedAccount}
                                    </div>
                                <div style={{color: 'var(--adm-color-text-secondary)', marginTop: 16, maxWidth: 256}}>
                                    {t('publicAccountE2EInfo')}
                                </div>
                            </div>
                        ),
                    });
                }}
            >
                <LockOutline style={{display: 'inline', marginRight: 8}} />
                {t('sharedKey')}
            </List.Item>
            </List>
                <BlockChatButton
                mode="list"
                chat={chat}
                onSuccess={() => {
                    navigate('/chat')

                }}
                />
            </div>

        </div>
    );
};

export default GroupInfo;