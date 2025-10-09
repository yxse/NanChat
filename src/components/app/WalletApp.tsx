import React, { useState } from 'react';
import App from '.';
import InitializeScreen from '../Initialize';
import Lockscreen from '../Lock';
import { defaultContacts } from '../messaging/utils';
import { LedgerContext } from "../LedgerContext";
import { WalletProvider } from './WalletProvider';
import useSWR from 'swr';
import { fetcherChat } from '../messaging/fetcher';
import { networks } from '../../utils/networks';

export function WalletApp({ }) {
    const [walletState, setWalletState] = useState<"locked" | "pin-locked" | "unlocked" | "no-wallet" | "loading">("loading");
    const [callback, setCallback] = useState(null);
    const [ledger, setLedger] = useState(null);


    const {data: dataNewNetworks} = useSWR("/networks", fetcherChat); // dynamic add networks
  let newNetworks = dataNewNetworks;
if (newNetworks) {
          for (let ticker in newNetworks) {
            if (!networks[ticker]) {
              networks[ticker] = newNetworks[ticker]
            }
          }
        }
    return (
        <LedgerContext.Provider value={{ ledger, setLedger, setWalletState }}>
            <WalletProvider setWalletState={setWalletState} walletState={walletState}>

                {walletState === "locked" && <Lockscreen setWalletState={setWalletState} theme={"theme"} />}
                {walletState === "unlocked" && <App callback={callback} />}
                {walletState === "no-wallet" && <InitializeScreen
                    theme={"theme"}
                    onCreated={(callback) => {
                        setCallback(callback);
                        localStorage.setItem('hasWallet', 'true');
                        localStorage.setItem('contacts', JSON.stringify(defaultContacts));
                        // Toast.show({
                        //   icon: "success",
                        //   content: <div className="text-center">
                        //     Wallet created with success!
                        //   </div>,
                        //   duration: 3000,
                        // })
                        // setShowConfetti(true);
                        // setTimeout(() => {
                        //   setConfettiCount(0);
                        // }, 5000);
                    }}
                    setWalletState={setWalletState} />}
            </WalletProvider>
        </LedgerContext.Provider>
    );
}
