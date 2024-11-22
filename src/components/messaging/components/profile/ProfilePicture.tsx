import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading } from "antd-mobile";

const ProfilePicture = ({ address }) => {
    const { data, isLoading } = useSWR(address, fetcherAccount);

    if (isLoading) return null
    return (
        <img
            style={{ borderRadius: "100%" }}
            src={data?.profilePicture?.url} width={48} alt="pfp" />
    )
}

export default ProfilePicture;