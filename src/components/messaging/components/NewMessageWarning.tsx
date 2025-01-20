import { Button, Modal } from 'antd-mobile'
import React, { useState } from 'react'
import useLocalStorageState from 'use-local-storage-state';
import { fetcherMessages, fetcherMessagesPost } from '../fetcher';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';

function NewMessageWarning({fromAddress, account, chatId}) {
    const [contacts, setContacts] = useLocalStorageState('contacts', {
        defaultValue: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const {mutate} = useSWR<Chat[]>(`/chats`, fetcherMessages);
    const navigate = useNavigate();

    const inContacts = contacts.find((contact) => contact.addresses.find((address) => address.address === fromAddress));
  return (
        <div className="p-4 " style={{ backgroundColor: 'var(--adm-color-background)' }}>
            <div className="text-center text-lg mb-4">
                New message from 
                <div
                className="break-all"
                >{fromAddress}</div>
            </div>
            <div className='text-center mb-4'>
                {
                    inContacts ? (
                        <b>
                            In your contacts as {inContacts.name}
                        </b>
                    ) : (
                        <b>
                            Not in your contacts
                        </b>
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
            color="primary">
                Accept chat
            </Button>
            <Button 
            onClick={async () => {
                Modal.show({
                    closeOnMaskClick: true,
                    closeOnAction: true,
                    title: 'Block chat',
                    content: 'It is not possible to undo this operation, and the conversation history will be deleted from your inbox.', 
                    actions: [
                        { 
                            text: 'Block', 
                            key: 'block',
                            danger: true, 
                            onClick: async () => {
                                setIsLoading(true)
                                try {
                                    await fetcherMessagesPost('/block-chat', {
                                        chatId: chatId
                                    })
                                    await mutate()
                                    navigate('/chat')
                                } catch (error) {
                                    console.error(error)
                                } finally {
                                    setIsLoading(false)
                                }
                            }
                        },
                        { text: 'Cancel', key: 'cancel' }
                    ]
                })
            }}
            className="w-full mt-4"
            size="large"
            shape="rounded"
            color="danger">
                Block
            </Button>
</div>
        </div>
  )
}

export default NewMessageWarning