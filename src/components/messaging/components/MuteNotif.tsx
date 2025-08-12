import { List, Switch, Toast } from 'antd-mobile'
import React, { useState } from 'react'
import { useChat } from '../hooks/useChat'
import { useParams } from 'react-router-dom';
import { muteChat, unmuteChat } from '../fetcher';
import { useChats } from '../hooks/use-chats';
import NotificationIsDisabled from '../../app/NotificationIsDisabled';

function MuteNotif() {
    const {
            account
        } = useParams();
    const {chat, muteNotifChat} = useChats(account)
    console.log({chat})
  return (
    <>
    <List mode='card'>
        <List.Item
        extra={<Switch
            onChange={async (checked) => {
                try {
                    await muteNotifChat(checked)
                } catch (error) {
                    Toast.show({content: "Error: " + error})                    
                }
            }}
            checked={chat?.muted} />
        }
        >
            Mute Notifications
        </List.Item>
    </List>
    <NotificationIsDisabled />
            </>
  )
}

export default MuteNotif