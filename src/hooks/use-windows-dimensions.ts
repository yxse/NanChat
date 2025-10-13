import { useState, useEffect } from 'react';

export function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;
  const isMobile = width <= 800;
  const isTablet = width > 800 && width < 1200
  const isDesktop = width >= 1200;
  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop
  };
}

export function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    // bad performance, especially when virtual keyboard opens
    // window.addEventListener('resize', handleResize);
    // return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowDimensions;
}

/**
* Determine the mobile operating system.
* This function returns one of 'iOS', 'Android', 'Windows Phone', or 'unknown'.
*
* @returns {String}
*/
export function getMobileOperatingSystem() {
   var userAgent = navigator.userAgent || navigator.vendor || window.opera;

   // Windows Phone must come first because its UA also contains "Android"
   if (/windows phone/i.test(userAgent)) {
       return "Windows Phone";
   }

   if (/android/i.test(userAgent)) {
       return "Android";
   }

   // iOS detection from: http://stackoverflow.com/a/9039885/177710
   if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
       return "iOS";
   }

   return "unknown";
}