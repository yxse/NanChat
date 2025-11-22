import {
  Button,
  Divider,
  DotLoading,
  List, Modal, NavBar,
  Skeleton
} from "antd-mobile";

import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetcher, getOrder } from "../../nanswap/swap/service";
import useSWR from "swr";
import { AiOutlineCheck, AiOutlineClose, AiOutlineHourglass, AiOutlineQrcode } from "react-icons/ai";
import { CopyToClipboard } from "../Settings";
import { QRCodeSVG } from "qrcode.react";
import { BsQrCode } from "react-icons/bs";
import { openInBrowser } from "../messaging/utils";
import { networks } from "../../utils/networks";

export default function SwapTransaction() {

  const { id } = useParams();
  const navigate = useNavigate();
  const { data: order, isLoading } = useSWR(`${getOrder}${id}`, fetcher, { refreshInterval: 1000 });

  const isFeeless = networks.hasOwnProperty(order?.from) && networks.hasOwnProperty(order?.to)

  if (isLoading) {
    return <Skeleton animated />;
  }
  const ExchangeStatus = () => {
    return <div className="flex justify-center space-x-1 items-center">
      <div>
        {
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
        }</div>
      <div className="first-letter:uppercase">
        {order.status}
      </div>
    </div>
  }
  const Waiting = () => {
    return <>
      <List
        header="To complete the exchange:"
      >

        <List.Item
          title="Send"
        >
          {order.expectedAmountFrom} {order.from} ({order.fromNetwork})
        </List.Item>
        <List.Item
          title="To this address"
        >
          <CopyToClipboard text={order.payinAddress} />
          <Button
            size="small" onClick={() => {
              Modal.show({
                closeOnMaskClick: true,
                content: <div className="text-center flex flex-col items-center">
                  <QRCodeSVG value={order.payinAddress} includeMargin />
                  <CopyToClipboard text={order.payinAddress} />
                </div>
              });
            }}>
            Show QR Code</Button>
        </List.Item>
      </List>
      <Divider />
      <List >
        <List.Item
          title="Status"
        >
          <ExchangeStatus />
        </List.Item>
        <List.Item
          title="You will receive:"
        >
          ≈ {(+(+order.expectedAmountTo).toPrecision(6))} {order.to}
        </List.Item>

      </List></>
  }
  const Completed = () => {
    return <List
    >
      <List.Item
        title="Status"
      >
        <ExchangeStatus />
      </List.Item>
      <List.Item
        title="From"
      >
        {order.amountFrom || order.expectedAmountFrom} {order.from}
      </List.Item>
      <List.Item
        title="To"
      >
        {(+(+order.amountTo || +order.expectedAmountTo).toPrecision(6))} {order.to}
      </List.Item>

    </List>
  }
  return (
    <div className="divide-y divide-solid divide-gray-700 space-y-6">
      <div className="container  relative mx-auto">
        <div className="text-center text-2xl flex-col">
          <NavBar onBack={() => navigate(`/swap`)}>
            Swap Details
          </NavBar>
          {
            order.status === "waiting" ?
              <Waiting />
              :
              <Completed />
          }
        </div>
        <div className="text-center mt-4">
          <Button
            size="small"
            shape="rounded"
            onClick={() => {
              openInBrowser(`https://nanswap.com/${isFeeless ? "transaction" : "transaction-all"}/${order.id}`);
            }}
          >
            View on Nanswap
          </Button>
        </div>
      </div>
    </div >
  );
}
