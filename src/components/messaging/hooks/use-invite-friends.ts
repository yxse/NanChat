import useSWR from "swr";
import { useWallet } from "../../Popup";
import { fetcherAccount } from "../fetcher";
import { ShareModal } from "../../../utils/format";


export function useInviteFriends() {
        const { activeAccount } = useWallet()
        const { data: me, isLoading } = useSWR(activeAccount, fetcherAccount);

        const inviteFriends = async () => {
            ShareModal({
                title: `Hey, I'm using NanChat for end-to-end encrypted chats and free secure payments! Install NanChat and add me via NanChat ID: ${me?.username} or via https://nanchat.com/chat/${activeAccount}`,
                url: null,
            })
        }

    return {
        inviteFriends
    };
}