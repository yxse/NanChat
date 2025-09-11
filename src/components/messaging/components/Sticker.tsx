import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { WalletContext } from "../../useWallet";
import { Card, DotLoading } from "antd-mobile";
import { formatAmountRaw } from "../../../utils/format";
import { convertAddress } from "../../../utils/convertAddress";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../../app/Network";
import { rawToMega } from "../../../nano/accounts";
import { fetcherMessages, fetcherMessagesNoAuth } from "../fetcher";

const Sticker = ({ stickerId, height = "75px" }) => {
    const {data } = useSWR('/stickers', fetcherMessagesNoAuth, {            
          focusThrottleInterval: 60 * 60 * 1000, // only 1 req per hour max
            dedupingInterval: 60 * 60 * 1000,
            keepPreviousData: true,
});
    
    let url = data?.find(sticker => sticker.id == stickerId)?.cache_url;
        return <img src={url} style={{
                height: height,
                marginBottom: 0,
                objectFit: 'contain',
                
                }} />
            
    }

export default Sticker;