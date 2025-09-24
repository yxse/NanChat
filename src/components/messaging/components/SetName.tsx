import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList, { LedgerNotCompatible } from './ChatList';
import { socket } from '../socket';
import { LedgerContext } from "../../LedgerContext";
import { WalletContext } from "../../useWallet";
import { useWallet } from "../../useWallet";
import { convertAddress } from "../../../utils/convertAddress";
import { AccountIcon } from '../../app/Home';
import { Button, Form, Input, NavBar, Toast } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import ProfilePictureUpload from './profile/upload-pfp';
import { fetcherAccount, fetcherMessages, fetcherMessagesPost, getNewChatToken } from '../fetcher';
import useSWR from 'swr';
import { LockOutline } from 'antd-mobile-icons';
import { useHideNavbarOnMobile } from '../../../hooks/use-hide-navbar';
import { useChats } from '../hooks/use-chats';
import { useTranslation } from 'react-i18next';

const SetName: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {activeAccount, activeAccountPk} = useWallet();
    const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);
    const {mutateChats} = useChats();

    const {ledger} = useContext(LedgerContext);
    useHideNavbarOnMobile(ledger ? false : true);
    const isRegistered = me?.name;
    const { t } = useTranslation();
    if (ledger) {
        return <LedgerNotCompatible />
    }
    return (
        <div>
            <NavBar
                            onBack={() => navigate('/me')}
                    className="app-navbar "
                    backArrow={true}>
                      {t('name')}
                    </NavBar>
        <div className="flex flex-col items-center justify-center h-full">
            {
                isRegistered ? 
                <div className='text-2xl mb-4'>
                    {/* {t('updateYourName')} */}
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
                    name: values.name.trim(),
                    account: activeAccount
                }, activeAccountPk).then((res) => {
                    console.log(res);
                    Toast.show({icon: 'success'});
                    mutate({...me, name: values.name});
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
                    {t('done')}
                </Button>
                    </>
            }>
                {
                    !isRegistered &&
                <Form.Header>
                    {t('enterYourNameToGetStarted')}
                </Form.Header>
                }
                <Form.Item
                rules={[{
                    transform: (value) => value?.trim(),
                    required: true, min: 1, max: 24, message: t('nameMustBeBetween', {min: 1, max: 24})}]}
                 extra='' name={'name'}>
                    <Input
                    enterKeyHint='done'
                    clearable
                    autoFocus
                        placeholder={t('enterYourName')}
                    />
                </Form.Item>
            </Form>
            </div>
            </div>
    );
};

export default SetName;