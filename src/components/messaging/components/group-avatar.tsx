import { Avatar } from 'antd-mobile';
import React from 'react';

const GroupAvatar = ({ groupName = '', size = 'md', colors = 'blue' }) => {
  // Extract initials from group name with null/undefined safety
  const getInitials = (name) => {
    // If name is not a string or is empty, return placeholder
    if (!name || typeof name !== 'string') {
      return '?';
    }

    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Color variations
  const colorVariants = {
    blue: 'bg-blue-500 text-white',
    green: 'bg-green-500 text-white',
    red: 'bg-red-500 text-white',
    purple: 'bg-purple-500 text-white',
    gray: 'bg-gray-500 text-white'
  };



  return (
    <img
    src='../icons/public-group-logo.svg'
    // src='https://cdn.discordapp.com/attachments/1057888614618505226/1308811186753634324/nanchat-logo-transparent.svg?ex=673f4ce7&is=673dfb67&hm=11767753cef8430b5d1eb1938d3bf54390d9df5b067ebf57fae8ce65a4821fba&'
    style={{
      // "--border-radius": "50%",
      // "--size": "64px", 
      width: '64px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8}}
    // fallback={
    //   <div 
    //   style={{width: '48px', height: '48px'}}
    //   className={`
    //     flex items-center justify-center 
    //     rounded-full 
    //     ${colorVariants[colors] || colorVariants.blue}
    //     font-semibold
    //     select-none
    //   `}
    //   >
    //       {getInitials(groupName)}
    //   </div>
    // }
    />
  );
};

export default GroupAvatar;
