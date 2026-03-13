'use client'

import { useState, useEffect, useCallback } from 'react'

type UIMode = 'full' | 'simple'

const UI_MODE_KEY = 'planning_poker_ui_mode'

export function useUIMode() {
  const [uiMode, setUIModeState] = useState<UIMode>('full')
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(UI_MODE_KEY) as UIMode | null
    if (stored && (stored === 'full' || stored === 'simple')) {
      setUIModeState(stored)
    }
    setIsInitialized(true)
  }, [])

  const setUIMode = useCallback((mode: UIMode) => {
    setUIModeState(mode)
    localStorage.setItem(UI_MODE_KEY, mode)
  }, [])

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
