import React from 'react';
import { Avatar, Card, Image, List } from 'antd-mobile';

/**
 * Compact card component to display website metadata in chat messages
 * @param {Object} props
 * @param {string} props.title - Website title
 * @param {string} props.description - Website description
 * @param {string} props.image - Website image URL
 * @param {string} props.url - Original website URL
 * @returns {JSX.Element}
 */
const MetadataCard = ({ title, description, image, url }) => {
  // Extract domain for display
  const domain = url ? new URL(url).hostname : '';
  
  return (
       <List>
          <List.Item
            prefix={<Avatar src={image} />}
            description={description}
          >
            {title}
          </List.Item>
        </List>
  );
};

export default MetadataCard;