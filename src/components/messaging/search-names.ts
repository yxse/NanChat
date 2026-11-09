// Name search for the search screen: contacts / people you chat with, and group chats whose name or one of whose
// members' names matches. Pure (no store): runs on the chats list and the local contacts, synchronously.

import { matchesTerms, normalizeForSearch, SearchTerm } from "../../services/message-store";

export type PersonHit = {
  address: string;
  name: string; // name shown: local contact name, else NanChat name
  username?: string;
  profilePicture?: string | false;
  chatId?: string; // existing private chat
};
export type GroupHit = {
  chat: any;
  nameMatches: boolean;
  members: { address: string; name: string }[]; // members whose name matches
};

type LocalContact = { name?: string; addresses?: { address?: string }[] };

// contacts may store an address with another network prefix (ban_, xdg_...): same key as NanChat accounts
const accountKey = (address?: string) => (address && address.includes("_") ? "nano_" + address.split("_")[1] : address);

const matches = (text: string | undefined, terms: SearchTerm[]) => {
  if (!text) return false;
  const normalized = normalizeForSearch(text);
  return matchesTerms(normalized, terms);
};
const startsWith = (text: string | undefined, terms: SearchTerm[]) =>
  !!text && normalizeForSearch(text).startsWith(terms[0].text);

export function searchNames(
  terms: SearchTerm[],
  { chats, contacts, activeAccount }: { chats: any[]; contacts: LocalContact[]; activeAccount: string },
): { people: PersonHit[]; groups: GroupHit[] } {
  terms = terms.map((term) => ({ ...term, text: term.text.replace(/^@/, "") })).filter((term) => term.text); // "@alice": username
  if (!terms.length) return { people: [], groups: [] };
  const me = accountKey(activeAccount);
  const contactName = new Map<string, string>();
  for (const contact of contacts || []) {
    const key = accountKey(contact.addresses?.[0]?.address);
    if (key && contact.name && !contactName.has(key)) contactName.set(key, contact.name);
  }
  const displayName = (participant: any) => contactName.get(accountKey(participant?._id)!) || participant?.name || "";

  // people: the other participant of each private chat (chats list order: most recent first), then the contacts
  // you have no chat with yet
  const people = new Map<string, PersonHit>();
  for (const chat of chats || []) {
    if (chat?.type === "group" || !Array.isArray(chat?.participants)) continue;
    const other = chat.participants.find((p: any) => accountKey(p?._id) !== me) || chat.participants[0];
    const key = accountKey(other?._id);
    if (!key || key === me || people.has(key)) continue;
    const name = displayName(other);
    if (matches(name, terms) || matches(other.username, terms)) {
      people.set(key, {
        address: other._id,
        name,
        username: other.username,
        profilePicture: other.profilePicture?.url || false,
        chatId: chat.id,
      });
    }
  }
  for (const contact of contacts || []) {
    const address = contact.addresses?.[0]?.address;
    const key = accountKey(address);
    if (!key || key === me || people.has(key) || !matches(contact.name, terms)) continue;
    people.set(key, { address: key, name: contact.name! });
  }

  const groups: GroupHit[] = [];
  for (const chat of chats || []) {
    if (chat?.type !== "group") continue;
    const nameMatches = matches(chat.name, terms);
    const members = (chat.participants || [])
      .filter((p: any) => accountKey(p?._id) !== me && (matches(displayName(p), terms) || matches(p?.username, terms)))
      .map((p: any) => ({ address: p._id, name: displayName(p) || p.username || p._id }));
    if (nameMatches || members.length) groups.push({ chat, nameMatches, members });
  }

  // names starting with the search first, otherwise keep the order (recent chats first)
  const peopleList = [...people.values()];
  const stableSort = <T>(items: T[], first: (item: T) => boolean) => [
    ...items.filter(first),
    ...items.filter((item) => !first(item)),
  ];
  return {
    people: stableSort(peopleList, (p) => startsWith(p.name, terms)),
    groups: stableSort(groups, (g) => g.nameMatches),
  };
}
