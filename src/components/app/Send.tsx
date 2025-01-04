import { BiPaste, BiReceipt } from "react-icons/bi";
import { customNetworks, networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineExport, AiOutlineSwap } from "react-icons/ai";
import {
  Button,
  Card,
  CenterPopup,
  Divider,
  DotLoading,
  Form,
  Input,
  Modal,
  NavBar,
  NoticeBar,
  Popup,
  Result,
  Space,
  TextArea,
  Toast,
} from "antd-mobile";
import { ScanCodeOutline, TextOutline, ScanningOutline } from "antd-mobile-icons";
import * as webauthn from '@passwordless-id/webauthn'

import { useContext, useEffect, useRef, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard } from "../Settings";
import { getAccount } from "../getAccount";
import { megaToRaw, send } from "../../nano/accounts";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import { MdContentPaste, MdCurrencyExchange } from "react-icons/md";
import { convertAddress, formatAddress, parseURI } from "../../utils/format";
import { BsCurrencyExchange } from "react-icons/bs";
import { CgArrowsExchangeV } from "react-icons/cg";
import { fetchAliasInternet, fetchFiatRates, fetchPrices } from "../../nanswap/swap/service";
import { ConvertToBaseCurrency } from "./Home";
import useLocalStorageState from "use-local-storage-state";
import { Alias, AliasContact, AliasInternetIdentifier } from "./History";
import { FaAddressBook } from "react-icons/fa6";
import { SelectContact } from "./Contacts";
import { fetchBalance } from "./Network";
import { CopyButton, CopyIcon, PasteIcon } from "./Icons";
import { WalletContext } from "../Popup";
import { FaExternalLinkAlt } from "react-icons/fa";
import { useWindowDimensions } from "../../hooks/use-windows-dimensions";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { Scanner } from "./Scanner";
import { authenticate, secureAuthIfAvailable } from "../../utils/biometrics";
export const AmountFormItem = ({ form, amountType, setAmountType, ticker , type="send"}) => {
  const {wallet} = useContext(WalletContext)
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);

  const { data: fiatRates, isLoading, error } = useSWR('fiat', fetchFiatRates);
  const { data: balance, isLoading: balanceLoading } = useSWR(
    "balance-" + ticker + "-" + activeAccount,
    () => fetchBalance(ticker, activeAccount),
  );
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
  );
  const [selected] = useLocalStorageState("baseCurrency", {defaultValue: "USD"})

  const isAmountFiat = amountType === "fiat";
  const formItemName = isAmountFiat ? "amountFiat" : "amount";
  const label = isAmountFiat ? `Amount (${selected})` : "Amount";
  const currency = isAmountFiat ? selected : ticker;

  const getFiatRate = () => {
    if (!fiatRates || !fiatRates[selected]) return 1;
    return fiatRates[selected];
  };

  const switchAmountType = () => {
    const newAmountType = isAmountFiat ? "crypto" : "fiat";
    setAmountType(newAmountType);
    const currentAmount = form.getFieldValue(formItemName);
    if (!currentAmount) return;
    const fiatRate = getFiatRate();
    const newAmount = isAmountFiat
      ? currentAmount / (prices[ticker]?.usd * fiatRate)
      : currentAmount * prices[ticker]?.usd * fiatRate;
    form.setFieldValue(newAmountType === "fiat" ? "amountFiat" : "amount", newAmount);
  };

  const setMaxAmount = () => {
    const fiatRate = getFiatRate();
    const maxAmount = isAmountFiat ? balance * prices[ticker]?.usd * fiatRate : balance;
    form.setFieldValue(formItemName, maxAmount);
    updateOtherAmountField(maxAmount);
  };

  const getAvailableAmount = () => {
    const fiatRate = getFiatRate();
    if (prices?.[ticker] == null) return "..";
    const fiatAmount = (balance * prices[ticker]?.usd * fiatRate).toFixed(2);
    return isAmountFiat
      ? `${fiatAmount} ${selected} (${balance} ${ticker})`
      : `${balance} ${ticker}`;
  };

  const updateOtherAmountField = (value) => {
    const fiatRate = getFiatRate();
    const otherFieldName = isAmountFiat ? "amount" : "amountFiat";
    const convertedValue = isAmountFiat
      ? value / (prices[ticker]?.usd * fiatRate)
      : value * prices[ticker]?.usd * fiatRate;
    form.setFieldValue(otherFieldName, convertedValue);
  };

  const handleInputChange = (e) => {
    const value = e
    form.setFieldValue(formItemName, value);
    updateOtherAmountField(value);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading fiat rates</div>;

  const rules = [
    
   
  ]
  if (type === "send") {
    rules.push({
      required: true,
      message: "Please enter a valid amount",
      type: "number",
      transform: (value) => parseFloat(value),
    });
    rules.push( {
      required: true,
      message: `Available: ${getAvailableAmount()}`,
      type: "number",
      transform: (value) => parseFloat(value),
      min: 0,
      max: isAmountFiat ? balance * prices[ticker].usd * getFiatRate() : balance,
  });
  }

  return (
    <Form.Item
      name={formItemName}
      label={""}
      validateFirst
      required={false}
      extra={
        <div className="flex justify-between space-x-2 items-center">
          <div className="flex items-center cursor-pointer" onClick={switchAmountType}>
            {currency}
            <CgArrowsExchangeV size={20} />
          </div>
          {
            type === "send" &&
          <a className="text-blue-400" onClick={setMaxAmount}>
            Max
          </a>
          }
        </div>
      }
      rules={rules}
    >
      <Input
      autoFocus={type === "receive"}
        clearable
        type="number"
        inputMode="decimal"
        onChange={handleInputChange}
        placeholder={`Enter Amount`}
      />
    </Form.Item>
  );
};

const useFocus = () => {
  const htmlElRef = useRef(null)
  const setFocus = () => {htmlElRef.current &&  htmlElRef.current.focus()}

  return [ htmlElRef, setFocus ] 
}

export default function Send({ticker, onClose, defaultScannerOpen = false, defaultAddress = "", defaultAmount = "", onSent = null}) {
  
  // const [result, setResult] = useState<string>(null);
  const {wallet} = useContext(WalletContext)
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [form] = Form.useForm();
  // const { ticker } = useParams();
  const { data: balance, isLoading: balanceLoading } = useSWR(
    "balance-" + ticker + "-" + activeAccount,
    () => fetchBalance(ticker, activeAccount),
  );
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmPopupOpen, setConfirmPopupOpen] = useState<boolean>(false);
  const [successPopupOpen, setSuccessPopupOpen] = useState<boolean>(false);
  const [dataSend, setDataSend] = useState<any>(false);
  const [sentAmount, setSentAmount] = useState<number>(0); // for success popup
  const [sentTo, setSentTo] = useState<string>(""); // for success popup
  const [result, setResult] = useState({hash: ""}); // for success popup
  const [amountType, setAmountType] = useState<string>("crypto");
  const [amountInFiat, setAmountInFiat] = useState<number>(0);
  const [inputRef, setInputFocus] = useFocus()
  const {isMobile} = useWindowDimensions()
  const ResponsivePopup = isMobile ? Popup : CenterPopup;
  const {mutate,cache}=useSWRConfig()
  let isScanning = false;
  useEffect(() => {
    if (searchParams.get("to")) {
      form.setFieldsValue({ address: searchParams.get("to") });
    }
    if (searchParams.get("amount")) {
      form.setFieldsValue({ amount: searchParams.get("amount") });
    }
  }, [searchParams]);

  let dataPrepareSend = null;
  return (
    <div className="divide-y divide-solid divide-gray-700 space-y-6">
      <div className="container  relative mx-auto">
        <div className="text-center text-xl p-2">
          {/* <NavBar onBack={() => navigate(`/${ticker}`)}> */}
            Send {networks[ticker].name}
          {/* </NavBar> */}
          {/* <div className="flex justify-center m-2">
            <img
              src={networks[ticker].logo}
              alt={`${ticker} logo`}
              width={48}
            />
          </div> */}

{
  amountType === "fiat" ?
  <div className="text-sm text-gray-400 appearance-none">
    Available: ~<ConvertToBaseCurrency amount={balance} ticker={ticker} />
  </div> :
  <div className="text-sm text-gray-400 appearance-none">
    Available: {balanceLoading ? <DotLoading /> : balance} {ticker}
  </div>
}
          <Form
          style={successPopupOpen ? {display: "none"} : {}}
            initialValues={{
              address: defaultAddress,
              amount: defaultAmount,
            }}
            form={form}
            onFinish={async (values) => {
              const fromAddress = activeAccount
              let toAddress = values.address;
              const amount = form.getFieldValue("amount");
              if (values.address.includes('@')){
                let resolved = await fetchAliasInternet(values.address)
                if (resolved != null){
                  form.setFieldsValue({ address: resolved })
                  toAddress = resolved;
                }
                else{
                  Toast.show({
                    content: "Address not found",
                  });
                  setConfirmPopupOpen(false);
                  return;
                }
              }
              setConfirmPopupOpen(true);
              dataPrepareSend = wallet.wallets[ticker].prepareSend({
                source: fromAddress,
                destination: toAddress,
                amount: megaToRaw(ticker, amount),
              })
              setDataSend(dataPrepareSend)
              console.log(dataPrepareSend)
            }}
            className="mt-4"
            layout="horizontal"
            footer={
              <div className="space-y-4">
              <Button
                loading={isLoading}
                block
                type="submit"
                color="primary"
                size="large"
                shape="rounded"
                >
                Send
              </Button>
              {/* <Button
                block
                color="default"
                size="large"
                onClick={() => {
                  showScanner()
                }}>
                Scan QR Code // or select contact
              </Button> */}
                </div>
            }
          >
            <div className="flex justify-between">
              <Form.Item
                label=""
                name={"address"}
                style={{ width: "100%" }}
              >
                <TextArea
                  autoSize={{ minRows: 3, maxRows: 4 }}
                  placeholder="Enter Address or Alias"
                  rows={2}
                />
              </Form.Item>
              <div className="flex items-center space-x-2">
              <PasteIcon fontSize={24}  className=""
                onClick={() => {
                  try {
                    (async () =>
                      form.setFieldValue("address", await navigator.clipboard.readText()))();
                  }
                  catch (error) {
                    console.error("Error pasting:", error);
                    Toast.show({
                      content: "Error pasting",
                    });
                  }
                }
                }
              />
              <Scanner
              defaultOpen={defaultScannerOpen}
                onScan={(result) => {
                  let parsed = parseURI(result);
                  form.setFieldValue("address", parsed.address);
                  form.setFieldValue("amount", parsed.megaAmount);
                }}
              >
                <ScanCodeOutline fontSize={24} className="cursor-pointer"/>
              </Scanner>
              <SelectContact  ticker={ticker} onSelect={(contact) => {
                let correctAddressTicker = contact.addresses.find((a) => a.network === ticker)
                form.setFieldsValue({ address: correctAddressTicker.address })
              }} />
             </div>
            </div>

            <AmountFormItem
  amountType={amountType}
  form={form}
  setAmountType={setAmountType}
  ticker={ticker}
/>
            {/* <div>
              Price: {prices?.[ticker]?.usd} USD
              Available: {balance} {ticker} <br />
              Available: {balance * prices?.[ticker]?.usd} USD
            </div> */}
          </Form>
            <ResponsivePopup
            position={isMobile ? "bottom" : "right"}
            visible={confirmPopupOpen}
            onClose={() => {
              setConfirmPopupOpen(false)
              setDataSend(false)
            }}
          closeOnMaskClick
          >
            <div style={{minWidth: 350}}>
              <Card >
              <div className="text-xl  text-center p-2 mb-2">Sending</div>
                <div className="text-center">
                  <div className="text-2xl">
                     {form.getFieldValue("amount")} {ticker}
                  </div>
                  <div className="text-base text-gray-400">
                    ~<ConvertToBaseCurrency amount={form.getFieldValue("amount")} ticker={ticker} />
                  </div>
                </div>
                <Divider />
                <div className="space-y-3 mt-6 mb-5">
                <div className="flex justify-between text-base mt-6">
                  <div className="text-gray-400">Asset</div>
                  <div className="flex items-center">
                  <img
                  className="mr-2"
              src={networks[ticker].logo}
              alt={`${ticker} logo`}
              width={20}
            />
                    {networks[ticker].name} ({ticker})
                  </div>
                </div>
                <div className="flex justify-between text-base">
                  <div className="text-gray-400">To</div>
                  <div>
                    {formatAddress(form.getFieldValue("address"))}
                    <Alias account={form.getFieldValue("address")} />
                    {/* <AliasInternetIdentifier email={} /> */}
                    </div>
                </div>
                </div>
                <Button
                shape="rounded"
                loading={isLoading}
                size="large"
                 color="primary" onClick={async () => {

                  try {
                    await authenticate()
                  } catch (error) {
                    console.error("Error authenticating:", error);
                    Toast.show({
                      content: "Error authenticating",
                    });
                    return;
                  }
                    // if (localStorage.getItem("webauthn-credential-id")) {
                    //   const challenge = crypto.randomUUID()
                    //   await webauthn.client.authenticate([localStorage.getItem("webauthn-credential-id")], challenge, {
                    //     // "authenticatorType": "both",
                    //     // "userVerification": "discouraged",
                    //     "timeout": 5000
                    //   })
                    // }
             
                    try {
                    setIsLoading(true);
                    console.log(form.getFieldsValue());
                    const fromAddress = activeAccount
                    const toAddress = form.getFieldValue("address");
                    const amount = form.getFieldValue("amount");
                    console.log(fromAddress, toAddress, amount);
                    console.log(dataSend)
                    let data = await dataSend;
                    if (
                      (customNetworks()?.[ticker] && data.existingFrontier.error !== "Block not found") || // if custom network is used, no block for the frontier should be found, or it might be malicious
                      (data.existingFrontier.ticker !== ticker && !customNetworks()?.[ticker]) // if not custom network, ticker should match
                    ) {
                      console.error("Error sending:", data.existingFrontier.error);
                      Toast.show({
                        icon: "fail",
                        content: `Canceled. Malicious network detected, tried to send ${data.existingFrontier.ticker} instead of ${ticker}`,
                      });
                      return;
                    }

                    console.log({data})
                    let result = await wallet.wallets[ticker].send(data)
                    setResult(result)
                    if (result.error) {
                      console.error("Error sending:", result.error);
                      Toast.show({
                        icon: "fail",
                        content: `Error sending: ${result.error}`,
                      });

                      return;
                    }
                    // await send(ticker, fromAddress, toAddress, amount);
                    // Toast.show({
                    //   content: "Success!",
                    // });
                    setSentAmount(amount);
                    setSentTo(toAddress);
                    form.setFieldsValue({ address: "", amount: "" });
                    if (location.pathname !== '/' && !location.pathname.startsWith(`/chat`)) {
                      navigate(`/${ticker}`, { replace: true }); //reset params send
                    }
                    setConfirmPopupOpen(false);
                    setSuccessPopupOpen(true);
                    mutate("balance-" + ticker);
                    mutate("history-" + ticker);
                    if (onSent) {
                      onSent(ticker, result.hash);
                    }
                  } catch (error) {
                    console.error("Error sending:", error);
                    Toast.show({
                      content: "Error sending",
                    });
                  } finally {
                    setIsLoading(false);
                  }
                   setConfirmPopupOpen(false);
                }}
                className="w-full mt-4"
                >
                  Confirm
                </Button>
                <Button 
                shape="rounded"
                size="large"
                className="w-full mt-4 mb-4"
                color="default" onClick={() => setConfirmPopupOpen(false)}>
                  Cancel
                </Button>
              </Card>
            </div>
          </ResponsivePopup>
          <ResponsivePopup
          position={isMobile ? "bottom" : "right"}
          closeOnSwipe
            visible={successPopupOpen}
            onClose={() => {
              setSuccessPopupOpen(false)
              onClose()
            }}
            closeOnMaskClick
          ><Card>
              <Result
              className="text-xl"
                status="success"
                title={<div className="text-2xl text-gray-100">Success</div>}
                description={<>
                  <div className="text-lg">
                    {sentAmount} {ticker} sent to{" "} {formatAddress(sentTo)}
                  </div>
                  <div className="text-base mt-2 flex justify-center space-x-2 items-baseline">
                    <span>Hash: </span>    
                    <CopyToClipboard text={result.hash} textToDisplay={result.hash.slice(0, 4) + "..." + result.hash.slice(-4)} /> 
                    <a target="_blank" href={`https://nanexplorer.com/${networks[ticker].id}/block/${result.hash}`}>
                    <FaExternalLinkAlt className="text-blue-300"  />
                      </a>
                  </div></>
                }
                />
                
          
              <Button
              shape="rounded"
                size="large"
                className="w-full my-4"
                color="default"
                onClick={() => {
                  setSuccessPopupOpen(false);
                  onClose()
                }}
                >
                Close
              </Button>
                </Card>
          </ResponsivePopup>

        </div>
      </div>
    </div>
  );
}
