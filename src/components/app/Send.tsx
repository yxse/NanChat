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
import { ScanCodeOutline, TextOutline, ScanningOutline, LinkOutline } from "antd-mobile-icons";
import * as webauthn from '@passwordless-id/webauthn'
import isValid from 'nano-address-validator';

import { useContext, useEffect, useRef, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard } from "../Settings";
import { getAccount } from "../getAccount";
import { megaToRaw, send } from "../../nano/accounts";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import { MdContentPaste, MdCurrencyExchange } from "react-icons/md";
import { convertAddress, formatAddress, parseURI, pasteFromClipboard } from "../../utils/format";
import { BsCurrencyExchange } from "react-icons/bs";
import { CgArrowsExchangeV } from "react-icons/cg";
import { fetchAliasInternet, fetchFiatRates, fetchPrices } from "../../nanswap/swap/service";
import { ConvertToBaseCurrency } from "./Home";
import useLocalStorageState from "use-local-storage-state";
import { Alias, AliasContact, AliasInternetIdentifier, askForReview } from "./History";
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
import { PinAuthPopup } from "../Lock/PinLock";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { HapticsImpact } from "../../utils/haptic";
import ProfileName from "../messaging/components/profile/ProfileName";
import { fetcherMessages } from "../messaging/fetcher";
import { Keyboard } from "@capacitor/keyboard";
import { useTranslation } from 'react-i18next';
import { sendTransaction } from "./SendTransaction";
import { AmountFormItem } from "./AmountFormItem";


const useFocus = () => {
  const htmlElRef = useRef(null)
  const setFocus = () => {htmlElRef.current &&  htmlElRef.current.focus()}

  return [ htmlElRef, setFocus ] 
}
export default function Send({ticker, onClose, defaultScannerOpen = false, defaultAddress = "", defaultAmount = "", onSent = null, hideAddress = false}) {
  const { t } = useTranslation();
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
  const [dataBlockedAccount, setDataBlockedAccount] = useState<any>(false);
  const [sentAmount, setSentAmount] = useState<number>(0); // for success popup
  const [sentTo, setSentTo] = useState<string>(""); // for success popup
  const [result, setResult] = useState({hash: ""}); // for success popup
  const [amountType, setAmountType] = useState<string>("crypto");
  const [amountInFiat, setAmountInFiat] = useState<number>(0);
  const [inputRef, setInputFocus] = useFocus()
  const [pinVisible, setPinVisible] = useState(false)
  const {isMobile, height} = useWindowDimensions()
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
  useEffect(() => {
    wallet.wallets[ticker]?.receiveAllActiveAccount(); // force receive all 
  }, []);

  let dataPrepareSend = null;
  return (
    <div style={{minWidth: 350, overflow: "auto", maxHeight: "90vh"}}
    //  className="divide-y divide-solid divide-gray-700 space-y-6"
     >
      <div className="container  relative mx-auto">
        <div className="text-center text-xl p-2">
          {/* <NavBar onBack={() => navigate(`/${ticker}`)}> */}
            {t('sendTitle', { name: networks[ticker].name })}
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
  <div className="text-sm" style={{color: "var(--adm-color-text-secondary)"}}>
    {t('availableFiat')} ~<ConvertToBaseCurrency amount={balance} ticker={ticker} />
  </div> :
  <div className="text-sm" style={{color: "var(--adm-color-text-secondary)"}}>
    {t('availableCrypto')} {balanceLoading ? <DotLoading /> : balance} {ticker }
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
                let resolved = await fetchAliasInternet(values.address, ticker)

                if (resolved == null) {
                  Toast.show({
                    icon: "fail",
                    content: t('aliasNotFound'),
                  });
                  setConfirmPopupOpen(false);
                  return;
                }
                else if (!isValid(resolved, networks[ticker].prefix)) {
                  Toast.show({
                    icon: "fail",
                    content: t('invalidAddress'),
                  });
                  setConfirmPopupOpen(false);
                  return;
                }
                else{
                  form.setFieldsValue({ address: resolved })
                  toAddress = resolved;
                }
              }
              setConfirmPopupOpen(true);
              dataPrepareSend = wallet.wallets[ticker].prepareSend({
                source: fromAddress,
                destination: toAddress,
                amount: megaToRaw(ticker, amount),
              })
              setDataSend(dataPrepareSend)
              setDataBlockedAccount(fetcherMessages('/is-blocked?address=' + toAddress))
              console.log(dataPrepareSend)
              Keyboard.hide()
            }}
            className="mt-4 form-list"
            layout="horizontal"
            footer={
              <div className="popup-primary-button" style={{
                paddingTop: (height <= 745 || !isMobile) ? 0 // on small screen, no padding to prevent overflow, padding is used to prevent content shifting when keyboard is opened
                            : 360,
                          }}>
              <Button
              className=""
                loading={isLoading}
                block
                type="submit"
                color="primary"
                size="large"
                shape="rounded"
                >
                {t('next')}
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
            <div
            style={hideAddress ? {display: "none"} : {}}
             className="flex justify-between">
              <Form.Item
              className="form-list"
                label=""
                name={"address"}
                style={{ width: "100%" }}
                rules={[
                  {
                    required: true,
                    message: t('pleaseEnterValidAddress', { name: networks[ticker].name }),
                    validator: async (rule, value) => {
                      if (!value) {
                        throw new Error(t('pleaseEnterAddress'));
                      }
                      if (!value.includes('@') && // if not an alias
                        !isValid(value, networks[ticker].prefix)) {
                        throw new Error(t('invalidAddress'));
                      }
                    },
                  }
                ]
                }
              >
                <TextArea
                onEnterPress={(e) => {
                  document?.getElementById("amount")?.focus()
                  e.preventDefault()

                }}
                enterKeyHint="next"
                  autoSize={{ minRows: 3, maxRows: 4 }}
                  placeholder={t('pleaseEnterAddress')}
                  rows={2}
                />
              </Form.Item>
              <div className="flex items-center gap-3 mr-4">
              <PasteIcon fontSize={22}  className=""
                onClick={() => {
                  try {
                    (async () =>
                      form.setFieldValue("address", await pasteFromClipboard()))();
                  }
                  catch (error) {
                    console.error("Error pasting:", error);
                    Toast.show({
                      content: t('errorPasting'),
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
                <ScanCodeOutline fontSize={22} className="cursor-pointer"/>
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
          showCloseButton
          >
            <div style={{minWidth: 350, overflow: "auto"}}>
              <Card >
              <div className="text-xl  text-center p-2 mb-2">{t('sending')}</div>
                <div className="text-center">
                  <div className="text-2xl">
                     {form.getFieldValue("amount")} {ticker}
                  </div>
                  <div className="text-base" style={{color: "var(--adm-color-text-secondary)"}}>
                    ~<ConvertToBaseCurrency amount={form.getFieldValue("amount")} ticker={ticker} />
                  </div>
                </div>
                <Divider />
                <div className="space-y-3 mt-6 mb-5">
                <div className="flex justify-between text-base mt-6">
                  <div style={{color: "var(--adm-color-text-secondary)"}}>{t('asset')}</div>
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
                  <div style={{color: "var(--adm-color-text-secondary)"}}>{t('from')}</div>
                  <div>
                    <ProfileName address={activeAccount} fallback={`Account ${wallet.activeIndex + 1}`} /> ({formatAddress(activeAccount, 11, 7)})
                    {/* <AliasInternetIdentifier email={} /> */}
                    </div>
                </div>
                <div className="flex justify-between text-base">
                  <div style={{color: "var(--adm-color-text-secondary)"}}>{t('to')}</div>
                  <div>
                  <ProfileName address={form.getFieldValue("address")} fallback={``} /> ({formatAddress(form.getFieldValue("address"), 11, 7)})
                    <Alias hideNull account={form.getFieldValue("address")} />
                    {/* <AliasInternetIdentifier email={} /> */}
                    </div>
                </div>
                </div>
                <PinAuthPopup
                location={"send"}
                description={t('sendButton') + ` ${form.getFieldValue("amount")} ${ticker}`}
                visible={pinVisible}
                setVisible={setPinVisible}
                onAuthenticated={async () => {
                  await sendTransaction({
                    fromAddress: activeAccount,
                    toAddress: form.getFieldValue("address"),
                    amount: form.getFieldValue("amount"),
                    ticker,
                    wallet,
                    form,
                    setIsLoading,
                    setResult,
                    setSentAmount,
                    setSentTo,
                    setConfirmPopupOpen,
                    setSuccessPopupOpen,
                    mutate,
                    navigate,
                    location,
                    dataBlockedAccount,
                    dataSend,
                    customNetworks,
                    onSent
                  });
                }}
                />
                <div 
                style={{paddingTop: (height <= 745 || !isMobile) ? 0 : 300}}
                >
                <Button
                shape="rounded"
                loading={isLoading}
                size="large"
                 color="primary" onClick={async () => {
                    setPinVisible(true)
                    HapticsImpact({
                      style: ImpactStyle.Medium
                    });
                }}
                className="w-full mt-4"
                >
                  {t('sendButton')}
                </Button>
                <Button 
                shape="rounded"
                size="large"
                className="w-full mt-4 mb-4"
                color="default" onClick={() => setConfirmPopupOpen(false)}>
                  {t('cancel')}
                </Button>
                </div>
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
              askForReview(0)
            }}
            closeOnMaskClick
          ><Card>
              <Result
              className="text-xl"
                status="success"
                title={<div 
                  style={{}}
                  className="text-2xl">{t('success')}</div>}
                description={<>
                  <div className="text-lg">
                    {t('sentTo', { amount: sentAmount, ticker, address: formatAddress(sentTo) })}
                  </div>
                  {/* <div className="text-sm mt-4 " style={{}}>
                    <a 
                    className="flex justify-center space-x-2 items-baseline"
                    target="_blank" href={`https://nanexplorer.com/${networks[ticker].id}/block/${result.hash}`}>
                    <span>Hash: {result.hash.slice(0, 4) + "..." + result.hash.slice(-4)}
                      </span>    
                      <LinkOutline />
                      </a>
                  </div> */}
                  </>
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
                  askForReview(0)
                }}
                >
                {t('close')}
              </Button>
                </Card>
          </ResponsivePopup>

        </div>
      </div>
    </div>
  );
}
