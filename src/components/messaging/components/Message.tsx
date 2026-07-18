import { memo, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddCircleOutline, CompassOutline, DeleteOutline, KeyOutline, LockFill, LockOutline, UserAddOutline } from "antd-mobile-icons";
import { WalletContext } from "../../useWallet";
import useMessageDecryption from "../hooks/use-message-decryption";
import ProfilePicture from "./profile/ProfilePicture";
import ProfileName from "./profile/ProfileName";
import MessageTip from "./MessageTip";
import MessageSticker from "./MessageSticker";
import MessageFile from "./MessageFile";
import MessageSystem from "./MessageSystem";
import MessageJoinRequest from "./MessageJoinRequest";
import { DateHeader } from "./date-header-component";
import { isNanoAppMessage, isSpecialMessage, TEAM_ACCOUNT, confirmAndOpenExternalUrl } from "../utils";
import { useLongPress } from "../../../hooks/use-long-press";
import { HapticsImpact } from "../../../utils/haptic";
import { ImpactStyle } from "@capacitor/haptics";
import { Button, List, Popover, Toast } from "antd-mobile";
import { Action } from "antd-mobile/es/components/popover";
import { copyToClipboard } from "../../../utils/format";
import { CopyIcon } from "../../app/Icons";
import { deleteMessage, fetcherMessagesPost } from "../fetcher";
import { HeartFill, HeartOutline } from "antd-mobile-icons";
import { useFavoriteStickers } from "./favoriteStickersApi";
import { AiOutlineEnter, AiOutlineRollback, AiOutlineWallet } from "react-icons/ai";
import { useEmit } from "./EventContext";
import { MetadataCard } from "./antd-mobile-metadata-card";
import { MdOutlineReply, MdOutlineSync } from "react-icons/md";
import { BsTranslate } from "react-icons/bs";
import { isAutoTranslateEnabled, isTranslationAvailable, translateText } from "../../../services/translation.service";
import { useTranslation } from "react-i18next";
import MessageRaw from "./MessageRaw";
import MessageRedPacket from "../../app/redpacket/MessageRedPacket";
import { isTauri } from "@tauri-apps/api/core";

const Message = memo(({
  message,
  type = "private",
  prevMessage,
  nextMessage,
  hasMore,
  isFromTeam,
  onGoToMessage,
}: {
  message: any;
  type?: string;
  prevMessage?: any;
  nextMessage?: any;
  hasMore?: boolean;
  isFromTeam?: boolean;
  activeAccount?: string;
  activeAccountPk?: string;
  onGoToMessage?: (replyMessage: { _id: string; height: number }) => void;
}) => {
  const { wallet, dispatch } = useContext(WalletContext);
  const activeAccount = wallet.accounts.find(
    (account) => account.accountIndex === wallet.activeIndex
  )?.address;
const { data: favorites, mutate: mutateFavorites } = useFavoriteStickers();
  const { t } = useTranslation();

  // console.log("render", message?._id)

  const [visible, setVisible] = useState(false);
  const [replyPopoverVisible, setReplyPopoverVisible] = useState(false);
  const emit = useEmit();
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
      if (event.button === 2) return; // right-click opens the menu; ignore its mouseup
      setVisible(false);
    };

    document.addEventListener('mouseup', handleClickOutside);
    document.querySelector("#scrollableDiv")?.addEventListener('scroll', handleClickOutside)

    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
      document.querySelector("#scrollableDiv")?.removeEventListener('scroll', handleClickOutside)

    }
  }, []);
  const decrypted = useMessageDecryption({ message });

  // causing too much re render
  // Store decrypted message in wallet state for reuse
  // useEffect(() => { 
  //   if (decrypted) {
  //     dispatch({
  //       type: 'ADD_MESSAGE',
  //       payload: { _id: message._id, content: decrypted }
  //     });
  //   }
  // }, [decrypted, dispatch, message._id]);
  const [sending, setSending] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  useEffect(() => {
    if (!decrypted) return;
    if (!isAutoTranslateEnabled() || !isTranslationAvailable()) return;
    if (isSpecialMessage(message) || isNanoAppMessage(message)) return;
    if (message.fromAccount === activeAccount) return;
    translateText(decrypted)
      .then((result) => { if (result) setTranslated(result); })
      .catch(() => {});
  }, [decrypted]);
  useEffect(() => {
    // set sending after 2 seconds
    setTimeout(() => {
      if (message.status === 'sent_local') {
        setSending(true);
      }
    }, 2000)
  }, [message]);
  if (!decrypted) { // only showing the message when decrypted
    return null;
  }

  // Determine message layout properties
  const isPreviousMessageFromSameAccount = prevMessage && prevMessage.fromAccount === message.fromAccount;
  const isNextMessageFromSameAccount = nextMessage && nextMessage.fromAccount === message.fromAccount;

  const isFromCurrentUser = message.fromAccount === activeAccount;
  const isFavorited = message.stickerId && favorites?.some((f: { url: string }) => f.url === message.stickerId);
  let actions: Action[] = [
    { key: 'reply', text: 'Reply', icon: <MdOutlineReply /> },
    { key: 'copy', text: 'Copy', icon: <CopyIcon /> }
  ]
  if (isTranslationAvailable() && !isSpecialMessage(message) && !isNanoAppMessage(message)) {
    actions.push({ key: 'translate', text: translated ? t('showOriginal') : t('translate'), icon: <BsTranslate /> });
  }
  if (message.stickerId) {
    actions.push(isFavorited
      ? { key: 'unfavorite', text: 'Unfavorite', icon: <HeartFill /> }
      : { key: 'favorite', text: 'Favorite', icon: <HeartOutline /> }
    );
  }
  const MAX_RECALL_TIME = 1000 * 60 * 4 // 4 minutes
  if (Date.now() - new Date(message.timestamp) < MAX_RECALL_TIME && isFromCurrentUser) {
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
          isFromTeam={isFromTeam}
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
          isFromTeam={isFromTeam}
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
        {message?.replyMessage && <div style={{
          height: message.replyMessage.file ? 56 : message.replyMessage.stickerId ? 58 : "unset", // reduce content shift virtualizer
          display: "flex", justifyContent: isFromCurrentUser ? "flex-end" : "flex-start"}}>
           <Popover
           mode="dark"
          visible={replyPopoverVisible}
          onVisibleChange={setReplyPopoverVisible}
          content={
          <div style={{maxWidth: 300}}>
            <MessageRaw key={"full" + message.replyMessage._id} message={message.replyMessage} ellipsis={false} maxHeight={"75px"} includeProfileName={false}/>
            <Button
            className="dark-button"
            size="small"
            shape="rounded"
            type="submit"
            style={{ color: '#fff', borderColor: 'rgb(30, 30, 30)', backgroundColor: '#0e0e0e' }}
            onClick={() => { setReplyPopoverVisible(false); onGoToMessage?.(message.replyMessage); }}>
              Go to message
            </Button>
          </div>}
          trigger={(message.replyMessage?.file || message.replyMessage.nanoApp) ? false : "click"} // only trigger popover if text message
          placement='top'
        >
          <div
          className={`chat-message p-2 rounded-md from message text-sm`}
        style={{
          color: 'var(--adm-color-text-secondary)',
          marginLeft: isFromCurrentUser ? 0 : 66,
          marginRight: isFromCurrentUser ? 66 : 0,
          marginBottom: 2,
          maxWidth: '300px',
          cursor: 'pointer'
                }}
          >
                  <MessageRaw
                  type="reply"
                   key={"reply" + message.replyMessage._id} message={message.replyMessage} ellipsis includeProfileName={true}/>
                  </div></Popover></div>}
      <div
        ref={ref}
        {...onLongPress}
        onContextMenu={handleRightClick}
        
        style={{ alignItems: "start" }}
        className={`message flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} mb-2 mx-2`}
      >
        {!isFromCurrentUser && <ProfilePictureLink address={message.fromAccount} />}
        {sending && <MdOutlineSync className='ai-spin' size={22} style={{ marginRight: 4 }} />}
        <Popover.Menu
          mode="dark"
          actions={actions}
          visible={visible}
          onAction={async (action) => {
            if (action.key === 'copy') {
              await copyToClipboard(decrypted);
            }
            else if (action.key === 'translate') {
              if (translated) {
                setTranslated(null);
              } else {
                Toast.show({ icon: 'loading', content: t('translating'), duration: 0 });
                try {
                  const result = await translateText(decrypted);
                  Toast.clear();
                  if (result) {
                    setTranslated(result);
                  } else {
                    Toast.show({ content: t('nothingToTranslate') });
                  }
                } catch (error) {
                  console.log('translation failed', error);
                  Toast.show({ icon: 'fail', content: t('translationFailed') });
                }
              }
            }
            else if (action.key === 'reply') {
              console.log('reply', message._id);
              emit('reply-message', { message: message });
            }
            if (action.key === 'favorite') {
              await fetcherMessagesPost('/stickers/favorites/add', { url: message.stickerId });
              mutateFavorites();
            }
            if (action.key === 'unfavorite') {
              await fetcherMessagesPost('/stickers/favorites/remove', { url: message.stickerId });
              mutateFavorites();
            }
            if (action.key === 'recall') {
              console.log('delete', message._id);
              Toast.show({ content: 'Recalling', icon: 'loading' });
              let r = await deleteMessage(message.chatId, message.height) // we use height because we don't have the true _id when optimistic sending

              if (r.error) {
                Toast.show({ content: r.error, icon: 'fail' });
              }
              else {
                Toast.show({ icon: 'success' });
                emit('recall-message', {message: decrypted})
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
                  <MetadataCard message={decrypted} messageData={message} /></div>
                ) : (
                  <MessageContent
                    message={message}
                    type={type}
                    decrypted={decrypted}
                    translated={translated}
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

export const InfoMessageEncrypted = ({ }) => {
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

export const WelcomeMessage = ({ }) => {
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
        decrypted={`Welcome to NanChat! You can now send money and messages instantly all over the world, always with 0 fees. Here are some other features that you can explore :
`}
        isFromCurrentUser={false}
        isPreviousMessageFromSameAccount={false}

      />
    </div>
    <List mode="card"
      style={{}}
    >

      <List.Item
        prefix={<AiOutlineWallet />}
        onClick={() => {
          navigate("/wallet")
        }}
      >

        Nano Wallet
      </List.Item>
      {/* <List.Item
        prefix={<AddCircleOutline />}
        // arrowIcon={<AddCircleOutline style={{width: 32, height: 32, cursor: 'pointer'}}  />}
         onClick={() => {
          emit('open-input-plus', {open: true})
        }}>

          Send Files and Nano
        </List.Item> */}
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

        Import Nano Contacts
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
    <Link to={`/chat/${address}/info`}>
      <ProfilePicture address={address} />
    </Link>
  </div>
);

// Safer message renderer component
const MessageContentLink = ({ message }) => {
  // Decrypt message here if needed
  const decrypted = message; // Replace with your decryption logic
  
  if (!decrypted) {
    return <b></b>;
  }
  // Extract URLs from the message
  const urls = extractUrls(decrypted);
  
  if (urls.length === 0) {
    // If no URLs, just return the text
    return <div>{decrypted}</div>;
  }
  
  // Split the message by URLs and create an array of text and link elements
  let parts = [];
  let lastIndex = 0;
  
  urls.forEach(url => {
    const urlIndex = decrypted.indexOf(url, lastIndex);
    
    // Add text before the URL
    if (urlIndex > lastIndex) {
      parts.push(decrypted.substring(lastIndex, urlIndex));
    }
    
    // Add the URL as a link
    parts.push(
      <a 
        onClick={(e) => {
          if (isTauri()) {
            e.preventDefault();
            confirmAndOpenExternalUrl(url);
          }
        }}
        key={urlIndex}
        style={{ textDecoration: 'underline' }}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {url}
      </a>
    );
    
    lastIndex = urlIndex + url.length;
  });
  
  // Add any remaining text after the last URL
  if (lastIndex < decrypted.length) {
    parts.push(decrypted.substring(lastIndex));
  }
  
  // Render all parts together
  return <div>{parts}</div>;
};


function extractUrls(message) {
  // More comprehensive URL regex pattern
  const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  
  // Find all matches in the message
  const urls = message.match(urlPattern) || [];
  return urls;
}

const MessageContent = ({
  message = null as any,
  type,
  decrypted,
  translated = null as string | null,
  isFromCurrentUser,
  isPreviousMessageFromSameAccount,
  activeAccount = null as any
}) => {
  const { t } = useTranslation();
  const borderRadiusClass = isFromCurrentUser
    ? isPreviousMessageFromSameAccount ? '' : 'rounded-br-sm'
    : isPreviousMessageFromSameAccount ? '' : 'rounded-bl-sm';
  // const borderRadiusClass = ''

  // if (!decrypted) return null
  return (
    <div
    style={{borderRadius: 8,
      // disable text selection
      userSelect: 'none',
      WebkitUserSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      
    }}
      className={`chat-message max-w-[70%] p-2 ${borderRadiusClass} ${isFromCurrentUser ? 'to' : 'from'}`}
    >
      {type === 'group' && !isFromCurrentUser && (
        <span style={{ color: 'var(--adm-color-text-secondary)' }} className="text-sm">
          <ProfileName address={message.fromAccount} fallback={"..."} />
        </span>
      )}
      <div>
        {!decrypted && !message.isLocal && (
          <LockOutline />
        )}
        <MessageContentLink message={decrypted} />
        {translated && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid color-mix(in srgb, currentColor 25%, transparent)' }}>
            <MessageContentLink message={translated} />
            <div className="text-xs flex items-center gap-1" style={{ color: 'var(--adm-color-text-secondary)', marginTop: 2 }}>
              <BsTranslate /> {t('translated')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MessageSpecial = ({ message, type, activeAccount }) => {
  const { fromAccount, stickerId, tip, file, redPacket } = message;
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
      {redPacket && <MessageRedPacket message={message}  />}
    </div>
  );
};

export default Message;