import { List } from 'antd-mobile';
import GroupName from './GroupName';
import { ChatAvatar } from '../ChatList';
import { useNavigate } from 'react-router-dom';

function GroupList({groups}) {
    const navigate = useNavigate();
    const GroupItem = ({chat}) => {
        return <List.Item
            key={chat.id}
            arrowIcon={false}
            onClick={() => {
                navigate(`/chat/${chat.id}`);
            }}
            prefix={
                <div style={{ paddingTop: 8, paddingBottom: 8 }}>
                    <ChatAvatar chat={chat} />
                </div>
            }
        >
            <GroupName chat={chat} isInVirtualList={false} />
        </List.Item>
    }
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