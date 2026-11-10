import { Button, CenterPopup, CheckList, Popup, SearchBar } from 'antd-mobile'
import { CheckCircleFill, TeamOutline } from 'antd-mobile-icons'
import { MdOutlineCircle } from 'react-icons/md'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBreakpoint } from '../../../hooks/use-windows-dimensions'
import { CheckListItemAccount } from './NewChatPopup'
import { Mention, MENTION_EVERYONE, mentionLabel } from '../mentions'

// "Choose who to mention" screen, opened when typing @ in a group. The admin can also mention everyone.
function MentionPicker({ visible, onClose, onSelect, participants, activeAccount, canMentionEveryone }: {
    visible: boolean
    onClose: () => void
    onSelect: (mentions: Mention[]) => void
    participants: any[] | undefined
    activeAccount: string
    canMentionEveryone: boolean
}) {
    const { t } = useTranslation()
    const { isMobile } = useBreakpoint()
    const ResponsivePopup = isMobile ? Popup : CenterPopup
    const [searchText, setSearchText] = useState('')
    const [multiple, setMultiple] = useState(false)
    const [selected, setSelected] = useState<string[]>([])

    const others = useMemo(() => {
        const seen = new Set<string>()
        return (participants || []).filter(p => {
            if (!p?._id || p._id === activeAccount || seen.has(p._id)) return false
            seen.add(p._id)
            return true
        })
    }, [participants, activeAccount])

    const search = searchText.trim().toLowerCase()
    const filtered = others.filter(p => !search ||
        p.name?.toLowerCase().includes(search) ||
        p.username?.toLowerCase().includes(search) ||
        p._id.toLowerCase().includes(search))
    const everyoneLabel = t('mentionEveryone')
    const showEveryone = canMentionEveryone && others.length > 0 && (!search ||
        MENTION_EVERYONE.includes(search) || everyoneLabel.toLowerCase().includes(search))

    const reset = () => {
        setSearchText('')
        setMultiple(false)
        setSelected([])
    }
    const close = () => {
        reset()
        onClose()
    }
    const select = (accounts: string[]) => {
        const mentions = accounts.map(account => account === MENTION_EVERYONE
            ? { account, label: MENTION_EVERYONE }
            : { account, label: mentionLabel(others.find(p => p._id === account)) })
        reset()
        onSelect(mentions)
    }

    return (
        <ResponsivePopup
            destroyOnClose
            bodyClassName="disable-keyboard-resize"
            visible={visible}
            onClose={close}
            closeOnMaskClick
            closeOnSwipe={false}
            bodyStyle={{ height: '90vh', display: 'flex', flexDirection: 'column' }}
        >
            <div
                style={{ ...(isMobile ? {} : { minWidth: 500 }), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                className="text-xl p-2">
                <div className="text-base" style={{ cursor: 'pointer', marginLeft: 4 }} onClick={close}>
                    {t('cancel')}
                </div>
                <div style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t('chooseWhoToMention')}
                </div>
                {
                    multiple ?
                        <Button
                            size="small"
                            disabled={selected.length === 0}
                            color={selected.length === 0 ? 'default' : 'primary'}
                            onClick={() => select(selected)}>
                            {t('done')} {selected.length > 0 && `(${selected.length})`}
                        </Button>
                        :
                        <div className="text-base" style={{ cursor: 'pointer', marginRight: 4, color: 'var(--adm-color-primary)' }}
                            onClick={() => setMultiple(true)}>
                            {t('multiSelect')}
                        </div>
                }
            </div>
            <div className="searchBarContainer">
                <SearchBar
                    placeholder={t('search')}
                    value={searchText}
                    onChange={setSearchText}
                />
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
                <CheckList
                    multiple={multiple}
                    value={multiple ? selected : []}
                    onChange={(v) => multiple && setSelected(v as string[])}
                    extra={multiple ? (active => active ? <CheckCircleFill /> : <MdOutlineCircle color='var(--adm-color-text-secondary)' />) : () => null}
                >
                    {
                        showEveryone &&
                        <CheckList.Item
                            value={MENTION_EVERYONE}
                            onClick={() => !multiple && select([MENTION_EVERYONE])}
                            prefix={
                                <div style={{
                                    width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'var(--adm-color-primary)', color: 'var(--adm-color-white, #fff)'
                                }}>
                                    <TeamOutline fontSize={24} />
                                </div>
                            }
                            description={t('mentionEveryoneDescription', { count: others.length })}
                        >
                            {everyoneLabel}
                        </CheckList.Item>
                    }
                    {
                        filtered.map(participant => (
                            <CheckListItemAccount
                                key={participant._id}
                                account={participant}
                                disabled={false}
                                onClick={() => !multiple && select([participant._id])}
                            />
                        ))
                    }
                </CheckList>
                {
                    filtered.length === 0 && !showEveryone &&
                    <div className="text-center p-4" style={{ color: 'var(--adm-color-text-secondary)' }}>
                        {t('noResults')}
                    </div>
                }
            </div>
        </ResponsivePopup>
    )
}

export default MentionPicker
