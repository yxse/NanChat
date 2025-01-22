import { Capacitor } from "@capacitor/core";
import { DotLoading, List, NavBar } from "antd-mobile";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
import { fetcherMessagesNoAuth } from "../../messaging/fetcher";
import useSWR from "swr";
import { useContext } from "react";
import { WalletContext } from "../../Popup";
import { convertAddress } from "../../../utils/format";
export const Discover: React.FC = () => {
    const {wallet} = useContext(WalletContext);
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");
    const {data: services, isLoading} = useSWR('/services', fetcherMessagesNoAuth);

    if (isLoading) {
        return <div ><DotLoading /></div>
    }

    return (
        <div className="">
            <NavBar
                className="app-navbar "
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
                            // prefix={service.image}
                            prefix={<img src={service.favicon} alt={service.name} style={{width: 40}} />}
                            onClick={async () => {
                                let url = service.link
                                if (service?.includeAddress) {
                                    url = url + "?address=" + activeAccount
                                }
                                if (Capacitor.isNativePlatform()) {
                                    //use external browser because otherwise can't resume the web state after deeplink (auth or send)
                                    // eventually should use a whole embedded browser to handle multiple tabs
                                    await InAppBrowser.openInExternalBrowser({url: url})
                                    
                                }
                                else{
                                    window.open(url, '_blank')
                                }
                            }}
                            description={service.description}
                        >
                           
                            {service.name}
                        </List.Item>
                    ))}
                </List>
            </div>
            <a href="ana:ana_1y1pfogf7hfgunyr46ii9axo1biaeu9nmc6kmdux7ocas9nzw3dqmty4nxu1?amount=74531104000000000000000000000">
                send ana
            </a>
            <a href="nano:nano_1y1pfogf7hfgunyr46ii9axo1biaeu9nmc6kmdux7ocas9nzw3dqmty4nxu1?amount=74531104000000000000000000000">
                send nanoazeaze
            </a>
        </div>
    );

}