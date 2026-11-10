package com.nanchat.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Loads a sender's profile picture for a message notification. Android port of
 * ios/App/NanChatNotificationService/SenderAvatar.swift.
 *
 * Picture URL: {@code fromProfilePicture} in the push if the server sends it, otherwise the public
 * {@code GET /account} endpoint (the one the app uses), cached for a day. The image is fetched
 * through the image proxy as a small PNG and cached on disk. Any failure returns null: the
 * notification is then shown without an avatar.
 */
final class SenderAvatar {
    private static final String TAG = "SenderAvatar";
    private static final String PREFS = "nanchat_notification_avatars";
    private static final String DEFAULT_BACKEND_URL = "https://api.nanchat.com";
    private static final long URL_CACHE_TTL_MS = 24 * 60 * 60 * 1000L;
    private static final int SIZE = 192;
    private static final int TIMEOUT_MS = 3000; // the whole push must be handled in a few seconds
    private static final int MAX_BYTES = 2 * 1024 * 1024;

    private SenderAvatar() {}

    static Bitmap load(Context context, String address, String pictureUrl) {
        try {
            if (pictureUrl != null && !pictureUrl.isEmpty()) return image(context, pictureUrl);
            String id = ChatNotification.keyId(address);
            SharedPreferences prefs = prefs(context);
            String urlKey = "avatar." + id;
            String timeKey = "avatar." + id + ".ts";
            String cached = prefs.getString(urlKey, null);
            if (cached != null && System.currentTimeMillis() - prefs.getLong(timeKey, 0) < URL_CACHE_TTL_MS) {
                return cached.isEmpty() ? null : image(context, cached);
            }
            String backend = prefs.getString("backendUrl", DEFAULT_BACKEND_URL);
            HttpURLConnection connection = open(backend + "/account?account=nano_" + id);
            String picture = "";
            try {
                int status = connection.getResponseCode();
                if (status == 200) {
                    byte[] body = readAll(connection.getInputStream());
                    if (body == null) return null;
                    JSONObject profilePicture = new JSONObject(new String(body, StandardCharsets.UTF_8)).optJSONObject("profilePicture");
                    picture = profilePicture != null ? profilePicture.optString("url", "") : "";
                } else if (status != 404) { // 404 = unknown account, i.e. no picture
                    return null; // network/server error: don't cache, try again next time
                }
            } finally {
                connection.disconnect();
            }
            // "" = no picture, so we don't ask again for a day
            prefs.edit().putString(urlKey, picture).putLong(timeKey, System.currentTimeMillis()).apply();
            return picture.isEmpty() ? null : image(context, picture);
        } catch (Exception e) {
            Log.w(TAG, "cannot load avatar", e);
            return null;
        }
    }

    static void setBackendUrl(Context context, String backendUrl) {
        prefs(context).edit().putString("backendUrl", backendUrl).apply();
    }

    /** Profile pictures, their URLs and sticker images, cleared with the keys. */
    static void clearCache(Context context) {
        SharedPreferences prefs = prefs(context);
        SharedPreferences.Editor editor = prefs.edit();
        for (String key : prefs.getAll().keySet()) {
            if (key.startsWith("avatar.")) editor.remove(key);
        }
        editor.apply();
        File[] files = cacheDirectory(context).listFiles();
        if (files != null) {
            for (File file : files) file.delete();
        }
    }

    /** Circle crop, as messaging apps show avatars. */
    static Bitmap circle(Bitmap source) {
        int size = Math.min(source.getWidth(), source.getHeight());
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        int left = (source.getWidth() - size) / 2;
        int top = (source.getHeight() - size) / 2;
        canvas.drawBitmap(source, new Rect(left, top, left + size, top + size), new Rect(0, 0, size, size), paint);
        return out;
    }

    private static Bitmap image(Context context, String source) throws Exception {
        File file = cachedImage(context, source, SIZE);
        return file != null ? BitmapFactory.decodeFile(file.getAbsolutePath()) : null;
    }

    /**
     * PNG file of an image fetched through the image proxy (resized to fit {@code size} px),
     * cached on disk and cleared with the keys. Null if it can't be fetched or isn't an image.
     * Also used for stickers ({@link ChatNotification}), which are shown from this file.
     */
    static File cachedImage(Context context, String source, int size) throws Exception {
        File file = new File(cacheDirectory(context), sha256(size + ":" + source) + ".png");
        if (isImage(file)) return file;
        HttpURLConnection connection = open(proxiedUrl(source, size));
        try {
            if (connection.getResponseCode() != 200) return null;
            byte[] data = readAll(connection.getInputStream());
            if (data == null) return null;
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
            file.getParentFile().mkdirs();
            File tmp = new File(file.getPath() + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(data);
            }
            if (!tmp.renameTo(file)) {
                tmp.delete();
                return null;
            }
            return file;
        } finally {
            connection.disconnect();
        }
    }

    private static boolean isImage(File file) {
        if (!file.isFile()) return false;
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
        return bounds.outWidth > 0;
    }

    /** Same proxy as ProfilePicture.tsx, resized and converted to PNG. */
    private static String proxiedUrl(String source, int size) {
        return "https://i.nanwallet.com/unsafe/rs::" + size + "/plain/" + encodeUri(source) + "@png";
    }

    /** Equivalent of JS encodeURI. */
    static String encodeUri(String source) {
        String allowed = ";,/?:@&=+$-_.!~*'()#";
        StringBuilder sb = new StringBuilder();
        for (byte b : source.getBytes(StandardCharsets.UTF_8)) {
            int c = b & 0xff;
            boolean alnum = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
            if (alnum || (c < 128 && allowed.indexOf(c) >= 0)) {
                sb.append((char) c);
            } else {
                sb.append('%').append(String.format("%02X", c));
            }
        }
        return sb.toString();
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        return connection;
    }

    private static byte[] readAll(InputStream in) throws Exception {
        try (InputStream input = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int n;
            while ((n = input.read(buffer)) != -1) {
                out.write(buffer, 0, n);
                if (out.size() > MAX_BYTES) return null;
            }
            return out.toByteArray();
        }
    }

    private static String sha256(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        return NanoBox.toHex(digest);
    }

    private static File cacheDirectory(Context context) {
        return new File(context.getCacheDir(), "notification_images");
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
