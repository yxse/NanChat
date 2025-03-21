import { useEffect } from "react";
import { useWindowDimensions } from "./use-windows-dimensions";

export function useHideNavbarOnMobile(hide) {
        const {isMobile, width} = useWindowDimensions();
    
    useEffect(() => {
      if (hide && width <= 768) {
        // Select the navbar element
        const admTabBar = document.querySelector('.adm-tab-bar.bottom');
        
        // Hide the navbar if it exists
        if (admTabBar) {
          admTabBar.setAttribute('style', 'display: none');
        }
        
        // Cleanup function when component unmounts
        return () => {
          if (admTabBar) {
            admTabBar.setAttribute('style', 'display: block');
          }
        };
      }
    }, [hide, width]); // Add all dependencies
  }