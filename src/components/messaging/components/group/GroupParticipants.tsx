import { Button, Card, List, Toast } from 'antd-mobile'
import React, { useState } from 'react'
import { AccountCard } from '../GroupInfo'
import { AddOutline, MinusOutline } from 'antd-mobile-icons'
import NewChatPopup from '../NewChatPopup'
import { updateSharedKeys } from '../../../../services/sharedkey'
import { addParticipants } from '../../fetcher'
import { useChats } from '../../hooks/use-chats'
import { useTranslation } from 'react-i18next'
import { useWallet } from '../../../Popup'
import { useNavigate } from 'react-router-dom'

function GroupParticipants({chatId}) {
        const [visibleAdd, setVisibleAdd] = useState(false);
        const [visibleRemove, setVisibleRemove] = useState(false);
        const {chat, mutateChats: mutate, isAdmin} = useChats(chatId);
        const { t } = useTranslation();
        const {activeAccountPk, activeAccount} = useWallet()
        const navigate = useNavigate()
        const [viewAll, setViewAll] = useState(false)
        const participants = viewAll ? chat?.participants : chat?.participants.slice(0, 18)
  return (
    <Card style={{maxWidth: 576, margin: 'auto'}}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' , alignItems: 'center'}}>
                        {
                            participants.map((participant, index) => {
                                return (
                                <AccountCard
                                key={index}
                                account={participant}
                                />
                            )})
                        }
                         {/* add & remove with border dash */}
                         <Button
                        style={{width: '58px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', '--border-style': 'dashed', '--border-width': '2px', borderRadius: 8}}
                        onClick={() => {
                            setVisibleAdd(true)
                        }}
                        >
                            <AddOutline fontSize={24} />
                        </Button>
                        {
                            isAdmin &&
                        
                        <Button
                        style={{width: '58px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', '--border-style': 'dashed', '--border-width': '2px', borderRadius: 8}}
                        onClick={() => {
                            setVisibleRemove(true)
                        }}
                        >
                            <MinusOutline fontSize={24} />
                        </Button>
                        }
                    </div>
                    <NewChatPopup 
                    alreadySelected={chat?.participants.map((participant) => participant._id)}
                    onAccountSelect={async (accounts) => {
                        let newParticipants = chat?.participants?.map((participant) => participant._id) || []
                        newParticipants = newParticipants.concat(accounts)
                        newParticipants = Array.from(new Set(newParticipants)) // unique
                        await updateSharedKeys(chat?.id, newParticipants, activeAccountPk) // we generate new shared keys for all the participants, eventually we could reuse the sared key when adding participant                    
                        let r = await addParticipants(chat?.id, accounts)
                        if (r.error) {
                            Toast.show({icon: 'fail', content: r.error})
                            return
                        }
                        mutate()
                        setVisibleAdd(false)
                    }}
                    visible={visibleAdd} setVisible={setVisibleAdd} title={t('addParticipant')} />
                    <NewChatPopup 
                    hideImportContacts
                    accounts={chat?.participants}
                    onAccountSelect={async (accounts) => {
                        let newParticipants = chat?.participants?.map((participant) => participant._id) || []
                        newParticipants = newParticipants.filter((participant) => !accounts.includes(participant))
                        await updateSharedKeys(chat?.id, newParticipants, activeAccountPk) 
                        let r = await removeParticipants(chat?.id, accounts)
                        if (r.error) {
                            Toast.show({icon: 'fail', content: r.error})
                            return
                        }
                        mutate()
                        setVisibleRemove(false)
    
                    }}
                    visible={visibleRemove} setVisible={setVisibleRemove} title={t('removeParticipant')} />
                    {
                       !viewAll && chat?.participants?.length > 18 && 
                <List mode="card" style={{marginTop: 16, marginLeft: "auto", marginRight: "auto", textAlign: "center", maxWidth: 250, }}>
                    <List.Item style={{color: "var(--adm-color-text-secondary)"}} onClick={() => {setViewAll(true)}}>
                        View All Members
                    </List.Item>
                </List>
                }
                    {
                       viewAll && chat?.participants?.length > 18 && 
                <List mode="card" style={{marginTop: 16, marginLeft: "auto", marginRight: "auto", textAlign: "center", maxWidth: 250, }}>
                    <List.Item style={{color: "var(--adm-color-text-secondary)"}} onClick={() => {setViewAll(false)}}>
                        View Less Members
                    </List.Item>
                </List>
                }
    </Card>
  )
}

export default GroupParticipants