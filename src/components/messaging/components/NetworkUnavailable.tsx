import { NoticeBar } from 'antd-mobile'
import { InformationCircleOutline } from 'antd-mobile-icons'
import React from 'react'
import { useState, useEffect } from 'react'
import { socket } from '../socket'
import { App } from '@capacitor/app'

function NetworkUnavailable() {
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showNotice, setShowNotice] = useState(false)

  useEffect(() => {
    let timeoutId

    function checkConnectionStatus() {
      const shouldShowNotice = !isSocketConnected || !isOnline
      
      if (shouldShowNotice && !showNotice) {
        // Start timer to show notice after 4 seconds
        timeoutId = setTimeout(() => {
          setShowNotice(true)
        }, 4000)
      } else if (!shouldShowNotice) {
        // Hide notice immediately and clear timeout
        setShowNotice(false)
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }
    }

    function resetTimer() {
      // Clear existing timeout and restart the check
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      setShowNotice(false)
      checkConnectionStatus()
    }

    function onConnect() {
      setIsSocketConnected(true)
      checkConnectionStatus()
    }

    function onDisconnect() {
      setIsSocketConnected(false)
      checkConnectionStatus()
    }

    function onOnline() {
      setIsOnline(true)
      checkConnectionStatus()
    }

    function onOffline() {
      setIsOnline(false)
      checkConnectionStatus()
    }

    function onAppResume() {
      // Reset timer when app resumes from background
      resetTimer()
    }

    // Socket.IO event listeners
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    
    // Navigator online/offline event listeners
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Capacitor app state listener
    let appStateListener
    if (typeof App !== 'undefined') {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          onAppResume()
        }
      }).then(listener => {
        appStateListener = listener
      })
    }

    // Check initial state
    checkConnectionStatus()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      
      // Remove Capacitor listener
      if (appStateListener) {
        appStateListener.remove()
      }
      
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [isSocketConnected, isOnline, showNotice])

  // Only render the notice bar when there's a connection issue for more than 4 seconds
  if (!showNotice) {
    return null
  }

  return (
    <NoticeBar
      closeable
      icon={<InformationCircleOutline />}
      content="Network unavailable. Check network."
      color="alert"
    />
  )
}

export default NetworkUnavailable