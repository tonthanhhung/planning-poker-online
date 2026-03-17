'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

type UIMode = 'full' | 'simple'

const UI_MODE_KEY = 'planning_poker_ui_mode'

export function useUIMode() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [uiMode, setUIModeState] = useState<UIMode>('full')
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Priority 1: URL parameter
    const urlMode = searchParams.get('mode')
    if (urlMode === 'simple') {
      setUIModeState('simple')
      setIsInitialized(true)
      return
    }
    
    // Priority 2: localStorage fallback
    const stored = localStorage.getItem(UI_MODE_KEY) as UIMode | null
    if (stored && (stored === 'full' || stored === 'simple')) {
      setUIModeState(stored)
    }
    setIsInitialized(true)
  }, [searchParams])

  const setUIMode = useCallback((mode: UIMode) => {
    setUIModeState(mode)
    localStorage.setItem(UI_MODE_KEY, mode)
    
    // Update URL parameter
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'simple') {
      params.set('mode', 'simple')
    } else {
      params.delete('mode')
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  const toggleUIMode = useCallback(() => {
    const newMode = uiMode === 'full' ? 'simple' : 'full'
    setUIMode(newMode)
  }, [uiMode, setUIMode])

  return {
    uiMode,
    isInitialized,
    setUIMode,
    toggleUIMode,
    isSimpleMode: uiMode === 'simple',
    isFullMode: uiMode === 'full',
  }
}
