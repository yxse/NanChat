import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { socket } from '../socket';
import { WalletContext } from '../../Popup';
import { convertAddress } from '../../../utils/format';
import { AccountIcon } from '../../app/Home';
import { Button, Form, Input } from 'antd-mobile';
import { tools } from 'multi-nano-web';

const SetName: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {wallet} = useContext(WalletContext)
    const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)

    return (
        <div className="flex flex-col items-center justify-center h-full">
            {/* <span className='text-lg mx-2'>
                To get started, set your display name:
            </span> */}
            <Form 
            onFinish={(values) => {
                console.log(values);
                console.log(activeAccount);
                const message = "My name is " + values.name;
                const signature = tools.sign(activeAccount.privateKey, message);
                const account = activeAccount.address;
                console.log(signature);
                fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + '/set-name', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({name: values.name, signature, account})
                }).then((res) => {
                    console.log(res);
                    navigate('/chat');
                    localStorage.setItem('name', values.name);
                });
            }}
            footer={
                <>
                <div className='text-gray-400 text-sm mb-4'>
                    This name will be visible to others. You can change it later. Name will be signed with your account.
                </div>
                <Button 
                className='w-full'
                type='submit' color='primary' size='large'>
                    Set Name
                </Button>
                    </>
            }>
                {/* <Form.Header>
                    Set a Name to get started
                </Form.Header> */}
                <Form.Item
                 extra='' name={'name'}>
                    <Input
                    
                    autoFocus
                        placeholder="Enter your name"
                    />

                </Form.Item>
            </Form>
                
            </div>
    );
};

export default SetName;