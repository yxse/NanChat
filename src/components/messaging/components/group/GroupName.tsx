function GroupName({chat, isInVirtualList = true}) {
    return (
          <div
                style={{
                    "whiteSpace": "nowrap",
                    "textOverflow": "ellipsis",
                    "overflow": "hidden",
                    "display": "flow",
                    "containerType": isInVirtualList ? 'normal' : 'inline-size',
                }}
            >
                 {chat.name || chat.participants.slice(0, 9).map(p => p.name).join(', ')}
            </div>
    )
}

export default GroupName