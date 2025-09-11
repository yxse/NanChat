import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { WalletContext } from "../../useWallet";
import { Card, Divider, DotLoading, Modal } from "antd-mobile";
import { formatAmountRaw } from "../../../utils/format";
import { convertAddress } from "../../../utils/convertAddress";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../../app/Network";
import { rawToMega } from "../../../nano/accounts";
import { ConvertToBaseCurrency, openHashInExplorer } from "../utils";
import { CheckCircleOutline, GiftOutline } from "antd-mobile-icons";
import ProfileName from "./profile/ProfileName";
import ProfilePicture from "./profile/ProfilePicture";
import { AiOutlineSwap } from "react-icons/ai";
import { useTranslation } from "react-i18next";

const MessageTip = ({ message, side, hash, ticker , fromRedPacket = false}) => {
    const {data, isLoading} = useSWR("block-" + hash, () => fetchBlock(ticker, hash), {revalidateOnFocus: false});
    const amountMega = data?.amount && rawToMega(ticker, data.amount);
    const { t } = useTranslation();

    console.log("messatip", message);
    return (
        <div
        onClick={() => {
            openHashInExplorer(hash, ticker);
        }}
        style={{color: 'var(--adm-color-text)', cursor: 'pointer'}}
        // style={{marginLeft: '10px', marginRight: '10px'}}
        key={message._id}
        // className={`flex ${side === "from" ? 'justify-end' : 'justify-start'} mb-1 mx-2`}
    >
        
        <Card>
            <div className="flex items-center gap-2 ">
                <div>
                    <img src={networks[ticker]?.logo} style={{width: '32px', height: '32px'}} />
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
               <div className="text-sm" style={{color: 'var(--adm-color-text-secondary)'}}>
              <Divider style={{margin: '8px 0'}}/>
              {fromRedPacket ? 
              <>
              <CheckCircleOutline style={{display: "inline"}} /> NanChat {t('transfer')}
              </>
              : <><AiOutlineSwap style={{display: "inline", marginRight: 4}}/>{t('transfer')}</>}
            </div>
        </Card>
    </div>
    )
}

export default MessageTip;