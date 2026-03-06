'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

const LAST_GAME_ID_KEY = 'planning_poker_last_game_id'

export default function Home() {
  const router = useRouter()
  const [gameName, setGameName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isCheckingLastGame, setIsCheckingLastGame] = useState(true)
  const [showCreateNew, setShowCreateNew] = useState(false)

  useEffect(() => {
    const lastGameId = localStorage.getItem(LAST_GAME_ID_KEY)
    if (lastGameId && !showCreateNew) {
      const checkGame = async () => {
        try {
          const { data } = await supabase
            .from('games')
            .select('id')
            .eq('id', lastGameId)
            .single()
          
          if (data) {
            router.push(`/game/${lastGameId}`)
          } else {
            localStorage.removeItem(LAST_GAME_ID_KEY)
            setIsCheckingLastGame(false)
          }
        } catch {
          setIsCheckingLastGame(false)
        }
      }
      checkGame()
    } else {
      setIsCheckingLastGame(false)
    }
  }, [router, showCreateNew])

  const saveLastGameId = (gameId: string) => {
    localStorage.setItem(LAST_GAME_ID_KEY, gameId)
  }

  const handleCreateGame = async () => {
    if (!gameName.trim()) return

    setIsCreating(true)
    try {
      const gameId = uuidv4().slice(0, 8)

      const { data, error } = await supabase
        .from('games')
        .insert({
          id: gameId,
          name: gameName.trim(),
          created_by: 'anonymous',
          status: 'lobby',
          settings: {
            maxVotes: 9,
            autoReveal: false,
            anonymousVotes: false,
          },
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Game created:', data)
      saveLastGameId(gameId)
      router.push(`/game/${gameId}`)
    } catch (error) {
      console.error('Failed to create game:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to create game: ${errorMessage}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinGame = () => {
    const gameId = prompt('Enter game ID:')
    if (gameId) {
      saveLastGameId(gameId)
      router.push(`/game/${gameId}`)
    }
  }

  const handleCreateNewGame = () => {
    setShowCreateNew(true)
    setIsCheckingLastGame(false)
  }

  if (isCheckingLastGame) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-neutral-light border-t-primary rounded-full mx-auto mb-4"
          />
          <p className="text-secondary text-lg">Checking for your last game...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-surface elevation-low">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div className="text-xl font-semibold text-secondary">Planning Poker</div>
            </motion.div>
            <div className="flex gap-2">
              <button
                onClick={handleJoinGame}
                className="px-4 py-2 text-secondary hover:bg-neutral-light rounded transition-colors font-medium"
              >
                Join Game
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-secondary mb-4">
              Scrum Poker for agile teams
            </h1>
            <p className="text-xl text-neutral mb-8">
              Easy-to-use and fun estimations. Vote and estimate issues in real-time.
            </p>
          </div>

          {/* Create Game Card */}
          <div className="bg-surface rounded-lg border border-border elevation-medium p-8 max-w-md mx-auto mb-16">
            <h2 className="text-2xl font-semibold text-secondary mb-6">
              {showCreateNew ? 'Start New Game' : 'Create Game'}
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter game name"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateGame()}
                className="w-full px-4 py-2.5 rounded border border-border text-secondary placeholder-neutral focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                autoFocus
              />
              <button
                onClick={handleCreateGame}
                disabled={!gameName.trim() || isCreating}
                className="w-full py-2.5 bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-semibold transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Game'}
              </button>

              {!showCreateNew && (
                <button
                  onClick={handleJoinGame}
                  className="w-full py-2.5 bg-neutral-light hover:bg-neutral-200 rounded text-secondary font-semibold transition-colors"
                >
                  Join Existing Game
                </button>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface rounded-lg border border-border elevation-low p-6"
            >
              <div className="w-12 h-12 rounded bg-blue-light flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-secondary mb-2">
                Real-Time Voting
              </h3>
              <p className="text-neutral">
                Vote and estimate issues in real-time with your team. See results at a glance.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-surface rounded-lg border border-border elevation-low p-6"
            >
              <div className="w-12 h-12 rounded bg-blue-light flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-secondary mb-2">
                Issue Management
              </h3>
              <p className="text-neutral">
                Manage all your issues in one place. Track voting progress and consensus.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-surface rounded-lg border border-border elevation-low p-6"
            >
              <div className="w-12 h-12 rounded bg-green-light flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-secondary mb-2">
                Fun & Engaging
              </h3>
              <p className="text-neutral">
                Beautiful card animations and coffee break options make estimation enjoyable.
              </p>
            </motion.div>
          </div>

          {/* How It Works */}
          <div className="bg-surface rounded-lg border border-border elevation-medium p-8 mb-16">
            <h2 className="text-3xl font-bold text-secondary mb-8">
              How It Works
            </h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="text-base font-semibold text-secondary mb-2">
                  Create Game
                </h3>
                <p className="text-neutral text-sm">
                  Start a new game and get a shareable URL
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="text-base font-semibold text-secondary mb-2">
                  Invite Team
                </h3>
                <p className="text-neutral text-sm">
                  Share the URL with your team members
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="text-base font-semibold text-secondary mb-2">
                  Vote & Discuss
                </h3>
                <p className="text-neutral text-sm">
                  Vote on issues and discuss until consensus
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                  4
                </div>
                <h3 className="text-base font-semibold text-secondary mb-2">
                  Estimate
                </h3>
                <p className="text-neutral text-sm">
                  Reach consensus and move to the next issue
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6">
        <div className="container mx-auto px-4 text-center text-neutral text-sm">
          <p>&copy; 2026 Planning Poker Online. Built for agile teams. {process.env.NEXT_PUBLIC_GIT_COMMIT?.slice(0, 7) && <span className="text-neutral-light">({process.env.NEXT_PUBLIC_GIT_COMMIT.slice(0, 7)})</span>}</p>
        </div>
      </footer>
    </div>
  )
}
