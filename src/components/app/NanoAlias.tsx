
import { Button, Toast, CheckList, Modal, List, Input, Form, NavBar, Divider } from "antd-mobile";
import { MdOutlineFingerprint, MdOutlinePassword, MdOutlineTimer } from "react-icons/md";
import * as webauthn from '@passwordless-id/webauthn';
import { decrypt, encrypt } from "../../worker/crypto";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useContext, useRef, useState } from "react";
import { fetchAliasIdentifierMulti, fetchAliasInternet } from "../../nanswap/swap/service";
import useSWR from "swr";
import { AliasInternetIdentifier } from "./History";
import CopyAddressPopupCustom from "./CopyAddressPopupCustom";
import { WalletContext } from "../Popup";

function NanoAlias() {
    const navigate = useNavigate();
    const [alias, setAlias] = useState("")
    const [checkAlias, setCheckAlias] = useState("")
    const [resultAlias, setResultAlias] = useState("")
    const {data, isLoading, error} = useSWR('full-identifier-alias-' + checkAlias, () => fetchAliasIdentifierMulti(checkAlias), {fallbackData: []})
    const [popupVisible, setPopupVisible] = useState(false);
    const checkBtn = useRef()
    const {wallet} = useContext(WalletContext)
    const activeAccount = wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address

    console.log({data})
    return (
    <div >
        <NavBar
        className="app-navbar "
        onBack={() => {
          navigate("/settings");
        }}
        backArrow={true}>
          <span className="">Nano Alias</span>
        </NavBar>
        <div className="p-4" style={{paddingBottom: 90}}>
            <p className="text-slate-200 text-lg font-semibold">
                Nano Alias
            </p>
            <p className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors text-sm mt-1 justify-end">
                Nano Alias is a human-readable name based on domain name that can be used instead of full Nano address.
            </p>
          
            <p className="text-slate-200 text-lg font-semibold mt-4">
                Check Nano Alias
            </p>
            <p className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors text-sm mt-1 justify-end mb-1">
                Enter a Nano Alias to lookup all associated addresses.
            </p>
            <Form onFinish={() => {

            }}>
                <Form.Item>
                    <Input
                    clearable
                    autoComplete="off"
                    name="alias"
                    ref={checkBtn}
                    onEnterPress={(e) => {
                        setCheckAlias(alias) 
                        setPopupVisible(true)
                        checkBtn.current.blur() // to hide ios keyboard
                    }}
                        type="search"
                        onChange={(value) => setAlias(value)}
                        placeholder="@alias@xno.link"
                    />
                </Form.Item>
                <Form.Item>
                    <Button
                    type="submit"
                        onClick={() => {
                          setCheckAlias(alias)
                          setPopupVisible(true)
                        } }
                        color="primary"
                        shape="rounded"
                        size="large"
                        block
                    >
                        Check
                    </Button>
                </Form.Item>
            </Form>
            <CopyAddressPopupCustom
            isLoading={isLoading}
        addresses={
            data ? data : []
        }
        title={`${checkAlias} Addresses`}
        popupVisible={popupVisible}
        setPopupVisible={setPopupVisible}
        />
            <p className="text-slate-200 text-lg font-semibold mt-4">
                Don't have a Nano Alias?
            </p>
            <p className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors text-sm mt-1 justify-end mb-2">
                Create a Nano Alias for free at xno.link
            </p>
            <a href="https://xno.link" target="_blank">
            <Button
                        color="default"
                        shape="rounded"
                        size="large"
                        block
                    >
                        Go to xno.link
                    </Button>
                    </a>
            <p className="text-slate-200 text-lg font-semibold mt-4">
                Have a xno.link alias ?
            </p>
            <p className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors text-sm mt-1 justify-end mb-2">
                Easily sync your NanWallet addresses with your xno.link alias.
            </p>
            <a href={"http://localhost:3001/account?tab=alias&multiAddress=" + activeAccount} target="_blank">
            <Button
                        color="default"
                        shape="rounded"
                        size="large"
                        block
                    >
                        Sync with xno.link
                    </Button></a>
                  
        </div>
       
    </div>
  )
}

export default NanoAlias