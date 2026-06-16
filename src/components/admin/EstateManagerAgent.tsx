import { useState, useRef, useEffect } from 'react'

const WORKFLOW_URL = import.meta.env.VITE_WORKFLOW_URL || 'http://localhost:3001'
const SOCIETY_ID = import.meta.env.VITE_SOCIETY_ID || 'eafc59c7-4148-44ee-b66b-256a5338718b'

interface Message {
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  tool_calls?: number
}

// ─── Markdown-like message formatter ─────────────────────────────────────────

function formatMessage(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.startsWith('* ') || line.startsWith('• ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', paddingLeft: '8px' }}>
          <span style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }}>•</span>
          <span>{line.slice(2)}</span>
        </div>
      )
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      return (
        <p key={i} style={{ fontWeight: 600, marginBottom: '4px', margin: '0 0 4px' }}>
          {line.slice(2, -2)}
        </p>
      )
    }
    if (line.trim() === '') {
      return <br key={i} />
    }
    return (
      <p key={i} style={{ marginBottom: '4px', lineHeight: '1.6', margin: '0 0 4px' }}>
        {line}
      </p>
    )
  })
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    }}>
      <div style={{
        width: '28px', height: '28px',
        borderRadius: '50%',
        background: '#1C1917',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: '12px',
      }}>
        🤖
      </div>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E0DDD9',
        borderRadius: '12px 12px 12px 4px',
        padding: '10px 14px',
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: '#9C9894',
            animation: `ema-bounce 1.2s infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  "What's most urgent right now?",
  "Plan today's work schedule",
  "Any monsoon prep needed?",
  "What should I tell the committee?",
  "Cost savings this month",
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function EstateManagerAgent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<object[]>([])
  const [isBriefingLoading, setIsBriefingLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load morning briefing on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadMorningBriefing()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMorningBriefing = async () => {
    setIsBriefingLoading(true)
    try {
      const res = await fetch(`${WORKFLOW_URL}/agent/briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ society_id: SOCIETY_ID }),
      })
      const data = await res.json()
      if (data.briefing) {
        setMessages([{
          role: 'agent',
          content: data.briefing,
          timestamp: new Date(),
        }])
      }
    } catch {
      setMessages([{
        role: 'agent',
        content: `Hi! I'm Aria, your Estate Operations Intelligence. I've checked your society data and I'm ready to help. What would you like to focus on today?`,
        timestamp: new Date(),
      }])
    } finally {
      setIsBriefingLoading(false)
    }
  }

  const sendMessage = async (overrideInput?: string) => {
    const userMessage = (overrideInput ?? input).trim()
    if (!userMessage || isLoading) return

    setInput('')

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }])

    setIsLoading(true)

    try {
      const res = await fetch(`${WORKFLOW_URL}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          society_id: SOCIETY_ID,
          conversation_history: conversationHistory,
        }),
      })

      const data = await res.json()

      if (data.response) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: data.response,
          timestamp: new Date(),
          tool_calls: data.tool_calls_made,
        }])
        setConversationHistory(data.conversation_history || [])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'agent',
        content: 'Sorry, I could not connect to the workflow server. Make sure it is running on port 3001.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setConversationHistory([])
    loadMorningBriefing()
  }

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title="Estate Manager Agent"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: '#1C1917',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(28,25,23,0.3)',
          zIndex: 1000,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EDEBE6" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EDEBE6" strokeWidth="1.5">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-4.95-1.31L2 22l1.31-5.05A9.96 9.96 0 0 1 2 12 10 10 0 0 1 12 2z" />
            <path d="M8 10h.01M12 10h.01M16 10h.01" />
          </svg>
        )}

        {/* Amber notification dot */}
        {!isOpen && (
          <div style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: '#D97706',
            border: '2px solid #FFFFFF',
          }} />
        )}
      </button>

      {/* ── Chat panel ── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '24px',
          width: '380px',
          height: 'calc(100vh - 120px)',
          maxHeight: '600px',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E0DDD9',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'ema-slideUp 0.2s ease-out',
        }}>

          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: '#1C1917',
            borderRadius: '20px 20px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <img 
              src="/chatbot.png" 
              alt="Aria"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'cover',
                borderRadius: '50%',
              }}
            />
            <div style={{ flex: 1 }}>
              <p style={{
                fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: '14px',
                color: '#FFFFFF', margin: 0,
              }}>
                Estate Manager Agent
              </p>
              <p style={{
                fontFamily: 'Inter', fontSize: '11px',
                color: 'rgba(215,218,220,0.6)', margin: 0,
              }}>
                AI Operations Co-pilot
              </p>
            </div>
            <button
              onClick={clearChat}
              title="New conversation"
              style={{
                background: 'none', border: 'none',
                color: 'rgba(215,218,220,0.6)',
                cursor: 'pointer', fontSize: '11px',
                fontFamily: 'Inter', padding: '4px 8px', borderRadius: '6px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#EDEBE6' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(215,218,220,0.6)' }}
            >
              New chat
            </button>
          </div>

          {/* Messages area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#FAFAF9',
          }}>
            {isBriefingLoading && <TypingDots />}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: '8px',
                alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '28px', height: '28px',
                  borderRadius: '50%',
                  background: msg.role === 'user' ? '#D97706' : '#1C1917',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: msg.role === 'agent' ? '11px' : undefined,
                  fontWeight: msg.role === 'user' ? 600 : undefined,
                  color: '#FFFFFF',
                  fontFamily: 'Space Grotesk',
                }}>
                  {msg.role === 'user' ? 'A' : (
                    <img 
                      src="/chatbot.png" 
                      alt="Aria"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%',
                      }}
                    />
                  )}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'user' ? '#1C1917' : '#FFFFFF',
                  border: msg.role === 'user' ? 'none' : '1px solid #E0DDD9',
                  borderRadius: msg.role === 'user'
                    ? '12px 12px 4px 12px'
                    : '12px 12px 12px 4px',
                  padding: '10px 14px',
                  fontFamily: 'Inter',
                  fontSize: '13px',
                  color: msg.role === 'user' ? '#FFFFFF' : '#1C1917',
                  lineHeight: '1.6',
                }}>
                  {msg.role === 'agent' ? formatMessage(msg.content) : msg.content}

                  {/* Tool calls badge */}
                  {msg.tool_calls != null && msg.tool_calls > 0 && (
                    <p style={{
                      fontSize: '10px', color: '#9C9894',
                      margin: '6px 0 0', fontFamily: 'Inter',
                    }}>
                      ⚡ {msg.tool_calls} data {msg.tool_calls === 1 ? 'query' : 'queries'} made
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && <TypingDots />}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions (visible when chat is fresh) */}
          {messages.length <= 1 && !isLoading && !isBriefingLoading && (
            <div style={{
              padding: '8px 16px',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              borderTop: '1px solid #F0EDE9',
              background: '#FAFAF9',
            }}>
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action)}
                  style={{
                    background: '#F5F3F0',
                    border: '1px solid #E0DDD9',
                    borderRadius: '8px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontFamily: 'Inter',
                    color: '#6B6560',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = '#E0DDD9'
                    el.style.color = '#1C1917'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.background = '#F5F3F0'
                    el.style.color = '#6B6560'
                  }}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #E0DDD9',
            background: '#FFFFFF',
            borderRadius: '0 0 20px 20px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your society..."
              rows={1}
              style={{
                flex: 1,
                border: '1px solid #E0DDD9',
                borderRadius: '10px',
                padding: '9px 12px',
                fontFamily: 'Inter',
                fontSize: '13px',
                color: '#1C1917',
                background: '#F5F3F0',
                resize: 'none',
                outline: 'none',
                lineHeight: '1.5',
                maxHeight: '80px',
                overflowY: 'auto',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#D97706' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E0DDD9' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              style={{
                width: '36px', height: '36px',
                borderRadius: '10px',
                background: input.trim() && !isLoading ? '#1C1917' : '#E0DDD9',
                border: 'none',
                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={input.trim() && !isLoading ? '#FFFFFF' : '#9C9894'}
                strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ema-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes ema-slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
