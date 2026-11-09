import { SpinLoading } from "antd-mobile";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSyncState, useMessageSyncState } from "../message-cache";

// Sync state of the message store, shown only once a sync takes a moment, so a quick one doesn't flash it.
const SHOW_DELAY = 400;

function useVisibleSyncState(): MessageSyncState | null {
  const state = useMessageSyncState();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!state.active) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY);
    return () => clearTimeout(timer);
  }, [state.active]);
  return visible && state.active ? state : null;
}

/**
 * Title of the chats list: "NanChat", replaced by "Syncing…" while new messages are downloaded, then by the
 * progress of the full history download.
 */
export function ChatListTitle({ onClick }: { onClick?: () => void }) {
  const { t } = useTranslation();
  const sync = useVisibleSyncState();
  if (!sync) return <span onClick={onClick}>NanChat</span>;
  return (
    <span
      onClick={onClick}
      role="status"
      title={sync.chatsTotal > 1 ? `${sync.chatsDone}/${sync.chatsTotal}` : undefined}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, verticalAlign: "middle" }}
    >
      <SpinLoading color="currentColor" style={{ "--size": "16px" } as React.CSSProperties} />
      {sync.phase === "history" ? t("syncingHistory", { percent: sync.percent }) : t("syncingMessages")}
    </span>
  );
}
