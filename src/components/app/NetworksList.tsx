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
import { CopyToClipboard, ResponsivePopup } from "../Settings";
import { getRepresentative } from "../getRepresentative";
import { convertAddress, formatAddress, formatAmountMega } from "../../utils/format";
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
import { useWalletBalance } from "../../hooks/use-wallet-balance";
import Swap from "./Swap";
import { Capacitor } from "@capacitor/core";
import { useTranslation } from 'react-i18next'



export function TickerTitle({ ticker, logo, name }) {
  return <div>

    <div className="flex items-center">
      <img
        width={42}
        src={logo}
        alt={`${name} logo`} />
      <div className="flex ml-3 justify-center align-middle gap-2">
        <div>
        {name}
        </div>
        <div
        style={{color: "var(--adm-color-text-secondary)"}}
         className="text-sm">
        {ticker?.toUpperCase()}
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
  const { t } = useTranslation()
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
            isOnline ? <div className="text-green-600">{t('voting')}</div> : <div className="text-orange-400">{t('notVoting')}</div> // "Voting/Not Voting" rather than "onine/offline" as node can appear offline during low traffic
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
    return <div className="text-base m-2 ">
      {t('currentlyRepresentedBy')} {isOnline ? (alias ? `${alias}` : t('unknownAddress')) : "" // todo: resolve alias even if offline
      }:
      {
        isLoading ? <DotLoading /> : <CopyToClipboard text={currentRep} />
      }
      {
        isLoadingRepresentativeOnline ? <DotLoading /> : <div className="text-sm">
          {
            isOnline ? <div className="text-green-400 mt-2 mb-2">{t('yourRepresentativeIsVoting')}</div> : <div className="text-orange-400 mt-2 mb-2">{t('yourRepresentativeIsNotVoting')}</div>
          }

          {
            isOnline ? <> ({(+weightPercent).toFixed(2)}% {t('votingWeight')})</> : ""
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
  const { t } = useTranslation()
  if (isLoadingRepresentativeOnline) return <DotLoading />
  return <>
    <div className={"searchBarContainer sticky top-0 z-50"} style={{ backgroundColor: "rgba(26, 26, 26)" }}>
      <SearchBar
        placeholder={t('searchPlaceholder')}
        value={searchText}
        onChange={v => {
          setSearchText(v)
        }}
      />
    </div>
    <div className="flex justify-between ">
      <div>
        <div className="text-sm text-gray-400 appearance-none m-2 ">
          {t('aliasAddress')}
        </div>
      </div>
      <div>
        <div className="text-sm text-gray-400 m-2 cursor-pointer flex items-center space-x-1" onClick={() => setSort(sort === "asc" ? "desc" : "asc")}>
          {t('votingWeightLabel')}
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
            {t('nanswapDefault')}
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

export const NetworkItem = ({ network, ticker, onClick, hidePrice = false, showRepresentative, hideBalance = false, hideActions = true }) => {
  const { t } = useTranslation()

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
  const hasPrice = prices?.[ticker]?.usd;
  const ButtonAction = ({ action, text, ticker }) => { 
    return <Button 
    shape="rounded"
    onClick={(e) => {
      e.stopPropagation()
      setAction(action)
      setActiveTicker(ticker)
      setVisible(true)
    }} size="middle">{text}</Button>
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
              width={40}
              src={network.logo}
              alt={`${network.logo} logo`} />
            <div className="flex flex-col ml-3 justify-center">
              <div>{network.name}
              {
                !hidePrice &&
                <span className="text-xs ml-1" style={{ color: "var(--adm-color-text-secondary)" }}>
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
                    !hasPrice ? null :
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
                    formatAmountMega(data, ticker)
                  )}
                  {!isLoadingPrices && (
                    <div className="text-sm" style={{ color: "var(--adm-color-text-secondary)" }}>
                      {
                        hasPrice ? <><ConvertToBaseCurrency amount={data} ticker={ticker} /></> : null
                      }
                    </div>
                  )}
                </div>
                }
                {
                  !hideActions &&
                
                <div className="flex space-x-4 ml-6 mr-1 justify-end hide-on-lg">
                  <ButtonAction action={"receive"} text={t('receive')} ticker={ticker} />
                  <ButtonAction action={"send"} text={t('send')} ticker={ticker} /> 
                  {
                    Capacitor.getPlatform() !== "ios" && 
                  <ButtonAction action={"swap"} text={t('swap')} ticker={ticker} /> 
                  }
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
    <div className="text-sm" style={{ color: "var(--adm-color-text-secondary)" }}>
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
export default function NetworkList({ onClick, hidePrice, showRepresentative = false, hideActions = true, hideBalance = false, filterTickers = [], customAddress = false , selectedTicker, hideZeroBalance, noPadding = false}) {
  const [hiddenNetworks, setHiddenNetworks] = useLocalStorageState("hiddenNetworks", []);
  const [customNetworks, setCustomNetworks] = useLocalStorageState("customNetworks", {});
  const activeMainNetworks = Object.keys(networks).filter((ticker) => !networks[ticker].custom && !hiddenNetworks?.includes(ticker));
  const activeCustomNetworks = customNetworks ? Object.keys(customNetworks).filter((ticker) => !hiddenNetworks.includes(ticker)) : [];
  const [action, setAction] = useState("");
  const {balances} = useWalletBalance()
  const hideZeroBalanceNetworks = hideZeroBalance ? Object.keys(balances).filter((ticker) => balances[ticker].data === 0) : []
  
  const filteredActiveMainNetworks = activeMainNetworks.filter((ticker) => !hideZeroBalanceNetworks.includes(ticker)).filter((ticker) => {
    if (filterTickers.length > 0) {
      return filterTickers.includes(ticker);
    }
    return true;
  })
  const filteredActiveCustomNetworks = activeCustomNetworks.filter((ticker) => !hideZeroBalanceNetworks.includes(ticker)).filter((ticker) => {
    if (filterTickers.length > 0) {
      return filterTickers.includes(ticker);
    }
    return true;
  })

  // order network based on .rank if exists
  const sortedActiveMainNetworks = filteredActiveMainNetworks.sort((a, b) => {
    if (networks[a].rank && networks[b].rank) {
      return networks[a].rank - networks[b].rank;
    }
    else if (networks[a].rank) {
      return -1;
    }
    else if (networks[b].rank) {
      return 1;
    }
    return 0
  });
  
  if (hideZeroBalance && filteredActiveMainNetworks.length === 0 && filteredActiveCustomNetworks.length === 0) {
    return <div>
      <div className="text-center text-base" style={{color: "var(--adm-color-text-secondary)", marginTop: 32}}>
      {t('noFundsAvailable')}
    </div>
     
     {
Capacitor.getPlatform() !== "ios" ?
    <div className="text-center text-lg" style={{color: "var(--adm-color-primary)", cursor: "pointer", marginTop: 32, marginBottom: 48}} onClick={() => {
      setAction('buy')
      onClick('XNO', 'buy')
    }}> 
        {t('buyCrypto')} 
    </div>
    : 
    // disabled on ios, blank space div instead
    <div style={{height: 80, width: "100%"}}></div>
  }
     <ResponsivePopup
            position={"bottom"}
            // closeOnSwipe
              visible={action === "buy"}
              onClose={() => {
                setAction("");
              }}
              // onClick={() => setVisible(false)}
              closeOnMaskClick={true}
            >{action === "buy" && 
                 <Swap 
               defaultAction={"buy"}
               onSuccess={() => {
                 Toast.show({icon: 'success'})
                  setAction("");
                 console.log("success swap")
                 window.scrollTo(0, 0);
               }}
               hideHistory={true} 
               fiatDefaultTo={"XNO"}
               defaultTo={"XNO"}
               defaultFrom={"XNO"} />}
            </ResponsivePopup>
    </div>
  }
  return (<>
    <List style={{paddingBottom: noPadding ? 0 : "var(--safe-area-inset-bottom)"}}>
      {sortedActiveMainNetworks.map((ticker) => (
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
        filteredActiveCustomNetworks.map((ticker) => (
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
