// @ts-nocheck
import { useContext, useEffect, useState } from "react";
import "../../styles/app/home.css";
import { activeNetworks, networks } from "../../utils/networks";
import Network, { fetchAccountInfo, fetchBalance, ModalReceive, showModalReceive } from "./Network";
import { Button, Divider, DotLoading, Ellipsis, FloatingBubble, Grid, List, SearchBar, Space, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";
import { fetchPrices, fetcher } from "../../nanswap/swap/service";
import { CopyToClipboard } from "../Settings";
import { getRepresentative } from "../getRepresentative";
import { convertAddress, formatAddress } from "../../utils/format";
import { FaExchangeAlt, FaSortAmountDown } from "react-icons/fa";
import { FaCheck, FaCopy, FaSortDown, FaSortUp } from "react-icons/fa6";
import { TiArrowSortedDown, TiArrowSortedUp } from "react-icons/ti";
import { TbWorldQuestion } from "react-icons/tb";
import useLocalStorageState from "use-local-storage-state";
import { ConvertToBaseCurrency } from "./Home";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import { getAccount } from "../getAccount";
import { AiOutlineArrowDown, AiOutlineArrowUp, AiOutlineSend, AiOutlineSwap } from "react-icons/ai";
import { CopyIcon } from "./Icons";
import { WalletContext } from "../Popup";
import { fetcherChat } from "../messaging/fetcher";



export function TickerTitle({ ticker, logo, name }) {
  return <div>

    <div className="flex items-center">
      <img
        width={42}
        src={logo}
        alt={`${name} logo`} />
      <div className="flex flex-col ml-3 justify-center">
        <div>{ticker}</div>
        <div className="text-sm text-gray-400">
          {name}
        </div>

      </div>
    </div>

  </div>;
}


export const Representative = ({ ticker, condensed = false, newLocalRep = null }) => {
  const [localRepresentative, setLocalRepresentative] = useState(null)
  const {wallet} = useContext(WalletContext);
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);
  const { data, isLoading } = useSWR("representative-" + ticker, () => fetchAccountInfo(ticker, activeAccount));
  const { data: representativeOnline, isLoading: isLoadingRepresentativeOnline } = useSWR('https://api.nanexplorer.com/representatives_online?network=' + networks[ticker].id, fetcher);

  const currentRep = data?.representative ? data?.representative : localRepresentative;
  const isOnline = representativeOnline?.rep.find((rep) => rep.account === currentRep);
  const alias = representativeOnline?.rep.find((rep) => rep.account === currentRep)?.account_alias;
  const weightPercent = representativeOnline?.rep.find((rep) => rep.account === currentRep)?.percent;
  useEffect(() => {
    if (localRepresentative === null) {
      getRepresentative(ticker).then((rep) => {
        setLocalRepresentative(rep) // this is used if account not yet open
      })
    }
    if (newLocalRep !== null) {
      getRepresentative(ticker).then((rep) => { // to refresh on change of rep when account not yet opened
        setLocalRepresentative(rep)
      })
    }
    // if (data?.representative) {
    //   setLocalRepresentative(data?.representative) // this overrides the local storage representative if account_info has a representative
    // }
  }
    , [newLocalRep])
  if (condensed) {
    return <div>
      <div className="text-right">
        <div>
          {isLoadingRepresentativeOnline ? (
            <DotLoading />
          ) : (
            isOnline ? <div className="text-green-600">Voting</div> : <div className="text-orange-400">Not Voting</div> // "Voting/Not Voting" rather than "onine/offline" as node can appear offline during low traffic
          )}
          {isLoading ? <DotLoading /> : <div className="text-sm text-gray-400">
            {
              (alias ? alias : <>{formatAddress(currentRep)} </>)
            }
          </div>
          }
        </div>
      </div>
    </div>
  }
  else {
    return <div className="text-base text-gray-400 appearance-none m-2 ">
      Currently Represented by {isOnline ? (alias ? `${alias}` : "Unknown Address") : "" // todo: resolve alias even if offline
      }:
      {
        isLoading ? <DotLoading /> : <CopyToClipboard text={currentRep} />
      }
      {
        isLoadingRepresentativeOnline ? <DotLoading /> : <div className="text-sm">
          {
            isOnline ? <div className="text-green-400 mt-2 mb-2">Your Representative is Voting</div> : <div className="text-orange-400 mt-2 mb-2">Your Representative is not Voting</div>
          }

          {
            isOnline ? <> ({(+weightPercent).toFixed(2)}% voting weight)</> : ""
          }
        </div>
      }

    </div>
  }
}

export const RepresentativeList = ({ ticker, onClick }) => {
  const [searchText, setSearchText] = useState("")
  const [sort, setSort] = useState("desc") // "asc" or "desc"
  const { data: representativeOnline, isLoading: isLoadingRepresentativeOnline } = useSWR('https://api.nanexplorer.com/representatives_online?network=' + networks[ticker].id, fetcher);
  if (isLoadingRepresentativeOnline) return <DotLoading />
  return <>
    <div className={"searchBarContainer sticky top-0 z-50"} style={{ backgroundColor: "rgba(26, 26, 26)" }}>
      <SearchBar
        placeholder='Search'
        value={searchText}
        onChange={v => {
          setSearchText(v)
        }}
      />
    </div>
    <div className="flex justify-between ">
      <div>
        <div className="text-sm text-gray-400 appearance-none m-2 ">
          Alias/Address
        </div>
      </div>
      <div>
        <div className="text-sm text-gray-400 m-2 cursor-pointer flex items-center space-x-1" onClick={() => setSort(sort === "asc" ? "desc" : "asc")}>
          Voting Weight
          {
            sort === "asc" ? <TiArrowSortedDown onClick={() => setSort("desc")} /> : <TiArrowSortedUp onClick={() => setSort("asc")} />
          }
        </div>
      </div>
    </div>
    <List>
      <List.Item onClick={() => onClick(networks[ticker].defaultRep)}>
        <div className="flex items-center justify-between cursor-pointer text-sm text-left">
          <div>
            Nanswap (Default)
          </div>
          <div>
          </div>
        </div>
      </List.Item>
      {
        representativeOnline?.rep.sort((a, b) => sort === "asc" ? a.percent - b.percent : b.percent - a.percent
        ).filter((rep) => {
          return rep?.account_alias?.toLowerCase().includes(searchText.toLowerCase())
        }).map((rep) => (
          <List.Item onClick={() => onClick(rep.account)}>
            <div className="flex items-center justify-between cursor-pointer text-sm text-left">
              <div>
                {rep.account_alias ? rep.account_alias : formatAddress(rep.account)}
              </div>
              <div>
                {(+rep.percent).toFixed(2)}%
              </div>
            </div>
          </List.Item>
        ))
      }

    </List>
  </>
}

export const NetworkItem = ({ network, ticker, onClick, hidePrice = false, showRepresentative, hideBalance = false, hideActions = false }) => {
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
    {
      revalidateOnMount: false,
      revalidateOnFocus: false,
    }
  );
  const { wallet } = useContext(WalletContext);
  const account = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);
  const { data, isLoading } = useSWR("balance-" + ticker + "-" + account, () => fetchBalance(ticker, account));
  const [visible, setVisible] = useState(false);
  const [activeTicker, setActiveTicker] = useState(null);
  const [action, setAction] = useState("");

  const ButtonAction = ({ action, ticker }) => { 
    return <Button 
    shape="default"
    onClick={(e) => {
      e.stopPropagation()
      setAction(action)
      setActiveTicker(ticker)
      setVisible(true)
    }} size="middle">{action.charAt(0).toUpperCase() + action.slice(1)}</Button>
  }
  return <div>
    <div
      key={ticker}
      className={"cursor-pointer"}
      onClick={() =>
        onClick(ticker, account)
      }
    >
      <Grid columns={12} style={{ alignItems: "center" }}>
        <Grid.Item span={6}>
          <div className="flex items-center">
            <img
              width={42}
              src={network.logo}
              alt={`${network.logo} logo`} />
            <div className="flex flex-col ml-3 justify-center">
              <div>{network.name}

              {
                hidePrice &&
                <span className="text-xs text-gray-400 ml-1">
                {ticker}
              </span>
              }
              </div>
              {
                !hidePrice &&
                <div className="flex items-center space-x-1 mt-1">
                  <div className="text-xs text-gray-400">
                    {/* ${+(prices?.[ticker]?.usd)?.toPrecision(4)} */}
                    <ConvertToBaseCurrency amount={1} ticker={ticker} maximumSignificantDigits={4} />
                  </div>
                  {
                    prices?.[ticker]?.change > 0 ? <div className="text-xs text-green-600">
                      +{(prices?.[ticker]?.change * 100)?.toFixed(2)}%
                    </div> : <div className="text-xs text-red-600">
                      {(prices?.[ticker]?.change * 100)?.toFixed(2)}%
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </Grid.Item>


        {/* {tickerTitle(ticker, networks[ticker].logo, networks[ticker].name, onClick)} */}
        {
          !showRepresentative && // don't show balance if representative is shown
          <>
            <Grid.Item span={6}>
              <div className="flex justify-end items-center">
                {
                  !hideBalance &&
                <div className="text-right">
                  {isLoading ? (
                    <DotLoading />
                  ) : (
                    data
                  )}
                  {!isLoadingPrices && (
                    <div className="text-sm text-gray-400">
                      ~ <ConvertToBaseCurrency amount={data} ticker={ticker} />
                    </div>
                  )}
                </div>
                }
                {
                  !hideActions &&
                
                <div className="flex space-x-4 ml-6 mr-1 justify-end hide-on-lg">
                  <ButtonAction action="receive" ticker={ticker} />
                  <ButtonAction action="send" ticker={ticker} />
                  <ButtonAction action="swap" ticker={ticker} /> 
                </div>
                }
              </div>
            </Grid.Item>
            {/* <Grid.Item span={7}>
      <div className="align-middle ">
        <div className="flex mx-2  items-center   " style={{textAlign: "left"}}>
          <span className="text-gray-200 text-sm"  >
        {
          account.slice(0, networks[ticker].prefix.length + 7)
        }
        </span>
        ...
        <span className="text-gray-200 text-sm">
        {
          account.slice(account.length - 6, account.length)
        }
        </span>
        <div className="ml-2 hover:opacity-80 transition-all focus:outline-none  group-hover:block group-active:!hidden text-center">
        <FaCopy className="text-blue-300" />
      </div>
      <div>
        <FaCheck className="ml-2 text-blue-300 hidden group-active:block transition-all" />
      </div>
</div>
      </div>
      </Grid.Item> */}
          </>

        }

        {
          showRepresentative &&
          <Grid.Item span={6}>
            <Representative ticker={ticker} condensed /></Grid.Item>
        }
      </Grid>
    </div>
    <ModalReceive
      onClose={() => {
        setVisible(false);
        setActiveTicker(null);
      }}
      action={action} ticker={activeTicker} modalVisible={activeTicker} setModalVisible={setVisible} setAction={setAction} />
  </div>
}

export const ItemNetworkTitle = ({ticker}) => {
  const network = networks[ticker];
  console.log(network)
  console.log(ticker)
  return <div className="flex items-center">
  <img
    width={42}
    src={network?.logo}
    alt={`${network?.logo} logo`} />
  <div className="flex flex-col ml-3 justify-center">
    <div>{ticker}</div>
    <div className="text-sm text-gray-400">
      {network?.name}
    </div>
  </div>
</div>
}
export const ItemCopyAddress = ({ address, ticker, onClick }) => {
  return <List.Item>
     <div
      key={ticker}
      className={"cursor-pointer"}
      onClick={() =>
        onClick(ticker, address)
      }
    >
      <Grid columns={12} style={{ alignItems: "center" }}>
        <Grid.Item span={6}>
          <ItemNetworkTitle ticker={ticker} />
        </Grid.Item>
            <Grid.Item span={6}>
              <div className="flex justify-end items-center">
                  <div className="text-right  text-gray-400 flex items-center space-x-2 active:text-gray-800">
                    <div className="">{formatAddress(address)}</div><div> <CopyIcon /></div>
                  </div>
              </div>
            </Grid.Item>
      </Grid>
    </div>
    </List.Item>
}
export default function NetworkList({ onClick, hidePrice, showRepresentative = false, hideActions = false, hideBalance = false, filterTickers = [], customAddress = false , selectedTicker}) {
  const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);
  const [customNetworks, setCustomNetworks] = useLocalStorageState("customNetworks", {});
  const activeMainNetworks = Object.keys(networks).filter((ticker) => !networks[ticker].custom && !hiddenNetworks?.includes(ticker));
  const activeCustomNetworks = customNetworks ? Object.keys(customNetworks).filter((ticker) => !hiddenNetworks.includes(ticker)) : [];
  
  const {data: newNetworks, isLoading: isLoadingNewNetworks} = useSWR("/networks", fetcherChat);
  if (newNetworks) {
    let newNetworksToAdd = {}
    let numberOfNewNetworks = 0
    for (let ticker in newNetworks) {
      if (!networks[ticker]) {
        let newNetworksLs = JSON.parse(localStorage.getItem("newNetworks"))
        if (!newNetworksLs?.[ticker]) {
          newNetworksToAdd[ticker] = newNetworks[ticker]
          numberOfNewNetworks++
        }
      }
    }
   
    if (numberOfNewNetworks > 0) {
      localStorage.setItem("newNetworks", JSON.stringify(newNetworks))
      Toast.show({
        content: `Restart NanWallet to add ${numberOfNewNetworks} new network${numberOfNewNetworks > 1 ? "s" : ""}`,
        duration: 7000
      })
    }
  }

  return (<>
    <List >

      {activeMainNetworks.map((ticker) => (
        <List.Item
        className={selectedTicker === ticker ? "active" : ""}
        >
          <NetworkItem
            network={networks[ticker]}
            key={ticker}
            ticker={ticker}
            onClick={onClick}
            hidePrice={hidePrice}
            showRepresentative={showRepresentative}
            hideActions={hideActions}
            hideBalance={hideBalance}
            customAddress={customAddress}
          />
        </List.Item>
      ))}
      {
        activeCustomNetworks.map((ticker) => (
          <List.Item>
            <NetworkItem
              network={customNetworks[ticker]}
              key={ticker}
              ticker={ticker}
              onClick={onClick}
              hidePrice={hidePrice}
              showRepresentative={showRepresentative}
              hideActions={hideActions}
              hideBalance={hideBalance}
              customAddress={customAddress}
            />
          </List.Item>
        ))
      }
    </List>
  </>
  );
}
