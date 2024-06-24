import { BiPaste, BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineSwap } from "react-icons/ai";
import {
  Button,
  Card,
  DotLoading,
  Form,
  Input,
  Modal,
  NavBar,
  NoticeBar,
  Result,
  TextArea,
  Toast,
} from "antd-mobile";
import { ScanCodeOutline, TextOutline } from "antd-mobile-icons";

import { useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard, getAccount } from "../Settings";
import { send } from "../../nano/accounts";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR from "swr";
import { MdContentPaste } from "react-icons/md";
import { parseURI } from "../../utils/format";

export default function Send() {
  // const [result, setResult] = useState<string>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [form] = Form.useForm();
  const { ticker } = useParams();
  const { data: balance, isLoading: balanceLoading } = useSWR(
    "balance-" + ticker,
    () => fetchBalance(ticker),
  );
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  return (
    <div className="divide-y divide-solid divide-gray-700 space-y-6">
      <div className="container  relative mx-auto">
        <div className="text-center text-2xl flex-col">
          <NavBar onBack={() => navigate(`/${ticker}`)}>
            Send {networks[ticker].name}
          </NavBar>
          <div className="flex justify-center m-2">
            <img
              src={networks[ticker].logo}
              alt={`${ticker} logo`}
              width={48}
            />
          </div>

          <div className="text-sm text-gray-400 appearance-none">
            Available {balanceLoading ? <DotLoading /> : balance} {ticker}
          </div>
          <Form
            initialValues={{
              address: searchParams.get("to") || "",
              amount: searchParams.get("amount") || "",
            }}
            form={form}
            onFinish={async (values) => {
              try {
                setIsLoading(true);
                console.log(values);
                const fromAddress = await getAccount(ticker);
                const toAddress = values.address;
                const amount = values.amount;
                console.log(fromAddress, toAddress, amount);
                await send(ticker, fromAddress, toAddress, amount);
                Toast.show({
                  content: "Success!",
                });
                navigate(`/${ticker}`);
              } catch (error) {
                console.error("Error sending:", error);
                Toast.show({
                  content: "Error sending",
                });
              } finally {
                setIsLoading(false);
              }
            }}
            className="mt-4"
            layout="horizontal"
            footer={
              <Button
                loading={isLoading}
                block
                type="submit"
                color="primary"
                size="large"
              >
                Send
              </Button>
            }
          >
            <div className="flex justify-between">
              <Form.Item
                label="Address"
                name={"address"}
                style={{ width: "100%" }}
              >
                <TextArea
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  placeholder="Address to send to"
                  rows={2}
                />
              </Form.Item>
              <ScanCodeOutline
                fontSize={24}
                className="cursor-pointer text-gray-200 mr-3 mt-4"
                onClick={() => {
                  Modal.show({
                    // style: { width: "100%", height: "268px" },
                    // bodyStyle: { height: "268px" },
                    closeOnMaskClick: true,
                    title: "Scan QR Code Address",
                    content: (
                      <div style={{ height: 256 }}>
                        <Scanner
                          //   styles={
                          onScan={(result) => {
                            console.log(result);
                            let parsed = parseURI(result[0].rawValue);
                            console.log(parsed);
                            form.setFieldValue("address", parsed.address);
                            form.setFieldValue("amount", parsed.megaAmount);
                            Modal.clear();
                          }}
                        />
                      </div>
                    ),
                  });
                }}
              />
              <BiPaste fontSize={24} className="cursor-pointer text-gray-200 mr-4 mt-4"
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
            </div>

            <Form.Item
              name="amount"
              label="Amount"
              validateFirst
              required={false} // to remove the red asterisk
              rules={[
                {
                  required: true,
                  message: "Please enter a valid amount",
                  type: "number",
                  transform: (value) => parseFloat(value),
                },
                {
                  required: true,
                  message: `Available ${ticker} is ${balance}`,
                  type: "number",
                  transform: (value) => parseFloat(value),
                  min: 0,
                  max: balance,
                },
              ]}
            >
              <Input
                type="number"
                inputMode="decimal"
                onChange={console.log}
                placeholder="Amount to send"
              />
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}
