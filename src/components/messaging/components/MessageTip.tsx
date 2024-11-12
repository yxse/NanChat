import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { WalletContext } from "../../Popup";
import { Card, DotLoading } from "antd-mobile";
import { convertAddress, formatAmountRaw } from "../../../utils/format";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../../app/Network";
import { rawToMega } from "../../../nano/accounts";
import { ConvertToBaseCurrency, FormatBaseCurrency } from "../../app/Home";

const MessageTip = ({ message, side, hash, ticker }) => {
    const {data, isLoading} = useSWR("block-" + hash, () => fetchBlock(ticker, hash), {revalidateOnFocus: false});
    const amountMega = data?.amount && rawToMega(ticker, data.amount);
    return (
        <div
        // style={{marginLeft: '10px', marginRight: '10px'}}
        key={message._id}
        className={`flex ${side === "from" ? 'justify-end' : 'justify-start'} mb-1 mx-4`}
    >
        <Card
        style={{
        }}
            className={`max-w-[70%] p-2 rounded-lg ${side === "from"
                    ? ' rounded-br-none'
                    : ' rounded-bl-none'
                }`}
        >
            <p
            > 
            <div>
            {/* Crypto sent */}
            </div>
            <div className="flex items-center gap-2 mx-2">
                <div>
                    <img src={networks[ticker].logo} style={{width: '32px', height: '32px'}} />
                </div>
                <div className="flex flex-col">
                    <div>
                    {
                        isLoading ? <DotLoading /> : 
                            <ConvertToBaseCurrency amount={amountMega} ticker={ticker} />
                        }
                    </div>
                    <div>
                        {
                            isLoading ? <DotLoading /> : 
                            <>
                                {+amountMega} {ticker}
                            </>
                        }
                    </div>
                </div>
            </div>
            {/* {amountMega} */}
            </p>
            {/* <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-xs opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div> */}
        </Card>
    </div>
    )
}

export default MessageTip;