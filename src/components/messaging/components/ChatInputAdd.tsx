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

const ChatInputAdd = ({ toAddress, onTipSent, onUploadSuccess, visible, chat }) => {
    const inputAddRef = useRef()
    const emit = useEmit()
    const marginTop = 32
    useEffect(() => {
      if (visible && inputAddRef && inputAddRef.current){
        emit("add-visible", inputAddRef.current.scrollHeight + marginTop)
      }
      else{
        emit("add-visible", 0)
      }
      
    }, [visible])
    
    // console.log("render input add")
    return (
                <div ref={inputAddRef} style={{
                    display: visible ? "flex" : "none",
                    justifyContent: "center", flexWrap: "wrap", gap: 32, marginTop: marginTop}}>
                    <ChatInputFile accountTo={toAddress} onUploadSuccess={onUploadSuccess} type="media"/>
                    <ChatInputFile accountTo={toAddress} onUploadSuccess={onUploadSuccess} type="file" allowPaste/>
                    {
                        chat?.type === "group" ?
                    <ChatInputTip toAddress={undefined} onTipSent={onTipSent} type="transfer" chat={chat}/>
                    : 
                    <ChatInputTip toAddress={toAddress} onTipSent={onTipSent}/>
                    }
                    <ChatInputRedPacket chat={chat} />

                </div>
    );
};

export default memo(ChatInputAdd);