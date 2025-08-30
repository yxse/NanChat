
import { Button, Toast, CheckList, Modal, List, Input, Form, NavBar, Divider, Switch } from "antd-mobile";
import { MdOutlineFingerprint, MdOutlinePassword, MdOutlineTimer } from "react-icons/md";
import * as webauthn from '@passwordless-id/webauthn';
import { decrypt, encrypt } from "../../worker/crypto";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useEffect, useState } from "react";
import { showActionSheet } from "antd-mobile/es/components/action-sheet/action-sheet";
import { Preferences } from "@capacitor/preferences";
import { networks } from "../../utils/networks";
import { useWallet } from "../Popup";
import { convertAddress } from "../../utils/format";

function VerifyOpenBlock() {
    const navigate = useNavigate();
    const [developerMode, setDeveloperMode] = useLocalStorageState("developer-mode", {defaultValue: false});
    const [openBlocks, setOpenBlocks] = useState([])
    const {activeAccount, wallet} = useWallet()
    const fetchOpenBlocks = async () => {
      if(!activeAccount) return
      const newOpenBlocks = [];
      
      debugger
      for (let ticker of Object.keys(networks)) {
        const accountConverted = convertAddress(activeAccount, ticker);
        try {
          const key = 'openBlock-' + accountConverted + '-' + ticker
          console.log(key)
          const data = await Preferences.get({key: key});
          if (data) {
            console.log({data})
            newOpenBlocks.push({ ticker: ticker, hash: data.value });
          }
        } catch (error) {
          console.error(`Error fetching open block for ${ticker}:`, error);
        }
      }
      
      setOpenBlocks(newOpenBlocks);
    };
useEffect(() => {

  fetchOpenBlocks();
}, [activeAccount]);

    
    return (
    <div className="pb-4">
      <div className="p-4" style={{wordBreak: "break-all"}}>
            Verify open block hashes on trusted nodes to verify {activeAccount} integrity:
          <br />
        </div>
       {
  openBlocks.map((block) => (
    <List key={block.ticker} mode="card" header={block.ticker}>
      <List.Item style={{wordBreak: "break-all"}}>
        {block.hash ||  <Button
      onClick={async () => {
        try {
          Toast.show({icon: "loading"})
          await wallet.wallets[block.ticker].verifyHistory(convertAddress(activeAccount, block.ticker))
          fetchOpenBlocks()
          Toast.show({icon: "success"})
        } catch (error) {
          Toast.show({icon: "fail", content: error.message,duration: 5000})
        }
      }}
      >
        Fetch
      </Button>} 
      </List.Item>
    </List>
  ))
}
 
        
    </div>
  )
}

export default VerifyOpenBlock