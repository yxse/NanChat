import React, { useContext, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList, { LedgerNotCompatible } from './ChatList';
import { socket } from '../socket';
import { LedgerContext, useWallet, WalletContext } from '../../Popup';
import { convertAddress } from '../../../utils/format';
import { AccountIcon } from '../../app/Home';
import { Button, Form, Input, NavBar, TextArea, Toast } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import ProfilePictureUpload from './profile/upload-pfp';
import { fetcherAccount, fetcherMessages, fetcherMessagesPost, getNewChatToken } from '../fetcher';
import useSWR from 'swr';
import { LockOutline } from 'antd-mobile-icons';
import { useHideNavbarOnMobile } from '../../../hooks/use-hide-navbar';
import { useChats } from '../hooks/use-chats';
import { useTranslation } from 'react-i18next';

const SetBio: React.FC = () => {
    const navigate = useNavigate();
    const textAreaRef = useRef(null)
    const {activeAccount, activeAccountPk} = useWallet();
    const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);
    const {mutateChats} = useChats();
    const {ledger} = useContext(LedgerContext);
    useHideNavbarOnMobile(ledger ? false : true);
    const isRegistered = me?.name;
    const { t } = useTranslation();

    useEffect(() => {
      if (textAreaRef.current && me?.bio && me?.bio?.length > 0){
      textAreaRef.current.nativeElement.setSelectionRange(me?.bio?.length, me?.bio?.length); // put cursor in the end
      textAreaRef.current.nativeElement.focus();
      }

    }, [me])
    
    if (ledger) {
        return <LedgerNotCompatible />
    }
    return (
        <div>
            <NavBar
                            onBack={() => navigate('/me')}
                    className="app-navbar "
                    backArrow={true}>
                      {t('setBio')}
                    </NavBar>
        <div className="flex flex-col items-center justify-center h-full">
            <Form 
            style={{width: '100%', maxWidth: 500}}
            initialValues={{bio: me?.bio}}
            mode='card'
            onFinish={(values) => {
                fetcherMessagesPost('/set-bio', {
                    bio: values.bio,
                }).then((res) => {
                    console.log(res);
                    Toast.show({icon: 'success'});
                    mutate({bio: values.bio});
                    navigate('/me');
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
                <Form.Item
                rules={[{required: false, max: 64}]}
                 extra='' name={'bio'}>
                    <TextArea
                    ref={textAreaRef}
                    autoSize
                    showCount
                    maxLength={64}
                    enterKeyHint='done'
                    autoFocus
                    />
                </Form.Item>
            </Form>
            </div>
            </div>
    );
};

export default SetBio;