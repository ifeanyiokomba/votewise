'use client'

import { io, Socket } from 'socket.io-client'
import { useApp, LiveResults } from '@/lib/store'

let socket: Socket | null = null

export function getResultsSocket(): Socket {
  if (socket) return socket
  socket = io('/?XTransformPort=3030', {
    path: '/',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1500,
    reconnectionAttempts: 20,
  })
  socket.on('connect', () => {
    console.log('[socket] connected to results service')
  })
  socket.on('disconnect', () => {
    console.log('[socket] disconnected')
  })
  socket.on('results', (payload: LiveResults) => {
    useApp.getState().setLive(payload)
  })
  return socket
}

export function requestResults() {
  socket?.emit('request-results')
}
