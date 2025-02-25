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
                    console.log("hit file from cache", file.url, cachedFile.meta)
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
            className={`flex ${side === "from" ? 'justify-end' : 'justify-start'} mb-1 mx-4`}
        > 
        {
            !decrypted &&
        <Skeleton animated style={{"--height": "300px", "--border-radius": "8px", "--width": "70%"}}/>
        }
        
            <div
            style={{
            }}
                className={`max-w-[70%] p-2`}
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
                    src={decrypted} style={{borderRadius: 8}} />
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
                         onClick={() => {
                            const a = document.createElement('a')
                            a.href = decrypted
                            a.download = fileName
                            a.click()
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