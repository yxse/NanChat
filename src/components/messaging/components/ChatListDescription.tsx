import MessageJoinRequest from "./MessageJoinRequest"
import MessageRaw from "./MessageRaw"
import MessageSystem from "./MessageSystem"

export const ChatListDesciption = ({chat, message}) => {
          if (chat.lastMessageType === "system" || chat.lastMessageType === "transfer"){
            return <div style={{ 
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            containerType: 'inline-size',
        }} ><MessageSystem raw message={message} /></div>
          }
          if (chat.lastMessageType === "join-request"){
            return <div style={{ 
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            containerType: 'inline-size',
        }}><MessageJoinRequest raw message={message} /></div>
          }
          return <MessageRaw 
                    key={chat.lastMessageId}
                    includeProfileName={chat.type === "group"}
                    message={message} />
        }