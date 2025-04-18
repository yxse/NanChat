import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading } from "antd-mobile";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { useChats } from "../../hooks/use-chats";
import { memo } from "react";
import { useContact } from "../contacts/ImportContactsFromShare";

const ProfileNameLookup = ({ address, fallback }) => {
    const { data: data2, isLoading: isLoading2 } = useSWR(address, fetcherAccount, {
        revalidateIfStale: false,
        revalidateOnFocus: false,
    });

    if (isLoading2) return <DotLoading />;
    if (data2?.name == null) return fallback;
    if (data2?.verified) return <span className="">{data2?.name} <RiVerifiedBadgeFill style={{marginLeft: 4, display: "inline", marginBottom: 4}}/></span>
    return data2?.name;
}
const ProfileLookup = ({ address }) => {
    const { data: data2, isLoading: isLoading2 } = useSWR(address, fetcherAccount, {
        revalidateIfStale: false,
        revalidateOnFocus: false,
    });

    if (isLoading2) return null;
    return data2;
}

export const useProfile = (address) => {
    const {chats, isLoading} = useChats();
    let data = null;
    for (const chat of chats) {
        const participant = chat.participants.find(p => p._id === address);
        if (participant) {
          data = participant;
        break;
        }
    }

    if (isLoading) return null
    if (data == null) { // first try to get the name from the chats (without new request) then fallback to the request
        return <ProfileLookup address={address} />
    }
    return data
}

const ProfileName = memo(({ address, fallback, includeVerified = true }) => {
    const {chats, isLoading} = useChats();
    const {getContact} = useContact();
    const contact = getContact(address);
    let data = null;
    for (const chat of chats) {
        const participant = chat.participants.find(p => p._id === address);
        if (participant) {
          data = participant;
        break;
        }
    }

    if (isLoading) return null
    if (data == null) { // first try to get the name from the chats (without new request) then fallback to the request
        return <ProfileNameLookup address={address} fallback={fallback} />
    }
    if (data?.verified && includeVerified) return <span className="">{contact?.name || data?.name} <RiVerifiedBadgeFill style={{marginLeft: 4, display: "inline", marginBottom: 4}}/></span>
    return contact?.name || data?.name;
})

export default ProfileName;