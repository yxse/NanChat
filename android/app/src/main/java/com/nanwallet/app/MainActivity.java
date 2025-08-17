package com.nanchat.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.ValueCallback;
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

        // Enable edge-to-edge before setting up the handler
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().getDecorView().setSystemUiVisibility(
                    getWindow().getDecorView().getSystemUiVisibility()
                            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }

        configureWebView(); // prevent loosing focus when keyboard open and trying reply to message
        // Call the edge-to-edge handler after the bridge is initialized
        edgeToEdgeHandler();
        bridge.getWebView().addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void refreshSafeArea() {
                try {
                    Log.d(TAG, "JavaScript interface: Refreshing safe area");
                    refreshSafeArea1();
                } catch (Exception e) {
                    Log.d(TAG, "error refresh safe area");
                }
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
            // Try multiple approaches to get the navigation bar insets
            Insets systemBarsInsets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets navigationBarsInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
            Insets statusBarsInsets = windowInsets.getInsets(WindowInsetsCompat.Type.statusBars());
            Insets displayCutoutInsets = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());

            Log.d(TAG, String.format("SystemBars insets - top: %d, left: %d, right: %d, bottom: %d",
                    systemBarsInsets.top, systemBarsInsets.left, systemBarsInsets.right, systemBarsInsets.bottom));
            Log.d(TAG, String.format("NavigationBars insets - top: %d, left: %d, right: %d, bottom: %d",
                    navigationBarsInsets.top, navigationBarsInsets.left, navigationBarsInsets.right, navigationBarsInsets.bottom));
            Log.d(TAG, String.format("StatusBars insets - top: %d, left: %d, right: %d, bottom: %d",
                    statusBarsInsets.top, statusBarsInsets.left, statusBarsInsets.right, statusBarsInsets.bottom));
            Log.d(TAG, String.format("DisplayCutout insets - top: %d, left: %d, right: %d, bottom: %d",
                    displayCutoutInsets.top, displayCutoutInsets.left, displayCutoutInsets.right, displayCutoutInsets.bottom));

            // Combine all insets to get the maximum values
            Insets insets = Insets.of(
                    Math.max(Math.max(systemBarsInsets.left, navigationBarsInsets.left), Math.max(statusBarsInsets.left, displayCutoutInsets.left)),
                    Math.max(Math.max(systemBarsInsets.top, navigationBarsInsets.top), Math.max(statusBarsInsets.top, displayCutoutInsets.top)),
                    Math.max(Math.max(systemBarsInsets.right, navigationBarsInsets.right), Math.max(statusBarsInsets.right, displayCutoutInsets.right)),
                    Math.max(Math.max(systemBarsInsets.bottom, navigationBarsInsets.bottom), Math.max(statusBarsInsets.bottom, displayCutoutInsets.bottom))
            );

            Log.d(TAG, String.format("Window insets - top: %d, left: %d, right: %d, bottom: %d",
                    insets.top, insets.left, insets.right, insets.bottom));
            Log.d(TAG, "Android API level: " + Build.VERSION.SDK_INT);

            // For devices < API 35, we apply layout margins --> safe-area-insets will be 0
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                Log.d(TAG, "Navigation mode: " + getNavigationModeString());
                Log.d(TAG, "Using layout margins approach (API < 35)");
                ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
                mlp.leftMargin = insets.left;
                mlp.bottomMargin = insets.bottom;
                mlp.rightMargin = insets.right;
                mlp.topMargin = insets.top;
                v.setLayoutParams(mlp);
                Log.d(TAG, "Layout margins applied successfully");

                // Also set CSS variables for API < 35 to make navigation bar height available
                WebView view = this.bridge.getWebView();
                float density = getApplicationContext().getResources().getDisplayMetrics().density;
                Log.d(TAG, "Display density: " + density);

                int topPx = Math.round(insets.top / density);
                int leftPx = Math.round(insets.left / density);
                int rightPx = Math.round(insets.right / density);
                int bottomPx = Math.round(insets.bottom / density);

                Log.d(TAG, "has nav bar:" + hasNavigationBar());
                // Fallback: if bottom inset is 0 but navigation bar should exist, use resource method
                if (bottomPx == 0 && hasNavigationBar()) {
                    int navBarHeight = getNavigationBarHeight();
                    bottomPx = Math.round(navBarHeight / density);
                    Log.d(TAG, "Using fallback navigation bar height: " + bottomPx + "px");
                }


                Log.d(TAG, String.format("Setting CSS variables for API < 35 - top: %dpx, left: %dpx, right: %dpx, bottom: %dpx",
                        topPx, leftPx, rightPx, bottomPx));


                if (getNavigationMode() == 2){
                    // Set custom CSS variables for insets (since safe-area-inset will be 0 due to margins)
                    view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-inset-top', '%spx')", topPx), null);
                    view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-inset-left', '%spx')", leftPx), null);
                    view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-inset-right', '%spx')", rightPx), null);
                    view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-inset-bottom', '%spx')", bottomPx), null);
                }else{
                    // this is used to fix bug keyboard extra space when navigation button are enabled
                    view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-inset-bottom-buttons', '%spx')", bottomPx), null);
                    view.evaluateJavascript(String.format("document.documentElement.style.setProperty('--android-inset-top', '%spx')", topPx), null);

                }
                Log.d(TAG, "CSS inset variables set successfully for API < 35");
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

    /**
     * Fallback method to get navigation bar height using resources
     */
    private int getNavigationBarHeight() {
        int resourceId = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        if (resourceId > 0) {
            return getResources().getDimensionPixelSize(resourceId);
        }
        return 0;
    }

    /**
     * Check if device has navigation bar
     */
    private boolean hasNavigationBar() {
        int id = getResources().getIdentifier("config_showNavigationBar", "bool", "android");
        return id > 0 && getResources().getBoolean(id);
    }

    /**
     * Check navigation mode: 0 = 3-button, 1 = 2-button, 2 = gesture
     */
    private int getNavigationMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                return android.provider.Settings.Secure.getInt(
                        getContentResolver(),
                        "navigation_mode",
                        0 // default to 3-button navigation
                );
            } catch (Exception e) {
                Log.w(TAG, "Could not get navigation mode", e);
                return 0;
            }
        }
        return 0; // Assume 3-button for older versions
    }

    /**
     * Get navigation mode as string for logging
     */
    private String getNavigationModeString() {
        int mode = getNavigationMode();
        switch (mode) {
            case 0: return "3-button navigation";
            case 1: return "2-button navigation";
            case 2: return "Gesture navigation";
            default: return "Unknown navigation mode (" + mode + ")";
        }
    }

    /**
     * Check if device is using gesture navigation
     */
    private boolean isGestureNavigation() {
        return getNavigationMode() == 2;
    }

    /**
     * Check if device is using button navigation (2-button or 3-button)
     */
    private boolean isButtonNavigation() {
        int mode = getNavigationMode();
        return mode == 0 || mode == 1;
    }

    @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    String action = intent.getAction();
    String type = intent.getType();
    if ((Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action)) && type != null) {
      bridge.getActivity().setIntent(intent);
      bridge.eval("window.dispatchEvent(new Event('sendIntentReceived'))", new ValueCallback<String>() {
        @Override
        public void onReceiveValue(String s) {
        }
      });
    }
  }

    private void configureWebView() {
        WebView webView = this.bridge.getWebView();

        // Your solution: Override onLongClick to prevent focus loss
        webView.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                WebView.HitTestResult result = webView.getHitTestResult();

                // If the result type is null or not editable text - return true (ignore the long click)
                // Otherwise return false (show context menu)
                return result == null || result.getType() != WebView.HitTestResult.EDIT_TEXT_TYPE;
            }
        });
    }
}