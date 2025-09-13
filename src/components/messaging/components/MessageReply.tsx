import React from 'react'
import Message from './Message'
import MessageRaw from './MessageRaw'
import { CloseCircleFill, CloseCircleOutline } from 'antd-mobile-icons'
import { useEmit } from './EventContext'

function MessageReply({message, onClose}) {
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
                onClose?.()
            }}
            />
            </div>
    <MessageRaw
    key={message._id}
    includeProfileName={true}
    message={message}
    ellipsis
    type="input-reply"
    />
    </div>
  )
}

export default MessageReply