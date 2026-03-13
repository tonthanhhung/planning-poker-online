'use client'

export const dynamic = 'force-dynamic'

import { GameRoom } from '@/components/GameRoom'
import { SimpleGameRoom } from '@/components/SimpleGameRoom'
import { useUIMode } from '@/hooks/useUIMode'
import { useParams } from 'next/navigation'

export default function GamePage() {
  const params = useParams()
  const gameId = params.id as string
  const { uiMode, toggleUIMode } = useUIMode()

  if (uiMode === 'simple') {
    return <SimpleGameRoom gameId={gameId} onToggleMode={toggleUIMode} />
  }

  return <GameRoom gameId={gameId} onToggleMode={toggleUIMode} />
}
