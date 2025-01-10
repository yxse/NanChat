import { tools } from "multi-nano-web";
import { getChatToken, setChatToken } from "../../utils/storage";
import { accountIconUrl } from "../app/Home";
import { signMessage } from "../../api-invoke/Sign";
import { Toast } from "antd-mobile";


const getMessageToSign = async () => {

    return fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + '/message', {
        headers: {
            'Content-Type': 'application/json',
            'account': account
        }
    }).then((res) => res.json());
}


export const getNewChatToken = async (account, privateKey) => {
    const message = "Login to nanwallet.com chat. Date:" + new Date().toISOString();
    const signature = signMessage(privateKey, message);

    return fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + '/token', {
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ account, message, signature })
    }).then((res) => res.json()).then((data) => {
        if (data.token){
            setChatToken(account, data.token);
            return data.token;
        }
        else if (data.error){
            Toast.show({content: data.error, icon: 'fail'})
        }
        
        return null;
    });
}

export const fetcherChat = (url) => fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + url).then((res) => res.json());

export const fetcherMessages = (url) => getChatToken().then(async (token) => {
    return fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + url, {
        headers: {
            'Content-Type': 'application/json',
            'token': token
        }
    })
    .then((res) => {
        if (res.ok){
            return res.json()
        }
        else {
            return Promise.reject(res.status)
        }
    })
}
)

export const fetcherAccount = (account) => fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + '/account?account=' + account)
.then((res) => res.json()).then((data) => {
    if (data?.profilePicture == null){
        data.profilePicture = {
            url: accountIconUrl(account)
        }
    }
    return data
})
export const fetcherMessagesPost = (url, data) => fetch(import.meta.env.VITE_PUBLIC_CHAT_SOCKET + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
    }).then((res) => res.json());