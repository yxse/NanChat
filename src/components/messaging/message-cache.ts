// Message loading on top of the persistent message store (services/message-store.ts).
//
//  - Pages of older messages come from the store when it holds them completely, else from the server.
//  - The newest page comes from the store without any request when the store is known to be up to date with the
//    chats list (same height, nothing unread), so opening a chat is instant and works offline.
//  - On launch / resume (each successful chats fetch), new messages of every chat are downloaded in the
//    background with the batch /sync-messages endpoint, decrypted and stored.
//
// Heights are increasing per chat but not always consecutive (a join request bumps the chat height twice, group
// members don't see messages sent before they joined). Each stored message therefore keeps `_prevHeight`: the
// height of the message right before it, learned when both came in the same server response (-1 when the server
// told us nothing comes before). A cached page is used only when every message in it is linked to the next one.

import { useSyncExternalStore } from "react";
import { getChatToken } from "../../utils/storage";
import { CapgoCapacitorDataStorageSqlite } from "@capgo/capacitor-data-storage-sqlite";
import { initSqlStore } from "../../services/database.service";
import {
  getHeightLinks,
  getMaxHeights,
  getMessageCounts,
  getMessagesRange,
  getMeta,
  importMessages,
  messageStoreKind,
  putMessages,
  setMeta,
  setSearchableText,
  StoredMessage,
} from "../../services/message-store";
import { decryptChatMessage } from "./hooks/use-message-decryption";
import { cacheKeyPrefix, isSpecialMessage } from "./utils";

const BACKEND = import.meta.env.VITE_PUBLIC_BACKEND;

// searchable text: what the user wrote (text messages, red packet greetings); not stickers, files, system messages...
setSearchableText((message) => {
  if (message.redPacket) return message.redPacket.decrypted;
  if (isSpecialMessage(message as any)) return null;
  return typeof message.decrypted === "string" ? message.decrypted : null;
});

// ---------------------------------------------------------------------------------------------------------------
// Chats list snapshot, kept up to date by useChats, used to know whether the store has the newest messages.

type KnownChat = { height?: number; unreadCount?: number };
let knownChatsSource: unknown = null;
let knownChats = new Map<string, KnownChat>();

export function rememberChats(chats: any[] | undefined) {
  if (chats === knownChatsSource || !Array.isArray(chats)) return;
  knownChatsSource = chats;
  const next = new Map<string, KnownChat>();
  for (const chat of chats) {
    if (chat?.id) next.set(chat.id, { height: chat.height, unreadCount: chat.unreadCount });
  }
  knownChats = next;
}

// ---------------------------------------------------------------------------------------------------------------
// "messages-synced" notifications, so an open chat refreshes when the background sync stored new messages.

const syncedListeners = new Set<(chatId: string) => void>();
export function onMessagesSynced(listener: (chatId: string) => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}
function notifySynced(chatId: string) {
  for (const listener of syncedListeners) {
    try {
      listener(chatId);
    } catch (err) {
      console.error(err);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Import of the previous cache (one key/value entry per message in capacitor-data-storage-sqlite).
// Imported rows never overwrite rows already in the new store. The old entries are deleted afterwards.

const legacyStore = CapgoCapacitorDataStorageSqlite;
let legacyAllPromise: Promise<void> | null = null;
const legacyChatPromises = new Map<string, Promise<void>>();

function parseLegacy(values: string[], chatId?: string): StoredMessage[] {
  const out: StoredMessage[] = [];
  for (const value of values) {
    try {
      const message = JSON.parse(value);
      if (message?.chatId && Number.isInteger(message.height) && (!chatId || message.chatId === chatId)) {
        out.push(message);
      }
    } catch {
      // ignore
    }
  }
  return out;
}

function removeLegacyKeys(keys: string[]) {
  // background, one by one: never blocks loading
  (async () => {
    for (const key of keys) {
      try {
        await legacyStore.remove({ key });
      } catch {
        // ignore
      }
    }
  })();
}

// web / Tauri: the old store is localforage, which can't filter by key: read it all, once
function importLegacyAll(): Promise<void> {
  if (!legacyAllPromise) {
    legacyAllPromise = (async () => {
      if (await getMeta("legacy-imported")) return;
      await initSqlStore();
      const { keysvalues } = await legacyStore.keysvalues();
      const entries = keysvalues.filter((e) => e.key.startsWith("chat_") && e.key.includes("_msg_"));
      await importMessages(parseLegacy(entries.map((e) => e.value)));
      await setMeta("legacy-imported", "1");
      console.log("message store: imported", entries.length, "legacy messages");
      removeLegacyKeys(entries.map((e) => e.key));
    })().catch((err) => {
      console.error("message store: legacy import failed", err);
      legacyAllPromise = null;
    });
  }
  return legacyAllPromise;
}

// iOS / Android: the old store is sqlite, a key prefix filter is cheap enough: import each chat when first needed
function importLegacyChat(chatId: string): Promise<void> {
  let promise = legacyChatPromises.get(chatId);
  if (!promise) {
    promise = (async () => {
      const metaKey = "legacy-imported:" + chatId;
      if (await getMeta(metaKey)) return;
      await initSqlStore();
      const { values } = await legacyStore.filtervalues({ filter: cacheKeyPrefix(chatId) + "%" });
      const messages = parseLegacy(values, chatId);
      await importMessages(messages);
      await setMeta(metaKey, "1");
      if (messages.length) removeLegacyKeys(messages.map((m) => cacheKeyPrefix(chatId) + m.height));
    })().catch((err) => {
      console.error("message store: legacy import failed", chatId, err);
      legacyChatPromises.delete(chatId);
    });
    legacyChatPromises.set(chatId, promise);
  }
  return promise;
}

function importLegacy(chatIds: string[]): Promise<unknown> {
  if (messageStoreKind === "capacitor-sqlite") return Promise.all(chatIds.map(importLegacyChat));
  return importLegacyAll();
}

// ---------------------------------------------------------------------------------------------------------------
// Decryption + storage

async function decryptForStore(message: any, account: string, accountPk: string): Promise<StoredMessage> {
  const stored = { ...message };
  let result: any;
  try {
    result = await decryptChatMessage(message, account, accountPk);
  } catch (err) {
    console.error("decrypt failed", message?._id, err);
  }
  if (!result || result.decrypted == null) {
    // keep the encrypted content: the message component decrypts it when rendered, and the next fetch retries
    return stored;
  }
  stored.decrypted = result.decrypted;
  if (!isSpecialMessage(message)) delete stored.content; // no need to keep the encrypted content
  if (stored.replyMessage) stored.replyMessage = { ...stored.replyMessage, decrypted: result.decryptedReply };
  if (stored.redPacket) stored.redPacket = { ...stored.redPacket, decrypted: result.decryptedRedPacket };
  return stored;
}

const needsDecryption = (m: StoredMessage) => m.decrypted == null && !isSpecialMessage(m as any);

/**
 * Store messages received from the server for one chat, newest first.
 * `olderHeight`: height of the message right before the oldest one (-1: nothing before), when known.
 * Returns the stored (decrypted) messages, newest first.
 */
async function storeServerMessages(
  chatId: string,
  serverMessages: any[],
  olderHeight: number | undefined,
  account: string,
  accountPk: string,
): Promise<StoredMessage[]> {
  const messages = serverMessages.filter((m) => m && Number.isInteger(m.height)).sort((a, b) => b.height - a.height);
  if (!messages.length) return [];
  const newest = messages[0].height;
  const oldest = messages[messages.length - 1].height;
  const existing = new Map<number, StoredMessage>();
  for (const row of await getMessagesRange(chatId, newest, newest - oldest + 1)) existing.set(row.height, row);

  const writes: StoredMessage[] = [];
  const result = await Promise.all(
    messages.map(async (message, i) => {
      const cached = existing.get(message.height);
      const sameMessage = cached && cached._id === message._id;
      const prevHeight =
        i + 1 < messages.length
          ? messages[i + 1].height
          : olderHeight ?? (sameMessage ? cached._prevHeight : undefined);
      if (sameMessage && !needsDecryption(cached)) {
        // keep the decrypted copy; refresh what can change server side without a new message
        const joinRequestChanged =
          message.joinRequest && JSON.stringify(message.joinRequest) !== JSON.stringify(cached.joinRequest);
        if (prevHeight === cached._prevHeight && !joinRequestChanged) return cached;
        const updated = {
          ...cached,
          _prevHeight: prevHeight,
          ...(joinRequestChanged ? { joinRequest: message.joinRequest } : {}),
        };
        writes.push(updated);
        return updated;
      }
      const stored = await decryptForStore(message, account, accountPk);
      stored._prevHeight = prevHeight;
      writes.push(stored);
      return stored;
    }),
  );
  if (writes.length) await putMessages(writes);
  return result;
}

/** Decrypt and store (insert or replace) one message, e.g. after a server side update. */
export const saveMessageCache = async (chatId: string, message: any, account: string, accountPk: string) => {
  const stored = await decryptForStore(message, account, accountPk);
  await writeStoredMessage(chatId, stored);
  return stored;
};

async function writeStoredMessage(chatId: string, stored: StoredMessage) {
  if (!Number.isInteger(stored?.height)) return;
  const [current] = await getMessagesRange(chatId, stored.height, 1);
  if (current?.height === stored.height && current._prevHeight !== undefined)
    stored = { ...stored, _prevHeight: current._prevHeight };
  await putMessages([{ ...stored, chatId }]);
}

/**
 * Store a message received live (socket), so the store keeps up without refetching.
 * Resolves with the decrypted message as soon as it is decrypted (the write goes on in the background), so it can be
 * shown with its content right away, or null.
 */
export async function storeIncomingMessage(message: any, account: string, accountPk: string): Promise<StoredMessage | null> {
  if (!message?.chatId || !Number.isInteger(message.height) || message.isLocal) return null;
  try {
    const stored = await decryptForStore(message, account, accountPk);
    writeStoredMessage(message.chatId, stored)
      .catch(err => console.error("message store: cannot store incoming message", err));
    return stored;
  } catch (err) {
    console.error("message store: cannot store incoming message", err);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Reading pages

const linked = (newer: StoredMessage, older: StoredMessage) =>
  older.height === newer.height - 1 || newer._prevHeight === older.height;
// the first message of a chat has height 1 (chat height starts at 0, incremented for each message)
const isHistoryStart = (m: StoredMessage | undefined) => !!m && (m._prevHeight === -1 || m.height <= 1);

/** The `limit` messages at or below `cursor`, newest first, when the store has them all; else null. */
async function readCachedPage(chatId: string, cursor: number, limit: number): Promise<StoredMessage[] | null> {
  const rows = await getMessagesRange(chatId, cursor + 1, limit + 1);
  let previous: StoredMessage | undefined;
  let i = 0;
  if (rows[0]?.height === cursor + 1) {
    previous = rows[0]; // anchor: the message right above the page tells which one comes next
    i = 1;
  }
  const page: StoredMessage[] = [];
  for (; i < rows.length && page.length < limit; i++) {
    const row = rows[i];
    if (previous ? !linked(previous, row) : row.height !== cursor) return null;
    page.push(row);
    previous = row;
  }
  if (page.length === limit) return page;
  return isHistoryStart(previous) ? page : null; // shorter page: only complete when the history starts here
}

/** Newest messages whatever their continuity (offline fallback). */
async function readNewest(chatId: string, limit: number) {
  return getMessagesRange(chatId, Infinity, limit);
}

class HttpError extends Error {
  constructor(public status: number) {
    super("HTTP " + status);
  }
}

// returns the JSON body, including { error } bodies (handled by callers / useChat); retries once on token errors
async function backendGet(path: string, accountPk: string) {
  let token = await getChatToken(accountPk);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(BACKEND + path, {
      headers: { "Content-Type": "application/json", token: token as string },
    });
    const body = await res.json().catch(() => null);
    const tokenError = body?.error === "Invalid token." || body?.error === "Token expired.";
    if (tokenError && attempt === 0) {
      token = await getChatToken(accountPk, true);
      if (token == null) throw new Error("Chat token not available");
      continue;
    }
    if (!res.ok && !body?.error) throw new HttpError(res.status);
    return body;
  }
}

const isNetworkFailure = (err: any) =>
  !(err instanceof HttpError) || err.status >= 500 || err.status === 429 || err.status === 0;

// Chats known to have messages newer than the store, whatever the chats list says (a push notification arrived: on a
// launch / resume from it the chats list in memory is the one saved before, it does not know the new message yet, so
// the store would look up to date and the chat would open without it until the next sync). Their next newest page
// is fetched from the server.
const expectedNewMessages = new Set<string>();
export function expectNewMessages(chatId: string | undefined | null) {
  if (chatId) expectedNewMessages.add(chatId);
}

/**
 * Newest page from the store, when it is up to date with the chats list (has the chat's newest message); else null.
 * The store can be ahead of the chats list (synced / socket message before the list refreshed): use its newest.
 */
export async function readNewestCachedPage(chatId: string, limit: number): Promise<StoredMessage[] | null> {
  if (expectedNewMessages.has(chatId)) return null;
  const known = knownChats.get(chatId);
  if (!known || !Number.isInteger(known.height)) return null;
  const top = (await getMaxHeights([chatId])).get(chatId);
  if (top == null) return null;
  if (top < (known.height as number) && (await getSyncedHeight(chatId)) < (known.height as number)) return null;
  const page = await readCachedPage(chatId, top, limit);
  return page && page.length ? page : null;
}

/**
 * Reset the unread count of a chat server side (a /messages request clears it), with a minimal request.
 * Called wherever the count is cleared locally: when the chat is opened from the list, when unread shows up in the
 * open chat, and when its newest page is served from the store (no request then). Clearing it only locally made it
 * come back with the next chats fetch.
 */
const markingRead = new Map<string, number>();
export function markChatRead(chatId: string, accountPk: string) {
  if (!chatId || !accountPk) return;
  const now = Date.now();
  // the same reset asked from several places at once (list click, page load, open chat effect)
  if (now - (markingRead.get(chatId) ?? 0) < 1500) return;
  markingRead.set(chatId, now);
  backendGet(`/messages?chatId=${encodeURIComponent(chatId)}&limit=1&cursor=-1`, accountPk).catch((err) => {
    markingRead.delete(chatId); // retried on the next occasion
    console.warn("cannot reset unread count", chatId, err);
  });
}

/**
 * SWR fetcher of a /messages page (see getKey in useChat).
 * cursor -1 is the newest page, else the page of messages with height <= cursor.
 */
export async function fetcherMessagesCache(url: string, account: string, accountPk: string) {
  const params = new URLSearchParams(url.split("?")[1]);
  const chatId = params.get("chatId") as string;
  const cursor = parseInt(params.get("cursor") ?? "-1");
  const limit = parseInt(params.get("limit") ?? "20");
  await importLegacy([chatId]);

  if (cursor >= 0) {
    const cached = await readCachedPage(chatId, cursor, limit);
    if (cached) return cached;
  } else if (!syncUnsupported) {
    // (only when the background sync works: it is what refreshes an open chat when the chats list moves on)
    const cached = await readNewestCachedPage(chatId, limit);
    if (cached) {
      const known = knownChats.get(chatId);
      if ((known?.unreadCount ?? 0) > 0 && params.get("clearCount") !== "false") markChatRead(chatId, accountPk);
      return cached;
    }
  }

  let body: any;
  try {
    body = await backendGet(url, accountPk);
  } catch (err) {
    if (cursor < 0 && isNetworkFailure(err)) {
      const offline = await readNewest(chatId, limit);
      if (offline.length) return offline;
    }
    throw err instanceof HttpError ? err.status : err;
  }
  if (!Array.isArray(body)) return body; // { error } handled by useChat (e.g. "Chat not found")
  // fewer messages than asked: the history of this chat (for this account) starts with the oldest one
  const stored = await storeServerMessages(chatId, body, body.length < limit ? -1 : undefined, account, accountPk);
  if (cursor < 0) expectedNewMessages.delete(chatId); // the store has the server's newest messages now
  if (cursor >= 0) {
    // the page was asked right below the message above the cursor (see getKey): the newest message returned is the
    // one right before it (none: the history starts with it). Links the pages across height gaps.
    const [above] = await getMessagesRange(chatId, cursor + 1, 1);
    const prevHeight = stored.length ? stored[0].height : -1;
    if (above?.height === cursor + 1 && above._prevHeight !== prevHeight) {
      await putMessages([{ ...above, _prevHeight: prevHeight }]);
    }
  }
  return stored;
}

// ---------------------------------------------------------------------------------------------------------------
// Background sync, after each chats fetch:
//  1. new messages: every chat gets all its messages newer than the cache (never cached chats: the newest ones),
//     so chats open instantly;
//  2. full history: then every gap in each chat's cached history is filled, down to its first message, so the whole
//     history is available offline and searchable. Resumable: progress is the store itself, chats whose history is
//     complete are flagged. New messages (a newer chats fetch) take priority over the history download.

const SYNC_CHATS_PER_REQUEST = 400; // backend maximum
const SYNC_LIMIT_NEW = 100; // messages per chat and request
const SYNC_LIMIT_HISTORY = 20000; // backend maximum (an older backend may cap lower: the limit it applied is returned)
const SYNC_DELAY = 1000; // let the chats list render first
// requests are paced to leave room for the rest of the app in the backend rate limit (150 requests / minute / IP)
const SYNC_FAST_REQUESTS = 10;
const SYNC_FAST_INTERVAL = 150;
const SYNC_SLOW_INTERVAL = 1000;
const SYNC_RATE_LIMIT_RETRIES = [5000, 15000, 30000];
const HISTORY_ACTIVE_CHATS = SYNC_CHATS_PER_REQUEST; // chats whose gaps are being filled at the same time
const HISTORY_COMPLETE_META = "history-complete:";
// Chat height the store is known to be complete up to. Above the newest stored message when the newest messages of
// the chat no longer exist on the server (deleted with their sender's account): the chat height still counts them,
// and without this the chat would look out of date forever (re-requested on every sync, newest page never served
// from the store).
const SYNCED_HEIGHT_META = "synced-height:";
async function getSyncedHeight(chatId: string): Promise<number> {
  const value = Number(await getMeta(SYNCED_HEIGHT_META + chatId));
  return Number.isInteger(value) ? value : -1;
}

type SyncTarget = {
  chatId: string;
  after: number; // messages with a height above this one (-1: from the start of the history)...
  before?: number; // ...and at or below this one
  newer?: StoredMessage; // stored message right above the range: linked to the newest message of the range
  untilComplete: boolean; // request again until the whole range is downloaded
};

type SyncJob = { chats: any[]; account: string; accountPk: string };
type SyncRun = SyncJob & { requests: number };

let syncUnsupported = false;
let syncRunning: Promise<void> | null = null;
let syncQueued: SyncJob | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

// --- sync state, for the indicator of the chats list ---
export type MessageSyncState = {
  active: boolean;
  phase: "new" | "history";
  chatsDone: number;
  chatsTotal: number;
  percent: number; // history: estimated share of the history downloaded
};
const IDLE_STATE: MessageSyncState = { active: false, phase: "new", chatsDone: 0, chatsTotal: 0, percent: 0 };
let syncState = IDLE_STATE;
const syncStateListeners = new Set<() => void>();
function setSyncState(next: MessageSyncState) {
  syncState = next;
  syncStateListeners.forEach((listener) => listener());
}
export function subscribeMessageSyncState(listener: () => void) {
  syncStateListeners.add(listener);
  return () => syncStateListeners.delete(listener);
}
export const getMessageSyncState = () => syncState;

// --- chats currently open (their useChat refreshes itself, the others get their newest page preloaded) ---
const openChats = new Map<string, number>();
export function markChatOpen(chatId: string): () => void {
  openChats.set(chatId, (openChats.get(chatId) ?? 0) + 1);
  return () => {
    const count = (openChats.get(chatId) ?? 1) - 1;
    if (count <= 0) openChats.delete(chatId);
    else openChats.set(chatId, count);
  };
}
export const isChatOpen = (chatId: string) => openChats.has(chatId);

// --- new messages synced for all chats: lets ChatSocket preload the newest page of the chats that had nothing new ---
const syncFinishedListeners = new Set<(chats: any[]) => void>();
export function onMessageSyncFinished(listener: (chats: any[]) => void): () => void {
  syncFinishedListeners.add(listener);
  return () => syncFinishedListeners.delete(listener);
}

/** Called after each successful chats fetch; runs once at a time, the latest call wins. */
export function scheduleMessageSync(chats: any[], account: string, accountPk: string) {
  if (syncUnsupported || !Array.isArray(chats) || !account || !accountPk) return;
  syncQueued = { chats, account, accountPk };
  if (syncTimer || syncRunning) return; // a running history download picks the job up (see takeQueuedJob)
  syncTimer = setTimeout(startQueuedSync, SYNC_DELAY);
}

function startQueuedSync() {
  syncTimer = null;
  const job = syncQueued;
  syncQueued = null;
  if (!job) return;
  syncRunning = runSync({ ...job, requests: 0 })
    .catch((err) => console.error("message sync failed", err))
    .finally(() => {
      syncRunning = null;
      setSyncState(IDLE_STATE);
      if (syncQueued) syncTimer = setTimeout(startQueuedSync, SYNC_DELAY);
    });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const whenVisible = (): Promise<void> =>
  typeof document === "undefined" || !document.hidden
    ? Promise.resolve()
    : new Promise((resolve) => {
        const onChange = () => {
          if (document.hidden) return;
          document.removeEventListener("visibilitychange", onChange);
          resolve();
        };
        document.addEventListener("visibilitychange", onChange);
      });

async function postSync(targets: SyncTarget[], limit: number, accountPk: string) {
  let token = await getChatToken(accountPk);
  const chats = targets.map(({ chatId, after, before }) => ({ chatId, after, ...(before != null ? { before } : {}) }));
  let tokenRetried = false;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(BACKEND + "/sync-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", token: token as string },
      body: JSON.stringify({ chats, limit }),
    });
    if (res.status === 404) {
      syncUnsupported = true; // backend without the endpoint: chats still load page by page when opened
      return null;
    }
    if (res.status === 429) {
      if (attempt >= SYNC_RATE_LIMIT_RETRIES.length) throw new Error("sync rate limited");
      await sleep(SYNC_RATE_LIMIT_RETRIES[attempt]);
      continue;
    }
    const body = await res.json().catch(() => null);
    if ((body?.error === "Invalid token." || body?.error === "Token expired.") && !tokenRetried) {
      tokenRetried = true;
      token = await getChatToken(accountPk, true);
      continue;
    }
    if (!res.ok || !body?.messages) throw new Error(body?.error || "sync failed: HTTP " + res.status);
    return { messages: body.messages as Record<string, any[]>, limit: Number(body.limit) || limit };
  }
}

/**
 * Download the ranges of the queue (one range per chat and request: the backend keys them by chat).
 * Returns false when stopped (unsupported backend, or `beforeRequest` returned false).
 */
async function processTargets(
  run: SyncRun,
  queue: SyncTarget[],
  limit: number,
  handlers: {
    beforeRequest?: () => Promise<boolean>;
    onStored?: (target: SyncTarget, stored: StoredMessage[]) => void;
    onDone: (target: SyncTarget) => Promise<void> | void;
  },
): Promise<boolean> {
  while (queue.length) {
    if (handlers.beforeRequest && !(await handlers.beforeRequest())) return false;
    if (run.requests > 0) await sleep(run.requests < SYNC_FAST_REQUESTS ? SYNC_FAST_INTERVAL : SYNC_SLOW_INTERVAL);
    await whenVisible();
    const batch: SyncTarget[] = [];
    const chatIds = new Set<string>();
    for (let i = 0; i < queue.length && batch.length < SYNC_CHATS_PER_REQUEST; ) {
      if (chatIds.has(queue[i].chatId)) i++;
      else {
        chatIds.add(queue[i].chatId);
        batch.push(queue.splice(i, 1)[0]);
      }
    }
    run.requests++;
    const result = await postSync(batch, limit, run.accountPk);
    if (!result) return false;
    for (const target of batch) {
      const messages = result.messages[target.chatId] || [];
      const complete = messages.length < result.limit;
      // all messages of the range were returned: the oldest one comes right after `after` (-1: history start)
      const stored = await storeServerMessages(
        target.chatId,
        messages,
        complete ? target.after : undefined,
        run.account,
        run.accountPk,
      );
      if (target.newer) {
        // link the message above the range to the newest message of the range (none: to the message below it)
        const prev = stored.length ? stored[0].height : complete ? target.after : undefined;
        if (prev !== undefined && target.newer._prevHeight !== prev) {
          await putMessages([{ ...target.newer, _prevHeight: prev }]);
        }
      }
      handlers.onStored?.(target, stored);
      if (!complete && target.untilComplete && stored.length) {
        const oldest = stored[stored.length - 1];
        queue.push({ ...target, before: oldest.height - 1, newer: oldest });
      } else {
        await handlers.onDone(target);
      }
    }
  }
  return true;
}

const syncableChats = (chats: any[]) =>
  chats.filter((c) => c?.id && !c.isLocal && !c.blocked && Number.isInteger(c.height) && c.height > 0);

async function runSync(run: SyncRun) {
  if (!(await syncNewMessages(run))) return;
  await downloadHistory(run);
}

/** Phase 1: all messages newer than the cache. Returns false when the backend has no sync endpoint. */
async function syncNewMessages(run: SyncRun): Promise<boolean> {
  const candidates = syncableChats(run.chats);
  const ids = candidates.map((c) => c.id);
  await importLegacy(ids);
  const maxHeights = await getMaxHeights(ids);

  // chats list order: most recent first, so the chats the user is about to open are ready first
  const queue: SyncTarget[] = [];
  const heights = new Map<string, number>(); // chat height when queued
  for (const chat of candidates) {
    const max = maxHeights.get(chat.id);
    if (max != null && max >= chat.height) continue;
    if ((await getSyncedHeight(chat.id)) >= chat.height) continue; // up to date, the newest messages were deleted
    heights.set(chat.id, chat.height);
    // never cached: the newest messages now, the rest comes with the history download
    if (max == null) queue.push({ chatId: chat.id, after: -1, untilComplete: false });
    else queue.push({ chatId: chat.id, after: max, untilComplete: true });
  }
  if (queue.length) {
    console.log("message sync:", queue.length, "chats with new messages");
    const total = queue.length;
    let done = 0;
    setSyncState({ ...IDLE_STATE, active: true, phase: "new", chatsTotal: total });
    const finished = await processTargets(run, queue, SYNC_LIMIT_NEW, {
      // the first round has the newest messages: the chat can be shown right away
      onStored: (target, stored) => {
        if (target.before != null) return; // continuation of a range: its top was in the first round
        // first round (no upper bound): the server returned its newest messages, so nothing exists above them up to
        // the chat height of the list, even if the newest stored message is lower (deleted messages)
        const height = heights.get(target.chatId);
        if (height != null) setMeta(SYNCED_HEIGHT_META + target.chatId, String(height)).catch(() => {});
        if (stored.length) notifySynced(target.chatId);
      },
      onDone: () => {
        done++;
        setSyncState({ ...IDLE_STATE, active: true, phase: "new", chatsDone: done, chatsTotal: total });
      },
    });
    if (!finished) return false;
  }
  syncFinishedListeners.forEach((listener) => listener(run.chats));
  return true;
}

/**
 * Gaps in the cached history of a chat, newest first, as ranges to download. Empty: the history is complete.
 * null: nothing cached yet.
 */
async function findHistoryGaps(chatId: string): Promise<SyncTarget[] | null> {
  const links = await getHeightLinks(chatId);
  if (!links.length) return null;
  const gaps: { newer: number; after: number }[] = [];
  for (let i = 0; i < links.length; i++) {
    const newer = links[i];
    const older = links[i + 1];
    if (older) {
      if (older.height !== newer.height - 1 && newer.prev !== older.height)
        gaps.push({ newer: newer.height, after: older.height });
    } else if (newer.prev !== -1 && newer.height > 1) {
      gaps.push({ newer: newer.height, after: -1 }); // below the oldest cached message
    }
  }
  const targets: SyncTarget[] = [];
  for (const gap of gaps) {
    const [newer] = await getMessagesRange(chatId, gap.newer, 1);
    if (newer?.height === gap.newer) {
      targets.push({ chatId, after: gap.after, before: gap.newer - 1, newer, untilComplete: true });
    }
  }
  return targets;
}

/** Phase 2: fill every gap of every chat's history, down to the first message. */
async function downloadHistory(run: SyncRun) {
  const candidates = syncableChats(run.chats);
  const pending: any[] = [];
  for (const chat of candidates) {
    if (!(await getMeta(HISTORY_COMPLETE_META + chat.id))) pending.push(chat);
  }
  if (!pending.length) return;
  console.log("history download:", pending.length, "chats");

  // progress estimate: cached messages / chat heights (heights also count messages the user can't see, e.g. sent
  // before joining a group, hence capped below 100% until the end)
  const counts = await getMessageCounts(pending.map((c) => c.id));
  let expected = 0;
  let have = 0;
  for (const chat of pending) {
    const count = counts.get(chat.id) ?? 0;
    expected += Math.max(chat.height, count);
    have += count;
  }
  const total = pending.length;
  let done = 0;
  const report = () =>
    setSyncState({
      active: true,
      phase: "history",
      chatsDone: done,
      chatsTotal: total,
      percent: Math.min(99, Math.floor((have / Math.max(expected, 1)) * 100)),
    });
  report();

  const queue: SyncTarget[] = [];
  const active = new Map<string, number>(); // chat -> ranges left in the queue
  const verified = new Set<string>();
  let next = 0;
  const complete = async (chatId: string) => {
    await setMeta(HISTORY_COMPLETE_META + chatId, "1");
    done++;
  };
  // keep HISTORY_ACTIVE_CHATS chats in progress, so each request carries ranges of several chats
  const activate = async () => {
    while (active.size < HISTORY_ACTIVE_CHATS && next < pending.length) {
      const chat = pending[next++];
      const gaps = await findHistoryGaps(chat.id);
      if (gaps === null)
        done++; // nothing cached (no visible message yet): checked again on the next run
      else if (!gaps.length) await complete(chat.id);
      else {
        active.set(chat.id, gaps.length);
        queue.push(...gaps);
      }
    }
    report();
  };
  await activate();

  await processTargets(run, queue, SYNC_LIMIT_HISTORY, {
    // new messages first: a chats fetch during the download syncs them before going on
    beforeRequest: async () => {
      const job = syncQueued;
      if (!job) return true;
      syncQueued = null;
      if (job.account !== run.account) {
        syncQueued = job; // account switched: stop, the new account's sync starts after this run
        return false;
      }
      run.chats = job.chats;
      const ok = await syncNewMessages(run);
      report();
      return ok;
    },
    onStored: (_target, stored) => {
      have += stored.length;
      report();
    },
    onDone: async (target) => {
      const left = (active.get(target.chatId) ?? 1) - 1;
      if (left > 0) {
        active.set(target.chatId, left);
        return;
      }
      active.delete(target.chatId);
      // check once that no gap is left (e.g. messages stored meanwhile without links)
      const gaps = verified.has(target.chatId) ? [] : await findHistoryGaps(target.chatId);
      verified.add(target.chatId);
      if (gaps && gaps.length) {
        active.set(target.chatId, gaps.length);
        queue.push(...gaps);
      } else {
        await complete(target.chatId);
      }
      await activate();
    },
  });
}

/** Sync progress, for the chats list indicator. */
export function useMessageSyncState(): MessageSyncState {
  return useSyncExternalStore(subscribeMessageSyncState, getMessageSyncState);
}
