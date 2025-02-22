import { formatOnlineStatus } from "../../../utils/telegram-date-formatter";

export const HeaderStatus = ({lastOnline}) => {
    const status = formatOnlineStatus(lastOnline);
    if (status == null) {
        return null;
    }
    if (status === 'Online') {
        return (
            <div style={{ color: 'var(--adm-color-primary)' }}>
                Online
            </div>
        )
    }
    return (
        <div style={{ color: 'var(--adm-color-text-secondary)' }}>
            Last seen {status}
        </div>
    )
}
