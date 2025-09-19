import { SpinLoading } from 'antd-mobile';
import React from 'react'
import InfiniteScroll from 'react-infinite-scroll-component';
import Message from '../Message';
import { useWallet } from '../../../useWallet';
import { TEAM_ACCOUNT } from '../../utils';

function InfiniteScrollingMessages({isLoadingInitial, messages, hasMore, setAutoScroll, infiniteScrollRef, isLoadingMore, chat, loadMore, saveScrollPosition}) {
    const {activeAccount, activeAccountPk} = useWallet()
  return (
    
    isLoadingInitial ?<div style={{
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: 'calc(100vh - 45px - 58px - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))',
  width: '100%'
}}>
  <SpinLoading style={{width: 48}} />
</div>: <div
 style={{}}
><InfiniteScroll
                                    // scrollThreshold={"800px"}
                                    dataLength={messages.length}
                                    next={async () => {
                                        // if (!isLoadingMore){
                                        setAutoScroll(false);
                                        await loadMore();
                                        // }
                                    }}

                                    hasMore={hasMore}
                                    // loader={<Skeleton animated />}
                                    inverse={true}
                                    scrollThreshold={"500px"} // this cause scroll flickering issue
                                    onScroll={(e) => {
                                        saveScrollPosition(e.target.scrollTop)
                                        //disable auto scroll when user scrolls up
                                        // console.log(e.target.scrollTop);
                                        if (e.target.scrollTop > 0) {
                                            setAutoScroll(true);
                                            // console.log("enable autoscroll");
                                            infiniteScrollRef.current.className = "scrollableDiv";
                                        }
                                        else {
                                            setAutoScroll(false);
                                            // console.log("disable autoscroll");
                                            if (infiniteScrollRef.current){
                                                infiniteScrollRef.current.className = "scrollableDivAuto";
                                            }
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        userSelect: 'none',

                                        //  overflowAnchor: 'none',
                                    }} //To put endMessage and loader to the top.
                                    endMessage={
                                        null
                                    }
                                    scrollableTarget="scrollableDiv"

                                >
                                    {/* {
                                        hasMore && isLoadingMore && (<div style={{display: "flex", justifyContent: "center", marginTop: 32, marginBottom: 32}}>
                                <SpinLoading />
                            </div>)
                    } */}
                    
                   {messages.map((message, index) => {
                            return (
                                            <div
                                                key={message._id}
                                            // id={index == messages.length - 1 ? "endOfMessages" : ""}
                                            // ref={index === messages.length - 1 ? messagesEndRef : null}
                                            >
                                                <Message
                                                    key={`${message._id}-${message.status}`}
                                                    message={message}
                                                    prevMessage={messages[index + 1]}
                                                    nextMessage={messages[index - 1]}
                                                    activeAccount={activeAccount}
                                                    activeAccountPk={activeAccountPk}
                                                    type={chat?.type}
                                                    hasMore={hasMore}
                                                    isFromTeam={chat?.creator === TEAM_ACCOUNT}
                                                    // toAccount={names?.find(participant => participant._id !== message.fromAccount)?._id}
                                                />
                                            </div>
                                        )
                                    }) 
}
                                </InfiniteScroll></div>
  )
}

export default InfiniteScrollingMessages