import { Server as SocketIOServer } from 'socket.io'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Initialize Socket.IO on the global object to prevent multiple instances
const globalForSocket = global as unknown as { io: SocketIOServer | undefined }

export async function GET(req: NextRequest) {
  if (!globalForSocket.io) {
    // Get the HTTP server from the request
    const res = await fetch('http://localhost:3000/api/socket/init', { method: 'POST' })
  }
  
  return Response.json({ success: true, message: 'Socket.io server' })
}
