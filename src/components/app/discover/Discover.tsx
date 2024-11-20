import { List } from "antd-mobile";

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
            <div className="text-xl text-center my-4">Discover</div>
            <div>
                <List>
                    {services.map((service, index) => (
                        <List.Item
                            key={index}
                            prefix={service.image}
                            onClick={() => window.open(service.link, '_blank')}
                            // description={service.description}
                        >
                            {service.name}
                        </List.Item>
                    ))}
                </List>
            </div>
        </div>
    );

}