export const fetcher = (url) => fetch(url).then((res) => res.json());
const BASE_URL = 'https://api.nanswap.com/';

export const getAllCurrencies = BASE_URL + 'all-currencies';
export const getOrder = BASE_URL + 'get-order?id=';
export const getEstimate = BASE_URL + 'get-estimate';
export const getLimits = BASE_URL + 'get-limits';
export const createOrder = BASE_URL + 'create-order';
export const fetchPrices = async () => {
    const response = await fetch("https://api.nanexplorer.com/prices");
    return response.json();
  };