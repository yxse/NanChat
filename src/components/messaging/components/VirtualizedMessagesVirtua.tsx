import { useMemo, useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import Message, { HeaderMessage } from './Message';
import { firstMessageId, TEAM_ACCOUNT } from '../utils';
import { Button, DotLoading, SpinLoading, Toast } from 'antd-mobile';
import { CacheSnapshot, VList, VListHandle } from "virtua";
import { debounce } from 'lodash';
import { Keyboard } from '@capacitor/keyboard';
import { socket } from '../socket';
import { useEvent } from './EventContext';
import { Capacitor } from '@capacitor/core';
import { DownOutline } from 'antd-mobile-icons';
import { AiOutlineDown } from 'react-icons/ai';
import { DateHeader, shouldShowDate } from './date-header-component';
import { useWindowDimensions } from '../../../hooks/use-windows-dimensions';


export const VirtualizedMessagesVirtua = ({ 
  messages, 
  activeAccount, 
  activeAccountPk, 
  chat, 
  hasMore, 
  fetchNextPage, 
  isFetchingNextPage,
  saveScrollPosition,
  isLoadingFirstPage,
  virtuaRef
}) => {
  
  const isPrepend = useRef(false);
  const [mountTimestamp, setMountTimestamp] = useState(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [inputStickerHeight, setInputStickerHeight] = useState(0)
  const [inputAdditionalHeight, setInputAdditionalHeight] = useState(0)
  const [typingHeight, setTypingHeight] = useState(0)
  const [isCloseToBottomState, setIsCloseToBottomState] = useState(undefined)
  const eventStickerVisible = useEvent("sticker-visible")
  const eventAddVisible = useEvent("add-visible")
    const shouldStickToBottom = useRef(true);
  const {isMobile, isTablet} = useWindowDimensions()
  // const [isLoading, setLoading] = useState(false)
  const displayMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

   const cacheKey = "list-cache-" + chat?.id;

   const scrollToBottom = (force = true) => {
    if (true){
      console.log("scroll to bottom", displayMessages.length)
      //// debugger
      // virtuaRef.current.scrollToIndex(displayMessages.length - 1 + 1, {
      //     align: 'end',
      //     smooth: false // true can cause issue if too much messages loaded
      //   })
      requestAnimationFrame(() =>
        virtuaRef.current.scrollToIndex(displayMessages.length - 1 + 1 + 1, {
          align: 'end',
          smooth: false // true can cause issue if too much messages loaded
        })
      )
    }
    else{
        virtuaRef.current.scrollToIndex(displayMessages.length - 1, {
          align: 'end',
          smooth: false // true can cause issue if too much messages loaded
        })
    }
   }

  const [offset, cache] = useMemo(() => {
    const serialized = sessionStorage.getItem(cacheKey);
    if (!serialized) return [];
    try {
      return JSON.parse(serialized) as [number, CacheSnapshot];
    } catch (e) {
      return [];
    }
  }, [chat?.id]);

  const [hasRestored, setHasRestored] = useState(false)
  useLayoutEffect(() => {
    if (!virtuaRef.current) return;
    const handle = virtuaRef.current;

    if (offset) {
      //// debugger
      // Toast.show({content: "Restoring scroll" + offset})
      shouldStickToBottom.current = false
      setHasRestored(true)
      handle.scrollTo(offset);
    }
  

    return () => {
      // shouldStickToBottom.current = true
      if (isMobile || isTablet) {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify([handle.scrollOffset, handle.cache])
      );
    }
    };
  }, [chat?.id]);

  useEffect(() => {
    setMountTimestamp(Date.now())
    //debugger
  }, [chat?.id])
  

  useEffect(() => {
    if (eventStickerVisible == undefined) return
    //// debugger
    if (eventStickerVisible){
      setInputStickerHeight(eventStickerVisible)
      // if (shouldStickToBottom.current){
        scrollToBottom(false)
      // }
    }
    else{
      setInputStickerHeight(0)
    }
  }, [eventStickerVisible])
  useEffect(() => {
    if (eventAddVisible == undefined) return
    //// debugger
    if (eventAddVisible){
      setInputAdditionalHeight(eventAddVisible)
      // if (shouldStickToBottom.current){
        scrollToBottom(false)
      // }
    }
    else{
      setInputAdditionalHeight(0)
    }
  }, [eventAddVisible])
  
  // Reset prepend flag after each render
  useLayoutEffect(() => {
    //// debugger
    // isPrepend.current = false;
  });
  useEffect(() => {
    Keyboard.addListener('keyboardWillShow', info => {

      // Toast.show({content: info.keyboardHeight})
      const safeAreaBottomValue = parseInt(window.getComputedStyle(document.body).getPropertyValue('--android-inset-bottom-buttons').split('px')[0] || 0)

// Toast.show({content: safeAreaBottomValue})
      console.log('keyboard will show with height:', info.keyboardHeight);
      // keyboardHeight.current = info.keyboardHeight
      setKeyboardHeight(info.keyboardHeight - safeAreaBottomValue)
        // if (shouldStickToBottom.current) {
          // setTimeout(() => {
            scrollToBottom(false)
          // }, 0);
        // }

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
      if (!offset){
        shouldStickToBottom.current = true
      }
    }
  }, [chat?.id])
  

  // Auto-scroll to bottom for new messages (similar to the demo)
  useEffect(() => {
    if (!virtuaRef.current) return;
    debugger
    if (!shouldStickToBottom.current) return;
    if (offset && !hasRestored) return;
    // if (!firstMessageId[chat?.id] && !offset){
    scrollToBottom()
    return

    if (!firstMessageId[chat?.id]){
      //// debugger
      scrollToBottom()
      firstMessageId[chat?.id] = displayMessages[displayMessages.length - 1]?._id
      return
      // requestAnimationFrame(() =>
      //   firstMessageId[chat?.id] = displayMessages[displayMessages.length - 1]?._id
      // )
        //   setTimeout(() => {
        //     // firstMessageId[chat?.id] = displayMessages[displayMessages.length - 1]?._id
        //     virtuaRef.current.scrollToIndex(displayMessages.length +1 - 1, { // +1 for the div space typing
        //   align: 'end',
        // })
        //   }, 40);
      // return
    }
    // Scroll to the last message (bottom)
    if (
      (displayMessages[displayMessages.length - 1]?._id !== firstMessageId[chat?.id]) ||
      (!isMobile)
    ){
      scrollToBottom()
      firstMessageId[chat?.id] = displayMessages[displayMessages.length - 1]?._id
      return
    }
    //// debugger
    
  }, [displayMessages, displayMessages.length, chat?.id]);


const isFirstLoadMore = useRef(true);
const timeoutRef = useRef(null); // Add this ref to store timeout ID

    const handleScroll = async (offsetScroll) => {
    if (!mountTimestamp) return;
  if (!virtuaRef.current) return;
    const { scrollSize, viewportSize } = virtuaRef.current;
    let fixedViewPortInitial = viewportSize == 0 ? document?.body?.clientHeight - 45 - 57 - 2 - 100: viewportSize;
    // let fixedViewPortInitial = viewportSize
    let isCloseToBottom =  offsetScroll - scrollSize + fixedViewPortInitial>= -100;
    console.log("scroll", offsetScroll, scrollSize, viewportSize, isCloseToBottom, fixedViewPortInitial)
    // Toast.show({content: isCloseToBottom ? "true": "false"})
    // saveScrollPosition( offsetScroll) // just used for reset scroll detection
    // if (!isCloseToBottom && isLoadingFirstPage){
    if (!isCloseToBottom){
    // Toast.show({content: (offsetScroll - scrollSize + fixedViewPortInitial).toFixed(0) + " " + (isCloseToBottom ? "true": "false")})
      // Toast.show({content: "not setting stick to bottom yet"})
      // shouldStickToBottom.current = true
    }
    else{
      // Toast.show({content: Date.now() - mountTimestamp})

      // shouldStickToBottom.current = isCloseToBottom
    }
    shouldStickToBottom.current = isCloseToBottom
    // setTimeout(() => {
      // if (virtuaRef.current){
      // }
        // setIsCloseToBottomState(isCloseToBottom)
    // }, 1000)
    if (offsetScroll - scrollSize + fixedViewPortInitial > 150){ // if scrolled 100 px "above" bottom, do the trick to refresh the scroll
      // if (Capacitor.getPlatform() === "ios"){
      //   document.querySelector('#vlist').style.overflow = "hidden"
      //   setTimeout(() => {
      //     document.querySelector('#vlist').style.overflow = "auto"
      //   }, 10);
      // }
    }
    
    if (isCloseToBottom){
      isPrepend.current = false
    }

    // let screenHeight = window.screen.availHeight
    // const threshold = Math.min(500, screenHeight / 3)
    const threshold = 500
    
    // setIsCloseToBottomState(isCloseToBottom)
    // Toast.show({content: threshold + " " + offsetScroll})
    if (offsetScroll < threshold && hasMore && !isFetchingNextPage) {
      isPrepend.current = true;
  
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // virtuaRef.current.
      console.log("loading more at top via scroll");
      
      // Only set to false after we actually fetch
      isFirstLoadMore.current = false;
      try {
        // Toast.show({content: "loading more"})
        await fetchNextPage(100);
        isPrepend.current = false
        // Toast.show({content: "loaded"})
        // timeoutRef.current = setTimeout(() => {
        // isPrepend.current = false
        // timeoutRef.current = null; // Clear the ref when timeout completes
        // }, 1000)
      } catch (error) {
        console.log("cannot load next page", error)        
      }
    }
  }
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
      className={`chat-container`}
      style={{
        height: `calc(100vh - 45px - 57px - 3px - ${keyboardHeight}px - var(--safe-area-inset-top) - ${inputStickerHeight}px - ${inputAdditionalHeight}px - ${(keyboardHeight <= 0)? `var(--safe-area-inset-bottom)`: `0px`} - ${isTablet ? '57.8px' : '0px'})`,
        // display: 'flex',
        // flexDirection: 'column',
        // overflow: "hidden"
        overflowAnchor: "none"
      }}
    >
               {/* {
         
         isPrepend.current && isFetchingNextPage && 
          <div style={{display: "flex", justifyContent: "center", marginTop: 32, marginBottom: 32}}>
          <SpinLoading />
          </div>
         
        } */}
      <VList
      key={"list" + chat?.id}
      id='vlist'
      cache={cache}
      overscan={4}
        ref={virtuaRef}
        // style={{ flex: 1 }}
        reverse
        shift={isPrepend.current}
        onScroll={handleScroll}
        style={{overflow: "auto", display: "block"}}
      >

        {/* <div style={{textAlign: "center", marginTop: 32, marginBottom: 32}}>
        <DotLoading />  
        </div>  */}
    
        {displayMessages.map((message, index) => {
          const prevMessage = displayMessages[index + 1];
          const nextMessage = displayMessages[index - 1];
          
          return (
            <div key={message._id + "-vlist"}>
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
    
<div style={{height: 28.4}} key={"padding-typing"}>{" "}</div>
      
      </VList>
      {/* {
  typeof isCloseToBottomState === 'boolean' && !isCloseToBottomState && (
    <Button
      className="fade-button-enter"
      style={{
        position: "absolute", 
        bottom: 
        `calc(58.4px + ${inputAdditionalHeight}px + ${inputStickerHeight}px + var(--safe-area-inset-bottom) + 16px` // 16px margin
        , 
        // right: 17, 
        width: 32, 
        height: 32, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: 0, 
        paddingTop: 2,
        // left: "50%",
        // transform: "translateX(-50%)",
        left: 0,
        right: 0,
        margin: "0 auto",

      }}
      onClick={() => {
       scrollToBottom()
      }}
      onTouchEnd={(e) => {
        e.preventDefault()
       scrollToBottom()
      }}
      size='large' 
      shape='rounded'
    >
      <AiOutlineDown fontSize={24} style={{height: 16}}/>
    </Button>
  )
} */}
    </div>
  );
};