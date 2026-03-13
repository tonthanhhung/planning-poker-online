'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWebSocketPresence } from '@/hooks/useWebSocketPresence'
import { usePlayer } from '@/hooks/usePlayer'
import { Button } from './Button'

interface CSVImportProps {
  gameId: string
  onImportComplete: () => void
}

export function CSVImport({ gameId, onImportComplete }: CSVImportProps) {
  const { playerId, playerName } = usePlayer()
  const { socket } = useWebSocketPresence(gameId, playerId, playerName || '')
  
  const [isOpen, setIsOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string[]>([])

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim())
    const titles = lines.map(line => {
      // Handle CSV with commas in quotes
      const match = line.match(/^"([^"]+)"|([^,]+)/)
      return match ? (match[1] || match[2]).trim() : line.trim()
    })
    return titles
  }

  const handleCSVChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setCsvText(value)
    const parsed = parseCSV(value)
    setPreview(parsed.slice(0, 5)) // Show first 5 items
  }

  const handleImport = async () => {
    if (!csvText.trim() || !socket) return

    setIsImporting(true)
    setError(null)

    try {
      const titles = parseCSV(csvText)

      // Import each issue via Socket.IO
      const importPromises = titles.map((title, index) => {
        return new Promise<void>((resolve, reject) => {
          socket.emit('create-issue', { 
            gameId, 
            title, 
            order: index,
            status: index === 0 ? 'voting' : 'pending'
          }, (response: any) => {
            if (response.success) {
              resolve()
            } else {
              reject(new Error(response.error || 'Failed to create issue'))
            }
          })
        })
      })

      await Promise.all(importPromises)

      setIsOpen(false)
      setCsvText('')
      setPreview([])
      onImportComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import issues')
    } finally {
      setIsImporting(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
      const parsed = parseCSV(text)
      setPreview(parsed.slice(0, 5))
    }
    reader.readAsText(file)
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Import CSV
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass rounded-2xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white mb-4">
                Import Issues from CSV
              </h2>

              <p className="text-gray-400 mb-4">
                Paste your CSV file content or upload a file. Each line should contain one issue title.
              </p>

              <div className="space-y-4">
                <textarea
                  value={csvText}
                  onChange={handleCSVChange}
                  placeholder="User Login Page&#10;Shopping Cart&#10;Checkout Process&#10;..."
                  className="w-full h-40 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                />

                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">or</span>
                  <label className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm font-semibold transition-colors cursor-pointer">
                    Upload File
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {preview.length > 0 && (
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-2">
                      Preview ({preview.length} of {csvText.split('\n').filter(l => l.trim()).length} issues):
                    </p>
                    <ul className="text-white text-sm space-y-1">
                      {preview.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="text-gray-500">{index + 1}.</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!csvText.trim() || isImporting}
                    className="flex-1"
                  >
                    {isImporting ? 'Importing...' : 'Import'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
