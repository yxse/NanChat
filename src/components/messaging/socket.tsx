import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_PUBLIC_BACKEND, {
    autoConnect: false,
});

import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { WalletCondress } from '../../../utils/format';
import SetName from './SetName';
import AccountInfo from './AccountInfo';
import { askPermission } from '../../../nano/notifications';
import useSWR from 'swr';
import { WalletContext } from '../Popup';
import { fetcherMessages } from './fetcher';
import { convertAddress } from '../../utils/format';
import { getChatToken } from '../../utils/storage';

const ChatSocket: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const {data: accounts, mutate} = useSWR<string[]>('/accounts', fetcherMessages);

    useEffect(() => {
        getChatToken().then((token) => {
                    socket.auth = { token };
                    socket.connect();
                });
        return () => {
            socket.disconnect();
        };
    }, [activeAccount]);
    useEffect(() => {
        socket.emit('join', activeAccount);
        socket.on('accounts', (accounts: string[]) => {
            console.log('online', accounts);
            setOnlineAccount(accounts);
        });

        return () => {
            socket.off('newAccount');
            socket.off('accounts');
        };
    }, [activeAccount, onlineAccount, accounts]);

    return (
        <>
          
        </>
    );
};

export default ChatSocket;