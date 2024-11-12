import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Route, useNavigate, Routes } from 'react-router-dom';
import ChatRoom from './ChatRoom';
import ChatList from './ChatList';
import { socket } from '../socket';
import { WalletContext } from '../../Popup';
import { convertAddress } from '../../../utils/format';
import SetName from './SetName';
import AccountInfo from './AccountInfo';
import { askPermission } from '../../../nano/notifications';

const Chat: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const { wallet } = useContext(WalletContext)
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
            if (!onlineAccount.includes(account)) {
                setOnlineAccount(prev => [...prev, account]);
            }
        });



        return () => {
            socket.off('newAccount');
            socket.off('accounts');
        };
    }, [activeAccount, onlineAccount]);

    useEffect(() => {
        // todo add modal
        askPermission();
    }, [])
    return (
        <>
            <Routes>
                <Route path="/set-name" element={<SetName />} />
                <Route path="/:account" element={
                    <div className="flex flex-row" style={{ overflow: "auto", height: "100%" }}>
                        <div
                        className='hide-on-mobile'
                         style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            flexBasis: "45%", 
                            overflowY: "scroll",
                            overflowX: "hidden",
                            maxWidth: 420

                            }}>
                        <ChatList
                            onlineAccount={onlineAccount}
                            onChatSelect={(chatId) => navigate(`/chat/${chatId}`)}
                        /></div>
                        <div style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            // width: "100%",
                            flexBasis: "55%",
                            flexGrow: 1,
                            minWidth: 180,
                            }}>

                        <ChatRoom onlineAccount={onlineAccount} />
                        </div>
                    </div>
                } />
                <Route path="/:account/info" element={<AccountInfo onlineAccount={onlineAccount} />} />
                <Route path="/" element={<div className="flex flex-row" style={{ overflow: "auto", height: "100%" }}>
                        <div
                        className='full-width-on-mobile'
                         style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            // flexBasis: "45%", 
                            overflowY: "scroll",
                            overflowX: "hidden",
                            maxWidth: 420
                            // width: "100%"
                            }}>
                        <ChatList
                            onlineAccount={onlineAccount}
                            onChatSelect={(chatId) => {
                                document.startViewTransition(() => {
                                    navigate(`/chat/${chatId}`, {unstable_viewTransition: true})
                                })
                            }}
                        /></div>
                        <div
                        className='hide-on-mobile'
                         style={{
                            height: "100%", 
                            display: "flex", 
                            flexDirection: "column",
                            // width: "100%",
                            flexBasis: "55%",
                            flexGrow: 1,
                            minWidth: 180,
                            }}>

                        <ChatRoom onlineAccount={onlineAccount} />
                        </div>
                    </div>} />
            </Routes>
        </>
    );
};

export default Chat;