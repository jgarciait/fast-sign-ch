"use client"

import { useState, useEffect } from "react"

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkIfMobile = () => {
      // Check if window is available (client-side)
      if (typeof window === 'undefined') {
        setIsMobile(false)
        setIsLoading(false)
        return
      }
      
      // Use multiple detection methods
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
      const isSmallScreen = window.innerWidth <= 768
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // Consider mobile if any condition is true
      const mobile = isMobileUA || isSmallScreen || isTouchDevice
      setIsMobile(mobile)
      setIsLoading(false)
    }

    // Use a small delay to ensure proper hydration
    const timeout = setTimeout(checkIfMobile, 100)

    // Listen for window resize
    const handleResize = () => {
      if (typeof window === 'undefined') return
      
      const isSmallScreen = window.innerWidth <= 768
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      const mobile = isMobileUA || isSmallScreen || isTouchDevice
      setIsMobile(mobile)
    }

    window.addEventListener('resize', handleResize)
    
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return { isMobile, isLoading }
}