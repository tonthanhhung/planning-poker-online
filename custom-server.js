const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error handling request:', req.url, err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })

  // Attach Socket.IO
  const io = new Server(server, {
    path: '/api/socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('join-game', ({ gameId, playerId, playerName }) => {
      socket.join(gameId)
      console.log(`Player ${playerName} joined game ${gameId}`)
      socket.emit('joined-game', { gameId, playerId, playerName })
    })

    socket.on('reaction', ({ gameId, emoji, playerName, targetPlayerId, isImage, imageUrl }) => {
      console.log(`Reaction from ${playerName}: ${emoji}`)
      io.to(gameId).emit('reaction', { emoji, playerName, targetPlayerId, isImage, imageUrl })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.IO path: /api/socket`)
  })
})
