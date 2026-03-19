'use client'

import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

interface AnimatedSkullProps {
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

export function AnimatedSkull({ onClick, className = '' }: AnimatedSkullProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    // Calculate mouse position relative to center (-1 to 1)
    const x = (e.clientX - centerX) / (rect.width / 2)
    const y = (e.clientY - centerY) / (rect.height / 2)
    
    // Clamp values
    setMousePos({
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y))
    })
  }, [])

  // Calculate positions with limited movement range
  const eyeOffsetX = mousePos.x * 3
  const eyeOffsetY = mousePos.y * 2

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setMousePos({ x: 0, y: 0 })
      }}
      onClick={onClick}
    >
      <motion.div
        className="w-8 h-8 relative cursor-pointer"
        animate={{ scale: isHovered ? 1.15 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {/* Skull base - static head with 2.5D effect */}
        <svg
          viewBox="0 0 32 32"
          className="w-full h-full"
          style={{ filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.3))' }}
        >
          <defs>
            <radialGradient id="skullGradient" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fef3f2" />
              <stop offset="40%" stopColor="#fee2e2" />
              <stop offset="100%" stopColor="#fecaca" />
            </radialGradient>
            <linearGradient id="skullShadow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
            </linearGradient>
            <radialGradient id="eyeSocket" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7f1d1d" />
              <stop offset="70%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#991b1b" />
            </radialGradient>
          </defs>
          
          {/* Main skull head shape - static */}
          <ellipse cx="16" cy="14" rx="11" ry="10" fill="url(#skullGradient)" />
          <ellipse cx="16" cy="14" rx="11" ry="10" fill="url(#skullShadow)" opacity="0.6" />
          <ellipse cx="12" cy="10" rx="4" ry="3" fill="rgba(255,255,255,0.6)" opacity="0.5" />
        </svg>
        
        {/* Animated face - eyes, nose, jaw all move together */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            x: eyeOffsetX,
            y: eyeOffsetY
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <svg viewBox="0 0 32 32" className="w-full h-full">
            {/* Left eye */}
            <ellipse cx="12" cy="14" rx="3.5" ry="3" fill="url(#eyeSocket)" />
            <ellipse cx="12" cy="14" rx="2.5" ry="2" fill="#1a1a1a" />
            <circle cx="13" cy="13" r="0.8" fill="rgba(255,255,255,0.4)" />
            
            {/* Right eye */}
            <ellipse cx="20" cy="14" rx="3.5" ry="3" fill="url(#eyeSocket)" />
            <ellipse cx="20" cy="14" rx="2.5" ry="2" fill="#1a1a1a" />
            <circle cx="21" cy="13" r="0.8" fill="rgba(255,255,255,0.4)" />
            
            {/* Nose - follows eyes */}
            <path d="M15 18 L16 20 L17 18 Z" fill="#dc2626" opacity="0.8" />
            
            {/* Jaw - now moves with the face! */}
            <rect x="11" y="20" width="10" height="6" rx="2" fill="url(#skullGradient)" />
            <rect x="11" y="20" width="10" height="6" rx="2" fill="url(#skullShadow)" opacity="0.4" />
            
            {/* Teeth lines */}
            <line x1="13" y1="22" x2="13" y2="25" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
            <line x1="16" y1="22" x2="16" y2="25" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
            <line x1="19" y1="22" x2="19" y2="25" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
          </svg>
        </motion.div>
        
        {/* Hover glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: isHovered 
              ? '0 0 20px 5px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(255,255,255,0.2)'
              : '0 0 0px 0px rgba(239, 68, 68, 0)'
          }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </div>
  )
}
