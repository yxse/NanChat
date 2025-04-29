import React from 'react'
import Message from './Message'
import MessageRaw from './MessageRaw'
import { CloseCircleFill, CloseCircleOutline } from 'antd-mobile-icons'
import { useEmit } from './EventContext'

function MessageReply({message}) {
    const emit = useEmit()
    if (!message) return null
  return (
    <div style={{}}>
        <div style={{
            float: 'right',
            marginTop: 4,
            marginLeft: 4,
        }}>
            <CloseCircleFill
            style={{cursor: 'pointer'}} 
            onClick={() => {
                emit('reply-message', null)
            }}
            />
            </div>
    <MessageRaw
    key={message._id}
    message={{
        ...message,
        type: 'reply',
    }}
    />
    </div>
  )
}

export default MessageReply