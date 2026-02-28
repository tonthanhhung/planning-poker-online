// Generate a unique avatar for a player based on their name
export function generateAvatar(name: string): { 
  gradient: string
  pattern: string 
  emoji: string
} {
  // Color palettes
  const gradients = [
    'from-pink-500 to-rose-500',
    'from-purple-500 to-indigo-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-red-500 to-pink-500',
    'from-indigo-500 to-purple-500',
    'from-teal-500 to-green-500',
    'from-orange-500 to-red-500',
    'from-cyan-500 to-blue-500',
    'from-lime-500 to-green-500',
    'from-fuchsia-500 to-purple-500',
  ]

  // Fun emojis for avatars
  const emojis = [
    '🦊', '🐯', '🦁', '🐮', '🐷', '🐸', '🐙', '🦄',
    '🐲', '🐼', '🐨', '🐯', '🦁', '🐶', '🐱', '🐭',
    '🐹', '🐰', '🦝', '🐻', '🐼', '🦘', '🦡', '🐨',
    '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🐔',
  ]

  // Generate consistent hash from name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  const gradientIndex = Math.abs(hash) % gradients.length
  const emojiIndex = Math.abs(hash) % emojis.length

  return {
    gradient: gradients[gradientIndex],
    pattern: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 50%)',
    emoji: emojis[emojiIndex],
  }
}

// Get consistent avatar for a player
const avatarCache = new Map<string, ReturnType<typeof generateAvatar>>()

export function getAvatar(name: string) {
  if (!avatarCache.has(name)) {
    avatarCache.set(name, generateAvatar(name))
  }
  return avatarCache.get(name)!
}
