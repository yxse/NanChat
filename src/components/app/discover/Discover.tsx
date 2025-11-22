import { Capacitor, registerPlugin } from "@capacitor/core";
import { DotLoading, List, NavBar, Popup, Button, Space, Toast, CheckList, Ellipsis, Divider, Card, SearchBar, Badge, Form, Input } from "antd-mobile";
import { fetcherMessages, fetcherMessagesNoAuth } from "../../messaging/fetcher";
import useSWR from "swr";
import { useContext, useEffect, useRef, useState } from "react";
import { WalletContext } from "../../useWallet";
import { useWallet } from "../../useWallet";
import { convertAddress } from "../../../utils/convertAddress";
import { InAppBrowser } from "@capacitor/inappbrowser";

import { WebviewOverlay, IWebviewOverlayPlugin,   } from '@teamhive/capacitor-webview-overlay';
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import { extractMetadata } from "../../messaging/utils";
import ChatInputMessage from "../../messaging/components/ChatInputMessage";
import { AccountListItems } from "../../messaging/components/NewChatPopup";
import { CheckCircleFill, DeleteOutline, GlobalOutline } from "antd-mobile-icons";
import { MdOutlineCircle } from "react-icons/md";
import { ChatAvatar } from "../../messaging/components/ChatList";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AiOutlineShareAlt } from "react-icons/ai";
import { FaRegCircleDot } from "react-icons/fa6";
import { MetadataCard } from "../../messaging/components/antd-mobile-metadata-card";
import { useChats } from "../../messaging/hooks/use-chats";
import { useTranslation } from "react-i18next";
import { useEmit } from "../../messaging/components/EventContext";
import { ChatListItems } from "../../messaging/components/ChatListItems";
import { ItemChat } from "../../messaging/components/ItemChat";
import { restoreData, setData } from "../../../services/database.service";
import { showActionSheet } from "antd-mobile/es/components/action-sheet/action-sheet";
import { Keyboard } from "@capacitor/keyboard";
import { useHideNavbarOnMobile } from "../../../hooks/use-hide-navbar";
import { createPortal } from "react-dom";
let opened = false
const HistoryApps = ({history, handleServiceClick, setHistory}) => {
    if (!history || history.length === 0) return null;
    return <List mode="card">
                    <List.Item extra={
                        <Button size="mini" onClick={() => {
                            showActionSheet({
                                closeOnAction: true,
                                actions: [
                                    { text: 'Clear History', key: 'clear', danger: true, icon: <DeleteOutline /> },
                                    { text: 'Cancel', key: 'cancel' },
                                ],
                                onAction: async (action) => {
                                    if (action.key === 'clear') {
                                        await setData('discoverHistory', []);
                                        setHistory([]);
                                    }
                        }})
                        }}
                        ><DeleteOutline />
                        </Button>
                    } >
                        History
                    </List.Item>
                    {/* blank item to show a divider border */}
                    <List.Item ></List.Item>

                    <div className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, 80px)',
          justifyContent: 'start',
          gap: 12
        }}>
                    {history.map((service, index) => (
                        <div
                        style={{cursor: "pointer"}}
                        className=""
                            key={index}
                            onClick={() => handleServiceClick({link: service.url})}
                        >
                            
                                <img src={
                                    // service.metaData?.favicon 
                                    "https://www.google.com/s2/favicons?domain=" + service.hostname + "&sz=256"
                                } alt={service.name} style={{
                                    width: 42, 
                                    // width: 42, 
                                    borderRadius: 8,
                                    marginRight: "auto", marginLeft: "auto"}} />
                            <div className="mt-2 mb-6 text-xs" style={{
                                 display: '-webkit-box',
                                 WebkitLineClamp: 2,
                                 lineHeight: '1.2em',
                                 WebkitBoxOrient: 'vertical',
                                 overflow: 'hidden',
                                 textOverflow: 'ellipsis',
                                 textAlign: "center", 
                                 color: "var(--adm-color-text-secondary)"
                                 }}>
                            {service.metaData?.title}
                            </div>
                        </div>
                    ))}
                    </div>
                </List>
}

function filterServices(services, searchText) {
    if (!searchText || searchText.length === 0) {
        return services;
    }
    return services.filter((service) => {
        return service.name.toLowerCase().includes(searchText.toLowerCase()) || 
        (service.description && service.description.toLowerCase().includes(searchText.toLowerCase())) ||
        (service.cat && service.cat.toLowerCase().includes(searchText.toLowerCase())) ||
        (service.link && service.link.toLowerCase().includes(searchText.toLowerCase()))
        
    });
}

export const Discover: React.FC = ({defaultURL, onClose, openUrl}) => {
    const { t } = useTranslation();
    const { activeAccount } = useWallet()
    const {chats} = useChats();
    const [shareContent, setShareContent] = useState("nothing");
    const [selectedChat, setSelectedChat] = useState(null);
    const [visible, setVisible] = useState(false);
    const [visibleMessage, setVisibleMessage] = useState(false);
    const [openService, setOpenService] = useState(null);
    const [history, setHistory] = useState([]);
    const [searchText, setSearchText] = useState("");
    const emit = useEmit()
    // get defaultURL from query params with react-router-dom
    const [
        params,
        setParams,
    ] = useSearchParams();
    const navigate = useNavigate();

    const inputRef = useRef(null);
    
    const { data: services, isLoading } = useSWR('/services?platform=' + Capacitor.getPlatform(), fetcherMessagesNoAuth);

     async function saveHistory(url, metaData) {
        let history = await restoreData('discoverHistory') || [];
        let newHistory = { url, timestamp: Date.now(), hostname: (new URL(url)).hostname, metaData: JSON.parse(metaData) };
        // remove duplicates hostname
        history = history.filter((item) => item.hostname !== newHistory.hostname);
        history.unshift(newHistory);
        if (history.length > 8) {
            history = history.slice(0, 8);
        }
        await setData('discoverHistory', history);
        setHistory(history);
    }

    // Group services by category
    const groupedServices = filterServices(services, searchText)?.reduce((acc, service) => {
        const category = service.cat || 'Other'; // Default to 'Other' if no category
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(service);
        return acc;
    }, {});

        
    useEffect(() => {
        if (defaultURL && services) { // open url from message
            let domain = new URL(defaultURL).hostname;
            let service = services.find(service => new URL(service.link).hostname === domain); // verifiy that the url is an existing service
            if (service && opened == false) {
                opened = true; // prevent multiple opens
                handleServiceClick({...service, link: defaultURL});
                // setOpenService(service);
            }
        }
    }, [services, defaultURL]);

    useEffect(() => {
        const loadHistory = async () => {
            let history = await restoreData('discoverHistory') || [];
            setHistory(history);
        }
        try {
            loadHistory();
        } catch (error) {
            console.log("Cannot load history:", error);
        }
    }, []);

   useEffect(() => {
    
    return () => {
    };
}, []);
    if (isLoading) {
        return <div><DotLoading /></div>
    }
    
 
WebviewOverlay.onPageLoaded(() => {
    Toast.clear()
});

    WebviewOverlay.handleNavigation((event) => {
        if (event.url === ""){
            Toast.show({
                content: "Invalid URL",
                icon: 'fail',
                duration: 2000
            })
            closeNanoApp(false)
            return;
        }
        console.log('navigationHandler', JSON.stringify(event));
        if (event.url.startsWith('https://nanchat.com/?uri=')){
            emit('open-url', event.url);
            event.complete(false) // should prevent the page to open in the inappbroswer
            return
        }
        else if (event.url.startsWith('https://nanchat.com/')){
            closeNanoApp()
            navigate(event.url.replace('https://nanchat.com', ''))
            return
        }
        setOpenService({...openService, link: event.url});
        if (Capacitor.getPlatform() === "ios") {
            // or else webview not opening when navigationhandler is used
            if (event.newWindow){
                event.complete(false);
                window.open(event.url);
            }
            else{
                event.complete(true);
            }
        }
    })
    const handleServiceClick = async (service) => {
        console.log("open: ", service);
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
            element.style.backgroundColor = "white"
            // WebviewOverlay.toggleFullscreen();
            await WebviewOverlay.open({
                url: service.link,
                element: element,
            })

        } else {
            window.open(url, '_blank');
        }
    };
    async function closeNanoApp(save = true) {
        opened = false;
        let metaData = "{}";
        try {
            metaData = await WebviewOverlay.evaluateJavaScript(`(${extractMetadata.toString()})()`);
        } catch (error) {
            console.error("Error extracting metadata:", error);
        }
        // Toast.show({
        //     content: "meta: " + JSON.stringify(metaData),
        //     duration: 7000,
        // })
        if (save){
            saveHistory(openService?.link, metaData);
        }
        setOpenService(null);
        // await WebviewOverlay.toggleSnapshot(false);
        const element = document.getElementById('webview-overlay') as HTMLElement;
        element.style.zIndex = "-1";
        element.style.backgroundImage = "none";
        element.style.backgroundColor = "transparent"
        try {
            WebviewOverlay.close();
        } catch (error) {
            console.error("Error closing webview overlay:", error);            
        }
        if (onClose) {
            onClose();
        }
    }
    return (
        <div className="">
            {!defaultURL && <>
            
            <NavBar
                className="app-navbar"
                backArrow={false}>
                {t('discover')}
            </NavBar>
            <SearchBar
            clearable
            style={{margin: 12}}
            placeholder={t('searchOrEnterUrl')}
            onChange={(val) => {
                setSearchText(val);  
            }}
            onSearch={() => {
                // open if valid url
                try {
                    let url = searchText.trim();
                    if (!url.startsWith('http')) {
                        url = 'https://' + url;
                    }
                    new URL(url); // test if valid url
                    handleServiceClick({link: url});
                } catch (error) {
                    console.error("Error opening URL:", error);
                }
            }}
            />
            {
                searchText == "" && // todo filter history too
               <HistoryApps history={history} handleServiceClick={handleServiceClick} setHistory={setHistory} />
            }
                <List mode="card" header={
                    searchText.length > 0 ? t('searchResults') : t('discoverNanoApps')
                }></List>
{Object.entries(groupedServices || {}).map(([category, categoryServices]) => (
    <div key={category} style={{ marginBottom: 8 }}>
        <List mode="card">
            <List.Item>
                {category}
            </List.Item>
            {categoryServices.map((service, index) => (
                <List.Item
                arrowIcon={false}
                    key={index}
                    prefix={<img 
                        src={service.favicon}
                         alt={service.name} style={{width: 40}} />}
                    onClick={() => handleServiceClick(service)}
                    description={service.description}
                >
                    {service.name} {service?.featured && <Badge content="Featured" style={{ backgroundColor: 'var(--adm-color-primary)', marginLeft: 4 }} />} 
                </List.Item>
            ))}
        </List>
    </div>
))}

{
    searchText.length > 0 && <List mode="card">
        <List.Item
                arrowIcon={false}
                    prefix={<GlobalOutline  fontSize={24} />}
                    onClick={() => handleServiceClick({link: searchText.startsWith('http') ? searchText : 'https://' + searchText, name: searchText})}
                    description={"Go to " + (searchText.startsWith('http') ? searchText : 'https://' + searchText)}>
                    {searchText}
                </List.Item>
    </List>
}
<div style={{marginBottom: 32}}>
    &nbsp;
</div>
                {/* <List mode="card">
                    {services?.map((service, index) => (
                        <List.Item
                            key={index}
                            prefix={<img src={service.favicon} alt={service.name} style={{width: 40}} />}
                            onClick={() => handleServiceClick(service)}
                            description={service.description}
                        >
                            {service.name}
                        </List.Item>
                    ))}
                </List> */}
                </>
            }   
              
           
        {
            openService && 
       // we use createPortal otherwise will be bugged when opening from virtualized messages
       createPortal(<div  style={{
                position: 'fixed',
                top: 'var(--safe-area-inset-top)',
                left: 0,
                right: 0,
                zIndex: 100000,
                // height: 40,
                padding: 8,
                backgroundColor: 'rgba(245, 245, 245)',
                width: "100%",
                textAlign: "center",
                color: '#000',
            }}>
               {openService?.name || new URL(openService?.link).hostname || "​"}
        <div  style={{
                position: 'fixed',
                top: 'var(--safe-area-inset-top)',
                right: 8,
                padding: 8,
                height: 40,
                // backgroundColor: 'gray',
            }}>
                <div style={{display: 'flex',  backgroundColor: '#fff', padding: 6, borderRadius: 24, color: '#000'}}>
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
           <Divider direction="vertical" style={{color: "#000", borderColor: "#000", opacity: 0.3}} />
        <div
           
            size="middle"
            onClick={closeNanoApp}
            >
                <FaRegCircleDot />
            </div></div>
            </div>
            </div>
        , document.body)
            }
              {
                createPortal(<div 
            id="webview-overlay" 
            onClick={() => {
                // handleServiceClick({link: currentUrl});
            }}
            style={{
                width: '100%',
                height: 'calc(100vh - 40px - var(--safe-area-inset-top))',
                // height: '400px',
                position: 'fixed',
                zIndex: -1,
                bottom: 'calc(-1 * var(--android-inset-top, 0px))',
                left: 0,
                // backgroundColor: "red",
            }}
        ></div>, document.body)}  
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
            bodyStyle={{ height: '600px' , overflow: 'scroll'}}
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
                    <div 
                    style={{border: '1px solid var(--adm-color-border)', maxWidth: 300, padding: 8, marginLeft: "auto", marginRight: "auto", borderRadius: 8}}>
                        <MetadataCard message={openService?.link} />
                    </div>
                    <ChatInputMessage 
                    hideInput
                    onSent={async () => {
                        Toast.show({
                            icon: "success",
                            content: "Sent",
                            duration: 1000
                        })
                        await new Promise((resolve) => setTimeout(resolve, 500)); // wait for the toast to show
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