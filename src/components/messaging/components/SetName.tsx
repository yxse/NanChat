import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList, { LedgerNotCompatible } from './ChatList';
import { socket } from '../socket';
import { LedgerContext, WalletContext } from '../../Popup';
import { convertAddress } from '../../../utils/format';
import { AccountIcon } from '../../app/Home';
import { Button, Form, Input, Toast } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import ProfilePictureUpload from './profile/upload-pfp';
import { fetcherAccount } from '../fetcher';
import useSWR from 'swr';
import { LockOutline } from 'antd-mobile-icons';

const SetName: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {wallet} = useContext(WalletContext)
    const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)
    const activeAccountNano = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const {data: me, isLoading, mutate} = useSWR(activeAccountNano, fetcherAccount);
    const {ledger} = useContext(LedgerContext);
    const isRegistered = me?.name;
    if (ledger) {
        return <LedgerNotCompatible />
    }
    return (
        <div className="flex flex-col items-center justify-center h-full">
            {
                isRegistered ? 
                <div className='text-2xl mb-4'>
                    Update your name
                </div>
                :
            <div className="text-center">
                <div className='text-2xl mb-4'>
                    NanChat
                </div>
                <div className='text-base flex items-center mb-6'>
                    <LockOutline className='mr-2' />
                    End-to-end encrypted chat using nano
                </div>
            </div>
            }
            <Form 
            initialValues={{name: me?.name}}
            mode='card'
            onFinish={(values) => {
                console.log(values);
                console.log(activeAccount);
                const message = "My name is " + values.name;
                const signature = tools.sign(activeAccount.privateKey, message);
                const account = activeAccount.address;
                console.log(signature);
                fetch(import.meta.env.VITE_PUBLIC_BACKEND + '/set-name', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({name: values.name, signature, account})
                }).then((res) => {
                    console.log(res);
                    Toast.show({icon: 'success'});
                    if (isRegistered) {
                        navigate(-1);
                    }
                    else{
                        navigate('/chat');
                    }
                    // localStorage.setItem('name', values.name);
                    mutate({name: values.name});
                });
            }}
            footer={
                <>
                <Button 
                className='w-full'
                type='submit' color='primary' size='large'>
                    Set Name
                </Button>
                    </>
            }>
                {
                    !isRegistered &&
                <Form.Header>
                    Enter your name to get started. You can change it later.
                </Form.Header>
                }
                <Form.Item
                rules={[{required: true, min: 2, max: 24, message: 'Name must be between 2 and 24 characters'}]}
                 extra='' name={'name'}>
                    <Input
                    clearable
                    autoFocus
                        placeholder="Enter your name"
                    />
                </Form.Item>
            </Form>
            </div>
    );
};

export default SetName;