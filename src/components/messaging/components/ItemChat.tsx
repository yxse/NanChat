import { List } from "antd-mobile";
import { ChatAvatar } from "./ChatList";
import { useWallet } from "../../Popup";

export const ItemChat = ({ chat, onClick }) => {
    return (
        <List.Item
            clickable={false}
            onClick={() => onClick(chat)}
            prefix={
                <ChatAvatar chat={chat} />
            }
        >
            <div style={{wordBreak: "break-all"}} className="flex items-center gap-2">

            <ChatName chat={chat} />
            </div>
        </List.Item>
    );
}

export const ChatName = ({ chat, activeAccount }) => {
    if (!activeAccount){ // pass activeAccount as param because useWallet doesnt work in Modal.show 
        const { activeAccount: activeAccountWallet} = useWallet();
        activeAccount = activeAccountWallet
    }
    return chat?.type === "group" ? (chat?.name || "Group Chat") : (chat?.participants?.find(participant => participant._id !== activeAccount)?.name)
}