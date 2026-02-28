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

  // Check for last game on mount and auto-redirect
  useEffect(() => {
    const lastGameId = localStorage.getItem(LAST_GAME_ID_KEY)
    if (lastGameId && !showCreateNew) {
      // Verify the game still exists before redirecting
      const checkGame = async () => {
        try {
          const { data } = await supabase
            .from('games')
            .select('id')
            .eq('id', lastGameId)
            .single()
          
          if (data) {
            // Game exists, redirect to it
            router.push(`/game/${lastGameId}`)
          } else {
            // Game no longer exists, clear it
            localStorage.removeItem(LAST_GAME_ID_KEY)
            setIsCheckingLastGame(false)
          }
        } catch {
          // Error checking, just show the form
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
      const gameId = uuidv4().slice(0, 8) // Short ID for easy sharing

      console.log('Creating game:', gameId, 'with name:', gameName)
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

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

  // Show loading state while checking last game
  if (isCheckingLastGame) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-white/20 border-t-primary rounded-full mx-auto mb-4"
          />
          <p className="text-white text-lg">Checking for your last game...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl font-bold text-white"
            >
              Planning Poker Online
            </motion.div>
            <div className="flex gap-4">
              <button
                onClick={handleJoinGame}
                className="px-4 py-2 text-white hover:text-accent transition-colors"
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
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h1 className="text-6xl font-bold text-white mb-6">
            Scrum Poker for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              agile teams
            </span>
          </h1>
          <p className="text-2xl text-gray-300 mb-12">
            Easy-to-use and fun estimations. Vote and estimate issues in real-time.
          </p>

          {/* Create Game Form */}
          <div className="glass rounded-2xl p-8 max-w-md mx-auto mb-16">
            <h2 className="text-2xl font-semibold text-white mb-6">
              {showCreateNew ? 'Start New Game' : 'Create Game'}
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter game name"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateGame()}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={handleCreateGame}
                disabled={!gameName.trim() || isCreating}
                className="w-full py-3 bg-gradient-to-r from-primary to-secondary hover:from-blue-600 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold text-lg transition-all glow-hover"
              >
                {isCreating ? 'Creating...' : 'Create Game'}
              </button>

              {!showCreateNew && (
                <button
                  onClick={handleJoinGame}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition-colors"
                >
                  Join Existing Game
                </button>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-xl p-6"
            >
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Real-Time Voting
              </h3>
              <p className="text-gray-400">
                Vote and estimate issues in real-time with your team. See results at a glance.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-xl p-6"
            >
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Issue Management
              </h3>
              <p className="text-gray-400">
                Manage all your issues in one place. Track voting progress and consensus.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-xl p-6"
            >
              <div className="text-4xl mb-4">☕</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Fun & Engaging
              </h3>
              <p className="text-gray-400">
                Beautiful card animations and coffee break options make estimation enjoyable.
              </p>
            </motion.div>
          </div>

          {/* How It Works */}
          <div className="glass rounded-2xl p-8 mb-16">
            <h2 className="text-3xl font-bold text-white mb-8">
              How It Works
            </h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Create Game
                </h3>
                <p className="text-gray-400 text-sm">
                  Start a new game and get a shareable URL
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Invite Team
                </h3>
                <p className="text-gray-400 text-sm">
                  Share the URL with your team members
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-dark text-2xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Vote & Discuss
                </h3>
                <p className="text-gray-400 text-sm">
                  Vote on issues and discuss until consensus
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                  4
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Estimate
                </h3>
                <p className="text-gray-400 text-sm">
                  Reach consensus and move to the next issue
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/10 py-8">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>&copy; 2024 Planning Poker Online. Built for agile teams.</p>
        </div>
      </footer>
    </div>
  )
}
