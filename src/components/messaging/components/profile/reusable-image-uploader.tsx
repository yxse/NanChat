import React, { useState } from 'react';
import { ImageUploader, Toast, Button } from 'antd-mobile';
import { getChatToken } from '../../../../utils/storage';
import { ProfilePictureUploadButton } from '../icons/ProfilePictureUploadButton';
import { fetcherAccount } from '../../fetcher';
import { useWallet } from '../../../Popup';
import useSWR from 'swr';

const ReusableImageUploader = ({ 
  onUploadSuccess, 
  endpoint = '/upload/upload-image',
  maxSize = 5, // in MB
  additionalFormData = {},
  buttonText = 'Upload Image',
  loadingText = 'Uploading...',
  supportedFormatsText = 'Supported formats: JPG, PNG, GIF',
  showButton = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [currentAvatar, setCurrentAvatar] = useState(null);
  const {activeAccount} = useWallet();
  const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);

  const beforeUpload = (file) => {
    // Check file size
    const isLessThanMaxSize = file.size / 1024 / 1024 < maxSize;
    if (!isLessThanMaxSize) {
      Toast.show({
        content: `Image must be smaller than ${maxSize}MB`,
        position: 'bottom',
      });
      return false;
    }

    // Check file type
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      Toast.show({
        content: 'Only image files are allowed',
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

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      // Add any additional form data
      Object.entries(additionalFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const response = await fetch(import.meta.env.VITE_PUBLIC_BACKEND + endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'token': await getChatToken()
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onUploadSuccess?.(data);
      setCurrentAvatar(data.url);
      onUploadSuccess?.(data.url);
      mutate();

      Toast.show({
        icon: 'success',
        content: 'Image uploaded successfully',
        position: 'bottom',
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

  return (
    <div className="flex flex-col items-center space-y-4">
      <ImageUploader
        deletable={false}
        value={fileList}
        onChange={(files) => {
          // Keep only the latest file
          if (files.length > 1)
            setFileList([files[files.length - 1]]);
          else
            setFileList(files);
        }}
        maxCount={2}
        showUpload={true}
        upload={handleUpload}
        onDelete={() => setFileList([])}
        renderItem={() => null}
      >
        <div className="text-center">
          {
            showButton ? 
            <Button
            shape='rounded'
            block
            color="primary"
            loading={loading}
            disabled={loading}
            >
            {loading ? loadingText : buttonText}
          </Button>
          : 
           <>
           {
             !loading && currentAvatar == null &&
             <ProfilePictureUploadButton />
            }
           {
             currentAvatar &&
             <img
             src={currentAvatar}
             alt="Uploaded"
             style={{ width: 96, height: 96, borderRadius: '50%' }}
             />
            }
            </>
          }
            
        </div>
      </ImageUploader>

      {/* Instructions */}
      {/* <div className="text-center text-gray-500 text-sm mt-2">
        <p>Maximum file size: {maxSize}MB</p>
        <p>{supportedFormatsText}</p>
      </div> */}
    </div>
  );
};

export default ReusableImageUploader;
