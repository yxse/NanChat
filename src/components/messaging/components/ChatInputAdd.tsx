import React, { useContext, useEffect, useState, useRef } from 'react';
import { ImageUploader, Toast, Button, Avatar, Divider, Modal } from 'antd-mobile';
import { FileOutline, FolderOutline, LockOutline, PictureOutline, UserOutline } from 'antd-mobile-icons';
import useSWR from 'swr';
import { fetcherAccount } from '../fetcher';
import { useWallet, WalletContext } from '../../Popup';
import { box } from 'multi-nano-web';
import { formatSize } from '../../../utils/format';
import { saveFileInCache } from '../../../services/database.service';
import { AiOutlineSwap } from 'react-icons/ai';
import ChatInputFile from './ChatInputFile';
import ChatInputTip from './ChatInputTip';

const ChatInputAdd = ({ toAddress, onTipSent, onUploadSuccess, visible, chat }) => {
    return (
                <div style={{
                    display: visible ? "flex" : "none",
                    justifyContent: "center", flexWrap: "wrap", gap: 32, marginTop: 32}}>
                    <ChatInputFile accountTo={toAddress} onUploadSuccess={onUploadSuccess} type="media"/>
                    <ChatInputFile accountTo={toAddress} onUploadSuccess={onUploadSuccess} type="file" allowPaste/>
                    {
                        chat?.type === "group" ?
                    <ChatInputTip toAddress={undefined} onTipSent={onTipSent} type="transfer" chat={chat}/>
                    : 
                    <ChatInputTip toAddress={toAddress} onTipSent={onTipSent}/>
                    }
                </div>
    );
};

export default ChatInputAdd;