import { Button, CenterPopup, CheckList, DotLoading, Ellipsis, List, Popup, SearchBar } from 'antd-mobile'
import React, { useState } from 'react'
import { AiOutlinePlusCircle } from 'react-icons/ai'
import { useWindowDimensions } from '../../../hooks/use-windows-dimensions';
import { useNavigate } from 'react-router-dom';
import { formatAddress } from '../../../utils/format';
import { AccountAvatar } from './ChatList';
import useSWR from 'swr';
import { fetcherMessages } from '../fetcher';
import useLocalStorageState from 'use-local-storage-state';
import Contacts from '../../app/Contacts';
import InfiniteScroll from 'react-infinite-scroll-component';
import useSWRInfinite from 'swr/infinite';
import { RiVerifiedBadgeFill } from 'react-icons/ri';
import { CheckCircleFill, CheckCircleOutline, MailOutline } from 'antd-mobile-icons';
import { useWallet } from '../../Popup';
import { MdOutlineCircle } from 'react-icons/md';

export const AccountListItems = ({ accounts, badgeColor, onClick, viewTransition = true, selectedAccounts, setSelectedAccounts, alreadySelected }) => {
    // remove duplicate accounts
    const uniqueAccounts = accounts.filter((v, i, a) => a.findIndex(t => (t._id === v._id)) === i)
    return (
        <CheckList
        value={selectedAccounts}
        onChange={(v) => {
            setSelectedAccounts(v)
        }}
         multiple extra={active => 
            active ? <CheckCircleFill /> : <MdOutlineCircle color='var(--adm-color-text-secondary)' />
        } >
            <List.Item>
                Select one or more accounts
            </List.Item>
            {
                uniqueAccounts?.map(account => (
                    <CheckList.Item
                    disabled={alreadySelected?.includes(account._id)}
                    value={account._id}
                        // onClick={() => {
                        //     onClick && onClick(account)
                        // }}
                        key={account._id}
                        
                        prefix={
                            <AccountAvatar
                            verified={account?.verified}
                                url={account?.profilePicture?.url}
                                account={account._id}
                                badgeColor={badgeColor}
                            />
                        }
                    >
                        <div style={{}}>
                        <div className="flex items-center gap-2">
                            <Ellipsis content={account.name} />
                        {account?.verified && <RiVerifiedBadgeFill />}
                        </div>
                        <div className="text-xs" style={{color: "var(--adm-color-text-secondary)"}}>
                            {account.username}
                        </div>
                        </div>
                    </CheckList.Item>
                ))
            }
        </CheckList>
    );
}

function NewChatPopup({visible, setVisible, title="Create new chat", onAccountSelect, accounts = [], alreadySelected}) {
    const { isMobile } = useWindowDimensions()
    const ResponsivePopup = isMobile ? Popup : CenterPopup;
    // const [visible, setVisible] = useState(false);
    const {wallet, activeAccount} = useWallet( )
    const [searchText, setSearchText] = useState('')
    const [contacts, setContacts] = useLocalStorageState('contacts', {
        defaultValue: []
    });
    const [selectedAccounts, setSelectedAccounts] = useState(alreadySelected || [])
    const navigate = useNavigate();

    const getKey = (pageIndex, previousPageData) => {
        // console.log({pageIndex})
        // console.log({previousPageData})
        if (previousPageData && !previousPageData.length) return null // reached the end
        return `/accounts?page=${pageIndex}${searchText ? `&search=${searchText}` : ''}`
    }
    const { data: pages, size, setSize, isLoading} = useSWRInfinite<string[]>(
        getKey, fetcherMessages, {keepPreviousData: true});
    if (!pages) {
        return <DotLoading />
    }
    const all = pages ? pages.flat() : []
    // console.log({pages})
    // console.log({all})
    // console.log({size})
    return (
        <>
            <ResponsivePopup
            key={"newChatPopup"}
                // showCloseButton
                visible={visible}
                onClose={() => setVisible(false)}
                closeOnMaskClick={true}
                closeOnSwipe={false}
            >
                <div className=" ">
                    {/* <span
                    style={{float: 'left', color: 'var(--adm-color-primary)', position: 'absolute', cursor: 'pointer'}}
                     onClick={() => {
                                navigator.share({
                                    title: `Hey, I'm using NanWallet for end-to-end encrypted messaging. Install NanWallet and message me at ${activeAccount}`,
                                    url: window.location.href + `/${activeAccount}`
                                })  
                            }}
                            className="text-xl ml-2 mt-2">
                                <MailOutline style={{display: 'inline-block', marginRight: 4}} />
                                invite
                            </span> */}
                            <div>

                    <div 
                style={isMobile ? {} : { minWidth: 500 }}
                className="text-xl  text-center p-2">
                     <div 
                 style={{float: 'left', marginTop: 4, marginLeft: 4, cursor: 'pointer'}}
                 onClick={() => {
                    setVisible(false)
                 }}
                 className='text-base' color='default'>
                    Cancel
                </div>
                    {title}
                    
                 <Button 
                 disabled={selectedAccounts.length === 0}
                    onClick={() => {
                        onAccountSelect && onAccountSelect(selectedAccounts)
                        setSelectedAccounts([])
                        setVisible(false)
                    }}
                 style={{float: 'right'}}
                 size='small' 
                 color={selectedAccounts.length === 0 ? 'default' : 'primary'}
                 >
                    Done {selectedAccounts.length > 0 && `(${selectedAccounts.length})`}
                </Button>
                </div>
               
                    
                </div>
                </div>
                <div className={"searchBarContainer"}>
                    <SearchBar
                        placeholder='Search NanChat ID / Name / Address'
                        value={searchText}
                        onChange={v => {
                            setSearchText(v)
                        }}
                    />
                </div>
                <div style={{  }}>
                    
                        <InfiniteScroll
                        height={400}
                            dataLength={all?.length}
                            next={() => {
                                console.log('loading more')
                                setSize(size + 1)
                            }}
                            endMessage={
                                null
                              }
                            hasMore={true}
                            loader={isLoading && <DotLoading />}
                        >
                           
                    {/* <div className="text-base  pl-4 m-2">
                        Your Nano contacts
                    </div> */}
                    {/* <Contacts onlyImport={true} /> */}
                    {/* <AccountListItems
                        onClick={(account) => {
                            setVisible(false);
                        }}
                        accounts={contacts
                            .filter(contact => contact.addresses.find(network => network.network === 'XNO') && (searchText ? contact.name.toLowerCase().includes(searchText.toLowerCase()) : true))
                            .map(contact => {
                            return {
                                _id: contact.addresses.find(network => network.network === 'XNO')?.address,
                                name: contact.name,
                            }
                        })}
                        badgeColor={"gray"} /> */}

                    {/* <div className="text-base  pl-4 m-2">
                        All users
                    </div> */}
                     {
                                accounts?.length > 0 ? <AccountListItems
                                selectedAccounts={selectedAccounts}
                                setSelectedAccounts={setSelectedAccounts}
                                    // onClick={(account) => {
                                    //     onAccountSelect && onAccountSelect(account)
                                    //     setVisible(false);
                                    // }}
                                    accounts={accounts} badgeColor="gray" /> : 
                            
                            <AccountListItems
                            alreadySelected={alreadySelected}
                                selectedAccounts={selectedAccounts}
                                setSelectedAccounts={setSelectedAccounts}
                            viewTransition={false} // view transition bugged cause of the popup close
                                // onClick={(account) => {
                                //     onAccountSelect && onAccountSelect(account)
                                //     setVisible(false);
                                // }}
                                accounts={all} badgeColor="gray" />
                            }
                        </InfiniteScroll>
                </div>
            </ResponsivePopup>
        </>
    )
}

export default NewChatPopup