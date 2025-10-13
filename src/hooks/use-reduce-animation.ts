import { Capacitor } from "@capacitor/core";
import { reduceMotion, restoreMotion } from "antd-mobile";
import { PowerMode } from "power-mode";
import { useEffect } from "react";
import useLocalStorageState from "use-local-storage-state";

export const useReduceAnimation = () => {
    // on low power mode, request animation frames are often reduced by system on mobile which might cause slow animations
    // so we disable animation by default on power saving mode
    const [reduceAnimation, setReduceAnimation] = useLocalStorageState('reduceAnimation', { defaultValue: Capacitor.getPlatform() === "web" ? 'never' : 'onPowerSaving' }); 
    useEffect(() => {
       const applySetting = async () => {
         if (reduceAnimation === 'always') {
            reduceMotion();
        } else if (reduceAnimation === 'never') {
            restoreMotion();
        }
        else if (reduceAnimation === 'onPowerSaving') {
            let isPowerSaving = await PowerMode.lowPowerModeEnabled();
            if (isPowerSaving.lowPowerModeEnabled) {
                reduceMotion();
            } else {
                restoreMotion();
            }
        }
    }
    applySetting();
        
    }, [reduceAnimation])
            
    return [reduceAnimation, setReduceAnimation] as const;
}