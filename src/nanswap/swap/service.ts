import { networks } from "../../utils/networks";

export const fetcher = (url) => fetch(url).then((res) => res.json());
const BASE_URL = import.meta.env.VITE_PUBLIC_BACKEND + '/partners/';

export const getAllCurrencies = BASE_URL + 'all-currencies';
export const getOrder = BASE_URL + 'get-order?id=';
export const getEstimate = BASE_URL + 'get-estimate';
export const getLimits = BASE_URL + 'get-limits';
export const createOrder = BASE_URL + 'create-order';

export const getFiatCurrencies = BASE_URL + 'get-currencies-fiat';
export const getEstimateFiat = BASE_URL + 'get-estimate-fiat';
export const getLimitsFiat = BASE_URL + 'get-limits-fiat';
export const createOrderFiat = BASE_URL + 'create-order-fiat';
export const fetchPrices = async () => {
    const response = await fetch("https://api.nanexplorer.com/prices");
    return response.json();
  };
export const fetchAlias = async (account) => {
    const response = await fetch(`https://api.nanexplorer.com/alias?account=${account}`);
    return response.json().then((data) => data.alias);
}
export const fetchAliasIdentifierMulti = async (email) => {
    const {identifier, domain} = parseEmailIdentifier(email);
    if (!identifier || !domain) return null;
    let route = "nano-currency.json";
    let isFull = false;
    if (domain === "xno.link") isFull = true;
    if (isFull) route = "full.json";

    const url = `https://${domain}/.well-known/${route}?names=${identifier}`;
    const proxy = `https://proxy.xno.link/?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxy);
    const data = await response.json();
    if (data['names'].length === 0) return [];
    if (isFull) return data['names'].find((name) => name.name.toLowerCase() === identifier.toLowerCase())?.addresses
    else return [{
        ticker: "XNO",
        address: data['names'].find((name) => name.name.toLowerCase() === identifier.toLowerCase())?.address
      }
    ]
}

export const fetchAliasInternet = async (email, ticker) => {
    const {identifier, domain} = parseEmailIdentifier(email);
    if (!identifier || !domain) return null;

    let route = "nano-currency.json";
    route = networks[ticker].name.toLowerCase() + "-" + "currency.json";

    const url = `https://${domain}/.well-known/${route}?names=${identifier}`;
    const proxy = `https://proxy.xno.link/?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxy);
    if (!response.ok) return null;
    const data = await response.json();
    if (data == null || data['names'] == null || data['names'].length === 0) return null;
    const address = data['names'].find((name) => name.name.toLowerCase() === identifier.toLowerCase());
    return address?.address;
}

export const parseEmailIdentifier = (email) => {
    if (email[0] === '@') email = email.slice(1); // remove @ if it's the first character
    let emailSplit = email.split('@');
    let identifier = '';
    let domain = '';
    if (emailSplit.length === 2) {
        identifier = emailSplit[0];
        domain = emailSplit[1];
    }
    else {
        identifier = '_';
        domain = emailSplit[0];
    }
    try {
      let url = new URL(`https://${domain}`);
    } catch (error) {
      return null;
    }
    return {identifier, domain};
}
export const cryptoBaseCurrencies = ["BTC", "ETH", "XRP", "LTC", "BCH", "XMR"];
export const fetchFiatRates = async () => {
    const [fiat, nanoUSD] = await 
    Promise.all([
      fetch("https://cdn.moneyconvert.net/api/latest.json"),
      fetch("https://api.nanexplorer.com/prices").then((res) => res.json()).then((data) => 1 / data['XNO'].usd)
    ]);
    const data = await fiat.json();
    let rates = data.rates;
    // show popular currencies first
    const popularCurrencies = ["USD", "EUR", "JPY", "GBP", "AUD", "CAD", "CHF", "CNY", "SEK", "NZD"];
    const sortedRates = {};
    popularCurrencies.forEach((currency) => {
      if (rates[currency]){
        sortedRates[currency] = rates[currency];
      }
    });
    sortedRates["XNO"] = nanoUSD;
    sortedRates["NYANO"] = nanoUSD * 1000000;
    cryptoBaseCurrencies.forEach((currency) => {
      if (rates[currency]) {
        sortedRates[currency] = rates[currency];
      }
    });
    for (const currency in rates) {
      if (!popularCurrencies.includes(currency)) {
        sortedRates[currency] = rates[currency];
      }
    }
    return sortedRates;
  };

export const getCurrencyLogo = (currency) => {
  if (currency === "XNO") {
    return networks["XNO"].logo;
  }
  else if (currency === "NYANO") {
    return "https://nyano.org/img/nyano2.png";
  }
  else if (cryptoBaseCurrencies.includes(currency)) {
    return `https://moneyconvert.net/assets/flags/${currency.toLowerCase()}.svg`;
  }
  else {
    return `https://moneyconvert.net/assets/flags/${currency.toLowerCase().slice(0, 2)}.svg`;
  }
}
