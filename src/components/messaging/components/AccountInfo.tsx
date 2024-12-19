import { LockFill, LockOutline, MessageOutline, PhoneFill, SendOutline } from "antd-mobile-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { BiChevronLeft, BiMessageSquare } from "react-icons/bi";
import { FiMoreHorizontal } from "react-icons/fi";
import { IoSendOutline } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { WalletContext } from "../../Popup";
import { convertAddress, formatAddress } from "../../../utils/format";
import { CopyToClipboard } from "../../Settings";
import SelectAccount from "../../app/SelectAccount";
import { AccountIcon } from "../../app/Home";
import { Button, DotLoading, Input, List, Popup } from "antd-mobile";
import useSWR from "swr";
import { fetcherMessages } from "../fetcher";
import { box } from "multi-nano-web";
import ChatInputMessage from "./ChatInputMessage";
import { showActionSheet } from "antd-mobile/es/components/action-sheet/action-sheet";
import useLocalStorageState from "use-local-storage-state";
import ProfilePicture from "./profile/ProfilePicture";

const AccountInfo: React.FC<{}> = ({ onlineAccount }) => {
    const {
        account
    } = useParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { data: names } = useSWR<Chat[]>(`/names?accounts=${account}`, fetcherMessages);
    const nameOrAccount = names?.[0]?.name || formatAddress(account);
    const [visible, setVisible] = useState(false);
    const [contacts, setContacts] = useLocalStorageState('contacts', {
        defaultValue: []
    });
    const inContacts = contacts.find((contact) => contact.addresses.find((address) => address.address === account));

    return (
        <div className="">
            <List.Item

            // prefix={
            //     <AccountIcon account={account} width={48} />
            // }
            >
                <div
                onClick={() => {
                    
                }}
                    style={{ height: '5vh' }}
                    className="flex items-center">
                    <BiChevronLeft
                        onClick={(e) => {
                            if (window.history?.length && window.history.length > 1) {
                                navigate(-1);
                             } else {
                                navigate('/chat', { replace: true });
                             }
                        }}
                        className="w-8 h-8 text-gray-500 cursor-pointer" />
                    
                    <div className="flex-1 text-center">
                        <h2 className="font-medium flex items-center justify-center">
                            <LockOutline  className="mr-2" />
                            {nameOrAccount}
                        </h2>
                        {
                            onlineAccount.includes(account) ? (
                                <div className="text-blue-500">
                                    online
                                </div>
                            )
                                : (
                                    <div className="text-gray-500">
                                        offline
                                    </div>
                                )
                        }
                    </div>
                    <div className="mr-2">
                        <ProfilePicture address={account} />
                    </div>
                </div>
            </List.Item>
            <Popup
                visible={visible}
                closeOnMaskClick
                onClose={() => setVisible(false)}
                position="bottom"
                bodyStyle={{ height: '30vh' }}
            >
                <div className="text-center">
                    <p className="break-all text-xl p-4">
                        {account}
                    </p>
                    <p>
                        Public account used for end-to-end encryption. 
                    </p>
                    <p>
                        Verify it with {nameOrAccount} and save it in your contacts for a guaranteed end-to-end encryption.
                    </p>
                </div>
            </Popup>
         
                <List>
                    <List.Item
                    description={
                        <div className="">
                                        
                                        <p>
                                        {nameOrAccount}'s account used for end-to-end encryption.
                                        </p>
                                        <p>
                                            Verify it with {nameOrAccount} by a secure mean and save it in your contacts for a guaranteed authenticity and end-to-end encryption.
                                        </p>
                                    </div>
                    }
                            title="Account"
                            children={
                                <div>
                                <p className="break-all mb-2">
                                            {account}
                                        </p></div>
                            }
                            // onClick={() => {
                            //     setVisible(true);
                            // }}
                            />
                            {
                                !inContacts ? 
                    <List.Item
                    children={
                        <Button
                        shape="default"
                        size="large"
                        color="primary"
                        onClick={() => {
                            navigate(`/contacts/?address=${account}&name=${nameOrAccount}&add=true&network=XNO`);
                        }}
                        >
                                    Add to contacts
                                </Button>
                            }
                            
                            />
                            :
                            <div className="text-center text-gray-500">
                                {/* todo: handle edit contact in Contacts.tsx */}
                                Saved in contacts as {contacts.find((contact) => contact.addresses.find((address) => address.address === account))?.name}
                            </div>
                        }
                        <List.Item
                        children={
                            <a href={`https://nanexplorer.com/nano/account/${account}`} target="_blank">
                            <Button
                            shape="default"
                            size="large"
                            color="default"
                            >
                                View on explorer
                            </Button>
                            </a>
                        }
                        >
                            
                        </List.Item>
                </List>
                <Button
                shape="default"
                size="large"
                color="danger"
                
                >
                    Block
                </Button>

        </div>
    );
};

export default AccountInfo;