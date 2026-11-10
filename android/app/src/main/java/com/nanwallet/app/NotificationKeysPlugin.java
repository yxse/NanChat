package com.nanchat.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Stores the keys {@link NanChatMessagingService} needs to decrypt message previews while the app
 * is in the background or killed. Same interface as NotificationKeysPlugin on iOS
 * (MyViewController.swift), see src/services/notificationKeys.ts.
 */
@CapacitorPlugin(name = "NotificationKeys")
public class NotificationKeysPlugin extends Plugin {
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    /** Replaces all account keys ({address: curve25519 secret key hex}). */
    @PluginMethod
    public void setAccountKeys(PluginCall call) {
        Map<String, String> keys = stringMap(call.getObject("keys"));
        executor.execute(() -> {
            try {
                NotificationKeyStore.write(getContext(), NotificationKeyStore.ACCOUNTS, keys);
                call.resolve();
            } catch (Exception e) {
                call.reject("cannot store keys", e);
            }
        });
    }

    /** Merges group chat keys ({sharedAccount: curve25519 secret key hex}). */
    @PluginMethod
    public void addSharedKeys(PluginCall call) {
        Map<String, String> keys = stringMap(call.getObject("keys"));
        executor.execute(() -> {
            try {
                NotificationKeyStore.merge(getContext(), NotificationKeyStore.SHARED, keys);
                call.resolve();
            } catch (Exception e) {
                call.reject("cannot store keys", e);
            }
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        executor.execute(() -> {
            NotificationKeyStore.clear(getContext());
            SenderAvatar.clearCache(getContext());
            call.resolve();
        });
    }

    /** Settings read by the messaging service (backend used to look up sender profile pictures). */
    @PluginMethod
    public void setConfig(PluginCall call) {
        String backendUrl = call.getString("backendUrl");
        if (backendUrl != null && !backendUrl.isEmpty()) {
            SenderAvatar.setBackendUrl(getContext(), backendUrl);
        }
        call.resolve();
    }

    private static Map<String, String> stringMap(JSObject object) {
        Map<String, String> out = new HashMap<>();
        if (object == null) return out;
        Iterator<String> keys = object.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = object.opt(key);
            if (value instanceof String) out.put(key, (String) value);
        }
        return out;
    }
}
