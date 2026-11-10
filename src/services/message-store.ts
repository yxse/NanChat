// Persistent cache of decrypted chat messages, indexed by (chatId, height), with full text search.
//
// Backends:
//  - Capacitor iOS / Android: @capacitor-community/sqlite
//  - Tauri desktop:           tauri-plugin-sql (sqlite)
//  - Web / extension:         IndexedDB with a compound [chatId, height] key
//
// All backends answer page queries with index range scans, so loading a page of messages never requires loading a
// whole chat in memory.
//
// Search: each row keeps its searchable text normalized (lowercase, without accents, see normalizeForSearch).
// SQLite indexes it with an FTS5 trigram index (substring search, works for languages without spaces such as
// Chinese / Japanese), maintained by triggers. Without FTS5 (sqlite build without it) or for terms shorter than 3
// characters, a LIKE scan of the text column is used; IndexedDB scans the messages.
//
// Writes are coalesced: putMessages() calls made in the same tick are flushed as one batch / transaction, and
// every read waits for pending writes first (read-your-writes).

import { Capacitor } from "@capacitor/core";
import { isTauri } from "@tauri-apps/api/core";

export type StoredMessage = { chatId: string; height: number; [key: string]: any };
export type SearchOptions = { chatId?: string; limit?: number; offset?: number };
export type HeightLink = { height: number; prev: number | null };

interface Backend {
  /** messages with height <= maxHeight, newest first */
  range(chatId: string, maxHeight: number, limit: number): Promise<StoredMessage[]>;
  /** highest cached height per chat (only chats with cached messages are present) */
  maxHeights(chatIds: string[]): Promise<Map<string, number>>;
  /** number of cached messages per chat */
  counts(chatIds: string[]): Promise<Map<string, number>>;
  /** height and _prevHeight of every cached message of a chat, newest first (to find gaps in the history) */
  links(chatId: string): Promise<HeightLink[]>;
  /** upsert; when ignoreExisting is true existing rows are kept (used to import the legacy cache) */
  put(messages: StoredMessage[], ignoreExisting: boolean): Promise<void>;
  /**
   * messages whose text contains every term (normalized substrings), newest first. `filter`: further condition on
   * the normalized text (exact terms), applied before limit / offset
   */
  search(
    terms: string[],
    options: Required<Omit<SearchOptions, "chatId">> & { chatId?: string; filter?: (text: string) => boolean },
  ): Promise<StoredMessage[]>;
  getMeta(key: string): Promise<string | null>;
  /** every meta entry (loaded once, then served from memory) */
  allMeta(): Promise<[string, string][]>;
  setMeta(key: string, value: string): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "nanchat_messages";
const SQL_BATCH_ROWS = 100; // 6 bound params per row, well below sqlite's variable limit
const SCHEMA_VERSION = 2;

// --- searchable text ---

/** Lowercase, without accents: applied to the stored text and to the searched terms. */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

let textOf: (message: StoredMessage) => string | null | undefined = (m) =>
  typeof m.decrypted === "string" ? m.decrypted : null;
/** Which text of a message is searchable (set by message-cache, which knows the message types). */
export function setSearchableText(extract: (message: StoredMessage) => string | null | undefined) {
  textOf = extract;
}
function searchText(message: StoredMessage): string | null {
  const text = textOf(message);
  return typeof text === "string" && text.trim() ? normalizeForSearch(text) : null;
}
const timestampOf = (m: StoredMessage) => {
  const ts = Date.parse(m.timestamp);
  return Number.isFinite(ts) ? ts : null;
};
const prevOf = (m: StoredMessage) => (Number.isInteger(m._prevHeight) ? m._prevHeight : null);

/**
 * A term of the query, normalized. `exact`: written in quotes, matches whole words only ("hi" finds "hi!" but not
 * "this" or "hint"); a quoted phrase ("good morning") matches those words in a row. Still case and accent insensitive.
 */
export type SearchTerm = { text: string; exact: boolean };

// straight and typographic quotes (iOS / macOS keyboards replace " with “ ”)
const QUOTES = /["“”„«»]/;

/**
 * Terms of a query: words, and quoted parts as exact terms. A quote left open (still typing) runs to the end.
 */
export function searchTerms(query: string): SearchTerm[] {
  const terms: SearchTerm[] = [];
  const parts = normalizeForSearch(query).split(QUOTES);
  parts.forEach((part, i) => {
    if (i % 2 === 1) { // inside quotes
      const text = part.trim().replace(/\s+/g, " ");
      if (text) terms.push({ text, exact: true });
    } else {
      for (const word of part.split(/\s+/)) if (word) terms.push({ text: word, exact: false });
    }
  });
  return terms;
}

/** Stable key of a list of terms (memo / effect dependency). */
export const searchTermsKey = (terms: SearchTerm[]) => terms.map((t) => (t.exact ? `"${t.text}"` : t.text)).join(" ");

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactPatterns = new Map<string, RegExp>();
// no lookbehind (missing on older iOS webviews): the character before the match is captured instead
function exactPattern(text: string): RegExp {
  let pattern = exactPatterns.get(text);
  if (!pattern) {
    const body = text.split(" ").map(escapeRegExp).join("\\s+");
    pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${body})(?=[^\\p{L}\\p{N}]|$)`, "gu");
    if (exactPatterns.size > 100) exactPatterns.clear();
    exactPatterns.set(text, pattern);
  }
  pattern.lastIndex = 0;
  return pattern;
}

/** Ranges [start, end) of `normalized` (already normalized text) matching the term. */
export function termRanges(normalized: string, term: SearchTerm): [number, number][] {
  const ranges: [number, number][] = [];
  if (!term.text) return ranges;
  if (!term.exact) {
    for (let at = normalized.indexOf(term.text); at !== -1; at = normalized.indexOf(term.text, at + term.text.length)) {
      ranges.push([at, at + term.text.length]);
    }
    return ranges;
  }
  const pattern = exactPattern(term.text);
  for (let m = pattern.exec(normalized); m; m = pattern.exec(normalized)) {
    const start = m.index + m[1].length;
    ranges.push([start, start + m[2].length]);
    // the separator before the next match is consumed by that match: step back onto it
    pattern.lastIndex = start + m[2].length;
  }
  return ranges;
}

/** Whether `normalized` (already normalized text) matches one term. */
export function matchesTerm(normalized: string, term: SearchTerm): boolean {
  return term.exact ? exactPattern(term.text).test(normalized) : normalized.includes(term.text);
}

/** Whether `normalized` (already normalized text) matches every term. */
export const matchesTerms = (normalized: string, terms: SearchTerm[]) => terms.every((t) => matchesTerm(normalized, t));

function parseRows(rows: { data: string }[] | undefined): StoredMessage[] {
  const out: StoredMessage[] = [];
  for (const row of rows || []) {
    try {
      out.push(JSON.parse(row.data));
    } catch {
      // ignore a corrupted row, it will be fetched again from the server
    }
  }
  return out;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => "\\" + c);

// ---------------------------------------------------------------------------------------------------------------
// SQL backends. `placeholder(i)` renders the i-th (0 based) bound parameter for the driver.
// Statements are kept on a single line: @capacitor-community/sqlite splits execute() input on ";\n".

type SqlDriver = {
  select(sql: string, params: any[]): Promise<any[]>;
  execute(sql: string, params: any[]): Promise<void>;
  placeholder(i: number): string;
};

const TABLES = [
  "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, chat_id TEXT NOT NULL, height INTEGER NOT NULL, ts INTEGER, prev INTEGER, text TEXT, data TEXT NOT NULL, UNIQUE (chat_id, height))",
  "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)",
];
// external content FTS5 index on messages.text (the text is already normalized: the trigram tokenizer only needs to
// split it), kept in sync by triggers
const FTS = [
  "CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(text, content='messages', content_rowid='id', tokenize='trigram')",
  "CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages WHEN new.text IS NOT NULL BEGIN INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text); END",
  "CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages WHEN old.text IS NOT NULL BEGIN INSERT INTO messages_fts(messages_fts, rowid, text) VALUES ('delete', old.id, old.text); END",
  "CREATE TRIGGER IF NOT EXISTS messages_fts_au AFTER UPDATE OF text ON messages BEGIN INSERT INTO messages_fts(messages_fts, rowid, text) SELECT 'delete', old.id, old.text WHERE old.text IS NOT NULL; INSERT INTO messages_fts(rowid, text) SELECT new.id, new.text WHERE new.text IS NOT NULL; END",
];

async function initSqlSchema(driver: SqlDriver): Promise<{ fts: boolean }> {
  const version = Number((await driver.select("PRAGMA user_version", []))[0]?.user_version ?? 0);
  if (version < SCHEMA_VERSION) {
    // v1 (development builds only): messages (chat_id, height, data) WITHOUT ROWID -> keep the rows
    const columns = await driver.select("PRAGMA table_info(messages)", []);
    const isV1 = columns.length > 0 && !columns.some((c) => c.name === "id");
    if (isV1) await driver.execute("ALTER TABLE messages RENAME TO messages_v1", []);
    for (const statement of TABLES) await driver.execute(statement, []);
    if (isV1) {
      const backend = sqlBackend(driver, false);
      let after: [string, number] = ["", -1];
      for (;;) {
        const rows = await driver.select(
          `SELECT chat_id, height, data FROM messages_v1 WHERE (chat_id, height) > (${driver.placeholder(0)}, ${driver.placeholder(1)}) ORDER BY chat_id, height LIMIT 500`,
          after,
        );
        if (!rows.length) break;
        await backend.put(parseRows(rows), true);
        after = [rows[rows.length - 1].chat_id, rows[rows.length - 1].height];
      }
      await driver.execute("DROP TABLE messages_v1", []);
    }
  } else {
    for (const statement of TABLES) await driver.execute(statement, []);
  }

  let fts = true;
  try {
    const existed = (await driver.select("SELECT name FROM sqlite_master WHERE name = 'messages_fts'", [])).length > 0;
    for (const statement of FTS) await driver.execute(statement, []);
    // new index (new database, migration, or a sqlite build that now has FTS5): index the existing rows
    if (!existed) await driver.execute("INSERT INTO messages_fts(messages_fts) VALUES ('rebuild')", []);
  } catch (err) {
    console.warn("message store: no FTS5, search scans the messages", err);
    fts = false;
  }
  if (version < SCHEMA_VERSION) await driver.execute(`PRAGMA user_version = ${SCHEMA_VERSION}`, []);
  return { fts };
}

function sqlBackend(driver: SqlDriver, fts: boolean): Backend {
  const p = driver.placeholder;
  const inList = (ids: string[], offset = 0) => ids.map((_, i) => p(i + offset)).join(",");
  return {
    async range(chatId, maxHeight, limit) {
      const rows = await driver.select(
        `SELECT data FROM messages WHERE chat_id = ${p(0)} AND height <= ${p(1)} ORDER BY height DESC LIMIT ${p(2)}`,
        [chatId, maxHeight, limit],
      );
      return parseRows(rows);
    },
    async maxHeights(chatIds) {
      const result = new Map<string, number>();
      for (const ids of chunk(chatIds, 500)) {
        const rows = await driver.select(
          `SELECT chat_id, MAX(height) AS h FROM messages WHERE chat_id IN (${inList(ids)}) GROUP BY chat_id`,
          ids,
        );
        for (const row of rows) result.set(row.chat_id, Number(row.h));
      }
      return result;
    },
    async counts(chatIds) {
      const result = new Map<string, number>();
      for (const ids of chunk(chatIds, 500)) {
        const rows = await driver.select(
          `SELECT chat_id, COUNT(*) AS n FROM messages WHERE chat_id IN (${inList(ids)}) GROUP BY chat_id`,
          ids,
        );
        for (const row of rows) result.set(row.chat_id, Number(row.n));
      }
      return result;
    },
    async links(chatId) {
      const rows = await driver.select(
        `SELECT height, prev FROM messages WHERE chat_id = ${p(0)} ORDER BY height DESC`,
        [chatId],
      );
      return rows.map((r) => ({ height: Number(r.height), prev: r.prev == null ? null : Number(r.prev) }));
    },
    async put(messages, ignoreExisting) {
      // upsert (not INSERT OR REPLACE: a replace deletes the row without running the delete trigger of the index)
      const conflict = ignoreExisting
        ? "ON CONFLICT (chat_id, height) DO NOTHING"
        : "ON CONFLICT (chat_id, height) DO UPDATE SET ts = excluded.ts, prev = excluded.prev, text = excluded.text, data = excluded.data";
      // one multi-row statement per batch: atomic without an explicit transaction (tauri-plugin-sql uses a
      // connection pool, so BEGIN/COMMIT issued as separate calls could run on different connections)
      for (const batch of chunk(messages, SQL_BATCH_ROWS)) {
        const values: any[] = [];
        const tuples = batch.map((m, i) => {
          values.push(m.chatId, m.height, timestampOf(m), prevOf(m), searchText(m), JSON.stringify(m));
          return `(${[0, 1, 2, 3, 4, 5].map((k) => p(i * 6 + k)).join(", ")})`;
        });
        await driver.execute(
          `INSERT INTO messages (chat_id, height, ts, prev, text, data) VALUES ${tuples.join(",")} ${conflict}`,
          values,
        );
      }
    },
    async search(terms, { chatId, limit, offset, filter }) {
      // terms of 3+ characters go through the trigram index, shorter ones are matched on the text column
      const indexed = fts ? terms.filter((t) => [...t].length >= 3) : [];
      const scanned = terms.filter((t) => !indexed.includes(t));
      const where: string[] = [];
      const params: any[] = [];
      if (indexed.length) {
        where.push(`messages_fts MATCH ${p(params.length)}`);
        params.push(indexed.map((t) => `"${t.replace(/"/g, '""')}"`).join(" AND "));
      }
      for (const term of scanned) {
        where.push(`m.text LIKE ${p(params.length)} ESCAPE '\\'`);
        params.push(`%${escapeLike(term)}%`);
      }
      if (!indexed.length) where.push("m.text IS NOT NULL");
      if (chatId) {
        where.push(`m.chat_id = ${p(params.length)}`);
        params.push(chatId);
      }
      const from = indexed.length ? "messages_fts JOIN messages m ON m.id = messages_fts.rowid" : "messages m";
      const sql = `SELECT m.data, m.text FROM ${from} WHERE ${where.join(" AND ")} ORDER BY m.ts DESC LIMIT ${p(params.length)} OFFSET ${p(params.length + 1)}`;
      if (!filter) return parseRows(await driver.select(sql, [...params, limit, offset]));
      // exact terms (whole words, no sql function for it): candidates in batches, filtered here until the page is full
      const batch = Math.max(200, limit * 4);
      const page: { data: string }[] = [];
      let skipped = 0;
      for (let start = 0; ; start += batch) {
        const rows = await driver.select(sql, [...params, batch, start]);
        for (const row of rows || []) {
          if (typeof row.text !== "string" || !filter(row.text)) continue;
          if (skipped < offset) skipped++;
          else if (page.push(row) === limit) return parseRows(page);
        }
        if (!rows || rows.length < batch) return parseRows(page);
      }
    },
    async getMeta(key) {
      const rows = await driver.select(`SELECT value FROM meta WHERE key = ${p(0)}`, [key]);
      return rows[0]?.value ?? null;
    },
    async allMeta() {
      const rows = await driver.select("SELECT key, value FROM meta", []);
      return rows.map((r) => [String(r.key), r.value] as [string, string]);
    },
    async setMeta(key, value) {
      await driver.execute(`INSERT OR REPLACE INTO meta (key, value) VALUES (${p(0)}, ${p(1)})`, [key, value]);
    },
    async clear() {
      await driver.execute("DELETE FROM messages", []);
      await driver.execute("DELETE FROM meta", []);
    },
  };
}

async function openCapacitorSqlite(): Promise<Backend> {
  const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  // a connection survives a webview reload, reuse it instead of failing to create it again
  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  const db =
    consistent && exists
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  if (!(await db.isDBOpen()).result) await db.open();
  const driver: SqlDriver = {
    placeholder: () => "?",
    async select(sql, params) {
      return (await db.query(sql, params)).values || [];
    },
    async execute(sql, params) {
      if (params.length) await db.run(sql, params, false);
      else await db.execute(sql, false);
    },
  };
  const { fts } = await initSqlSchema(driver);
  return sqlBackend(driver, fts);
}

async function openTauriSqlite(): Promise<Backend> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load(`sqlite:${DB_NAME}.db`);
  const driver: SqlDriver = {
    placeholder: (i) => `$${i + 1}`,
    async select(sql, params) {
      return await db.select<any[]>(sql, params);
    },
    async execute(sql, params) {
      await db.execute(sql, params);
    },
  };
  const { fts } = await initSqlSchema(driver);
  return sqlBackend(driver, fts);
}

// ---------------------------------------------------------------------------------------------------------------
// IndexedDB backend (web / browser extension)

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// iterate a cursor; `visit` returns false to stop
function idbIterate(request: IDBRequest<IDBCursorWithValue | null>, visit: (cursor: IDBCursorWithValue) => boolean) {
  return new Promise<void>((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || visit(cursor) === false) return resolve();
      cursor.continue();
    };
  });
}

async function openIndexedDb(): Promise<Backend> {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains("messages")) db.createObjectStore("messages", { keyPath: ["chatId", "height"] });
    if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
  };
  const db = await idbRequest(open);
  const chatRange = (chatId: string, maxHeight = Infinity) =>
    IDBKeyRange.bound([chatId, -Infinity], [chatId, maxHeight]);
  const messages = () => db.transaction("messages", "readonly").objectStore("messages");

  return {
    async range(chatId, maxHeight, limit) {
      const out: StoredMessage[] = [];
      if (limit <= 0) return out;
      await idbIterate(messages().openCursor(chatRange(chatId, maxHeight), "prev"), (cursor) => {
        out.push(cursor.value);
        return out.length < limit;
      });
      return out;
    },
    async maxHeights(chatIds) {
      const result = new Map<string, number>();
      // in batches, yielding in between: thousands of cursor callbacks at once block the main thread
      for (const ids of chunk(chatIds, 300)) {
        const store = messages();
        await Promise.all(
          ids.map(async (chatId) => {
            // key cursor: the height is in the key, no need to deserialize the message
            const cursor = await idbRequest(store.openKeyCursor(chatRange(chatId), "prev"));
            if (cursor) result.set(chatId, (cursor.primaryKey as [string, number])[1]);
          }),
        );
        if (chatIds.length > 300) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return result;
    },
    async counts(chatIds) {
      const result = new Map<string, number>();
      for (const ids of chunk(chatIds, 300)) {
        const store = messages();
        await Promise.all(
          ids.map(async (chatId) => {
            const n = await idbRequest(store.count(chatRange(chatId)));
            if (n) result.set(chatId, n);
          }),
        );
        if (chatIds.length > 300) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return result;
    },
    async links(chatId) {
      const out: HeightLink[] = [];
      await idbIterate(messages().openCursor(chatRange(chatId), "prev"), (cursor) => {
        out.push({ height: cursor.value.height, prev: prevOf(cursor.value) });
        return true;
      });
      return out;
    },
    async put(items, ignoreExisting) {
      const tx = db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");
      for (const message of items) {
        if (ignoreExisting) {
          // key already exists: keep the existing row, without aborting the transaction or failing idbDone
          store.add(message).onerror = (e) => {
            e.preventDefault();
            e.stopPropagation();
          };
        } else store.put(message);
      }
      await idbDone(tx);
    },
    async search(terms, { chatId, limit, offset, filter }) {
      // no text index in IndexedDB: scan (fine up to tens of thousands of messages), newest first
      const hits: StoredMessage[] = [];
      const range = chatId ? chatRange(chatId) : undefined;
      await idbIterate(messages().openCursor(range), (cursor) => {
        const text = searchText(cursor.value);
        if (text && terms.every((t) => text.includes(t)) && (!filter || filter(text))) hits.push(cursor.value);
        return true;
      });
      hits.sort((a, b) => (timestampOf(b) ?? 0) - (timestampOf(a) ?? 0));
      return hits.slice(offset, offset + limit);
    },
    async getMeta(key) {
      const value = await idbRequest(db.transaction("meta", "readonly").objectStore("meta").get(key));
      return value ?? null;
    },
    async allMeta() {
      const store = db.transaction("meta", "readonly").objectStore("meta");
      const [keys, values] = await Promise.all([idbRequest(store.getAllKeys()), idbRequest(store.getAll())]);
      return keys.map((key, i) => [String(key), values[i]] as [string, string]);
    },
    async setMeta(key, value) {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put(value, key);
      await idbDone(tx);
    },
    async clear() {
      const tx = db.transaction(["messages", "meta"], "readwrite");
      tx.objectStore("messages").clear();
      tx.objectStore("meta").clear();
      await idbDone(tx);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------

export const messageStoreKind: "capacitor-sqlite" | "tauri-sqlite" | "indexeddb" = isTauri()
  ? "tauri-sqlite"
  : Capacitor.isNativePlatform()
    ? "capacitor-sqlite"
    : "indexeddb";

let backendPromise: Promise<Backend> | null = null;
function backend(): Promise<Backend> {
  if (!backendPromise) {
    const open =
      messageStoreKind === "tauri-sqlite"
        ? openTauriSqlite
        : messageStoreKind === "capacitor-sqlite"
          ? openCapacitorSqlite
          : openIndexedDb;
    backendPromise = open().catch((err) => {
      console.error("message store: cannot open", messageStoreKind, err);
      backendPromise = null; // retry on next access
      throw err;
    });
  }
  return backendPromise;
}

// --- in-memory caches ---
// The background sync asks for the meta flags and newest height of every chat after each chats fetch: thousands of
// chats made that thousands of IndexedDB transactions / native sqlite calls (seconds, with main thread jank) per run.
// Both are kept in memory: meta is loaded once and written through, max heights are learned per chat and only grow
// (messages are never deleted one by one).
let metaCache: Map<string, string> | null = null;
let metaLoading: Promise<Map<string, string>> | null = null;
function loadMeta(): Promise<Map<string, string>> {
  if (metaCache) return Promise.resolve(metaCache);
  if (!metaLoading) {
    metaLoading = (async () => {
      const entries = await (await backend()).allMeta();
      metaCache = new Map(entries.filter(([, value]) => value != null));
      return metaCache;
    })().finally(() => {
      metaLoading = null;
    });
  }
  return metaLoading;
}

const maxHeightCache = new Map<string, number>(); // chatId -> newest stored height; -1: known to have no messages
// newest height written for chats not in maxHeightCache yet: merged in by getMaxHeights, so a write landing while the
// backend is queried is not lost
const writtenHeights = new Map<string, number>();
function noteHeights(messages: StoredMessage[]) {
  for (const m of messages) {
    const cache = maxHeightCache.has(m.chatId) ? maxHeightCache : writtenHeights;
    if (m.height > (cache.get(m.chatId) ?? -1)) cache.set(m.chatId, m.height);
  }
}

// --- write coalescing ---
let pending = new Map<string, StoredMessage>(); // key chatId|height, last write wins
let pendingFlush: Promise<void> | null = null;

function flush(): Promise<void> {
  if (!pendingFlush) {
    pendingFlush = (async () => {
      await Promise.resolve(); // let the other writes of this tick join the batch
      const batch = [...pending.values()];
      pending = new Map();
      try {
        if (batch.length) {
          await (await backend()).put(batch, false);
          noteHeights(batch);
        }
      } finally {
        pendingFlush = null;
        if (pending.size) flush(); // writes queued while this batch was being written
      }
    })();
  }
  return pendingFlush;
}

async function settled(): Promise<void> {
  while (pendingFlush || pending.size) {
    try {
      await (pendingFlush || flush());
    } catch {
      // the writer logs; reads still go on
    }
  }
}

/** Upsert messages (decrypted form). Resolves once written. */
export function putMessages(messages: StoredMessage[]): Promise<void> {
  for (const m of messages) {
    if (m?.chatId == null || !Number.isInteger(m.height) || m.height < 0) continue;
    pending.set(m.chatId + "|" + m.height, m);
  }
  flush().catch((err) => console.error("message store: write failed", err));
  return settled(); // also covers writes queued behind a batch already being written
}

/** Insert messages, keeping rows that already exist. */
export async function importMessages(messages: StoredMessage[]): Promise<void> {
  await settled();
  const valid = messages.filter((m) => m?.chatId != null && Number.isInteger(m.height));
  await (await backend()).put(valid, true);
  noteHeights(valid);
}

/** Up to `limit` messages with height <= maxHeight (Infinity for the newest), newest first. */
export async function getMessagesRange(chatId: string, maxHeight: number, limit: number): Promise<StoredMessage[]> {
  await settled();
  // sqlite can't bind Infinity
  return (await backend()).range(chatId, Number.isFinite(maxHeight) ? maxHeight : Number.MAX_SAFE_INTEGER, limit);
}

export async function getMaxHeights(chatIds: string[]): Promise<Map<string, number>> {
  await settled();
  const missing = chatIds.filter((id) => !maxHeightCache.has(id));
  if (missing.length) {
    const found = await (await backend()).maxHeights(missing);
    for (const id of missing) {
      const value = Math.max(found.get(id) ?? -1, writtenHeights.get(id) ?? -1, maxHeightCache.get(id) ?? -1);
      writtenHeights.delete(id);
      maxHeightCache.set(id, value);
    }
  }
  const result = new Map<string, number>();
  for (const id of chatIds) {
    const value = maxHeightCache.get(id);
    if (value !== undefined && value >= 0) result.set(id, value);
  }
  return result;
}

export async function getMessageCounts(chatIds: string[]): Promise<Map<string, number>> {
  await settled();
  if (!chatIds.length) return new Map();
  return (await backend()).counts(chatIds);
}

export async function getHeightLinks(chatId: string): Promise<HeightLink[]> {
  await settled();
  return (await backend()).links(chatId);
}

/** Messages containing every word of the query (case and accent insensitive), newest first. */
export async function searchMessages(query: string, options: SearchOptions = {}): Promise<StoredMessage[]> {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  // every word must be in the text (index / LIKE), quoted terms are then checked for whole words
  const substrings = [...new Set(terms.flatMap((t) => t.text.split(" ")))];
  const exact = terms.filter((t) => t.exact);
  await settled();
  return (await backend()).search(substrings, {
    chatId: options.chatId,
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
    filter: exact.length ? (text) => matchesTerms(text, exact) : undefined,
  });
}

export async function getMeta(key: string): Promise<string | null> {
  return (await loadMeta()).get(key) ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  (await loadMeta()).set(key, value);
  await (await backend()).setMeta(key, value);
}

export async function clearMessageStore(): Promise<void> {
  await settled();
  await (await backend()).clear();
  metaCache = new Map();
  maxHeightCache.clear();
  writtenHeights.clear();
}
