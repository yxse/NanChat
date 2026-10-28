import { List } from 'antd-mobile';
import GroupName from './GroupName';
import { ChatAvatar } from '../ChatList';
import { useNavigate } from 'react-router-dom';

export const GroupItem = ({chat, arrowIcon = false, compact = false}) => {
        const navigate = useNavigate();
        return <List.Item
            key={chat.id}
            arrowIcon={arrowIcon}
            onClick={() => {
                navigate(`/chat/${chat.id}`);
            }}
            prefix={
                <div style={compact ? { paddingTop: 2, paddingBottom: 2, zoom: 0.75 } : { paddingTop: 8, paddingBottom: 8 }}>
                    <ChatAvatar chat={chat} />
                </div>
            }
        >
            <GroupName chat={chat} isInVirtualList={false} />
        </List.Item>
}

function GroupList({groups}) {
    return (
        <div>

        <List>
            {groups.map(group => (
                <GroupItem key={group.id} chat={group}  />
            ))}
        </List>

        </div>
    )
}

export default GroupList