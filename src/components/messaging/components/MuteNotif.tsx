import { List, Switch, Toast } from 'antd-mobile'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom';
import { useChats } from '../hooks/use-chats';
import NotificationIsDisabled from '../../app/NotificationIsDisabled';
import { BellMuteOutline } from 'antd-mobile-icons';

// sub settings, indented under their parent setting
const subItemStyle = (level: number) => ({
    '--padding-left': `${12 + level * 28}px`,
    fontSize: 15,
} as React.CSSProperties)

function MuteNotif() {
    const { t } = useTranslation()
    const {
            account
        } = useParams();
    const {chat, muteNotifChat, setChatNotificationSetting} = useChats(account)
    const isGroup = chat?.type === "group"

    const onSettingChange = async (key: 'mutedMentions' | 'mutedEveryone', notify: boolean) => {
        try {
            await setChatNotificationSetting(key, !notify)
        } catch (error) {
            Toast.show({ content: t('errorWithMessage', { error: String(error) }) })
        }
    }
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
            <BellMuteOutline style={{display: "inline", marginRight: 8}} />
            {t('muteNotifications')}
        </List.Item>
        {
            // exceptions to the mute: only relevant when the group is muted (unmuted, every message notifies)
            isGroup && chat?.muted && <>
            <List.Item
            style={subItemStyle(1)}
            extra={<Switch
                onChange={(checked) => onSettingChange('mutedMentions', checked)}
                checked={!chat?.mutedMentions} />}
            >
                {t('notifyMentions')}
            </List.Item>
            <List.Item
            style={subItemStyle(1)}
            extra={<Switch
                onChange={(checked) => onSettingChange('mutedEveryone', checked)}
                checked={!chat?.mutedEveryone} />}
            >
                {t('notifyMentionEveryone')}
            </List.Item>
            </>
        }
    </List>
    {
        !chat?.muted && <NotificationIsDisabled />
    }
            </>
  )
}

export default MuteNotif
