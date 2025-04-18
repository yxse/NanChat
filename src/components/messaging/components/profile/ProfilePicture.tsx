import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading, Image, ImageViewer } from "antd-mobile";
import { accountIconUrl } from "../../../app/Home";
import { NoAvatar } from "../icons/NoAvatar";

const ProfilePicture = ({ address, width=42, borderRadius=8, clickable }) => {
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
        icon =  <img
        onClick={() => {
            if (clickable){
                ImageViewer.show({
                    image: src,
                })
            }}}
            style={{ borderRadius: borderRadius }}
            src={src} width={width} alt="pfp"  />
    }
    if (isLoading) return null
    return (
        icon   
    )

}

export default ProfilePicture;