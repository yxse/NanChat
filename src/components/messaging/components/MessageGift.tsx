import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { WalletContext } from "../../Popup";
import { Card, Divider, DotLoading, Modal } from "antd-mobile";
import { convertAddress, formatAmountRaw } from "../../../utils/format";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../../app/Network";
import { rawToMega } from "../../../nano/accounts";
import { ConvertToBaseCurrency, FormatBaseCurrency } from "../../app/Home";
import { openHashInExplorer } from "../utils";
import { GiftOutline } from "antd-mobile-icons";
import ProfileName from "./profile/ProfileName";
import { ChatName } from "../../app/discover/Discover";
import ProfilePicture from "./profile/ProfilePicture";
import { AiOutlineSwap } from "react-icons/ai";

const MessageGift = ({ message, side, hash, ticker }) => {
    const {data, isLoading} = useSWR("block-" + hash, () => fetchBlock(ticker, hash), {revalidateOnFocus: false});
    const amountMega = data?.amount && rawToMega(ticker, data.amount);
    const isClaimed = data?.pending !== "1";
    const [modalVisible, setModalVisible] = useState(false);
    console.log("messatip", message);
   
    const modalSuccessContent =   <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                            <ProfilePicture address={message.fromAccount} size={32} /> Cash Gift from <ProfileName address={message.fromAccount} />
                            </div>
    return (
        <div
        onClick={() => {
            // openHashInExplorer(hash, ticker);
            setModalVisible(true);

        }}
        style={{color: 'var(--adm-color-text)', cursor: 'pointer'}}
        // style={{marginLeft: '10px', marginRight: '10px'}}
        key={message._id}
        // className={`flex ${side === "from" ? 'justify-end' : 'justify-start'} mb-1 mx-2`}
    >
        <Modal
        actions={[
            {
                key: 'confirm',
                text: 'Open Gift',
                primary: true,
                
            },
            {
                key: 'cancel',
                text: 'Cancel',
                onClick: () => {
                    setModalVisible(false);
                }
            }
        ]}
        visible={modalVisible}
        onClose={() => {
            setModalVisible(false);
        }}
        title={<div><img src={networks[ticker]?.logo} style={{width: '32px', height: '32px', display: "inline-block"}} /> </div> }
        />
        <Card>
            <div className="flex items-center gap-2 ">
                <div>
                    <img src={networks[ticker]?.logo} style={{width: '32px', height: '32px'}} />
                </div>
                <div className="flex flex-col">
                    {/* <div>
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
                    </div> */}
                    <div className='' style={{
                }}> {isClaimed ? "Opened" : "Open"}</div>
                </div>
            </div>
               <div className="text-sm" style={{color: 'var(--adm-color-text-secondary)'}}>
              <Divider style={{margin: '8px 0'}}/>
              <GiftOutline style={{display: "inline", marginRight: 4}}/>
              Gift <br/>
              {/* <AiOutlineSwap style={{display: "inline", marginRight: 4}}/>
              Transfer */}
            </div>
            {/* {amountMega} */}
            
        </Card>
    </div>
    )
}

export default MessageGift;