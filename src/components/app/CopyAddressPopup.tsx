import { Card, List, Popup, Toast } from 'antd-mobile';
import React, { useContext, useState } from 'react'
import NetworkList, { ItemCopyAddress } from './NetworksList';
import { CopyIcon } from './Icons';
import { useWindowDimensions } from '../../hooks/use-windows-dimensions';
import { WalletContext } from "../useWallet";
import { convertAddress } from "../../utils/convertAddress";
import { activeNetworks, networks } from '../../utils/networks';
import CopyAddressPopupCustom from './CopyAddressPopupCustom';

function CopyAddressPopup({}) {
    const [popupVisible, setPopupVisible] = useState(false);
    const { wallet } = useContext(WalletContext);
    let addresses = Object.keys(networks).filter((ticker) => !JSON.parse(localStorage.getItem("hiddenNetworks"))?.includes(ticker)).map((ticker) =>({
            ticker: ticker,
            address: convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker)
        }))

  return (
    <>
   <CopyIcon
   className="cursor-pointer mr-3 mt-4"
    fontSize={24} onClick={() => {
            setPopupVisible(true);
   }} />
   <CopyAddressPopupCustom
    addresses={addresses}
    title="Your Addresses"
    popupVisible={popupVisible}
    setPopupVisible={setPopupVisible}
    />
</>
  )
}

export default CopyAddressPopup