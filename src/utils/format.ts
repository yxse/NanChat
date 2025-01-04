import { megaToRaw, rawToMega } from "../nano/accounts";
import { networks } from "./networks";

export const convertAddress = (address, ticker) => {
  if (address == null) {
    return "";
  }
    if (address.startsWith("nano_")) {
      return address.replace("nano_", networks[ticker]?.prefix + "_");
    }
    return address;
  }

export const formatAddress = (address) => {
    if (!address) return "";
    return address.slice(0, 10) + "..." + address.slice(-6);
  }
export const formatAmountRaw = (amountRaw, ticker) => {
    if (amountRaw == null) {
      return "";
    }
    return rawToMega(ticker, amountRaw);
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
      megaAmount: searchParams.get("amount") ? +rawToMega(ticker, searchParams.get("amount")) : null,
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