# NanChat API — Developer Guide

This guide describes how to interact with the NanChat backend (`VITE_PUBLIC_BACKEND`, `https://api.nanchat.com` by default) to create an account, log in, manage groups, and send messages.

There is no official SDK: everything is done through plain HTTP requests and a [Socket.IO](https://socket.io/) channel for real-time messages. Message encryption relies on [`multi-nano-web`](https://www.npmjs.com/package/multi-nano-web) (Nano keys).

## Key concepts

- **Identity = Nano account.** There is no email/password sign-up: your NanChat identity *is* your Nano address (`nano_...`), derived from a seed generated locally.
- **Signature-based authentication.** To log in, you sign a challenge message with the account's private key, instead of sending a password.
- **End-to-end encryption.** Message content is encrypted client-side with `box.encrypt`/`box.decrypt` from `multi-nano-web` before being sent to the server.
- **Sending a message = WebSocket.** Account creation, chat creation, and participant management go through the HTTP API; sending/receiving messages goes through Socket.IO (same URL as `VITE_PUBLIC_BACKEND`).

## 1. Create an account

Account creation is purely local: generate a Nano seed/keypair, then authenticate with that account (which implicitly registers it server-side).

```ts
import { wallet } from 'multi-nano-web';

const seed = /* generate a secure random seed (32 bytes hex) */;
const account = wallet.fromLegacySeed(seed).accounts[0];
const address = account.address;       // "nano_..."
const privateKey = account.privateKey;
```

Then log in with this account (see section 2) and complete the profile:

```ts
await fetcherMessagesPost('/set-name', { name: 'Alice', account: address, version: 2 });
```

A profile picture can be uploaded as `multipart/form-data` to `POST /upload/upload-profile-picture` (additional fields `{ account, version: 2 }`).

## 2. Log in

Authentication works by signing a dated challenge message:

```ts
import { tools } from 'multi-nano-web';

const message = `Login to nanwallet.com chat. Date:${new Date().toISOString()}`;
const signature = tools.sign(privateKey, `Signed Message: ${message}`);

const res = await fetch(`${NANCHAT_API_URL}/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: address, message, signature }),
});

const { token, expiresAt } = await res.json();
```

This `token` must then be sent in a `token` header (not `Authorization`) on every authenticated request:

```ts
await fetch(`${NANCHAT_API_URL}/chats`, {
  headers: { token },
});
```

If the server responds with `Invalid token.` or `Token expired.`, simply call `/token` again to get a fresh token.

To receive messages in real time, connect the socket with the same token:

```ts
import { io } from 'socket.io-client';

const socket = io(NANCHAT_API_URL, { auth: { token } });
socket.on('connect', () => socket.emit('join', address));
```

## 3. Create a group

```ts
const res = await fetch(`${NANCHAT_API_URL}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', token },
  body: JSON.stringify({
    type: 'group',
    participants: [address, otherAddress1, otherAddress2],
  }),
});
const chat = await res.json(); // { id, participants, ... }
```

A private (1:1) conversation is created the same way, with `type: "private"` and only 2 participants. It can also be auto-created when the first message is sent (see section 5).

### Group encryption: the shared key

A group uses an encryption key shared among all participants. It's materialized by a throwaway Nano account (`sharedAccount`), generated when the group is created:

```ts
import { wallet, box } from 'multi-nano-web';

const sharedWallet = wallet.generate(); // or wallet.generateLegacy(seed)
const sharedAccount = sharedWallet.accounts[0];

const sharedKeys = participants.map((participant) => ({
  sharedAccount: sharedAccount.address,
  encryptedKey: box.encrypt(sharedAccount.privateKey, participant, privateKey),
  toAccount: participant,
}));

await fetch(`${NANCHAT_API_URL}/sharedKeys`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', token },
  body: JSON.stringify({ chatId: chat.id, sharedKeys }),
});
```

Each participant can then fetch and decrypt the shared key with their own private key:

```ts
const res = await fetch(
  `${NANCHAT_API_URL}/sharedKey/?chatId=${chatId}&sharedAccount=${sharedAccount}`,
  { headers: { token } },
);
const { encryptedKey, fromAccount } = await res.json();
const sharedPrivateKey = box.decrypt(encryptedKey, fromAccount, myPrivateKey);
```

### Managing participants

```ts
// Add
await fetch(`${NANCHAT_API_URL}/add-participants`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', token },
  body: JSON.stringify({ chatId, participants: [newAddress] }),
});

// Remove
await fetch(`${NANCHAT_API_URL}/remove-participants`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', token },
  body: JSON.stringify({ chatId, participants: [addressToRemove] }),
});
```

⚠️ After adding a participant, you must redistribute the shared key to the new member (via `POST /sharedKeys`, same as at group creation), otherwise they won't be able to decrypt messages.

Rename a group:

```ts
await fetch(`${NANCHAT_API_URL}/update-group-name`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', token },
  body: JSON.stringify({ chatId, name: 'New name' }),
});
```

## 4. Send a message to a group

Messages are sent through the socket, not over HTTP. The content is encrypted with the group's shared key (`chat.sharedAccount`):

```ts
const content = box.encrypt(text, chat.sharedAccount, myPrivateKey);

socket.emit('message', {
  chatId: chat.id,
  content,
  toAccount: chat.sharedAccount,
  fromAccount: address,
  timestamp: new Date(),
}, (response) => {
  // response: { success, messageId, error? }
});
```

## 5. Send a message to a user (1:1)

Same principle, but the content is encrypted directly with the recipient's public key (no shared key):

```ts
const content = box.encrypt(text, recipientAddress, myPrivateKey);

socket.emit('message', {
  chatId,           // create the private chat first if needed (POST /chat, type: "private")
  content,
  toAccount: recipientAddress,
  fromAccount: address,
  timestamp: new Date(),
}, (response) => {
  // response: { success, messageId, error? }
});
```

If no chat exists yet with this recipient, create it first via `POST /chat` with `type: "private"` (see section 3).

## Receiving messages

```ts
socket.on('message', (message) => {
  // message.content is encrypted: decrypt it with box.decrypt
  // - 1:1: box.decrypt(message.content, message.fromAccount, myPrivateKey)
  // - group: box.decrypt(message.content, message.fromAccount, sharedPrivateKey)
});

socket.on('chat', (chat) => {
  // conversation update (new chat created, metadata changed, ...)
});

socket.on('error', ({ error }) => {
  // e.g. rate limiting
});
```

Other useful socket events:

```ts
socket.emit('join', chatId);   // join the room for an open chat (receives typing, etc.)
socket.emit('leave', chatId);  // leave the room when closing the chat
socket.emit('typing', chatId); // "typing" indicator
socket.on('typing', ({ chatId, fromAccount }) => { /* ... */ });
```

For history (pagination), use `GET /messages?chatId=<id>&limit=<n>&cursor=<height>` with the `token` header.

To fetch a public account profile (name, avatar, bio) without authentication: `GET /account?account=<nano_address>`.

## Main endpoints summary

| Action | Method | Endpoint |
|---|---|---|
| Login (get a token) | `POST` | `/token` |
| Public profile of an account | `GET` | `/account` |
| List conversations | `GET` | `/chats` |
| Create a chat (group or private) | `POST` | `/chat` |
| Rename a group | `POST` | `/update-group-name` |
| Add participants | `POST` | `/add-participants` |
| Remove participants | `POST` | `/remove-participants` |
| Distribute a group's shared key | `POST` | `/sharedKeys` |
| Fetch a group's shared key | `GET` | `/sharedKey` |
| Message history | `GET` | `/messages` |
| Set your name | `POST` | `/set-name` |

All authenticated requests expect a `token` header (obtained via `/token`), not an `Authorization` header.
