
export const fetcherMessages = (url) => fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + url).then((res) => res.json());
export const fetcherMessagesPost = (url, data) => fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
    }).then((res) => res.json());