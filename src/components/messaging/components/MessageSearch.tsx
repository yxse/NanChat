import { Button, ErrorBlock, List, NavBar, SearchBar, SearchBarRef, SpinLoading } from "antd-mobile";
import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloseOutline, SearchOutline } from "antd-mobile-icons";
import { matchPath, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { normalizeForSearch, searchMessages, SearchTerm, searchTerms, searchTermsKey, StoredMessage, termRanges } from "../../../services/message-store";
import { formatTelegramDate } from "../../../utils/telegram-date-formatter";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";
import { useBreakpoint } from "../../../hooks/use-windows-dimensions";
import { useWallet } from "../../useWallet";
import { useChats } from "../hooks/use-chats";
import { useMessageSyncState } from "../message-cache";
import { searchNames } from "../search-names";
import { defaultContacts } from "../utils";
import { AccountAvatar } from "../AccountAvatar";
import useLocalStorageState from "use-local-storage-state";
import { ChatAvatar } from "./ChatList";
import GroupName from "./group/GroupName";
import ProfileNameUntyped from "./profile/ProfileName";

const ProfileName = ProfileNameUntyped as any; // untyped memo component

// Search: contacts and group chats by name (group name or a member's name), then every message stored on this device (the whole history is downloaded in the background, see
// message-cache). Tapping a result opens the chat scrolled to the message.
// Large screens: the search takes the place of the chats list, next to the chat (/chat/:account?q=..., see Chat.tsx),
// and stays open while results are opened on the right.
// Search in one chat: ?in=<chatId> limits the messages to that chat (no contacts / groups). Opened from the group /
// contact info, the loupe in the chat header (large screens) or Ctrl+F, see useOpenChatSearch / useSearchShortcut.

// asks the open search to focus its input (search already open when Ctrl+F or the header loupe is used again)
const FOCUS_SEARCH_EVENT = "nanchat:focus-search";

const isSearchShortcut = (e: KeyboardEvent) =>
  (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.code === "KeyF" || e.key?.toLowerCase() === "f");

/** Opens the search in one chat: next to the chat on large screens, as its own page on phones. */
export function useOpenChatSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile, isTablet } = useBreakpoint();
  const twoPane = !isMobile || isTablet;
  // replace: opened from the info page / modal, back must not reopen it
  return useCallback((chatId: string, { replace = false } = {}) => {
    if (searchParams.has("q") && searchParams.get("in") === chatId) {
      window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      return;
    }
    const scope = encodeURIComponent(chatId);
    if (twoPane) navigate(`/chat/${scope}?q=&in=${scope}`, { replace });
    else navigate(`/chat/search?in=${scope}`);
  }, [searchParams, twoPane, navigate]);
}

/**
 * Ctrl+F (Cmd+F) in the chats: searches the open chat (`chatId`), else all chats. When the search is already on
 * screen, MessageSearch handles the shortcut itself (focuses its input).
 */
export function useSearchShortcut(chatId: string | undefined) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openChatSearch = useOpenChatSearch();
  const { isMobile, isTablet } = useBreakpoint();
  const twoPane = !isMobile || isTablet;
  const searchOpen = searchParams.has("q");
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e) || searchOpen) return;
      // the chat stays mounted behind modals (info, settings): only on the chat pages themselves.
      // window.location: inside the main routes, useLocation returns the page behind the modal
      const path = window.location.pathname;
      if (path === "/chat/search" || (!matchPath("/chat/:account", path) && !matchPath("/chat", path))) return;
      e.preventDefault();
      if (chatId) openChatSearch(chatId);
      else navigate(twoPane && matchPath("/chat/:account", path) ? `${path}?q=` : "/chat/search");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatId, searchOpen, openChatSearch, twoPane, navigate]);
}

/** "Search messages" item of the contact / group info. */
export function SearchInChatButton({ chatId }: { chatId: string | undefined }) {
  const { t } = useTranslation();
  const openChatSearch = useOpenChatSearch();
  if (!chatId) return null; // no conversation yet
  return (
    <List mode="card">
      <List.Item prefix={<SearchOutline />} onClick={() => openChatSearch(chatId, { replace: true })}>
        {t("searchMessages")}
      </List.Item>
    </List>
  );
}

/** The other person of a private chat (yourself in the chat with yourself). */
const otherParticipant = (chat: any, activeAccount: string) =>
  chat.participants[0]?._id === chat.participants[1]?._id
    ? chat.participants[0]
    : chat.participants.find((p: any) => p._id !== activeAccount);

const PAGE_SIZE = 50;
const SNIPPET_LENGTH = 140;
const SNIPPET_CONTEXT = 40; // characters kept before the first match in long messages

/** Ranges [start, end) of `text` matching the (normalized) terms, accent and case insensitive. */
function matchRanges(text: string, terms: SearchTerm[]): [number, number][] {
  let normalized = "";
  const origin: number[] = []; // normalized index -> index in text
  for (let i = 0; i < text.length; ) {
    const char = String.fromCodePoint(text.codePointAt(i)!);
    const n = normalizeForSearch(char);
    for (let k = 0; k < n.length; k++) origin.push(i);
    normalized += n;
    i += char.length;
  }
  origin.push(text.length);
  const ranges: [number, number][] = [];
  for (const term of terms) {
    for (const [start, end] of termRanges(normalized, term)) ranges.push([origin[start], origin[end]]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

function Highlighted({ text, terms }: { text: string; terms: SearchTerm[] }) {
  // long message: start a bit before the first match
  let shown = text.replace(/\s+/g, " ");
  const first = matchRanges(shown, terms)[0];
  let prefix = "";
  if (shown.length > SNIPPET_LENGTH && first && first[0] > SNIPPET_CONTEXT) {
    shown = shown.slice(first[0] - SNIPPET_CONTEXT);
    prefix = "…";
  }
  const nodes: ReactNode[] = [prefix];
  let position = 0;
  for (const [start, end] of matchRanges(shown, terms)) {
    nodes.push(shown.slice(position, start));
    nodes.push(
      <mark key={start} style={{ background: "transparent", color: "var(--adm-color-primary)", fontWeight: 600 }}>
        {shown.slice(start, end)}
      </mark>,
    );
    position = end;
  }
  nodes.push(shown.slice(position));
  return <>{nodes}</>;
}

const messageText = (m: StoredMessage): string => m.redPacket?.decrypted ?? m.decrypted ?? "";

// Last search, to show the page as it was when coming back from a result: going back remounts this page, and on iOS
// the back-swipe snapshot of the old results was replaced by an empty page, then the search ran again.
// The query is also kept in the url (?q=) so it survives a reload.
let lastSearch: { query: string; scope: string | null; results:StoredMessage[]; hasMore: boolean; scrollTop: number } | null = null;

const PREVIEW_COUNT = 3; // people / groups shown before "Show more"

function Section<T>({ title, items, render }: { title: string; items: T[]; render: (item: T) => ReactNode }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const shown = expanded ? items : items.slice(0, PREVIEW_COUNT);
  return (
    <List mode="card" header={title}>
      {shown.map(render)}
      {items.length > PREVIEW_COUNT && (
        <List.Item arrowIcon={false} onClick={() => setExpanded(!expanded)}>
          <span style={{ color: "var(--adm-color-primary)", fontSize: 14 }}>
            {expanded ? t("showLess") : t("showMore", { count: items.length - PREVIEW_COUNT })}
          </span>
        </List.Item>
      )}
    </List>
  );
}

const clamp2 = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  // long links / addresses have no break opportunity: without this they widen the page (horizontal scroll).
  // "anywhere" (unlike break-word) also lowers the min-content width the flex layout sizes the row with
  overflowWrap: "anywhere",
} as const;

export default function MessageSearch() {
  useHideNavbarOnMobile(true);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeAccount } = useWallet();
  const { chats } = useChats();
  const [contacts] = useLocalStorageState<any[]>("contacts", { defaultValue: defaultContacts });
  const sync = useMessageSyncState();
  const { account } = useParams();
  const { isMobile, isTablet } = useBreakpoint();
  const twoPane = !isMobile || isTablet; // same condition as the chats list next to the chat in Chat.tsx
  const searchBarRef = useRef<SearchBarRef>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const scope = searchParams.get("in"); // chat id: search in this chat only
  const restored = lastSearch?.query === initialQuery && lastSearch.scope === scope ? lastSearch : null;
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<StoredMessage[]>(restored?.results ?? []);
  const [hasMore, setHasMore] = useState(restored?.hasMore ?? false);
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const skipFirstRun = useRef(!!restored && initialQuery !== "");
  const searchId = useRef(0);
  const terms = useMemo(() => searchTerms(query), [query]);
  const termsKey = searchTermsKey(terms);

  const chatsById = useMemo(() => new Map((chats || []).map((chat: any) => [chat.id, chat])), [chats]);
  // names: synchronous, from the chats list and the local contacts
  const names = useMemo(
    () => (scope ? { people: [], groups: [] } : searchNames(terms, { chats: chats || [], contacts, activeAccount })),
    [termsKey, scope, chats, contacts, activeAccount],
  );
  const scopeChat: any = scope ? chatsById.get(scope) : null;

  const run = async (offset: number) => {
    const id = ++searchId.current;
    if (!terms.length) {
      setResults([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const page = await searchMessages(query, { chatId: scope ?? undefined, limit: PAGE_SIZE, offset });
      if (id !== searchId.current) return; // a newer search started
      setResults((current) => (offset ? [...current, ...page] : page));
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      console.error("search failed", err);
    } finally {
      if (id === searchId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (skipFirstRun.current) { // back from a result: the results are already shown
      skipFirstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      run(0);
      // keep the query in the url (replace: typing must not add history entries). Other params are kept (the
      // result opened next to the search, ?msg=&h=). Large screens: an empty q still means "search open"
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        if (query || twoPane) next.set("q", query);
        else next.delete("q");
        return next;
      }, { replace: true });
    }, 200); // debounce typing
    return () => clearTimeout(timer);
  }, [termsKey, scope]);

  // remember the page for coming back from a result
  useEffect(() => {
    const same = lastSearch?.query === query && lastSearch.scope === scope;
    lastSearch = { query, scope, results, hasMore, scrollTop: same ? lastSearch!.scrollTop : 0 };
  }, [query, scope, results, hasMore]);
  useLayoutEffect(() => {
    if (restored && scrollerRef.current) scrollerRef.current.scrollTop = restored.scrollTop;
  }, []);
  // focus the input, except when coming back to the results of a search on mobile (no keyboard over them).
  // Not only autoFocus: it is missed when the page mounts during a route transition
  const focusOnMount = !restored || !initialQuery || twoPane;
  useEffect(() => {
    if (!focusOnMount) return;
    const frame = requestAnimationFrame(() => searchBarRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  // Ctrl+F / header loupe while the search is open: back to the input, text selected to type a new search
  useEffect(() => {
    const focus = () => {
      searchBarRef.current?.focus();
      searchBarRef.current?.nativeElement?.select();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e)) return;
      e.preventDefault();
      focus();
    };
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // large screens: a message opens next to the search, which stays open (q kept in the url) with the result selected;
  // a contact or group closes the search
  const openChat = (chatId: string, params: Record<string, string> = {}, keepSearch = false) => {
    const kept: Record<string, string> = twoPane && keepSearch ? { q: query, ...(scope ? { in: scope } : {}) } : {};
    const search = new URLSearchParams({ ...kept, ...params }).toString();
    navigate(`/chat/${encodeURIComponent(chatId)}${search ? "?" + search : ""}`);
  };
  const selectedId = twoPane ? searchParams.get("msg") : null; // message opened next to the search
  const close = () => {
    if (twoPane) navigate(account ? `/chat/${encodeURIComponent(account)}` : "/chat");
    else navigate(-1);
  };
  const searchAllChats = () =>
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete("in");
      return next;
    }, { replace: true });
  const onScroll = () => {
    if (lastSearch && scrollerRef.current) lastSearch.scrollTop = scrollerRef.current.scrollTop;
  };

  // only chats still in the list (not left / blocked)
  const visible = results.filter((m) => chatsById.has(m.chatId));
  const nothingFound =
    terms.length > 0 && !loading && visible.length === 0 && !names.people.length && !names.groups.length;

  return (
    // contain inline-size: the page width comes from the layout only, never from its content (a long link, address or
    // name would otherwise widen the main column of the app and make it scroll horizontally)
    <div className="message-search" onKeyDown={(e) => { if (e.key === "Escape") close(); }} style={{ height: "100%", width: "100%", minWidth: 0, display: "flex", flexDirection: "column", overflowX: "hidden", contain: "inline-size" }}>
      <NavBar className="app-navbar" onBack={close} backIcon={twoPane ? <CloseOutline /> : undefined}>
        {scope ? t("searchMessages") : t("search")}
      </NavBar>
      <div style={{ padding: "8px 12px" }}>
        <SearchBar
          ref={searchBarRef}
          autoFocus={focusOnMount}
          placeholder={scope ? t("searchMessages") : t("searchAllPlaceholder")}
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
        />
        {scope && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, color: "var(--adm-color-weak)", minWidth: 0 }}>
            {t("searchIn")}
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0, padding: "2px 6px 2px 10px",
                borderRadius: 12, background: "var(--adm-color-background)", color: "var(--adm-color-text)",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {scopeChat == null ? "…"
                  : scopeChat.type === "group" ? <GroupName chat={scopeChat} />
                  : <ProfileName address={otherParticipant(scopeChat, activeAccount)?._id} includeVerified={false} />}
              </span>
              <CloseOutline
                role="button"
                aria-label={t("searchAllChats")}
                onClick={searchAllChats}
                style={{ cursor: "pointer", flexShrink: 0, padding: 2 }}
              />
            </span>
          </div>
        )}
      </div>
      <div ref={scrollerRef} onScroll={onScroll} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {nothingFound && <ErrorBlock status="empty" title={t("noResultsFound")} description="" />}

        {/* key: collapse the sections again on a new search */}
        <Section
          key={"people-" + termsKey}
          title={t("contacts")}
          items={names.people}
          render={(person) => (
            <List.Item
              key={person.address}
              prefix={<AccountAvatar account={person.address} src={(person.profilePicture || false) as any} />}
              description={person.username ? <Highlighted text={"@" + person.username} terms={terms} /> : undefined}
              onClick={() => openChat(person.chatId ?? person.address)}
            >
              <Highlighted text={person.name || person.username || person.address} terms={terms} />
            </List.Item>
          )}
        />

        <Section
          key={"groups-" + termsKey}
          title={t("groupChats")}
          items={names.groups}
          render={({ chat, nameMatches, members }) => (
            <List.Item
              key={chat.id}
              prefix={<ChatAvatar chat={chat} />}
              description={
                members.length > 0 ? (
                  <div style={clamp2}>
                    {t("searchIncludes")}{" "}
                    {members.map((member, i) => (
                      <span key={member.address}>
                        {i > 0 && ", "}
                        <Highlighted text={member.name} terms={terms} />
                      </span>
                    ))}
                  </div>
                ) : undefined
              }
              onClick={() => openChat(chat.id)}
            >
              {nameMatches ? <Highlighted text={chat.name} terms={terms} /> : <GroupName chat={chat} />}
            </List.Item>
          )}
        />

        {visible.length > 0 && (
          <List mode="card" header={t("messages")}>
            {visible.map((message) => {
              const chat: any = chatsById.get(message.chatId);
              const isGroup = chat.type === "group";
              const open = () => openChat(message.chatId, { msg: message._id, h: String(message.height) }, true);
              if (scope) { // one chat: the sender instead of the chat
                return (
                  <List.Item
                    key={message.chatId + "-" + message.height}
                    className={message._id === selectedId ? "search-result-selected" : undefined}
                    prefix={<AccountAvatar account={message.fromAccount} />}
                    extra={<span style={{ fontSize: 12 }}>{formatTelegramDate(message.timestamp)}</span>}
                    description={<div style={clamp2}><Highlighted text={messageText(message)} terms={terms} /></div>}
                    onClick={open}
                  >
                    <ProfileName address={message.fromAccount} />
                  </List.Item>
                );
              }
              const other = otherParticipant(chat, activeAccount);
              return (
                <List.Item
                  key={message.chatId + "-" + message.height}
                  className={message._id === selectedId ? "search-result-selected" : undefined}
                  prefix={<ChatAvatar chat={chat} />}
                  extra={<span style={{ fontSize: 12 }}>{formatTelegramDate(message.timestamp)}</span>}
                  description={
                    <div style={clamp2}>
                      {isGroup && (
                        <>
                          <ProfileName address={message.fromAccount} includeVerified={false} />:{" "}
                        </>
                      )}
                      <Highlighted text={messageText(message)} terms={terms} />
                    </div>
                  }
                  onClick={open}
                >
                  {isGroup ? <GroupName chat={chat} /> : <ProfileName address={other?._id} />}
                </List.Item>
              );
            })}
          </List>
        )}
        {terms.length > 0 && sync.active && sync.phase === "history" && (
          <div style={{ padding: "4px 16px 8px", fontSize: 12, color: "var(--adm-color-weak)" }}>
            {t("searchHistoryIncomplete", { percent: sync.percent })}
          </div>
        )}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <SpinLoading />
          </div>
        )}
        {hasMore && !loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
            <Button size="small" onClick={() => run(results.length)}>
              {t("loadMore")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
