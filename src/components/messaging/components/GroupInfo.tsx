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
import { Button, Card, DotLoading, Input, List, Modal, Popup, Toast } from "antd-mobile";
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

export const AccountCard = ({ account }) => {

return <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 2}}>
                                <ProfilePicture address={account?._id} key={account?._id} width={58} borderRadius={8}/>
                                <div
                                className="text-sm text-center"
                                style={{ width: '58px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--adm-color-text-secondary)' }}
                                >
                                    {account.name}
                                </div>
                            </div>
}

const GroupInfo: React.FC<{}> = ({  }) => {
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
    const inContacts = contacts.find((contact) => contact.addresses.find((address) => address.address === account));
    const {chat, mutateChats: mutate} = useChats(account);
    const [visibleAdd, setVisibleAdd] = useState(false);
    const [visibleRemove, setVisibleRemove] = useState(false);
    const {activeAccountPk, activeAccount} = useWallet()
    const sharedAccount = chat?.sharedAccount?.replace('nano_', 'group_') // replace nano_ prefix just in case to prevent confusion
    return (
        <div className="">
            <List.Item

            // prefix={
            //     <AccountIcon account={account} width={48} />
            // }
            >
                <div
                onClick={() => {
                    
                }}
                    // style={{ height: '5vh' }}
                    className="flex items-center">
                    <BiChevronLeft
                        onClick={(e) => {
                            if (window.history?.length && window.history.length > 1) {
                                navigate(-1);
                             } else {
                                navigate('/chat', { replace: true });
                             }
                        }}
                        className="w-8 h-8 text-gray-500 cursor-pointer" />
                    
                    <div className="flex-1 text-center">
                        {chat?.name || 'Group '} Info ({chat?.participants.length})
                    </div>
                </div>
            </List.Item>
            <Card style={{maxWidth: 600, margin: 'auto', marginTop: 16}}>
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
                    <Button
                    style={{width: '58px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', '--border-style': 'dashed', '--border-width': '2px', borderRadius: 8}}
                    onClick={() => {
                        setVisibleRemove(true)
                    }}
                    >
                        <MinusOutline fontSize={24} />
                    </Button>
                </div>
                <NewChatPopup 
                alreadySelected={chat?.participants.map((participant) => participant._id)}
                onAccountSelect={async (accounts) => {
                    let newParticipants = chat?.participants?.map((participant) => participant._id) || []
                    newParticipants = newParticipants.concat(accounts)
                    await updateSharedKeys(chat?.id, newParticipants, activeAccountPk) // we generate new shared keys for all the participants, eventually we could reuse the sared key when adding participant                    
                    let r = await addParticipants(chat?.id, accounts)
                    if (r.error) {
                        Toast.show({icon: 'fail', content: r.error})
                        return
                    }
                    mutate()
                    setVisibleAdd(false)
                }}
                visible={visibleAdd} setVisible={setVisibleAdd} title="Add Participant" />
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
                visible={visibleRemove} setVisible={setVisibleRemove} title="Remove Participant" />
</Card>
<div style={{maxWidth: 600, margin: 'auto', marginTop: 16}}>
<List >
            <List.Item
            extra={chat?.name || 'Not Set'}
            onClick={() => {
                let modal = Modal.show({
                    closeOnMaskClick: true,
                    title: 'Update Group Name',
                    content: (
                        <div>
                            <Input
                            maxLength={32}
                                id="group-name"
                                type="text"
                                placeholder="New Group Name"
                                className="w-full mt-2 p-2 rounded-lg"
                            />
                        </div>
                    ),
                    actions: [
                        {
                            key: 'cancel',
                            text: 'Cancel',
                            onClick: () => modal.close()
                        },
                        {
                            key: 'update',
                            text: 'Done',
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
            }
        }
            >
                Group Name
            </List.Item>
            <List.Item
            extra={<SystemQRcodeOutline />}
                onClick={() => {
                    let modal = Modal.show({
                        showCloseButton: true,
                        closeOnMaskClick: true,
                        content: (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <GroupAvatar chatId={chat?.id} />
                                    {chat?.name || 'New group'}
                                </div>
                                <QRCode
                                includeMargin
                                value={"https://nanchat.com/chat/" + chat?.id}
                                size={256}
                                />
                                <div style={{color: 'var(--adm-color-text-secondary)', marginTop: 16, textAlign: 'center', maxWidth: 256}}>
                                    Valid until group has 100 members. Approval by a member is required to join.
                                </div>

                            </div>
                        ),
                    });
                }}
            >
                Group QR Code  
            </List.Item>
           
            </List>
            <List style={{marginTop: 16}}>
            <List.Item
            extra={<div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <AccountIcon account={chat?.creator} width={24} />
                <ProfileName address={chat?.creator} />
                </div>}
                onClick={() => {
                    navigate(`/chat/${chat?.creator}/info`)
                }}
            >
                Admin
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
                                                                content: 'Copied',
                                                                duration: 2000
                                                            });
                                                            copyToClipboard(sharedAccount);
                                                        }}>
                                                           {sharedAccount}
                                                        </div>
                                
                                <div style={{color: 'var(--adm-color-text-secondary)', marginTop: 16, maxWidth: 256}}>
                                Public account used for end-to-end encryption. Verify it with the group by a secure mean for a guaranteed end-to-end encryption. A new account is generated each time a participant join or leave the group.  
                                </div>

                            </div>
                        ),
                    });
                }}
            >
                Shared Key 
            </List.Item>
            </List>

            </div>

        </div>
    );
};

export default GroupInfo;