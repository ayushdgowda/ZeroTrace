import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyticsAPI, authAPI } from '../api'

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const user = authAPI.getUser()

  useEffect(() => {
    if (!authAPI.isLoggedIn()) { navigate('/login'); return }
    loadUsage()
  }, [])

  const loadUsage = async () => {
    const data = await analyticsAPI.getUsage()
    setUsage(data)
    setLoading(false)
  }

  const taskColors = {
    chat: '#38bdf8',
    email: '#4ade80',
    pdf: '#a78bfa',
    browser: '#fb923c',
    research: '#f472b6',
    'pdf+email': '#34d399',
  }

  const taskIcons = {
    chat: '💬',
    email: '📧',
    pdf: '📄',
    browser: '🌐',
    research: '🔍',
    'pdf+email': '📎',
  }

  const totalTasks = usage
    ? Object.values(usage.task_breakdown || {}).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div style={{ minHeight: '100vh', background: '#050b14', fontFamily: "'Sora', 'Segoe UI', sans-serif", color: '#e2e8f0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(99,179,237,0.15); border-radius: 99px; }
        .stat-card { background: rgba(14,25,45,0.8); border: 1px solid rgba(99,179,237,0.12); border-radius: 20px; padding: 28px; transition: all 0.25s; }
        .stat-card:hover { border-color: rgba(99,179,237,0.3); transform: translateY(-3px); box-shadow: 0 12px 40px rgba(14,165,233,0.08); }
        .task-bar { height: 10px; border-radius: 99px; transition: width 1s ease; }
        .back-btn { background: none; border: 1px solid rgba(99,179,237,0.2); border-radius: 10px; color: #64748b; padding: 8px 16px; font-size: 13px; cursor: pointer; font-family: 'Sora', sans-serif; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .back-btn:hover { border-color: rgba(99,179,237,0.4); color: #94a3b8; }
        .chat-btn { background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; border-radius: 10px; color: #fff; padding: 10px 22px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; transition: all 0.2s; box-shadow: 0 0 20px rgba(14,165,233,0.3); }
        .chat-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        .delay-1 { animation-delay: 0.1s; opacity: 0; }
        .delay-2 { animation-delay: 0.2s; opacity: 0; }
        .delay-3 { animation-delay: 0.3s; opacity: 0; }
        .delay-4 { animation-delay: 0.4s; opacity: 0; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '20px 40px', borderBottom: '1px solid rgba(99,179,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5,11,20,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="back-btn" onClick={() => navigate('/chat')}>
            ← Back to Chat
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>Z</div>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>ZeroTrace</span>
            <span style={{ color: '#334155', fontSize: 14 }}>/</span>
            <span style={{ color: '#64748b', fontSize: 14 }}>Analytics</span>
          </div>
        </div>
        <button className="chat-btn" onClick={() => navigate('/chat')}>
          Go to Chat →
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px' }}>

        {/* Page title */}
        <div className="fade-up" style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', color: '#f0f9ff', marginBottom: 8 }}>
            Usage Analytics
          </h1>
          <p style={{ color: '#475569', fontSize: 15 }}>
            Hello {user?.first_name || user?.username} · Here's everything ZeroTrace has done for you
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: '#334155' }}>Loading your analytics...</div>
        ) : usage ? (
          <>
            {/* Top stats */}
            <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Total Tokens', value: usage.total_tokens?.toLocaleString() || '0', icon: '⚡', color: '#38bdf8', sub: 'processed locally' },
                { label: 'Conversations', value: usage.total_conversations || '0', icon: '💬', color: '#a78bfa', sub: 'chat sessions' },
                { label: 'Messages', value: usage.total_messages || '0', icon: '📨', color: '#4ade80', sub: 'total exchanges' },
                { label: 'Tasks Run', value: totalTasks, icon: '🤖', color: '#fb923c', sub: 'automations executed' },
              ].map(({ label, value, icon, color, sub }) => (
                <div key={label} className="stat-card">
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginTop: 6 }}>{label}</div>
                  <div style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Cost savings */}
            <div className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
              {/* Cost saved card */}
              <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.06) 0%, rgba(99,102,241,0.06) 100%)', border: '1px solid rgba(14,165,233,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>💰 Cost Savings</span>
                  <span style={{ fontSize: 11, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>vs GPT-4</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 48, fontWeight: 800, color: '#4ade80', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                      {usage.cost_saved_vs_gpt4 || '₹0'}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>saved by running locally</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: '#334155' }}>You paid</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace" }}>{usage.api_cost || '₹0.00'}</div>
                  </div>
                </div>
                <div style={{ marginTop: 20, padding: '10px 14px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: '#4ade80' }}>🔒 All processing done locally · Zero API costs · 100% private</div>
                </div>
              </div>

              {/* Model info */}
              <div className="stat-card">
                <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 20 }}>🤖 Model Information</div>
                {[
                  { label: 'Active Model', value: usage.model || 'llama3.2:latest' },
                  { label: 'Provider', value: 'Ollama (Local)' },
                  { label: 'API Cost', value: '₹0.00 / token' },
                  { label: 'Privacy', value: '100% Local' },
                  { label: 'Data sent to cloud', value: 'None' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(99,179,237,0.05)' }}>
                    <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
                    <span style={{ fontSize: 13, color: value === 'None' || value === '₹0.00 / token' ? '#4ade80' : '#94a3b8', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Task breakdown */}
            <div className="fade-up delay-3" className="stat-card" style={{ marginBottom: 32, background: 'rgba(14,25,45,0.8)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 20, padding: 28 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 24 }}>⚡ Task Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(usage.task_breakdown || {}).map(([type, count]) => {
                  const percent = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
                  const color = taskColors[type] || '#64748b'
                  const icon = taskIcons[type] || '🔧'
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>{icon}</span>
                          <span style={{ fontSize: 14, color: '#94a3b8', textTransform: 'capitalize', fontWeight: 500 }}>{type}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#475569' }}>{percent}%</span>
                          <span style={{ fontSize: 13, color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{count} tasks</span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: 'rgba(99,179,237,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                        <div className="task-bar" style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                      </div>
                    </div>
                  )
                })}
                {totalTasks === 0 && (
                  <div style={{ textAlign: 'center', color: '#334155', padding: '20px 0', fontSize: 14 }}>
                    No tasks run yet. Go to chat and try automating something!
                  </div>
                )}
              </div>
            </div>

            {/* Token usage visual */}
            <div className="fade-up delay-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="stat-card">
                <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 20 }}>📊 Token Usage</div>
                <div style={{ fontSize: 48, fontWeight: 800, color: '#38bdf8', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                  {usage.total_tokens?.toLocaleString() || '0'}
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>total tokens processed</div>
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#334155', marginBottom: 6 }}>
                    <span>Usage</span>
                    <span>{usage.total_tokens?.toLocaleString() || 0} tokens</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(56,189,248,0.08)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${Math.min((usage.total_tokens / 100000) * 100, 100)}%`, background: 'linear-gradient(90deg, #38bdf8, #6366f1)', borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>of 100K token milestone</div>
                </div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 20 }}>🏆 Achievements</div>
                {[
                  { icon: '🚀', label: 'First Chat', done: usage.total_messages > 0 },
                  { icon: '📧', label: 'Email Sent', done: (usage.task_breakdown?.email || 0) > 0 },
                  { icon: '📄', label: 'PDF Created', done: (usage.task_breakdown?.pdf || 0) > 0 },
                  { icon: '🌐', label: 'Browser Automated', done: (usage.task_breakdown?.browser || 0) > 0 },
                  { icon: '💰', label: 'Saved ₹1+', done: usage.cost_saved_inr > 1 },
                ].map(({ icon, label, done }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(99,179,237,0.05)' }}>
                    <span style={{ fontSize: 18, opacity: done ? 1 : 0.3 }}>{icon}</span>
                    <span style={{ fontSize: 13, color: done ? '#94a3b8' : '#334155', flex: 1 }}>{label}</span>
                    {done
                      ? <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>✓ Done</span>
                      : <span style={{ fontSize: 11, color: '#334155' }}>Locked</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 80, color: '#334155' }}>Could not load analytics. Make sure Django is running.</div>
        )}
      </div>
    </div>
  )
}
