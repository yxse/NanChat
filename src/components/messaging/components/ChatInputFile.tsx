import React, { useContext, useEffect, useState, useRef } from 'react';
import { ImageUploader, Toast, Button, Avatar, Divider, Modal, ImageViewer } from 'antd-mobile';
import { FileOutline, FolderOutline, LockOutline, PictureOutline, UserOutline } from 'antd-mobile-icons';
import useSWR from 'swr';
import { fetcherAccount } from '../fetcher';
import { useWallet, WalletContext } from '../../Popup';
import { box } from 'multi-nano-web';
import { formatSize } from '../../../utils/format';
import { saveFileInCache } from '../../../services/database.service';
import { AiOutlineSwap } from 'react-icons/ai';

const ChatInputFile = ({ username, onUploadSuccess, accountTo, type, allowPaste = false }) => {
    const { activeAccount, activeAccountPk } = useWallet();
    const pasteAreaRef = useRef(null);
    
    const [loading, setLoading] = useState(false);
    const [fileList, setFileList] = useState([]);
    
    // Handle paste events
    useEffect(() => {
      if (!allowPaste) { // just to prevent double event listener if the component is reused with different type
          return;
      }
        const handlePaste = (e) => {
            if (e.clipboardData && e.clipboardData.items) {
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
    
    function getBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
    
    const handleUpload = async (file) => {
        if (!beforeUpload(file)) {
            return;
        }
        
        setLoading(true);
        try {
            const formData = new FormData();
            const fileBase64 = await getBase64(file);
            
            // Encrypt the file
            Toast.show({
                icon: 'loading',
                content: 'Encrypting file...',
            });
            await new Promise((resolve) => setTimeout(resolve, 200)); 
            // add delay to allow the toast to show, eventually encrypting should be done in a web worker/separate thread to avoid blocking the UI
            // without the delay the box encrypt might takes too much cpu preventing the toast to show
            const encrypted = box.encrypt(fileBase64, accountTo, activeAccountPk);
            Toast.show({
                icon: 'loading',
                content: 'Uploading file...',
            });
            formData.append('file', encrypted);
            formData.append('fileName', file.name);
            formData.append('fileType', file.type);
            formData.append('fileSize', file.size);
            formData.append('account', activeAccount);
            
            const response = await fetch(import.meta.env.VITE_PUBLIC_BACKEND +
                '/upload/upload-encrypted-file', {
                method: 'POST',
                body: formData,
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }
            await saveFileInCache(data.url, {
                type: file.type,
                size: file.size,
                name: file.name,
            }, fileBase64);
            onUploadSuccess?.({
                url: data.url,
                name: file.name,
                type: file.type,
                size: file.size,
            });
            
            Toast.show({
                icon: 'success',
                content: 'File sent',
            });
            
            return {
                url: data.url,
            }
            
        } catch (error) {
            Toast.show({
                icon: 'fail',
                content: error.message || 'Upload failed',
                position: 'bottom',
            });
            throw new Error(error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const confirmSend = ({ droppedFiles }) => {
      Modal.confirm({
        title: 'Send File',
        confirmText: 'Send',
        cancelText: 'Cancel',
        content: <div>
          {
            // only for images
            droppedFiles[0].type.startsWith('image') &&
            <img 
            onClick={() => {
              ImageViewer.show({image: URL.createObjectURL(droppedFiles[0])})
            }}
            src={URL.createObjectURL(droppedFiles[0])} style={{maxWidth: 200, maxHeight: 200}}/>
          }
          <p>{droppedFiles[0].name}</p>
          <p
          style={{color: 'var(--adm-color-text-secondary)'}}
          >{formatSize(droppedFiles[0].size)}</p>
          <div className="flex items-center space-x-2 text-sm mt-2" style={{color: 'var(--adm-color-text-secondary)'}}>
            <LockOutline  style={{marginRight: 8}}/> File will be end-to-end encrypted. 
          </div>
        </div>,
        onConfirm: () => {
          if (droppedFiles && droppedFiles.length > 0) {
            const file = droppedFiles[0];
            if (beforeUpload(file)) {
                const droppedFile = {
                    url: URL.createObjectURL(file),
                    file: file,
                };
                setFileList([droppedFile]);
                handleUpload(file);
            }
        }
      }
    });
    }
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
        console.log("native", refBtn.current.nativeElement)
        refBtn.current.nativeElement.addEventListener('mouseover', () => {
          console.log("hover")
          setIsHovering(true);
        });
        refBtn.current.nativeElement.addEventListener('mouseout', () => {
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
                        📁
            </div>
                        // <FolderOutline fontSize={32}/>
                        :
                        <div style={{fontSize: 34}}>
                        📷  
                      </div>
                        // <PictureOutline fontSize={32}/>
                      }
                  </Button>
                              <div className='mt-2'
                              >
                                  {type === 'file' ? 'File' : 'Media'}
                              </div>
                              </div>
                  }
            >
                    
            </ImageUploader>
          
        </div>
    );
};

export default ChatInputFile;