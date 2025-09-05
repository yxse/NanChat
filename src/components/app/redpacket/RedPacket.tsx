import { BiPaste, BiReceipt } from "react-icons/bi";
import { customNetworks, networks } from "../../../utils/networks";
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
import { ScanCodeOutline, TextOutline, ScanningOutline, LinkOutline, GiftOutline } from "antd-mobile-icons";
import * as webauthn from '@passwordless-id/webauthn'
import isValid from 'nano-address-validator';

import { useContext, useEffect, useRef, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard } from "../../Settings";
import { getAccount } from "../../getAccount";
import { megaToRaw, send } from "../../../nano/accounts";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import { MdContentPaste, MdCurrencyExchange } from "react-icons/md";
import { convertAddress, formatAddress, parseURI, pasteFromClipboard } from "../../../utils/format";
import { BsCurrencyExchange } from "react-icons/bs";
import { CgArrowsExchangeV } from "react-icons/cg";
import { fetchAliasInternet, fetchFiatRates, fetchPrices } from "../../../nanswap/swap/service";
import { ConvertToBaseCurrency } from "../Home";
import useLocalStorageState from "use-local-storage-state";
import { Alias, AliasContact, AliasInternetIdentifier, askForReview } from "../History";
import { FaAddressBook } from "react-icons/fa6";
import { SelectContact } from "../Contacts";
import { fetchBalance } from "../Network";
import { CopyButton, CopyIcon, PasteIcon } from "../Icons";
import { useWallet, WalletContext } from "../../Popup";
import { FaExternalLinkAlt } from "react-icons/fa";
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { Scanner } from "../Scanner";
import { authenticate, secureAuthIfAvailable } from "../../../utils/biometrics";
import { PinAuthPopup } from "../../Lock/PinLock";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { HapticsImpact } from "../../../utils/haptic";
import ProfileName from "../../messaging/components/profile/ProfileName";
import { fetcherChat, fetcherMessages } from "../../messaging/fetcher";
import { Keyboard } from "@capacitor/keyboard";
import { useTranslation } from 'react-i18next';
import { PiStickerLight } from "react-icons/pi";
import { RiRedPacketFill, RiRedPacketLine } from "react-icons/ri";
import ChatInputStickers from "../../messaging/components/ChatInputStickers";
import MessageSticker from "../../messaging/components/MessageSticker";
import Sticker from "../../messaging/components/Sticker";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";
import { sendTransaction } from "../SendTransaction";
import ChatInputMessage from "../../messaging/components/ChatInputMessage";
import { useChats } from "../../messaging/hooks/use-chats";
import { AmountFormItem } from "../AmountFormItem";

export default function RedPacket({ticker, chatId, onPacketSent}) {
  const { t } = useTranslation();
  // const [result, setResult] = useState<string>(null);
  const {wallet} = useWallet()
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [form] = Form.useForm();
  if (!ticker) {
    // retrieve from  useParams();
    const { ticker: tickerParam } = useParams();
    ticker = tickerParam;
  }
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);
  console.log('ticker', ticker)
  if (!chatId) {
    // retrieve from  useSearchParams();
    const [searchParams] = useSearchParams();
    chatId = searchParams.get("chatId");
  }
  const {chat} = useChats(chatId)
  const chatType = chat?.type
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
  const [pinVisible, setPinVisible] = useState(false)
  const {isMobile, height} = useWindowDimensions()
  const ResponsivePopup = isMobile ? Popup : CenterPopup;
  const {mutate,cache}=useSWRConfig()
  const [amountMode, setAmountMode] = useState<"normal" | "random">("random");
  const amount = Form.useWatch("amount", form);
  const quantity = Form.useWatch("quantity", form);
  const amountFiat = Form.useWatch("amountFiat", form);
  const [total, setTotal] = useState<number>(0);
  const [stickerOpen, setStickerOpen] = useState<boolean>(false);
  const [sticker, setSticker] = useState<string>("");
  const inputRefMessage = useRef(null);
  const {data: config} = useSWR('/redpacket/config?ticker=' + ticker, fetcherChat)
  let isScanning = false;
  useHideNavbarOnMobile(true)
  console.log("RedPacket render", {ticker, chatId})
  useEffect(() => {
    wallet.wallets[ticker]?.receiveAllActiveAccount(); // force receive all 
  }, []);

  let amountTotal = 0;
  if (amountMode === "random") {
    amountTotal = amount || 0;
  } else {
    amountTotal = (quantity || 1) * (amount || 0);
  }
  

  function onCryptoSent(ticker, hash) {
    inputRefMessage.sendRedPacketMessage(ticker,hash, amountMode, quantity || 1, form.getFieldValue("message") || "Best wishes!", sticker);
    debugger
    if (location.pathname.includes('/red-packet')){ // return back to chat only if we were on the /red-packet path because on larger screen we use modal popup and so no need to go back
      navigate("/chat/" + chatId, {replace: true});
    }
    if (onPacketSent) {
      onPacketSent();
    }
  }

  let dataPrepareSend = null;
  return (
    <div
    onClick={(e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        setStickerOpen(false); // close sticker popup on input focus
      }
    }}
     style={{minWidth: 350, overflow: "auto", maxHeight: "90vh"}}
    //  className="divide-y divide-solid divide-gray-700 space-y-6"
     >
          <NavBar onBack={() => navigate(-1)}>
            {t('send')} Paquet(s) Rouge
            </NavBar>
      <div
      style={{maxWidth: 500, backgroundColor: "var(--main-background-color)"}}
       className="container  relative mx-auto">
        <div className="text-center text-xl p-2">
          <Form
          onValuesChange={(values, allValues) => {
            console.log(values, allValues)
            form.setFieldValue('quantity', parseInt(allValues.quantity))
          }}
           mode="card"
          
          style={successPopupOpen ? {display: "none"} : {}}
            form={form}
            onFinish={async (values) => {
              Keyboard.hide()
               dataPrepareSend = wallet.wallets[ticker].prepareSend({
                source: activeAccount,
                destination: config?.account,
                amount: megaToRaw(ticker, amount),
              })
              setDataSend(dataPrepareSend)
              setConfirmPopupOpen(true);
            }}
            className="mt-4 form-list "
            layout="horizontal"
            footer={
              <div>
                <div className="text-3xl mb-4">
                  {amountTotal} {ticker}
                </div>
              <div className="" style={{
                // paddingTop: (height <= 745 || !isMobile) ? 0 // on small screen, no padding to prevent overflow, padding is used to prevent content shifting when keyboard is opened
                //             : 360,
                          }}>
              <Button
              onClick={() => {
                console.log("form values", form.getFieldsValue());
              }}
              style={{marginTop: 32}}
              className=""
                loading={isLoading}
                block
                type="submit"
                color="primary"
                size="large"
                shape="default"
                >
                {t('next')}
              </Button>
                </div>
                      {
        stickerOpen && <ChatInputStickers
        onStickerSelect={(sticker) => {
          setSticker(sticker);
          setStickerOpen(false);
        }}
        />
      }
            <div className="text-sm" style={{color: "var(--adm-color-text-secondary)", paddingBottom: "calc(var(--safe-area-inset-bottom) + 12px)",  width: 300, marginTop: 64, textAlign: "center", marginRight: "auto", marginLeft: "auto"}}>
                  {t('securedByNanPay')} {t('redPacketNotOpenedWillBeRefunded')}
                </div>
                </div>
            }
          >

                  
                        {chatType === "group" && <>
                         <Form.Header>
                                <div 
                                 onClick={() => {
                                  let qty = quantity || 1;
    if (amountMode === "random") {
      setAmountMode("normal");
      form.setFieldsValue({ amount: (amount / qty) || null });
    } else {
      setAmountMode("random");
      form.setFieldsValue({ amount: (amount * qty) || null });
    }
  }}
                                className="" style={{color: "var(--adm-color-primary)", textAlign: "left",  marginLeft: 18}}>
              {
                amountMode === "random" ?
                t('randomAmount')
                : t('identicalAmount')
              }              
  <CgArrowsExchangeV 
 
  style={{display: "inline"}} size={20} />
                </div>
                        </Form.Header>   
            <Form.Item
            required={false}
            rules={[{
      validateTrigger: "onConfirm", // allow to not show error while typing amount, only on submit
      required: true,
      type: "number",
    max: Math.min(100, chat?.participants.length), 
      transform: (value) => parseInt(value),
    }]}
            childElementPosition="right"
              className="form-list"
                label={<div style={{display: "flex", justifyContent: "start", alignItems: "center", gap: 4}}>
                  <img src={"https://em-content.zobj.net/source/apple/419/red-envelope_1f9e7.png"} style={{width: '24px', height: '24px'}} />

                  Quantity
                  </div>}
                name={"quantity"}
                >
                  <Input
                   style={{ '--text-align': 'right' }} type="number" placeholder="Enter quantity" autoComplete="off" step={1} inputMode="numeric"/>
                </Form.Item>
                  <Form.Header>
                                <div className="" style={{color: "var(--adm-color-text-secondary)", marginTop: -12, textAlign: "left", marginBottom: 8, marginLeft: 18}}>
                  {chat?.participants.length} members
                </div>
                        </Form.Header></>
                  }
            <AmountFormItem
            rulesMinMax={{
              min: config?.limits?.minPerPacket,
              max: config?.limits?.maxPerPacket,
            }}
  amountType={amountType}
  form={form}
  setAmountType={setAmountType}
  ticker={ticker}
  type="airdrop"
  label={chatType === "group" ? (amountMode === "random" ? t('total') : t('amountEach')) : t('amount')}
/>
<Form.Header> </Form.Header>

            <Form.Item
            rules={[{max: 64}]}
            extra={
              sticker ? <div onClick={() => {
        setSticker("");
      }}>
      <Sticker stickerId={sticker} height="32px" />
      </div>
      : 
            <PiStickerLight style={{width: 32, height: 32}} className="hoverable" 
            onClick={() => {
              setStickerOpen(!stickerOpen);
            }}
             />}
              className="form-list"
                name={"message"}
                >
                  <Input style={{  }} type="text" placeholder="Best wishes!" autoComplete="off" enterKeyHint="send"/>
                </Form.Item>
             </Form>

        </div>
      </div>
      

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
                </div>
                <PinAuthPopup
                location={"send"}
                description={t('sendButton') + ` ${form.getFieldValue("amount")} ${ticker}`}
                visible={pinVisible}
                setVisible={setPinVisible}
                onAuthenticated={async () => {
                                  await sendTransaction({
                                    fromAddress: activeAccount,
                                    toAddress: config?.account,
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
                                    onSent: onCryptoSent
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
          <ChatInputMessage 
                    hideInput
                    onSent={async () => {
                        Toast.show({
                            icon: "success",
                            content: "Sent",
                            duration: 1000
                        })
                    }}
                        defaultChatId={chatId}
                        messageInputRef={inputRefMessage}
                    />
                 
    </div>
  );
}
