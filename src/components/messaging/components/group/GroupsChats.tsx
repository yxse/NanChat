import { useNavigate } from "react-router-dom";
import { NavBar } from "antd-mobile";
import { useChats } from "../../hooks/use-chats";
import { useHideNavbarOnMobile } from "../../../../hooks/use-hide-navbar";
import { useTranslation } from 'react-i18next';
import GroupList from "./GroupList";
import { AddCircleOutline } from "antd-mobile-icons";

const GroupsChats: React.FC<{}> = ({  }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
 
    const {chats} = useChats();
    const chatGroups =  chats?.filter((chat) => chat.type === "group");
    useHideNavbarOnMobile(true)
    return (
        <div className="">
            <NavBar
            onBack={() => {
                if (window.history?.length && window.history.length > 1) {
                    navigate(-1);
                 } else {
                    navigate('/contacts', { replace: true });
                 }
            }}
            >{t('groupsChat')}
            </NavBar>
            <GroupList groups={chatGroups} />
            
<div style={{textAlign: 'center', color: 'var(--adm-color-text-secondary)', marginTop: 16}}>
        {`${chatGroups.length} ${t('groupsChat')}`}
</div>
<div style={{color: 'var(--adm-color-text-secondary)', marginTop: 16, paddingBottom: 64, marginLeft: 8, marginRight: 8}}>
      To create a new group chat: <br/>
      1. Go to Chats and click <AddCircleOutline style={{display: "inline"}} /> <br/>
      2. Click New Chat <br/>
      3. Select at least 2 contacts
</div>
        </div>
    );
};

export default GroupsChats;