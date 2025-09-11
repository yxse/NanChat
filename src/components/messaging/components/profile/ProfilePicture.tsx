import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading, Image, ImageViewer } from "antd-mobile";
import { accountIconUrl } from "../../../app/Home";
import { NoAvatar } from "../icons/NoAvatar";
import { useChats } from "../../hooks/use-chats";

const getDevicePixelRatioCeiled = () => Math.ceil(window.devicePixelRatio || 1);
const imgProxy = (src, width) => `https://i.nanwallet.com/unsafe/rs::${width}/dpr:${getDevicePixelRatioCeiled()}/plain/${encodeURI(src)}` 

const ProfilePicture = ({ address, width=40, borderRadius=8, clickable, src = null }) => {
    let chats  = []
    try {
        const {chats: allChats} = useChats();
        chats = allChats
    } catch (error) { // it can fail if loaded in modal, like in Group qr code
        console.log("cannot load chats in profilepicture", error)
    }
   
    let isLoading = false
    if (src == null){
         for (const chat of chats) {
            const participant = chat.participants.find(p => p._id === address);
            if (participant) {
                src = participant?.profilePicture?.url;
            break;
            }
        }
        if (src == null){
            const { data, isLoading: isLoadingData } = useSWR(address, fetcherAccount, {
                revalidateIfStale: false,
                revalidateOnFocus: false,
                revalidateOnReconnect: false,
            });
            src = data?.profilePicture?.url
            isLoading = isLoadingData
        }
    }
    let icon
    if (src == null || src == false) {
        icon = <NoAvatar width={width} height={width} />
    }
    else{
        icon =  <div style={{width: width, height: width}}>
        <img
        onClick={() => {
            if (clickable){
                ImageViewer.show({
                    image: src,
                })
            }}}
            loading="lazy"
            style={{ borderRadius: borderRadius, objectFit: "cover", width: width, height: width }}
            src={imgProxy(src, width)} width={width} height={width}
            alt="pfp" 
             /></div>
    }
    if (isLoading) return null
    return (
        icon   
    )

}

export default ProfilePicture;