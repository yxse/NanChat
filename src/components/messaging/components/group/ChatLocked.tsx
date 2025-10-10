import { Button, NavBar, Toast } from 'antd-mobile';
import React, { useState } from 'react'
import { joinRequest } from '../../fetcher';
import { useNavigate, useParams } from 'react-router-dom';
import { LockOutline } from 'antd-mobile-icons';

function ChatLocked() {
    const navigate = useNavigate();
    const {
            account
        } = useParams();
    const [isAsked, setIsAsked] = useState(false);
    
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
              <LockOutline style={{display: "inline"}}/>  Invited to join a group chat. 
              
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