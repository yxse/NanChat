import { Badge, Modal } from "antd-mobile";
import { QRCodeSVG } from "qrcode.react";
import icon from "../../../public/icons/nanchat.svg";
import useLocalStorageState from "use-local-storage-state";
import { AccountAvatar } from "./components/ChatList";
import { useState } from "react";


export const hasLink = (message: string) => {
    return message.match(/(https?:\/\/[^\s]+)/g)
}

export const isNanoAppMessage = (message: string) => {
    return message.nanoApp
}
export const isSpecialMessage = (message: Message) => {
    
    return message?.stickerId || message?.tip || message?.file ||
    message?.type === "system" || message?.type === "join-request" || message?.content === "File" || message?.content === "Sticker"
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
          url={me?.profilePicture?.url}
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
            name: 'NanWallet Team',
            addresses: [
                { network: 'XNO', address: 'nano_1aotdujz8ypijprua9fkerxr9nifbj8bbq5edgztjif45qr3g6fbd1cxenij' },
            ]
        },
]