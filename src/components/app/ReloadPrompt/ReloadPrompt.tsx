import React from 'react'
import './ReloadPrompt.css'

import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from 'antd-mobile'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // eslint-disable-next-line prefer-template
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="ReloadPrompt-container">
      { (offlineReady || needRefresh)
        && <div className="ReloadPrompt-toast">
            <div className="ReloadPrompt-message text-gray-500 mb-2">
              { offlineReady
                ? <span>App ready to work offline</span>
                : <span>A new version is available. Restart to update now.</span>
              }
            </div>
            { needRefresh && <Button
            color='primary'
            shape='rounded'
            size='middle'
             className="mr-4 text-white" onClick={() => updateServiceWorker(true)}>
              Restart
             </Button> }
            <Button 
            color='default'
            shape='rounded'
            size='middle'
            className="text-white" onClick={() => close()}>Close</Button>
        </div>
      }
    </div>
  )
}

export default ReloadPrompt