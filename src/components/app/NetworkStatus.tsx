import React from 'react'
import useSWR from 'swr'
import { NoticeBar } from 'antd-mobile';
import { fetcherChat } from '../messaging/fetcher';
import { useWindowDimensions } from '../../hooks/use-windows-dimensions';

function NetworkStatus({ticker}) {
    const {data} = useSWR("/networks", fetcherChat);
    const status = data?.[ticker]?.status;
    const {isMobile} = useWindowDimensions();
  if (!status) {
    return null
  }
  return (
    <NoticeBar wrap content={status} color='alert' shape="neutral" style={isMobile ? {} : {width: 450}} />
  )
}

export default NetworkStatus