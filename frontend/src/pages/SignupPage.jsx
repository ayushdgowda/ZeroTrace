import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); navigate('/chat') }, 1200)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050b14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Sora', 'Segoe UI', sans-serif", padding: 24 }}>
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

      <div style={{ width: '100%', maxWidth: 440, background: 'rgba(9,18,34,0.9)', border: '1px solid rgba(99,179,237,0.15)', borderRadius: 24, padding: '48px 44px', backdropFilter: 'blur(20px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 auto 16px' }}>Z</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1px', color: '#f0f9ff', marginBottom: 6 }}>Create your account</h1>
          <p style={{ color: '#475569', fontSize: 14 }}>Start using AI — no cloud, no cost</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 7 }}>Full Name</label>
            <input className="input-field" placeholder="Ayush Gowda" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 7 }}>Email</label>
            <input className="input-field" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 7 }}>Password</label>
            <input className="input-field" type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button className="submit-btn" type="submit" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#334155' }}>
          Already have an account?{' '}
          <span style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/login')}>Sign in</span>
        </p>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>
          <span style={{ color: '#1e293b', cursor: 'pointer' }} onClick={() => navigate('/')}>← Back to home</span>
        </p>
      </div>
    </div>
  )
}
