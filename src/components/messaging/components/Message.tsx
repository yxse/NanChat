import { memo, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddCircleOutline, CompassOutline, DeleteOutline, LockFill, UserAddOutline } from "antd-mobile-icons";
import { WalletContext } from "../../Popup";
import useMessageDecryption from "../hooks/use-message-decryption";
import ProfilePicture from "./profile/ProfilePicture";
import ProfileName from "./profile/ProfileName";
import MessageTip from "./MessageTip";
import MessageSticker from "./MessageSticker";
import MessageFile from "./MessageFile";
import MessageSystem from "./MessageSystem";
import MessageJoinRequest from "./MessageJoinRequest";
import { DateHeader } from "./date-header-component";
import { isNanoAppMessage, isSpecialMessage, TEAM_ACCOUNT } from "../utils";
import { useLongPress } from "../../../hooks/use-long-press";
import { HapticsImpact } from "../../../utils/haptic";
import { ImpactStyle } from "@capacitor/haptics";
import { Button, List, Popover, Toast } from "antd-mobile";
import { Action } from "antd-mobile/es/components/popover";
import { copyToClipboard } from "../../../utils/format";
import { CopyIcon } from "../../app/Icons";
import { deleteMessage } from "../fetcher";
import { AiOutlineRollback, AiOutlineWallet } from "react-icons/ai";
import { useEmit } from "./EventContext";
import { MetadataCard } from "./antd-mobile-metadata-card";
import { MdOutlineSync } from "react-icons/md";

const Message = memo(({ 
  message, 
  type = "private", 
  prevMessage, 
  nextMessage, 
  hasMore,
  isFromTeam
}) => {
  const { wallet, dispatch } = useContext(WalletContext);
  const activeAccount = wallet.accounts.find(
    (account) => account.accountIndex === wallet.activeIndex
  )?.address;
  
  const [visible, setVisible] = useState(false);

  const ref = useRef(null);
    const onLongPress = useLongPress(() => {
      setVisible(true);
      HapticsImpact({
        style: ImpactStyle.Light
      });
      }, 400);
      // Add right-click handler
    const handleRightClick = (e) => {
      e.preventDefault(); // Prevent default context menu
      setVisible(true);
    };
  
      useEffect(() => {
        const handleClickOutside = (event) => {
          // Only close if clicking outside ref element
          if (ref.current && !ref.current.contains(event.target)) {
            setVisible(false);
          }
        };
        
        document.addEventListener('mouseup', handleClickOutside);
        return () => document.removeEventListener('mouseup', handleClickOutside);
      }, []);
  const decrypted = useMessageDecryption({ message });

  // Store decrypted message in wallet state for reuse
  useEffect(() => {
    if (decrypted) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { _id: message._id, content: decrypted }
      });
    }
  }, [decrypted, dispatch, message._id]);
  const [sending, setSending] = useState(false);
    useEffect(() => {
      // set sending after 2 seconds
      setTimeout(() => {
        if (message.status === 'sent_local') {
        setSending(true);
        }
      }, 2000)
    }, [message]);
  if (!decrypted) {
    return null;
  }

  // Determine message layout properties
  const isPreviousMessageFromSameAccount = prevMessage && prevMessage.fromAccount === message.fromAccount;
  const isNextMessageFromSameAccount = nextMessage && nextMessage.fromAccount === message.fromAccount;
  
  const isFromCurrentUser = message.fromAccount === activeAccount;
  let actions: Action[] = [
    { key: 'copy', text: 'Copy' , icon: <CopyIcon />}
  ]
  const MAX_RECALL_TIME = 1000 * 60 * 4 // 4 minutes
  if (Date.now() - message.timestamp < MAX_RECALL_TIME && isFromCurrentUser) {
    actions.push({ key: 'recall', text: 'Recall', icon: <AiOutlineRollback /> });
  }
  // Handle special message types
  if (message?.type === "join-request") {
    return (
      <>
        <HeaderMessage 
          message={message} 
          prevMessage={prevMessage} 
          nextMessage={nextMessage} 
          hasMore={hasMore} 
          decrypted={decrypted} 
        />
        <MessageJoinRequest message={message} />
      </>
    );
  }

  if (message?.type === "system") {
    return (
      <>
        <HeaderMessage 
          message={message} 
          prevMessage={prevMessage} 
          nextMessage={nextMessage} 
          hasMore={hasMore} 
          decrypted={decrypted} 
        />
        <MessageSystem message={message} />
      </>
    );
  }

  return (
    <>
      <HeaderMessage 
        message={message} 
        prevMessage={prevMessage} 
        nextMessage={nextMessage} 
        hasMore={hasMore} 
        decrypted={decrypted} 
        isFromTeam={isFromTeam}
      />
      <div
      ref={ref}
      {...onLongPress}
      onContextMenu={handleRightClick}
        key={message._id}
        style={{ alignItems: "center" }}
        className={`message flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} mb-2 mx-2`}
      >
        {!isFromCurrentUser && <ProfilePictureLink address={message.fromAccount} />}
        {sending && <MdOutlineSync className='ai-spin' size={22} style={{marginRight: 4}}  />}
      <Popover.Menu
        mode="dark"
        actions={actions}
        visible={visible}
        onAction={async (action) => {
          if (action.key === 'copy') {
            await copyToClipboard(decrypted);
          }
          if (action.key === 'recall') {
            console.log('delete', message._id);
            Toast.show({content: 'Recalling', icon: 'loading'});
            let r = await deleteMessage(message.chatId, message.height) // we use height because we don't have the true _id when optimistic sending
            
            if (r.error) {
              Toast.show({content: r.error, icon: 'fail'});
            }
            else {
              Toast.show({icon: 'success'});
            }
          }
          setVisible(false);
        }}
      >
  
        {
        isSpecialMessage(message) ? 
          (<MessageSpecial message={message} type={type} activeAccount={activeAccount} />) : 
        isNanoAppMessage(message) ? 
          (<div className={`message flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} `} style={{}}>
            <MetadataCard message={decrypted} /></div>
          ) : (
          <MessageContent 
            message={message} 
            type={type} 
            decrypted={decrypted} 
            isFromCurrentUser={isFromCurrentUser} 
            isPreviousMessageFromSameAccount={isPreviousMessageFromSameAccount} 
            activeAccount={activeAccount}
          />
        )}
        
      </Popover.Menu>

        {isFromCurrentUser && <ProfilePictureLink address={message.fromAccount} />}
      </div>
    
    </>
  );
});

export const InfoMessageEncrypted = ({}) => {
  return (
    <div 
      className="flex items-center justify-center text-sm text-center" 
      style={{ 
        color: 'var(--adm-color-warning)',
        backgroundColor: 'var(--adm-color-background)', 
        padding: '16px', 
        margin: 32, 
        borderRadius: 8 
      }}
    >
      <div>
        <LockFill className="mr-2 inline" />
        Messages and files are end-to-end encrypted using nano. No one outside of this chat can read them.
      </div>
    </div>
  );
}

export const WelcomeMessage = ({}) => {
  const navigate = useNavigate();
  const emit = useEmit();

  return (<div>
    <div
        style={{ alignItems: "flex-start" }}
        className={`message flex justify-start mb-2 mx-2`}
      >
    <ProfilePictureLink
      address={TEAM_ACCOUNT}
    />
      <MessageContent
      //  You now have the most powerful Nano app in your hands.
//       - End to end encrypted chat and file sharing.
//   - Send and receive nano instantly and securely.
//   - Create group up to 500 members.
//   - Discover Nano apps.

// Feel free to let us know if you have any problems or suggestions.
        type="private"
        decrypted={`Welcome to NanChat! Here are some features that you can explore :
`}
        isFromCurrentUser={false}
        isPreviousMessageFromSameAccount={false}
        
      />
      </div>
      <List mode="card"
        style={{ }}
      >
        <List.Item
        prefix={<AddCircleOutline />}
        // arrowIcon={<AddCircleOutline style={{width: 32, height: 32, cursor: 'pointer'}}  />}
         onClick={() => {
          emit('open-input-plus', {open: true})
        }}>

          Transfer Nano
        </List.Item>
        <List.Item
        prefix={<AiOutlineWallet />}
          onClick={() => {
            navigate("/wallet")
          }}
        >

          Nano Wallet
        </List.Item>
                <List.Item
                prefix={<CompassOutline />}
                 onClick={() => {
                  navigate("/discover")
                }}>

          Nano Apps
                </List.Item>
                <List.Item
                prefix={<UserAddOutline />}
                 onClick={() => {
                  navigate("/contacts")
                }}>

          Add Nano Contacts
                </List.Item>
        
      </List>
      <div
        style={{ alignItems: "flex-start" }}
        className={`message flex justify-start mb-2 mx-2`}
      >
    <ProfilePictureLink
      address={"nano_1aotdujz8ypijprua9fkerxr9nifbj8bbq5edgztjif45qr3g6fbd1cxenij"}
    />
      <MessageContent
      //  You now have the most powerful Nano app in your hands.
//       - End to end encrypted chat and file sharing.
//   - Send and receive nano instantly and securely.
//   - Create group up to 500 members.
//   - Discover Nano apps.

// Feel free to let us know if you have any problems or suggestions.
        type="private"
        decrypted={`Feel free to let us know if you have any questions or suggestions.`}
        isFromCurrentUser={false}
        isPreviousMessageFromSameAccount={false}
        
      />
      </div>
    </div>
  );
}
const HeaderMessage = ({ message, prevMessage, nextMessage, hasMore, decrypted, isFromTeam }) => {

  // debugger
  return (
  <>
    {decrypted && !hasMore && !nextMessage && (
      <div>
      <InfoMessageEncrypted />
    {isFromTeam && <WelcomeMessage />}
      
    
      <div className="text-center text-sm mb-4" style={{ color: 'var(--adm-color-text-secondary)' }}>
      <DateHeader 
        timestamp={message.timestamp} 
        timestampPrev={prevMessage?.timestamp} 
        timestampNext={nextMessage?.timestamp} 
        reverse 
        />
    </div>
      </div>
    )}
    {
      nextMessage && 
    <div className="text-center text-sm" style={{ color: 'var(--adm-color-text-secondary)' }}>
      <DateHeader 
        timestamp={message.timestamp} 
        timestampPrev={prevMessage?.timestamp} 
        timestampNext={nextMessage?.timestamp} 
        reverse 
        />
    </div>
      }
  </>
  );
};

const ProfilePictureLink = ({ address }) => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'flex-end', 
    flexDirection: 'column', 
    margin: '0 8px' 
  }}>
    <Link to={`/chat/${address}`}>
      <ProfilePicture address={address} />
    </Link>
  </div>
);


const MessageContent = ({ 
  message, 
  type, 
  decrypted, 
  isFromCurrentUser,
  isPreviousMessageFromSameAccount,
  activeAccount
}) => {
  const borderRadiusClass = isFromCurrentUser
    ? isPreviousMessageFromSameAccount ? '' : 'rounded-br-none'
    : isPreviousMessageFromSameAccount ? '' : 'rounded-bl-none';

  return (
    <div
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        backgroundColor: isFromCurrentUser 
          ? 'var(--adm-color-primary)' 
          : 'var(--adm-color-background)',
      }}
      className={`max-w-[70%] p-2 rounded-md ${borderRadiusClass}`}
    >
      {type === 'group' && !isFromCurrentUser && (
        <span style={{ color: 'var(--adm-color-text-secondary)' }} className="text-sm">
          <ProfileName address={message.fromAccount} fallback={"..."} />
        </span>
      )}
      <p>
        {!decrypted && !message.isLocal && (
          <span className="text-xs opacity-70">(clear) </span>
        )}
        {decrypted}
      </p>
    </div>
  );
};

const MessageSpecial = ({ message, type, activeAccount }) => {
  const { fromAccount, stickerId, tip, file } = message;
  const side = fromAccount === activeAccount ? 'from' : 'to';
  return (
    <div className="" >
      {type === 'group' && fromAccount !== activeAccount && (
        <span className="text-sm" style={{ color: 'var(--adm-color-text-secondary)' }}>
          <ProfileName address={fromAccount} fallback="..." />
        </span>
      )}
      {stickerId && <MessageSticker message={message} side={side} hash={stickerId} ticker={stickerId} />}
      {tip && <MessageTip message={message} side={side} hash={tip.hash} ticker={tip.ticker} />}
      {file && <MessageFile message={message} side={side} file={file} />}
    </div>
  );
};

export default Message;