import { useRef, useState } from "react";
import { Button, List, Space, Toast } from "antd-mobile";
import { UploadOutline } from "antd-mobile-icons";
import { useTranslation } from "react-i18next";
import { ResponsivePopup } from "../../../Settings";
import { useChats } from "../../hooks/use-chats";
import { ChatListItems } from "../ChatListItems";
import { ItemChat } from "../ItemChat";
import { MetadataCard } from "../antd-mobile-metadata-card";
import ChatInputMessage from "../ChatInputMessage";

// Share a contact to a chat, similar to "Share to Chat" in Discover.
// The contact is sent as a nanchat.com/chat/nano_xxx link, rendered as a contact card by MetadataCard.
const ShareContactButton = ({ address }) => {
    const { t } = useTranslation();
    const { chats } = useChats();
    const [visible, setVisible] = useState(false);
    const [visibleMessage, setVisibleMessage] = useState(false);
    const [selectedChat, setSelectedChat] = useState(null);
    const inputRef = useRef(null);
    const contactLink = `https://nanchat.com/chat/${address}`;

    return <>
        <List.Item style={{color: 'var(--adm-color-primary)'}} arrowIcon={false} onClick={() => setVisible(true)}>
            {t('shareContact')}
        </List.Item>
        <ResponsivePopup
            showCloseButton
            destroyOnClose
            visible={visible}
            onClose={() => setVisible(false)}
            closeOnMaskClick
        >
            <div className="text-xl text-center p-2">
                {t('shareToChat')}
            </div>
            <div style={{height: '300px', overflow: 'scroll'}}>
                <ChatListItems
                    onClick={(chat) => {
                        setSelectedChat(chat)
                        setVisibleMessage(true)
                    }}
                    chats={chats}
                />
            </div>
        </ResponsivePopup>
        <ResponsivePopup
            bodyStyle={{ maxHeight: '600px', overflow: 'scroll'}}
            visible={visibleMessage}
            onClose={() => setVisibleMessage(false)}
            closeOnMaskClick
            destroyOnClose
        >
            <div>
                <div className="p-2">
                    {t('sendTo')}
                </div>
                <List style={{marginBottom: 8}}>
                    <ItemChat chat={selectedChat} onClick={() => {}} />
                </List>
                <div style={{display: 'flex', justifyContent: 'center'}}>
                    <MetadataCard message={contactLink} />
                </div>
                <ChatInputMessage
                    hideInput
                    onSent={async () => {
                        Toast.show({
                            icon: "success",
                            content: t('sent'),
                            duration: 1000
                        })
                        setVisibleMessage(false)
                        setVisible(false)
                    }}
                    defaultNewMessage={contactLink}
                    defaultChatId={selectedChat?.id}
                    messageInputRef={inputRef}
                />
                <Space style={{gap: 32, width: "100%"}} align="center" className="p-4" justify="center">
                    <Button onClick={() => setVisibleMessage(false)} color="default">
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={(e) => {
                            inputRef?.send(e, true)
                        }}
                        color="primary">
                        {t('send')}
                    </Button>
                </Space>
            </div>
        </ResponsivePopup>
    </>
}

export default ShareContactButton;
