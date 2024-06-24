import { rawToMega } from "../nano/accounts";
import { networks } from "./networks";

export const formatAddress = (address) => {
    if (!address) return "";
    return address.slice(0, 10) + "..." + address.slice(-6);
  }
export const parseURI = (uri) => {
    
    const parts = uri.split(":");
    const prefix = parts[0];
    const ticker = Object.keys(networks).find((key) => networks[key].prefix === prefix);

    if (parts[0] == null || !networks.hasOwnProperty(ticker)) {
      return {
        address: uri,
        megaAmount: "",
      }
    }

    // regex to match prefix: URIs
    const nanoURIScheme = new RegExp(`^${prefix}:.+`, "g");
    const isValid = nanoURIScheme.test(uri);
    if (!isValid) {
      return {
        address: uri,
        megaAmount: "",
      }
    }
    const url = new URL(uri);
    const searchParams = url.searchParams;
    const address = url.pathname;
    const parsed = {
      address: address,
      megaAmount: +rawToMega(ticker, searchParams.get("amount")),
    };
    return parsed;
  }