import { CheckList, DotLoading, List, Modal, Toast } from "antd-mobile";
import { PhoneFill } from "antd-mobile-icons";
import { MdOutlineRouter } from "react-icons/md";
import useLocalStorageState from "use-local-storage-state";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { fetcherMessages, fetcherMessagesPost } from "../messaging/fetcher";
import { CallAudience, P2P_DEFAULT, P2P_SETTING_KEY } from "../messaging/call/call-signaling";

type Audience = { value: CallAudience; label: string };

const AUDIENCES: Audience[] = [
    { value: "everyone", label: "everybody" },
    { value: "contacts", label: "myContacts" },
    { value: "nobody", label: "nobody" },
];
// the server only rings chats both sides accepted, so "everyone" can't reach strangers
const CALLER_AUDIENCES: Audience[] = AUDIENCES.map((a) =>
    a.value === "everyone" ? { ...a, label: "acceptedChats" } : a
);

function CallPrivacySettings() {
    const { t } = useTranslation();
    // "who can call me" is enforced by the server (and our app for contacts), so it's stored there
    const { data: privacy, isLoading, mutate } = useSWR("/config-privacy", fetcherMessages);
    const [peerToPeer, setPeerToPeer] = useLocalStorageState<CallAudience>(P2P_SETTING_KEY, { defaultValue: P2P_DEFAULT });
    const whoCanCall: CallAudience = privacy?.calls ?? "everyone";
    const labelOf = (audiences: Audience[], value: CallAudience) => t((audiences.find((a) => a.value === value) ?? audiences[0]).label);

    const showPicker = (audiences: Audience[], title: string, value: CallAudience, info: string, onSelect: (value: CallAudience) => Promise<void> | void) => {
        const modal = Modal.show({
            closeOnMaskClick: true,
            title,
            content: (
                <div>
                    <CheckList defaultValue={[value]}>
                        {audiences.map((a) => (
                            <CheckList.Item
                                key={a.value}
                                value={a.value}
                                onClick={async () => {
                                    modal.close();
                                    try {
                                        await onSelect(a.value);
                                        Toast.show({ icon: "success" });
                                    } catch (error) {
                                        console.error(error);
                                        Toast.show({ icon: "fail", content: (error as Error)?.message });
                                    }
                                }}
                            >
                                {t(a.label)}
                            </CheckList.Item>
                        ))}
                    </CheckList>
                    <div className="text-sm mt-4">{info}</div>
                </div>
            ),
        });
    };

    return (
        <List mode="card" header={t("calls")}>
            <List.Item
                prefix={<PhoneFill fontSize={24} />}
                extra={isLoading ? <DotLoading /> : labelOf(CALLER_AUDIENCES, whoCanCall)}
                onClick={() => showPicker(CALLER_AUDIENCES, t("whoCanCallMe"), whoCanCall, t("whoCanCallMeInfo"), async (value) => {
                    const r = await fetcherMessagesPost("/config-privacy", { key: "calls", value });
                    if (r?.error) throw new Error(r.error);
                    mutate(r, false);
                })}
            >
                {t("whoCanCallMe")}
            </List.Item>
            <List.Item
                prefix={<MdOutlineRouter size={24} />}
                extra={labelOf(AUDIENCES, peerToPeer)}
                onClick={() => showPicker(AUDIENCES, t("peerToPeer"), peerToPeer, t("peerToPeerInfo"), setPeerToPeer)}
            >
                {t("peerToPeer")}
            </List.Item>
        </List>
    );
}

export default CallPrivacySettings;
