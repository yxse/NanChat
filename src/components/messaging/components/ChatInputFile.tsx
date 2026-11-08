import React, { useContext, useEffect, useState, useRef } from 'react';
import { ImageUploader, Toast, Button, Avatar, Divider, Modal, ImageViewer } from 'antd-mobile';
import { CameraOutline, FileOutline, FolderOutline, LockOutline, PictureOutline, UserOutline } from 'antd-mobile-icons';
import useSWR from 'swr';
import { fetcherAccount } from '../fetcher';
import { WalletContext } from "../../useWallet";
import { useWallet } from "../../useWallet";
import { box } from 'multi-nano-web';
import { formatSize } from '../../../utils/format';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import { Keyboard } from '@capacitor/keyboard';
import { MdHd, MdOutlineHd } from 'react-icons/md';
import Compressor from 'compressorjs';
import piexif from 'piexifjs';
import { useEncryptedFileSender, MAX_FILE_SIZE_MB } from '../hooks/use-encrypted-file-sender';

const ChatInputFile = ({ username, onUploadStart, onUploadSuccess, onUploadCancel, accountTo, type, allowPaste = false }) => {
    const { activeAccount, activeAccountPk } = useWallet();
    const pasteAreaRef = useRef(null);
    const { t } = useTranslation();
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
                             try {
                if (Capacitor.getPlatform() !== "web") {
                  document.querySelector('#message-input').blur()
                }
              } catch (error) {
                
              }
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
        const isSmallEnough = file.size / 1024 / 1024 < MAX_FILE_SIZE_MB;
        if (!isSmallEnough) {
            Toast.show({
                content: `File must be smaller than ${MAX_FILE_SIZE_MB}MB`,
                position: 'bottom',
            });
            return false;
        }
        
        return true;
    };
    

    
    const { sendFile } = useEncryptedFileSender({ accountTo, onUploadStart, onUploadSuccess, onUploadCancel });

    const compressImage = (file) => {
      return new Promise((resolve, reject) => {
        new Compressor(file, {
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1920,
          success: resolve,
          error: reject,
        });
      });
    };

    const stripExifData = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const dataUrl = e.target.result;
            const exifData = piexif.load(dataUrl);
            const orientation = exifData['0th']?.[piexif.ImageIFD.Orientation];
            const newExif = { '0th': {}, Exif: {}, GPS: {}, Interop: {}, '1st': {} };
            if (orientation) {
              newExif['0th'][piexif.ImageIFD.Orientation] = orientation;
            }
            const exifBytes = piexif.dump(newExif);
            const cleaned = piexif.insert(exifBytes, dataUrl);
            const binary = atob(cleaned.split(',')[1]);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              array[i] = binary.charCodeAt(i);
            }
            resolve(new Blob([array], { type: file.type }));
          } catch (err) {
            resolve(file);
          }
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
      });
    };

    const confirmSend = async ({ droppedFiles }) => {
  const file = droppedFiles[0];
  const objectURL = URL.createObjectURL(file);
  
  let imageDimensions = null;
  
  const isImage = file.type.startsWith('image');

  let isHd = false;
  let compressPromise = null;
  let onCompressedReady = null;

  // Pre-compress image in background for faster send
  if (isImage) {
    compressPromise = compressImage(file).then(compressed => {
      if (onCompressedReady) onCompressedReady(compressed.size);
      return compressed;
    }).catch(() => null);
  }
  
  const cleanup = () => {
    URL.revokeObjectURL(objectURL);
  };

  const ConfirmContent = () => {
    const [hd, setHd] = React.useState(false);
    const [compressedSize, setCompressedSize] = React.useState(null);

    React.useEffect(() => {
      onCompressedReady = (size) => setCompressedSize(size);
      // Check if already resolved
      if (compressPromise) {
        compressPromise.then(compressed => {
          if (compressed) setCompressedSize(compressed.size);
        });
      }
      return () => { onCompressedReady = null; };
    }, []);

    const displaySize = () => {
      if (!isImage || hd) return formatSize(file.size);
      if (file.size <= 0.8 * 1024 * 1024) return formatSize(file.size);
      if (compressedSize !== null) return formatSize(compressedSize);
      return `...` // waiting for compression result
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
          Send File
          {isImage && (
            <span
              onClick={() => {
                isHd = !isHd;
                setHd(isHd);
              }}
              style={{ cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', color: hd ? 'var(--adm-color-primary)' : 'var(--adm-color-text-secondary)' }}
            >
              {hd ? <MdHd /> : <MdOutlineHd />}
            </span>
          )}
        </div>
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
          {displaySize()}
        </p>
        <div 
          className="flex items-center space-x-2 text-sm mt-2" 
          style={{ color: 'var(--adm-color-text-secondary)' }}
        >
          <LockOutline style={{ marginRight: 8 }} /> 
          File will be end-to-end encrypted.
        </div>
      </div>
    );
  };

  Modal.confirm({
    confirmText: 'Send',
    cancelText: 'Cancel',
    content: <ConfirmContent />,
    onConfirm: () => {
      if (droppedFiles && droppedFiles.length > 0) {
        setFileList([{ url: objectURL, file }]);
        sendFile(file, async () => {
          if (isImage && !isHd) {
            try {
              return await compressPromise || file;
            } catch (error) {
              console.warn('Image compression failed, sending original:', error);
            }
          } else if (isImage && isHd) {
            try {
              return await stripExifData(file);
            } catch (error) {
              console.warn('EXIF stripping failed, sending original:', error);
            }
          }
          return file;
        });
      }
    },
    onCancel: cleanup,
    afterClose: cleanup
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
                    // never called: beforeUpload returns false and confirmSend handles the upload
                    return { url: '' };
                }}
                renderItem={() => null}
                children={
                
                    <div
                                  style={{textAlign: 'center'}}
                              >
                              <Button
                  className='input-file-button'
                  style={{"--border-radius": "12px", "--background-color": isHovering ? "var(--adm-color-primary)" : "var(--adm-color-border)"}}
                  size='large'
                  color={isHovering ? 'primary' : 'default'}
                  
                  >
                      {type === 'file' ?
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