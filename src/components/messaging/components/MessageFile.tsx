import { box } from "multi-nano-web";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { BiMessageSquare } from "react-icons/bi";
import { useWallet, WalletContext } from "../../Popup";
import { Card, DotLoading, ImageViewer, Skeleton } from "antd-mobile";
import { convertAddress, formatAmountRaw, formatSize } from "../../../utils/format";
import { networks } from "../../../utils/networks";
import useSWR from "swr";
import { fetchAccountInfo, fetchBlock } from "../../app/Network";
import { rawToMega } from "../../../nano/accounts";
import { ConvertToBaseCurrency, FormatBaseCurrency } from "../../app/Home";
import { fetcherMessages, fetcherMessagesNoAuth } from "../fetcher";
import { DownlandOutline } from "antd-mobile-icons";
import { DatabaseService, initSqlStore, inMemoryMap, restoreData, retrieveFileFromCache, saveFileInCache, setData, sqlStore } from "../../../services/database.service";
import { decryptGroupMessage } from "../../../services/sharedkey";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const downloadFile = async (content: string, fileName: string) => {
    if (Capacitor.isNativePlatform()) {
      // Native platform approach (Android, iOS)
      try {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
  
        console.log('File written successfully:', result.uri);

      } catch (error) {
        console.error('Error saving file:', error);
      }
    } else {
      // Web approach - uses your existing code
      const a = document.createElement('a');
      a.href = content;
      a.download = fileName;
      a.click();
    }
  };

const MessageFile = ({ message, side, file }) => {
    const {activeAccount, activeAccountPk} = useWallet()

        const [decrypted, setDecrypted] = useState(null)
        const [fileMeta, setFileMeta] = useState(file.meta)
        const targetAccount = message.fromAccount === activeAccount 
                ? message.toAccount
                : message.fromAccount;
        const isGroupMessage = message.toAccount !== activeAccount && message.fromAccount !== activeAccount;

        // decrypt file
        // 1. get the file data
        // 2. decrypt the file data
        // 3. display the file data
        useEffect(() => {
            const decryptFile = async () => {
                // check if the file is in cache
                const cachedFile = await retrieveFileFromCache(file.url)
                if (cachedFile) {
                    // console.log("hit file from cache", file.url, cachedFile.meta)
                    setDecrypted(cachedFile.data)
                    setFileMeta(cachedFile.meta)
                    return
                }

                // debugger
                const data = await fetch(file.url)
                const fileData = await data.blob()
                console.log("Decrypting file", file.url)
                // convert to base64
                let base64File = await new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.readAsDataURL(fileData)
                    reader.onload = () => resolve(reader.result)
                    reader.onerror = error => reject(error)
                })
                base64File = base64File.split(',')[1] // remove the data:, part
                console.log("Base64 file", base64File)
                let decrypted 
                if (isGroupMessage) {
                    decrypted = await decryptGroupMessage(base64File, message.chatId, message.toAccount, targetAccount, activeAccountPk)
                }
                else {
                    decrypted = box.decrypt(base64File, targetAccount, activeAccountPk)
                }
                console.log("Decrypted file")
                setDecrypted(decrypted)
                // save file in cache
                await saveFileInCache(file.url, file.meta, decrypted)


            }

            decryptFile()
        }, [])

        const fileType = fileMeta?.type
        const fileSize = fileMeta?.size
        const fileName = fileMeta?.name
        // if (!file?.url?.startsWith('https://bucket.nanwallet.com/encrypted-files/')) return null
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
                    controls
                    src={decrypted} style={{}} />
                }
                {
                    !fileType?.startsWith('image') && !fileType?.startsWith('video') && decrypted &&
                    <Card>
                        <div 
                         onClick={async () => {
                            await downloadFile(decrypted, fileName)
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