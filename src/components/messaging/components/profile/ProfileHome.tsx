import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { socket } from '../socket';
import { AccountIcon } from '../../app/Home';
import { Button, Divider, Form, Input, List, Modal } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import ProfilePictureUpload from './profile/upload-pfp';
import useSWR from 'swr';
import { fetcherAccount, fetcherMessages } from '../../fetcher';
import { WalletContext } from '../../../Popup';
import { convertAddress, formatAddress } from '../../../../utils/format';
import { QRCodeSVG } from 'qrcode.react';
import icon from "../../../../../public/icons/icon.png";
import { AddressBookFill, SetOutline, SystemQRcodeOutline, UserOutline } from 'antd-mobile-icons';
import SelectAccount from '../../../app/SelectAccount';
import Settings from '../../../Settings';

const ProfileHome: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {wallet} = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);

    return (
        <div className="">
            <List>
                <List.Item
                onClick={() => {
                    navigate('/profile/pfp')
                }}
                extra={
                    <img
                    src={me?.profilePicture?.url}
                    width={64}
                    alt='profile-picture'
                    />
                }
                >
                    Profile Picture
                </List.Item>
                <List.Item
                extra={me?.name}
                onClick={() => {
                    navigate('/profile/name')
                }}
                >
                    Name
                </List.Item>
                {/* <List.Item
                extra={"@" + me?.username}
                onClick={() => {
                    navigate('/profile/username')
                }
                }
                >
                    Username
                </List.Item> */}
                </List>
            <List className='my-4'>
            <List.Item
                    prefix={<AddressBookFill fontSize={24} color="white" />}
                    onClick={() => navigate('/contacts')}
                    >
                        Contacts
                    </List.Item>
            </List>
            <Settings />
        </div>
    );
};

export default ProfileHome;