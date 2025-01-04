// @ts-nocheck
import "../../styles/app/home.css";
import { networks } from "../../utils/networks";
import Network, { fetchBalance, showModalReceive } from "./Network";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { BiPlus } from "react-icons/bi";
import React, { useMemo, useState, useEffect } from 'react'
import { Button, CheckList, Popup, SearchBar, Space, Divider, DotLoading, FloatingBubble, List } from 'antd-mobile'
import { DemoBlock } from 'demos'
import styles from './demo2.less'
import NetworkList, { NetworkItem, TickerTitle } from "../app/NetworksList";
import { List as VirtualizedList, AutoSizer } from 'react-virtualized'


export default function SelectTickerAll({ allCurrencies, isLoadingCurrencies, onClick, visible, setVisible, side }) {
  const [selectedTicker, setSelectedTicker] = useState<string>(null);


  const items = Object.values(allCurrencies)

  const [selected, setSelected] = useState('A')
  const [searchText, setSearchText] = useState('')
  const filteredItems = useMemo(() => {
    if (searchText) {
      return items.filter(item => item.name.toLowerCase().includes(searchText.toLowerCase())
        || item.ticker.toLowerCase().includes(searchText.toLowerCase()))
    } else {
      return items
    }
  }, [items, searchText])

  function rowRenderer({ index, key, style }) {
    const currency = filteredItems[index]
    const currencyKey = Object.keys(allCurrencies).find(key => allCurrencies[key] === currency)

    console.log(index, key)
    if (isLoadingCurrencies) {
      return null
    }
    if (!currency) {
      return null
    }
    return (
      currency?.feeless ?
        <List.Item
          clickable={false}
          key={currency.ticker} value={currency.ticker} style={style} >
          <NetworkItem
          network={{
            ...currency,
            logo: currency.image,
          }}
            onClick={() => {
              onClick(currency.ticker)
              setVisible(false)
            }}
            hidePrice
            key={currency.ticker}
            ticker={currency.ticker}
          />
        </List.Item>
        :
        <List.Item
          onClick={() => {
            onClick(currencyKey)
            setVisible(false)
          }}
          clickable={false} key={currencyKey || currency.ticker} value={currency.ticker} style={style}>
          {/* {tickerTitle(currency.ticker.toUpperCase(), currency.image, currency.name, onClick)} */}
          <TickerTitle logo={currency.image} name={currency.name} ticker={currency.ticker} />
        </List.Item>
    )
  }


  return (<>
    <Popup
      bodyStyle={{ height: 500 }}
      visible={visible}
      onMaskClick={() => {
        setVisible(false)
      }}
      destroyOnClose
    >
      <div>
        <div className="text-xl  text-center p-2">{side === "from" ? "From" : "To"}</div>
      </div>
      <div className={"searchBarContainer"}>
        <SearchBar
          placeholder='Search'
          value={searchText}
          onChange={v => {
            setSearchText(v)
          }}
        />
      </div>

      <div className={"checkListContainer"}>
        <List
          className={"myCheckList"}
          defaultValue={selected ? [selected] : []}
          onChange={val => {
            setSelected(val[0])
            setVisible(false)
          }}
        >
          {/* {Object.keys(networks).map((ticker) => (
            <List.Item key={ticker} value={ticker}>
              <NetworkItem
                size="sm"
                key={ticker}
                ticker={ticker}
                onClick={onClick}
              />
            </List.Item>
          ))}
          <Divider contentPosition="left">
            Requiring External Wallet
          </Divider> */}
          {/* {filteredItems.map(item => (
            <CheckList.Item key={item} value={item}>
              {item} aze
            </CheckList.Item>
          ))} */}
          {
            isLoadingCurrencies && <DotLoading />
          }
          <AutoSizer disableHeight>
            {({ width }: { width: number }) => (
              <VirtualizedList
                onClick={() => {
                  console.log('clicked')
                }}
                rowCount={filteredItems.length}
                rowRenderer={rowRenderer}
                width={width}
                height={400}
                rowHeight={60}
              />
            )}
          </AutoSizer>
          {/* {
            !isLoadingCurrencies && allCurrencies && Object.values(allCurrencies).filter((currency) => currency.feeless !== true)
              .map((currency) => (
                <CheckList.Item key={currency.ticker} value={currency.ticker}>
                  {tickerTitle(currency.ticker, currency.image, currency.name)}
                </CheckList.Item>
              ))
          } */}
        </List>
      </div>
    </Popup></>
  )
}

