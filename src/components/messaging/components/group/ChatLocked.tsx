import { Button, NavBar, SpinLoading, Toast } from 'antd-mobile';
import React, { useEffect, useState } from 'react'
import { fetcherChat, fetcherMessages, joinRequest } from '../../fetcher';
import { useNavigate, useParams } from 'react-router-dom';
import { LockOutline } from 'antd-mobile-icons';
import useSWR from 'swr';
import { useChats } from '../../hooks/use-chats';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../profile/ProfilePicture';
import ProfileName from '../profile/ProfileName';
import { formatAddress } from '../../../../utils/format';

function ChatLocked() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {mutateChats, unblockChat} = useChats()
    const {
            account
        } = useParams();
    const {data: chatName, error: chatNotFound} = useSWR('/chat?chatId=' + account, fetcherMessages)

    const [isAsked, setIsAsked] = useState(false);
    
    useEffect(() => {
        if (chatName?.type === "private" && !chatName?.blocked){
            mutateChats();
            navigate('/chat/' + account);
        }
    }, [chatName])
  if (chatName?.type === "private" && chatName?.blocked){
    // blocked chats are excluded from the chat list, once unblocked the chat is added back and ChatRoom renders it
    return (<div>
        <NavBar
                    className="app-navbar "
                    backIcon={true}
                    onBack={() => {
                        navigate('/chat');
                    }}
                    >
                </NavBar>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 32, padding: 16, textAlign: 'center'}}>
                {chatName.participant && <>
                    <ProfilePicture address={chatName.participant} width={72} />
                    <div className="text-xl">
                        <ProfileName address={chatName.participant} fallback={formatAddress(chatName.participant)} />
                    </div>
                </>}
                <div className="mt-4">{t('blockedAccount')}</div>
                <div className="text-sm" style={{color: 'var(--adm-color-text-secondary)'}}>
                    {t('unblockAccount')}
                </div>
                <Button
                style={{marginTop: 16}}
                shape="rounded"
                size="large"
                color="primary"
                onClick={async () => {
                    Toast.show({icon: 'loading'});
                    try {
                        await unblockChat(account);
                        Toast.show({icon: 'success'});
                    } catch (error) {
                        Toast.show({icon: 'fail', content: error?.message});
                    }
                }}
                >
                    {t('unblock')}
                </Button>
            </div>
    </div>);
  }
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