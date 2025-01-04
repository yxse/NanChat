import { Capacitor } from "@capacitor/core";
import { List } from "antd-mobile";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
export const Discover: React.FC = () => {

    const services = [
        {
            name: 'Art',
            description: 'Buy, sell & collect NanFTs',
            image: '🎨',
            link: 'https://nanswap.com/art'
        },
        {
            name: 'Shop',
            description: 'Buy gift cards.',
            image: '🛍️',
            link: 'https://nanswap.com/shop'
        },
        {
            name: 'AI',
            description: 'Use state-of-the-art AI models',
            image: '֎ ',
            link: 'https://nano-gpt.com'
        },
        {
            name: 'Explorer',
            description: 'Explore block-lattices', 
            image: '🔎',
            link: 'https://nanexplorer.com'
        },
    ]

    return (
        <div className="">
            <div 
            style={{
               position: 'sticky',
                top: 0,
                zIndex: 1,
                backgroundColor: 'black',
            }}
            className="text-xl text-center my-4">Discover</div>
            <div
            style={{
                height: 'calc(100vh - 200px)',
                }}
            >
                <List>
                    {services.map((service, index) => (
                        <List.Item
                            key={index}
                            prefix={service.image}
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
                send nano
            </a>
        </div>
    );

}