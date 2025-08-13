import { Toast } from "antd-mobile";
import { megaToRaw, rawToMega } from "../nano/accounts";
import { networks } from "./networks";
import { Share } from '@capacitor/share';
import { Clipboard } from "@capacitor/clipboard";
import { HapticsImpact } from "./haptic";
import { ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

export const convertAddress = (address, ticker) => {
  if (address == null) {
    return "";
  }
    // if (address.startsWith("nano_")) {
    //   return address.replace("nano_", networks[ticker]?.prefix + "_");
    // }
    return networks[ticker]?.prefix + "_" + address.split("_")[1];
  }

export const formatAddress = (address, start = 10, end = 6) => {
    if (!address) return "";
    return address.slice(0, start) + "..." + address.slice(-end);
  }
export const formatAmountRaw = (amountRaw, ticker) => {
    if (amountRaw == null) {
      return "";
    }
    return rawToMega(ticker, amountRaw);
  }
  export const formatAmountMega = (amountMega, ticker) => {
    if (amountMega == null) {
      return "";
    }
    return +(+amountMega).toFixed(networks[ticker]?.decimalsToShow);
  }
export const parseURI = (uri) => {
    const parts = uri.split(":");
    let prefix = parts[0];
    let ticker = Object.keys(networks).find((key) => networks[key].prefix === prefix);
    if (ticker == null && !uri.includes(":")) {
      prefix = uri.split("_")[0];
      ticker = Object.keys(networks).find((key) => networks[key].prefix === prefix);
    }
    if (ticker == null) {
      throw new Error("Invalid URI");
    }

    if (parts[0] == null || !networks.hasOwnProperty(ticker)) {
      return {
        address: uri,
        megaAmount: "",
        ticker: ticker
      }
    }

    // regex to match prefix: URIs
    const nanoURIScheme = new RegExp(`^${prefix}:.+`, "g");
    const isValid = nanoURIScheme.test(uri);
    if (!isValid) {
      return {
        address: uri,
        megaAmount: "",
        ticker: ticker
      }
    }
    const url = new URL(uri);
    const searchParams = url.searchParams;
    const address = url.pathname;
    const parsed = {
      address: address,
      megaAmount: searchParams.get("amount") ? +rawToMega(ticker, searchParams.get("amount")) : "",
      ticker: ticker,
    };
    return parsed;
  }

  export const getURI = (ticker, address, megaAmount) => {
    if (megaAmount == null) {
      return `${address}`;
    }
    const amountRaw = megaToRaw(ticker, megaAmount);
    return `${networks[ticker].prefix}:${address}?amount=${amountRaw}`;
  }

  export const ShareModal = async ({title, url}) => {
    if (Capacitor.isNativePlatform() && await Share.canShare()) {
        Share.share({
          text: title,
        });
      }
      else{
        copyToClipboard(title);
        Toast.show({
          icon: 'success',
          content: "Copied to clipboard!",
          duration: 2000
        });
      }
  }

  export const copyToClipboard = async (text, error = "Failed to copy") => {
    try {
      HapticsImpact({
        style: ImpactStyle.Medium
      });
      await Clipboard.write({
        string: text
      });
    } catch (error) {
      Toast.show({
        icon: "fail",
        content: error
      });
      console.error("Error copying to clipboard", error);
    }
  }
  export const pasteFromClipboard = async () => {
    try {
      const { value } = await Clipboard.read();
      return value;
    } catch (error) {
      Toast.show({
        icon: "fail",
        content: "Failed to paste"
      });
    }
  }

  export const MIN_USD_SWAP = 0.01;

  export const formatSize = (bytes) => {
    if (bytes == 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }