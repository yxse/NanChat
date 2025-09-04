import { box } from "multi-nano-web";
import { memo, useContext, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { useWallet, WalletContext } from "../../Popup";
import { Button, Card, Divider, DotLoading, List, Modal, NavBar } from "antd-mobile";
import { convertAddress, formatAmountMega, formatAmountRaw } from "../../../utils/format";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../Network";
import { rawToMega } from "../../../nano/accounts";
import { ConvertToBaseCurrency, FormatBaseCurrency } from "../Home";
import { openHashInExplorer } from "../../messaging/utils";
import { GiftOutline, RightOutline } from "antd-mobile-icons";
import ProfileName from "../../messaging/components/profile/ProfileName";
import ProfilePicture from "../../messaging/components/profile/ProfilePicture";
import { AiFillCrown, AiOutlineCrown, AiOutlineSwap, AiTwotoneCrown } from "react-icons/ai";
import useMessageDecryption from "../../messaging/hooks/use-message-decryption";
import Sticker from "../../messaging/components/Sticker";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";
import { useMessageRedpacket, useRedpacketState } from "./MessageRedPacket";
import { fetcherMessages } from "../../messaging/fetcher";
import { formatTelegramDate } from "../../../utils/telegram-date-formatter";
// import bluePacketIcon from "../../../../public/icons/blue-packet-small.png"

const RedPacketReward = ({messageDecrypted, sticker, amountRaw, ticker, fromAccount}) => {
    const navigate = useNavigate()
    const amount = rawToMega(ticker, amountRaw)

   return <div style={{textAlign: "center"}}>
      
            <div style={{color: "var(--gold-color)", fontSize: 48, marginTop: 8}}>
              {formatAmountMega(amount, ticker)} <span style={{fontSize: 24}}>{ticker}</span>
            </div>
            <div
            onClick={() => {
              navigate('/' + ticker)
            }}
             style={{color: "var(--gold-color)", marginTop: 8}}>
                  Red Packet transferred to Wallet <RightOutline style={{display: "inline"}} />
            </div>
        </div> 
}

const RedPacketResult = ({ side, hash }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate()
  const {activeAccount} = useWallet()
  
  // Get ID from search params
  const id = searchParams.get('id')
  
  // SWR hook
  const {data: message, isLoading} = useSWR(id ? '/redpacket?id=' + id: null, fetcherMessages)
  
  // Custom hooks
  const {message: messageDecrypted, sticker} = useMessageRedpacket({message: message})
  const {isFinished, isExpired} = useRedpacketState(message)
  useHideNavbarOnMobile(true)

  // NOW do your conditional logic and early returns
  if (!activeAccount) return <DotLoading />
  if (isLoading) return <DotLoading />

  // Rest of your component logic
  const claim = message?.redPacket?.openedBy?.find((claim) => claim.account === activeAccount)
  const claimLuckiest = message?.redPacket?.openedBy.length > 0 ?  message?.redPacket?.openedBy?.reduce((luckiest, current) => {
    return (BigInt(current.amount) > BigInt(luckiest.amount)) ? current : luckiest;
  }) : null;  
  const totalAmount = message?.redPacket?.openedBy?.reduce((total, claim) => {
  return total + BigInt(claim.amount);
}, BigInt(0));
  const ticker = message?.redPacket?.ticker

  const claims = message?.redPacket?.openedBy;
  const totalDuration = claims?.length > 0 ? new Date(claims[claims.length - 1].ts) - new Date(message.timestamp)
    : 0;

  const totalDurationMinutes = Math.floor(totalDuration / (1000 * 60));
  const totalDurationSeconds = Math.floor(totalDuration / 1000);

  const openedIn = totalDurationMinutes > 1 ? `${totalDurationMinutes} minutes` : `${totalDurationSeconds} seconds`
  const isGroup = message.type === "group"
  let resultHeader = ""
  if (isFinished){
    resultHeader = `${message?.redPacket?.openedBy?.length} Red Packet(s) opened (${formatAmountMega(rawToMega(ticker, totalAmount), ticker)} ${ticker} in total) in ${openedIn}`
  }
  else{
    resultHeader = message?.redPacket?.openedBy?.length + " Red Packet(s) opened. "
    if (!isExpired){
       resultHeader += message?.redPacket?.remain + " remaining."
    }
    else{
       resultHeader += " Red Packet Expired."
    }
  }
  return (
    <div
      onClick={() => {
      }}
      style={{}}
      key={id}
    >
      <NavBar
        onBack={() => {
          navigate(`/chat/${message.chatId}`)
        }}
        style={{
          backgroundColor: "rgb(203, 64, 64)",
          backgroundImage: "url(https://bucket.nanwallet.com/logo/45-degree-fabric-dark.png)",
          marginBottom: 32
        }}
      >
      </NavBar>
          <div>
            {/* <img src={networks[ticker]?.logo} style={{width: '32px', height: '32px', display: "inline-block"}} />  */}
            <div style={{display: 'flex', gap: 4, alignItems: 'center', justifyContent: "center", fontWeight: "bold"}}>
            <ProfilePicture address={message.fromAccount} size={32} /> <ProfileName address={message.fromAccount} />
            </div>
            <div style={{color: "var(--adm-color-text-secondary)"}}>
            {
                messageDecrypted ? 
            <div style={{textAlign: "center", marginTop: 8, fontSize: 18}}>
            {messageDecrypted}
            </div> : 
            <div style={{textAlign: "center", marginTop: 8, fontSize: 18}}>
            Best wishes!
            </div>
            }
            </div>
            </div>
            {
                sticker && <div style={{display: 'flex', justifyContent: 'center', marginTop: 16}}>
            <Sticker stickerId={sticker} height="64px" />
            </div>
            }
      {
        claim &&
        <RedPacketReward amountRaw={claim.amount} messageDecrypted={messageDecrypted} ticker={ticker} sticker={sticker}  fromAccount={message.fromAccount}/>
      }
      {
        !isGroup && isExpired && <div style={{textAlign: "center", color: "var(--adm-color-text-secondary)", marginTop: 32}}>Red Packet expired and refunded.</div>
      }
      {
        isGroup && 
      <List header={resultHeader} style={{marginTop: 32}} mode="card">
        {
          message?.redPacket?.openedBy.map((claim) => {
            return <List.Item
            arrowIcon={false}
            onClick={() => {
              openHashInExplorer(claim.hash, ticker)
            }}
            extra={
              <div style={{color: "var(--adm-color-text)"}}><span style={{fontWeight: "bold"}}>
                {formatAmountMega(rawToMega(ticker, claim.amount), ticker)} {ticker}</span>
                {isFinished && claim.account === claimLuckiest.account ? <div style={{display: "flex", alignItems: "center", gap: 4, color: "#e5c100"}}>
                  <AiFillCrown />
                  Luckiest </div>
                  :<div>&nbsp;</div>
                  }
                </div>
              }
              prefix={<ProfilePicture address={claim.account} />}>
                <ProfileName address={claim.account} />
                <div className="text-sm" style={{color: "var(--adm-color-text-secondary"}}>
                  {formatTelegramDate(claim.ts)}
                </div>
              </List.Item>
          })
        }
      </List>
        }
    </div>
  )
}
export default RedPacketResult;