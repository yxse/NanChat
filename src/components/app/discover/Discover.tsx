import { Capacitor, registerPlugin } from "@capacitor/core";
import { DotLoading, List, NavBar, Popup, Button, Space, Toast, CheckList, Ellipsis, Divider } from "antd-mobile";
import { fetcherMessages, fetcherMessagesNoAuth } from "../../messaging/fetcher";
import useSWR from "swr";
import { useContext, useEffect, useRef, useState } from "react";
import { useWallet, WalletContext } from "../../Popup";
import { convertAddress } from "../../../utils/format";
import { InAppBrowser } from "@capacitor/inappbrowser";

import { WebviewOverlay, IWebviewOverlayPlugin,   } from '@teamhive/capacitor-webview-overlay';
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import MetadataCard from "../../messaging/components/antd-mobile-metadata-card";
import { extractMetadata } from "../../messaging/utils";
import ChatInputMessage from "../../messaging/components/ChatInputMessage";
import { AccountListItems } from "../../messaging/components/NewChatPopup";
import { CheckCircleFill } from "antd-mobile-icons";
import { MdOutlineCircle } from "react-icons/md";
import { ChatAvatar } from "../../messaging/components/ChatList";
import { useSearchParams } from "react-router-dom";
import { AiOutlineShareAlt } from "react-icons/ai";
import { FaRegCircleDot } from "react-icons/fa6";
// const WebviewOverlayPlugin = registerPlugin<IWebviewOverlayPlugin>('WebviewOverlayPlugin');

export const ChatName = ({ chat }) => {
    const { activeAccount } = useWallet();
    return chat?.type === "group" ? chat?.name : chat?.participants.find(participant => participant._id !== activeAccount)?.name;
}

const ItemChat = ({ chat, onClick }) => {
    return (
        <List.Item
            clickable={false}
            onClick={() => onClick(chat)}
            prefix={
                <ChatAvatar chat={chat} />
            }
        >
            <div className="flex items-center gap-2">

            <ChatName chat={chat} />
            </div>
        </List.Item>
    );
}
export const ChatListItems = ({ chats, onClick, viewTransition = true, selectedAccounts, setSelectedAccounts, alreadySelected }) => {
    const { activeAccount } = useWallet();
    const [visible, setVisible] = useState(false);
    return (
        <div>

        <List
        value={selectedAccounts}
        onChange={(v) => {
            setSelectedAccounts(v)
        }}
         extra={null}
 
         >
           
            {
                chats?.map(chat => (
                   <ItemChat key={chat.id} chat={chat} onClick={onClick} />
                ))
            }
        </List>
            </div>
    );
}


export const Discover: React.FC = ({defaultURL}) => {
    const { wallet } = useContext(WalletContext);
    const {data: chats} = useSWR("/chats", fetcherMessages);
    const accounts = chats?.map((chat) => chat.participants).flat()
    const [shareContent, setShareContent] = useState("nothing");
    const [selectedChat, setSelectedChat] = useState(null);
    const [visible, setVisible] = useState(false);
    const [visibleMessage, setVisibleMessage] = useState(false);
    const [openService, setOpenService] = useState(false);
    // get defaultURL from query params with react-router-dom
    const [
        params,
        setParams,
    ] = useSearchParams();
    
    const inputRef = useRef(null);
    const {
        width,
        height,
    } = useWindowDimensions();
        const activeAccount = convertAddress(
        wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, 
        "XNO"
    );
    
    const { data: services, isLoading } = useSWR('/services', fetcherMessagesNoAuth);
    
    if (isLoading) {
        return <div><DotLoading /></div>
    }
    
 
    WebviewOverlay.handleNavigation(async (data) => {
        console.log('navigationHandler', JSON.stringify(data));
        setOpenService({...openService, link: data.url});
    })
    const handleServiceClick = async (service) => {
        let url = service.link;
        if (service?.includeAddress) {
            url = url + "?address=" + activeAccount;
        }
        
        if (Capacitor.isNativePlatform()) {
            Toast.show({
                icon: "loading",
            })

            setOpenService(service);
            const element = document.getElementById('webview-overlay') as HTMLElement;
            element.style.zIndex = "1000";
            // WebviewOverlay.toggleFullscreen();
            await WebviewOverlay.open({
                url: service.link,
                element: element,
            })

        } else {
            window.open(url, '_blank');
        }
    };
    
    useEffect(() => {
        if (defaultURL && services) {
            let domain = new URL(defaultURL).hostname;
            let service = services.find(service => new URL(service.link).hostname === domain);
            if (service) {
                handleServiceClick({...service, link: defaultURL});
            }
        }
    }, [services]);
    return (
        <div className="">
            {!defaultURL && <>
            
            <NavBar
                className="app-navbar"
                backArrow={false}>
                Discover
            </NavBar>
            
            
                <List>
                    {services.map((service, index) => (
                        <List.Item
                            key={index}
                            prefix={<img src={service.favicon} alt={service.name} style={{width: 40}} />}
                            onClick={() => handleServiceClick(service)}
                            description={service.description}
                        >
                            {service.name}
                        </List.Item>
                    ))}
                </List>
                </>
            }   
                <div 
            id="webview-overlay" 
            onClick={() => {
                // handleServiceClick({link: currentUrl});
            }}
            style={{
                width: '100%',
                height: 'calc(100vh - 40px)',
                position: 'fixed',
                zIndex: -1,
                bottom: 0,
                left: 0,
            }}
        >
           
        {
            openService && 
        
        <div  style={{
                position: 'fixed',
                top: 'env(safe-area-inset-top)',
                left: 0,
                right: 0,
                zIndex: 1000,
                // height: 40,
                padding: 8,
                backgroundColor: 'rgba(245, 245, 245)',
                width: "100%",
                textAlign: "center",
                color: 'var(--adm-color-background)'
            }}>
                {openService?.name}
        <div  style={{
                position: 'fixed',
                top: 'env(safe-area-inset-top)',
                right: 8,
                zIndex: 1000,
                padding: 8,
                height: 40,
                // backgroundColor: 'gray',
            }}>
                <div style={{display: 'flex',  backgroundColor: '#fff', padding: 6, borderRadius: 24, color: 'var(--adm-color-background)'}}>
                 <div
        style={{}}
           size="middle"
           shape="default"
           onClick={async() => {
            // const script = `
            // ${extractMetadata.toString()}
            // extractMetadata();
            // `;
            // const pageMetaOg = await WebviewOverlay.evaluateJavaScript(script);
            // // setShareContent(JSON.parse(pageMetaOg));
            // setShareContent(pageMetaOg);
            setVisible(true);
            await WebviewOverlay.toggleSnapshot(true);
             
           }}
           >
               <AiOutlineShareAlt />
           </div> 
           <Divider direction="vertical" style={{color: "var(--adm-color-text-secondary)", borderColor: "var(--adm-color-text-secondary)", opacity: 0.3}} />
        <div
           
            size="middle"
            onClick={async() => {
                setOpenService(null);
                // await WebviewOverlay.toggleSnapshot(false);
                await WebviewOverlay.close();
                const element = document.getElementById('webview-overlay') as HTMLElement;
                element.style.zIndex = "-1";
                element.style.backgroundImage = "none";
            }}
            >
                <FaRegCircleDot />
            </div></div>
            </div>
            </div>
            }
            </div>  
<Popup
destroyOnClose
            bodyStyle={{ }}
                visible={visible}
                onClose={async () => {
                    await WebviewOverlay.toggleSnapshot(false);
                    setVisible(false)
                }}
                closeOnMaskClick
                
            >
                <div 

className="text-xl  text-center p-2">
    Share to Chat
</div>
<div style={{height: '300px' , overflow: 'scroll'}}>
                <ChatListItems
                onClick={(chat) => {
                    console.log(chat)
                    setVisibleMessage(true)
                    setSelectedChat(chat)
                }}
                
                chats={chats}
                
                /></div>
            </Popup>
            <Popup
            bodyStyle={{ height: '300px' , overflow: 'scroll'}}
                visible={visibleMessage}
                onClose={() => setVisibleMessage(false)}
                closeOnMaskClick
                destroyOnClose
            >
                
                <div>
                    <div className="p-2">
                        Send to
                    </div>
                    <List style={{marginBottom: 8}}>
                    <ItemChat chat={selectedChat} onClick={() => {}} /></List>
                    <ChatInputMessage 
                    onSent={async () => {
                        Toast.show({
                            icon: "success",
                            content: "Sent",
                            duration: 1000
                        })
                        await WebviewOverlay.toggleSnapshot(false);
                        setVisibleMessage(false)
                        setVisible(false)
                        
                    }}
                        defaultNewMessage={openService?.link}
                        defaultChatId={selectedChat?.id}
                        messageInputRef={inputRef}
                    />
                    <Space style={{gap: 32, width: "100%"}} align="center" className="p-4" justify="center">
                    <Button onClick={() => setVisibleMessage(false)} color="default">
                        Cancel
                    </Button>
                    <Button 
                    onClick={(e) => {
                        inputRef?.send(e, true)
                    }}
                    color="primary">
                        Send
                    </Button>
                    </Space>
                </div>
            </Popup>
        </div>

    );
};