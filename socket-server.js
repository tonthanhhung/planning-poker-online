const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store Socket.IO instance globally for access from API routes
let io;

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Attach Socket.IO to the HTTP server with optimized settings for Fly.io
  io = new Server(server, {
    path: '/api/socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    // Disable per-message deflate to avoid issues with some proxies
    perMessageDeflate: false,
  });

  // Store io globally so API routes can access it
  global.io = io;

  // Track active games and their players
  const gameRooms = new Map();

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('join-game', ({ gameId, playerId, playerName }) => {
      console.log(`Player ${playerName} (${playerId}) joining game ${gameId}`);
      
      socket.join(gameId);
      socket.gameId = gameId;
      socket.playerId = playerId;
      socket.playerName = playerName;

      if (!gameRooms.has(gameId)) {
        gameRooms.set(gameId, new Map());
      }
      gameRooms.get(gameId).set(playerId, {
        playerId,
        playerName,
        socketId: socket.id,
        isOnline: true,
      });

      socket.emit('joined-game', { 
        gameId, 
        playerId, 
        playerName,
        players: Array.from(gameRooms.get(gameId).values())
      });

      io.to(gameId).emit('presence-update', 
        Array.from(gameRooms.get(gameId).values())
      );
    });

    socket.on('reaction', ({ gameId, emoji, playerName, targetPlayerId, isImage, imageUrl }) => {
      console.log(`Reaction from ${playerName} in game ${gameId}: ${emoji}`);
      io.to(gameId).emit('reaction', { 
        emoji, 
        playerName, 
        targetPlayerId, 
        isImage, 
        imageUrl 
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, 'Reason:', reason);
      
      const gameId = socket.gameId;
      const playerId = socket.playerId;
      
      if (gameId && playerId && gameRooms.has(gameId)) {
        const room = gameRooms.get(gameId);
        room.delete(playerId);
        
        if (room.size === 0) {
          gameRooms.delete(gameId);
        } else {
          io.to(gameId).emit('presence-update', Array.from(room.values()));
        }
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO path: /api/socket`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
