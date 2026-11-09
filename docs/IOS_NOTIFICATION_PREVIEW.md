# iOS message preview (notification service extension)

Issue: [#29](https://github.com/yxse/NanChat/issues/29)

With **Settings > Notification > Message preview** on, older iOS builds used a silent push and
decrypted the message in the WebView. iOS throttles silent pushes (2–3 an hour, fewer in Low
Power Mode), so previews were unreliable. iOS builds that include `NanChatNotificationService`
decrypt the message natively, before iOS displays the notification.

## Client pieces

| Piece | Role |
|---|---|
| `ios/App/NanChatNotificationService/NotificationService.swift` | Extension: reads the key, decrypts, replaces the body, sets `threadIdentifier = chatId` |
| `ios/App/NanChatNotificationService/NanoBox.swift` | Pure-Swift port of multi-nano-web `box.decrypt` (no dependencies) |
| `ios/App/App/MyViewController.swift` (`NotificationKeysPlugin`) | Writes keys to a keychain group shared with the extension |
| `src/services/notificationKeys.ts`, `src/components/app/useNotificationKeysSync.ts` | Derive and export or clear the keys based on the setting and the wallet accounts |
| `ios/App/NanoBoxTests/` | Vectors produced by the JS library + Swift test runner |

Keys: the app only exports **Curve25519 secret keys**: blake2b-512 of the account private key,
clamped, which is the key `box` uses for decryption. They can decrypt messages but cannot sign
blocks. They are stored with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` in the
`group.com.nanchat.app` keychain access group, in two JSON items (service
`com.nanchat.notification-keys`): `accounts` (account keys) and `shared` (group chat keys).
Both are keyed by the address without its ticker prefix. Keys are exported only while message
preview is on. They are wiped when message preview is turned off, when the wallet is removed, and
when the set of accounts changes. Group keys are exported the first time the app resolves each
one (`getSharedKey`).

## Server contract

The iOS client sends `notificationServiceExtension: 1` in `POST /notifications/push/subscribe`.
For tokens with that flag and `messagePreview` on, send chat messages as a **visible** push:

```jsonc
{
  "token": "...",
  "notification": { "title": "<chat or sender name>", "body": "New message" },
  "data": {
    "nse": "1",               // tells the app this push isn't silent
    "message": "<base64 ciphertext, as stored>",
    "fromAccount": "nano_...", "toAccount": "nano_...",
    "type": "group" | "...", "sharedAccount": "nano_...", "fromAccountName": "...",
    "chatId": "...", "url": "/chat/...", "idInt": "...", "title": "...", "messagePreview": "true"
  },
  "apns": { "payload": { "aps": { "mutable-content": 1, "thread-id": "<chatId>" } } }
}
```

- Don't set `content-available`. The notification is visible, so it doesn't need to wake the app.
- APNs payloads are capped at 4 KB. If the ciphertext doesn't fit, omit `message`, and the
  generic body is shown.
- Keep sending the old silent push to tokens without the flag, for older app versions.
- If the extension can't decrypt (key missing, sticker, unknown format), iOS shows `body`
  unchanged. A notification is never lost.

## Xcode / signing

The `NanChatNotificationService` target (bundle id `com.nanchat.app.NanChatNotificationService`)
is embedded in the app. It needs the `group.com.nanchat.app` App Group capability, the same as
the share extension. With automatic signing, Xcode creates the App ID and profile the first time
it signs.
