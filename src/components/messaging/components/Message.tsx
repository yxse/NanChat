import { memo, useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { LockFill } from "antd-mobile-icons";
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
import { isSpecialMessage } from "../utils";

const Message = memo(({ 
  message, 
  type = "private", 
  prevMessage, 
  nextMessage, 
  hasMore 
}) => {
  const { wallet, dispatch } = useContext(WalletContext);
  const activeAccount = wallet.accounts.find(
    (account) => account.accountIndex === wallet.activeIndex
  )?.address;
  
  
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

  if (!decrypted) {
    return null;
  }

  // Determine message layout properties
  const isPreviousMessageFromSameAccount = prevMessage && prevMessage.fromAccount === message.fromAccount;
  const isNextMessageFromSameAccount = nextMessage && nextMessage.fromAccount === message.fromAccount;
  
  const isFromCurrentUser = message.fromAccount === activeAccount;

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
      />
      <div
        key={message._id}
        style={{ alignItems: "flex-start" }}
        className={`message flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} mb-2 mx-2`}
      >
        {!isFromCurrentUser && <ProfilePictureLink address={message.fromAccount} />}

        {isSpecialMessage(message) ? (
          <MessageSpecial message={message} type={type} activeAccount={activeAccount} />
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

        {isFromCurrentUser && <ProfilePictureLink address={message.fromAccount} />}
      </div>
    </>
  );
});

// Extracted components

const HeaderMessage = ({ message, prevMessage, nextMessage, hasMore, decrypted }) => (
  <>
    {decrypted && !hasMore && !nextMessage && (
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
    )}
    <div className="text-center text-sm" style={{ color: 'var(--adm-color-text-secondary)' }}>
      <DateHeader 
        timestamp={message.timestamp} 
        timestampPrev={prevMessage?.timestamp} 
        timestampNext={nextMessage?.timestamp} 
        reverse 
      />
    </div>
  </>
);

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