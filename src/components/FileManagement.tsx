import React, { useState, useEffect } from 'react';
import { listFilesWithSize, deleteFile } from '../services/capacitor-chunked-file-writer';
import { formatSize } from '../utils/format';
import { restoreData } from '../services/database.service';
import { Button, Checkbox, Modal, DotLoading, NavBar } from 'antd-mobile';
import MessageFile from './messaging/components/MessageFile';
import { useNavigate } from 'react-router-dom';

const FileManagement = () => {
  const [files, setFiles] = useState([]);
  const [totalSize, setTotalSize] = useState<number>(0);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate()
  const fetchFiles = async () => {
    const filesWithSize = await listFilesWithSize();
    setFiles(filesWithSize);
    console.log(filesWithSize)
    const total = filesWithSize.reduce((acc, file) => acc + file.size, 0);
    setTotalSize(total);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async () => {
    Modal.show({
      content: 'Once removed, files cannot be restored',
      closeOnAction: true,
      actions: [
        {
          key: 'cancel',
          text: 'Cancel',
        },
        {
          key: 'delete',
          text: `Remove ${formatSize(selectedSize)}`,
          danger: true,
          onClick: async () => {
            try {
              for (const fileName of selectedFiles) {
                await deleteFile(fileName);
              }
              await fetchFiles(); // Refresh files after deletion
              setSelectedFiles([]);
            } catch (error) {
              console.error('Error deleting files:', error);
            }
          },
        },
      ],
    });
  };

  const selectedSize = files
    .filter(file => selectedFiles.includes(file.name))
    .reduce((acc, file) => acc + file.size, 0);

  if (loading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
        <DotLoading color='primary' />
      </div>
    );
  }

  return (
    <div>
      <NavBar
        onBack={() => {
          navigate('/me/settings')
        }}
      >
        Downloaded Files
      </NavBar>
      <div className='p-3'>
      <p>Total stored files: {formatSize(totalSize)}</p>
      <div className='text-sm' style={{color: "var(--adm-color-text-secondary)"}}>
        Files from chat are automatically downloaded and are only stored on your device. You can free up space by deleting unnecessary files. 
      </div>
      </div>
      <div style={{position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "var(--main-background-color)", padding: 16, zIndex: 10}}>
        <div style={{display: "flex", justifyContent: "space-between", marginBottom: 8}}>
          <div style={{color: "var(--adm-color-text-secondary)", cursor: "pointer"}} onClick={() => {
            if (selectedFiles.length === files.length) {
              setSelectedFiles([]);
            } else {
              setSelectedFiles(files.map(f => f.name));
            }
          }}>
            {selectedFiles.length === files.length ? "Unselect all" : "Select all"}
          </div>
          <div>
            {formatSize(selectedSize)} space to free up
          </div>
        </div>
        <Button
        style={{maxWidth: 128, float: "right"}}
          block
          color='danger'
          disabled={selectedFiles.length <= 0}
          onClick={handleDelete}
          >
          Remove
        </Button>
      </div>
      {
        files?.length === 0 && <div className='p-3'>
            You don't have any downloaded file
            </div>
      }
      <div style={{display: "flex", "flexWrap": "wrap", justifyContent: "space-evenly"}}>
        {files.sort((a, b) => b.size - a.size).map(file => (
          <div key={file.name} style={{display: "flex", alignItems: "center", flexDirection: "column-reverse", margin: 16}}>
            <Checkbox
            style={{marginTop: 8}}
              checked={selectedFiles.includes(file.name)}
              onChange={(checked) => {
                if (checked) {
                  setSelectedFiles([...selectedFiles, file.name]);
                } else {
                  setSelectedFiles(selectedFiles.filter(f => f !== file.name));
                }
              }}
            >
            <div 
              style={{cursor: 'pointer'}}
            >
             {formatSize(file.size)}
            </div>
            </Checkbox>
            <div style={{width: "100%"}}>
              <MessageFile 
              deleteMode
                message={{
                  fromAccount: ""
                }}
                file={{
                  url: "/" + file.name,
                  meta: file.meta
                }} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileManagement;