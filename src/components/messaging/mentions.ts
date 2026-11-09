import { formatAddress } from "../../utils/format";

// @mentions in group messages. The content is end-to-end encrypted, so the mentioned accounts are sent next to it
// in plain (message.mentions), the server only uses them to notify. In the text a mention is "@" + the name.

export const MENTION_EVERYONE = 'everyone' // only the group admin can mention everyone

export type Mention = {
    account: string // participant address, or MENTION_EVERYONE
    label: string // text after the @
}

export type MentionRange = Mention & { start: number, end: number } // [start, end[ includes the @

// label of a participant: the name as shown to the other participants
export const mentionLabel = (participant: any) =>
    (participant?.name || formatAddress(participant?._id) || '').replace(/\s+/g, ' ').trim()

const isWordChar = (char: string | undefined) => !!char && /[\p{L}\p{N}_]/u.test(char)

// mentions found in the text. At each @ the longest matching label wins ("@John Doe" is John Doe, not John)
export function findMentions(text: string, candidates: Mention[]): MentionRange[] {
    if (!text || !candidates.length || !text.includes('@')) return []
    const sorted = candidates
        .filter(c => c.label)
        .sort((a, b) => b.label.length - a.label.length)
    const ranges: MentionRange[] = []
    let i = text.indexOf('@')
    while (i !== -1) {
        let next = i + 1
        if (!isWordChar(text[i - 1])) { // not an email address
            const lower = text.toLowerCase()
            const match = sorted.find(c => {
                const end = i + 1 + c.label.length
                return lower.startsWith(c.label.toLowerCase(), i + 1) && !isWordChar(text[end])
            })
            if (match) {
                const end = i + 1 + match.label.length
                ranges.push({ ...match, start: i, end })
                next = end
            }
        }
        i = text.indexOf('@', next)
    }
    return ranges
}

// candidates a sender can mention: the other participants, and everyone for the admin
export function mentionCandidates(participants: any[] | undefined, activeAccount: string, canMentionEveryone: boolean): Mention[] {
    const candidates: Mention[] = (participants || [])
        .filter(p => p?._id && p._id !== activeAccount)
        .map(p => ({ account: p._id, label: mentionLabel(p) }))
    if (canMentionEveryone) candidates.push({ account: MENTION_EVERYONE, label: MENTION_EVERYONE })
    return candidates
}

// accounts to send in message.mentions
export function extractMentions(text: string, candidates: Mention[]): string[] {
    return [...new Set(findMentions(text, candidates).map(m => m.account))]
}

export const isMentioningMe = (message: any, activeAccount: string) =>
    Array.isArray(message?.mentions) && message.fromAccount !== activeAccount &&
    (message.mentions.includes(activeAccount) || message.mentions.includes(MENTION_EVERYONE))

// the message mentions me and I want to know it (an @everyone is a normal message for those who turned it off)
export const isMentionNotified = (message: any, chat: any, activeAccount: string) =>
    isMentioningMe(message, activeAccount) &&
    (message.mentions.includes(activeAccount) || !chat?.mutedEveryone)

// the mention still notifies when the group is muted: two independent opt-outs, for the direct mentions and @everyone
export const isMentionNotifiedWhenMuted = (message: any, chat: any, activeAccount: string) =>
    isMentioningMe(message, activeAccount) && (
        (message.mentions.includes(activeAccount) && !chat?.mutedMentions) ||
        (message.mentions.includes(MENTION_EVERYONE) && !chat?.mutedEveryone)
    )
