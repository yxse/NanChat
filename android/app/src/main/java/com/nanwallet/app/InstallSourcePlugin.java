package com.nanchat.app;

import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tells JS which app installed NanChat, so updates can point to the right place:
 * "com.android.vending" = Google Play, anything else (or null) = sideloaded APK
 * (GitHub release), which Play cannot update because it is signed with a different key.
 */
@CapacitorPlugin(name = "InstallSource")
public class InstallSourcePlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("installer", getInstaller());
        call.resolve(ret);
    }

    private String getInstaller() {
        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                InstallSourceInfo info = pm.getInstallSourceInfo(pkg);
                return info.getInstallingPackageName();
            }
            return pm.getInstallerPackageName(pkg);
        } catch (Exception e) {
            return null;
        }
    }
}
