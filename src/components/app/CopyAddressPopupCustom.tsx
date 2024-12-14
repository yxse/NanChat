import { Card, DotLoading, List, Popup, Toast } from 'antd-mobile';
import React, { useContext } from 'react'
import NetworkList, { ItemCopyAddress } from './NetworksList';
import { CopyIcon } from './Icons';
import { useWindowDimensions } from '../../hooks/use-windows-dimensions';
import { WalletContext } from '../Popup';
import { convertAddress } from '../../utils/format';
import { activeNetworks } from '../../utils/networks';
import { Clipboard } from '@capacitor/clipboard';

function CopyAddressPopupCustom({addresses = [], title = "Your Addresses", popupVisible, setPopupVisible, isLoading = false}) {
    const {isMobile} = useWindowDimensions()
    const writeToClipboard = async () => {
        await Clipboard.write({
          string: "Hello World!"
        });
      };
      
      const checkClipboard = async () => {
        const { type, value } = await Clipboard.read();
      
        console.log(`AZE Got ${type} from clipboard: ${value}`);
      };
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
            return <ItemCopyAddress address={address} ticker={ticker} onClick={async (ticker, account) => {
                navigator.clipboard.writeText(account);
                console.log(`Copied ${ticker} address to clipboard: ${account}`);
                await Clipboard.write({
                    string: account
                });
                let { type, value } = await checkClipboard()
                console.log(`Got ${type} from clipboard: ${value}`);

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