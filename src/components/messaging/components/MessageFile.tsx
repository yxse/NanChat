import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { useWallet, WalletContext } from "../../Popup";
import { Card, DotLoading, ImageViewer, Modal, Popover, Skeleton, Toast } from "antd-mobile";
import { convertAddress, formatAmountRaw, formatSize } from "../../../utils/format";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../../app/Network";
import { rawToMega } from "../../../nano/accounts";
import { ConvertToBaseCurrency, FormatBaseCurrency } from "../../app/Home";
import { fetcherMessages, fetcherMessagesNoAuth } from "../fetcher";
import { DownlandOutline, ExclamationCircleFill, FileWrongOutline } from "antd-mobile-icons";
import { decryptGroupMessage, getSharedKey } from "../../../services/sharedkey";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener, FileOpenerOptions } from '@capacitor-community/file-opener';
import { readFileToBlobUrl, writeUint8ArrayToFile } from "../../../services/capacitor-chunked-file-writer";
import { setData } from "../../../services/database.service";
import { dangerousExtensions } from "../utils";
import { useChats } from "../hooks/use-chats";

const downloadFile = async (content: string, fileName: string, fileType: string, fileId: string )=> {
    const download = async () => {
        if (Capacitor.isNativePlatform()) {
            Toast.show({icon: 'loading'})
            let filePath = await Filesystem.getUri({directory: Directory.Data, path: fileId})
            try {
              const fileOpenerOptions: FileOpenerOptions = {
                  filePath: filePath.uri,
                  contentType: fileType,
                  openWithDefault: true
                };
              Toast.clear()
              await FileOpener.open(fileOpenerOptions);
              
            } catch (error) {
              console.error('Error saving file:', error);
              if (error.code == 8){ // for certain extensions, we need to use the file opener without default
                await FileOpener.open({
                    filePath: filePath.uri,
                    contentType: fileType,
                    openWithDefault: false
                });
                Toast.clear()
                return
              }
              Toast.show({content: error.message, icon: 'error'})
            }
          } else {
            // Web approach 
            const a = document.createElement('a');
            a.href = content;
            a.download = fileName;
            a.click();
          }
    }
    let extension = "." + fileName.split('.').pop()
    if (dangerousExtensions.includes(extension)) {
        Modal.confirm({
            closeOnMaskClick: true,
            header: (
                <ExclamationCircleFill
                  style={{
                    fontSize: 64,
                    color: 'var(--adm-color-warning)',
                  }}
                />
              ),
            title: "File potentially dangerous",
            content: <div style={{textAlign: 'center', maxWidth: '300px'}}>
                This file has the extension <b>{extension}</b> <br/> It may steal your funds or harm your computed if executed. Continue only if you trust the contact.
            </div>,
            cancelText: 'Download anyway',
            confirmText: 'Cancel',
            onConfirm: () => {
                return
            },
            onCancel: () => {
                download()
            }
        })
        return
    }
    else{
        download()
    }
  };

const MessageFile = ({ message, side, file, deleteMode=false, maxHeight="300px" }) => {
    const {chat} = useChats(message.chatId)
    const isAccepted = chat?.accepted || deleteMode 
    const [decrypted, setDecrypted] = useState(null)
    const [fileMeta, setFileMeta] = useState(file.meta)
    const [canDecrypt, setCanDecrypt] = useState(true)
    const {activeAccount, activeAccountPk} = useWallet()
        let targetAccount = message.fromAccount === activeAccount 
                ? message.toAccount
                : message.fromAccount;
        const isGroupMessage = message?.type === 'group';
        if (isGroupMessage){
            targetAccount = message.fromAccount
        }
        useEffect(() => {
            async function decryptFile() {
                if (!isAccepted) return
                let fileID = file.url.split('/').pop()
                let cachedFile = await readFileToBlobUrl(fileID)
                if (cachedFile) {
                console.log('hit file from file system', fileID)
                setDecrypted(cachedFile)
                // inMemoryMap.set(fileID, cachedFile)
                return
                }
                else if (deleteMode){
                  return
                }
              
                    const worker = new Worker(new URL("../../../../src/worker/fileWorker.js", import.meta.url), { type: "module" });
                    worker.onmessage = async (e) => {
                      if (e.data.status === 'success') {
                        // Handle successful decryption
                        // Toast.show({content: 'saving file', icon: 'loading'});
                        
                        await writeUint8ArrayToFile(
                          e.data.fileID,
                          e.data.decrypted, 
                          {name: file.meta?.name, type: file.meta?.type}
                        );
                      
                        
                        // Toast.show({content: 'file saved', icon: 'success'});
                        console.log("file saved");
                        setCanDecrypt(true)
                        setDecrypted(await readFileToBlobUrl(e.data.fileID));
                      } else {
                        // Handle error
                        setCanDecrypt(false)
                        console.error("Decryption failed:", e.data.error);
                        // Toast.show({content: 'Decryption failed', icon: 'fail'});
                      }
                      
                      // Terminate the worker when done
                      worker.terminate();
                    };
                    let decryptionKey = activeAccountPk;
                    if (isGroupMessage) {
                        decryptionKey = await getSharedKey(message.chatId, message.toAccount, activeAccountPk);
                    }
                    
                    console.log('decrypting file', fileID)
                    // Start the worker with the necessary data
                    worker.postMessage({
                      file,
                      targetAccount,
                      decryptionKey,
                      message,
                      type: 'decrypt',
                    });
                    
                    // Clean up function
                    return () => {
                      worker.terminate();
                    };
            }
            if (isAccepted && activeAccountPk){
                decryptFile()
            }

            return () => {
                ImageViewer.clear() // close the image viewer on unmount
            }
        }, [isAccepted, activeAccountPk])
        

        const fileType = fileMeta?.type
        const fileSize = fileMeta?.size
        const fileName = fileMeta?.name
        // if (!file?.url?.startsWith('https://bucket.nanwallet.com/encrypted-files/')) return null
        if (!isAccepted) return <div>
            <div>
                {fileMeta?.name} - {formatSize(fileMeta?.size)}
            </div>
            <div>File blocked because chat not accepted</div>
        </div>
        if (!decrypted && canDecrypt) return <DotLoading />
        if (!canDecrypt) return <div>
            <Popover content="File no longer available." trigger="click" mode="dark">
                <FileWrongOutline fontSize={48} />
            </Popover>
            </div>
        return (
            <div
            // style={{marginLeft: '10px', marginRight: '10px'}}
            key={message._id}
            className={``}
            // style={{height: '300px'}}
        > 
        {
            !decrypted &&
            // <DotLoading />
        <Skeleton animated style={{"--height": maxHeight, "--border-radius": "8px", "--width": maxHeight}}/>
        }
        
            <div
            style={{
            }}
                className={``}
            >
               {
                decrypted &&
               
                <p
                > 
                {
                    fileType?.startsWith('image') && 

                    <img
                    onClick={() => {
                        ImageViewer.show({image: decrypted})
                    }}
                    src={decrypted} style={{
                        borderRadius: 8,
                        maxHeight: maxHeight,
                    }} />
                }
                {
                    fileType?.startsWith('video') && 
                    <video 
                    preload="metadata"
                    controls
                    style={{
                        borderRadius: 8,
                        height: maxHeight,
                    }}>
                        <source src={decrypted + '#t=0.05'} // #t=0.05 allows to preview the first frame
                         type={fileType} />
                    </video>
                }
                {
                    !fileType?.startsWith('image') && !fileType?.startsWith('video') && decrypted &&
                    <Card>
                        <div 
                         onClick={async () => {
                            await downloadFile(decrypted, fileName, fileType, file.url.split('/').pop())
                         }}
                        style={{display: 'flex', flexDirection: 'row', cursor: 'pointer', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                            <b
                            style={{
                                fontSize: 16,
                                color: 'var(--adm-color-text)',
                            }}
                            >{fileName}</b>
                            <div style={{color: 'var(--adm-color-text-secondary)'}}>
                                {formatSize(fileSize)}
                            </div>
                        </div>
                        <a 
                       
                        target="_blank">
                            <DownlandOutline
                            color="var(--adm-color-text)"
                             fontSize={24} />
                        </a>
                        </div>
                    </Card>
                }

                </p>
             }
            </div>
        </div>
        )
    }   

export default MessageFile;