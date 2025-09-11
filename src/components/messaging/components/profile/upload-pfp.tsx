import React, { useContext, useEffect, useState } from 'react';
import { ImageUploader, Toast, Button, Avatar, Divider } from 'antd-mobile';
import { AddCircleOutline, CameraOutline, PictureOutline, UserOutline } from 'antd-mobile-icons';
import { WalletContext } from "../../../useWallet";
import { convertAddress } from "../../../../utils/convertAddress";
import useSWR from 'swr';
import { fetcherAccount, fetcherMessages, fetcherMessagesPost } from '../../fetcher';
import { accountIconUrl } from '../../../app/Home';
import { networks } from '../../../../utils/networks';
import { ArtImages } from '../../../app/Art';
import { getChatToken } from '../../../../utils/storage';
import { AiOutlinePlus } from 'react-icons/ai';
import { NoAvatar } from '../icons/NoAvatar';
import ReusableImageUploader from './reusable-image-uploader';
import { ProfilePictureUploadButton } from '../icons/ProfilePictureUploadButton';





const ProfilePictureUpload = ({ username, onUploadSuccess }) => {
    const { wallet } = useContext(WalletContext)
    const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, "XNO");

    const {data: me, isLoading, mutate} = useSWR(activeAccount, fetcherAccount);

  const [loading, setLoading] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState(null);
    const [fileList, setFileList] = useState([]);
  const beforeUpload = (file) => {
    // Check file size (5MB)
    const isLessThan5MB = file.size / 1024 / 1024 < 5;
    if (!isLessThan5MB) {
      Toast.show({
        content: 'Image must be smaller than 5MB',
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

  const getAvatar = (url) => {
    if (url == null) return accountIconUrl(activeAccount)
    
  }
  useEffect(() => {
    if (me && me.profilePicture) {
      setCurrentAvatar(me.profilePicture.url);
    }
}, [me, activeAccount]);


  const handleUpload = async (file) => {
    if (!beforeUpload(file)) {
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      formData.append('account', activeAccount)

      const response = await fetch(import.meta.env.VITE_PUBLIC_BACKEND +
        '/upload/upload-profile-picture', {
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

      console.log(data.url);
      setCurrentAvatar(data.url);
      onUploadSuccess?.(data.url);

      Toast.show({
        icon: 'success',
        content: 'Profile picture updated successfully',
        position: 'bottom',
      });
      mutate();
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

  console.log(Object.keys(networks));
  let allIcons = Object.keys(networks).filter((network) => networks[network].icon != null);
  console.log(allIcons);  

  const handleProfilePictureSuccess = (data) => {
    setCurrentAvatar(data.url);
    onUploadSuccess?.(data.url);
    mutate();
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      {/* Current Avatar Display */}
      <div className="mb-4">
        {
          currentAvatar == null ?
          null
          : 
          <Avatar
          src={currentAvatar}
          style={{ width: 96, height: 96 }}
          fallback={<NoAvatar />}
          />
        }
      </div>

      {/* Upload Button */}
      <ReusableImageUploader
      showButton={!currentAvatar == null}
        endpoint="/upload/upload-profile-picture"
        additionalFormData={{ account: activeAccount }}
        onUploadSuccess={handleProfilePictureSuccess}
        buttonText="Select Profile Picture"
        loadingText="Uploading..."
      />
      <Divider style={{marginTop: 32}}>
      Or choose from:  
      </Divider>
      
      <div className="flex flex-row space-x-4 items-center">
      {
        allIcons.map((icon) => {
            return (
                <img 
                key={icon}
                onClick={async () => {
                    setCurrentAvatar(networks[icon].icon + convertAddress(activeAccount, icon));
                    fetcherMessagesPost('/upload/update-pfp', {
                      url: networks[icon].icon + convertAddress(activeAccount, icon),
                    }).then((res) => {
                        console.log(res);
                        if (!res?.error) {
                            Toast.show({
                                icon: 'success',
                            });
                            mutate();
                        }

                    });
                }}
                src={networks[icon].icon + convertAddress(activeAccount, icon)} style={{width: 64}} />
            )
        })
      }
      </div>
      <ArtImages onImageClick={({image: url}) => {
          setCurrentAvatar(url);
          fetcherMessagesPost('/upload/update-pfp', {
              url,
          }).then((res) => {
              console.log(res);
              if (!res?.error) {
                  Toast.show({
                      icon: 'success',
                      content: 'Profile picture updated successfully',
                      position: 'bottom',
                  });
                  mutate();
              }

          });
      }
      } />
    </div>
  );
};

export default ProfilePictureUpload;