import { Capacitor } from "@capacitor/core";
import { List, NavBar } from "antd-mobile";
import { DefaultSystemBrowserOptions, InAppBrowser } from "@capacitor/inappbrowser";
export const Discover: React.FC = () => {

    const services = [
        {
            name: 'Art',
            description: 'Buy, sell & collect NanFTs',
            image: '🎨',
            favicon: 'https://nanswap.com/faviconArt.png',
            link: 'https://nanswap.com/art'
        },
        {
            name: 'Shop',
            description: 'Buy gift cards from over 5,000 brands',
            image: '🛍️',
            link: 'https://nanswap.com/shop',
            favicon: 'https://bucket.nanwallet.com/logo/nanshop.png',
        },
        {
            name: 'Nano-GPT',
            description: 'Use state-of-the-art AI models',
            image: '֎ ',
            link: 'https://nano-gpt.com',
            favicon: 'https://nano-gpt.com/logo.png',
        },
        {
            name: 'Nanogotchi',
            description: 'Grow your nanogotchi',
            image: '🔎',
            link: 'https://nanogotchi.com/',
            favicon: 'https://nanogotchi.com/favicon.ico',
        },
    ]

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