import React, { useContext, useEffect, useState, useRef, memo } from 'react';
import { ImageUploader, Toast, Button, Avatar, Divider, Modal } from 'antd-mobile';
import { FileOutline, FolderOutline, LockOutline, PictureOutline, UserOutline } from 'antd-mobile-icons';
import useSWR from 'swr';
import { fetcherAccount } from '../fetcher';
import { WalletContext } from "../../useWallet";
import { useWallet } from "../../useWallet";
import { box } from 'multi-nano-web';
import { formatSize } from '../../../utils/format';
import { saveFileInCache } from '../../../services/database.service';
import { AiOutlineSwap } from 'react-icons/ai';
import ChatInputFile from './ChatInputFile';
import ChatInputTip from './ChatInputTip';
import ChatInputRedPacket from './ChatInputRedPacket';
import { useEmit } from './EventContext';
import ChatInputCall from '../call/ChatInputCall';


const ActionWrapper = ({ children }) => {
  return (
    <div style={{
      textAlign: 'center', 
      width: 58, 
      display: "flex", 
      justifyContent: "center"
    }}>
      {children}
    </div>
  );
};

const ChatInputAdd = ({ toAddress, onTipSent, onUploadStart, onUploadSuccess, onUploadCancel, visible, chat, hideInput }) => {
  const inputAddRef = useRef();
  const emit = useEmit();
  const marginTop = 32;

  useEffect(() => {
    if (!inputAddRef?.current || hideInput) return;
    
    if (visible) {
      emit("add-visible", inputAddRef.current.scrollHeight + marginTop);
    } else {
      emit("add-visible", 0);
    }

    // Cleanup function if needed
    // return () => emit("add-visible", 0);
  }, [visible]);
  
  if (hideInput) return null;

  // a chat request must be accepted before calling (also enforced by the server)
  const canCall = (chat?.type === "private" || chat?.type === "group") && chat?.accepted;

  return (
    <div style={{ maxWidth: 400, margin: "0 auto" }}>
      <div 
        ref={inputAddRef} 
        style={{
          display: visible ? "flex" : "none",
          justifyContent: "space-around", 
          flexWrap: "wrap", 
          gap: 16,
          marginTop: marginTop
        }}
      >
        <ActionWrapper>
          <ChatInputFile 
            accountTo={toAddress} 
            onUploadStart={onUploadStart}
            onUploadSuccess={onUploadSuccess}
            onUploadCancel={onUploadCancel}
            type="media" 
          />
        </ActionWrapper>

        <ActionWrapper>
          <ChatInputFile 
            accountTo={toAddress} 
            onUploadStart={onUploadStart}
            onUploadSuccess={onUploadSuccess}
            onUploadCancel={onUploadCancel}
            type="file" 
            allowPaste 
          />
        </ActionWrapper>

        <ActionWrapper>
          {chat?.type === "group" ? (
            <ChatInputTip 
              toAddress={undefined} 
              onTipSent={onTipSent} 
              type="transfer" 
              chat={chat} 
            />
          ) : (
            <ChatInputTip 
              toAddress={toAddress} 
              onTipSent={onTipSent} 
            />
          )}
        </ActionWrapper>

        <ActionWrapper>
          <ChatInputRedPacket chat={chat} />
        </ActionWrapper>

        {canCall && (
          <>
            {/* calls on their own row: 6 buttons don't fit one row and the labels overlap */}
            <div style={{ flexBasis: "100%", height: 0, margin: "-8px 0" }} />

            <ActionWrapper>
              <ChatInputCall chat={chat} toAddress={toAddress} video={false} />
            </ActionWrapper>

            <ActionWrapper>
              <ChatInputCall chat={chat} toAddress={toAddress} video />
            </ActionWrapper>

            {/* empty slots so the call buttons line up under the first two columns */}
            <ActionWrapper>{null}</ActionWrapper>
            <ActionWrapper>{null}</ActionWrapper>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(ChatInputAdd);