import { BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineHistory, AiOutlineSwap } from "react-icons/ai";
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
import { createOrder, createOrderFiat, fetcher, getAllCurrencies, getEstimate, getEstimateFiat, getFiatCurrencies, getLimits, getLimitsFiat, getOrder } from "../../nanswap/swap/service";
import { GoCreditCard } from "react-icons/go";
import { fetchBalance } from "./Network";
import { WalletContext } from "../Popup";
import { convertAddress } from "../../utils/format";
import { Scanner } from "./Scanner";
import { Capacitor } from "@capacitor/core";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";

export default function Buy({hideHistory = false, defaultFrom = "USD", defaultTo = "XNO", onSuccess}) {
  const { data: allCurrencies, isLoading: isLoadingCurrencies } = useSWR(
    getFiatCurrencies, fetcher, {
    errorRetryCount: 0
  });
  // filter with deposit_enabled
  const fiatCurrenciesEnabled = allCurrencies && Object.fromEntries(Object.entries(allCurrencies).filter(([key, value]) => value.deposit_enabled));
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
    return <div className="flex items-center justify-center space-x-4 m-2 p-2 cursor-pointer  
    " onClick={() => setVisible(true)}>

      <img
        style={{
          height: 32,
        }}
        src={fiatCurrenciesEnabled?.[selected]?.image}
        alt={`${selected} logo`} width={32} height={32} />
       <div className="text-gray-400 flex items-center gap-2">
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
          }
        }} />
      </Popup> */}
      {
        isLoadingCurrencies ? <DotLoading /> :
          <SelectTickerAll
            allCurrencies={fiatCurrenciesEnabled}
            isLoadingCurrencies={isLoadingCurrencies}
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
        Toast.show({
          content: exchange.error,
        });
        return;
      }
      else{
        const link = "https://payments.guardarian.com/checkout?tid=" + exchange.orderId;
        if (Capacitor.isNativePlatform()) {
            await InAppBrowser.openInSystemBrowser({url: link, options: DefaultSystemBrowserOptions})
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
        content: "Error sending",
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

  return (
    <div className="">
      <div className="container  relative mx-auto">
        <div className="">
          <NavBar
          backArrow={hideHistory ? false : true}
            onBack={() => navigate(`/`)}>
              <span className="text-xl">
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
                  Buy NANO
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
                  {/* <SelectTicker side="to" visible={visibleSelectTo} setVisible={setVisibleSelectTo} /> */}
                  
                  <div className="flex items-center mr-8">
      <img style={{height: 32}} src={networks['XNO'].logo} alt={`XNO logo`} width={32} height={32} />
      <div className="text-gray-400 ml-3">
        XNO
      </div>
      </div>
                </div>
              </Form.Item>
            </div>
            {
              (!networks.hasOwnProperty(selectedTo) ||
              allCurrencies?.[selectedTo]?.feeless == false) // show address for btc if not nanbtc feeless 
              &&
              <div className="flex justify-between">
                <Form.Item
                  label="Address"
                  name={"address"}
                  style={{ width: "100%" }}
                >
                  <TextArea
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    placeholder="Recipient Address"
                    rows={2}
                  />
                </Form.Item>
                <Scanner
                  onScan={(result) => {
                    form.setFieldValue("address", result);
                  }
                }>

                <ScanCodeOutline
                  fontSize={24}
                  className="cursor-pointer text-gray-200 mr-4 mt-4"
                  />
                  </Scanner>
              </div>
            }
            {
              allCurrencies?.[selectedTo]?.hasExternalId &&
              <Form.Item
                label="Memo"
                name={"externalId"}
                style={{ width: "100%" }}
                required={false}
              >
                <Input
                  placeholder="Recipient Memo (optional)"
                />
              </Form.Item>
            }
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