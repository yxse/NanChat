package com.nanchat.app;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Protects screens displaying wallet secrets (secret phrase, seed, export password):
 * - FLAG_SECURE blocks screenshots, screen recording, recent-apps preview and
 *   AccessibilityService.takeScreenshot().
 * - accessibilityDataSensitive (API 34+) hides the WebView content from
 *   AccessibilityServices that are not declared as accessibility tools (e.g. TalkBack keeps working).
 * - On API 34+, notifies JS when the user attempts a screenshot so the app can explain why it was blocked.
 * Uses a counter so nested/overlapping sensitive components don't disable protection too early.
 */
@CapacitorPlugin(name = "SensitiveScreen")
public class SensitiveScreenPlugin extends Plugin {
    private int activeCount = 0;
    private Activity.ScreenCaptureCallback screenCaptureCallback;

    @PluginMethod
    public void enable(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            activeCount++;
            if (activeCount == 1) {
                apply(true);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (activeCount > 0) {
                activeCount--;
                if (activeCount == 0) {
                    apply(false);
                }
            }
            call.resolve();
        });
    }

    private void apply(boolean sensitive) {
        Activity activity = getActivity();
        if (sensitive) {
            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        } else {
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setAccessibilityDataSensitive(sensitive
                        ? View.ACCESSIBILITY_DATA_SENSITIVE_YES
                        : View.ACCESSIBILITY_DATA_SENSITIVE_AUTO);
            }

            if (sensitive && screenCaptureCallback == null) {
                screenCaptureCallback = () -> {
                    JSObject data = new JSObject();
                    data.put("blocked", true);
                    notifyListeners("screenshotTaken", data);
                };
                activity.registerScreenCaptureCallback(activity.getMainExecutor(), screenCaptureCallback);
            } else if (!sensitive && screenCaptureCallback != null) {
                activity.unregisterScreenCaptureCallback(screenCaptureCallback);
                screenCaptureCallback = null;
            }
        }
    }
}
