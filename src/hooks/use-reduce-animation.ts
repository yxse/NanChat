import { Capacitor } from "@capacitor/core";
import { reduceMotion, restoreMotion } from "antd-mobile";
import { PowerMode } from "power-mode";
import { useEffect } from "react";
import useLocalStorageState from "use-local-storage-state";

export const useReduceAnimation = () => {
    // on low power mode, request animation frames are often reduced by system on mobile which might cause slow animations
    // so we disable animation by default on power saving mode
    const [reduceAnimation, setReduceAnimation] = useLocalStorageState('reduceAnimation', { defaultValue: Capacitor.getPlatform() === "web" ? 'always' : 'onPowerSaving' }); 
    useEffect(() => {
       const applySetting = async () => {
         if (reduceAnimation === 'always') {
            reduceMotion();
            document.documentElement.classList.add('no-animation');
        } else if (reduceAnimation === 'never') {
            restoreMotion();
            document.documentElement.classList.remove('no-animation');
        }
        else if (reduceAnimation === 'onPowerSaving') {
            let isPowerSaving = await PowerMode.lowPowerModeEnabled();
            if (isPowerSaving.lowPowerModeEnabled) {
                reduceMotion();
                document.documentElement.classList.add('no-animation');
            } else {
                restoreMotion();
                document.documentElement.classList.remove('no-animation');
            }
        }
    }
    applySetting();
        
    }, [reduceAnimation])
            
    return [reduceAnimation, setReduceAnimation];
}