import useSWR from "swr";
import { fetcherAccount } from "../../fetcher";
import { DotLoading } from "antd-mobile";
import { RiVerifiedBadgeFill } from "react-icons/ri";
import { useParticipant } from "../../hooks/participants-store";
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

// loads and indexes the chats for the participant store, only rendered while it is not ready yet
// (on pages where nothing else uses useChats)
const ChatsIndexer = () => {
    useChats();
    return null;
}

export const useProfile = (address) => {
    const {participant: data, ready} = useParticipant(address);

    if (!ready) return null
    if (data == null) { // first try to get the name from the chats (without new request) then fallback to the request
        return <ProfileLookup address={address} />
    }
    return data
}

const ProfileName = memo(({ address, fallback, includeVerified = true, fromContact = true }) => {
    const {participant: data, ready} = useParticipant(address);
    const {getContact} = useContact();
    const contact = getContact(address);

    if (!ready) return <ChatsIndexer />
    if (data == null) { // first try to get the name from the chats (without new request) then fallback to the request
        return <ProfileNameLookup address={address} fallback={fallback} />
    }
    if (data?.verified && includeVerified) return <span className="">{(fromContact ? contact?.name || data?.name : data?.name)} <RiVerifiedBadgeFill style={{marginLeft: 4, display: "inline", marginBottom: 4}}/></span>
    return fromContact ? contact?.name || data?.name : data?.name;
})

export default ProfileName;