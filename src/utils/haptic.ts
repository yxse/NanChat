import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export async function HapticsImpact({ style }) {
    if (Capacitor.getPlatform() !== "ios") return; // only iOS supports haptics
    if (style === undefined) {
        style = ImpactStyle.Medium;
    }
    if (style === ImpactStyle.Medium) {
        style = ImpactStyle.Light;
    }
    Haptics.impact({
        style: style
    });
}