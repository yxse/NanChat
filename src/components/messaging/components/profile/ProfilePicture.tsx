import { memo, useMemo } from "react";
import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { ImageViewer } from "antd-mobile";
import { NoAvatar } from "../icons/NoAvatar";
import { useChats } from "../../hooks/use-chats";

const getDevicePixelRatioCeiled = () => Math.ceil(window.devicePixelRatio || 1);
const imgProxy = (src: string, width: number) =>
    `https://i.nanwallet.com/unsafe/rs::${width}/dpr:${getDevicePixelRatioCeiled()}/plain/${encodeURI(src)}`;

// Build an address -> profilePicture URL lookup lazily, once per `chats`
// array reference, and share it across every ProfilePicture instance.
// WeakMap lets the old map be GC'd when SWR swaps in a new chats array.
const chatsPfpCache: WeakMap<object, Map<string, string>> = new WeakMap();

function getPfpMap(chats: any[]): Map<string, string> {
    let map = chatsPfpCache.get(chats);
    if (map) return map;
    map = new Map<string, string>();
    for (let i = 0; i < chats.length; i++) {
        const parts = chats[i]?.participants;
        if (!parts) continue;
        for (let j = 0; j < parts.length; j++) {
            const p = parts[j];
            const url = p?.profilePicture?.url;
            if (url && p?._id && !map.has(p._id)) map.set(p._id, url);
        }
    }
    chatsPfpCache.set(chats, map);
    return map;
}

type ProfilePictureProps = {
    address: string;
    width?: number;
    borderRadius?: number;
    clickable?: boolean;
    src?: string | null;
};

const ProfilePicture = ({ address, width = 40, borderRadius = 8, clickable = false, src = null }: ProfilePictureProps) => {
    let chats: any[] = [];
    try {
        const { chats: allChats } = useChats();
        if (Array.isArray(allChats)) chats = allChats;
    } catch (error) {
        console.log("cannot load chats in profilepicture", error);
    }

    // O(1) lookup into the shared map; recomputes only when chats ref or address changes.
    const pfpFromChats = useMemo(() => {
        if (src != null || !address || chats.length === 0) return null;
        return getPfpMap(chats).get(address) ?? null;
    }, [chats, address, src]);

    const shouldFetchData = src == null && pfpFromChats == null;

    const { data, isLoading: isLoadingData } = useSWR(
        shouldFetchData ? address : null,
        fetcherAccount,
        {
            revalidateIfStale: false,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const finalSrc = src ?? pfpFromChats ?? data?.profilePicture?.url ?? null;

    if (shouldFetchData && isLoadingData) return null;

    if (!finalSrc) {
        return <NoAvatar width={width as any} height={width as any} borderRadius={borderRadius} />;
    }

    return (
        <div style={{ width, height: width }}>
            <img
                onClick={clickable ? () => ImageViewer.show({ image: finalSrc }) : undefined}
                loading="lazy"
                style={{
                    borderRadius,
                    objectFit: "cover",
                    width,
                    height: width,
                }}
                src={imgProxy(finalSrc, width)}
                width={width}
                height={width}
                alt="pfp"
            />
        </div>
    );
};

export default memo(ProfilePicture);