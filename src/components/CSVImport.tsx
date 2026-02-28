'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

interface CSVImportProps {
  gameId: string
  onImportComplete: () => void
}

export function CSVImport({ gameId, onImportComplete }: CSVImportProps) {
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
    if (!csvText.trim()) return

    setIsImporting(true)
    setError(null)

    try {
      const titles = parseCSV(csvText)

      // Get current issues count
      const { data: existingIssues } = await supabase
        .from('issues')
        .select('order')
        .eq('game_id', gameId)
        .order('order', { ascending: false })
        .limit(1)

      const startOrder = existingIssues && existingIssues.length > 0
        ? (existingIssues[0] as any).order + 1
        : 0

      // Insert issues
      const issuesToInsert = titles.map((title, index) => ({
        game_id: gameId,
        title,
        order: startOrder + index,
        status: existingIssues && existingIssues.length === 0 && index === 0 ? 'voting' : 'pending',
      }))

      const { error } = await supabase
        .from('issues')
        .insert(issuesToInsert)

      if (error) throw error

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
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-primary hover:bg-blue-600 rounded-lg text-white text-sm font-semibold transition-colors"
      >
        Import CSV
      </button>

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
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!csvText.trim() || isImporting}
                    className="flex-1 px-4 py-2 bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors"
                  >
                    {isImporting ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
