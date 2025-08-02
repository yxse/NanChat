import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from '../ChatRoom';
import ChatList from '../ChatList';
import { socket } from '../../socket';
import { WalletContext } from '../../../Popup';
import { convertAddress } from '../../../../utils/format';
import { AccountIcon } from '../../../app/Home';
import { Button, Form, Input, Modal, NavBar, Toast } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import ProfilePictureUpload from './upload-pfp';
import { fetcherAccount, fetcherMessagesPost } from '../../fetcher';
import useSWR from 'swr';
import { useHideNavbarOnMobile } from '../../../../hooks/use-hide-navbar';
import { ResponsivePopup } from '../../../Settings';
import { useTranslation } from 'react-i18next';

const SetUsername: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {wallet} = useContext(WalletContext)
    const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)
    const activeAccountNano = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const [visible, setVisible] = React.useState(false);
    const {data: me, isLoading, mutate} = useSWR(activeAccountNano, fetcherAccount);
    useHideNavbarOnMobile(true);
    const { t } = useTranslation();
    return (
        <div>
              <NavBar
                                        onBack={() => navigate(-1)}
                                className="app-navbar "
                                backArrow={true}>
                                  {" "}
                                </NavBar>

        <div className="flex flex-col items-center justify-center" style={{height: '50dvh', margin: 32}}>
            {/* <span className='text-lg mx-2'>
                {t('toGetStartedSetYourDisplayName')}
            </span> */}
            <div className='text-2xl mb-4'>
                    {t('nanChatId')}: {me?.username}
            </div>
            {/* <div className='text-2xl mb-4'>
                    {t('changeNanChatId')}
            </div> */}
            <div className='mb-4 text-center'>
                  {t('nanChatIdDescription')}
            </div>
            
<ResponsivePopup 
bodyStyle={{height: 400}}
visible={visible} closeOnMaskClick onClose={() => setVisible(false)}>
<div className='m-4 text-center'>
    <div className='text-xl mb-4'>
    {t('enterNewNanChatId')}
    </div>
    <div className=''>
                        {t('mustBe6to20Chars')}
    </div>
                        <Form 
                        style={{width: '100%'}}
                    mode='card'
                    className="form-list high-contrast"
                    onFinish={(values) => {
                        console.log(values);
                        Modal.confirm({
                            confirmText: t('confirmNanChatId'),
                            cancelText: t('cancel'),
                            title: t('confirmNanChatId'),
                            content: <div>
                                {t('areYouSureChangeNanChatId', {username: values.username})}
                                <div style={{color: "var(--adm-color-warning)"}}>
                                    {t('canOnlyChangeNanChatIdOncePerYear')}
                                </div>
                                </div>,
                            onConfirm: () => fetcherMessagesPost('/update-profile', {
                                username: values.username,
                        }).then((res) => {
                            if (res.error){
                                Toast.show({
                                   content: res.error,
                                   icon: 'fail',
                                });
                            }
                            else{
                                mutate({username: values.username});
                                Toast.show({
                                    icon: 'success',
                                });
                                Modal.clear();
                                setVisible(false);
                            }
                        }),
                        });
                    }}
                    footer={
                        <>
                      
                        <Button 
                        className='w-full'
                        type='submit' color='primary' size='large'>
                            {t('changeNanChatId')}
                        </Button>
                            </>
                    }>
                        {/* <Form.Header>
                            {t('setANameToGetStarted')}
                        </Form.Header> */}
                        <Form.Item
                        required={false}
                        validateTrigger='onBlur'
                        validateFirst
                        rules={[
                            {
                            required: true, message: t('nanChatIdIsRequired')
                            },
                            {
                            min: 6, max: 20, message: t('nanChatIdMustBeBetween', {min: 6, max: 20})
                        }]}
                        label={t('nanChatId')}
                         name={'username'}>
                            <Input
                            clearable
                            autoFocus
                            />
        
                        </Form.Item>
                    </Form>
                    </div>
</ResponsivePopup>

            <Button 
            onClick={() => {
                setVisible(true);
            }}
                type='submit' color='default' size='middle' style={{marginTop: 128}}>
                    {t('changeNanChatId')}
                </Button>
            </div>
            </div>
    );
};

export default SetUsername;