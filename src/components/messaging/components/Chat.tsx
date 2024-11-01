import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { socket } from '../socket';
import { WalletContext } from '../../Popup';
import { convertAddress } from '../../../utils/format';
import SetName from './SetName';
import AccountInfo from './AccountInfo';

const Chat: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const {wallet} = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");

    useEffect(() => {
        socket.auth = { account: activeAccount };
        socket.connect();
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
        socket.on('newAccount', (account: string) => {
            console.log('newAccount', account); 
            console.log('onlineAccount', onlineAccount);
            if (!onlineAccount.includes(account)){
                setOnlineAccount(prev => [...prev, account]);
            }
        });
        
        

      return () => {
                socket.off('newAccount');
                socket.off('accounts');
      };
    }, [activeAccount, onlineAccount]);
    return (
        <>
        <Routes>
                <Route path="/set-name" element={<SetName />} />
                <Route path="/:account" element={<ChatRoom onlineAccount={onlineAccount}/>} />
                <Route path="/:account/info" element={<AccountInfo  onlineAccount={onlineAccount}/>} />
                <Route path="/" element={<ChatList
                onlineAccount={onlineAccount}
                    onChatSelect={(chatId) => navigate(`/chat/${chatId}`)}
                 />} />
        </Routes>
        </>
    );
};

export default Chat;