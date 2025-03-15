import React, { useState } from 'react';
import { Avatar, Card, Divider, DotLoading, Ellipsis, Image, List } from 'antd-mobile';
import useSWR from 'swr';
import { hasLink } from '../utils';
import { CompassOutline } from 'antd-mobile-icons';
import { fetcherMessagesNoAuth } from '../fetcher';
import { useNavigate } from 'react-router-dom';
import { Discover } from '../../app/discover/Discover';

/**
 * Compact card component to display website metadata in chat messages
 * @param {Object} props
 * @param {string} props.title - Website title
 * @param {string} props.description - Website description
 * @param {string} props.image - Website image URL
 * @param {string} props.url - Original website URL
 * @returns {JSX.Element}
 */
export const MetadataCard = ({ message  }) => {
  const link = hasLink(message)
  if (!link) return null;
  const url = link[0];
  console.log({url});
  const [openUrl, setOpenUrl] = useState(false);
  const { data: services } = useSWR('/services', fetcherMessagesNoAuth);

  // Extract domain for display
  const domain = url ? new URL(url).hostname : '';
  const whitelistedDomains = services?.map(service => new URL(service.link).hostname);
  const isWhiteListed = whitelistedDomains?.includes(domain);
  const navigate = useNavigate();

  const {data, isLoading} = useSWR(isWhiteListed ? `https://link-preview.b3nskalz.workers.dev/?q=${url}` : null, async (url) => {const res = await fetch(url); return res.json();});
  if (isLoading) return <DotLoading />;
  if (!isWhiteListed) {return null}
  
  return (<>
       <Card
       onClick={() => setOpenUrl(true)}
        style={{maxWidth: 300, padding: 8, margin: 8, marginTop: 0}}>
        <div style={{ display: 'flex', gap: 8 }}>
          {
            data.image && 
        <div>
            <Avatar src={data.image} style={{marginTop: 4}}/>
        </div>
        }
            <div>
              <div>
                {data.title}
              </div>
              <p style={{color: 'var(--adm-color-text-secondary)'}} className='text-sm'>
              {data.description}
              </p>
            </div>{
              !data.image && !data.title && !data.description && <div>
                {url.replace('https://', '')}
              </div>
            }
            </div>
            <div className='text-xs' style={{color: 'var(--adm-color-text-secondary)'}}>
              <Divider style={{margin: '8px 0'}}/>
              <CompassOutline style={{display: "inline", marginRight: 4}}/>
              Nano App
            </div>
        </Card>
        {
          openUrl && <Discover defaultURL={url} />
        }
        
        </>
  );
};
