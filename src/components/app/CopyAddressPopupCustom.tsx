import { Card, DotLoading, List, Popup, Toast } from 'antd-mobile';
import React, { useContext } from 'react'
import NetworkList, { ItemCopyAddress } from './NetworksList';
import { CopyIcon } from './Icons';
import { useWindowDimensions } from '../../hooks/use-windows-dimensions';
import { WalletContext } from '../Popup';
import { convertAddress } from '../../utils/format';
import { activeNetworks } from '../../utils/networks';

function CopyAddressPopupCustom({addresses = [], title = "Your Addresses", popupVisible, setPopupVisible, isLoading = false}) {
    const {isMobile} = useWindowDimensions()
    
  return (
    <>
  
    <Popup
    position={isMobile ? "bottom" : "right" }
    destroyOnClose
    visible={popupVisible}
    onClose={() => setPopupVisible(false)}
    closeOnMaskClick={true}
>
    <Card>
        <div className="text-center text-xl p-2 mb-4">
            {title}
        </div>
        {
            isLoading ? <div className="text-center p-2 mb-4">
                <DotLoading />
            </div>
            : 
        <List>
            {
                addresses.length === 0 && <div className="text-center p-2 mb-4">
                    No addresses found
                </div>
            }

        {addresses.length > 0 && addresses.map(({ address, ticker }) => {
            return <ItemCopyAddress address={address} ticker={ticker} onClick={(ticker, account) => {
                navigator.clipboard.writeText(account);
                Toast.show({
                    icon: "success",
                    content: `${ticker} address copied`
                });
                setPopupVisible(false);
            }} />
        })}
        </List>
    }
    </Card>
</Popup>
</>
  )
}

export default CopyAddressPopupCustom