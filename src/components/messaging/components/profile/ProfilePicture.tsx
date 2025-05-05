import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading, Image, ImageViewer } from "antd-mobile";
import { accountIconUrl } from "../../../app/Home";
import { NoAvatar } from "../icons/NoAvatar";

const ProfilePicture = ({ address, width=40, borderRadius=8, clickable }) => {
    const { data, isLoading } = useSWR(address, fetcherAccount, {
            revalidateIfStale: false,
            revalidateOnFocus: false,
    });
    let src = data?.profilePicture?.url
    let icon
    if (src == null) {
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
            style={{ borderRadius: borderRadius, objectFit: "cover", width: width, height: width }}
            src={src} width={width} height={width}
            alt="pfp" 
             /></div>
    }
    if (isLoading) return null
    return (
        icon   
    )

}

export default ProfilePicture;