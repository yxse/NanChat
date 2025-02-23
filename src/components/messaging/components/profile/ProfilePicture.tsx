import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading } from "antd-mobile";
import { accountIconUrl } from "../../../app/Home";

const ProfilePicture = ({ address, width=48, borderRadius=8 }) => {
    const { data, isLoading } = useSWR(address, fetcherAccount, {
        dedupingInterval: 60000,
        fallbackData: { profilePicture: { url: accountIconUrl(address) } }
    });
    if (isLoading) return null
    return (
        <img
            style={{ borderRadius: borderRadius }}
            src={data?.profilePicture?.url} width={width} alt="pfp"  />
    )
}

export default ProfilePicture;