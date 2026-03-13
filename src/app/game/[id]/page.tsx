'use client'

export const dynamic = 'force-dynamic'

import { GameRoom } from '@/components/GameRoom'
import { SimpleGameRoom } from '@/components/SimpleGameRoom'
import { useUIMode } from '@/hooks/useUIMode'
import { useParams } from 'next/navigation'

export default function GamePage() {
  const params = useParams()
  const gameId = params.id as string
  const { isSimpleMode, toggleUIMode } = useUIMode()

  return isSimpleMode ? (
    <SimpleGameRoom gameId={gameId} onToggleMode={toggleUIMode} />
  ) : (
    <GameRoom gameId={gameId} onToggleMode={toggleUIMode} />
  )
}
