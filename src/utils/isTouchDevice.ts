import { Capacitor } from '@capacitor/core';

export function isTouchDevice() {
   // Running inside a Capacitor native shell (iOS/Android) — always touch
    const platform = Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') return true;

    // Web fallback
    return matchMedia('(hover: none)').matches;
}