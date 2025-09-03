import { List } from "antd-mobile";
import { ItemChat } from "./ItemChat";

export const ChatListItems = ({ chats, onClick, viewTransition = true, selectedAccounts, setSelectedAccounts, alreadySelected }) => {
    return (
        <div>

        <List
        value={selectedAccounts}
        onChange={(v) => {
            setSelectedAccounts(v)
        }}
         extra={null}
 
         >
           
            {
                chats?.map(chat => (
                   <ItemChat key={chat.id} chat={chat} onClick={onClick} />
                ))
            }
        </List>
            </div>
    );
}