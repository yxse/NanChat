import { NoticeBar } from 'antd-mobile'
import { InformationCircleOutline } from 'antd-mobile-icons'
import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { socket } from '../socket'
import { App } from '@capacitor/app'

function NetworkUnavailable() {
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showNotice, setShowNotice] = useState(false)
  const timeoutRef = useRef(null)
  const mountedRef = useRef(false)

  useEffect(() => {
   
    function clearExistingTimeout() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    function checkConnectionStatus() {
      // Don't show notice immediately on mount
      
      const shouldShowNotice = !isSocketConnected || !isOnline
      
      clearExistingTimeout()
      
      if (shouldShowNotice && !showNotice) {
        // Start timer to show notice after 4 seconds
        timeoutRef.current = setTimeout(() => {
          // Double-check the connection status when timer fires
          const currentShouldShow = !socket.connected || !navigator.onLine
          if (currentShouldShow) {
            setShowNotice(true)
          }
        }, 4000)
      } else if (!shouldShowNotice && showNotice) {
        // Hide notice immediately when connection is restored
        setShowNotice(false)
      }
    }

    function resetTimer() {
      clearExistingTimeout()
      setShowNotice(false)
      // Small delay before rechecking to avoid flashing
      setTimeout(checkConnectionStatus, 100)
    }

    function onConnect() {
      setIsSocketConnected(true)
    }

    function onDisconnect() {
      setIsSocketConnected(false)
    }

    function onOnline() {
      setIsOnline(true)
    }

    function onOffline() {
      setIsOnline(false)
    }

    function onAppResume() {
      // Update connection states first
      setIsSocketConnected(socket.connected)
      setIsOnline(navigator.onLine)
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
      App.addListener('resume', onAppResume).then(listener => {
        appStateListener = listener
      })
    }

    return () => {
      clearExistingTimeout()
      
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      
      if (appStateListener) {
        appStateListener.remove()
      }
    }
  }, []) // Remove showNotice from dependencies

  // Separate effect to handle connection status changes
  useEffect(() => {
    // if (!mountedRef.current) return
    
    const shouldShowNotice = !isSocketConnected || !isOnline
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    if (shouldShowNotice && !showNotice) {
      timeoutRef.current = setTimeout(() => {
        const currentShouldShow = !socket.connected || !navigator.onLine
        if (currentShouldShow) {
          setShowNotice(true)
        }
      }, 4000)
    } else if (!shouldShowNotice && showNotice) {
      setShowNotice(false)
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
      onClose={() => setShowNotice(false)}
    />
  )
}

export default NetworkUnavailable