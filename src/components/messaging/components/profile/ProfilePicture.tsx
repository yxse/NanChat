import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading } from "antd-mobile";
import { accountIconUrl } from "../../../app/Home";

const ProfilePicture = ({ address, width=42, borderRadius=8 }) => {
    const { data, isLoading } = useSWR(address, fetcherAccount, {
            revalidateIfStale: false,
            revalidateOnFocus: false,
    });
    if (isLoading) return null
    return (
        <img
            style={{ borderRadius: borderRadius }}
            src={data?.profilePicture?.url || accountIconUrl(address)} width={width} alt="pfp"  />
    )
}

export default ProfilePicture;