import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { conversationsAPI, analyticsAPI, statusAPI, authAPI } from '../api'

const WELCOME_SUGGESTIONS = [
  { icon: '🔍', text: 'Research top 5 AI startups in India and send report to gowdaayushd@gmail.com' },
  { icon: '📧', text: 'send this to gowdaayushd@gmail.com: Hello from ZeroTrace AI!' },
  { icon: '🌐', text: 'search google for Python jobs in Bangalore' },
  { icon: '📄', text: 'create a pdf about machine learning fundamentals' },
]

let msgId = 0

export default function ChatPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [showTasks, setShowTasks] = useState(false)
  const [usage, setUsage] = useState(null)
  const [ollamaStatus, setOllamaStatus] = useState('checking')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [listening, setListening] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const user = authAPI.getUser()

  useEffect(() => {
    if (!authAPI.isLoggedIn()) { navigate('/login'); return }
    loadConversations()
    loadUsage()
    checkStatus()
    setupVoice()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const setupVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('')

      setInput(transcript)

      // Auto send if final result
      if (event.results[event.results.length - 1].isFinal) {
        setTimeout(() => {
          if (transcript.trim()) {
            sendMessage(transcript.trim())
          }
        }, 500)
      }
    }

    recognitionRef.current = recognition
  }

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in your browser. Please use Chrome.')
      return
    }
    if (listening) {
      recognitionRef.current.stop()
    } else {
      setInput('')
      recognitionRef.current.start()
    }
  }

  const checkStatus = async () => {
    const s = await statusAPI.check()
    setOllamaStatus(s.status)
  }

  const loadConversations = async () => {
    const data = await conversationsAPI.list()
    setConversations(data)
  }

  const loadUsage = async () => {
    const data = await analyticsAPI.getUsage()
    setUsage(data)
  }

  const loadConversation = async (id) => {
    setActiveConvId(id)
    const history = await conversationsAPI.getHistory(id)
    setMessages(history.map(m => ({
      id: ++msgId,
      role: m.role,
      content: m.content,
      tokens: m.tokens_used
    })))
  }

  const newChat = () => {
    setMessages([])
    setActiveConvId(null)
    inputRef.current?.focus()
  }

  const sendMessage = async (text) => {
    const content = text || input.trim()
    if (!content || loading) return
    setInput('')
    setLoading(true)

    setMessages(m => [...m, { id: ++msgId, role: 'user', content }])

    try {
      const res = await fetch('http://localhost:8000/api/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          message: content,
          conversation_id: activeConvId,
          stream: false
        })
      })

      const data = await res.json()

      if (res.ok) {
        setMessages(m => [...m, {
          id: ++msgId,
          role: 'assistant',
          content: data.message,
          tokens: data.tokens
        }])
        if (data.conversation_id) setActiveConvId(data.conversation_id)
        loadConversations()
        loadUsage()
      } else {
        setMessages(m => [...m, {
          id: ++msgId,
          role: 'assistant',
          content: `❌ Error: ${data.error || 'Something went wrong'}`
        }])
      }
    } catch (err) {
      setMessages(m => [...m, {
        id: ++msgId,
        role: 'assistant',
        content: `❌ Could not connect to backend.\n\nError: ${err.message}`
      }])
    }

    setLoading(false)
  }

  const groupByDate = (convs) => {
    const now = new Date()
    const groups = { 'Today': [], 'Yesterday': [], 'Last 7 days': [], 'Older': [] }
    convs.forEach(c => {
      const d = new Date(c.updated_at)
      const diff = (now - d) / (1000 * 60 * 60 * 24)
      if (diff < 1) groups['Today'].push(c)
      else if (diff < 2) groups['Yesterday'].push(c)
      else if (diff < 7) groups['Last 7 days'].push(c)
      else groups['Older'].push(c)
    })
    return groups
  }

  const grouped = groupByDate(conversations)

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#050b14', fontFamily: "'Sora', 'Segoe UI', sans-serif", color: '#e2e8f0', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,179,237,0.15); border-radius: 99px; }
        .history-item { padding: 8px 12px; border-radius: 10px; cursor: pointer; font-size: 13px; color: #64748b; transition: all 0.15s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        .history-item:hover { background: rgba(99,179,237,0.07); color: #94a3b8; }
        .history-item.active { background: rgba(99,179,237,0.1); color: #e2e8f0; }
        .suggestion-btn { background: rgba(14,25,45,0.7); border: 1px solid rgba(99,179,237,0.15); border-radius: 14px; padding: 14px 18px; cursor: pointer; display: flex; align-items: flex-start; gap: 12px; text-align: left; transition: all 0.2s; color: #64748b; font-size: 14px; font-family: 'Sora', sans-serif; width: 100%; }
        .suggestion-btn:hover { border-color: rgba(99,179,237,0.35); background: rgba(14,165,233,0.06); color: #94a3b8; }
        .send-btn { background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; border-radius: 10px; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.2s, transform 0.2s; box-shadow: 0 0 16px rgba(14,165,233,0.3); }
        .send-btn:hover { opacity: 0.9; transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
        .mic-btn { border: none; border-radius: 10px; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
        .mic-btn.idle { background: rgba(99,179,237,0.08); border: 1px solid rgba(99,179,237,0.15); }
        .mic-btn.idle:hover { background: rgba(99,179,237,0.15); }
        .mic-btn.active { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); box-shadow: 0 0 16px rgba(239,68,68,0.3); }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        .mic-btn.active { animation: pulse 1s ease-in-out infinite; }
        .chat-input { flex: 1; background: transparent; border: none; outline: none; font-size: 15px; color: #e2e8f0; font-family: 'Sora', sans-serif; resize: none; max-height: 120px; line-height: 1.6; }
        .chat-input::placeholder { color: #334155; }
        .dot-anim span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; margin: 0 2px; animation: bounce 1.2s ease-in-out infinite; }
        .dot-anim span:nth-child(2) { animation-delay: 0.2s; }
        .dot-anim span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)} }
        .msg-user { background: rgba(14,165,233,0.1); border: 1px solid rgba(14,165,233,0.15); border-radius: 18px 18px 4px 18px; padding: 12px 18px; max-width: 75%; align-self: flex-end; font-size: 15px; line-height: 1.65; }
        .msg-assistant { font-size: 15px; line-height: 1.8; max-width: 82%; color: #cbd5e1; }
        .icon-btn { background: none; border: none; color: #475569; cursor: pointer; padding: 7px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .icon-btn:hover { background: rgba(99,179,237,0.07); color: #94a3b8; }
        .new-chat-btn { background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.2); border-radius: 10px; padding: 10px 14px; color: #38bdf8; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; display: flex; align-items: center; gap: 8px; transition: all 0.2s; width: 100%; }
        .new-chat-btn:hover { background: rgba(14,165,233,0.14); }
        .msg-assistant h1, .msg-assistant h2, .msg-assistant h3 { color: #f0f9ff; margin: 14px 0 6px; font-weight: 700; }
        .msg-assistant h1 { font-size: 20px; }
        .msg-assistant h2 { font-size: 17px; }
        .msg-assistant h3 { font-size: 15px; }
        .msg-assistant p { margin-bottom: 8px; color: #cbd5e1; }
        .msg-assistant ul, .msg-assistant ol { padding-left: 22px; margin-bottom: 10px; }
        .msg-assistant li { margin-bottom: 5px; color: #cbd5e1; }
        .msg-assistant code { background: rgba(14,165,233,0.1); border: 1px solid rgba(14,165,233,0.2); border-radius: 4px; padding: 2px 7px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #38bdf8; }
        .msg-assistant pre { background: rgba(9,18,34,0.9); border: 1px solid rgba(99,179,237,0.15); border-radius: 10px; padding: 16px; overflow-x: auto; margin: 10px 0; }
        .msg-assistant pre code { background: none; border: none; padding: 0; color: #7dd3fc; font-size: 13px; }
        .msg-assistant strong { color: #f0f9ff; font-weight: 600; }
        .msg-assistant a { color: #38bdf8; text-decoration: underline; }
        .msg-assistant blockquote { border-left: 3px solid rgba(14,165,233,0.4); padding-left: 14px; color: #64748b; margin: 10px 0; }
        .msg-assistant hr { border: none; border-top: 1px solid rgba(99,179,237,0.1); margin: 16px 0; }
        .msg-assistant table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
        .msg-assistant th { background: rgba(14,165,233,0.1); color: #38bdf8; padding: 8px 12px; border: 1px solid rgba(99,179,237,0.15); }
        .msg-assistant td { padding: 7px 12px; border: 1px solid rgba(99,179,237,0.08); color: #94a3b8; }
      `}</style>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{ width: 260, borderRight: '1px solid rgba(99,179,237,0.08)', display: 'flex', flexDirection: 'column', padding: '16px 12px', overflowY: 'auto', background: 'rgba(5,11,20,0.97)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>Z</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>ZeroTrace</span>
          </div>

          <button className="new-chat-btn" onClick={newChat} style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New Chat
          </button>

          {Object.entries(grouped).map(([date, items]) =>
            items.length > 0 ? (
              <div key={date} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '0 12px', marginBottom: 6 }}>{date}</div>
                {items.map(c => (
                  <span key={c.id} className={`history-item ${activeConvId === c.id ? 'active' : ''}`} onClick={() => loadConversation(c.id)}>
                    {c.title || 'New conversation'}
                  </span>
                ))}
              </div>
            ) : null
          )}

          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(99,179,237,0.08)', paddingTop: 14 }}>
            <div style={{ padding: '10px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                  {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{user?.first_name || user?.username || 'User'}</div>
                  <div style={{ fontSize: 11, color: '#334155' }}>Local · Offline</div>
                </div>
              </div>
              <button className="icon-btn" onClick={authAPI.logout} title="Logout">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(99,179,237,0.06)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, background: 'rgba(5,11,20,0.8)', backdropFilter: 'blur(10px)' }}>
          <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ollamaStatus === 'online' ? '#4ade80' : '#f87171', boxShadow: ollamaStatus === 'online' ? '0 0 6px #4ade80' : '0 0 6px #f87171' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
              {ollamaStatus === 'online' ? 'llama3.2 · local · ready' : 'ollama offline — run: ollama serve'}
            </span>
          </div>
          {listening && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '4px 12px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>Listening...</span>
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setShowTasks(!showTasks)} style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 8, padding: '7px 14px', color: '#38bdf8', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>
              📊 Stats
            </button>
            <button onClick={() => navigate('/analytics')} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '7px 14px', color: '#a78bfa', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>
              📈 Analytics
            </button>
            <button onClick={() => navigate('/settings')} style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 8, padding: '7px 14px', color: '#38bdf8', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>
              ⚙️ Settings
            </button>
            <button onClick={() => navigate('/benchmarks')} style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '7px 14px', color: '#4ade80', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>
  📊 Benchmarks
</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 auto 24px' }}>Z</div>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: '#f0f9ff', letterSpacing: '-1px', marginBottom: 10 }}>
                  Hello{user?.first_name ? `, ${user.first_name}` : ''}! What can I do for you?
                </h2>
                <p style={{ color: '#475569', fontSize: 15, marginBottom: 8 }}>
                  Powered by Llama 3 · Running 100% on your machine · No data leaves
                </p>
                <p style={{ color: '#334155', fontSize: 13, marginBottom: 40 }}>
                  🎤 Click the mic button to speak your command
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {WELCOME_SUGGESTIONS.map(s => (
                    <button key={s.text} className="suggestion-btn" onClick={() => sendMessage(s.text)}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                      <span>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>Z</div>
                        <span style={{ fontSize: 12, color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>
                          ZeroTrace · llama3.2{msg.tokens ? ` · ${msg.tokens} tokens` : ''}
                        </span>
                      </div>
                    )}
                    <div className={msg.role === 'user' ? 'msg-user' : 'msg-assistant'}>
                      {msg.role === 'user'
                        ? msg.content
                        : <ReactMarkdown>{msg.content}</ReactMarkdown>
                      }
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>Z</div>
                    <div className="dot-anim"><span /><span /><span /></div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ padding: '14px 28px 22px', flexShrink: 0 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ background: 'rgba(14,25,45,0.85)', border: `1px solid ${listening ? 'rgba(239,68,68,0.4)' : 'rgba(99,179,237,0.18)'}`, borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'flex-end', gap: 10, backdropFilter: 'blur(12px)', transition: 'border-color 0.2s' }}>
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder={listening ? '🎤 Listening... speak now' : 'Ask anything, or describe a task to automate...'}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
              />

              {/* Mic button */}
              <button
                className={`mic-btn ${listening ? 'active' : 'idle'}`}
                onClick={toggleVoice}
                title={listening ? 'Stop listening' : 'Start voice input'}
              >
                {listening ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#f87171"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                )}
              </button>

              {/* Send button */}
              <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#1e293b', marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
              Ollama llama3.2 · Local · Press Shift+Enter for new line · 🎤 Click mic to speak
            </p>
          </div>
        </div>
      </div>

      {/* USAGE PANEL */}
      {showTasks && (
        <div style={{ width: 280, borderLeft: '1px solid rgba(99,179,237,0.08)', padding: '20px 16px', overflowY: 'auto', background: 'rgba(5,11,20,0.97)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>📊 Usage Stats</span>
            <button onClick={() => setShowTasks(false)} style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
          {usage ? (
            <>
              {[
                { label: 'Total tokens used', value: usage.total_tokens?.toLocaleString() || '0', color: '#64748b' },
                { label: 'Conversations', value: String(usage.total_conversations || 0), color: '#64748b' },
                { label: 'Messages', value: String(usage.total_messages || 0), color: '#64748b' },
                { label: 'API cost (you paid)', value: usage.api_cost || '₹0.00', color: '#4ade80' },
                { label: 'Saved vs GPT-4', value: usage.cost_saved_vs_gpt4 || '₹0', color: '#38bdf8' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(99,179,237,0.05)' }}>
                  <span style={{ fontSize: 12, color: '#334155' }}>{label}</span>
                  <span style={{ fontSize: 13, color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{value}</span>
                </div>
              ))}
              <div style={{ marginTop: 20, padding: '14px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: '#334155', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Task Breakdown</div>
                {Object.entries(usage.task_breakdown || {}).map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ fontSize: 12, color: '#475569', textTransform: 'capitalize' }}>{type}</span>
                    <span style={{ fontSize: 12, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '12px', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.12)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>🔒 100% LOCAL</div>
                <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Zero data sent to any server</div>
              </div>
            </>
          ) : (
            <p style={{ color: '#334155', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Loading stats...</p>
          )}
        </div>
      )}
    </div>
  )
}