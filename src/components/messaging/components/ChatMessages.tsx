import { DotLoading } from "antd-mobile";
import { List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import Message from "./Message";
import { TEAM_ACCOUNT } from "../utils";
import { useRef, useEffect, useState } from 'react';


// Virtual List for ChatRoom messages - WIP - too much flickering and scroll issues
const VirtualMessageList = ({
    messages = [],
    hasMore,
    isLoadingMore,
    loadMore,
    activeAccount,
    activeAccountPk,
    chat,
    setAutoScroll,
    messagesEndRef,
    // infiniteScrollRef,
}) => {
    const [scrollDisabled, setScrollDisabled] = useState(false);
    const cache = useRef(
        new CellMeasurerCache({
            fixedWidth: true,
            defaultHeight: 100
        })
    );
    const infiniteScrollRef = useRef<HTMLDivElement>(null);

    const loadMoreThreshold = 50; // Number of pixels from top to trigger load more

    const handleScroll = ({ scrollTop, clientHeight, scrollHeight }) => {
        console.log(scrollTop, clientHeight, scrollHeight);
        const diffToBottom  = scrollHeight - (scrollTop + clientHeight);
        console.log(diffToBottom);
        if (
            !(scrollTop === 0 && clientHeight === 0 && scrollHeight === 1500) &&
            diffToBottom > 0 || diffToBottom === -1 || diffToBottom === 0){
            if (scrollTop <= loadMoreThreshold && hasMore && !isLoadingMore) {
                setAutoScroll(false);
                loadMore();
                console.log('loading more');
            }
            setScrollDisabled(true);
        }
        else {
            setScrollDisabled(false);
        }
        if (scrollTop === 0 && clientHeight === 0){
            setScrollDisabled(false);   
        }
    };

    // Reset cache when messages change
    useEffect(() => {
        if (infiniteScrollRef && !scrollDisabled) {
            infiniteScrollRef.current.scrollToRow(messages.length - 1);
        }
        cache.current.clearAll();
    }, [messages]);

    const rowRenderer = ({ index, key, parent, style }) => {
        const message = messages[index];

        return (
            <CellMeasurer
                cache={cache.current}
                columnIndex={0}
                key={"cell-" + message._id}
                parent={parent}
                rowIndex={index}
            >
                {({ measure }) => (
                    <div style={style} >
                        <Message
                        key={message._id}
                        onLoad={measure}
                            message={message}
                            prevMessage={messages[index + 1]}
                            nextMessage={messages[index - 1]}
                            activeAccount={activeAccount}
                            activeAccountPk={activeAccountPk}
                            type={chat?.type}
                            hasMore={hasMore}
                            isFromTeam={chat?.creator === TEAM_ACCOUNT}
                            
                        />
                    </div>
                )}
            </CellMeasurer>
        );
    };

 
    return (
        <div style={{ height: '100vh', width: '100%' }}>
            {hasMore && isLoadingMore && (
                <div 
                    className="text-center m-4" 
                    style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0,
                        zIndex: 1 
                    }}
                >
                    <DotLoading />
                </div>
            )}

            <AutoSizer>
                {({ width, height }) => (
                    <List
                        ref={infiniteScrollRef}
                        width={width}
                        height={height}
                        rowCount={messages.length}
                        rowHeight={cache.current.rowHeight}
                        rowRenderer={rowRenderer}
                        // scrollToIndex={messages.length - 1}
                        onScroll={handleScroll}
                        overscanRowCount={20}
                    />
                )}
            </AutoSizer>

            <div id="endOfMessages" ref={messagesEndRef} />
        </div>
    );
};

export default VirtualMessageList;