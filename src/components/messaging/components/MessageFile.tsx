import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState, useCallback } from "react";
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
import { fileIDsBeingDecrypted, readFileToBlobUrl, writeUint8ArrayToFile } from "../../../services/capacitor-chunked-file-writer";
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


// Global promise map to track ongoing decryptions
const decryptionPromises = new Map();

const MessageFile = ({ message, side, file, deleteMode=false, maxHeight="300px" }) => {
    const {chat} = useChats(message.chatId)
    const isAccepted = chat?.accepted || deleteMode 
    const [decrypted, setDecrypted] = useState(null)
    const [fileMeta, setFileMeta] = useState(file.meta)
    const [canDecrypt, setCanDecrypt] = useState(true)
    const {activeAccount, activeAccountPk} = useWallet()
    
    console.log(file.meta)
    
    let targetAccount = message.fromAccount === activeAccount 
            ? message.toAccount
            : message.fromAccount;
    const isGroupMessage = message?.type === 'group';
    if (isGroupMessage){
        targetAccount = message.fromAccount
    }

    const fileID = file.url.split('/').pop()

    // Create decryption function that returns a promise
    const createDecryptionPromise = useCallback(async () => {
        return new Promise(async (resolve, reject) => {
            let worker = null;
            
            try {
                // Check if file is already cached first
                const cachedFile = await readFileToBlobUrl(fileID);
                if (cachedFile) {
                    console.log('hit file from file system', fileID);
                    resolve(cachedFile);
                    return;
                }

                if (deleteMode) {
                    resolve(null);
                    return;
                }

                // Mark as being decrypted
                fileIDsBeingDecrypted.add(fileID);
                
                worker = new Worker(new URL("../../../../src/worker/fileWorker.js", import.meta.url), { type: "module" });
                
                worker.onmessage = async (e) => {
                    try {
                        if (e.data.status === 'success') {
                            console.log("file save success", e);
                            
                            // Save the file
                            await writeUint8ArrayToFile(
                                e.data.fileID,
                                e.data.decrypted, 
                                {name: file.meta?.name, type: file.meta?.type}
                            );
                            
                            console.log("file saved");
                            
                            const uri = await readFileToBlobUrl(e.data.fileID);
                            console.log({uri, decrypted: uri});
                            resolve(uri);
                        } else {
                            reject(new Error(e.data.error || 'Decryption failed'));
                        }
                    } catch (error) {
                        reject(error);
                    } finally {
                        if (worker) {
                            worker.terminate();
                            worker = null;
                        }
                    }
                };
                
                worker.onerror = (error) => {
                    console.error("Worker error:", error);
                    reject(error);
                    if (worker) {
                        worker.terminate();
                        worker = null;
                    }
                };

                let decryptionKey = activeAccountPk;
                if (isGroupMessage) {
                    decryptionKey = await getSharedKey(message.chatId, message.toAccount, activeAccountPk);
                }
                
                console.log('Starting decryption for file', fileID);
                
                // Start the worker with the necessary data
                worker.postMessage({
                    file,
                    targetAccount,
                    decryptionKey,
                    message,
                    type: 'decrypt',
                });

            } catch (error) {
                reject(error);
                if (worker) {
                    worker.terminate();
                    worker = null;
                }
            }
        });
    }, [fileID, deleteMode, file, targetAccount, message, isGroupMessage, activeAccountPk]);

    useEffect(() => {
        let isMounted = true;
        
        async function decryptFile() {
            if (!isAccepted || !activeAccountPk) return;
            
            try {
                let decryptionPromise;
                
                // Check if decryption is already in progress
                if (decryptionPromises.has(fileID)) {
                    console.log('Waiting for existing decryption of file:', fileID);
                    decryptionPromise = decryptionPromises.get(fileID);
                } else {
                    // Create new decryption promise
                    decryptionPromise = createDecryptionPromise();
                    decryptionPromises.set(fileID, decryptionPromise);
                    
                    // Cleanup promise when done (success or failure)
                    decryptionPromise.finally(() => {
                        decryptionPromises.delete(fileID);
                        fileIDsBeingDecrypted.delete(fileID);
                    });
                }
                
                // Wait for decryption to complete
                const result = await decryptionPromise;
                
                // Only update state if component is still mounted
                if (isMounted) {
                    if (result) {
                        setDecrypted(result);
                        setCanDecrypt(true);
                    } else {
                        setCanDecrypt(false);
                    }
                }
                
            } catch (error) {
                console.error("Error processing file decryption:", error);
                if (isMounted) {
                    if (!error?.message?.includes('File is already being saved')) {
                        setCanDecrypt(false);
                    }
                }
            }
        }
        
        decryptFile();

        // Cleanup function
        return () => {
            isMounted = false;
            ImageViewer.clear(); // close the image viewer on unmount
        };
    }, [isAccepted, activeAccountPk, fileID, createDecryptionPromise]);

    const fileType = fileMeta?.type
    const fileSize = fileMeta?.size
    const fileName = fileMeta?.name
    
    let heightImage = +(maxHeight.split('px')[0])
    let widthImage = fileMeta?.width
    let heightConstrained = false

    // Check if height needs to be constrained
    if(fileMeta?.height < heightImage){
        heightImage = fileMeta?.height
    } else {
        heightConstrained = true
    }

    // Calculate width based on aspect ratio if height was constrained
    if (heightConstrained && fileMeta?.height && fileMeta?.width) {
        const aspectRatio = fileMeta.width / fileMeta.height
        widthImage = heightImage * aspectRatio
    }

    // Check if width needs to be constrained
    const widthChatRoom = document.getElementById('scrollableDiv')?.clientWidth || 300
    const maxWidthAllowed = widthChatRoom - (8*2) - 56 // minus margin and minus pfp

    if (widthChatRoom && widthImage > maxWidthAllowed) {
        widthImage = maxWidthAllowed
        
        // If width is constrained, recalculate height to maintain aspect ratio
        if (fileMeta?.height && fileMeta?.width) {
            const aspectRatio = fileMeta.height / fileMeta.width
            heightImage = widthImage * aspectRatio
        }
    }
    
    // Early returns for different states
    if (!isAccepted) return (
        <div>
            <div>
                {fileMeta?.name} - {formatSize(fileMeta?.size)}
            </div>
            <div>File blocked because chat not accepted</div>
        </div>
    )
    
    if (!canDecrypt) return (
        <div>
            <Popover content="File no longer available." trigger="click" mode="dark">
                <FileWrongOutline fontSize={48} />
            </Popover>
        </div>
    )
    
    if (!decrypted && canDecrypt) return <div>
        {fileMeta.height ? 
        <Skeleton animated style={{"--height": `${heightImage}px`, "--border-radius": "8px", "--width": `${widthImage}px`}}/>
        : 
        <Skeleton animated style={{"--height": `75px`, "--border-radius": "8px", "--width": `220px`}}/> // for file card
        }
    </div>

    // Main render - only when decrypted exists
    return (
        <div key={message._id} className={``}>
            <div className={``}>
                <p> 
                    {fileType?.startsWith('image') && 
                        <img
                            onClick={() => {
                                ImageViewer.show({image: decrypted})
                            }}
                            src={decrypted} 
                            style={{
                                borderRadius: 8,
                                maxHeight: maxHeight,
                            }} 
                        />
                    }
                    {fileType?.startsWith('video') && 
                        <video 
                            preload="metadata"
                            controls
                            style={{
                                borderRadius: 8,
                                height: maxHeight,
                            }}
                        >
                            <source src={decrypted + '#t=0.05'} type={fileType} />
                        </video>
                    }
                    {!fileType?.startsWith('image') && !fileType?.startsWith('video') && 
                        <Card>
                            <div 
                                onClick={async () => {
                                    await downloadFile(decrypted, fileName, fileType, file.url.split('/').pop())
                                }}
                                style={{
                                    display: 'flex', 
                                    flexDirection: 'row', 
                                    cursor: 'pointer', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    gap: 8
                                }}
                            >
                                <div style={{display: 'flex', flexDirection: 'column'}}>
                                    <b style={{
                                        fontSize: 16,
                                        color: 'var(--adm-color-text)',
                                    }}>
                                        {fileName}
                                    </b>
                                    <div style={{color: 'var(--adm-color-text-secondary)'}}>
                                        {formatSize(fileSize)}
                                    </div>
                                </div>
                                <a target="_blank">
                                    <DownlandOutline
                                        color="var(--adm-color-text)"
                                        fontSize={24} 
                                    />
                                </a>
                            </div>
                        </Card>
                    }
                </p>
            </div>
        </div>
    )
}   

export default MessageFile;