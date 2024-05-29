import { BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineSwap } from "react-icons/ai";
import { Button, Card, Form, Input, Modal, NavBar, Result, TextArea, Toast } from "antd-mobile";
import { useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard, getAccount } from "../Settings";
import { send } from "../../nano/accounts";

export default function Send({ ticker, onBack }: { ticker: string }) {
    // const [result, setResult] = useState<string>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
 
    

    return (
        <div className="divide-y divide-solid divide-gray-700 space-y-6">
            <div className="container  relative mx-auto">
                <div className="text-center text-2xl flex-col">
                    <NavBar
                        onBack={onBack}
                    >Send {networks[ticker].name}</NavBar>
                    <div className="flex justify-center m-2">
                        <img src={networks[ticker].logo} alt={`${ticker} logo`} width={48} />
                    </div>

                    <div className="text-sm text-gray-400 appearance-none">
                        Available 0.0 {ticker}

                    </div>
                    <Form
                    onFinish={async (values) => {
                        try {
                            
                            setIsLoading(true)
                            console.log(values)
                            const fromAddress = await getAccount(ticker)
                            const toAddress = values.address
                            const amount = values.amount
                            console.log(fromAddress, toAddress, amount)
                            await send(ticker, fromAddress, toAddress, amount)
                            Toast.show({
                                content: "Success!",
                            });
                            onBack()
                        } catch (error) {
                            console.error("Error sending:", error);
                            Toast.show({
                                content: "Error sending",
                            });
                        }
                        finally {
                            setIsLoading(false)
                        }
                    }}
                    className="mt-4"
        layout='horizontal'
        footer={
          <Button
          loading={isLoading}
           block type='submit' color='primary' size='large'>
            Send
          </Button>
        }
      >
         <Form.Item name='address' label='Address'>
          <TextArea 
          autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder='Address to send to'
            rows={2}
          />
        </Form.Item>
         <Form.Item
          name='amount'
          label='Amount'
          required={false}
          rules={[
            { required: true, message: 'Please enter a valid amount' , type: 'number', transform: value => parseFloat(value), min: 0, max: 1000000}
        ]}          
        >
          <Input 
          type='number'
          inputMode="decimal"
           onChange={console.log} placeholder='Amount to send' />
        </Form.Item>
       

      </Form>
                </div>

            </div>

        </div>
    );
}