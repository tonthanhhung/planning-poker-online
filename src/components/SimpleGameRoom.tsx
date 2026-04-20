'use client'

import { useState, useEffect, useMemo } from 'react'
import { useGame } from '@/hooks/useGame'
import { usePlayer } from '@/hooks/usePlayer'
import { useWebSocketPresence } from '@/hooks/useWebSocketPresence'
import { CARD_VALUES, QUESTION_CARD, COFFEE_CARD, type Vote, type Issue } from '@/types'
import { generateFunnyName } from '@/lib/funnyNames'

// Utility function to generate automatic task names
function generateTaskName(existingIssues: Issue[]): string {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = String(now.getFullYear()).slice(-2)
  const dateStr = `${day}.${month}.${year}`
  
  // Count existing tasks for today
  const todayPrefix = `Task-${dateStr}-`
  const todayTasks = existingIssues.filter(issue => issue.title.startsWith(todayPrefix))
  const nextNumber = todayTasks.length + 1
  
  return `Task-${dateStr}-${String(nextNumber).padStart(2, '0')}`
}

interface SimpleGameRoomProps {
  gameId: string
  onToggleMode: () => void
}

export function SimpleGameRoom({ gameId, onToggleMode }: SimpleGameRoomProps) {
  const { playerName, isInitialized, updateName } = usePlayer()
  const { socket, isConnected, isPlayerActive } = useWebSocketPresence(gameId, playerName || '')

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
    votesResetKey,
  } = useGame(gameId, playerName || '')

  const [isJoining, setIsJoining] = useState(false)
  const [selectedCard, setSelectedCard] = useState<number | typeof COFFEE_CARD | typeof QUESTION_CARD | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(!playerName)
  const [joinNameInput, setJoinNameInput] = useState('')
  
  // Generate default name - use stored name or generate funny name
  useEffect(() => {
    if (isInitialized && !joinNameInput && !playerName) {
      // Use stored player name if available, otherwise generate funny name
      const storedName = playerName || generateFunnyName()
      setJoinNameInput(storedName)
    }
  }, [isInitialized, playerName])

  const currentPlayer = useMemo(() => {
    return players.find(p => p.name === playerName) || null
  }, [players, playerName])

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

  // Reset local voting state when votes are reset (by any player)
  useEffect(() => {
    if (votesResetKey > 0) {
      setSelectedCard(null)
      setHasVoted(false)
    }
  }, [votesResetKey])

  const handleJoinGame = async () => {
    const name = joinNameInput.trim()
    if (!name) return

    setIsJoining(true)
    
    try {
      // Block duplicate names unless it's the stored name (returning user)
      const duplicate = players.find(p => p.name === name)
      if (duplicate && name !== playerName) {
        alert(`The name "${name}" is already taken. Please choose a different name.`)
        setIsJoining(false)
        return
      }

      if (gameSocket && isGameSocketConnected) {
        gameSocket.emit('create-player', { gameId, playerName: name, isViewer: false }, (response: any) => {
          if (response.success) {
            updateName(name)
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

  const handleCardClick = async (value: number | typeof COFFEE_CARD | typeof QUESTION_CARD) => {
    if (!playerName || isViewer || isRevealed) return

    const existingPlayer = currentPlayer
    if (!existingPlayer) {
      if (isLoading) return
      alert('You need to join the game first.')
      return
    }

    setSelectedCard(value)

    let issueId = currentIssue?.id
    if (!issueId) {
      const title = generateTaskName(issues)
      const order = issues.length
      if (socket) {
        socket.emit('create-issue', { gameId, title, order, status: 'voting' }, (response: any) => {
          if (response.success) {
            issueId = response.issue.id
            submitVoteSocket(issueId, typeof value === 'number' ? value : value === COFFEE_CARD ? -1 : -2)
            setHasVoted(true)
          } else {
            alert('Failed to create voting session')
            setSelectedCard(null)
          }
        })
      }
    } else {
      await submitVoteSocket(issueId, typeof value === 'number' ? value : value === COFFEE_CARD ? -1 : -2)
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
      // Reset votes for the new issue to clear everyone's voting state
      resetVotesSocket(nextIssue.id)
    } else {
      await setStatus('lobby')
    }
    setSelectedCard(null)
    setHasVoted(false)
  }

  const handleCreateNextTask = async () => {
    const title = generateTaskName(issues)
    const order = issues.length
    if (socket) {
      socket.emit('create-issue', { gameId, title, order, status: 'pending' }, (response: any) => {
        if (response.success) {
          refreshGame()
        } else {
          alert('Failed to create task')
        }
      })
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      alert('Room link copied to clipboard!')
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('Room link copied to clipboard!')
    }
  }

  const handleLeave = () => {
    window.location.href = '/'
  }

  // Get player's vote for display
  const getPlayerVote = (playerId: string) => {
    const vote = currentVotes.find(v => v.player_id === playerId)
    if (!vote) return null
    if (vote.points === -1) return COFFEE_CARD
    if (vote.points === -2) return QUESTION_CARD
    return vote.points
  }

  // Check if player has voted
  const hasPlayerVoted = (playerId: string) => {
    return currentVotes.some(v => v.player_id === playerId)
  }

  // Non-voting players (viewers)
  const votingPlayers = players.filter(p => !p.is_viewer)

  // Track which player cards have been revealed (for flip animation)
  const [revealedPlayerIds, setRevealedPlayerIds] = useState<Set<string>>(new Set())
  
  // Trigger flip animation when revealed
  useEffect(() => {
    if (isRevealed && votingPlayers.length > 0) {
      const allVoterIds = new Set(votingPlayers.filter(p => hasPlayerVoted(p.id)).map(p => p.id))
      // Start with empty set (cards at 0deg), then add all IDs after render to trigger animation
      setRevealedPlayerIds(new Set())
      
      // Trigger flip animation on next frame
      requestAnimationFrame(() => {
        setRevealedPlayerIds(allVoterIds)
      })
    } else {
      setRevealedPlayerIds(new Set())
    }
  }, [isRevealed])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-lg">Loading</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-error text-lg">{error}</div>
      </div>
    )
  }

  // Join Modal - Styled like scrumpoker-online
  if (showJoinModal && !currentPlayer) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-surface shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-primary font-medium">PlanningPoker</span>
            </div>
          </div>
        </header>

        {/* Enter Room Section */}
        <div className="max-w-md mx-auto mt-16 px-4 text-center">
          <h1 className="text-4xl font-light text-secondary mb-4">Enter Room</h1>
          <p className="text-neutral mb-8">
            Provide your name or any pseudonym to enter the planning poker room {gameId.slice(0, 8)}.
          </p>

          <div className="space-y-4">
            <input
              type="text"
              value={joinNameInput}
              onChange={(e) => setJoinNameInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
              placeholder="Display Name *"
              className="w-full px-4 py-3 border border-border text-secondary focus:outline-none focus:border-primary"
              autoFocus
              maxLength={30}
            />

            <button
              onClick={handleJoinGame}
              disabled={!joinNameInput.trim() || isJoining}
              className="w-full py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium uppercase tracking-wider transition-colors"
            >
              {isJoining ? 'Joining...' : 'Enter Room'}
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-3 border border-border rounded text-secondary font-medium uppercase tracking-wider hover:bg-neutral-light transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6">
        {/* Header inside main container */}
        <div className="max-w-7xl mx-auto mb-6">
          <div className="flex items-center justify-between gap-2 bg-surface rounded-lg border border-border elevation-low px-3 py-2 md:px-4 md:py-3">
            {/* Left: Logo and Game name */}
            <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-sm md:text-lg font-semibold text-secondary truncate">PlanningPoker - {gameId.slice(0, 8)}</h1>
            </div>
            
            {/* Right: Action buttons */}
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              {/* Share button */}
              <button
                onClick={handleShare}
                className="p-2 text-secondary hover:bg-neutral-light rounded transition-colors"
                title="Share room link"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              
              {/* Leave button */}
              <button
                onClick={handleLeave}
                className="p-2 text-secondary hover:bg-neutral-light rounded transition-colors"
                title="Leave room"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>

              {/* Simple Mode Toggle */}
              <button
                onClick={onToggleMode}
                className="px-2 py-1.5 text-xs bg-neutral-light hover:bg-neutral-200 text-secondary rounded transition-colors whitespace-nowrap flex items-center justify-center gap-1 h-8"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <span className="hidden md:inline">Full Mode</span>
              </button>
              
              {/* Player count badge */}
              <div className="px-2 py-1.5 bg-neutral-light rounded text-xs font-medium text-secondary h-8 flex items-center justify-center">
                <span>{players.length}</span>
                <span className="hidden md:inline ml-1">players</span>
              </div>
              
              {/* Current player name */}
              <div className="px-2 py-1.5 bg-neutral-light rounded text-xs font-medium text-secondary h-8 truncate max-w-[80px] md:max-w-[100px] flex items-center justify-center">
                {playerName}
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Main Game Area - Full width on mobile, 3/4 on md */}
          <div className="md:col-span-3">
        {/* Voting Cards Section */}
        <section className="mb-8">
          <h2 className="text-lg font-normal text-secondary mb-2">
            Provide an effort estimate - choose one of the cards
          </h2>
          <p className="text-neutral text-sm mb-6">
            Each team member should estimate the complexity of the task (user story) to be completed.
          </p>

          {/* Cards Grid */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6">
            {/* Question mark card */}
            <button
              onClick={() => handleCardClick(QUESTION_CARD)}
              disabled={isRevealed || isViewer}
              className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:shadow-md ${
                selectedCard === QUESTION_CARD
                  ? 'bg-[#5B6A79] shadow-lg'
                  : 'bg-white border-2 border-primary/30'
              }`}
              title="Question mark - Click to submit this estimate"
            >
              <span className={`absolute top-1 left-1 text-[8px] sm:text-[10px] ${selectedCard === QUESTION_CARD ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
              <span className={`absolute top-1 right-1 text-[8px] sm:text-[10px] ${selectedCard === QUESTION_CARD ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
              <span className={`absolute bottom-1 left-1 text-[8px] sm:text-[10px] ${selectedCard === QUESTION_CARD ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
              <span className={`absolute bottom-1 right-1 text-[8px] sm:text-[10px] ${selectedCard === QUESTION_CARD ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
              <span className={`text-xl sm:text-2xl font-bold ${selectedCard === QUESTION_CARD ? 'text-white' : 'text-[#5B6A79]'}`}>{QUESTION_CARD}</span>
            </button>

            {/* Coffee icon card */}
            <button
              onClick={() => handleCardClick(COFFEE_CARD)}
              disabled={isRevealed || isViewer}
              className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:shadow-md ${
                selectedCard === COFFEE_CARD
                  ? 'bg-[#5B6A79] shadow-lg'
                  : 'bg-white border-2 border-primary/30'
              }`}
              title="Coffee break - Click to submit this estimate"
            >
              <span className={`absolute top-1 left-1 text-[8px] sm:text-[10px] ${selectedCard === COFFEE_CARD ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
              <span className={`absolute top-1 right-1 text-[8px] sm:text-[10px] ${selectedCard === COFFEE_CARD ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
              <span className={`absolute bottom-1 left-1 text-[8px] sm:text-[10px] ${selectedCard === COFFEE_CARD ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
              <span className={`absolute bottom-1 right-1 text-[8px] sm:text-[10px] ${selectedCard === COFFEE_CARD ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
              <span className={`text-xl sm:text-2xl font-bold ${selectedCard === COFFEE_CARD ? 'text-white' : 'text-[#5B6A79]'}`}>☕</span>
            </button>

            {/* Number cards */}
            {CARD_VALUES.map((value) => (
              <button
                key={value}
                onClick={() => handleCardClick(value)}
                disabled={isRevealed || isViewer}
                className={`relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:shadow-md ${
                  selectedCard === value
                    ? 'bg-[#5B6A79] shadow-lg'
                    : 'bg-white border-2 border-primary/30'
                }`}
                title={`${value} - Click to submit this estimate`}
              >
                <span className={`absolute top-1 left-1 text-[8px] sm:text-[10px] ${selectedCard === value ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
                <span className={`absolute top-1 right-1 text-[8px] sm:text-[10px] ${selectedCard === value ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
                <span className={`absolute bottom-1 left-1 text-[8px] sm:text-[10px] ${selectedCard === value ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
                <span className={`absolute bottom-1 right-1 text-[8px] sm:text-[10px] ${selectedCard === value ? 'text-white/60' : 'text-[#5B6A79]'}`}>✦</span>
                <span className={`text-xl sm:text-2xl font-bold ${selectedCard === value ? 'text-white' : 'text-[#5B6A79]'}`}>{value}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Divider */}
        <hr className="border-border mb-8" />

        {/* Results Section */}
        <section>
          <h2 className="text-lg font-normal text-secondary mb-2">Reveal the cards</h2>
          <p className="text-neutral text-sm mb-6">
            Once everyone has submitted their effort estimates, the organizer reveals the cards.
          </p>

          {/* Results Card */}
          <div className="bg-surface rounded-lg shadow-lg overflow-hidden">
            {/* Results Header */}
            <div className="bg-neutral-subtle px-4 py-3 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-neutral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>

              <div className="flex items-center gap-2">
                {!isRevealed ? (
                  <>
                    <button
                      onClick={handleResetVotes}
                      disabled={currentVotes.length === 0}
                      className="px-4 py-2 border border-border rounded text-secondary text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Delete Estimates
                    </button>
                    <button
                      onClick={handleReveal}
                      disabled={currentVotes.length === 0}
                      className="px-4 py-2 bg-secondary hover:bg-neutral-dark disabled:opacity-50 disabled:cursor-not-allowed rounded text-white text-sm font-medium transition-colors"
                    >
                      Show
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleResetVotes}
                      className="px-4 py-2 border border-border rounded text-secondary text-sm font-medium hover:bg-neutral-light transition-colors"
                    >
                      Delete Estimates
                    </button>
                    <button
                      onClick={handleHide}
                      className="px-4 py-2 bg-secondary hover:bg-neutral-dark rounded text-white text-sm font-medium transition-colors"
                    >
                      Hide
                    </button>
                    <button
                      onClick={handleNextIssue}
                      className="px-4 py-2 bg-secondary hover:bg-neutral-dark rounded text-white text-sm font-medium transition-colors"
                    >
                      Next Task
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-neutral-light rounded">
                  <svg className="w-5 h-5 text-neutral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <div className="min-w-[300px] divide-y divide-border">
                {/* Table Header */}
                <div className="px-4 py-3 flex items-center bg-neutral-subtle">
                  <span className="text-secondary font-medium flex-1 min-w-0 truncate pr-1">Name</span>
                  <span className="w-20 sm:w-24 text-center text-secondary font-medium flex-shrink-0">Story Points</span>
                </div>

                {/* Player Rows */}
                {votingPlayers.map((player) => {
                  const playerVote = getPlayerVote(player.id)
                  const voted = hasPlayerVoted(player.id)
                  const isFlipped = revealedPlayerIds.has(player.id)
                  const shouldShowFace = isRevealed && voted
                  
                  return (
                    <div key={player.id} className="px-4 py-3 flex items-center hover:bg-neutral-light">
                      <span className="text-secondary flex-1 min-w-0 truncate pr-1">{player.name}</span>
                      <div className="w-20 sm:w-24 flex justify-center flex-shrink-0">
                        {shouldShowFace ? (
                          <div 
                            className="relative w-10 h-14 sm:w-12 sm:h-16"
                            style={{ perspective: '1000px' }}
                          >
                              <div 
                                className="relative w-full h-full transition-transform duration-1000 transform-style-3d"
                              style={{ 
                                transformStyle: 'preserve-3d',
                                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                              }}
                            >
                              {/* Card Back (face-down) */}
                              <div 
                                className="absolute w-full h-full bg-white border border-primary/30 rounded flex items-center justify-center backface-hidden"
                                style={{ backfaceVisibility: 'hidden' }}
                              >
                                <svg className="w-6 h-6 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                                </svg>
                              </div>
                              {/* Card Front (face-up with number) */}
                              <div 
                                className="absolute w-full h-full bg-white border border-primary/30 rounded flex items-center justify-center"
                                style={{ 
                                  backfaceVisibility: 'hidden',
                                  transform: 'rotateY(180deg)',
                                }}
                              >
                                <span className="absolute top-0.5 left-0.5 text-[6px] sm:text-[8px] text-[#5B6A79]">✦</span>
                                <span className="absolute top-0.5 right-0.5 text-[6px] sm:text-[8px] text-[#5B6A79]">✦</span>
                                <span className="absolute bottom-0.5 left-0.5 text-[6px] sm:text-[8px] text-[#5B6A79]">✦</span>
                                <span className="absolute bottom-0.5 right-0.5 text-[6px] sm:text-[8px] text-[#5B6A79]">✦</span>
                                <span className="text-xl sm:text-2xl font-bold text-[#5B6A79]">{playerVote}</span>
                              </div>
                            </div>
                          </div>
                        ) : voted ? (
                          <div className="w-10 h-14 sm:w-12 sm:h-16 bg-neutral-light border border-border rounded flex items-center justify-center">
                            <span className="text-neutral text-lg sm:text-xl">✓</span>
                          </div>
                        ) : (
                          <div className="w-10 h-14 sm:w-12 sm:h-16 border-2 border-dashed border-border rounded flex items-center justify-center">
                            <span className="text-neutral-subtle">—</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {votingPlayers.length === 0 && (
                  <div className="px-4 py-8 text-center text-neutral">
                    No players yet. Waiting for participants...
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
          </div>

          {/* Sidebar - Voted Tasks */}
          <div className="md:col-span-1">
            <div className="bg-surface rounded-lg border border-border elevation-medium p-4 max-h-[calc(100vh-120px)] md:max-h-96 overflow-y-auto">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-secondary">Voted Tasks</h3>
              </div>

              {/* Voted Tasks List */}
              <div className="space-y-1.5">
                {issues.map((issue, index) => {
                  const issueVotes = votes[issue.id] || []
                  const isVoted = issueVotes.length > 0
                  const isViewing = currentIssue?.id === issue.id
                  
                  return (
                    <div
                      key={issue.id}
                      onClick={() => {
                        // Simple local navigation
                      }}
                      className={`p-2.5 rounded cursor-pointer transition-colors border ${
                        isViewing
                          ? 'bg-blue-light border-primary/30'
                          : 'bg-surface border-transparent hover:bg-neutral-light'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary truncate">
                            {issue.title}
                          </p>
                          {issue.estimated_points && (
                            <p className="text-xs text-primary mt-0.5">
                              {issue.estimated_points} points
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {/* Voted badge */}
                          {isVoted && (
                            <span className="text-[10px] font-medium text-success bg-green-light px-1.5 py-0.5 rounded">
                              Voted
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {issues.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-neutral-light flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-neutral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-neutral text-sm">No voted tasks yet</p>
                  <p className="text-neutral text-xs mt-1">Completed votes will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
