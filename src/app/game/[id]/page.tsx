'use client'

export const dynamic = 'force-dynamic'

import { GameRoom } from '@/components/GameRoom'
import { useParams } from 'next/navigation'

export default function GamePage() {
  const params = useParams()
  const gameId = params.id as string

  return <GameRoom gameId={gameId} />
}
