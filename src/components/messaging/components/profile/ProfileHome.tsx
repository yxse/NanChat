import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { socket } from '../socket';
import { AccountIcon } from '../../app/Home';
import { Button, Form, Input, List } from 'antd-mobile';
import { tools } from 'multi-nano-web';
import ProfilePictureUpload from './profile/upload-pfp';
import useSWR from 'swr';
import { fetcherAccount, fetcherMessages } from '../../fetcher';
import { WalletContext } from '../../../Popup';
import { convertAddress } from '../../../../utils/format';

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
                <List.Item
                extra={"@" + me?.username}
                >
                    Username
                </List.Item>
            </List>
        </div>
    );
};

export default ProfileHome;