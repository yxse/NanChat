import { Button, List, Modal, Toast } from 'antd-mobile'
import React, { useState } from 'react'
import useLocalStorageState from 'use-local-storage-state';
import { fetcherMessages, fetcherMessagesPost } from '../fetcher';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { formatAddress } from '../../../utils/format';
import { useChats } from '../hooks/use-chats';
import { ChatCheckOutline, ChatWrongOutline } from 'antd-mobile-icons';
import { useWallet } from '../../Popup';
import { ChatName } from '../../app/discover/Discover';

export function BlockChatButton({chat, onSuccess, mode='button'}) {
    const {blockChat} = useChats();
    const {activeAccount} = useWallet();

    const showModal = () => {
        Modal.show({
            closeOnMaskClick: true,
            closeOnAction: true,
            title: <div>{chat?.type === "group" ? "Leave" : "Block"} <ChatName chat={chat} activeAccount={activeAccount} /></div>,
            actions: [
                { 
                    text: <div style={{display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center'}}>
                            <ChatWrongOutline />
                            {chat?.type === "group" ? "Leave" : "Block"}
                        </div>
                    ,
                    key: 'block',
                    danger: true, 
                    onClick: async () => {
                        Toast.show({
                            icon: 'loading',
                        })
                        try {
                            await blockChat(chat.id);
                            onSuccess();
                        } catch (error) {
                            console.error(error)
                        } finally {
                            Toast.clear()
                        }
                    }
                },
                { text: 'Cancel', key: 'cancel' }
            ]
        })
    }
    if (mode === 'list') {
        return <List mode='card'><List.Item
            onClick={async () => {
                showModal();
            }}
            className=""
            style={{cursor: 'pointer'}}
            >
                <div style={{color: 'var(--adm-color-danger)', textAlign: 'start'}}>
                {chat?.type === "group" ? "Leave" : "Block"}
                </div>
        </List.Item>
        </List>
    }
    return <div 
            onClick={async () => {
                showModal();
            }}
            className="w-full mt-4"
            style={{cursor: 'pointer'}}
            >
                <div style={{color: 'var(--adm-color-danger)', textAlign: 'center'}}>
                Block
                </div>
        </div>
}

function NewMessageWarning({fromAddress, account, chat}) {
    const [contacts, setContacts] = useLocalStorageState('contacts', {
        defaultValue: []
    });
    const chatId = chat.id;
    const [isLoading, setIsLoading] = useState(false);
    const {mutateChats: mutate, blockChat} = useChats();
    const navigate = useNavigate();

    const inContacts = contacts.find((contact) => contact.addresses.find((address) => address.address === fromAddress));
  return (
        <div className="p-4 " style={{ backgroundColor: 'var(--adm-color-background)' }}>
            <div className='text-center'>
            <div className="mb-2 text-lg" >
                {formatAddress(fromAddress)}
            </div></div>
            <div className='text-center mb-4 text-lg' style={{color: 'var(--adm-color-text-secondary)'}}>
                {
                    inContacts ? (
                        <div>
                            In your contacts as {inContacts.name}
                        </div>
                    ) : (
                        <div>
                            Not a contact
                        </div>
                    )
                }
            </div>
            <div style={{}}>
            <Button
            loading={isLoading}
            onClick={async () => {
                setIsLoading(true)
                try {
                    await fetcherMessagesPost('/accept-chat', {
                        chatId: chatId
                    })
                    await mutate()
                } catch (error) {
                    console.error(error)                    
                } finally {
                    setIsLoading(false)
                }
                                
            }}
            className="w-full"
            size="large"
            shape="rounded"
            color='primary'
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4}}>
                Accept chat
                </div>
            </Button>
            <BlockChatButton 
            chat={chat} onSuccess={() => {
                navigate('/chat');
            }} />
</div>
        </div>
  )
}

export default NewMessageWarning