import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading } from "antd-mobile";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { useChats } from "../../hooks/use-chats";
import { memo } from "react";

const ProfileName = memo(({ address, fallback, includeVerified = true }) => {
    const {chats, isLoading} = useChats();

    // find chat with address in participants
    let data = null;
    for (const chat of chats) {
        const participant = chat.participants.find(p => p._id === address);
        if (participant) {
          data = participant;
        break;
        }
    }

    if (isLoading) return null
    if (data?.name == null) return fallback
    if (data?.verified && includeVerified) return <span className="">{data?.name} <RiVerifiedBadgeFill style={{marginLeft: 4, display: "inline", marginBottom: 4}}/></span>
    return data?.name 
})

export default ProfileName;