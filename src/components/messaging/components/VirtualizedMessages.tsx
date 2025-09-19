import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import Message from './Message';
import { TEAM_ACCOUNT } from '../utils';
import { Button } from 'antd-mobile';

let prevId = 0;

export const VirtualizedMessages = ({ messages, activeAccount, activeAccountPk, chat, hasMore, fetchNextPage, isFetchingNextPage }) => {
  const parentRef = useRef(null);

    const displayMessages = useMemo(() => {
        return [...messages].reverse();
    }, [messages]);
    const itemSize = 100    ;
  const rangeRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
 
  const virtualizer = useVirtualizer({
    //  initialOffset: 1000,
    count: displayMessages.length,
    getScrollElement: () => parentRef.current,
    //   rangeExtractor: useCallback((range) => {
    //   rangeRef.current = range;
    //   return defaultRangeExtractor(range);
    // }, []),
    estimateSize: (index) => {
        return itemSize
        // console.log(displayMessages[index])
        const message = displayMessages[index]
        if (message?.stickerId){
            // return 75 + 8
            return 0
        }
        else if (message.file){
            return 0
        }
        else if (message.file){
            return 0
        }
        else if (message?.type === "system"){
            return 0
        }
        else if (message.replyMessage){
        return 0
        }
        else if (message.tip){
            // return 117
            return 0
        }
        else if (message.redPacket){
            return 0
            return 117
        }
        // debugger
        // return messageHeights[index] 
        return 48
    },
    overscan: 25,
    getItemKey: useCallback((index) => displayMessages[index]._id, [displayMessages]),
  });

  // Scroll to bottom on mount and when new items are added
//   useEffect(() => {
//     if (displayMessages.length > 0 && parentRef.current) {
//       if (!isInitialized) {
//         // Initial scroll to bottom without animation
//         virtualizer.scrollToIndex(displayMessages.length - 1, {
//           align: 'end',
//           behavior: 'auto', // No smooth scrolling to prevent flickering
//         });
//         setIsInitialized(true);
//       }
//     }
//   }, [displayMessages.length, virtualizer, isInitialized]);
//     useEffect(
//     () => {
//       virtualizer.scrollToIndex(20, {align: "start"});
//     },
//     [displayMessages]
//   );
    // Function to scroll to bottom
 const scrollToIndex = (index, ...args) => {
    virtualizer.scrollToIndex(index, ...args);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { start, end } = rangeRef.current;

        const isVisible = index >= start && index <= end;

        if (!isVisible) {
          scrollToIndex(index, ...args);
        }
      });
    });
  };

  // Initial scroll to bottom on mount
  useEffect(() => {
    if (parentRef.current) {
        // scrollToIndex(displayMessages.length - 1, {align: "end"})
        // scrollToBottom()
    //   const scrollElement = parentRef.current;
    //   setTimeout(() => {
    //     scrollElement.scrollTop = scrollElement.scrollHeight;
    //   }, 0);
    }
  }, [displayMessages]);
  const firstId = displayMessages[0]?.height ?? 0;
  const addedToTheBeginning = firstId < prevId;
  prevId = firstId;

  if (addedToTheBeginning) {
    const offset = (virtualizer.scrollOffset + (20 * itemSize));
    virtualizer.scrollOffset = offset;
    virtualizer.calculateRange();
    virtualizer.scrollToOffset(offset, { align: 'start' });
  }
//   useEffect(() => {
//     if (displayMessages[0]){
//         document.querySelector('#endOfMessages').scrollIntoView({ behavior: "instant" });
//     }
//   }
//   , [displayMessages])
  // Handle scroll events for loading more messages
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = async () => {
      const scrollTop = scrollElement.scrollTop;
      const threshold = 0; // Load more when within 0px of top

      if (scrollTop <= threshold && hasMore && !isFetchingNextPage) {
        console.log("loading more at top via scroll");
        await fetchNextPage();
       
      }
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [hasMore, isFetchingNextPage]);
  
  return (
    <div 
      ref={parentRef}
      className="chat-container"
      style={{ 
        height: 'calc(100vh - 45px - 58px - 57px - 4px + 58px)', 
        overflow: 'hidden',
      }}
    >
      
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
          overflow: "hidden"
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = displayMessages[virtualItem.index];
          const prevMessage = displayMessages[virtualItem.index + 1];
          const nextMessage = displayMessages[virtualItem.index - 1];
          
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                // transition: isFetchingNextPage ? 'none' : 'transform 0.1s ease-out',
              }}
            >
                {/* {message.decrypted} */}
                {/* {
                    (message.replyMessage || message.file || message.redPacket || message.tip || message.stickerId) ? null :  */}
              <Message
              key={`${message._id}-${message.status}`}
              message={message}
              prevMessage={prevMessage}
              nextMessage={nextMessage}
              activeAccount={activeAccount}
              activeAccountPk={activeAccountPk}
              type={chat?.type}
              hasMore={hasMore}
              isFromTeam={chat?.creator === TEAM_ACCOUNT}
              />
            {/* } */}
            </div>
          );
        })}
      </div>
    </div>
  );
};