import { useState, useRef, useEffect } from 'react'
import { transcribeAudio, LANGUAGES } from '../../lib/sarvam'
import { textToSpeech, playBase64Audio } from '../../lib/sarvamTTS'
import { Microphone, SoundHigh, SoundOff, SendDiagonal } from 'iconoir-react'

const WORKFLOW_URL = import.meta.env.VITE_WORKFLOW_URL || 'http://localhost:3001'
const SOCIETY_ID = import.meta.env.VITE_SOCIETY_ID || 'eafc59c7-4148-44ee-b66b-256a5338718b'

interface ActionTaken {
  tool: string
  result?: { content?: string }
}

interface Message {
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  tool_calls?: number
  actions_taken?: ActionTaken[]
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

const LANGUAGE_NAMES: Record<string, string> = {
  'en-IN': 'English',
  'hi-IN': 'Hindi',
  'kn-IN': 'Kannada',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'ml-IN': 'Malayalam',
  'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati',
  'bn-IN': 'Bengali',
  'pa-IN': 'Punjabi',
  'od-IN': 'Odia',
}

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

  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState('hi-IN')
  const [responseLanguage, setResponseLanguage] = useState('en-IN')
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        await processVoiceInput(blob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Mic error:', err)
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsProcessingVoice(true)
    }
  }

  const processVoiceInput = async (blob: Blob) => {
    try {
      // Step 1: Sarvam STT
      const result = await transcribeAudio(blob, voiceLanguage)
      const transcript = result
      if (!transcript || typeof transcript !== 'string' || transcript.trim() === '') {
        setIsProcessingVoice(false)
        return
      }

      // Add user message immediately
      setMessages(prev => [...prev, {
        role: 'user',
        content: transcript,
        timestamp: new Date()
      }])

      setIsLoading(true)
      setIsProcessingVoice(false)

      // Step 2: Send to Aria
      const res = await fetch(`${WORKFLOW_URL}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          society_id: SOCIETY_ID,
          conversation_history: conversationHistory,
          plan: 'free',
          response_language: LANGUAGE_NAMES[responseLanguage] || 'English'
        })
      })

      const data = await res.json()

      if (data.response) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: data.response,
          timestamp: new Date(),
          tool_calls: data.tool_calls_made,
          actions_taken: data.actions_taken || [],
        }])
        setConversationHistory(data.conversation_history || [])

        // Step 3: Sarvam TTS — speak response
        if (ttsEnabled) {
          await speakResponse(data.response)
        }
      }
    } catch (err) {
      console.error('Voice processing error:', err)
    } finally {
      setIsLoading(false)
      setIsProcessingVoice(false)
    }
  }

  const speakResponse = async (text: string) => {
    try {
      // Strip emojis and markdown for cleaner speech
      const cleanText = text
        .replace(/[🚨⚠️📋✅🔒🤖]/g, '')
        .replace(/\*\*/g, '')
        .replace(/→ Next action:/g, 'Next action:')
        .trim()
      
      const finalText = cleanText.slice(0, 480)
      const audioBase64 = await textToSpeech(finalText, responseLanguage, 'anushka')
      const audio = playBase64Audio(audioBase64)
      setCurrentAudio(audio)

      audio.onended = () => setCurrentAudio(null)
    } catch (err) {
      console.error('TTS error:', err)
    }
  }

  const stopSpeaking = () => {
    if (currentAudio) {
      currentAudio.pause()
      setCurrentAudio(null)
    }
  }

  const handleMicClick = () => {
    if (isRecording) {
      stopVoiceRecording()
    } else {
      startVoiceRecording()
    }
  }


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
        body: JSON.stringify({
          society_id: SOCIETY_ID,
          response_language: LANGUAGE_NAMES[responseLanguage] || 'English'
        }),
      })
      const data = await res.json()
      if (data.briefing) {
        setMessages([{
          role: 'agent',
          content: data.briefing,
          timestamp: new Date(),
        }])
        if (ttsEnabled && data.briefing) {
          await speakResponse(data.briefing)
        }
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
          plan: 'free',
          response_language: LANGUAGE_NAMES[responseLanguage] || 'English'
        }),
      })

      const data = await res.json()

      if (data.response) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: data.response,
          timestamp: new Date(),
          tool_calls: data.tool_calls_made,
          actions_taken: data.actions_taken || [],
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
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: '#1C1917',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
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

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {/* TTS toggle */}
              <button
                onClick={() => {
                  setTtsEnabled(!ttsEnabled);
                  if (ttsEnabled) stopSpeaking();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(215,218,220,0.7)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={ttsEnabled ? 'Voice responses ON' : 'Voice responses OFF'}
              >
                {ttsEnabled ? (
                  <SoundHigh width={16} height={16} strokeWidth={1.5} />
                ) : (
                  <SoundOff width={16} height={16} strokeWidth={1.5} />
                )}
              </button>
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
            borderRadius: '0 0 16px 16px'
          }}>
            {/* Language selector for voice */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '11px',
                  color: '#9C9894',
                  fontFamily: 'Inter'
                }}>
                  Voice language:
                </span>
                <select
                  value={voiceLanguage}
                  onChange={(e) => setVoiceLanguage(e.target.value)}
                  disabled={isRecording}
                  style={{
                    fontSize: '11px',
                    color: '#1C1917',
                    background: '#F5F3F0',
                    border: '1px solid #E0DDD9',
                    borderRadius: '6px',
                    padding: '3px 6px',
                    fontFamily: 'Inter',
                    cursor: 'pointer'
                  }}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: '4px'
              }}>
                <span style={{
                  fontSize: '11px',
                  color: '#9C9894',
                  fontFamily: 'Inter'
                }}>
                  Reply in:
                </span>
                <select
                  value={responseLanguage}
                  onChange={(e) => setResponseLanguage(e.target.value)}
                  style={{
                    fontSize: '11px',
                    color: '#1C1917',
                    background: '#F5F3F0',
                    border: '1px solid #E0DDD9',
                    borderRadius: '6px',
                    padding: '3px 6px',
                    fontFamily: 'Inter',
                    cursor: 'pointer'
                  }}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {currentAudio && (
                <button
                  onClick={stopSpeaking}
                  style={{
                    fontSize: '11px',
                    color: '#DC2626',
                    background: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'Inter',
                    marginLeft: 'auto'
                  }}
                >
                  ⏸ Stop speaking
                </button>
              )}
            </div>

            {/* Input row */}
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end'
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Listening..." : "Type or tap mic to speak..."}
                disabled={isRecording || isProcessingVoice}
                rows={1}
                style={{
                  flex: 1,
                  border: '1px solid #E0DDD9',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontFamily: 'Inter',
                  fontSize: '13px',
                  color: '#1C1917',
                  background: isRecording ? '#FEE2E2' : '#F5F3F0',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: '1.5',
                  maxHeight: '80px',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#D97706' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E0DDD9' }}
              />

              {/* Mic button */}
              <button
                onClick={handleMicClick}
                disabled={isProcessingVoice || isLoading}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: isRecording ? '#DC2626' : '#F5F3F0',
                  border: isRecording ? 'none' : '1px solid #E0DDD9',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                  animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                }}
              >
                <Microphone 
                  width={16} height={16} 
                  strokeWidth={1.5}
                  color={isRecording ? '#FFFFFF' : '#6B6560'} 
                />
              </button>

              {/* Send button */}
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading || isRecording}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: input.trim() && !isLoading ? '#1C1917' : '#E0DDD9',
                  border: 'none',
                  cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <SendDiagonal width={16} height={16}
                  strokeWidth={2}
                  color={input.trim() && !isLoading ? '#FFFFFF' : '#9C9894'} />
              </button>
            </div>
            
            {isProcessingVoice && (
              <p style={{
                fontSize: '11px',
                color: '#D97706',
                fontFamily: 'Inter',
                margin: '6px 0 0',
                textAlign: 'center'
              }}>
                Transcribing your voice...
              </p>
            )}
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
        @keyframes ema-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
        }
      `}</style>
    </>
  )
}
