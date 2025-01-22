import { Capacitor } from "@capacitor/core";
import { DotLoading, List, NavBar } from "antd-mobile";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
import { fetcherMessagesNoAuth } from "../../messaging/fetcher";
import useSWR from "swr";
export const Discover: React.FC = () => {

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
                                if (Capacitor.isNativePlatform()) {
                                    await InAppBrowser.openInSystemBrowser({url: service.link, options: DefaultSystemBrowserOptions})
                                    
                                }
                                else{
                                    window.open(service.link, '_blank')
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