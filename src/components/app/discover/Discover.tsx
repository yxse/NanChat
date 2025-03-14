import { Capacitor, registerPlugin } from "@capacitor/core";
import { DotLoading, List, NavBar, Popup, Button, Space, Toast } from "antd-mobile";
import { fetcherMessagesNoAuth } from "../../messaging/fetcher";
import useSWR from "swr";
import { useContext, useState } from "react";
import { WalletContext } from "../../Popup";
import { convertAddress } from "../../../utils/format";
import { InAppBrowser } from "@capacitor/inappbrowser";

import { WebviewOverlay, IWebviewOverlayPlugin,   } from '@teamhive/capacitor-webview-overlay';
import { useWindowDimensions } from "../../../hooks/use-windows-dimensions";
import MetadataCard from "../../messaging/components/antd-mobile-metadata-card";
import { extractMetadata } from "../../messaging/utils";
// const WebviewOverlayPlugin = registerPlugin<IWebviewOverlayPlugin>('WebviewOverlayPlugin');


export const Discover: React.FC = () => {
    const { wallet } = useContext(WalletContext);
    const [shareContent, setShareContent] = useState("nothing");
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
    
    const handleServiceClick = async (service) => {
        let url = service.link;
        if (service?.includeAddress) {
            url = url + "?address=" + activeAccount;
        }
        
        if (Capacitor.isNativePlatform()) {
            const element = document.getElementById('webview-overlay') as HTMLElement;
            element.style.zIndex = "1000";
            // WebviewOverlay.toggleFullscreen();
            WebviewOverlay.open({
                url: service.link,
                element: element,
            })

        } else {
            window.open(url, '_blank');
        }
    };
    
    return (
        <div className="">
            <NavBar
                className="app-navbar"
                backArrow={false}>
                Discover
            </NavBar>
            
            <div
                style={{
                    height: 'calc(100vh - 200px)',
                }}
            >
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
               
                <div 
            id="webview-overlay" 
            onClick={() => {
                // handleServiceClick({link: currentUrl});
            }}
            style={{
                width: '100%',
                height: '100%',
                position: 'fixed',
                zIndex: -1,
                top: 100,
                left: 0,
            }}
        >
           
        </div>
        <div  style={{
                float: 'right',
                position: 'fixed',
                top: 50,
                right: 0,
                zIndex: 1000,

            }}>
                 <Button
        style={{marginRight: 8}}
           size="small"
           onClick={async() => {
            const script = `
            ${extractMetadata.toString()}
            extractMetadata();
            `;
            const pageMetaOg = await WebviewOverlay.evaluateJavaScript(script);
            setShareContent(JSON.parse(pageMetaOg));
             
           }}
           >
               Share
           </Button>
        <Button
           
            size="small"
            onClick={async() => {
                await WebviewOverlay.toggleSnapshot(false);
                WebviewOverlay.close();
                const element = document.getElementById('webview-overlay') as HTMLElement;
                element.style.zIndex = "-1";
                element.style.backgroundImage = "none";
            }}
            >
                Close
            </Button>
            </div>
            </div>  
            {/* <MetadataCard title={shareContent?.title} description={shareContent?.description} image={shareContent?.image} url={shareContent?.url} />
            {JSON.stringify(shareContent)} */}
        </div>

    );
};