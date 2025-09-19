import React, { useContext, useEffect, useState, useRef } from 'react';
import { ImageUploader, Toast, Button, Avatar, Divider, Modal, ImageViewer } from 'antd-mobile';
import { CameraOutline, FileOutline, FolderOutline, LockOutline, PictureOutline, UserOutline } from 'antd-mobile-icons';
import useSWR from 'swr';
import { fetcherAccount } from '../fetcher';
import { WalletContext } from "../../useWallet";
import { useWallet } from "../../useWallet";
import { box } from 'multi-nano-web';
import { formatSize } from '../../../utils/format';
import { saveFileInCache } from '../../../services/database.service';
import { AiOutlineSwap } from 'react-icons/ai';
import { writeUint8ArrayToFile } from '../../../services/capacitor-chunked-file-writer';
import { getChatToken } from '../../../utils/storage';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import { Keyboard } from '@capacitor/keyboard';

const ChatInputFile = ({ username, onUploadSuccess, accountTo, type, allowPaste = false }) => {
    const { activeAccount, activeAccountPk } = useWallet();
    const pasteAreaRef = useRef(null);
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [fileList, setFileList] = useState([]);
    
    // Handle paste events
    useEffect(() => {
      if (!allowPaste) { // just to prevent double event listener if the component is reused with different type
          return;
      }
        const handlePaste = (e) => {
            if (e.clipboardData && e.clipboardData.items) {
              try {
                if (Capacitor.getPlatform() !== "web") {
                  document.querySelector('#message-input').blur()
                }
              } catch (error) {
                
              }
                const items = e.clipboardData.items;
                
                for (let i = 0; i < items.length; i++) {
                    // Check if the item is a file
                    if (items[i].kind === 'file') {
                        const file = items[i].getAsFile();
                        if (file && beforeUpload(file)) {
                            // Create a preview for the pasted file
                            const pastedFile = {
                                url: URL.createObjectURL(file),
                                file: file,
                            };
                            
                            // Set the file to state and handle upload
                            setFileList([pastedFile]);
                            confirmSend({droppedFiles: [file]});
                            break;
                        }
                    }
                }
            }
        };
        
        // Add event listener to the document or a specific element
        document.addEventListener('paste', handlePaste);
        
        // Cleanup
        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [activeAccount, accountTo]);
    
    const beforeUpload = (file) => {
        // Check file size (100MB max)
        const isLessThan100MB = file.size / 1024 / 1024 < 100;
        if (!isLessThan100MB) {
            Toast.show({
                content: 'File must be smaller than 100MB',
                position: 'bottom',
            });
            return false;
        }
        
        return true;
    };
    

    
    const handleUpload = async (file) => {
        if (!beforeUpload(file)) {
            return;
        }
         const isImage = file.type.startsWith('image');
         let imageDimensions = undefined
        // Get image dimensions if it's an image
        if (isImage) {
            try {
            imageDimensions = await getImageDimensions(file);
            } catch (error) {
            console.warn('Could not get image dimensions:', error);
            }
        }
        setLoading(true);
        try {
            const formData = new FormData();
            
            // Encrypt the file
            Toast.show({
                icon: 'loading',
                content: 'Encrypting file...',
                duration: 0,
            });
            // await new Promise((resolve) => setTimeout(resolve, 200)); 
            // add delay to allow the toast to show, eventually encrypting should be done in a web worker/separate thread to avoid blocking the UI
            // without the delay the box encrypt might takes too much cpu preventing the toast to show
            const worker = new Worker(new URL("../../../../src/worker/fileWorker.js", import.meta.url), { type: "module" });
            let fileUint8Array = new Uint8Array(await file.arrayBuffer());
            worker.onmessage = async (e) => {
                if (e.data.status === 'success') {
                    console.time('encrypt');
                    // console.timeLog('encrypt');
                    // const encrypted = box.encryptFile(fileUint8Array, accountTo, activeAccountPk);
                    let encrypted = e.data.encrypted;
                    console.timeEnd('encrypt');
                    // debugger
                    // return
                    Toast.show({
                        icon: 'loading',
                        content: 'Uploading file...',
                    });
                    debugger
                    formData.append('file', new Blob([encrypted], { type: file.type }));
                    formData.append('fileName', file.name);
                    formData.append('fileType', file.type);
                    formData.append('fileSize', file.size);
                    if (imageDimensions){
                        formData.append('imageHeight', imageDimensions.height);
                        formData.append('imageWidth', imageDimensions.width);
                    }
                    formData.append('account', activeAccount);
                    
                    const response = await fetch(import.meta.env.VITE_PUBLIC_BACKEND +
                        '/upload/upload-encrypted-file', {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'token': await getChatToken(),
                        },
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok || data.error) {
                        // throw new Error(data.error || 'Upload failed');
                        Toast.show({
                            icon: 'fail',
                            content: data.error || 'Upload failed',
                            position: 'center',
                        });
                        return;
                    }
        
                    let fileId = data.url.split('/').pop();
                    await writeUint8ArrayToFile(fileId, fileUint8Array, {
                        name: file.name,
                        type: file.type,
                    })
                     // save the file to the filesystem, before to send, so we can retrieve it instantly on the sender side without need to decrypt again
        
                    onUploadSuccess?.({
                        url: data.url,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        imageDimensions: imageDimensions
                    });
                    
                    Toast.show({
                        icon: 'success',
                        content: 'File sent',
                    });
                    
                    return {
                        url: data.url,
                    }
                } else {
                // Handle error
                console.error("Encryption failed:", e.data.error);
                Toast.show({content: 'Encryption failed', icon: 'error'});
                }
                
                // Terminate the worker when done
                worker.terminate();
            };
            
            // Start the worker with the necessary data
            worker.postMessage({
                file: fileUint8Array,
                targetAccount: accountTo,
                decryptionKey: activeAccountPk,
                message: 'file',
                type: 'encrypt'
            });


            
            
        } catch (error) {
           
            throw new Error(error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const confirmSend = async ({ droppedFiles }) => {
  debugger;
  
  const file = droppedFiles[0];
  const objectURL = URL.createObjectURL(file);
  
  let imageDimensions = null;
  
  const isImage = file.type.startsWith('image');

  
  const cleanup = () => {
    URL.revokeObjectURL(objectURL);
  };

  Modal.confirm({
    title: 'Send File',
    confirmText: 'Send',
    cancelText: 'Cancel',
    content: (
      <div>
        {isImage && (
          <div>
            <img 
              onClick={() => {
                ImageViewer.show({ image: objectURL });
              }}
              src={objectURL} 
              style={{ maxWidth: 200, maxHeight: 200, cursor: 'pointer' }}
              alt={file.name}
            />
          </div>
        )}
        <p>{file.name}</p>
        <p style={{ color: 'var(--adm-color-text-secondary)' }}>
          {formatSize(file.size)}
        </p>
        <div 
          className="flex items-center space-x-2 text-sm mt-2" 
          style={{ color: 'var(--adm-color-text-secondary)' }}
        >
          <LockOutline style={{ marginRight: 8 }} /> 
          File will be end-to-end encrypted.
        </div>
      </div>
    ),
    onConfirm: () => {
      if (droppedFiles && droppedFiles.length > 0) {
        if (beforeUpload(file)) {
          const droppedFile = {
            url: objectURL,
            file: file,
          };
          setFileList([droppedFile]);
          handleUpload(file);
        }
      }
    },
    onCancel: cleanup,
    afterClose: cleanup
  });
};

// Helper function for getting image dimensions
const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};
    // Function to handle drag and drop
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFiles = e.dataTransfer.files
        if (droppedFiles && droppedFiles.length > 0) {
          confirmSend({droppedFiles})
        }
    };
    
    // Prevent default behavior for drag events
    const preventDefaults = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const [isHovering, setIsHovering] = useState(false);
    const refBtn = useRef(null);
    
    useEffect(() => {
      // update hover state when the button is hovered, can't use directly the css button hover since the input file is on top of the button i think so we recreate the hover effect with js
      if (refBtn.current) {
        console.log("native", refBtn.current?.nativeElement)
        refBtn.current?.nativeElement.addEventListener('mouseover', () => {
          console.log("hover")
          setIsHovering(true);
        });
        refBtn.current?.nativeElement.addEventListener('mouseout', () => {
          setIsHovering(false);
        });
      }
    }
    , [refBtn]);

    return (
        <div 
            className=""
            ref={pasteAreaRef}
            onDrop={handleDrop}
            onDragEnter={preventDefaults}
            onDragOver={preventDefaults}
            onDragLeave={preventDefaults}
        >
            {/* Upload Button */}
            <ImageUploader
            capture={type === 'media' ? true : false}
            accept={
              type === 'media' ? 'image/*' : '*'
            }
            ref={refBtn}
                deletable={false}
                value={fileList}
                onChange={(files) => {
                    // keep the latest file
                    if (files.length > 1)
                      setFileList([files[files.length - 1]]);
                    else
                      setFileList(files);
                    
                    confirmSend({droppedFiles: files})
                }}
                maxCount={2}
                showUpload={true}
                beforeUpload={(file) => {
                  confirmSend({droppedFiles: [file]})
                  return false;
                }}
                upload={async (file) => {
                    return handleUpload(file);
                }}
                renderItem={() => null}
                children={
                
                    <div
                                  style={{textAlign: 'center'}}
                              >
                              <Button
                  className='input-file-button'
                  style={{borderRadius: 12}}
                  size='large'
                  loading={loading}
                  disabled={loading}
                  color={isHovering ? 'primary' : 'default'}
                  
                  >
                      {loading ? 'Uploading...' : 
                        type === 'file' ?
                        <div style={{fontSize: 34}}>
                        <FolderOutline />
            </div>
                        // <FolderOutline fontSize={32}/>
                        :
                        <div style={{fontSize: 34}}>
                            {
                            Capacitor.isNativePlatform() ?
                            <CameraOutline />
                            : 
                            <PictureOutline />
                            }
                        
                      </div>
                        // <PictureOutline fontSize={32}/>
                      }
                  </Button>
                              <div className='mt-2'
                              >
                                  {type === 'file' ? t('file') : 
                                  Capacitor.isNativePlatform() ? t('camera') : t('image')}
                              </div>
                              </div>
                  }
            >
                    
            </ImageUploader>
          
        </div>
    );
};

export default ChatInputFile;