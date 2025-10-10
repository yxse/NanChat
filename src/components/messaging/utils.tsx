import { Badge, DotLoading, Modal, Toast } from "antd-mobile";
import { QRCodeSVG } from "qrcode.react";
import useLocalStorageState from "use-local-storage-state";
import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
import { networks } from "../../utils/networks";
import { Device } from "@capacitor/device";
import { StatusBar, Style } from "@capacitor/status-bar";
import { NoAvatar } from "./components/icons/NoAvatar";
import ProfilePicture from "./components/profile/ProfilePicture";
import { cryptoBaseCurrencies, fetchFiatRates, fetchPrices } from "../../nanswap/swap/service";
import useSWR from "swr";
import { AccountAvatar } from "./AccountAvatar";

export const hasLink = (message: string) => {
    return String(message)?.match(/(https?:\/\/[^\s]+)/g)
}

export const isNanoAppMessage = (message: string) => {
    return message.nanoApp
}
export const isSpecialMessage = (message: Message) => {
    
    return message?.stickerId || message?.tip || message?.file || message?.redPacket ||
    message?.type === "system" || message?.type === "join-request" || message?.content === "File" || message?.content === "Sticker" || message?.content === "tip" 
    || message?.content === "Transfer"
    || message?.content === "Red Packet"
}
 /**
 * Extracts title, description and image from a webpage's meta tags
 * Checks standard meta tags, Open Graph tags, and Twitter Card tags
 * @returns {Object} Object containing title, description, and image URL
 */
export function extractMetadata() {
    // Initialize result object
    const metadata = {
      title: null,
      description: null,
      image: null,
      url: window.location.href,
      favicon: null
    };
    
    // Extract title (in order of preference)
    metadata.title = 
    // Standard HTML title
    document.querySelector('title')?.textContent ||
      // Open Graph
      document.querySelector('meta[property="og:title"]')?.content ||
      // Twitter
      document.querySelector('meta[name="twitter:title"]')?.content ||
      null;
    
    // Extract description (in order of preference)
    metadata.description = 
      // Open Graph
      document.querySelector('meta[property="og:description"]')?.content ||
      // Twitter
      document.querySelector('meta[name="twitter:description"]')?.content ||
      document.querySelector('meta[property="twitter:description"]')?.content ||

      // Standard meta description
      document.querySelector('meta[name="description"]')?.content ||
      null;
    
    // Extract image (in order of preference)
    metadata.image = 
      // Open Graph
      document.querySelector('meta[property="og:image"]')?.content ||
      document.querySelector('meta[property="og:image:url"]')?.content ||
      // Twitter
      document.querySelector('meta[name="twitter:image"]')?.content ||
      document.querySelector('meta[property="twitter:image"]')?.content ||
      document.querySelector('meta[name="twitter:image:src"]')?.content ||
      // Article specific (some sites use these)
      document.querySelector('meta[property="article:image"]')?.content ||
      null;

      metadata.favicon =
      document.querySelector('link[rel="icon"]')?.href ||
      document.querySelector('link[rel="shortcut icon"]')?.href ||
      document.querySelector('link[rel="apple-touch-icon"]')?.href ||
      null;
    
    return JSON.stringify(metadata);
  }


// https://filesec.io/
export const dangerousExtensions = [".7z",".a3x",".appinstaller",".applescript",".application",".appref",".appx",".appxbundle",".arj",".asd",".bat",".bgi",".bz2",".cab",".chm",".cmd",".com",".cpl",".cs",".daa",".desktopthemepackfile",".diagcab",".dll",".dmg",".doc",".docm",".dot",".dotm",".eml",".exe",".gadget",".gz",".hta",".htm",".html",".hwpx",".ics",".img",".iqy",".iso",".jar",".jnlp",".js",".jse",".library",".lnk",".mam",".mht",".mhtml",".mof",".msc",".msi",".msrcincident",".ocx",".odt",".oxps",".pdf",".pif",".pot",".potm",".ppa",".ppam",".ppkg",".pps",".ppsm",".ppt",".pptm",".ps1",".pub",".py",".pyc",".pyo",".pyw",".pyz",".pyzw",".rar",".reg",".rtf",".scf",".scpt",".scr",".sct",".searchConnector",".service",".settingcontent",".sh",".sldm",".slk",".so",".svg",".tar",".theme",".themepack",".timer",".url",".uue",".vb",".vbe",".vbs",".vhd",".vhdx",".wbk",".website",".wim",".wiz",".ws",".wsf",".wsh",".xlam",".xll",".xlm",".xls",".xlsb",".xlsm",".xlt",".xltm",".xps",".xsl",".xz",".z",".zip"]


export const SeedVerifiedBadge = ({children, icon = false, count=0}) => {
  const [seedVerified] = useLocalStorageState('seedVerified', { defaultValue: false })

  if (seedVerified) return children
  if (icon) return (
    <Badge content={count ? count : Badge.dot} style={{marginLeft: 4}}>
      {children}
    </Badge>
  )
  return (
    <>
     <Badge content={count ? count : Badge.dot}/>
        {children}
    </>
  )
}

  

export const TEAM_ACCOUNT = import.meta.env.VITE_PUBLIC_TEAM_ACCOUNT as string;

export const defaultContacts = [
        {
            name: 'NanChat Team',
            addresses: [
                { network: 'ALL', address: 'nano_1aotdujz8ypijprua9fkerxr9nifbj8bbq5edgztjif45qr3g6fbd1cxenij' },
            ]
        },
]


export function generateSecurePassword() {
  // based on iOS password generator
  // Define character sets
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  // Create array to hold all characters
  let passwordArray = [];

  // Helper function for secure random integer
  function getSecureRandomInt(max) {
      const randomBuffer = new Uint32Array(1);
      window.crypto.getRandomValues(randomBuffer);
      return randomBuffer[0] % max;
  }

  // Helper function for secure random character from a string
  function getSecureRandomChar(charSet) {
      return charSet[getSecureRandomInt(charSet.length)];
  }

  // Fill the array with lowercase letters initially
  for (let i = 0; i < 18; i++) {
      passwordArray.push(getSecureRandomChar(lowercase));
  }

  // Choose random positions for the uppercase letter and number
  const uppercasePosition = getSecureRandomInt(18);
  let numberPosition;
  do {
      numberPosition = getSecureRandomInt(18);
  } while (numberPosition === uppercasePosition);

  // Replace with the uppercase letter and number
  passwordArray[uppercasePosition] = getSecureRandomChar(uppercase);
  passwordArray[numberPosition] = getSecureRandomChar(numbers);

  // Insert hyphens after each 6 characters
  passwordArray.splice(6, 0, '-');
  passwordArray.splice(13, 0, '-');

  // Join array into string and return
  return passwordArray.join('');
}


export const openInBrowser = (url: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      InAppBrowser.openInSystemBrowser({
        url,
        options: DefaultSystemBrowserOptions
      })
    } catch (error) {
      InAppBrowser.openInExternalBrowser({
        url: url
      })      
    }
  }
  else {
    window.open(url)
  }
} 

export const openHashInExplorer = (hash: string, ticker: string) => {
  openInBrowser(`https://nanexplorer.com/${networks[ticker].id}/block/${hash}`)
}
export const refreshStatusBarTheme = () => {
  if (Capacitor.getPlatform() == "android"){
    Device.getInfo().then((info) => {
    console.log("sdk: ", info.androidSDKVersion)
    if (info.androidSDKVersion && info.androidSDKVersion >= 35){
      if (document.documentElement.getAttribute("data-prefers-color-scheme") === "dark"){
        console.log("set dark")
        StatusBar.setStyle({ style: Style.Dark });
      }
      else {
        console.log("set light")
        StatusBar.setStyle({ style: Style.Light });
      }
    }
  })
}
}

export  const findNanoAddress = (addresses) => {
    if (addresses == null) return null;
    if (addresses.find((address) => address.network === 'XNO')) {
        return 'nano_' + addresses?.find((address) => address.network === 'XNO').address?.split('_')[1];
    }
    return convertAddress(addresses[0].address, 'XNO');
}
export const cacheKeyPrefix = (chatId) => `chat_${chatId}_msg_`;

export const ConvertToBaseCurrency = ({ ticker, amount, maximumSignificantDigits = undefined }) => {
  const [selected] = useLocalStorageState("baseCurrency", {defaultValue: "USD"})
  const {data, isLoading, error} = useSWR('fiat', fetchFiatRates)
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
  );

  if (isLoadingPrices) return <DotLoading />;
  if (prices?.[ticker] === undefined) {
    return "--"
  }
  let converted = 0
  if (selected === ticker) {
    converted = amount;
  }
  else{
    converted = amount * (+prices?.[ticker]?.usd * +data?.[selected] ) ;
  }
  return (
    <FormatBaseCurrency amountInBaseCurrency={converted} maximumSignificantDigits={maximumSignificantDigits} />
  );
}


export const FormatBaseCurrency = ({amountInBaseCurrency, maximumSignificantDigits = undefined, isLoading = false}) => {
  const [selected] = useLocalStorageState("baseCurrency", {defaultValue: "USD"})

  let formatted = null
  try {
    if (selected === "XNO") {
      formatted = "Ӿ" + new Intl.NumberFormat("en-US", {maximumFractionDigits: 7 }).format(amountInBaseCurrency);
    }
    else if (selected.startsWith("X") || cryptoBaseCurrencies.includes(selected)) {
      // without this it would always show 2 decimal places for X.. currencies
      formatted = new Intl.NumberFormat("en-US", {maximumFractionDigits: 7 }).format(amountInBaseCurrency) + " " + selected;
    }
    else if (selected === "NYANO"){
      formatted = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0 }).format(amountInBaseCurrency) + " " + selected;
    }
    else if (maximumSignificantDigits === undefined) {
      formatted = new Intl.NumberFormat("en-US", { 
        style: 'currency', 
        currency: selected,
       }).format(amountInBaseCurrency);
    }
    else {
      formatted = new Intl.NumberFormat("en-US", { 
        style: 'currency', 
        currency: selected,
        maximumSignificantDigits: maximumSignificantDigits,
       }).format(amountInBaseCurrency);
    }

  }
  catch (e) {
    console.log(e);
    if (maximumSignificantDigits === undefined) {
      formatted = new Intl.NumberFormat("en-US", {maximumFractionDigits: 7 }).format(amountInBaseCurrency) + " " + selected;
    }
    else {
      formatted = new Intl.NumberFormat("en-US", {maximumSignificantDigits: maximumSignificantDigits }).format(amountInBaseCurrency) + " " + selected;
    }
    // +amountInBaseCurrency.toPrecision(6) + " " + selected;
  }
  if (isLoading) {
    return <DotLoading />
  }
  return (
    <>
      {formatted}
    </>
  );
}

export const convertAddress = (address, ticker) => {
  if (address == null) {
    return "";
  }
    // if (address.startsWith("nano_")) {
    //   return address.replace("nano_", networks[ticker]?.prefix + "_");
    // }
    return networks[ticker]?.prefix + "_" + address.split("_")[1];
  }

export function clearLocalStorage(){

   let count = 0
    localStorage.removeItem("app-cache")
                  localStorage.removeItem('lastSync');
                  localStorage.removeItem('lastSyncChat');
                  sessionStorage.removeItem('app-initialized')
                  for (var key in localStorage) {
                    if (
                      key.startsWith("draft-") || 
                      key.startsWith("history-") || 
                      key.startsWith("works-") || 
                      key.startsWith("message-") ||
                      key.startsWith("chat_") ||
                      key.startsWith("lastSyncChat") ||
                      key.startsWith("receiveHashesToAnimate") ||
                      key.startsWith("history_exchanges")

                    ) {
                      localStorage.removeItem(key)
                      count++
                    }
                  }
                 
  }

  // simple wrapper localstorage to handle quota exceed error
  // usefull for old version that stored cache in localstorage
  export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014) {
      clearLocalStorage()
      Toast.show({content: "QuotaExceededError. Clearing cache"})
      return false; // Quota exceeded
    }
    throw error; // Re-throw other errors
  }
}
export let firstMessageId = {};


export let shouldStickToBottom = {};
shouldStickToBottom['current'] = true


export const useImmediateSafeMutate = (mutate) => {
  // deduplicate and thottle mutate
  const isMutatingRef = useRef(false);
  
  return useCallback(async () => {
    if (isMutatingRef.current) {
      console.log('mutate already in progress, skipping');
      return;
    }
    
    isMutatingRef.current = true;
    try {
      console.log('executing immediate mutate');
      await mutate();
    } finally {
      // Reset flag after a brief moment to prevent rapid duplicates
      setTimeout(() => {
        isMutatingRef.current = false;
      }, 5000); // 5s throttle
    }
  }, [mutate]);
};


export const LIMIT_MESSAGES_INITIAL = 20;
export const LIMIT_MESSAGES = 40;
