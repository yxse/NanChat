const MessageSticker = ({ message, side, raw = false }) => {
    const url = message.stickerId;

    const imgStyle = { height: '75px', marginBottom: 0, objectFit: 'contain' as const, userSelect: 'none' as const, WebkitUserSelect: 'none' as const, pointerEvents: 'none' as const };

    if (raw) {
        return <img src={url} draggable={false} style={imgStyle} />;
    }
    return (
        <div
        key={message._id + "-sticker"}>
            <div className={`rounded-lg ${side === "from" ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                <p>
                    <img src={url} draggable={false} style={imgStyle} />
                </p>
            </div>
        </div>
    );
};

export default MessageSticker;
