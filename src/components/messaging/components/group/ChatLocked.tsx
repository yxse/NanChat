import { Button, NavBar, SpinLoading, Toast } from 'antd-mobile';
import React, { useEffect, useState } from 'react'
import { fetcherChat, fetcherMessages, joinRequest } from '../../fetcher';
import { useNavigate, useParams } from 'react-router-dom';
import { LockOutline } from 'antd-mobile-icons';
import useSWR from 'swr';
import { useChats } from '../../hooks/use-chats';

function ChatLocked() {
    const navigate = useNavigate();
    const {mutateChats} = useChats()
    const {
            account
        } = useParams();
    const {data: chatName, error: chatNotFound} = useSWR('/chat?chatId=' + account, fetcherMessages)

    const [isAsked, setIsAsked] = useState(false);
    
    useEffect(() => {
        if (chatName?.type === "private"){
            mutateChats();
            navigate('/chat/' + account);
        }
    }, [chatName])
  if (chatNotFound) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h2>Chat not found</h2>
        <Button style={{marginTop: 32}} size='large' color='primary'  shape='rounded' onClick={() => navigate('/chat')}>Go back to chats</Button>
      </div>
    );
  }
  if (chatName?.type === "private"){
    return (<div>
        <NavBar
                    className="app-navbar "
                    backIcon={true}
                    onBack={() => {
                        navigate('/chat');
                    }}
                    >
                        
                </NavBar>
                {/* show spinner */}
                <div style={{display: 'flex', justifyContent: 'center', marginTop: 32}}>
                    <SpinLoading style={{ '--size': '48px' }} />
                </div>
    </div>);
  }
  return (
            <div
                
            >
                <NavBar
                    className="app-navbar "
                    backIcon={true}
                    onBack={() => {
                        navigate('/chat');
                    }}
                    >
                        
                </NavBar>
         
            <div
                style={{
                    borderRadius: 32,
                    padding: 8,
                    paddingRight: 16,
                    paddingLeft: 16,
                    backgroundColor: 'var(--adm-color-background)',
                    textAlign: 'center',
                    marginTop: 32,
                    marginLeft: 16,
                    marginRight: 16,
                }}
            >
                
                <div>
              <LockOutline style={{display: "inline"}}/>  Invited to join {chatName?.name || "a group chat"}
                </div>
            </div>
            <div style={{display: 'flex', justifyContent: 'center', marginTop: 32, textAlign: 'center'}}>
                {
                    isAsked ? 
                    <div>Request to join sent. Waiting for approval from a group member.
                    </div>
                     : 
                <Button
                shape="rounded"
                onClick={() => {
                    Toast.show({icon: 'loading'})
                    joinRequest(account).then((res) => {
                        if (res.error) {
                            Toast.show({ content: res.error , icon: "fail" });
                            return;
                        }
                        Toast.show({ icon: "success"});
                    })
                    setIsAsked(true);
                }}
                size="large" color="primary" >
                    Ask to join
                </Button>
                }
                </div>
            </div>
        )
}

export default ChatLocked