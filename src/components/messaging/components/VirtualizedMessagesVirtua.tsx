import { useMemo, useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import Message from './Message';
import { firstMessageId, TEAM_ACCOUNT } from '../utils';
import { Button, DotLoading, Toast } from 'antd-mobile';
import { CacheSnapshot, VList, VListHandle } from "virtua";
import { debounce } from 'lodash';
import { Keyboard } from '@capacitor/keyboard';
import { socket } from '../socket';
import { useEvent } from './EventContext';
import { Capacitor } from '@capacitor/core';
import { DownOutline } from 'antd-mobile-icons';
import { AiOutlineDown } from 'react-icons/ai';

let shouldStickToBottom = true

export const VirtualizedMessagesVirtua = ({ 
  messages, 
  activeAccount, 
  activeAccountPk, 
  chat, 
  hasMore, 
  fetchNextPage, 
  isFetchingNextPage,
}) => {
  const virtuaRef = useRef(null);
  const isPrepend = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [inputStickerHeight, setInputStickerHeight] = useState(0)
  const [inputAdditionalHeight, setInputAdditionalHeight] = useState(0)
  const [typingHeight, setTypingHeight] = useState(0)
  const [isCloseToBottomState, setIsCloseToBottomState] = useState(undefined)
  const eventStickerVisible = useEvent("sticker-visible")
  const eventAddVisible = useEvent("add-visible")
  // const [isLoading, setLoading] = useState(false)
  const displayMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

   const cacheKey = "list-cache-" + chat?.id;


  const [offset, cache] = useMemo(() => {
    const serialized = sessionStorage.getItem(cacheKey);
    if (!serialized) return [];
    try {
      return JSON.parse(serialized) as [number, CacheSnapshot];
    } catch (e) {
      return [];
    }
  }, [chat?.id]);

  useLayoutEffect(() => {
    if (!virtuaRef.current) return;
    const handle = virtuaRef.current;

    if (offset) {
      // debugger
      handle.scrollTo(offset);
    }
  

    return () => {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify([handle.scrollOffset, handle.cache])
      );
      shouldStickToBottom = true
    };
  }, [chat?.id]);


  useEffect(() => {
    if (eventStickerVisible == undefined) return
    // debugger
    if (eventStickerVisible){
      setInputStickerHeight(eventStickerVisible)
      if (shouldStickToBottom){
        virtuaRef.current.scrollToIndex(displayMessages.length - 1, {
          align: 'end',
        })
      }
    }
    else{
      setInputStickerHeight(0)
    }
  }, [eventStickerVisible])
  useEffect(() => {
    if (eventAddVisible == undefined) return
    // debugger
    if (eventAddVisible){
      setInputAdditionalHeight(eventAddVisible)
      if (shouldStickToBottom){
        virtuaRef.current.scrollToIndex(displayMessages.length - 1, {
          align: 'end',
        })
      }
    }
    else{
      setInputAdditionalHeight(0)
    }
  }, [eventAddVisible])
  
  // Reset prepend flag after each render
  useLayoutEffect(() => {
    // debugger
    // isPrepend.current = false;
  });
  useEffect(() => {
    Keyboard.addListener('keyboardWillShow', info => {

      // Toast.show({content: info.keyboardHeight})
      const safeAreaBottomValue = parseInt(
  getComputedStyle(document.documentElement)
    .getPropertyValue('--safe-area-inset-bottom')
) || 0;

      console.log('keyboard will show with height:', info.keyboardHeight);
      // keyboardHeight.current = info.keyboardHeight
      setKeyboardHeight(info.keyboardHeight)
        if (shouldStickToBottom) {
          // setTimeout(() => {
            virtuaRef.current.scrollToIndex(displayMessages.length - 1, {
              align: 'end',
              smooth: false
            })
          // }, 0);
        }

    })
    Keyboard.addListener('keyboardWillHide', info => {
      // Toast.show({content: info.keyboardHeight})
      // keyboardHeight.current = 0
      setKeyboardHeight(0)
      // setTimeout(() => {
      //   virtuaRef.current.scrollTo(info.keyboardHeight)
        
      // }, 500);

    })
  }, [virtuaRef, displayMessages.length])
  
  useEffect(() => {
    return () => {
      shouldStickToBottom = true
    }
  }, [chat?.id, shouldStickToBottom])
  

  // Auto-scroll to bottom for new messages (similar to the demo)
  useEffect(() => {
    if (!virtuaRef.current) return;
    // debugger
    if (!shouldStickToBottom) return;
    if (!firstMessageId[chat?.id] && !offset){
      // debugger
      requestAnimationFrame(() =>
        virtuaRef.current.scrollToIndex(displayMessages.length - 1, {
          align: 'end',
        })
      )
          setTimeout(() => {
            firstMessageId[chat?.id] = displayMessages[displayMessages.length - 1]?._id
          }, 500);
      return
    }
    // Scroll to the last message (bottom)
    if (displayMessages[displayMessages.length - 1]?._id !== firstMessageId[chat?.id]){
      requestAnimationFrame(() =>
        virtuaRef.current.scrollToIndex(displayMessages.length - 1, {
          align: 'end',
        })
      )
      firstMessageId[chat?.id] = displayMessages[displayMessages.length - 1]?._id
      return
    }
    // debugger
    
  }, [displayMessages, displayMessages.length, chat?.id]);


const isFirstLoadMore = useRef(true);

const handleScroll = useCallback(
  debounce(async (offsetScroll) => {
    if (!virtuaRef.current) return;
    const { scrollSize, viewportSize } = virtuaRef.current;
    let fixedViewPortInitial = viewportSize == 0 ? document?.body?.clientHeight - 45 - 57 - 2 - 100: viewportSize;
    let isCloseToBottom =  offsetScroll - scrollSize + fixedViewPortInitial>= -100;
    // Toast.show({content: offsetScroll - scrollSize + fixedViewPortInitial})
    setTimeout(() => {
        shouldStickToBottom = isCloseToBottom
        setIsCloseToBottomState(isCloseToBottom)
    }, 100)
    if (offsetScroll - scrollSize + fixedViewPortInitial > 150){ // if scrolled 100 px "above" bottom, do the trick to refresh the scroll
      if (Capacitor.getPlatform() === "ios"){
        document.querySelector('#vlist').style.overflow = "hidden"
        setTimeout(() => {
          document.querySelector('#vlist').style.overflow = "auto"
        }, 10);
      }
    }
    
    if (isCloseToBottom){
      isPrepend.current = false
    }
    
    const threshold = Capacitor.getPlatform() === "ios" ? 1 : 500
    // const threshold = 500
    if (offsetScroll < threshold && hasMore && !isFetchingNextPage) {
      isPrepend.current = true;
      if (Capacitor.getPlatform() === "ios"){
        document.querySelector('#vlist').style.overflow = "hidden"
        setTimeout(() => {
          document.querySelector('#vlist').style.overflow = "auto"
        }, 10);
      }
      // virtuaRef.current.
      console.log("loading more at top via scroll");
      
      // Only set to false after we actually fetch
      isFirstLoadMore.current = false;
      try {
        await fetchNextPage(100);
      } catch (error) {
        console.log("cannot load next page", error)        
      }
      finally {
        if (Capacitor.getPlatform() === "ios"){
          document.querySelector('#vlist').style.overflow = "auto"
        }
      }
      setTimeout(() => {
        isPrepend.current = false
        
      }, 1000)
    }
  }, isFirstLoadMore.current ? 0 : 5), // No delay for first load, 150ms for subsequent
  [hasMore, isFetchingNextPage, fetchNextPage]
);

// Standard debounce function
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}



  return (
    <div
      className={`chat-container ${Capacitor.getPlatform() === "ios" ? "native": ""}`}
      style={{
        height: `calc(100vh - 45px - 57px - 2px - ${keyboardHeight}px - var(--safe-area-inset-top) - ${inputStickerHeight}px - ${inputAdditionalHeight}px - ${(keyboardHeight <= 0)? `var(--safe-area-inset-bottom)`: `0px`})`,
        display: 'flex',
        flexDirection: 'column',
        overflow: "hidden"
      }}
    >
      
      <VList
      key={"list" + chat?.id}
      id='vlist'
      cache={cache}
      overscan={8}
        ref={virtuaRef}
        // style={{ flex: 1 }}
        reverse
        shift={isPrepend.current}
        onScroll={handleScroll}
        // style={{overflow: "hidden"}}
      >
        {/* <div style={{textAlign: "center", marginTop: 32, marginBottom: 32}}>
        <DotLoading />  
        </div>  */}
        {/* {
          !shouldStickToBottom && isFetchingNextPage &&
        <div style={{textAlign: "center", marginTop: 32, marginBottom: 32}}>
        <DotLoading />  
        </div> // this cause re render on files etc
        } */}
        {displayMessages.map((message, index) => {
          const prevMessage = displayMessages[index + 1];
          const nextMessage = displayMessages[index - 1];
          
          return (
            <div
             style={!prevMessage ? {marginBottom: 28.4} : {}}
             >
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
            </div>
          );
        })}
    

      </VList>
      {
  typeof isCloseToBottomState === 'boolean' && !isCloseToBottomState && (
    <Button
      className="fade-button-enter"
      style={{
        position: "absolute", 
        bottom: 110 + inputAdditionalHeight + inputStickerHeight, 
        right: 20, 
        width: 32, 
        height: 32, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: 0, 
        paddingTop: 2
      }}
      onClick={() => {
        requestAnimationFrame(() =>
          virtuaRef.current.scrollToIndex(displayMessages.length - 1, {
            align: 'end',
            smooth: false // true can cause issue if too much messages loaded
          })
        )
      }}
      onTouchEnd={(e) => {
        e.preventDefault()
        requestAnimationFrame(() =>
          virtuaRef.current.scrollToIndex(displayMessages.length - 1, {
            align: 'end',
            smooth: false // true can cause issue if too much messages loaded
          })
        )
      }}
      size='large' 
      shape='rounded'
    >
      <AiOutlineDown fontSize={24} style={{height: 16}}/>
    </Button>
  )
}
    </div>
  );
};