import { BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineSwap } from "react-icons/ai";
import {
  Button,
  ErrorBlock,
  Form,
  Input,
  Modal,
  NavBar,
  NoticeBar,
  ResultPage,
  Skeleton,
  Space,
  Toast,
} from "antd-mobile";
import { useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard, getAccount } from "../Settings";
import Send from "./Send";
import History from "./History";
import useSWR from "swr";
import { getWalletRPC, rawToMega } from "../../nano/accounts";
import RPC from "../../nano/rpc";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchPrices } from "./Home";
import { GoCreditCard } from "react-icons/go";

export default function AddNetwork({  }) {
  const {  } = useParams();
  const navigate = useNavigate();
  const router = useLocation();
  return (
    <div className="">
      <div className="container  relative mx-auto">
        <div className="text-center text-2xl flex-col">
          <NavBar onBack={() => navigate("/")}>Add custom nano network</NavBar>
         </div>
         <NoticeBar className="mb-2 text-sm" wrap content="Anyone can create a custom network, including malicious ones. Add only trusted networks."
          color="alert"/>
         <Form onFinish={(values) => {
            console.log(values);
            let newCustomNetworks = JSON.parse(localStorage.getItem("customNetworks"));
            if (!newCustomNetworks) {
              newCustomNetworks = {};
            }
            newCustomNetworks[values.ticker] = values;
            newCustomNetworks[values.ticker].logo = window.location.origin + "/public/img/crypto/unknown.svg";
            localStorage.setItem("customNetworks", JSON.stringify(newCustomNetworks));
          }}>
            <Form.Item label="Name" name={"name"} required={false} rules={[{ required: true, message: "Please enter a name" }]}>
              <Input placeholder="MyNano" />
            </Form.Item>
            <Form.Item label="Ticker" name={"ticker"} required={false} rules={[{ required: true, message: "Please enter a ticker" }]}>
              <Input placeholder="MXNO" />
            </Form.Item>
            <Form.Item label="RPC URL" name={"rpc"} required={false} rules={[{ required: true, message: "Please enter a RPC URL" }]}>
              <Input placeholder="http://localhost:4242" />
            </Form.Item>
            <Form.Item label="Decimals" name={"decimals"} required={false} rules={[{ required: true, message: "Please enter a decimals" }]}>
              <Input placeholder="30" />
            </Form.Item>
            <Form.Item label="Prefix" name={"prefix"} required={false} rules={[{ required: true, message: "Please enter a prefix" }]}>
              <Input placeholder="nani" />
            </Form.Item>
            <Form.Item>
              <Button type="primary">Add network</Button>
            </Form.Item>
         </Form>
         </div>
    </div>
  );
}
