// @ts-nocheck
import { useEffect, useState } from "react";
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchAccountInfo, fetchBalance, showModalReceive } from "./Network";
import { Button, Divider, DotLoading, FloatingBubble, List, SearchBar } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";
import { fetchPrices, fetcher } from "../../nanswap/swap/service";
import { CopyToClipboard, getRepresentative } from "../Settings";
import { formatAddress } from "../../utils/format";
import { FaSortAmountDown } from "react-icons/fa";
import { FaSortDown, FaSortUp } from "react-icons/fa6";
import { TiArrowSortedDown, TiArrowSortedUp } from "react-icons/ti";



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


export const Representative = ({ ticker, condensed = false, newLocalRep=null }) => {
  const [localRepresentative, setLocalRepresentative] = useState(null)
  const { data, isLoading } = useSWR("representative-" + ticker, () => fetchAccountInfo(ticker));
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
      Currently Represented by:
      {
        isLoading ? <DotLoading /> : <CopyToClipboard text={currentRep} />
      }
      {
        isLoadingRepresentativeOnline ? <DotLoading /> : <div className="text-sm">
        {
          isOnline ? <div className="text-green-400 mt-2 mb-2">Your Representative is Voting</div> : <div className="text-orange-400 mt-2 mb-2">Your Representative is not Voting</div>
        }
        {
          isOnline ? (alias ? `Known as ${alias}` : "Unknown Address") : "" // todo: resolve alias even if offline
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
  <div className={"searchBarContainer sticky top-0 z-50"} style={{backgroundColor: "rgba(26, 26, 26)"}}>
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
      sort === "asc" ? <TiArrowSortedDown  onClick={() => setSort("desc")} /> : <TiArrowSortedUp onClick={() => setSort("asc")} />
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
export const NetworkItem = ({ ticker, onClick, hidePrice = false, showRepresentative }) => {
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
    {
      revalidateOnMount: false,
      revalidateOnFocus: false,
    }
  );
  const { data, isLoading } = useSWR("balance-" + ticker, () => fetchBalance(ticker));
  return <div>
    <div
      key={ticker}
      className={"network-card flex justify-between cursor-pointer flex-start p-0 m-0"}
      onClick={() =>
        onClick(ticker)
      }
    >
      <div className="flex items-center">
        <img
          width={42}
          src={networks[ticker].logo}
          alt={`${networks[ticker].logo} logo`} />
        <div className="flex flex-col ml-3 justify-center">
          <div>{ticker}</div>
          <div className="text-sm text-gray-400">
            {networks[ticker].name}
          </div>
          {
            !hidePrice &&
            <div className="flex items-center space-x-1 mt-1">
              <div className="text-xs text-gray-400">
                ${+(prices?.[ticker].usd)?.toPrecision(4)}
              </div>
              {
                prices?.[ticker].change > 0 ? <div className="text-xs text-green-600">
                  +{(prices?.[ticker].change * 100)?.toFixed(2)}%
                </div> : <div className="text-xs text-red-600">
                  {(prices?.[ticker].change * 100)?.toFixed(2)}%
                </div>
              }
            </div>
          }
        </div>
      </div>


      {/* {tickerTitle(ticker, networks[ticker].logo, networks[ticker].name, onClick)} */}
      {
        !showRepresentative && // don't show balance if representative is shown
        <div className="network-balance">
          <div className="text-right">
            <div>
              {isLoading ? (
                <DotLoading />
              ) : (
                data
              )}
              {!isLoadingPrices && (
                <div className="text-sm text-gray-400">
                  ~{" "}
                  {+(prices?.[ticker].usd * data).toFixed(2)}{" "}
                  USD
                </div>
              )}
            </div>
          </div>
        </div>
      }
      {
        showRepresentative && <Representative ticker={ticker} condensed />
      }
    </div>

  </div>
}

export default function NetworkList({ onClick, hidePrice, showRepresentative = false }) {

  return (<>
    <List>

      {Object.keys(networks).map((ticker) => (
        <List.Item>

          <NetworkItem
            key={ticker}
            ticker={ticker}
            onClick={onClick}
            hidePrice={hidePrice}
            showRepresentative={showRepresentative}
          />

        </List.Item>
      ))}
    </List>
  </>
  );
}
