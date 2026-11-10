# Android message preview (native messaging service)

Issue: [#29](https://github.com/yxse/NanChat/issues/29). iOS counterpart: [IOS_NOTIFICATION_PREVIEW.md](IOS_NOTIFICATION_PREVIEW.md).

With **Settings > Notification > Message preview** on, the server sends chat messages to Android as a
data-only push (`sendNotificationLocal`, `messagePreview: "true"`). Android delivers it to the app's
messaging service even when the app is killed, but the Firebase plugin can only hand it to the
WebView, so the notification used to be lost once the app was swiped away. The app now
decrypts it and posts it natively. No server change was needed for text messages; sticker images need the server's `stickerId` push field.

## Client pieces

| Piece | Role |
|---|---|
| `android/.../NanChatMessagingService.java` | Replaces the plugin's `MessagingService` (manifest `tools:node="remove"`). Preview push + app not active → native notification. Still forwards the push to the plugin when the WebView runs (chat preload) |
| `android/.../ChatNotification.java` | Decrypts, builds one `MessagingStyle` notification per chat (channel `chat_messages`), tap = Firebase-style intent |
| `android/.../SenderAvatar.java` | Sender profile picture, same lookup and cache rules as iOS |
| `android/.../NanoBox.java` | Plain Java port of `NanoBox.swift` (multi-nano-web `box.decrypt`) |
| `android/.../NotificationKeyStore.java`, `NotificationKeysPlugin.java` | Same `NotificationKeys` plugin as iOS: keys encrypted with an Android Keystore AES-GCM key |
| `android/NanoBoxTests/NanoBoxTest.java` | Runs `NanoBox.java` against `ios/App/NanoBoxTests/vectors.json` |

`android/...` = `android/app/src/main/java/com/nanwallet/app` (package `com.nanchat.app`).

## Behaviour

- **App in the foreground** (`App.getState().isActive`): unchanged, JS handles the push.
- **App in the background or killed**: the service decrypts with the stored key and posts the
  notification. JS still gets the push if the WebView is alive, preloads the chat and skips its own
  local notification (`shownNatively` in `AppUrlListener.tsx`). When the WebView isn't running,
  the push isn't forwarded, otherwise the plugin would replay it to JS at the next launch.
- **Stickers**: not encrypted, the push has the image URL in `stickerId`. The message says
  "Sticker" and shows the image inline (Android 9+), fetched through the image proxy as a 384px
  PNG and shared with the notification UI through the app's FileProvider.
- **Decryption fails** (no key yet, group key not exported yet, sticker...): "New message" (or
  "<name> mentioned you"), so a message is never lost.
- **Tap**: opens `MainActivity` with `google.message_id` + `chatId`/`url` extras, which the plugin
  turns into `notificationActionPerformed`, also on a cold start. JS then runs the usual path
  (`expectNewMessages`, navigate to the chat, refresh the chats list, clear notifications).
- Users with preview **off** are unaffected: Android itself shows the visible "New message" push.

## Keys

Same as iOS: only Curve25519 secret keys (cannot sign blocks), synced by `useNotificationKeysSync`
while message preview is on, wiped (with the Keystore key and avatar cache) when it is turned off,
when the wallet is removed, or when the account set changes. Stored in the
`nanchat_notification_keys` shared preferences, encrypted with the `nanchat_notification_keys`
Keystore key (no user authentication, so it works while the device is locked). A backup restored
on another device can't be decrypted there.

## Tests

```sh
javac -d android/app/build/nanobox-tests android/app/src/main/java/com/nanwallet/app/NanoBox.java android/NanoBoxTests/NanoBoxTest.java
java -cp android/app/build/nanobox-tests com.nanchat.app.NanoBoxTest ios/App/NanoBoxTests/vectors.json
```
