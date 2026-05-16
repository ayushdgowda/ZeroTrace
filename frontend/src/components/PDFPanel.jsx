import { useState, useEffect } from 'react'

const BASE_URL = 'http://localhost:8000/api'

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('access_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  return fetch(`${BASE_URL}${url}`, { ...options, headers })
}

export default function PDFPanel({ onClose }) {
  const [pdfs, setPdfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(null)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    loadPDFs()
    loadFeedback()
  }, [])

  const loadPDFs = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/pdf/list/')
      if (res.ok) {
        const data = await res.json()
        setPdfs(data.pdfs || [])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const loadFeedback = async () => {
    try {
      const res = await authFetch('/feedback/')
      if (res.ok) {
        const data = await res.json()
        setFeedback(data.scores)
      }
    } catch (e) {}
  }

  const downloadPDF = async (filename) => {
    setDownloading(filename)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${BASE_URL}/pdf/download/${filename}/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (e) {
      alert('Download failed: ' + e.message)
    }
    setDownloading(null)
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  const scoreColor = (score) => {
    if (score >= 0.8) return '#4ade80'
    if (score >= 0.5) return '#fb923c'
    return '#f87171'
  }

  return (
    <div style={{ width: 300, borderLeft: '1px solid rgba(99,179,237,0.08)', display: 'flex', flexDirection: 'column', background: 'rgba(5,11,20,0.97)', flexShrink: 0 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
        .pdf-item { background: rgba(14,25,45,0.6); border: 1px solid rgba(99,179,237,0.1); border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; transition: all 0.2s; }
        .pdf-item:hover { border-color: rgba(99,179,237,0.25); }
        .dl-btn { background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; border-radius: 7px; padding: 6px 12px; font-size: 11px; font-weight: 600; color: #fff; cursor: pointer; font-family: 'Sora', sans-serif; transition: opacity 0.2s; white-space: nowrap; }
        .dl-btn:hover { opacity: 0.85; }
        .dl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(99,179,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>📄 Files & Feedback</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>

        {/* PDFs section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>
            Generated PDFs
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>
              <span className="spin">⟳</span> Loading...
            </div>
          ) : pdfs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>
              No PDFs yet. Try:<br />
              <span style={{ color: '#38bdf8', fontSize: 12, fontFamily: 'monospace' }}>"create a pdf about AI"</span>
            </div>
          ) : (
            pdfs.map(pdf => (
              <div key={pdf.filename} className="pdf-item">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📄 {pdf.filename}
                    </div>
                    <div style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>
                      {pdf.size_kb} KB · {formatDate(pdf.modified)}
                    </div>
                  </div>
                  <button
                    className="dl-btn"
                    onClick={() => downloadPDF(pdf.filename)}
                    disabled={downloading === pdf.filename}
                  >
                    {downloading === pdf.filename ? <span className="spin">⟳</span> : '⬇ Download'}
                  </button>
                </div>
              </div>
            ))
          )}

          <button onClick={loadPDFs} style={{ background: 'none', border: '1px solid rgba(99,179,237,0.15)', borderRadius: 8, padding: '6px 12px', color: '#475569', fontSize: 11, cursor: 'pointer', fontFamily: 'Sora, sans-serif', width: '100%', marginTop: 4 }}>
            ↻ Refresh
          </button>
        </div>

        {/* Adaptive Feedback scores */}
        {feedback && (
          <div>
            <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>
              🧠 Adaptive Feedback Scores
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 10, lineHeight: 1.5 }}>
              System learns from task outcomes and re-prioritizes automatically.
            </div>
            {Object.entries(feedback).map(([type, data]) => (
              data.total_attempts > 0 ? (
                <div key={type} style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(14,25,45,0.5)', borderRadius: 10, border: '1px solid rgba(99,179,237,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize', fontWeight: 600 }}>{type}</span>
                    <span style={{ fontSize: 12, color: scoreColor(data.priority_score), fontFamily: 'monospace', fontWeight: 700 }}>
                      {(data.priority_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(99,179,237,0.08)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${data.priority_score * 100}%`, background: scoreColor(data.priority_score), borderRadius: 99, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: '#334155' }}>
                      {data.success_count}✓ {data.failure_count}✗ · {data.total_attempts} runs
                    </span>
                    <span style={{ fontSize: 10, color: '#334155' }}>
                      {data.avg_execution_time > 0 ? `${(data.avg_execution_time / 1000).toFixed(1)}s avg` : ''}
                    </span>
                  </div>
                </div>
              ) : null
            ))}
            {Object.values(feedback).every(d => d.total_attempts === 0) && (
              <div style={{ textAlign: 'center', color: '#334155', fontSize: 12, padding: '10px 0' }}>
                Run some tasks to see feedback scores
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
