import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { socket } from '../socket';
import { AccountIcon } from '../../app/Home';
import { Badge, Button, Divider, Form, Input, List, Modal, NavBar, Toast } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import ProfilePictureUpload from './profile/upload-pfp';
import useSWR from 'swr';
import { fetcherAccount, fetcherMessages } from '../../fetcher';
import { WalletContext } from '../../../Popup';
import { convertAddress, copyToClipboard, formatAddress } from '../../../../utils/format';
import { QRCodeSVG } from 'qrcode.react';
import icon from "../../../../../public/icons/icon.png";
import { AddressBookFill, SetOutline, SystemQRcodeOutline, UserContactOutline, UserOutline } from 'antd-mobile-icons';
import SelectAccount from '../../../app/SelectAccount';
import Settings, { CopyToClipboard } from '../../../Settings';
import { SeedVerifiedBadge, showAccountQRCode } from '../../utils';
import { AccountAvatar } from '../ChatList';
import { useTranslation } from 'react-i18next';

const ProfileHome: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {wallet} = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);
    const { t } = useTranslation();
    return (
        <div className="">
                <NavBar
                // blank placeholder space for when going to settings page
        className="app-navbar "
        backArrow={false}>
          <span className=""></span>
        </NavBar>
            <List mode='card'>
                <List.Item
                onClick={() => {
                    navigate('/profile/pfp')
                }}
                extra={<div style={{padding: 8}}><AccountAvatar  width={48} account={me?._id} /></div>}
                >
                    {t('profilePicture')}
                </List.Item>
                <List.Item
                extra={me?.name}
                onClick={() => {
                    navigate('/profile/name')
                }}
                >
                    {t('name')}
                </List.Item>
                
              
                <List.Item
                extra={formatAddress(me?._id)}
                onClick={() => {
                    Modal.show({
                        closeOnMaskClick: true,
                        showCloseButton: true,
                        title: t('linkedAccount'),
                        content: 
                        <div>
                        <div 
                        style={{wordBreak: 'break-all', textAlign: 'center', maxWidth: "200px", margin: "auto"}}
                        onClick={() => {
                            Toast.show({
                                content: t('copied'),
                                duration: 2000
                            });
                            copyToClipboard(me?._id);
                        }}>
                           {me?._id}
                        </div>
                        </div>
                    });
                }
                }
                >
                    {t('account')}
                </List.Item>
                <List.Item
                extra={me?.username}
                onClick={() => {
                    navigate('/profile/username')
                }
                }
                >
                    {t('nanChatId')}
                </List.Item>
                <List.Item
                extra={<SystemQRcodeOutline />}
                onClick={() => {
                    showAccountQRCode(me);
                }}
                >
                    {t('myQrCode')}
                </List.Item>
                
                </List>
            <List className='my-4' mode='card'>
            <List.Item
                    prefix={<SetOutline fontSize={24} />}
                    onClick={() => navigate('/me/settings')}
                    extra={<SeedVerifiedBadge/>}
                    >
                            {t('settings')}
                    </List.Item>
            </List>
            {/* <Settings /> */}
        </div>
    );
};

export default ProfileHome;