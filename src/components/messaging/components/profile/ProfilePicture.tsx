import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading, Image, ImageViewer } from "antd-mobile";
import { accountIconUrl } from "../../../app/Home";

const ProfilePicture = ({ address, width=42, borderRadius=8, clickable }) => {
    const { data, isLoading } = useSWR(address, fetcherAccount, {
            revalidateIfStale: false,
            revalidateOnFocus: false,
    });
    const src = data?.profilePicture?.url || accountIconUrl(address);
    if (isLoading) return null
    return (
        <img
        onClick={() => {
            if (clickable){
                ImageViewer.show({
                    image: src,
                })
            }}}
            style={{ borderRadius: borderRadius }}
            src={src} width={width} alt="pfp"  />
    )

}

export default ProfilePicture;