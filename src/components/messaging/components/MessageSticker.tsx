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
import { fetcherMessages } from "../fetcher";

const MessageSticker = ({ message, side, hash, ticker }) => {
    const {data, isLoading} = useSWR('/stickers', fetcherMessages);
    
    let url = data?.find(sticker => sticker.id == message.stickerId)?.cache_url;
    return (
        <div
        // style={{marginLeft: '10px', marginRight: '10px'}}
        key={message._id}
        className={`flex ${side === "from" ? 'justify-end' : 'justify-start'} mb-1 mx-4`}
    >
        <div
        style={{
        }}
            className={`max-w-[70%] p-2 rounded-lg ${side === "from"
                    ? ' rounded-br-none'
                    : ' rounded-bl-none'
                }`}
        >
            <p
            > 
            <img src={url} style={{width: '75px'}} />
            </p>
         
        </div>
    </div>
    )
}

export default MessageSticker;