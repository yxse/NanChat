import { useContext, useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchAccountInfo, fetchBalance, ModalReceive, showModalReceive } from "./Network";
import { Button, CheckList, Divider, DotLoading, Ellipsis, FloatingBubble, Grid, Image, List, Popup, SearchBar, Space, SwipeAction, Toast } from "antd-mobile";
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
import { AccountIcon, AccountName, ConvertToBaseCurrency } from "./Home";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import { getAccount } from "../getAccount";
import { AiOutlineArrowDown, AiOutlineArrowUp, AiOutlineSend, AiOutlineSwap } from "react-icons/ai";
import { CopyIcon } from "./Icons";
import { WalletContext } from "../Popup";
import React from 'react'
import { DownOutline, EditSOutline, EyeFill, EyeInvisibleFill } from "antd-mobile-icons";

const MAX_ACCOUNTS = 5;
function SelectAccount({ }) {
  const [accountsLabels, setAccountsLabels] = useLocalStorageState("accountsLabels", {defaultValue: {}});
  const {wallet, dispatch} = useContext(WalletContext);
  const [visible, setVisible] = useState(false);
  const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address;
 
  return (<>
  <div className="text-sm text-gray-400 mb-1 flex items-center cursor-pointer" onClick={() => setVisible(true)}>
    <AccountIcon account={activeAccount} />
    <AccountName />
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
  <Popup
    visible={visible}
    onClose={() => setVisible(false)}
    closeOnMaskClick={true}
    >
    <CheckList value={[wallet.activeIndex]}>
        {
          wallet.accounts.map((account) => {
            return (
              <SwipeAction
              rightActions={[{
                key: 'edit-label',
                color: 'primary',
                text: <EditSOutline/>,
                onClick: () => {
                  let newLabel = prompt("Enter a new label", accountsLabels[account.address] || "");
                  if (newLabel){
                    setAccountsLabels({...accountsLabels, [account.address]: newLabel});
                  }
                }
              },
                {
                  key: 'hide',
                  text: <EyeInvisibleFill />,
                  onClick: () => {
                    if (account.accountIndex === 0){
                      Toast.show({content: "Cannot hide the first account"});
                    }
                    else{
                      // dispatch({type: "HIDE_INDEX", payload: account.accountIndex});
                      // dispatch({type: "REMOVE_ACCOUNT", payload: account.accountIndex});
                      wallet.wallets['XNO'].removeAccount(account.accountIndex);
                    }
                  }
                }
              ]}>
              <CheckList.Item
              value={account.accountIndex}
                onClick={() => {
                  dispatch({type: "SET_ACTIVE_INDEX", payload: account.accountIndex});
                  setVisible(false);
                }}
                key={account.address}
                prefix={
                  <AccountIcon account={account.address} />
                }
              >
                {accountsLabels[account.address] || `Account ${account.accountIndex + 1}`}
              </CheckList.Item>
              </SwipeAction>
            );
          }
          )
        }
    </CheckList>
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
        await wallet.wallets['XNO'].createAccounts(indexToAdd, 1);
      }}>
        Add Account
      </Button></div>
    }

    </Popup>
  </>
  );
}

export default SelectAccount
