import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { getPresenceServer } from './src/lib/presence-server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      
      // For Socket.IO requests, just end the response
      // Socket.IO will handle the actual communication
      if (req.url?.startsWith('/api/socket')) {
        res.writeHead(200)
        res.end()
        return
      }
      
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Attach Socket.io presence server BEFORE starting to listen
  const presenceServer = getPresenceServer()
  const io = presenceServer.attach(server)
  
  console.log('Socket.IO attached with path:', '/api/socket')

  server
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Socket.IO path: /api/socket`)
    })
})
