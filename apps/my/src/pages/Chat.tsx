import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { $api } from '../lib/api/client'
import { useChat, ChatMessage } from '../hooks/useChat'
import { useAuth } from '../lib/auth/context'

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  // Only store real-time messages (from WebSocket) and optimistic messages
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch initial messages
  const { data: messagesData, isLoading } = $api.useQuery(
    'get',
    '/v1/chat/matches/{match_id}/messages',
    { params: { path: { match_id: matchId! } } },
    { enabled: !!matchId }
  )

  // Get match info for header
  const { data: matches } = $api.useQuery('get', '/v1/matching/matches')
  const currentMatch = matches?.find((m) => m.id === matchId)

  // Derive messages from API data + realtime messages
  const messages = useMemo(() => {
    const apiMessages: ChatMessage[] = (messagesData?.messages || []).map((m) => ({
      ...m,
      is_own: m.sender_id === user?.id,
    }))

    // Merge API messages with realtime messages, avoiding duplicates
    const allMessages = [...apiMessages]
    for (const rtMsg of realtimeMessages) {
      if (!allMessages.some((m) => m.id === rtMsg.id)) {
        allMessages.push(rtMsg)
      }
    }

    // Sort by created_at
    return allMessages.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [messagesData?.messages, realtimeMessages, user?.id])

  // WebSocket connection
  const handleNewMessage = useCallback((message: ChatMessage) => {
    setRealtimeMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === message.id)) {
        return prev
      }
      return [...prev, message]
    })
  }, [])

  const handleTyping = useCallback(
    (userId: string) => {
      if (userId !== user?.id) {
        setIsTyping(true)
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        // Hide typing indicator after 3 seconds
        typingTimeoutRef.current = window.setTimeout(() => {
          setIsTyping(false)
        }, 3000)
      }
    },
    [user?.id]
  )

  const handleMessagesRead = useCallback(
    (readerId: string) => {
      if (readerId !== user?.id) {
        // Mark all own messages as read in realtime messages
        setRealtimeMessages((prev) =>
          prev.map((m) =>
            m.sender_id === user?.id && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m
          )
        )
      }
    },
    [user?.id]
  )

  const {
    isConnected,
    isConnecting,
    error: wsError,
    sendMessage,
    sendTyping,
    markRead,
  } = useChat({
    matchId: matchId!,
    onNewMessage: handleNewMessage,
    onTyping: handleTyping,
    onMessagesRead: handleMessagesRead,
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read when viewing
  useEffect(() => {
    if (isConnected && messages.length > 0) {
      markRead()
    }
  }, [isConnected, messages.length, markRead])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const content = inputValue.trim()
    if (!content || !isConnected) return

    sendMessage(content)
    setInputValue('')

    // Optimistically add message
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      match_id: matchId!,
      sender_id: user?.id || '',
      content,
      created_at: new Date().toISOString(),
      read_at: null,
      is_own: true,
    }
    setRealtimeMessages((prev) => [...prev, optimisticMessage])
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    sendTyping()
  }

  if (!matchId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-text-dim">Invalid conversation</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[800px]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border-light">
        <button
          onClick={() => navigate('/matches')}
          className="text-text-dim hover:text-text transition-colors"
        >
          &larr;
        </button>
        {currentMatch?.other_user_photo ? (
          <img
            src={currentMatch.other_user_photo}
            alt={currentMatch.other_user_name || 'Match'}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-lg">
            {currentMatch?.other_user_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1">
          <h1 className="font-medium">{currentMatch?.other_user_name || 'Chat'}</h1>
          <div className="text-xs text-text-dim">
            {isConnecting && 'Connecting...'}
            {isConnected && !isTyping && 'Online'}
            {isConnected && isTyping && 'Typing...'}
            {!isConnected && !isConnecting && 'Offline'}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {wsError && (
        <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg mt-4">{wsError}</div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-dim">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-text-dim">
            <div className="text-4xl">👋</div>
            <p>Say hello to start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                  message.sender_id === user?.id
                    ? 'bg-text text-bg rounded-br-md'
                    : 'bg-surface-elevated text-text rounded-bl-md'
                }`}
              >
                <p className="break-words">{message.content}</p>
                <div
                  className={`text-xs mt-1 ${
                    message.sender_id === user?.id ? 'text-bg/60' : 'text-text-dim'
                  }`}
                >
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {message.sender_id === user?.id && message.read_at && ' · Read'}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-4 border-t border-border-light">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
            disabled={!isConnected}
            className="flex-1 bg-surface border border-border-light rounded-full px-4 py-3 text-text placeholder:text-text-dim focus:outline-none focus:border-text/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isConnected || !inputValue.trim()}
            className="bg-text text-bg px-6 py-3 rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-text/90 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
