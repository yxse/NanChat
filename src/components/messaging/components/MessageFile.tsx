import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { WalletContext } from "../../useWallet";
import { useWallet } from "../../useWallet";
import { Card, DotLoading, ImageViewer, Modal, Popover, ProgressBar, ProgressCircle, Skeleton, SpinLoading, Toast } from "antd-mobile";
import { formatAmountRaw, formatSize } from "../../../utils/format";
import { convertAddress } from "../../../utils/convertAddress";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../../app/Network";
import { rawToMega } from "../../../nano/accounts";
import { fetcherMessages, fetcherMessagesNoAuth } from "../fetcher";
import { CloseOutline, DownlandOutline, ExclamationCircleFill, FileWrongOutline, RedoOutline } from "antd-mobile-icons";
import { decryptGroupMessage, getSharedKey } from "../../../services/sharedkey";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener, FileOpenerOptions } from '@capacitor-community/file-opener';
import { fileIDsBeingDecrypted, readFileToBlobUrl, writeUint8ArrayToFile } from "../../../services/capacitor-chunked-file-writer";
import { setData } from "../../../services/database.service";
import { isDangerousFileName, isDangerousMimeType, sanitizeFileName } from "../utils";
import { getLocalFileName, getOpenableFileName } from "../../../services/file-url";
import { useChats } from "../hooks/use-chats";
import { useUploadState } from "../../../services/upload-progress";
import { useTranslation } from "react-i18next";

const downloadFile = async (content: string, fileName: string, fileType: string, fileId: string )=> {
    const download = async () => {
        if (Capacitor.isNativePlatform()) {
            Toast.show({icon: 'loading'})
            let filePath = await Filesystem.getUri({directory: Directory.Data, path: fileId})
            try {
              // the cached copy may carry a .txt suffix (see getLocalFileName), but the native opener picks
              // the document type from the extension: open a copy named after the real file instead
              const diskName = fileId.endsWith('.txt') ? getOpenableFileName(safeName) : null
              if (diskName) {
                await Filesystem.rmdir({directory: Directory.Cache, path: 'opened-files', recursive: true}).catch(() => {}) // previous copies
                await Filesystem.mkdir({directory: Directory.Cache, path: `opened-files/${fileId}`, recursive: true}) // copy does not create it on iOS
                await Filesystem.copy({from: fileId, directory: Directory.Data, to: `opened-files/${fileId}/${diskName}`, toDirectory: Directory.Cache})
                filePath = await Filesystem.getUri({directory: Directory.Cache, path: `opened-files/${fileId}/${diskName}`})
              }
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
            a.download = safeName;
            a.click();
          }
    }
    const safeName = sanitizeFileName(fileName)
    let extension = "." + safeName.split('.').pop()
    const dangerousType = !isDangerousFileName(fileName) && isDangerousMimeType(fileType) // e.g. "photo.jpg" sent as an apk
    if (isDangerousFileName(fileName) || dangerousType) {
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
                {dangerousType ? <>This file has the type <b>{fileType}</b></> : <>This file has the extension <b>{extension}</b></>} <br/> It may steal your funds or harm your computed if executed. Continue only if you trust the contact.
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


// Progress indicator of a file being sent: ring over the preview for media, bar under the name for other files
const UploadProgress = ({ localId, compact = false }) => {
    const upload = useUploadState(localId)
    const stage = upload?.stage || 'preparing'
    const size = compact ? 32 : 48
    const color = compact ? 'var(--adm-color-primary)' : '#fff' // compact: on a file card, otherwise over a dimmed preview

    if (stage === 'error') {
        return (
            <div onClick={(e) => { e.stopPropagation(); upload?.retry?.() }} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div className={compact ? "upload-progress-button compact" : "upload-progress-button"} style={{ width: size, height: size }}>
                    <RedoOutline fontSize={size / 2} />
                </div>
                <div className={compact ? "upload-progress-button compact" : "upload-progress-button"} style={{ width: size, height: size }} onClick={(e) => { e.stopPropagation(); upload?.cancel?.() }}>
                    <CloseOutline fontSize={size / 2} />
                </div>
            </div>
        )
    }
    return (
        <div onClick={(e) => { e.stopPropagation(); upload?.cancel?.() }} style={{ position: 'relative', width: size, height: size, cursor: 'pointer' }}>
            <div className={compact ? "upload-progress-button compact" : "upload-progress-button"} style={{ width: size, height: size }}>
                <CloseOutline fontSize={size / 2.4} />
            </div>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {stage === 'uploading' ?
                    <ProgressCircle
                        percent={Math.max(4, Math.round((upload?.progress || 0) * 100))}
                        style={{ '--size': `${size}px`, '--track-width': '3px', '--track-color': 'transparent', '--fill-color': color }}
                    />
                    :
                    <SpinLoading color={color} style={{ '--size': `${size}px` }} />
                }
            </div>
        </div>
    )
}

const UploadStatusText = ({ localId, fileSize }) => {
    const { t } = useTranslation()
    const upload = useUploadState(localId)
    const stage = upload?.stage || 'preparing'
    if (stage === 'error') return <span style={{ color: 'var(--adm-color-danger)' }}>{upload?.error || t('uploadFailed')} · {t('uploadRetry')}</span>
    if (stage === 'uploading') return <span>{formatSize((upload?.progress || 0) * fileSize)} / {formatSize(fileSize)}</span>
    return <span>{stage === 'encrypting' ? t('uploadEncrypting') : t('uploadPreparing')}</span>
}

const UploadProgressBar = ({ localId }) => {
    const upload = useUploadState(localId)
    if (upload?.stage !== 'uploading') return null
    return <ProgressBar percent={Math.round((upload?.progress || 0) * 100)} style={{ '--track-width': '3px', marginTop: 6 }} />
}

// Global promise map to track ongoing decryptions
const decryptionPromises = new Map();

// non-media file card: a fixed width, otherwise it grows with the file name (one line, nowrap) and a long name
// overflows the screen (horizontal scroll on iOS); with it the name is cut with an ellipsis
const FILE_CARD_STYLE = { width: 240, maxWidth: 'calc(100vw - 120px)', boxSizing: 'border-box' } as const;

const MessageFile = ({ message, side, file, deleteMode=false, maxHeight="300px" }) => {
    const { t } = useTranslation()
    const {chat} = useChats(message.chatId)
    const isAccepted = chat?.accepted || deleteMode 
    const [decrypted, setDecrypted] = useState(file.previewUrl || null) // previewUrl: local copy of a file we just sent, no need to wait for the cache
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

    const fileID = getLocalFileName(file.url) // null if the url is not one of our attachments

    // Create decryption function that returns a promise
    const createDecryptionPromise = useCallback(async () => {
        return new Promise(async (resolve, reject) => {
            let worker = null;

            try {
                if (!fileID) {
                    resolve(null); // shown as unavailable
                    return;
                }
                // Check if file is already cached first
                const cachedFile = await readFileToBlobUrl(fileID);
                if (cachedFile) {
                    console.log('blob resolved', fileID);
                    resolve(cachedFile);
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
                                fileID,
                                e.data.decrypted, 
                                {name: file.meta?.name, type: file.meta?.type}
                            );
                            
                            console.log("file saved");
                            
                            const uri = await readFileToBlobUrl(fileID);
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
            if (!isAccepted || !activeAccountPk || message.uploading) return;
            
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
    }, [isAccepted, activeAccountPk, fileID, createDecryptionPromise, message.uploading]);

    const fileType = file.meta?.type
    const fileSize = file.meta?.size
    const fileName = sanitizeFileName(file.meta?.name) // what is shown must match the extension checked before opening

    let heightImage = +(maxHeight.split('px')[0])
    let widthImage = file.meta?.width
    let heightConstrained = false

    // Check if height needs to be constrained
    if(file.meta?.height < heightImage){
        heightImage = file.meta?.height
    } else {
        heightConstrained = true
    }

    // Calculate width based on aspect ratio if height was constrained
    if (heightConstrained && file.meta?.height && file.meta?.width) {
        const aspectRatio = file.meta.width / file.meta.height
        widthImage = heightImage * aspectRatio
    }

    // Check if width needs to be constrained
    const widthChatRoom = document.getElementById('scrollableDiv')?.clientWidth || 300
    const maxWidthAllowed = widthChatRoom - (8*2) - 56 // minus margin and minus pfp

    if (widthChatRoom && widthImage > maxWidthAllowed) {
        widthImage = maxWidthAllowed
        
        // If width is constrained, recalculate height to maintain aspect ratio
        if (file.meta?.height && file.meta?.width) {
            const aspectRatio = file.meta.height / file.meta.width
            heightImage = widthImage * aspectRatio
        }
    }
    
    const isSVG = fileType === 'image/svg+xml';
    const isMedia = !isSVG && (fileType?.startsWith('image') || fileType?.startsWith('video'))

    // Early returns for different states
    if (message.uploading) {
        if (isMedia) return (
            <div key={message._id + "file"} style={{ height: heightImage }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    {fileType?.startsWith('image') ?
                        <img src={file.previewUrl} style={{ borderRadius: 8, maxHeight: maxHeight, display: 'block' }} />
                        :
                        <video src={file.previewUrl + '#t=0.05'} preload="metadata" muted playsInline style={{ borderRadius: 8, height: maxHeight, display: 'block' }} />
                    }
                    <div className="upload-progress-overlay">
                        <UploadProgress localId={message._id} />
                    </div>
                </div>
            </div>
        )
        return (
            <div key={message._id + "file"}>
                <Card style={FILE_CARD_STYLE}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <b style={{ fontSize: 16, color: 'var(--adm-color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {fileName}
                            </b>
                            <div style={{ color: 'var(--adm-color-text-secondary)' }}>
                                <UploadStatusText localId={message._id} fileSize={fileSize} />
                            </div>
                            <UploadProgressBar localId={message._id} />
                        </div>
                        <UploadProgress localId={message._id} compact />
                    </div>
                </Card>
            </div>
        )
    }

    if (!isAccepted) return (
        <div style={{ overflowWrap: 'anywhere' }}>
            <div>
                {fileName} - {formatSize(file.meta?.size)}
            </div>
            <div>File blocked because chat not accepted</div>
        </div>
    )
    
    // other files: a card with the name and size, known without decrypting. Rendered right away (a spinner in place
    // of the download icon until the file is ready) rather than a media sized placeholder that then shrinks
    if (!isMedia) {
        maxHeight = "72px"
        heightImage = 72
    }

    // file deleted / expired: a placeholder of the same size as the file it replaces (no content shift when the
    // download fails after the loading placeholder was shown)
    if (!canDecrypt) {
        if (isMedia) return (
            <div key={message._id + "file"} style={{
                height: file.meta?.height ? heightImage : +(maxHeight.split('px')[0]),
                width: file.meta?.height && widthImage ? widthImage : 220,
                maxWidth: '100%',
                boxSizing: 'border-box',
                borderRadius: 8,
                backgroundColor: 'var(--adm-color-fill-content)',
                color: 'var(--adm-color-weak)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 8,
                textAlign: 'center',
                fontSize: 13,
            }}>
                <FileWrongOutline fontSize={32} />
                <span>{t('fileUnavailable')}</span>
            </div>
        )
        return (
            <div key={message._id + "file"} style={{ height: heightImage }}>
                <Card style={FILE_CARD_STYLE}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <b style={{ fontSize: 16, color: 'var(--adm-color-weak)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {fileName}
                            </b>
                            <div style={{ color: 'var(--adm-color-text-secondary)' }}>
                                {t('fileUnavailable')}
                            </div>
                        </div>
                        <FileWrongOutline color="var(--adm-color-weak)" fontSize={24} style={{ flex: 'none' }} />
                    </div>
                </Card>
            </div>
        )
    }

    if (!decrypted && canDecrypt && isMedia) return <div key={message._id + "file"} className={``} >
        <Skeleton animated style={{
            "--height": `${file.meta?.height ? heightImage : +(maxHeight.split('px')[0])}px`,
            "--border-radius": "8px",
            "--width": `${file.meta?.height && widthImage ? widthImage : 220}px`,
        }}/>
    </div>
    // Main render - only when decrypted exists
    return (
        <div key={message._id + "file"} className={``} style={{
            height: heightImage // height here fix message shift in the virtualizer
            }}>
            <div className={``}>
                <div> 
                    {!isSVG && fileType?.startsWith('image') && 
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
                            key={decrypted} // a <video> ignores <source> changes: remount when the preview blob is replaced by the cached file
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
                    {(isSVG || !fileType?.startsWith('image')) && !fileType?.startsWith('video') && 
                        <Card style={FILE_CARD_STYLE}>
                            <div 
                                onClick={async () => {
                                    if (!decrypted) return // still loading
                                    await downloadFile(decrypted, fileName, fileType, fileID!)
                                }}
                                style={{
                                    display: 'flex', 
                                    flexDirection: 'row', 
                                    cursor: decrypted ? 'pointer' : 'default', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    gap: 8
                                }}
                            >
                                <div style={{display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1}}>
                                    <b style={{
                                        fontSize: 16,
                                        color: 'var(--adm-color-text)',
                                        // one line: the card is laid out in a fixed 72px high row
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {fileName}
                                    </b>
                                    <div style={{color: 'var(--adm-color-text-secondary)'}}>
                                        {formatSize(fileSize)}
                                    </div>
                                </div>
                                {decrypted ?
                                <a target="_blank">
                                    <DownlandOutline
                                        color="var(--adm-color-text)"
                                        fontSize={24} 
                                    />
                                </a>
                                : <SpinLoading style={{ '--size': '24px', flex: 'none' }} />}
                            </div>
                        </Card>
                    }
                </div>
            </div>
        </div>
    )
}   

export default MessageFile