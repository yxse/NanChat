import { CenterPopup, DotLoading, List, Popup, SearchBar } from 'antd-mobile'
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
import { MailOutline } from 'antd-mobile-icons';
import { useWallet } from '../../Popup';

const AccountListItems = ({ accounts, badgeColor, onClick, viewTransition = true }) => {
    const navigate = useNavigate();
    return (
        <List>
            {
                accounts?.map(account => (
                    <List.Item
                        onClick={() => {
                            onClick && onClick(account)
                            if (viewTransition) {
                                document.startViewTransition(() => {
                                    navigate(`/chat/${account._id}`, { unstable_viewTransition: true })
                                })
                            }
                            else {
                                navigate(`/chat/${account._id}`)
                            }
                            // navigate(`/chat/${account._id}`, { unstable_viewTransition: false })
                        }}
                        key={account._id + badgeColor}
                        extra={
                            <div className="flex flex-col items-end">
                                <div>
                                    {formatAddress(account._id)}
                                </div>
                            </div>
                        }
                        prefix={
                            <AccountAvatar
                            verified={account?.verified}
                                url={account?.profilePicture?.url}
                                account={account._id}
                                badgeColor={badgeColor}
                            />
                        }
                    >
                        <div className="flex items-center gap-2">
                        {
                            account.name
                        }
                        {account?.verified && <RiVerifiedBadgeFill />}
                        </div>
                    </List.Item>
                ))
            }
        </List>
    );
}

function NewChatPopup({visible, setVisible}) {
    const { isMobile } = useWindowDimensions()
    const ResponsivePopup = isMobile ? Popup : CenterPopup;
    // const [visible, setVisible] = useState(false);
    const {wallet, activeAccount} = useWallet( )
    const [searchText, setSearchText] = useState('')
    const [contacts, setContacts] = useLocalStorageState('contacts', {
        defaultValue: []
    });

    const getKey = (pageIndex, previousPageData) => {
        console.log({pageIndex})
        console.log({previousPageData})
        if (previousPageData && !previousPageData.length) return null // reached the end
        return `/accounts?page=${pageIndex}${searchText ? `&search=${searchText}` : ''}`
    }
    const { data: pages, size, setSize} = useSWRInfinite<string[]>(
        getKey, fetcherMessages, {keepPreviousData: true});
    if (!pages) {
        return <DotLoading />
    }
    const all = pages ? pages.flat() : []
    console.log({all})
    console.log({size})
    return (
        <>
            <ResponsivePopup
                showCloseButton
                visible={visible}
                onClose={() => setVisible(false)}
                closeOnMaskClick={true}
                closeOnSwipe={false}
            >
                <div className=" ">
                    <span
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
                            </span>
                    <div 
                style={isMobile ? {} : { minWidth: 500 }}
                    className="text-xl  text-center p-2">Create new chat</div>
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
                            hasMore={pages[pages.length - 1]?.length > 0}
                            loader={<DotLoading />}
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
                            <AccountListItems
                            viewTransition={false} // view transition bugged cause of the popup close
                                onClick={(account) => {
                                    setVisible(false);
                                }}
                                accounts={all} badgeColor="gray" />
                        </InfiniteScroll>
                </div>
            </ResponsivePopup>
            <List>
                <List.Item
                    onClick={() => {
                        setVisible(true);
                    }}
                    prefix={<AiOutlinePlusCircle />}
                >
                    New Chat
                </List.Item>
            </List>
        </>
    )
}

export default NewChatPopup