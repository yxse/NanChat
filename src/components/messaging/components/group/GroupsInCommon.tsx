import { useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { NavBar } from "antd-mobile";
import { useChats } from "../../hooks/use-chats";
import { useHideNavbarOnMobile } from "../../../../hooks/use-hide-navbar";
import { useTranslation } from 'react-i18next';
import GroupList from "./GroupList";

const GroupsInCommon: React.FC<{}> = ({  }) => {
    const { t } = useTranslation();
    const {
        account
    } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const ticker = searchParams.get('ticker');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
 
    const {chats} = useChats();
    const chat =  chats?.find((chat) => chat.type === "private" && chat?.participants?.find((participant) => participant._id === account));
    const chatsInCommon = chats?.filter(
        (chat) => chat.type === "group" && chat?.participants?.find((participant) => participant._id === account) && chat?.accepted === true && chat?.blocked === false)


 
    useHideNavbarOnMobile(true)
    return (
        <div className="">
            <NavBar
            onBack={() => {
                if (window.history?.length && window.history.length > 1) {
                    navigate(-1);
                 } else {
                    navigate('/chat', { replace: true });
                 }
            }}
            >{t('groupsInCommon')}
            </NavBar>
            <GroupList groups={chatsInCommon} />
            
<div style={{textAlign: 'center', color: 'var(--adm-color-text-secondary)', marginTop: 16, marginBottom: 16}}>
        {`${chatsInCommon.length} ${t('groupsInCommon')}`}
</div>
        </div>
    );
};

export default GroupsInCommon;