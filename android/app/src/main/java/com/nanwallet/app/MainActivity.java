package com.nanchat.app;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import android.view.ViewGroup;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Log.d(TAG, "onCreate: Initializing edge-to-edge handler");
        // Call the edge-to-edge handler after the bridge is initialized
        edgeToEdgeHandler();
        bridge.getWebView().addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void refreshSafeArea() {
                runOnUiThread(() -> {
                    Log.d(TAG, "JavaScript interface: Refreshing safe area");
                    refreshSafeArea1();
                });
            }
        }, "AndroidSafeArea");
    }


    /**
     * Public method to force refresh the safe area insets.
     * https://github.com/ionic-team/capacitor/issues/7951#issuecomment-3082814965
     */
    public void refreshSafeArea1() {
        Log.d(TAG, "refreshSafeArea: Force refreshing safe area insets");

        // Run on UI thread to ensure we're on the main thread
        runOnUiThread(() -> {
            if (bridge != null && bridge.getWebView() != null) {
                // Trigger a new window insets calculation
                ViewCompat.requestApplyInsets(bridge.getWebView());
                Log.d(TAG, "refreshSafeArea: Window insets refresh requested");
            } else {
                Log.w(TAG, "refreshSafeArea: Bridge or WebView is null, cannot refresh");
            }
        });
    }

    private void edgeToEdgeHandler() {
        // fix webview bug of --safe-area-inset-bottom
        //https://github.com/ionic-team/capacitor/issues/7951#issuecomment-2775795776
        Log.d(TAG, "edgeToEdgeHandler: Setting up window insets listener");
        ViewCompat.setOnApplyWindowInsetsListener(bridge.getWebView(), (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());

            Log.d(TAG, String.format("Window insets - top: %d, left: %d, right: %d, bottom: %d",
                    insets.top, insets.left, insets.right, insets.bottom));
            Log.d(TAG, "Android API level: " + Build.VERSION.SDK_INT);

            // For devices < API 35, we apply layout margins --> safe-area-insets will be 0
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                Log.d(TAG, "Using layout margins approach (API < 35)");
                ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
                mlp.leftMargin = insets.left;
                mlp.bottomMargin = insets.bottom;
                mlp.rightMargin = insets.right;
                mlp.topMargin = insets.top;
                v.setLayoutParams(mlp);
                Log.d(TAG, "Layout margins applied successfully");
            } else {
                Log.d(TAG, "Using CSS custom properties approach (API 35+)");
                // For devices with API 35 we manually set safe-area inset variables. There is a current issue with the WebView
                // (see https://chromium-review.googlesource.com/c/chromium/src/+/6295663/comments/a5fc2d65_86c53b45?tab=comments)
                // which causes safe-area-insets to not respect system bars.
                // Code based on https://ruoyusun.com/2020/10/21/webview-fullscreen-notch.html
                WebView view = this.bridge.getWebView();

                float density = getApplicationContext().getResources().getDisplayMetrics().density;
                Log.d(TAG, "Display density: " + density);

                int topPx = Math.round(insets.top / density);
                int leftPx = Math.round(insets.left / density);
                int rightPx = Math.round(insets.right / density);
                int bottomPx = Math.round(insets.bottom / density);

                Log.d(TAG, String.format("Setting CSS properties - top: %dpx, left: %dpx, right: %dpx, bottom: %dpx",
                        topPx, leftPx, rightPx, bottomPx));

                view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-safe-area-top', '%spx')", topPx), null);
                view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-safe-area-left', '%spx')", leftPx), null);
                view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-safe-area-right', '%spx')", rightPx), null);
                view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-safe-area-bottom', '%spx')", bottomPx), null);

                Log.d(TAG, "CSS custom properties set successfully");
            }

            // Don't pass window insets to children
            return WindowInsetsCompat.CONSUMED;
        });

        Log.d(TAG, "edgeToEdgeHandler: Window insets listener setup complete");
    }
}