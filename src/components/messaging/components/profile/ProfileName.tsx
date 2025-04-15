import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading } from "antd-mobile";
import { RiVerifiedBadgeFill } from "react-icons/ri";

const ProfileName = ({ address, fallback, includeVerified = true }) => {
    const { data, isLoading } = useSWR(address, fetcherAccount, {
        // revalidateIfStale: false,
        // revalidateOnFocus: false,
    });

    if (isLoading) return null
    if (data?.name == null) return fallback
    if (data?.verified && includeVerified) return <span className="">{data?.name} <RiVerifiedBadgeFill style={{marginLeft: 4, display: "inline", marginBottom: 4}}/></span>
    return data?.name 
}

export default ProfileName;