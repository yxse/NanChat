package com.nanchat.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Decryption keys for message previews shown by {@link NanChatMessagingService}, written by the
 * NotificationKeys plugin (Android side of src/services/notificationKeys.ts).
 *
 * Only Curve25519 secret keys are stored (derived one way from the account keys): they can read
 * messages but cannot sign blocks, so they cannot move funds. Two JSON maps, "accounts" and
 * "shared" (group chats), keyed by the address without its ticker prefix, are encrypted with an
 * AES-GCM key that never leaves the Android Keystore. The key has no user authentication so the
 * messaging service can use it while the device is locked; it is deleted with the data.
 * A backup restored on another device can't be decrypted there and reads as empty.
 */
final class NotificationKeyStore {
    private static final String TAG = "NotificationKeyStore";
    private static final String PREFS = "nanchat_notification_keys";
    private static final String KEY_ALIAS = "nanchat_notification_keys";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;

    static final String ACCOUNTS = "accounts";
    static final String SHARED = "shared";

    private NotificationKeyStore() {}

    static synchronized Map<String, String> read(Context context, String name) {
        Map<String, String> out = new HashMap<>();
        String stored = prefs(context).getString(name, null);
        if (stored == null) return out;
        try {
            SecretKey key = existingKey();
            if (key == null) return out;
            byte[] blob = Base64.decode(stored, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, blob, 0, IV_LENGTH));
            byte[] plain = cipher.doFinal(blob, IV_LENGTH, blob.length - IV_LENGTH);
            JSONObject json = new JSONObject(new String(plain, StandardCharsets.UTF_8));
            Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                out.put(k, json.getString(k));
            }
        } catch (Exception e) {
            Log.w(TAG, "cannot read " + name, e);
        }
        return out;
    }

    static synchronized void write(Context context, String name, Map<String, String> keys) throws Exception {
        SharedPreferences.Editor editor = prefs(context).edit();
        if (keys.isEmpty()) {
            editor.remove(name).commit();
            return;
        }
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey()); // the keystore picks a random IV
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(new JSONObject(keys).toString().getBytes(StandardCharsets.UTF_8));
        byte[] blob = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, blob, 0, iv.length);
        System.arraycopy(encrypted, 0, blob, iv.length, encrypted.length);
        if (!editor.putString(name, Base64.encodeToString(blob, Base64.NO_WRAP)).commit()) {
            throw new IllegalStateException("cannot save " + name);
        }
    }

    static synchronized void merge(Context context, String name, Map<String, String> keys) throws Exception {
        Map<String, String> merged = read(context, name);
        merged.putAll(keys);
        write(context, name, merged);
    }

    static synchronized void clear(Context context) {
        prefs(context).edit().clear().commit();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
        } catch (Exception e) {
            Log.w(TAG, "cannot delete keystore key", e);
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static SecretKey existingKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    private static SecretKey getOrCreateKey() throws Exception {
        SecretKey existing = existingKey();
        if (existing != null) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }
}
