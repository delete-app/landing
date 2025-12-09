import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '../lib/config'

export interface ChatMessage {
  id: string
  match_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
  is_own?: boolean
}

interface WebSocketMessage {
  type: 'new_message' | 'typing' | 'messages_read' | 'error'
  message?: ChatMessage
  user_id?: string
  reader_id?: string
  error?: string
}

interface UseChatOptions {
  matchId: string
  onNewMessage?: (message: ChatMessage) => void
  onTyping?: (userId: string) => void
  onMessagesRead?: (readerId: string) => void
}

interface UseChatReturn {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  sendMessage: (content: string) => void
  sendTyping: () => void
  markRead: () => void
  disconnect: () => void
}

function getAccessToken(): string | null {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'access_token') {
      return value
    }
  }
  return null
}

export function useChat({
  matchId,
  onNewMessage,
  onTyping,
  onMessagesRead,
}: UseChatOptions): UseChatReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const mountedRef = useRef(true)

  // Store callbacks in refs to avoid effect dependencies
  const callbacksRef = useRef({ onNewMessage, onTyping, onMessagesRead })
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onTyping, onMessagesRead }
  })

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    reconnectAttemptsRef.current = maxReconnectAttempts
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }))
    }
  }, [])

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }))
    }
  }, [])

  const markRead = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'read' }))
    }
  }, [])

  // Connection effect - manages WebSocket lifecycle
  useEffect(() => {
    mountedRef.current = true
    reconnectAttemptsRef.current = 0

    const createConnection = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      const token = getAccessToken()
      if (!token) {
        setError('Not authenticated')
        return
      }

      setIsConnecting(true)
      setError(null)

      const wsUrl = config.apiUrl.replace(/^http/, 'ws')
      const url = `${wsUrl}/v1/chat/ws/${matchId}?token=${token}`

      try {
        const ws = new WebSocket(url)

        ws.onopen = () => {
          if (!mountedRef.current) {
            ws.close()
            return
          }
          setIsConnected(true)
          setIsConnecting(false)
          setError(null)
          reconnectAttemptsRef.current = 0
        }

        ws.onmessage = (event) => {
          if (!mountedRef.current) return
          try {
            const data: WebSocketMessage = JSON.parse(event.data)
            const { onNewMessage, onTyping, onMessagesRead } = callbacksRef.current

            switch (data.type) {
              case 'new_message':
                if (data.message && onNewMessage) {
                  onNewMessage(data.message)
                }
                break
              case 'typing':
                if (data.user_id && onTyping) {
                  onTyping(data.user_id)
                }
                break
              case 'messages_read':
                if (data.reader_id && onMessagesRead) {
                  onMessagesRead(data.reader_id)
                }
                break
              case 'error':
                setError(data.error || 'Unknown error')
                break
            }
          } catch {
            console.error('Failed to parse WebSocket message')
          }
        }

        ws.onerror = () => {
          if (!mountedRef.current) return
          setError('Connection error')
          setIsConnected(false)
          setIsConnecting(false)
        }

        ws.onclose = (event) => {
          if (!mountedRef.current) return
          setIsConnected(false)
          setIsConnecting(false)
          wsRef.current = null

          if (event.code === 4001) {
            setError('Invalid authentication')
            return
          }
          if (event.code === 4003) {
            setError('Not authorized for this conversation')
            return
          }

          // Attempt reconnection
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
            reconnectTimeoutRef.current = window.setTimeout(() => {
              if (mountedRef.current) {
                reconnectAttemptsRef.current++
                createConnection()
              }
            }, delay)
          } else {
            setError('Connection lost. Please refresh to reconnect.')
          }
        }

        wsRef.current = ws
      } catch {
        setIsConnecting(false)
        setError('Failed to connect')
      }
    }

    // Start connection asynchronously to avoid synchronous setState
    const timeoutId = window.setTimeout(createConnection, 0)

    return () => {
      mountedRef.current = false
      window.clearTimeout(timeoutId)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [matchId])

  return {
    isConnected,
    isConnecting,
    error,
    sendMessage,
    sendTyping,
    markRead,
    disconnect,
  }
}
