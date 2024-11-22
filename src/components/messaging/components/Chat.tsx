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
import { fetcherMessages } from '../fetcher';
import useSWR from 'swr';

const Chat: React.FC = () => {
    const navigate = useNavigate();
    const [onlineAccount, setOnlineAccount] = React.useState<string[]>([]);
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const {data: accounts, mutate} = useSWR<string[]>('/accounts', fetcherMessages);

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
            // console.log('onlineAccount', onlineAccount);
            // if (!onlineAccount.includes(account)) {
            //     setOnlineAccount(prev => [...prev, account]);
            // }
            console.log('newAccounts', accounts);

            let newAccounts = {
                online: [],
                offline: []
            }
            newAccounts.offline = accounts.offline.filter(acc => acc._id !== account._id);
            newAccounts.online = accounts.online.filter(acc => acc._id !== account._id);
            newAccounts.online.push(account);
            newAccounts.online = newAccounts.online.sort((a, b) => a.name.localeCompare(b.name));
            console.log('newAccounts', newAccounts);
            mutate(newAccounts, false); 

        });



        return () => {
            socket.off('newAccount');
            socket.off('accounts');
        };
    }, [activeAccount, onlineAccount, accounts]);

    useEffect(() => {
        // todo add modal
        askPermission();
    }, [])
    return (
        <>
            <Routes>
                <Route path="/profile" element={<SetName />} />
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
                            onChatSelect={(chatId) => {
                                document.startViewTransition(() => {
                                    navigate(`/chat/${chatId}`, {unstable_viewTransition: true})
                                })
                            }}
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