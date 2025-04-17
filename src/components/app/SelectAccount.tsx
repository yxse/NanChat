import { useContext, useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchAccountInfo, fetchBalance, ModalReceive, showModalReceive } from "./Network";
import { Button, CenterPopup, CheckList, Divider, DotLoading, Ellipsis, FloatingBubble, Grid, Image, List, Popup, SearchBar, Space, SwipeAction, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";
import { fetchPrices, fetcher } from "../../nanswap/swap/service";
import { CopyToClipboard } from "../Settings";
import { getRepresentative } from "../getRepresentative";
import { formatAddress } from "../../utils/format";
import { FaExchangeAlt, FaSortAmountDown } from "react-icons/fa";
import { FaCheck, FaCopy, FaSortDown, FaSortUp } from "react-icons/fa6";
import { TiArrowSortedDown, TiArrowSortedUp } from "react-icons/ti";
import { TbWorldQuestion } from "react-icons/tb";
import useLocalStorageState from "use-local-storage-state";
import { AccountIcon, ConvertToBaseCurrency, FormatBaseCurrency } from "./Home";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import { getAccount } from "../getAccount";
import { AiOutlineArrowDown, AiOutlineArrowUp, AiOutlineSend, AiOutlineSwap } from "react-icons/ai";
import { CopyIcon } from "./Icons";
import { WalletContext } from "../Popup";
import React from 'react'
import { DownOutline, EditSOutline, EyeFill, EyeInvisibleFill } from "antd-mobile-icons";
import ProfileName from "../messaging/components/profile/ProfileName";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useWindowDimensions } from "../../hooks/use-windows-dimensions";
import { HapticsImpact } from "../../utils/haptic";
import { useWalletMultiBalance } from "../../hooks/use-wallet-multi-balance";
import { isTouchDevice } from "../../utils/isTouchDevice";
import { useChats } from "../messaging/hooks/use-chats";

const MAX_ACCOUNTS = 5;
function SelectAccount({ }) {
  const [accountsLabels, setAccountsLabels] = useLocalStorageState("accountsLabels", {defaultValue: {}});
  const {wallet, dispatch} = useContext(WalletContext);
  const [visible, setVisible] = useState(false);
  const {mutateChats} = useChats();
  const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address;
  const {isMobile} = useWindowDimensions()
  const ResponsivePopup = isMobile ? Popup : CenterPopup;
  const {balances, balancesConverted, totalBalance, isLoading} = useWalletMultiBalance();
  console.log({balances});
  const onClickHide = (accountIndex) => {
    if (accountIndex === 0){
      Toast.show({content: "Cannot hide the first account"});
    }
    else{
      // dispatch({type: "HIDE_INDEX", payload: accountIndex});
      // dispatch({type: "REMOVE_ACCOUNT", payload: accountIndex});
      wallet.wallets['XNO'].removeAccount(accountIndex);
      if (wallet.activeIndex === accountIndex){
        dispatch({type: "SET_ACTIVE_INDEX", payload: 0});
      }
      mutateChats();
    }
  }
  useEffect(() => {
    // todo handle that better
    // if (localStorage.getItem('activeAddresses') === null) {
      // activeAddresses is used for service workers notifications
      localStorage.setItem('activeAddresses', JSON.stringify(wallet.accounts.map((account) => account.address)));
    // }
  }
  , []);
  return (<>
  <div style={{color: "var(--adm-color-text-secondary)"}} className="text-sm flex items-center cursor-pointer" onClick={() => {
    setVisible(true)
    HapticsImpact({
      style: ImpactStyle.Medium
    });
  }}>
    <span className="mr-2">
      <AccountIcon account={activeAccount} width={32}/>
    </span>
    <div className="text-base	">
      <ProfileName address={activeAccount} fallback={`Account ${wallet.activeIndex + 1}`} />
    </div>
    <DownOutline className="ml-2" /> 
    {/* {activeAccount} - {wallet.activeIndex} */}
  </div>
  {/* <div>
    {wallet.accounts.map((account) => {
      return (
        <div>
          {account.accountIndex} - {account.address}
        </div>
      )}
    )}
  </div> */}
  <ResponsivePopup
  
    visible={visible}
    onClose={() => setVisible(false)}
    closeOnMaskClick={true}
    >
      <div className="text-center text-lg flex items-center justify-between p-4 mr-1">
      <span>Total Balance:</span>
      <FormatBaseCurrency amountInBaseCurrency={totalBalance} isLoading={isLoading}/>
      </div>
      <div style={{maxHeight: "40vh", overflowY: "auto", minWidth: 300}}>
    <CheckList 
    
    value={[wallet.activeIndex]}>
        {
          wallet.accounts.map((account) => {
            let baseAccount = account.address.split("_")[1];
            return (
              <SwipeAction
              rightActions={[
                // account label is now the profile name in the chat
                // {
                // key: 'edit-label',
                // color: 'primary',
                // text: <EditSOutline/>,
                // onClick: () => {
                //   let newLabel = prompt("Enter a new label", accountsLabels[account.address] || "");
                //   if (newLabel){
                //     setAccountsLabels({...accountsLabels, [account.address]: newLabel});
                //   }
                // }
                // },
                {
                  key: 'hide',
                  text: <EyeInvisibleFill />,
                  onClick: () => onClickHide(account.accountIndex)
                }
              ]}>
              <CheckList.Item
              className="account-item"
              value={account.accountIndex}
                onClick={() => {
                  dispatch({type: "SET_ACTIVE_INDEX", payload: account.accountIndex});
                  setVisible(false);
                  mutateChats();
                }}
                key={account.address}
                prefix={
                  <div className="flex items-center">
                    {
                      !isTouchDevice() &&
                  <EyeInvisibleFill 
                  color="var(--adm-color-text-secondary)"
                  className="eye-icon mr-2" onClick={(e) => {
                    e.stopPropagation();
                    onClickHide(account.accountIndex)
                  }} />
                }
                  <AccountIcon account={account.address} />
                  </div>
                }
              >
                <div style={{display: "flex", justifyContent: "space-between"}}>
                <ProfileName address={account.address} fallback={`Account ${account.accountIndex + 1}`} />
                  <div style={{color: "var(--adm-color-text-secondary)"}}>
                    {
                      balancesConverted[baseAccount] ? <FormatBaseCurrency amountInBaseCurrency={balancesConverted[baseAccount]} isLoading={isLoading} /> : 
                      <FormatBaseCurrency amountInBaseCurrency={0} />
                    }
                    </div>
                </div>
              </CheckList.Item>
              </SwipeAction>
            );
          }
          )
        }
    </CheckList>
</div>

    {
      wallet.accounts.length < MAX_ACCOUNTS &&
      <div className="m-4">
      <Button color="primary" size="large" shape="rounded" className="w-full" onClick={async () => {
        // let indexToAdd = wallet.lastAccountIndex + 1;
        // if (wallet.hiddenIndexes?.length > 0) {
        //   indexToAdd = wallet.hiddenIndexes[0];
        //   localStorage.setItem('hiddenIndexes', JSON.stringify(wallet.hiddenIndexes.slice(1)));
        // }
        // else{
        //   localStorage.setItem('lastAccountIndex', indexToAdd);
        // }
        let indexToAdd = 0;
        for (let i = 0; i < wallet.accounts.length; i++){
          if (wallet.accounts[i].accountIndex !== i){
            indexToAdd = i;
            break;
          }
          indexToAdd = wallet.accounts.length;
        }
        let newAccount = await wallet.wallets['XNO'].createAccounts(indexToAdd, 1);
        console.log(newAccount);
        // update ls
        // let activeAddresses = JSON.parse(localStorage.getItem('activeAddresses'));
        // activeAddresses.push(newAccount[0].address);
        // localStorage.setItem('activeAddresses', JSON.stringify(activeAddresses));
      }}>
        Add Account
      </Button></div>
    }
    </ResponsivePopup>
  </>
  );
}

export default SelectAccount
