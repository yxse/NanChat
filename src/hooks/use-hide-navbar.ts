import { useEffect } from "react";
import { useBreakpoint } from "./use-windows-dimensions";

export function useHideNavbarOnMobile(hide) {
        const {isMobile, width} = useBreakpoint();
    
    useEffect(() => {
      if (hide && width <= 800) {
        // Select the navbar element
        const admTabBar = document.querySelector('.adm-tab-bar.bottom');
        
        // Hide the navbar if it exists
        if (admTabBar) {
          admTabBar.setAttribute('style', 'display: none');
        }
        
        // Cleanup function when component unmounts
        return () => {
          if (admTabBar) {
            admTabBar.setAttribute('style', 'display: block; margin-bottom: var(--safe-area-inset-bottom)')
          }
        };
      }
    }, [hide, width]); // Add all dependencies
  }