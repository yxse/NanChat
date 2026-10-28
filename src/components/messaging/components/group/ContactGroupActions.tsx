import { useState } from "react";
import { List, Modal, Toast } from "antd-mobile";
import { AddCircleOutline } from "antd-mobile-icons";
import { AiOutlineUsergroupAdd } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWallet } from "../../../useWallet";
import { useChats } from "../../hooks/use-chats";
import { fetcherMessagesPost } from "../../fetcher";
import { updateSharedKeys } from "../../../../services/sharedkey";
import { ResponsivePopup } from "../../../Settings";
import { ChatListItems } from "../ChatListItems";
import NewChatPopup from "../NewChatPopup";
import { addAccountsToGroup } from "./GroupParticipants";

// "Create group with [name]" and "Add to group" actions on the contact info page
const ContactGroupActions = ({ account, name }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { activeAccount, activeAccountPk } = useWallet();
    const { chats, mutateChats } = useChats();
    const [createGroupKey, setCreateGroupKey] = useState(0); // remount NewChatPopup on open so the contact is preselected again
    const [createGroupVisible, setCreateGroupVisible] = useState(false);
    const [addToGroupVisible, setAddToGroupVisible] = useState(false);

    const groupsWithoutContact = chats?.filter(
        (chat) => chat.type === "group" && chat?.accepted === true && chat?.blocked === false
            && !chat?.participants?.find((participant) => participant._id === account))

    const createGroup = async (accounts: string[]) => {
        let r = await fetcherMessagesPost('/chat', {
            "type": "group",
            "participants": Array.from(new Set(accounts.concat(account, activeAccount)))
        })
        if (r.error) {
            Toast.show({icon: 'fail', content: r.error})
            return
        }
        await updateSharedKeys(r.id, r.participants.map(participant => participant._id), activeAccountPk);
        Toast.show({icon: 'success'})
        navigate(`/chat/${r.id}`)
    }

    const addToGroup = async (chat) => {
        const confirmed = await Modal.confirm({
            content: t('addToGroupConfirm', { name, group: chat?.name || t('group') }),
            confirmText: t('add'),
            cancelText: t('cancel'),
        })
        if (!confirmed) return
        Toast.show({icon: 'loading', duration: 0})
        let r = await addAccountsToGroup(chat, [account], activeAccountPk)
        if (r.error) {
            Toast.show({icon: 'fail', content: r.error})
            return
        }
        mutateChats()
        setAddToGroupVisible(false)
        Toast.show({icon: 'success'})
    }

    return <>
        <List.Item
            prefix={<AddCircleOutline />}
            arrowIcon={false}
            onClick={() => {
                setCreateGroupKey(key => key + 1)
                setCreateGroupVisible(true)
            }}
        >
            {t('createGroupWith', { name })}
        </List.Item>
        <List.Item
            prefix={<AiOutlineUsergroupAdd />}
            arrowIcon={false}
            onClick={() => {
                if (!groupsWithoutContact?.length) {
                    Toast.show({content: t('noGroupToAddTo')})
                    return
                }
                setAddToGroupVisible(true)
            }}
        >
            {t('addToGroup')}
        </List.Item>
        <NewChatPopup
            key={createGroupKey}
            title={t('createGroupWith', { name })}
            alreadySelected={[account]}
            onAccountSelect={createGroup}
            visible={createGroupVisible}
            setVisible={setCreateGroupVisible}
        />
        <ResponsivePopup
            showCloseButton
            destroyOnClose
            visible={addToGroupVisible}
            onClose={() => setAddToGroupVisible(false)}
            closeOnMaskClick
        >
            <div className="text-xl text-center p-2">
                {t('addToGroup')}
            </div>
            <div style={{maxHeight: '400px', overflow: 'scroll'}}>
                <ChatListItems
                    onClick={addToGroup}
                    chats={groupsWithoutContact}
                />
            </div>
        </ResponsivePopup>
    </>
}

export default ContactGroupActions;
