package com.nanchat.app;

import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.Bridge;
import com.google.firebase.messaging.RemoteMessage;

import io.capawesome.capacitorjs.plugins.firebase.messaging.FirebaseMessagingPlugin;
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;

/**
 * Replaces the Firebase plugin's messaging service (see AndroidManifest.xml).
 *
 * Message previews arrive as data-only pushes. The plugin can only hand those to the WebView, so
 * once the app was swiped away or killed they were never shown. When the app isn't in the
 * foreground, chat pushes with message preview on are decrypted and shown here
 * ({@link ChatNotification}); the JS listener then skips its own local notification for them.
 * Every push is still passed to the plugin when the WebView is running, so JS keeps preloading
 * the chat. In the foreground, JS handles the push as before.
 */
public class NanChatMessagingService extends MessagingService {
    private static final String TAG = "NanChatMessaging";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        boolean shownNatively = false;
        if (ChatNotification.isPreviewPush(remoteMessage.getData()) && !isAppActive()) {
            try {
                ChatNotification.show(this, remoteMessage.getData(), remoteMessage.getSentTime());
                shownNatively = true;
            } catch (Exception e) {
                Log.e(TAG, "cannot show message notification", e);
            }
        }
        if (shownNatively && !isWebViewRunning()) {
            // nothing to preload, and the plugin would replay this push to JS at the next launch
            return;
        }
        super.onMessageReceived(remoteMessage);
    }

    /** Same state JS reads with App.getState().isActive. */
    private static boolean isAppActive() {
        Bridge bridge = FirebaseMessagingPlugin.staticBridge;
        return bridge != null && bridge.getApp() != null && bridge.getApp().isActive();
    }

    private static boolean isWebViewRunning() {
        Bridge bridge = FirebaseMessagingPlugin.staticBridge;
        return bridge != null && bridge.getWebView() != null;
    }
}
