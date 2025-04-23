import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList, { LedgerNotCompatible } from './ChatList';
import { socket } from '../socket';
import { LedgerContext, useWallet, WalletContext } from '../../Popup';
import { convertAddress } from '../../../utils/format';
import { AccountIcon } from '../../app/Home';
import { Button, Form, Input, NavBar, Toast } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import ProfilePictureUpload from './profile/upload-pfp';
import { fetcherAccount, fetcherMessages, fetcherMessagesPost, getNewChatToken } from '../fetcher';
import useSWR from 'swr';
import { LockOutline } from 'antd-mobile-icons';
import { useHideNavbarOnMobile } from '../../../hooks/use-hide-navbar';
import { useChats } from '../hooks/use-chats';

const SetName: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {activeAccount, activeAccountPk} = useWallet();
    const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);
    const {mutateChats} = useChats();

    const {ledger} = useContext(LedgerContext);
    useHideNavbarOnMobile(ledger ? false : true);
    const isRegistered = me?.name;
    if (ledger) {
        return <LedgerNotCompatible />
    }
    return (
        <div>
            <NavBar
                            onBack={() => navigate('/me')}
                    className="app-navbar "
                    backArrow={true}>
                      Name
                    </NavBar>
        <div className="flex flex-col items-center justify-center h-full">
            {
                isRegistered ? 
                <div className='text-2xl mb-4'>
                    {/* Update your name */}
                </div>
                :
                null
            // <div className="text-center">
            //     <div className='text-2xl mb-4'>
            //         NanChat
            //     </div>
            //     <div className='text-base flex items-center mb-6'>
            //         <LockOutline className='mr-2' />
            //         End-to-end encrypted chat using nano
            //     </div>
            // </div>
            }
            <Form 
            style={{width: '100%', maxWidth: 500}}
            initialValues={{name: me?.name}}
            mode='card'
            onFinish={(values) => {
                fetcherMessagesPost('/set-name', {
                    name: values.name,
                    account: activeAccount
                }, activeAccountPk).then((res) => {
                    console.log(res);
                    Toast.show({icon: 'success'});
                    mutate({name: values.name});
                    // navigate('/chat');
                    if (isRegistered) {
                        navigate('/me');
                    }
                    else{
                        navigate('/chat');
                        mutateChats(); // this can happen when switching to another account not yet registered
                    }
                }).catch((err) => {
                    console.log(err);
                    Toast.show({icon: 'fail', content: err.message});
                })
            }}

            footer={
                <>
                <Button 
                className='w-full'
                type='submit' color='primary' size='large'>
                    {isRegistered ? 'Done' : 'Done'}
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
                rules={[{required: true, min: 1, max: 24, message: 'Name must be between 1 and 24 characters'}]}
                 extra='' name={'name'}>
                    <Input
                    enterKeyHint='done'
                    clearable
                    autoFocus
                        placeholder="Enter your name"
                    />
                </Form.Item>
            </Form>
            </div>
            </div>
    );
};

export default SetName;