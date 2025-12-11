import { useState } from "react";
import { ArtImages } from "./Art";
import { Discover } from "./discover/Discover";


export const WrapperArt = ({ openInApp, onImageClick }) => {
    const [openUrl, setOpenUrl] = useState(false);

    return <>
        <ArtImages onImageClick={({ url }) => {
            console.log(url);
            if (openInApp && url.startsWith('https://nanswap.com/art/assets/')) {
                setOpenUrl(url);
            }
            else if (url === 'https://nanswap.com/art') { // explore button always opens in app
                setOpenUrl('https://nanswap.com/art');
            }
            else {
                if (onImageClick) {
                    onImageClick({ url });
                }
            }
        }} />

        {openUrl && <Discover defaultURL={openUrl} onClose={() => {
            setOpenUrl(false);
        }} />}
    </>;
};
