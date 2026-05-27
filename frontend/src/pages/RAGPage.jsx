import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { authAPI } from '../api'

const BASE_URL = 'http://localhost:8000/api'

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('access_token')
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  return fetch(`${BASE_URL}${url}`, { ...options, headers })
}

export default function RAGPage() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  let msgId = 0

  useEffect(() => {
    if (!authAPI.isLoggedIn()) { navigate('/login'); return }
    loadDocuments()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadDocuments = async () => {
    try {
      const res = await authFetch('/rag/documents/')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch (e) {}
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.pdf')) {
      alert('Only PDF files are supported')
      return
    }

    setUploading(true)
    setUploadProgress('Reading PDF...')

    const formData = new FormData()
    formData.append('file', file)

    try {
      setUploadProgress('Extracting text from PDF...')
      const res = await authFetch('/rag/upload/', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setUploadProgress(data.message || 'Indexed successfully!')
        await loadDocuments()
        setTimeout(() => setUploadProgress(''), 3000)
      } else {
        setUploadProgress(`Error: ${data.error}`)
      }
    } catch (e) {
      setUploadProgress(`Error: ${e.message}`)
    }
    setUploading(false)
  }

  const askQuestion = async () => {
    const question = input.trim()
    if (!question || loading) return
    setInput('')
    setLoading(true)

    setMessages(m => [...m, { id: ++msgId, role: 'user', content: question }])

    try {
      const res = await authFetch('/rag/query/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          filename: selectedDoc,
        }),
      })
      const data = await res.json()

      const sourcesText = data.sources?.length > 0
        ? `\n\n---\n📄 **Sources:** ${[...new Set(data.sources.map(s => `${s.source} (page ${s.page})`))].join(', ')}`
        : ''

      setMessages(m => [...m, {
        id: ++msgId,
        role: 'assistant',
        content: data.answer + sourcesText,
        chunks: data.chunks_used,
      }])
    } catch (e) {
      setMessages(m => [...m, {
        id: ++msgId,
        role: 'assistant',
        content: `❌ Error: ${e.message}`,
      }])
    }
    setLoading(false)
  }

  const deleteDoc = async (filename) => {
    if (!confirm(`Delete "${filename}" from index?`)) return
    await authFetch('/rag/documents/', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    })
    if (selectedDoc === filename) setSelectedDoc(null)
    await loadDocuments()
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#050b14', fontFamily: "'Sora', 'Segoe UI', sans-serif", color: '#e2e8f0', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(99,179,237,0.15); border-radius: 99px; }
        .doc-item { padding: 10px 12px; border-radius: 10px; cursor: pointer; border: 1px solid rgba(99,179,237,0.1); background: rgba(14,25,45,0.6); margin-bottom: 8px; transition: all 0.15s; }
        .doc-item:hover { border-color: rgba(99,179,237,0.3); }
        .doc-item.active { border-color: rgba(14,165,233,0.5); background: rgba(14,165,233,0.08); }
        .upload-btn { background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; font-family: 'Sora', sans-serif; width: 100%; transition: opacity 0.2s; }
        .upload-btn:hover { opacity: 0.9; }
        .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .send-btn { background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; border-radius: 10px; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .chat-input { flex: 1; background: transparent; border: none; outline: none; font-size: 15px; color: #e2e8f0; font-family: 'Sora', sans-serif; resize: none; }
        .chat-input::placeholder { color: #334155; }
        .msg-user { background: rgba(14,165,233,0.1); border: 1px solid rgba(14,165,233,0.15); border-radius: 18px 18px 4px 18px; padding: 12px 18px; max-width: 75%; align-self: flex-end; font-size: 15px; line-height: 1.65; }
        .msg-assistant { font-size: 15px; line-height: 1.8; max-width: 82%; color: #cbd5e1; }
        .msg-assistant p { margin-bottom: 8px; }
        .msg-assistant strong { color: #f0f9ff; }
        .msg-assistant h1,.msg-assistant h2,.msg-assistant h3 { color: #f0f9ff; margin: 10px 0 6px; }
        .msg-assistant ul,.msg-assistant ol { padding-left: 20px; margin-bottom: 8px; }
        .msg-assistant code { background: rgba(14,165,233,0.1); border-radius: 4px; padding: 2px 6px; font-family: monospace; color: #38bdf8; }
        .back-btn { background: none; border: 1px solid rgba(99,179,237,0.2); border-radius: 8px; color: #64748b; padding: 7px 14px; font-size: 13px; cursor: pointer; font-family: 'Sora', sans-serif; }
        .back-btn:hover { border-color: rgba(99,179,237,0.4); color: #94a3b8; }
        .dot-anim span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; margin: 0 2px; animation: bounce 1.2s ease-in-out infinite; }
        .dot-anim span:nth-child(2) { animation-delay: 0.2s; }
        .dot-anim span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>

      {/* LEFT SIDEBAR - Documents */}
      <div style={{ width: 280, borderRight: '1px solid rgba(99,179,237,0.08)', display: 'flex', flexDirection: 'column', padding: '16px 14px', background: 'rgba(5,11,20,0.97)', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>RAG Mode</span>
        </div>

        {/* Upload button */}
        <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleUpload} />
        <button className="upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ marginBottom: 12 }}>
          {uploading ? <><span className="spin">⟳</span> Indexing...</> : '📄 Upload PDF'}
        </button>

        {uploadProgress && (
          <div style={{ padding: '8px 12px', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 8, fontSize: 12, color: '#38bdf8', marginBottom: 12, lineHeight: 1.5 }}>
            {uploadProgress}
          </div>
        )}

        {/* Document list */}
        <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>
          Indexed Documents ({documents.length})
        </div>

        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#334155', fontSize: 13, lineHeight: 1.6 }}>
            No PDFs indexed yet.<br />Upload a PDF to start chatting with it.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* All documents option */}
            <div className={`doc-item ${!selectedDoc ? 'active' : ''}`} onClick={() => setSelectedDoc(null)}>
              <div style={{ fontSize: 13, color: !selectedDoc ? '#38bdf8' : '#94a3b8', fontWeight: 600 }}>📚 All Documents</div>
              <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>Search across all indexed PDFs</div>
            </div>

            {documents.map(doc => (
              <div key={doc.filename} className={`doc-item ${selectedDoc === doc.filename ? 'active' : ''}`} onClick={() => setSelectedDoc(doc.filename)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: selectedDoc === doc.filename ? '#38bdf8' : '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📄 {doc.filename}
                    </div>
                    <div style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>
                      {doc.pages} pages · {doc.chunks} chunks
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDoc(doc.filename) }}
                    style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 14, padding: '0 0 0 8px', flexShrink: 0 }}
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back button */}
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(99,179,237,0.08)' }}>
          <button className="back-btn" onClick={() => navigate('/chat')} style={{ width: '100%' }}>
            ← Back to Chat
          </button>
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(99,179,237,0.06)', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(5,11,20,0.8)', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
              RAG Mode · {selectedDoc ? `📄 ${selectedDoc}` : '📚 All Documents'} · Local embeddings
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setMessages([])} style={{ background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 8, padding: '6px 12px', color: '#475569', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
              Clear chat
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 28px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>📄</div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#f0f9ff', letterSpacing: '-1px', marginBottom: 10 }}>
                  Chat with your PDFs
                </h2>
                <p style={{ color: '#475569', fontSize: 15, marginBottom: 8 }}>
                  Upload a PDF and ask questions about it
                </p>
                <p style={{ color: '#334155', fontSize: 13, marginBottom: 40 }}>
                  100% local · Uses sentence-transformers + ChromaDB · No cloud
                </p>

                {documents.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 500, margin: '0 auto' }}>
                    {[
                      'What are the main findings?',
                      'Summarize this document',
                      'What methodology was used?',
                      'List the key conclusions',
                    ].map(q => (
                      <button key={q} onClick={() => { setInput(q) }} style={{ background: 'rgba(14,25,45,0.7)', border: '1px solid rgba(99,179,237,0.15)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', color: '#64748b', fontSize: 13, fontFamily: 'Sora, sans-serif', textAlign: 'left', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,179,237,0.35)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(99,179,237,0.15)'}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {documents.length === 0 && (
                  <button className="upload-btn" style={{ maxWidth: 220, margin: '0 auto' }} onClick={() => fileInputRef.current?.click()}>
                    📄 Upload your first PDF
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>Z</div>
                        <span style={{ fontSize: 12, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>
                          ZeroTrace RAG{msg.chunks ? ` · ${msg.chunks} chunks retrieved` : ''}
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
            {documents.length === 0 && (
              <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 13, color: '#334155' }}>
                ⬆ Upload a PDF first to start asking questions
              </div>
            )}
            <div style={{ background: 'rgba(14,25,45,0.85)', border: '1px solid rgba(99,179,237,0.18)', borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'flex-end', gap: 12, backdropFilter: 'blur(12px)', opacity: documents.length === 0 ? 0.5 : 1 }}>
              <textarea
                className="chat-input"
                placeholder={documents.length === 0 ? 'Upload a PDF first...' : `Ask anything about ${selectedDoc || 'your documents'}...`}
                rows={1}
                value={input}
                disabled={documents.length === 0}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion() } }}
              />
              <button className="send-btn" onClick={askQuestion} disabled={!input.trim() || loading || documents.length === 0}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#1e293b', marginTop: 10, fontFamily: 'JetBrains Mono, monospace' }}>
              RAG · Local embeddings (all-MiniLM-L6-v2) · ChromaDB · Answers from your documents only
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
