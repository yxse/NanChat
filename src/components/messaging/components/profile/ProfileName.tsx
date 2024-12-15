import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading } from "antd-mobile";

const ProfileName = ({ address, fallback }) => {
    const { data, isLoading } = useSWR(address, fetcherAccount, {
        dedupingInterval: 60000,
    });

    if (isLoading) return null
    if (data?.name == null) return fallback
    return data?.name 
}

export default ProfileName;