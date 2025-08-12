import { List, Switch, Toast } from 'antd-mobile'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChat } from '../hooks/useChat'
import { useParams } from 'react-router-dom';
import { useChats } from '../hooks/use-chats';
import NotificationIsDisabled from '../../app/NotificationIsDisabled';

function MuteNotif() {
    const { t } = useTranslation()
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
                    Toast.show({ content: t('errorWithMessage', { error: String(error) }) })                    
                }
            }}
            checked={chat?.muted} />
        }
        >
            {t('muteNotifications')}
        </List.Item>
    </List>
    {
        !chat?.muted && <NotificationIsDisabled />
    }
            </>
  )
}

export default MuteNotif