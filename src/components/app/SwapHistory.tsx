import { BiHistory, BiHourglass, BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineCheck, AiOutlineClose, AiOutlineHourglass, AiOutlineSwap } from "react-icons/ai";
import {
  Button,
  Card,
  CheckList,
  DotLoading,
  ErrorBlock,
  Form,
  Image,
  InfiniteScroll,
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
import { Scanner } from "@yudiel/react-qr-scanner";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR from "swr";
import NetworkList from "./NetworksList";
import SelectTickerAll from "../swap/SelectTickerAll";
import { IoSwapVerticalOutline } from "react-icons/io5";
import { CheckCircleOutline } from 'antd-mobile-icons'
import { GrInProgress } from "react-icons/gr";
import { fetcher, getOrder } from "../../nanswap/swap/service";


const OrderInfo = ({ id, createdAt }) => {
  const { data: order, isLoading } = useSWR(`${getOrder}${id}`, fetcher, {
    errorRetryCount: 0
  });

  if (isLoading) {
    return <DotLoading />;
  }
  if (!order) {
    return <ErrorBlock />;
  }

  return (
    <List.Item
      description={
        <div className="flex justify-between">
          <div>
            {+(+order.expectedAmountFrom).toPrecision(5)} {order.from} {"->"} {order.to} {+(+order.expectedAmountTo).toPrecision(5)}
          </div>
          <div>
            {new Date(createdAt).toLocaleString()}
          </div>
        </div>
      }
      prefix={
        order.status === "completed" ? (
          <AiOutlineCheck />
        ) : order.status === "waiting" ? (
          <AiOutlineHourglass />
        ) :
          order.status === "error" || order.status === "failed" ? (
            <AiOutlineClose />
          ) :
            (
              <DotLoading />
            )
      }>
      {order.status}
    </List.Item>
  );
}

export default function SwapHistory() {
  const history = JSON.parse(localStorage.getItem('history_exchanges') || '[]').slice(0, 10); // get last 10 exchanges only, todo: virtualized list and cache order info request in localstorage
  return (
    <div className="divide-y divide-solid divide-gray-700 space-y-6 overflow-scroll h-screen scroll-smooth pb-96 ">
      <div className="text-2xl m-2 mt-5">
      </div>
      <List
        style={{ marginBottom: 64 }}
        header={
          <div className="flex items-center">
            <BiHistory size={20} className="inline mr-2" />
            History
          </div>
        }
      >

        {
          history.map((exchange, idx) => {
            return <Link key={idx} to={`/swap/${exchange?.id}`}>

              <OrderInfo id={exchange?.id} createdAt={exchange?.createdAt} />
            </Link>

          })
        }
      </List>
    </div>
  );
}
