import { BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineSwap } from "react-icons/ai";
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
  TextArea,
  Toast,
} from "antd-mobile";
import { ScanCodeOutline } from "antd-mobile-icons";

import { useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard, getAccount } from "../Settings";
import { send } from "../../nano/accounts";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR, { mutate } from "swr";
import NetworkList from "./NetworksList";
import SelectTickerAll from "../swap/SelectTickerAll";
import { IoSwapVerticalOutline } from "react-icons/io5";
import SwapHistory from "./SwapHistory";
import { createOrder, fetcher, getAllCurrencies, getEstimate, getLimits, getOrder } from "../../nanswap/swap/service";
import { Scanner } from "../Scanner";
export default function Swap() {
  const { data: allCurrencies, isLoading: isLoadingCurrencies } = useSWR(
    getAllCurrencies, fetcher, {
    errorRetryCount: 0
  });
  // const [result, setResult] = useState<string>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [visibleSelectFrom, setVisibleSelectFrom] = useState<boolean>(false);
  const [visibleSelectTo, setVisibleSelectTo] = useState<boolean>(false);
  const [selectedFrom, setSelectedFrom] = useState<string>("XNO");
  const [selectedTo, setSelectedTo] = useState<string>("BAN");
  const [amount, setAmount] = useState<number | string>("");
  const [side, setSide] = useState<string>("from"); // ["from", "to"]
  const [form] = Form.useForm();
  const { data: balance, isLoading: balanceLoading } = useSWR(
    "balance-" + selectedFrom,
    () => fetchBalance(selectedFrom),
  );
  const { data: estimate, isLoading: isLoadingEstimate } = useSWR(
    getEstimate + '?from=' + selectedFrom + '&to=' + selectedTo + '&amount=' + amount,
    fetcher,
  )
  const { data: limit, isLoading: isLoadingLimit } = useSWR(
    getLimits + '?from=' + selectedFrom + '&to=' + selectedTo,
    fetcher,
  )

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const SelectTicker = ({ side, visible, setVisible }) => {
    const selected = side === "from" ? selectedFrom : selectedTo;
    return <div className="flex items-center space-x-4 m-2 p-2 cursor-pointer mr-7" onClick={() => setVisible(true)}>
      <img
        style={{
          height: 32,
        }}
        src={allCurrencies?.[selected]?.image}
        alt={`${selected} logo`} width={32} height={32} />
      <div className="text-gray-400">
        {selected}
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
            allCurrencies={allCurrencies}
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
        toAddress = await getAccount(selectedTo);
      } else {
        toAddress = values.address;
      }
      const fromAmount = amount
      console.log(toAddress, amount);
      let exchange = await fetch(createOrder, {
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

      if (networks.hasOwnProperty(selectedFrom)) {
        const fromAddress = await getAccount(selectedFrom);
        await send(selectedFrom, fromAddress, exchange.payinAddress, amount);
        mutate("balance-" + selectedFrom);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        mutate("balance-" + selectedTo);
        mutate(`${getOrder}${exchange.id}`);
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

  return (
    <div className="divide-y divide-solid divide-gray-700 space-y-6">
      <div className="container  relative mx-auto">
        <div className="text-center text-2xl flex-col">
          <NavBar onBack={() => navigate(`/`)}>
            Swap
          </NavBar>
          <Form
            initialValues={{
              address: searchParams.get("to") || "",
              amount: searchParams.get("amount") || "",
            }}
            form={form}
            onFinish={onSwap}
            className="mt-4"
            layout="horizontal"
            footer={
              <>
                {
                  amount != undefined && amount !== "" && networks.hasOwnProperty(selectedFrom) && !balanceLoading && amount > balance && <div
                    onClick={() => {
                      setAmount(balance)
                    }}
                    className="text-base text-orange-500 text-left mb-4 cursor-pointer">
                    Insufficient balance. Available: <span className="underline">{balance} {selectedFrom}</span>
                  </div>
                }
                {
                  amount != undefined && amount !== "" && amount < limit?.min && <div
                    onClick={() => {
                      setAmount(limit?.min
                      )
                    }}
                    className="text-base text-orange-500 text-left mb-4 cursor-pointer">
                    Minimum amount is <span className="underline">{limit?.min} {selectedFrom}</span>
                  </div>
                }
                {
                  limit?.max != null && amount > limit.max && <div
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
                >
                  Swap
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
                <div
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
                  }}
                  className="cursor-pointer bg-gray-800"
                >
                  <IoSwapVerticalOutline size={24} color="gray" style={{ padding: 2 }} />
                </div>
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
                        value={+(+(estimate?.amountTo)).toPrecision(6)}
                        type="number"
                        inputMode="decimal"
                        onChange={console.log}
                        placeholder="0.0"
                      />
                  }
                  <SelectTicker side="to" visible={visibleSelectTo} setVisible={setVisibleSelectTo} />
                </div>
              </Form.Item>
            </div>
            {
              !networks.hasOwnProperty(selectedTo) &&

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
                }}
                >
                  <ScanCodeOutline
                  fontSize={24}
                  className="cursor-pointer text-gray-200 mr-3 mt-4"
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
        <SwapHistory />
      </div>
    </div >
  );
}
