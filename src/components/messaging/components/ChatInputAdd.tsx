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

const ChatInputAdd = ({ toAddress, onTipSent, onUploadSuccess, visible, chat, hideInput }) => {
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
            onUploadSuccess={onUploadSuccess} 
            type="media" 
          />
        </ActionWrapper>

        <ActionWrapper>
          <ChatInputFile 
            accountTo={toAddress} 
            onUploadSuccess={onUploadSuccess} 
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
      </div>
    </div>
  );
};

export default memo(ChatInputAdd);