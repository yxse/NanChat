import { Button, CenterPopup, CheckList, Divider, DotLoading, Ellipsis, List, Popup, SearchBar, Skeleton } from 'antd-mobile'
import React, { useState } from 'react'
import { AiOutlineImport, AiOutlinePlusCircle } from 'react-icons/ai'
import { useWindowDimensions } from '../../../hooks/use-windows-dimensions';
import { useNavigate } from 'react-router-dom';
import { formatAddress } from '../../../utils/format';
import { AccountAvatar } from './ChatList';
import useSWR from 'swr';
import { fetcherMessages } from '../fetcher';
import useLocalStorageState from 'use-local-storage-state';
import Contacts, { ImportContacts } from '../../app/Contacts';
import InfiniteScroll from 'react-infinite-scroll-component';
import useSWRInfinite from 'swr/infinite';
import { RiVerifiedBadgeFill } from 'react-icons/ri';
import { AddCircleOutline, CheckCircleFill, CheckCircleOutline, MailOutline, UserAddOutline } from 'antd-mobile-icons';
import { useWallet } from '../../Popup';
import { MdOutlineCircle } from 'react-icons/md';
import { defaultContacts } from '../utils';
import { useContacts } from './contacts/ImportContactsFromShare';
import { useInviteFriends } from '../hooks/use-invite-friends';
import { ResponsivePopup } from '../../Settings';




const CheckListItemAccount = ({ account, disabled, onClick }) => {
    return <CheckList.Item
                    disabled={disabled}
                    value={account._id}
                        onClick={() => {
                            onClick && onClick()
                        }}
                        key={account._id}
                        
                        prefix={
                            <AccountAvatar
                            verified={account?.verified}
                                url={account?.profilePicture?.url}
                                account={account._id}
                                badgeColor={"gray"}
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
}
const Subtitle = ({title}) => {
    return <div className="m-4"
    style={{color: 'var(--adm-color-text-secondary)', fontWeight: 500}}>
        {title}
    </div>
}
export const AccountListItems = ({ accounts, title, badgeColor, onClick, viewTransition = true, selectedAccounts, setSelectedAccounts, alreadySelected, mode }) => {
    // remove duplicate accounts
    const { inviteFriends } = useInviteFriends();
    const inviteButton = () => <div 
style={{color: 'var(--adm-color-primary)', cursor: 'pointer'}}
onClick={() => {
    inviteFriends()
}}>
    Invite
</div>
    const uniqueAccounts = accounts?.filter((v, i, a) => a.findIndex(t => (t._id === v._id)) === i)
    const selectedIcon = active => 
        active ? <CheckCircleFill /> : <MdOutlineCircle color='var(--adm-color-text-secondary)' />

    return (
        <CheckList
        value={selectedAccounts}
        onChange={(v) => {
            if (mode === "invite") {
                inviteFriends()
                return
            }
            setSelectedAccounts(v)
        }}
         multiple 
         extra={mode === "invite" ? inviteButton : selectedIcon}>
            
            {title && <Subtitle title={title} />}
            {
                uniqueAccounts?.map(account => (
                    <CheckListItemAccount
                    disabled={alreadySelected?.includes(account._id)}
                    account={account} key={account._id} />
                ))
            }
            {/* {
                mode === "invite" &&
           <Divider>Import contacts</Divider>
            } */}
        </CheckList>
    );
}
const SkeletonAccountListItems = () => {
    return (
          <div className="divide-y divide-solid divide-gray-700 w-full">
            {[1, 2, 3, 4, 5, 6].map((_, idx) => (
              <List key={idx} mode="default">
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
function NewChatPopup({visible, setVisible, title="New chat", onAccountSelect, accounts = [], alreadySelected, hideImportContacts = false}) {
    const { isMobile } = useWindowDimensions()
    const ResponsivePopup = isMobile ? Popup : CenterPopup;
    // const [visible, setVisible] = useState(false);
    const [searchText, setSearchText] = useState('')
    
    const [selectedAccounts, setSelectedAccounts] = useState(alreadySelected || [])
    
    const navigate = useNavigate();

   
    return (
        <>
            <ResponsivePopup
            bodyClassName="disable-keyboard-resize"
            key={"newChatPopup"}
                // showCloseButton
                visible={visible}
                onClose={() => setVisible(false)}
                closeOnMaskClick={true}
                closeOnSwipe={false}
                bodyStyle={{height: '90vh'}}
            >
                <div className=" ">
                    {/* <span
                    style={{float: 'left', color: 'var(--adm-color-primary)', position: 'absolute', cursor: 'pointer'}}
                     onClick={() => {
                                navigator.share({
                                    title: `Hey, I'm using NanChat for end-to-end encrypted messaging. Install NanChat and message me at ${activeAccount}`,
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
                <List>
                <List.Item>
                    Select one or more contacts
                    </List.Item>
                    </List>
                <div style={{  }}>
                        <InfiniteScrollAccounts 
                        visible={visible}
                            setVisible={setVisible}
                            searchText={searchText}
                            accounts={accounts}
                            alreadySelected={alreadySelected}
                            selectedAccounts={selectedAccounts}
                            setSelectedAccounts={setSelectedAccounts}
                            hideImportContacts={hideImportContacts}
                            onClick={(account) => {
                                onAccountSelect && onAccountSelect(account)
                                setVisible(false);
                            } }
                        />
                </div>
            </ResponsivePopup>
        </>
    )
}
export function SelectParticipant({visible, setVisible, participants, onAccountSelect, onClose}) {
    const { isMobile } = useWindowDimensions()
    const ResponsivePopup = isMobile ? Popup : CenterPopup;
    // const [visible, setVisible] = useState(false);
    const [searchText, setSearchText] = useState('')
    
    
    const participantsFiltered = participants?.filter(account => {
        if (searchText) {
            if (searchText?.length >= 64 && searchText?.includes('_')) {
                // we assume this is an address
                return account._id.split('_')[1].toLowerCase().includes(searchText?.split('_')[1].toLowerCase())
            }
            return account?.name.toLowerCase().includes(searchText.toLowerCase()) || account?.username?.toLowerCase().includes(searchText.toLowerCase())
        }
        return true
    }
    )
    return (
        <>
            <ResponsivePopup
            destroyOnClose
            bodyClassName="disable-keyboard-resize"
            key={"newChatPopup"}
                // showCloseButton
                visible={visible}
                onClose={() => {
                    setVisible(false)
                    onClose && onClose()
                }}
                closeOnMaskClick={true}
                closeOnSwipe={false}
                bodyStyle={{height: '90vh'}}
            >
                <div className=" ">
                            <div>

                    <div 
                style={isMobile ? {} : { minWidth: 500 }}
                className="text-xl  text-center p-2">
                     <div 
                 style={{float: 'left', marginTop: 4, marginLeft: 4, cursor: 'pointer'}}
                 onClick={() => {
                    setVisible(false)
                    onClose && onClose()
                 }}
                 className='text-base' color='default'>
                    Cancel
                </div>
                    Select a participant
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

                <CheckList>
                        {
                            participantsFiltered?.map(account => (
                                <CheckListItemAccount
                                account={account} key={account._id} onClick={() => {
                                    onAccountSelect && onAccountSelect(account._id)
                                    setVisible(false);
                                }} />
                            ))
                        }
                        
                        </CheckList>
            </ResponsivePopup>
        </>
    )
}

const InfiniteScrollAccounts = ({ accounts, alreadySelected, selectedAccounts, setSelectedAccounts, hideImportContacts, searchText, visible, setVisible }) => {
    const [popupImportContactsVisible, setPopupImportContactsVisible] = useState(false);
    const {contactsOnNanChat, contactsNotOnNanChat} = useContacts()
    const getKey = (pageIndex, previousPageData) => {
        if (!visible) return null
        // console.log({pageIndex})
        // console.log({previousPageData})
        if (previousPageData && !previousPageData.length) return null // reached the end
        return `/accounts?page=${pageIndex}${searchText ? `&search=${searchText}` : ''}`
    }
    const { data: pages, size, setSize, isLoading, isValidating} = useSWRInfinite<string[]>(
        getKey, fetcherMessages, {keepPreviousData: true});
    if (!pages) {
        return <DotLoading />
    }
    const all = pages ? pages.flat() : []
    // console.log({pages})
    // console.log({all})
    // console.log({size})
    
    const accountsToInvite = contactsNotOnNanChat
        .filter(contact => (searchText ? contact.name.toLowerCase().includes(searchText.toLowerCase()) : true))
    const contactsOnNanChatFiltered = contactsOnNanChat?.filter(contact => (searchText ? contact.name.toLowerCase().includes(searchText.toLowerCase()) : true))

    return (
           <InfiniteScroll
                        height={'calc(90vh - 57px - 44px - 8px - 50px)'}
                            dataLength={all?.length}
                            next={() => {
                                console.log('loading more')
                                setSize(size + 1)
                            }}
                            endMessage={
                                null
                              }
                            hasMore={true}
                            loader={(isValidating || isLoading) && <SkeletonAccountListItems />}
                        >
                           
                    <AccountListItems
                    alreadySelected={alreadySelected}
                        selectedAccounts={selectedAccounts}
                        setSelectedAccounts={setSelectedAccounts}

                        // title="Contacts on NanChat"
                        onClick={(account) => {
                            setVisible(false);
                        }}
                        accounts={contactsOnNanChatFiltered}
                        badgeColor={"gray"} />

{
    accountsToInvite.length > 0 &&
                    <AccountListItems
                    mode="invite"
                    // title="Invite to NanChat"
                    onClick={(account) => {
                        setVisible(false);
                    }}
                    accounts={accountsToInvite}
                    
                    badgeColor={"gray"} />
                }
                    {/* <div className="text-base  pl-4 m-2">
                        All users
                        </div> */}
                    {
                        !searchText && !hideImportContacts &&
                        <>
                   
                    <List>
                         <List.Item
                            clickable
                            prefix={<UserAddOutline fontSize={48} style={{padding: 8}}/>}
                            onClick={() => {
                                setPopupImportContactsVisible(true);
                            }}
                            >
                                Import Contacts
                            </List.Item>
                            </List>
                            <ResponsivePopup
                            visible={popupImportContactsVisible}
                            onClose={() => setPopupImportContactsVisible(false)}
                            closeOnMaskClick={true}
                            closeOnSwipe={false}
                            // bodyStyle={{height: '90vh'}}
                            >
                        <ImportContacts showAdd />
                            </ResponsivePopup>
                        </>
                    }
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
                            title={searchText ? "Search results" : "Verified Accounts"}
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
    )
}

export default NewChatPopup