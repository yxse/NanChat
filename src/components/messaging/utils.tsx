import { Badge, Modal } from "antd-mobile";
import { QRCodeSVG } from "qrcode.react";
import icon from "../../../public/icons/nanchat.svg";
import useLocalStorageState from "use-local-storage-state";
import { AccountAvatar } from "./components/ChatList";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
import { networks } from "../../utils/networks";
import { Device } from "@capacitor/device";
import { StatusBar, Style } from "@capacitor/status-bar";
import { convertAddress } from "../../utils/format";

export const hasLink = (message: string) => {
    return String(message)?.match(/(https?:\/\/[^\s]+)/g)
}

export const isNanoAppMessage = (message: string) => {
    return message.nanoApp
}
export const isSpecialMessage = (message: Message) => {
    
    return message?.stickerId || message?.tip || message?.file ||
    message?.type === "system" || message?.type === "join-request" || message?.content === "File" || message?.content === "Sticker" || message?.content === "tip" || message?.content === "Transfer"
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
      url: window.location.href
    };
    
    // Extract title (in order of preference)
    metadata.title = 
      // Open Graph
      document.querySelector('meta[property="og:title"]')?.content ||
      // Twitter
      document.querySelector('meta[name="twitter:title"]')?.content ||
      // Standard HTML title
      document.querySelector('title')?.textContent ||
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
    
    return JSON.stringify(metadata);
  }


// https://filesec.io/
export const dangerousExtensions = [".7z",".a3x",".appinstaller",".applescript",".application",".appref",".appx",".appxbundle",".arj",".asd",".bat",".bgi",".bz2",".cab",".chm",".cmd",".com",".cpl",".cs",".daa",".desktopthemepackfile",".diagcab",".dll",".dmg",".doc",".docm",".dot",".dotm",".eml",".exe",".gadget",".gz",".hta",".htm",".html",".hwpx",".ics",".img",".iqy",".iso",".jar",".jnlp",".js",".jse",".library",".lnk",".mam",".mht",".mhtml",".mof",".msc",".msi",".msrcincident",".ocx",".odt",".oxps",".pdf",".pif",".pot",".potm",".ppa",".ppam",".ppkg",".pps",".ppsm",".ppt",".pptm",".ps1",".pub",".py",".pyc",".pyo",".pyw",".pyz",".pyzw",".rar",".reg",".rtf",".scf",".scpt",".scr",".sct",".searchConnector",".service",".settingcontent",".sh",".sldm",".slk",".so",".svg",".tar",".theme",".themepack",".timer",".url",".uue",".vb",".vbe",".vbs",".vhd",".vhdx",".wbk",".website",".wim",".wiz",".ws",".wsf",".wsh",".xlam",".xll",".xlm",".xls",".xlsb",".xlsm",".xlt",".xltm",".xps",".xsl",".xz",".z",".zip"]


export const showAccountQRCode = (me) => {
  Modal.show({
      showCloseButton: true,
      closeOnMaskClick: true,
      content: (
        <div className="flex justify-start items-center flex-col">
          <div className="text-xl mb-4 flex justify-start gap-2" style={{width: '200px'}}>
          <AccountAvatar
          account={me?._id}
          // url={me?.profilePicture?.url}
          width={42}
          />
          {me?.name}
          </div>
          {/* <div className="text-sm mb-2">
          {formatAddress(me?._id)}
          </div> */}
          <QRCodeSVG
            id="qrcode"
            imageSettings={{
              src: icon,
              height: 24,
              width: 24,
              excavate: false,
            }}
            includeMargin
            value={`https://nanchat.com/chat/${me?._id}`}
            size={200}
            style={{borderRadius: 8}}
          />
          <div className="text-base mt-4 text-center mb-4" style={{ color: 'var(--adm-color-text-secondary)' }}>
            Scan to start an end-to-end encrypted chat with me
          </div>
        </div>
      )
    })
}


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