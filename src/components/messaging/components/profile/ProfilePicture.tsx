import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading, Image, ImageViewer } from "antd-mobile";
import { accountIconUrl } from "../../../app/Home";
import { NoAvatar } from "../icons/NoAvatar";
import { useChats } from "../../hooks/use-chats";

const getDevicePixelRatioCeiled = () => Math.ceil(window.devicePixelRatio || 1);
const imgProxy = (src, width) => `https://i.nanwallet.com/unsafe/rs::${width}/dpr:${getDevicePixelRatioCeiled()}/plain/${encodeURI(src)}` 

const ProfilePicture = ({ address, width=40, borderRadius=8, clickable, src = null }) => {
    // Always call hooks at the top level
    let chats = []
    try {
        const { chats: allChats } = useChats();
        chats = allChats
    } catch (error) { 
        console.log("cannot load chats in profilepicture", error)
    }

    // Determine if we need to fetch data before calling useSWR
    const shouldFetchData = src == null && !chats.some(chat => 
        chat.participants.find(p => p._id === address)?.profilePicture?.url
    );

    // Always call useSWR, but conditionally enable it
    const { data, isLoading: isLoadingData } = useSWR(
        shouldFetchData ? address : null, // Only fetch when needed
        fetcherAccount, 
        {
            revalidateIfStale: false,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    // Determine the final src value
    let finalSrc = src;
    let isLoading = false;

    if (finalSrc == null) {
        // First check chats for the profile picture
        for (const chat of chats) {
            const participant = chat.participants.find(p => p._id === address);
            if (participant?.profilePicture?.url) {
                finalSrc = participant.profilePicture.url;
                break;
            }
        }
        
        // If still null, use SWR data
        if (finalSrc == null) {
            finalSrc = data?.profilePicture?.url;
            isLoading = isLoadingData;
        }
    }

    // Render logic
    let icon;
    if (finalSrc == null || finalSrc == false) {
        icon = <NoAvatar width={width} height={width} borderRadius={borderRadius} />
    } else {
        icon = (
            <div style={{width: width, height: width}}>
                <img
                    onClick={() => {
                        if (clickable) {
                            ImageViewer.show({
                                image: finalSrc,
                            })
                        }
                    }}
                    loading="lazy"
                    style={{ 
                        borderRadius: borderRadius, 
                        objectFit: "cover", 
                        width: width, 
                        height: width 
                    }}
                    src={imgProxy(finalSrc, width)} 
                    width={width} 
                    height={width}
                    alt="pfp" 
                />
            </div>
        )
    }

    if (isLoading) return null;
    
    return icon;
}
export default ProfilePicture;