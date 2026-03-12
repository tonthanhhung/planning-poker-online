'use client'

import { useState, useEffect, useMemo } from 'react'
import { useGame } from '@/hooks/useGame'
import { usePlayer } from '@/hooks/usePlayer'
import { useWebSocketPresence } from '@/hooks/useWebSocketPresence'
import { COFFEE_CARD, type Vote } from '@/types'
import { generateFunnyName } from '@/lib/funnyNames'

interface SimpleGameRoomProps {
  gameId: string
  onToggleMode: () => void
}

// Card values matching scrumpoker-online.org exactly
const CARD_VALUES = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100]

export function SimpleGameRoom({ gameId, onToggleMode }: SimpleGameRoomProps) {
  const { playerId, playerName, isInitialized, updateName, syncPlayerId } = usePlayer()
  const { socket, isConnected, isPlayerActive } = useWebSocketPresence(gameId, playerId, playerName || '')
  
  const { 
    game, 
    players, 
    issues, 
    votes, 
    isLoading, 
    error, 
    refreshGame, 
    updateGameStatus: setStatus, 
    submitVote: submitVoteSocket,
    resetVotes: resetVotesSocket,
    createIssue: createIssueSocket,
    updateIssue: updateIssueSocket,
    socket: gameSocket,
    isConnected: isGameSocketConnected,
  } = useGame(gameId, playerId, playerName || '')

  const [isJoining, setIsJoining] = useState(false)
  const [selectedCard, setSelectedCard] = useState<number | typeof COFFEE_CARD | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(!playerName)
  const [joinNameInput, setJoinNameInput] = useState('')
  
  // Generate default name
  useEffect(() => {
    if (isInitialized && !joinNameInput && !playerName) {
      setJoinNameInput(generateFunnyName())
    }
  }, [isInitialized, playerName])

  const currentPlayer = useMemo(() => {
    return players.find(p => p.id === playerId) || players.find(p => p.name === playerName) || null
  }, [players, playerId, playerName])

  useEffect(() => {
    if (currentPlayer) {
      setShowJoinModal(false)
    }
  }, [currentPlayer])

  const isViewer = currentPlayer?.is_viewer ?? false

  // Get current active issue
  const currentIssue = useMemo(() => {
    const active = issues.find(i => i.status === 'voting')
    return active || issues[0]
  }, [issues])
  
  const currentVotes = useMemo(() => {
    return currentIssue ? (votes[currentIssue.id] || []) : []
  }, [currentIssue, votes])

  const isRevealed = game?.status === 'revealed' || (currentIssue && currentIssue.status === 'completed' && currentVotes.length > 0)

  // Check if player has voted
  useEffect(() => {
    const existingPlayer = players.find(p => p.name === playerName)
    if (existingPlayer) {
      const playerHasVoted = !!currentVotes.some(v => v.player_id === existingPlayer.id)
      setHasVoted(playerHasVoted)
    }
  }, [currentVotes, players, playerName])

  // Reset voting state when issue changes
  useEffect(() => {
    setSelectedCard(null)
    setHasVoted(false)
  }, [currentIssue?.id])

  const handleJoinGame = async () => {
    const name = joinNameInput.trim()
    if (!name) return

    setIsJoining(true)
    
    try {
      const duplicate = players.find(p => p.name === name)
      if (duplicate) {
        alert(`The name "${name}" is already taken. Please choose another name.`)
        setIsJoining(false)
        return
      }

      if (gameSocket && isGameSocketConnected) {
        gameSocket.emit('create-player', { gameId, playerName: name, isViewer: false }, (response: any) => {
          if (response.success) {
            updateName(name)
            syncPlayerId(response.player.id)
            setShowJoinModal(false)
            refreshGame()
          } else {
            alert(`Failed to join game: ${response.error}`)
          }
          setIsJoining(false)
        })
      }
    } catch (err) {
      console.error('Error joining game:', err)
      alert('Failed to join game. Please try again.')
      setIsJoining(false)
    }
  }

  const handleCardClick = async (value: number | typeof COFFEE_CARD) => {
    if (!playerId || isViewer || isRevealed) return

    const existingPlayer = currentPlayer
    if (!existingPlayer) {
      if (isLoading) return
      alert('You need to join the game first.')
      return
    }

    setSelectedCard(value)

    let issueId = currentIssue?.id
    if (!issueId) {
      const title = 'Current Task'
      const order = issues.length
      if (socket) {
        socket.emit('create-issue', { gameId, title, order, status: 'voting' }, (response: any) => {
          if (response.success) {
            issueId = response.issue.id
            submitVoteSocket(issueId, typeof value === 'number' ? value : -1)
            setHasVoted(true)
          } else {
            alert('Failed to create voting session')
            setSelectedCard(null)
          }
        })
      }
    } else {
      await submitVoteSocket(issueId, typeof value === 'number' ? value : -1)
      setHasVoted(true)
    }
  }

  const handleReveal = async () => {
    if (!game) return
    await setStatus('revealed')
  }

  const handleHide = async () => {
    if (!game) return
    await setStatus('voting')
  }

  const handleResetVotes = async () => {
    if (!currentIssue) return
    resetVotesSocket(currentIssue.id)
    await setStatus('voting')
    setSelectedCard(null)
    setHasVoted(false)
  }

  const handleNextIssue = async () => {
    if (!currentIssue) return
    await updateIssueSocket(currentIssue.id, { status: 'completed' })
    const nextIssue = issues.find(i => i.status === 'pending' && i.id !== currentIssue.id)
    if (nextIssue) {
      await updateIssueSocket(nextIssue.id, { status: 'voting' })
      await setStatus('voting')
    } else {
      await setStatus('lobby')
    }
    setSelectedCard(null)
    setHasVoted(false)
  }

  // Get player's vote for display
  const getPlayerVote = (playerId: string) => {
    const vote = currentVotes.find(v => v.player_id === playerId)
    if (!vote) return null
    return vote.points < 0 ? COFFEE_CARD : vote.points
  }

  // Check if player has voted
  const hasPlayerVoted = (playerId: string) => {
    return currentVotes.some(v => v.player_id === playerId)
  }

  // Non-voting players (viewers)
  const votingPlayers = players.filter(p => !p.is_viewer)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-[#4eabc0] text-lg">Loading</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    )
  }

  // Join Modal - Styled like scrumpoker-online
  if (showJoinModal && !currentPlayer) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#4eabc0] rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-[#4eabc0] font-medium">PlanningPoker</span>
            </div>
          </div>
        </header>

        {/* Enter Room Section */}
        <div className="max-w-md mx-auto mt-16 px-4 text-center">
          <h1 className="text-4xl font-light text-gray-600 mb-4">Enter Room</h1>
          <p className="text-gray-500 mb-8">
            Provide your name or any pseudonym to enter the planning poker room {gameId.slice(0, 8)}.
          </p>

          <div className="space-y-4">
            <input
              type="text"
              value={joinNameInput}
              onChange={(e) => setJoinNameInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
              placeholder="Display Name *"
              className="w-full px-4 py-3 border border-gray-300 rounded text-gray-700 focus:outline-none focus:border-[#4eabc0]"
              autoFocus
              maxLength={30}
            />

            <button
              onClick={handleJoinGame}
              disabled={!joinNameInput.trim() || isJoining}
              className="w-full py-3 bg-[#4eabc0] hover:bg-[#3d9aad] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium uppercase tracking-wider transition-colors"
            >
              {isJoining ? 'Joining...' : 'Enter Room'}
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-3 border border-gray-300 rounded text-gray-600 font-medium uppercase tracking-wider hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header - Exact replica */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#4eabc0] rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-[#4eabc0] font-medium hidden sm:inline">PlanningPoker</span>
          </div>

          {/* Room ID */}
          <div className="flex items-center gap-1 sm:gap-2 text-gray-600 flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
              Room {gameId.slice(0, 4)} {gameId.slice(4, 6)} {gameId.slice(6, 8)} {gameId.slice(8, 10)}
            </span>
          </div>

          {/* Right side buttons */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={onToggleMode}
              className="px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors whitespace-nowrap"
            >
              Full Mode
            </button>
            
            {/* User Avatar */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-500 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0">
              {playerName?.slice(0, 2).toUpperCase()}
            </div>

            {/* Menu Button */}
            <button className="p-1.5 sm:p-2 hover:bg-gray-100 rounded flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Voting Cards Section */}
        <section className="mb-8">
          <h2 className="text-lg font-normal text-gray-600 mb-2">
            Provide an effort estimate - choose one of the cards
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Each team member should estimate the complexity of the task (user story) to be completed.
          </p>

          {/* Cards Grid */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6">
            {/* Question mark / Coffee card */}
            <button
              onClick={() => handleCardClick(COFFEE_CARD)}
              disabled={isRevealed || isViewer}
              className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedCard === COFFEE_CARD
                  ? 'bg-[#4eabc0] border-[#4eabc0] text-white transform -translate-y-2 shadow-lg'
                  : 'bg-[#e8f4f8] border-[#4eabc0]/30 text-gray-600 hover:-translate-y-1 hover:shadow-md'
              }`}
              title="Coffee break"
            >
              <span className="absolute top-1 left-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
              <span className="absolute top-1 right-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
              <span className="absolute bottom-1 left-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
              <span className="absolute bottom-1 right-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
              <span className="text-xl sm:text-2xl font-light">?</span>
            </button>

            {/* Coffee icon card */}
            <button
              onClick={() => handleCardClick(COFFEE_CARD)}
              disabled={isRevealed || isViewer}
              className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedCard === COFFEE_CARD
                  ? 'bg-[#4eabc0] border-[#4eabc0] text-white transform -translate-y-2 shadow-lg'
                  : 'bg-[#e8f4f8] border-[#4eabc0]/30 text-gray-600 hover:-translate-y-1 hover:shadow-md'
              }`}
              title="Coffee break"
            >
              <span className="absolute top-1 left-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
              <span className="absolute top-1 right-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
              <span className="absolute bottom-1 left-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
              <span className="absolute bottom-1 right-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
              <span className="text-lg sm:text-xl">☕</span>
            </button>

            {/* Number cards */}
            {CARD_VALUES.map((value) => (
              <button
                key={value}
                onClick={() => handleCardClick(value)}
                disabled={isRevealed || isViewer}
                className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedCard === value
                    ? 'bg-[#4eabc0] border-[#4eabc0] text-white transform -translate-y-2 shadow-lg'
                    : 'bg-[#e8f4f8] border-[#4eabc0]/30 text-gray-600 hover:-translate-y-1 hover:shadow-md'
                }`}
                title={`Vote ${value}`}
              >
                <span className="absolute top-1 left-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
                <span className="absolute top-1 right-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
                <span className="absolute bottom-1 left-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
                <span className="absolute bottom-1 right-1 text-[8px] sm:text-[10px] text-[#4eabc0]/50">✦</span>
                <span className="text-lg sm:text-xl font-light">{value}</span>
              </button>
            ))}
          </div>

          {/* Tooltip hint */}
          {hasVoted && !isRevealed && (
            <div className="text-center">
              <div className="inline-block bg-gray-600 text-white text-sm px-4 py-2 rounded">
                Click to submit this estimate
              </div>
            </div>
          )}
        </section>

        {/* Divider */}
        <hr className="border-gray-200 mb-8" />

        {/* Results Section */}
        <section>
          <h2 className="text-lg font-normal text-gray-600 mb-2">Reveal the cards</h2>
          <p className="text-gray-500 text-sm mb-6">
            Once everyone has submitted their effort estimates, the organizer reveals the cards.
          </p>

          {/* Results Card */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Results Header */}
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>

              <div className="flex items-center gap-2">
                {!isRevealed ? (
                  <>
                    <button
                      onClick={handleResetVotes}
                      disabled={currentVotes.length === 0}
                      className="px-4 py-2 border border-gray-300 rounded text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Delete Estimates
                    </button>
                    <button
                      onClick={handleReveal}
                      disabled={currentVotes.length === 0}
                      className="px-4 py-2 bg-[#5a6c7d] hover:bg-[#4a5c6d] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white text-sm font-medium transition-colors"
                    >
                      Show
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleResetVotes}
                      className="px-4 py-2 border border-gray-300 rounded text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Delete Estimates
                    </button>
                    <button
                      onClick={handleHide}
                      className="px-4 py-2 bg-[#5a6c7d] hover:bg-[#4a5c6d] rounded text-white text-sm font-medium transition-colors"
                    >
                      Hide
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-200 rounded">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <div className="min-w-[300px] divide-y divide-gray-200">
                {/* Table Header */}
                <div className="px-4 py-3 flex items-center bg-gray-50">
                  <span className="flex-1 text-gray-600 font-medium min-w-0 truncate pr-2">Name</span>
                  <span className="w-20 sm:w-24 text-center text-gray-600 font-medium flex-shrink-0">Story Points</span>
                </div>

                {/* Player Rows */}
                {votingPlayers.map((player) => {
                  const playerVote = getPlayerVote(player.id)
                  const voted = hasPlayerVoted(player.id)
                  
                  return (
                    <div key={player.id} className="px-4 py-3 flex items-center hover:bg-gray-50">
                      <span className="flex-1 text-gray-700 min-w-0 truncate pr-2">{player.name}</span>
                      <div className="w-20 sm:w-24 flex justify-center flex-shrink-0">
                        {isRevealed && voted ? (
                          <div className="relative w-10 h-14 sm:w-12 sm:h-16 bg-[#e8f4f8] border border-[#4eabc0]/30 rounded flex items-center justify-center text-base sm:text-lg font-medium text-gray-700">
                            <span className="absolute top-0.5 left-0.5 text-[6px] sm:text-[8px] text-[#4eabc0]/50">✦</span>
                            <span className="absolute top-0.5 right-0.5 text-[6px] sm:text-[8px] text-[#4eabc0]/50">✦</span>
                            <span className="absolute bottom-0.5 left-0.5 text-[6px] sm:text-[8px] text-[#4eabc0]/50">✦</span>
                            <span className="absolute bottom-0.5 right-0.5 text-[6px] sm:text-[8px] text-[#4eabc0]/50">✦</span>
                            {playerVote}
                          </div>
                        ) : voted ? (
                          <div className="w-10 h-14 sm:w-12 sm:h-16 bg-gray-200 border border-gray-300 rounded flex items-center justify-center">
                            <span className="text-gray-400 text-lg sm:text-xl">✓</span>
                          </div>
                        ) : (
                          <div className="w-10 h-14 sm:w-12 sm:h-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                            <span className="text-gray-300">—</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {votingPlayers.length === 0 && (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No players yet. Waiting for participants...
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
