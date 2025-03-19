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

const SetUsername: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {wallet} = useContext(WalletContext)
    const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)
    const activeAccountNano = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const [visible, setVisible] = React.useState(false);
    const {data: me, isLoading, mutate} = useSWR(activeAccountNano, fetcherAccount);
    useHideNavbarOnMobile(true);
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
                To get started, set your display name:
            </span> */}
            <div className='text-2xl mb-4'>
                    NanChat ID: {me?.username}
            </div>
            {/* <div className='text-2xl mb-4'>
                    Change NanChat ID
            </div> */}
            <div className='mb-4 text-center'>
                  NanChat ID is your short unique identifier. Your friends can use it to add you on NanChat. It can only be changed once per year.
            </div>
            
<ResponsivePopup 
bodyStyle={{height: 400}}
visible={visible} closeOnMaskClick onClose={() => setVisible(false)}>
<div className='m-4 text-center'>
    <div className='text-xl mb-4'>
    Enter New NanChat ID
    </div>
    <div className=''>
                        Must be 6-20 characters.
    </div>
                        <Form 
                        style={{width: '100%'}}
                    mode='card'
                    className="form-list high-contrast"
                    onFinish={(values) => {
                        console.log(values);
                        Modal.confirm({
                            confirmText: 'Confirm NanChat ID',
                            cancelText: 'Cancel',
                            title: 'Confirm NanChat ID',
                            content: <div>
                                Are you sure you want to change your NanChat ID to <b>{values.username}</b>?
                                <div style={{color: "var(--adm-color-warning)"}}>
                                    You can only change your NanChat ID once per year.
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
                                modal1.close();
                            }
                        }),
                        });
                    }}
                    footer={
                        <>
                      
                        <Button 
                        className='w-full'
                        type='submit' color='primary' size='large'>
                            Change NanChat ID
                        </Button>
                            </>
                    }>
                        {/* <Form.Header>
                            Set a Name to get started
                        </Form.Header> */}
                        <Form.Item
                        required={false}
                        validateTrigger='onBlur'
                        validateFirst
                        rules={[
                            {
                            required: true, message: 'NanChat ID is required'
                            },
                            {
                            min: 6, max: 20, message: 'NanChat ID must be between 6 and 20 characters'
                        }]}
                        label={'NanChat ID'}
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
                    Change NanChat ID
                </Button>
            </div>
            </div>
    );
};

export default SetUsername;