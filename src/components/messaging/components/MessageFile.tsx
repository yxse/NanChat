import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { useWallet, WalletContext } from "../../Popup";
import { Card, DotLoading, ImageViewer, Skeleton, Toast } from "antd-mobile";
import { convertAddress, formatAmountRaw, formatSize } from "../../../utils/format";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../../app/Network";
import { rawToMega } from "../../../nano/accounts";
import { ConvertToBaseCurrency, FormatBaseCurrency } from "../../app/Home";
import { fetcherMessages, fetcherMessagesNoAuth } from "../fetcher";
import { DownlandOutline } from "antd-mobile-icons";
import { decryptGroupMessage, getSharedKey } from "../../../services/sharedkey";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener, FileOpenerOptions } from '@capacitor-community/file-opener';
import { readFileToBlobUrl, writeUint8ArrayToFile } from "../../../services/capacitor-chunked-file-writer";

const downloadFile = async (content: string, fileName: string, fileType: string, fileId: string )=> {
    if (Capacitor.isNativePlatform()) {
      try {
        Toast.show({icon: 'loading'})
        let filePath = await Filesystem.getUri({directory: Directory.Data, path: fileId})
        const fileOpenerOptions: FileOpenerOptions = {
            filePath: filePath.uri,
            contentType: fileType,
            openWithDefault: true
          };
        Toast.clear()
        await FileOpener.open(fileOpenerOptions);
        
      } catch (error) {
        console.error('Error saving file:', error);
        Toast.show({content: error.message, icon: 'error'})
      }
    } else {
      // Web approach 
      const a = document.createElement('a');
      a.href = content;
      a.download = fileName;
      a.click();
    }
  };

const MessageFile = ({ message, side, file }) => {
    const [decrypted, setDecrypted] = useState(null)
    const [fileMeta, setFileMeta] = useState(file.meta)
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

                let fileID = file.url.split('/').pop()
                let cachedFile = await readFileToBlobUrl(fileID)
                if (cachedFile) {
                console.log('hit file from file system', fileID)
                setDecrypted(cachedFile)
                // inMemoryMap.set(fileID, cachedFile)
                return
                }
              
                    const worker = new Worker(new URL("../../../../src/worker/fileWorker.js", import.meta.url), { type: "module" });
                    worker.onmessage = async (e) => {
                      if (e.data.status === 'success') {
                        // Handle successful decryption
                        Toast.show({content: 'saving file', icon: 'loading'});
                        
                        await writeUint8ArrayToFile(
                          e.data.fileID,
                          e.data.decrypted
                        );
                        
                        Toast.show({content: 'file saved', icon: 'success'});
                        console.log("file saved");
                        
                        setDecrypted(await readFileToBlobUrl(e.data.fileID));
                      } else {
                        // Handle error
                        console.error("Decryption failed:", e.data.error);
                        Toast.show({content: 'Decryption failed', icon: 'error'});
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
                      message
                    });
                    
                    // Clean up function
                    return () => {
                      worker.terminate();
                    };
            }
            decryptFile()
            }, []);
        

        const fileType = fileMeta?.type
        const fileSize = fileMeta?.size
        const fileName = fileMeta?.name
        // if (!file?.url?.startsWith('https://bucket.nanwallet.com/encrypted-files/')) return null
        if (!decrypted) return <DotLoading />
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
        <Skeleton animated style={{"--height": "300px", "--border-radius": "8px", "--width": "300px"}}/>
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
                        maxHeight: '300px',
                    }} />
                }
                {
                    fileType?.startsWith('video') && 
                    <video 
                    preload="metadata"
                    controls
                    style={{
                        borderRadius: 8,
                        height: '300px',
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
                            <b>{fileName}</b>
                            <div style={{color: 'var(--adm-color-text-secondary)'}}>
                                {formatSize(fileSize)}
                            </div>
                        </div>
                        <a 
                       
                        target="_blank">
                            <DownlandOutline fontSize={24} />
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