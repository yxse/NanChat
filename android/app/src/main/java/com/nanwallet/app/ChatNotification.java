package com.nanchat.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.content.FileProvider;
import androidx.core.graphics.drawable.IconCompat;

import java.io.File;
import java.util.Map;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;

/**
 * Message preview notification for a chat push, posted natively so it shows even when the app
 * isn't running (the Firebase plugin can only hand data pushes to the WebView).
 *
 * The push data is the one of the silent push (server sendNotificationLocal, messagePreview
 * "true"). The message is decrypted with the keys stored by the NotificationKeys plugin; if that
 * fails the notification says "New message", so a message is never lost.
 * One MessagingStyle notification per chat collects the new messages; tapping it opens the chat
 * the same way as a tap on a Firebase notification (notificationActionPerformed in JS).
 */
final class ChatNotification {
    private static final String TAG = "ChatNotification";
    static final String CHANNEL_ID = "chat_messages";
    private static final String NOTIFICATION_TAG = "chat";
    private static final int STICKER_SIZE = 384;

    private ChatNotification() {}

    /** Chat message push with message preview on (the JS listener shows those itself when the app runs). */
    static boolean isPreviewPush(Map<String, String> data) {
        return "true".equals(data.get("messagePreview"))
                && notEmpty(data.get("chatId"))
                && notEmpty(data.get("fromAccount"))
                && !notEmpty(data.get("callId"));
    }

    static void show(Context context, Map<String, String> data, long sentTime) {
        String chatId = data.get("chatId");
        String fromAccount = data.get("fromAccount");
        boolean isGroup = "group".equals(data.get("type"));
        boolean mentioned = "true".equals(data.get("mentioned"));
        String title = notEmpty(data.get("title")) ? data.get("title") : "NanChat";
        String senderName = notEmpty(data.get("fromAccountName")) ? data.get("fromAccountName") : (isGroup ? shortAddress(fromAccount) : title);

        // sticker messages aren't encrypted: content is "Sticker" and stickerId the image URL
        String stickerId = data.get("stickerId");
        boolean isSticker = notEmpty(stickerId) && stickerId.startsWith("https://");
        FutureTask<Uri> sticker = null;
        if (isSticker) { // fetched while the avatar loads
            sticker = new FutureTask<>(() -> stickerUri(context, stickerId));
            new Thread(sticker, "notification-sticker").start();
        }

        String text = isSticker ? "Sticker" : decrypt(context, data);
        String body;
        if (text != null) {
            body = mentioned ? "[@you] " + text : text;
        } else {
            body = mentioned ? senderName + " mentioned you" : "New message"; // same wording as the server's visible push
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        ensureChannel(manager);
        int id = ("chat:" + chatId).hashCode();

        // add to the messages already shown for this chat, if its notification is still there
        NotificationCompat.MessagingStyle style = null;
        try {
            for (StatusBarNotification active : manager.getActiveNotifications()) {
                if (active.getId() == id && NOTIFICATION_TAG.equals(active.getTag())) {
                    style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(active.getNotification());
                    break;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "cannot read active notifications", e);
        }
        if (style == null) {
            style = new NotificationCompat.MessagingStyle(new Person.Builder().setName("You").build());
        }

        Bitmap avatar = SenderAvatar.load(context, fromAccount, data.get("fromProfilePicture"));
        Bitmap roundAvatar = avatar != null ? SenderAvatar.circle(avatar) : null;
        Person.Builder sender = new Person.Builder().setName(senderName).setKey(fromAccount);
        if (roundAvatar != null) sender.setIcon(IconCompat.createWithBitmap(roundAvatar));

        style.setGroupConversation(isGroup);
        style.setConversationTitle(isGroup ? title : null);
        NotificationCompat.MessagingStyle.Message message = new NotificationCompat.MessagingStyle.Message(
                body, sentTime > 0 ? sentTime : System.currentTimeMillis(), sender.build());
        Uri stickerUri = null;
        if (sticker != null) {
            try {
                stickerUri = sticker.get(6, TimeUnit.SECONDS);
            } catch (Exception e) {
                sticker.cancel(true);
                Log.w(TAG, "cannot load sticker", e);
            }
        }
        // shown inline in the conversation (Android 9+); the text stays as the fallback
        if (stickerUri != null) message.setData("image/png", stickerUri);
        style.addMessage(message);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.nanchat_notif)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(style)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setShowWhen(true)
                .setContentIntent(tapIntent(context, data, id))
                // lock screen set to hide sensitive content: generic notification
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(new NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(R.drawable.nanchat_notif)
                        .setContentTitle("NanChat")
                        .setContentText("New message")
                        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                        .build());
        if (!isGroup && roundAvatar != null) builder.setLargeIcon(roundAvatar);

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_TAG, id, builder.build());
        } catch (SecurityException e) {
            Log.w(TAG, "notification permission not granted", e); // Android 13+ permission refused
        }
    }

    /** Same channel for every message notification posted natively. */
    private static void ensureChannel(NotificationManager manager) {
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Messages", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("New chat messages");
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(channel);
    }

    /**
     * Opens MainActivity like a tap on a Firebase notification: the plugin sees "google.message_id"
     * and sends notificationActionPerformed with the other extras as data (chatId, url...), also
     * when the tap launches the app (BridgeActivity passes the launch intent to the plugins).
     */
    private static PendingIntent tapIntent(Context context, Map<String, String> data, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        String messageId = notEmpty(data.get("idMessage")) ? data.get("idMessage") : String.valueOf(System.currentTimeMillis());
        intent.putExtra("google.message_id", "nanchat-" + messageId);
        for (String key : new String[] {"chatId", "url", "type", "fromAccount", "toAccount", "idInt", "idMessage"}) {
            if (data.get(key) != null) intent.putExtra(key, data.get(key));
        }
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * content:// URI of the sticker image, through the app's FileProvider (cache-path): the system
     * grants the notification UI read access to MessagingStyle data URIs when it posts it.
     */
    private static Uri stickerUri(Context context, String stickerId) throws Exception {
        File file = SenderAvatar.cachedImage(context, stickerId, STICKER_SIZE);
        if (file == null) return null;
        return FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
    }

    /** Plaintext of the pushed message, or null to show the generic body. */
    static String decrypt(Context context, Map<String, String> data) {
        try {
            String message = data.get("message");
            String fromAccount = data.get("fromAccount");
            if (!notEmpty(message) || !notEmpty(fromAccount)) return null;
            boolean isGroup = "group".equals(data.get("type"));
            String keyHex;
            if (isGroup) {
                String sharedAccount = data.get("sharedAccount");
                if (!notEmpty(sharedAccount)) return null;
                keyHex = NotificationKeyStore.read(context, NotificationKeyStore.SHARED).get(keyId(sharedAccount));
            } else {
                String toAccount = data.get("toAccount");
                if (!notEmpty(toAccount)) return null;
                keyHex = NotificationKeyStore.read(context, NotificationKeyStore.ACCOUNTS).get(keyId(toAccount));
            }
            byte[] key = NanoBox.fromHex(keyHex);
            if (key == null) return null;
            String text = NanoBox.open(message, fromAccount, key);
            return notEmpty(text) ? text : null;
        } catch (Exception e) {
            Log.w(TAG, "cannot decrypt message preview", e);
            return null;
        }
    }

    /** Keys are indexed by the address without its ticker prefix (see addressKeyId in notificationKeys.ts). */
    static String keyId(String address) {
        return address.substring(address.lastIndexOf('_') + 1);
    }

    private static String shortAddress(String address) {
        return address.length() > 12 ? address.substring(0, 8) + "..." + address.substring(address.length() - 4) : address;
    }

    private static boolean notEmpty(String value) {
        return value != null && !value.isEmpty();
    }
}
