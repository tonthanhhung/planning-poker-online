const http = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

// IMPORTANT: Set production mode before importing Next.js
process.env.NODE_ENV = 'production';

const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3000;

// Initialize Next.js in production mode
const app = next({ 
  dev: false, 
  hostname, 
  port,
  dir: __dirname
});

const handle = app.getRequestHandler();

// Track active games
const gameRooms = new Map();

app.prepare().then(() => {
  console.log('Next.js app prepared, starting server...');
  
  // Create HTTP server
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

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
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-game', ({ gameId, playerId, playerName }) => {
      console.log(`Player ${playerName} joining game ${gameId}`);
      socket.join(gameId);
      
      if (!gameRooms.has(gameId)) {
        gameRooms.set(gameId, new Map());
      }
      gameRooms.get(gameId).set(playerId, { playerId, playerName, socketId: socket.id });
      
      socket.emit('joined-game', { gameId, playerId, playerName });
      socket.to(gameId).emit('player-joined', { playerId, playerName });
    });

    socket.on('reaction', ({ gameId, emoji, playerName, targetPlayerId, isImage, imageUrl }) => {
      console.log(`Reaction from ${playerName}: ${emoji}`);
      io.to(gameId).emit('reaction', { emoji, playerName, targetPlayerId, isImage, imageUrl });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO path: /api/socket`);
  });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
