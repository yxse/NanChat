import {
  ActionSheet,
  Button,
  CenterPopup,
  DotLoading,
  Ellipsis,
  ErrorBlock,
  InfiniteScroll,
  List,
  SafeArea,
  Space,
  SwipeAction,
  Toast,
} from "antd-mobile";
import { useContext, useEffect, useRef, useState } from "react";
import { getWalletRPC, rawToMega } from "../../nano/accounts";
import { getAccount } from "../getAccount";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import { networks } from "../../utils/networks";
import RPC from "../../nano/rpc";
import useSWR, { useSWRConfig } from "swr";
import { BiSend, BiSolidSend } from "react-icons/bi";
import { useNavigate } from "react-router-dom";
import { Action } from "antd-mobile/es/components/action-sheet";
import { MinusCircleOutline, AddCircleOutline, UserOutline } from "antd-mobile-icons";
import useSWRInfinite from "swr/infinite";
import { MdHowToVote, MdOutlineAlternateEmail } from "react-icons/md";
import { AiOutlineContacts, AiOutlineTag, AiOutlineWallet } from "react-icons/ai";
import { fetchAlias, fetchAliasInternet } from "../../nanswap/swap/service";
import { useLocalStorage } from "../../utils/useLocalStorage";
import useLocalStorageState from "use-local-storage-state";
import { WalletContext } from "../Popup";
import { convertAddress, formatAddress } from "../../utils/format";
import { useWindowDimensions } from "../../hooks/use-windows-dimensions";
import CopyAddressPopup from "./CopyAddressPopup";
import CopyAddressPopupCustom from "./CopyAddressPopupCustom";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { InAppReview } from '@capacitor-community/in-app-review';
import { Capacitor } from "@capacitor/core";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
import ProfileName from "../messaging/components/profile/ProfileName";
import { HapticsImpact } from "../../utils/haptic";

export function askForReview(delay = 500) {
  // ask for review if user has made at least 5 transactions and last review was more than 2 months ago
  
  if (Capacitor.isNativePlatform() && 
     (new Date().getTime() - parseInt(localStorage.getItem("lastReview")) > 1000 * 60 * 60 * 24 * 60) &&
     Object.keys(localStorage).filter((k) => k.startsWith("history-")).length > 5
    ) {
    localStorage.setItem("lastReview", new Date().getTime().toString())
    setTimeout(() => {
      InAppReview.requestReview()
    }
    , delay) // 2 seconds delay to let the new transaction appear or success send message to be shown
  }
}

export const getKeyHistory = (pageIndex, previousPageData) => {
  if (previousPageData && (!previousPageData.length || previousPageData == "")) return null;
  return `history-${"ANA"}-${pageIndex}`
}

export const AliasInternetIdentifier = ({ email }) => {
  const [popupVisible, setPopupVisible] = useState(true);
  const { data, isLoading } = useSWR('identifier-alias-' + email, () => fetchAliasInternet(email))
  // if (isLoading) return null
  if (isLoading) return <DotLoading />
  if (data == null) return null
  console.log("alias", data)
  return (
    <div className="flex items-center ">
      <MdOutlineAlternateEmail className="inline mr-1" />
      {formatAddress(data)}
      <CopyAddressPopupCustom
        addresses={[{ address: data, ticker: "XNO" }]}
        title={`${email} Addresses`}
        popupVisible={popupVisible}
        setPopupVisible={setPopupVisible}
      />

      {/* <Ellipsis content={data} /> */}
    </div>
  )
}
export const IdentifierOrKnownAlias = ({ account }) => {
  if (account.includes("@")) {
    return <AliasInternetIdentifier email={account} />
  }
  return <Alias account={account} />
}

export const DateHeader = ({ timestamp, timestampPrev, timestampNext, reverse = false }) => {
  const FormatDate = ({ timestamp }) => {
    return (
      <>
        {new Date(timestamp).toLocaleDateString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </>
    )
  }
  if (reverse) {
    if (timestampNext == null) return <FormatDate timestamp={timestamp} />
    if (timestampPrev == null) return null
    return <>
      {new Date(timestampPrev).toLocaleDateString() !==
        new Date(
          timestamp,
        ).toLocaleDateString() && (
          <div className="">
            {
              new Date(timestampPrev).toLocaleDateString() === new Date().toLocaleDateString() ? "Today" :
                <FormatDate timestamp={timestampPrev} />
          }
          </div>
        )}
    </>
  }
  return <>
    {new Date(timestamp).toLocaleDateString() !==
      new Date(
        timestampPrev,
      ).toLocaleDateString() && (
        <div className="">
          {
            new Date(timestamp).toLocaleDateString() === new Date().toLocaleDateString() ? "Today" : 
           <FormatDate timestamp={timestamp} />
        }
        </div>
      )}
  </>
}
export const Alias = ({ account }) => {
  const { data, isLoading } = useSWR('alias-' + account, () => fetchAlias(account), {
    dedupingInterval: 1000 * 60 * 60 * 24 // 1 day
  })
  const {wallet} = useContext(WalletContext)
  const [contacts] = useLocalStorageState("contacts", { defaultValue: [] })
  let contact = contacts?.find((c) => c?.addresses?.find((a) => a?.address == account))
  let accountNano = convertAddress(account, "XNO")
  let isWalletAccount = wallet.accounts.find((a) => a.address == accountNano)
  if (contact) {
    return (
      <div className="flex items-center ">
        <AiOutlineContacts className="inline mr-1" />
        {contact?.name}
      </div>
    )
  }
  if (isWalletAccount) {
    return (
      <div className="flex items-center ">
        <AiOutlineWallet className="inline mr-1" />
        {/* <UserOutline className="inline mr-1" /> */}
        <ProfileName address={accountNano} fallback={"Account " + +(wallet.accounts.findIndex((a) => a.address == accountNano)) + 1} />
      </div>
    )
  }
  if (isLoading) return null
  if (data == null) return null
  return (
    <div className="flex items-center ">
      <AiOutlineTag className="inline mr-1" />
      <Ellipsis content={data} />
    </div>
  )
}

export default function History({ ticker, onSendClick }: { ticker: string }) {

  // const isLoading = false
  // const [data, setData] = useState<string[][]>([[]])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  // const { data, error, size, setSize, isLoading, mutate } = useSWRInfinite(getKeyHistory, 
  //   (key) => fetchHistory(ticker, size, key), 
  //   {
  //     // revalidateOnFocus: false,
  //     // revalidateOnReconnect: false,
  //     // revalidateOnMount: true,
  //   });

  const [dataPages, setDataPages] = useState<string[]>([])
  // console.log("data", data)
  // console.log("swr cache", cache)
  // remove duplicates
  // history = history.filter((v, i, a) => a.findIndex(t => (t.hash === v.hash)) === i)

  const [visible, setVisible] = useState(false);
  const [activeTx, setActiveTx] = useState(null);
  // const [account, setAccount] = useState("")
  const { wallet } = useContext(WalletContext)
  const account = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);
  const { data, isLoading } = useSWR("history-" + ticker, () => fetchHistory(ticker, 0, false))
  let history = data?.concat(dataPages)
  const [contacts] = useLocalStorageState("contacts", { defaultValue: [] })
  const navigate = useNavigate();
  const actions = [
    {
      text: "Copy address",
      key: "copy-address",
      onClick: () => {
        navigator.clipboard.writeText(activeTx.account).then(
          () => {
            Toast.show({
              content: "Copied!",
              duration: 1000,
            });
          },
          (err) => {
            Toast.show({
              content: "Failed to copy",
            });
          },
        );
      },
    },
    {
      text: "View Details",
      key: "view-details",
      onClick: () => {
        if (Capacitor.isNativePlatform()) {
          InAppBrowser.openInSystemBrowser({
            url: `https://nanexplorer.com/${networks[ticker].id}/block/${activeTx.hash}`,
            options: DefaultSystemBrowserOptions
          })
        }
        else {          
          window.open(
            `https://nanexplorer.com/${networks[ticker].id}/block/${activeTx.hash}`
          )
        }
      }
    },
    {
      text: "Create contact",
      key: "add-to-contacts",
      onClick: () => {
        navigate("/contacts/?address=" + activeTx.account + "&network=" + ticker + "&add=true");
      }
    },
  ];
  if (contacts.find((c) => c?.addresses?.find((a) => a?.address == activeTx?.account))) {
    delete actions[2]
  }

  const checkIfCached = (fromHeight, toHeight) => {
    for (let i = fromHeight; i <= toHeight; i++) {
      if (!localStorage.getItem("history-" + ticker + "-" + i + "-" + account)) {
        return false
      }
    }
    return true
  }
  const fetchMoreHistory = async (ticker, page = 0, reverse = false) => {
    console.log("fetching more history", ticker, page)
    const heightKey = 'history-' + ticker + '-height' + '-' + account;
    // const account = await getAccount(ticker);
    let count = 10;
    let offset = page * count;
    if (localStorage.getItem(heightKey)) {
      offset = parseInt(localStorage.getItem(heightKey)) - (page * count);
      if (offset < 0) {
        count = count + offset;
        if (count == 0) {
          setHasMore(false);
          return []
        }
        offset = 0;
      }
    }
    console.log(`should fetch from block ${offset + 1} to ${offset + count}`)
    if (checkIfCached(offset + 1, offset + count)) {
      console.log("cached")
      let r = []
      for (let i = offset + 1; i <= offset + count; i++) {
        r.push(JSON.parse(localStorage.getItem("history-" + ticker + "-" + i + "-" + account)))
      }
      if (offset == 0) {
        setHasMore(false);
      }
      return r.reverse()
    }

    let history = await new RPC(ticker).acocunt_history(account, count, offset, true);
    if (history.error || history.history == "") {
      setHasMore(false);
      return []
    }

    let r = history.history;
    r = r.reverse();
    if (offset == 0) {
      setHasMore(false);
    }
    for (let i = 0; i < r.length; i++) {
      let tx = r[i];
      let height = tx.height;
      localStorage.setItem("history-" + ticker + "-" + height + "-" + account, JSON.stringify(tx));
    }
    return r;

  }
  const fetchHistory = async (ticker, page = 0, reverse = false) => {
    console.log("fetching history", ticker, page)
    const heightKey = 'history-' + ticker + '-height' + '-' + account;
    // const account = await getAccount(ticker);
    let count = 10;
    let offset = page * count;
    // if (checkIfCached(offset+1, offset + count)){
    //   console.log("cached")
    //   let r = []
    //   for (let i = offset+1; i <= offset + count; i++){
    //     r.push(JSON.parse(localStorage.getItem("history-" + ticker + "-" + i)))
    //   }
    //   if (offset == 0){
    //     setHasMore(false);
    //   }
    //   return r
    // }
    let history = await new RPC(ticker).acocunt_history(account, count, offset, false);
    if (history.error || history.history == "") {
      setHasMore(false);
      return []
    }

    let r = history.history;
    console.log("history", r.length, r[0].height)
    localStorage.setItem(heightKey, r[0].height);
    for (let i = 0; i < r.length; i++) {
      let tx = r[i];
      let height = tx.height;
      localStorage.setItem("history-" + ticker + "-" + height + "-" + account, JSON.stringify(tx));
    }
    return r;
  };

  useEffect(() => {
    // getAccount(ticker).then((r) => setAccount(r))
    // fetchHistory(ticker, 0).then((r) => setData([r]))
  }, [])
  const { isMobile } = useWindowDimensions()

   
  return (
    <>
      <div
        style={
          isMobile ? {
          } : {
            width: 450,
          }}

        className="w-full transition-opacity">
        {isLoading && (
          <div className="divide-y divide-solid divide-gray-700 w-full">
            {[1, 2, 3, 4, 5, 6].map((_, idx) => (
              <List key={idx} mode="card">
                <List.Item>
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-500 rounded-full"></div>
                    <div className="w-1/2 h-4 bg-gray-500 rounded"></div>
                  </div>
                </List.Item>
              </List>
            ))}
          </div>
        )}
        {!isLoading && (history?.length == 0 || !Array.isArray(history)) && (
          <ErrorBlock
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 8,
            }}
            status="empty"
            title="Transaction will appear here"
            description=""
          />
        )}
        {!isLoading && history?.length > 0 && (
          <div className="">
            {history.map((tx, idx) => (
              <List
                className={localStorage.getItem("receiveHashesToAnimate")?.includes(tx.hash) ? "animate-received" : ""}
                ref={(el) => {
                  if (el == null) return
                  el.nativeElement.onanimationend = () => {
                    askForReview()
                    // console.log("animation end for ", tx.hash)
                    let hashes = JSON.parse(localStorage.getItem("receiveHashesToAnimate"))
                    hashes = hashes.filter((h) => h !== tx.hash)
                    localStorage.setItem("receiveHashesToAnimate", JSON.stringify(hashes))
                  }
                }}
                mode="card"
                key={tx.hash + "-list"}
                header={
                    new Date(+tx.local_timestamp * 1000).toLocaleDateString() !== new Date(+history[idx - 1]?.local_timestamp * 1000).toLocaleDateString() && 
                    <DateHeader timestamp={+tx.local_timestamp * 1000} timestampPrev={+history[idx - 1]?.local_timestamp * 1000} />
                }
              >
            <SwipeAction
              key={tx.hash + "-swipe"}
              rightActions={[
                {
                  key: "send-again",
                  color: "#108ee9",
                  onClick: () => {
                    HapticsImpact({
                      style: ImpactStyle.Medium
                    });
                    navigate(
                      `?to=${tx.account}&amount=${+rawToMega(ticker, tx.amount)}`,
                      { replace: true }
                    );
                    onSendClick()
                  },
                  text: (
                    <>
                      <BiSolidSend size={18} />
                    </>
                  ),
                },
              ]}
            >
              <List.Item
                onClick={() => {
                  setVisible(true);
                  setActiveTx(tx);
                }}
                key={tx.hash}
              >
                {/* <a
                    href={`https://nanexplorer.com/${networks[ticker].id}/block/${tx.hash}`}
                    target="_blank"
                    className="text-blue-300"
                  > */}
                <div
                  className="flex items-center space-x-4 text-sm justify-between ">
                  {/* {tx.height} */}
                  <div className="flex items-center space-x-4">
                    <div className="">
                      {tx.subtype === "send" && <MinusCircleOutline fontSize={20} />}
                      {tx.subtype === "receive" && (
                        <AddCircleOutline fontSize={20} />
                      )}
                      {tx.subtype === "change" && (
                        <MdHowToVote fontSize={20} />
                      )}
                    </div>
                    <div>
                      {tx.subtype === "send" && "Sent"}
                      {tx.subtype === "receive" && "Received"}
                      {tx.subtype === "change" && "Represenative Change"}
                      <div className="text-gray-400">
                        {
                          tx.subtype === "send" || tx.subtype === "receive" ? <>
                            {+rawToMega(ticker, tx.amount)} {ticker}
                          </> : null
                        }

                      </div>
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm text-right font-mono" style={{userSelect: "none"}}>
                    {
                      tx.subtype === "send" || tx.subtype === "receive" ? <div>
                        <div>
                          {tx.account?.slice(0, 10)}...{tx.account?.slice(-6)}
                        </div>
                        <Alias account={tx.account} />
                      </div> : null
                    }
                    {
                      tx.subtype === "change" ? <>
                        {tx.representative?.slice(0, 10)}...{tx.representative?.slice(-6)}
                        <Alias account={tx.representative} />
                      </> : null
                    }
                  </div>
                  {/* <div>
                    {tx.hash}
                  </div> */}
                </div>
                {/* </a> */}
              </List.Item>
            </SwipeAction>
          </List>
        ))}
        <InfiniteScroll
          children={(hasMore, failed) => {
            if (hasMore) return <div className="text-center"><DotLoading /></div>
            if (!hasMore) return `No more transactions`
            if (failed) return 'Failed to load transactions'
          }}
          threshold={600}
          loadMore={
            async () => {
              await fetchMoreHistory(ticker, page + 1, true).then((r) => {
                // setData([...data, r])
                let newData = [...dataPages, ...r]
                // newData[page] = r
                console.log("new data", newData)
                // mutate(newData, {populateCache: true, revalidate: false})
                setPage(page + 1)
                setDataPages(newData)
              })
            }
          } hasMore={hasMore} />
          {
            isMobile ? (
              <ActionSheet
              visible={visible}
              actions={actions}
              onClose={() => setVisible(false)}
              />
            ) : (
              <CenterPopup
              closeOnMaskClick
              visible={visible}
              onClose={() => setVisible(false)}
              >
              <Space wrap align="center" justify="center">
                {
                  actions.map((action) => (
                    <Button
                      key={action.key}
                      onClick={() => {
                        action.onClick();
                        setVisible(false);
                      }}
                    >
                      {action.text}
                    </Button>
                  ))
                }
              </Space>
            </CenterPopup>
            )
          }
      </div>
        )}
      <div className="text-center mt-4 flex flex-col m-4">
        <Button color="primary" className="mt-4" onClick={() => navigate("/swap?to=" + ticker)}>
          Buy {ticker}
        </Button>
        <a
          target="_blank"
          href={`https://nanswap.com/${networks[ticker].id}-faucet?address=${account}`}>
          <Button color="default" className="mt-4 w-full">
            Get some {ticker} for free
          </Button>
        </a>
      </div>
    </div >
    </>
  );
}
