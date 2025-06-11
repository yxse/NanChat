import { BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineHistory, AiOutlineRetweet, AiOutlineSwap } from "react-icons/ai";
import {
  Button,
  Card,
  CheckList,
  DotLoading,
  Form,
  Image,
  Input,
  List,
  Modal,
  NavBar,
  Popup,
  Result,
  SearchBar,
  Tag,
  TextArea,
  Toast,
} from "antd-mobile";
import { DownOutline, ScanCodeOutline } from "antd-mobile-icons";

import { useContext, useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard } from "../Settings";
import { getAccount } from "../getAccount";
import { megaToRaw, send } from "../../nano/accounts";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import NetworkList from "./NetworksList";
import SelectTickerAll from "../swap/SelectTickerAll";
import { IoSwapVerticalOutline } from "react-icons/io5";
import SwapHistory from "./SwapHistory";
import { createOrder, createOrderFiat, fetcher, getAllCurrencies, getEstimate, getEstimateFiat, getFeelessCurrencies, getFiatCurrencies, getLimits, getLimitsFiat, getOrder } from "../../nanswap/swap/service";
import { GoCreditCard } from "react-icons/go";
import { fetchBalance } from "./Network";
import { WalletContext } from "../Popup";
import { convertAddress, MIN_USD_SWAP } from "../../utils/format";
import { Scanner } from "./Scanner";
import { Capacitor } from "@capacitor/core";
// import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
import { useWalletBalance } from "../../hooks/use-wallet-balance";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";

export default function Buy({hideHistory = false, defaultFrom = "USD", defaultTo = "XNO", onSuccess, setAction}) {
  const feeless = {};
  for (const [ticker, network] of Object.entries(networks)) {
    if (!network.custom) {
      feeless[ticker] = network;
      feeless[ticker].ticker = ticker;
    }
  }
  
  // const { data: feeless, isLoading: isLoadingCurrencies } = useSWR(
  //   getFeelessCurrencies, fetcher, {
  //   errorRetryCount: 0
  // });
  // const feeless = allCurrencies && Object.values(allCurrencies).filter((currency) => currency?.feeless == true)
  const { data: fiatCurrencies, isLoading: isLoadingFiatCurrencies } = useSWR(
    getFiatCurrencies, fetcher, {
    errorRetryCount: 0
  });
  // filter with deposit_enabled
  const fiatCurrenciesEnabled = fiatCurrencies && Object.fromEntries(Object.entries(fiatCurrencies).filter(([key, value]) => value.deposit_enabled));
  // const [result, setResult] = useState<string>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [visibleSelectFrom, setVisibleSelectFrom] = useState<boolean>(false);
  const [visibleSelectTo, setVisibleSelectTo] = useState<boolean>(false);
  const [selectedFrom, setSelectedFrom] = useState<string>(defaultFrom);
  const [selectedTo, setSelectedTo] = useState<string>(defaultTo);
  const [amount, setAmount] = useState<number | string>(null);
  const [side, setSide] = useState<string>("from"); // ["from", "to"]
  const [form] = Form.useForm();
  const {wallet} = useContext(WalletContext);
  const accountFrom = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, selectedFrom);
  // const { data: balance, isLoading: balanceLoading } = useSWR(
  //   "balance-" + selectedFrom,
  //   () => fetchBalance(selectedFrom, accountFrom),
  // );
  const { data: estimate, isLoading: isLoadingEstimate } = useSWR(
    getEstimateFiat + '?from=' + selectedFrom + '&to=' + selectedTo + '&amount=' + amount,
    fetcher,
  )
  const { data: limit, isLoading: isLoadingLimit } = useSWR(
    getLimitsFiat + '?from=' + selectedFrom + '&to=' + selectedTo + '&fromNetwork=undefined',
    fetcher,
  )
  const {mutate}=useSWRConfig()
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const SelectTicker = ({ side, visible, setVisible }) => {
    const selected = side === "from" ? selectedFrom : selectedTo;
    const logo = side === "from" ? fiatCurrencies?.[selected]?.image : networks?.[selected]?.logo;
    return <div className="flex items-center justify-center space-x-4 m-2 p-2 cursor-pointer  
    " onClick={() => setVisible(true)}>

      <img
        style={{
          height: 32,
        }}
        src={logo}
        alt={`${selected} logo`} width={32} height={32} />
       <div className="flex items-center gap-2">
        {selected} <DownOutline />
      </div>

      {/* <Popup
        visible={visible}
        onClose={() => {
          setVisible(false);
        }}
        onClick={() => setVisible(false)}
        closeOnMaskClick={true}
      >
        <div>
          <div className="text-2xl  text-center p-2">{side === "from" ? "Select From" : "Select To"}</div>
        </div>
        <NetworkList onClick={(ticker) => {
          console.log(ticker, side);
          if (side === "from") {
            setSelectedFrom(ticker);
            setVisible(false);
            return;
          }
          else if (side === "to") {
            setSelectedTo(ticker);
            setVisible(false);
            return;
          }get-currencies
        }} />
      </Popup> */}
      {
        (isLoadingFiatCurrencies) ? <DotLoading /> :
          <SelectTickerAll
            allCurrencies={side === "from" ? fiatCurrenciesEnabled : {'XNO': feeless['XNO']}} // Only allow XNO buy
            isLoadingCurrencies={false}
            onClick={(ticker) => {
              console.log(ticker, side);
              if (side === "from") {
                setSelectedFrom(ticker);
                setVisible(false);
                return;
              }
              else if (side === "to") {
                setSelectedTo(ticker);
                setVisible(false);
                return;
              }
            }}
            visible={visible} setVisible={setVisible} side={side} />
      }
    </div>
  }
  const onSwap = async (values) => {
    try {
      setIsLoading(true);
      console.log(values);
      let toAddress
      if (networks.hasOwnProperty(selectedTo)) {
        toAddress = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, selectedTo);
      } else {
        toAddress = values.address;
      }
      const fromAmount = amount
      console.log(toAddress, amount);
      let exchange = await fetch(createOrderFiat, {
        method: 'POST',
        body: JSON.stringify({
          from: selectedFrom,
          to: selectedTo,
          amount: amount,
          toAddress: toAddress
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(res => res.json())
      if (exchange.error) {
        if (exchange.error === "Currency XNO-NANO is not supported for payouts") {
        Toast.show({
          content: "Not available, please try again later",
        });
      }
      else{

        Toast.show({
          content: exchange.error,
        });
      }
        return;
      }
      else{
        const link = "https://payments.guardarian.com/checkout?tid=" + exchange.orderId;
        if (Capacitor.isNativePlatform()) {
            await InAppBrowser.openInExternalBrowser({url: link})
        }
        else {
          window.open(link, "_blank");
        }
      }
      return

      let history = JSON.parse(localStorage.getItem('history_exchanges') || '[]')
      localStorage.setItem('history_exchanges', JSON.stringify([{
        id: exchange.id,
        link: exchange.fullLink,
        createdAt: new Date(),
      }, ...history]))
      console.log(exchange);

      if (exchange.payoutAddress !== toAddress) {
        Toast.show({
          content: "Error exchanging",
        });
        return;
      }

      if (networks.hasOwnProperty(selectedFrom) && allCurrencies?.[selectedFrom]?.feeless == true) {
        const fromAddress = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, selectedFrom);
        // await send(selectedFrom, fromAddress, exchange.payinAddress, amount);
        let data = await wallet.wallets[selectedFrom].prepareSend({
          source: fromAddress,
          destination: exchange.payinAddress,
          amount: megaToRaw(selectedFrom, amount),
        })
        await wallet.wallets[selectedFrom].send(data);
        await mutate((key) => key.startsWith("history-" + selectedFrom) || key.startsWith("balance-" + selectedFrom));
        onSuccess && onSuccess();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        mutate("balance-" + selectedTo);
        mutate(`${getOrder}${exchange.id}`);
        await mutate((key) => key.startsWith("history-" + selectedFrom) || key.startsWith("balance-" + selectedFrom));
        await mutate((key) => key.startsWith("history-" + selectedTo) || key.startsWith("balance-" + selectedTo));

      }
      else {
        navigate(`/swap/${exchange.id}`);
        return;
        //todo: /transaction page for native experience
        let isOpened = window.open(exchange.fullLink, "_blank");
        // window.open("https://znbfmt6n-5173.euw.devtunnels.ms/XNO/receive", "_blank");
        if (!isOpened) {
          // window.location.href = exchange.fullLink;
          Modal.show({
            closeOnMaskClick: true,
            content: (
              <div className="text-center">
                <a href={exchange.fullLink} target="_blank">
                  <Button
                    color="primary"
                  >
                    Continue on Nanswap to proceed
                  </Button>
                </a>
              </div>
            ),
          });
        }
      }



      // navigate(`/${selectedFrom}`);
    } catch (error) {
      console.error("Error sending:", error);
      Toast.show({
        content: "Buy Error: " + error,
      });
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    if (searchParams.has("from")) {
      setSelectedFrom(searchParams.get("from"));
    }
    if (searchParams.has("to")) {
      setSelectedTo(searchParams.get("to"));
      if (searchParams.get("to") === "XNO") {
        setSelectedFrom("BTC");
      }
    }
  }, [])
  const {
      lowBalanceUsd,
    } = useWalletBalance();
  return (
    <div className="">
      <div className="container  relative mx-auto">
        <div className="">
          <NavBar
          right={
            !lowBalanceUsd && 
              <Button
              onClick={() => setAction("swap")}
              size="small">
              <div className="flex text-xs items-center -mr-0"><AiOutlineRetweet size={18} className="mr-2" /> Swap </div>
              </Button>
            }
              backArrow={hideHistory ? false : true}
              onBack={() => navigate(`/`)}>
              <span className="">
              Buy
              </span>
          </NavBar>

          <div style={{ float: "right" }}>
          </div>
          <Form
            initialValues={{
              address: searchParams.get("to") || "",
              amount: searchParams.get("amount") || "",
            }}
            form={form}
            onFinish={onSwap}
            className="mt-2 swap-form"
            layout="horizontal"
            footer={
              <>
                {/* {
                  amount != undefined && amount !== "" 
                  && networks.hasOwnProperty(selectedFrom) && allCurrencies?.[selectedFrom]?.feeless == true
                  && !balanceLoading && amount > balance && <div
                    onClick={() => {
                      setAmount(balance)
                    }}
                    className="text-base text-orange-500 text-left mb-4 cursor-pointer">
                    Insufficient balance. Available: <span className="underline">{balance} {selectedFrom}</span>
                  </div>
                } */}
                {
                  amount != undefined && amount !== "" && +amount < limit?.min && <div
                    onClick={() => {
                      setAmount(limit?.min
                      )
                    }}
                    className="text-base text-orange-500 text-left mb-4 cursor-pointer">
                    Minimum amount is <span className="underline">{limit?.min} {selectedFrom}</span>
                  </div>
                }
                {
                  limit?.max != null && +amount > limit.max && <div
                    onClick={() => {
                      setAmount((limit?.max - 0.0001))
                    }}
                    className="text-base text-orange-500 text-left mb-4 cursor-pointer">
                    Maximum amount is <span className="underline">{
                      (+limit?.max).toPrecision(6)
                    } {selectedFrom}</span>
                  </div>
                }
                <Button
                  loading={isLoading}
                  block
                  type="submit"
                  color="primary"
                  size="large"
                  shape="rounded"
                >
                  Buy {networks.hasOwnProperty(selectedTo) ? networks[selectedTo].name : selectedTo}
                </Button>
              </>
            }
          >



            <div className="">

              <Form.Item
                style={{ width: "100%" }}
                name="from"
                label="From"
                validateFirst
                required={false} // to remove the red asterisk
              >
                <div className="flex">
                  <Input
                    value={amount}
                    type="number"
                    inputMode="decimal"
                    onChange={(e) => {
                      setAmount(e)
                      console.log(e);
                    }}
                    placeholder="0.0"
                  />

                  <SelectTicker side={"from"} visible={visibleSelectFrom} setVisible={setVisibleSelectFrom} />
                </div>
                {/* <div
                  onClick={() => {
                    const from = selectedFrom;
                    const to = selectedTo;
                    setSelectedFrom(to);
                    setSelectedTo(from);
                  }}
                  style={{
                    position: "absolute",
                    zIndex: 100,
                    right: 32,
                    borderRadius: 8,
                    // backgroundColor: 'white',
                  }}
                  className="cursor-pointer btn-swap"
                >
                  <IoSwapVerticalOutline size={28}  style={{ padding: 4 }} />
                </div> */}
              </Form.Item>
            </div>
            <div className="">
              <Form.Item
                style={{ width: "100%" }}
                name="to"
                label="To"
                validateFirst
                required={false} // to remove the red asterisk

              >
                <div className="flex">

                  {
                    isLoadingEstimate ?
                      <div style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center" }} >
                        <DotLoading /> </div>
                      :
                      <Input
                      disabled
                        value={+(+(estimate?.amountTo)).toPrecision(6)}
                        type="number"
                        inputMode="decimal"
                        onChange={console.log}
                        placeholder="0.0"
                      />
                  }
                  <SelectTicker side="to" visible={visibleSelectTo} setVisible={setVisibleSelectTo} />
                  
                  {/* <div className="flex items-center mr-8">
      <img style={{height: 32}} src={networks['XNO'].logo} alt={`XNO logo`} width={32} height={32} />
      <div className="text-gray-400 ml-3">
        XNO
      </div>
      </div> */}
                </div>
              </Form.Item>
            </div>
          
          </Form>
        </div>
     
      </div>
    </div >
  );
}

//    <List header="To">
// {
//   Object.keys(networks).map((network) => (
//     <List.Item
//       key={network}
//       onClick={() => {

//       }}
//       prefix={
//         <Image src={networks[network].logo} alt={`${network} logo`} width={24} fit="cover" />
//       }
//       description={networks[network].name}
//     >
//       {network}
//     </List.Item>
//   ))
// }
// </List>