'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface KickNotificationProps {
  isOpen: boolean
  initiatorName: string
  timeout: number
  onReject: () => void
  onTimeout: () => void
}

export function KickNotification({
  isOpen,
  initiatorName,
  timeout,
  onReject,
  onTimeout,
}: KickNotificationProps) {
  const [timeLeft, setTimeLeft] = useState(timeout / 1000)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(timeout / 1000)
      setProgress(100)
      return
    }

    const startTime = Date.now()
    const endTime = startTime + timeout

    const updateTimer = () => {
      const now = Date.now()
      const remaining = Math.max(0, endTime - now)
      const secondsLeft = Math.ceil(remaining / 1000)
      const progressPercent = (remaining / timeout) * 100

      setTimeLeft(secondsLeft)
      setProgress(progressPercent)

      if (remaining <= 0) {
        onTimeout()
      } else {
        requestAnimationFrame(updateTimer)
      }
    }

    const animationFrame = requestAnimationFrame(updateTimer)

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [isOpen, timeout, onTimeout])

  const handleReject = useCallback(() => {
    onReject()
  }, [onReject])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border-2 border-red-100"
          >
            {/* Warning icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
              className="flex justify-center mb-6"
            >
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <motion.svg
                  className="w-10 h-10 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  animate={{ 
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.1, 1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 0.5, 
                    repeat: Infinity, 
                    repeatDelay: 1 
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </motion.svg>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-2xl font-bold text-center text-gray-900 mb-2"
            >
              You are being kicked!
            </motion.h2>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center text-gray-600 mb-6"
            >
              <span className="font-semibold text-red-600">{initiatorName}</span> has initiated a kick vote against you.
              <br />
              You will be removed from the game in:
            </motion.p>

            {/* Countdown */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="flex justify-center mb-6"
            >
              <div className="relative">
                {/* Circular progress */}
                <svg className="w-24 h-24 transform -rotate-90">
                  {/* Background circle */}
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                    transition={{ duration: 0.1 }}
                  />
                </svg>
                {/* Time display */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-red-600">{timeLeft}</span>
                </div>
              </div>
            </motion.div>

            {/* Reject button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.button
                onClick={handleReject}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                REJECT KICK
              </motion.button>
            </motion.div>

            {/* Footer text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-center text-xs text-gray-400 mt-4"
            >
              Click REJECT to stay in the game
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
