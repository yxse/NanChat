import useSWR from "swr";
import { useWallet } from "../../Popup";
import { fetcherAccount } from "../fetcher";
import { ShareModal } from "../../../utils/format";
import { useTranslation } from 'react-i18next';


export function useInviteFriends() {
        const { activeAccount } = useWallet()
        const { data: me, isLoading } = useSWR(activeAccount, fetcherAccount);
        const { t } = useTranslation();

        const inviteFriends = async () => {
            ShareModal({
                title: t('inviteFriendsShareMessage', { username: me?.username, account: activeAccount }),
                url: null,
            })
        }

    return {
        inviteFriends
    };
}