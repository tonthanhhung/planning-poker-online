import { NextApiRequest, NextApiResponse } from 'next'
import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { getPresenceServer } from '@/lib/presence-server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Return simple response for health check
  return Response.json({ success: true, message: 'Socket.io server endpoint' })
}
