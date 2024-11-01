
export const fetcherMessages = (url) => fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + url).then((res) => res.json());