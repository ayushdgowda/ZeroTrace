import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await authAPI.login({ email, password })
    setLoading(false)
    if (result.success) {
      navigate('/chat')
    } else {
      setError(result.error || 'Login failed. Check your credentials.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050b14', display: 'flex', fontFamily: "'Sora', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .input-field { width: 100%; background: rgba(14,25,45,0.7); border: 1px solid rgba(99,179,237,0.2); border-radius: 12px; padding: 14px 18px; font-size: 15px; color: #e2e8f0; font-family: 'Sora', sans-serif; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .input-field:focus { border-color: rgba(99,179,237,0.6); box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }
        .input-field::placeholder { color: #334155; }
        .submit-btn { width: 100%; background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: 600; color: #fff; cursor: pointer; font-family: 'Sora', sans-serif; transition: opacity 0.2s, transform 0.2s; box-shadow: 0 0 28px rgba(14,165,233,0.3); }
        .submit-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
      `}</style>

      {/* Left panel */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(14,165,233,0.06) 0%, rgba(99,102,241,0.06) 100%)', borderRight: '1px solid rgba(99,179,237,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '-15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>Z</div>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#e2e8f0' }}>ZeroTrace</span>
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1.5px', color: '#f0f9ff', lineHeight: 1.15, marginBottom: 20 }}>Your AI.<br />Your machine.<br />Your rules.</h2>
          <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.7, maxWidth: 340 }}>All AI inference runs locally on your device. No data is sent to any server. Ever.</p>
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['100% offline after setup', 'Llama 3.2 via Ollama', 'No API keys needed'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#4ade80' }}>✓</div>
                <span style={{ fontSize: 14, color: '#64748b' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 480, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color: '#f0f9ff', marginBottom: 8 }}>Welcome back</h1>
        <p style={{ color: '#475569', fontSize: 14, marginBottom: 36 }}>Sign in to your local AI workspace</p>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#f87171', fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 8 }}>Email</label>
            <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 8 }}>Password</label>
            <input className="input-field" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="submit-btn" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <span style={{ fontSize: 14, color: '#475569' }}>Don't have an account? </span>
          <span style={{ fontSize: 14, color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/signup')}>Sign up free</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: '#1e293b', cursor: 'pointer' }} onClick={() => navigate('/')}>← Back to home</span>
        </div>
      </div>
    </div>
  )
}
