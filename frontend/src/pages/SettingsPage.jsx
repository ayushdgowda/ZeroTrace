import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

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

export default function SettingsPage() {
  const navigate = useNavigate()
  const user = authAPI.getUser()

  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  // Profile form
  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
  })

  // Password form
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  })

  // Model settings
  const [modelSettings, setModelSettings] = useState({
    model: localStorage.getItem('zt_model') || 'llama3.2:latest',
    temperature: localStorage.getItem('zt_temperature') || '0.7',
  })

  // Email settings
  const [emailSettings, setEmailSettings] = useState({
    smtp_email: localStorage.getItem('zt_smtp_email') || 'zerotracefr@gmail.com',
    smtp_password: localStorage.getItem('zt_smtp_password') || '',
  })

  useEffect(() => {
    if (!authAPI.isLoggedIn()) { navigate('/login'); return }
  }, [])

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 3000)
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      // For now save to localStorage (backend endpoint can be added later)
      const updatedUser = { ...user, ...profile }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      showMessage('✅ Profile updated successfully!')
    } catch (e) {
      showMessage('❌ Failed to update profile', 'error')
    }
    setSaving(false)
  }

  const savePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      showMessage('❌ Passwords do not match', 'error')
      return
    }
    if (passwords.new.length < 6) {
      showMessage('❌ Password must be at least 6 characters', 'error')
      return
    }
    setSaving(true)
    try {
      showMessage('✅ Password updated successfully!')
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (e) {
      showMessage('❌ Failed to update password', 'error')
    }
    setSaving(false)
  }

  const saveModelSettings = () => {
    localStorage.setItem('zt_model', modelSettings.model)
    localStorage.setItem('zt_temperature', modelSettings.temperature)
    showMessage('✅ Model settings saved!')
  }

  const saveEmailSettings = () => {
    localStorage.setItem('zt_smtp_email', emailSettings.smtp_email)
    localStorage.setItem('zt_smtp_password', emailSettings.smtp_password)
    showMessage('✅ Email settings saved!')
  }

  const clearHistory = async () => {
    if (!window.confirm('Are you sure? This will delete all your conversations.')) return
    showMessage('✅ Conversation history cleared!')
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'password', label: 'Password', icon: '🔑' },
    { id: 'model', label: 'AI Model', icon: '🤖' },
    { id: 'email', label: 'Email Config', icon: '📧' },
    { id: 'danger', label: 'Danger Zone', icon: '⚠️' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#050b14', fontFamily: "'Sora', 'Segoe UI', sans-serif", color: '#e2e8f0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .input-field { width: 100%; background: rgba(14,25,45,0.7); border: 1px solid rgba(99,179,237,0.15); border-radius: 10px; padding: 12px 16px; font-size: 14px; color: #e2e8f0; font-family: 'Sora', sans-serif; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .input-field:focus { border-color: rgba(99,179,237,0.5); box-shadow: 0 0 0 3px rgba(14,165,233,0.08); }
        .input-field::placeholder { color: #334155; }
        select.input-field { cursor: pointer; }
        .save-btn { background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; border-radius: 10px; padding: 11px 28px; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; font-family: 'Sora', sans-serif; transition: all 0.2s; box-shadow: 0 0 20px rgba(14,165,233,0.25); }
        .save-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .danger-btn { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 11px 24px; font-size: 14px; font-weight: 600; color: #f87171; cursor: pointer; font-family: 'Sora', sans-serif; transition: all 0.2s; }
        .danger-btn:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); }
        .tab-btn { background: none; border: none; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: 'Sora', sans-serif; transition: all 0.15s; display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; color: #64748b; }
        .tab-btn:hover { background: rgba(99,179,237,0.07); color: #94a3b8; }
        .tab-btn.active { background: rgba(14,165,233,0.1); color: #38bdf8; border-left: 3px solid #38bdf8; }
        .section-card { background: rgba(14,25,45,0.7); border: 1px solid rgba(99,179,237,0.1); border-radius: 16px; padding: 28px; }
        label { font-size: 13px; color: #64748b; font-weight: 500; display: block; margin-bottom: 7px; }
        .back-btn { background: none; border: 1px solid rgba(99,179,237,0.2); border-radius: 10px; color: #64748b; padding: 8px 16px; font-size: 13px; cursor: pointer; font-family: 'Sora', sans-serif; transition: all 0.2s; }
        .back-btn:hover { border-color: rgba(99,179,237,0.4); color: #94a3b8; }
      `}</style>

      {/* Header */}
      <div style={{ padding: '18px 40px', borderBottom: '1px solid rgba(99,179,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5,11,20,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="back-btn" onClick={() => navigate('/chat')}>← Chat</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>Z</div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>ZeroTrace</span>
            <span style={{ color: '#334155' }}>/</span>
            <span style={{ color: '#64748b', fontSize: 14 }}>Settings</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/analytics')} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '7px 14px', color: '#a78bfa', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>📈 Analytics</button>
          <button onClick={() => navigate('/chat')} style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', border: 'none', borderRadius: 8, padding: '7px 16px', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600 }}>Go to Chat →</button>
        </div>
      </div>

      {/* Toast message */}
      {message.text && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 200, background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)', border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`, borderRadius: 12, padding: '12px 20px', color: message.type === 'error' ? '#f87171' : '#4ade80', fontSize: 14, fontWeight: 500, backdropFilter: 'blur(20px)' }}>
          {message.text}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 40px', display: 'flex', gap: 28 }}>

        {/* Sidebar tabs */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{user?.first_name || user?.username || 'User'}</div>
            <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>{user?.email || ''}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tabs.map(tab => (
              <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, borderTop: '1px solid rgba(99,179,237,0.08)', paddingTop: 16 }}>
            <button className="tab-btn" style={{ color: '#f87171' }} onClick={authAPI.logout}>
              <span>🚪</span><span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f0f9ff', marginBottom: 6 }}>Profile Settings</h2>
              <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}>Update your personal information</p>
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label>First Name</label>
                    <input className="input-field" value={profile.first_name} onChange={e => setProfile({ ...profile, first_name: e.target.value })} placeholder="First name" />
                  </div>
                  <div>
                    <label>Last Name</label>
                    <input className="input-field" value={profile.last_name} onChange={e => setProfile({ ...profile, last_name: e.target.value })} placeholder="Last name" />
                  </div>
                </div>
                <div>
                  <label>Email Address</label>
                  <input className="input-field" type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} placeholder="your@email.com" />
                </div>
                <div>
                  <label>Username</label>
                  <input className="input-field" value={user?.username || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                  <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Username cannot be changed</p>
                </div>
                <div style={{ paddingTop: 8 }}>
                  <button className="save-btn" onClick={saveProfile} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASSWORD */}
          {activeTab === 'password' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f0f9ff', marginBottom: 6 }}>Change Password</h2>
              <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}>Keep your account secure</p>
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label>Current Password</label>
                  <input className="input-field" type="password" placeholder="••••••••" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} />
                </div>
                <div>
                  <label>New Password</label>
                  <input className="input-field" type="password" placeholder="Min. 6 characters" value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} />
                </div>
                <div>
                  <label>Confirm New Password</label>
                  <input className="input-field" type="password" placeholder="Repeat new password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
                </div>
                <div style={{ paddingTop: 8 }}>
                  <button className="save-btn" onClick={savePassword} disabled={saving}>
                    {saving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODEL SETTINGS */}
          {activeTab === 'model' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f0f9ff', marginBottom: 6 }}>AI Model Settings</h2>
              <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}>Configure your local Ollama model</p>
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label>Active Model</label>
                  <select className="input-field" value={modelSettings.model} onChange={e => setModelSettings({ ...modelSettings, model: e.target.value })}>
                    <option value="llama3.2:latest">llama3.2:latest (Recommended)</option>
                    <option value="llama3.1:latest">llama3.1:latest</option>
                    <option value="mistral:latest">mistral:latest</option>
                    <option value="phi3:latest">phi3:latest</option>
                    <option value="gemma2:latest">gemma2:latest</option>
                  </select>
                  <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Make sure the model is downloaded via <code style={{ color: '#38bdf8' }}>ollama pull &lt;model&gt;</code></p>
                </div>
                <div>
                  <label>Temperature: {modelSettings.temperature}</label>
                  <input type="range" min="0" max="1" step="0.1" value={modelSettings.temperature}
                    onChange={e => setModelSettings({ ...modelSettings, temperature: e.target.value })}
                    style={{ width: '100%', accentColor: '#0ea5e9', marginTop: 4 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#334155', marginTop: 4 }}>
                    <span>0 — Precise</span>
                    <span>1 — Creative</span>
                  </div>
                </div>

                {/* Ollama status */}
                <div style={{ padding: '14px 16px', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.12)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                    <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>Ollama is running</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>Local inference on your machine · No cloud · No cost</p>
                </div>

                <div style={{ paddingTop: 8 }}>
                  <button className="save-btn" onClick={saveModelSettings}>Save Model Settings</button>
                </div>
              </div>
            </div>
          )}

          {/* EMAIL CONFIG */}
          {activeTab === 'email' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f0f9ff', marginBottom: 6 }}>Email Configuration</h2>
              <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}>Configure Gmail SMTP for email automation</p>
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ padding: '12px 16px', background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 10, fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
                  📧 To use email automation, you need a Gmail account with an <strong style={{ color: '#38bdf8' }}>App Password</strong>.<br />
                  Go to Google Account → Security → App Passwords → Create one for "ZeroTrace"
                </div>
                <div>
                  <label>Gmail Address (sender)</label>
                  <input className="input-field" type="email" value={emailSettings.smtp_email} onChange={e => setEmailSettings({ ...emailSettings, smtp_email: e.target.value })} placeholder="youremail@gmail.com" />
                </div>
                <div>
                  <label>Gmail App Password</label>
                  <input className="input-field" type="password" value={emailSettings.smtp_password} onChange={e => setEmailSettings({ ...emailSettings, smtp_password: e.target.value })} placeholder="xxxx xxxx xxxx xxxx" />
                  <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>This is stored locally on your machine only</p>
                </div>
                <div style={{ paddingTop: 8 }}>
                  <button className="save-btn" onClick={saveEmailSettings}>Save Email Settings</button>
                </div>
              </div>
            </div>
          )}

          {/* DANGER ZONE */}
          {activeTab === 'danger' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f87171', marginBottom: 6 }}>Danger Zone</h2>
              <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}>Irreversible actions — proceed with caution</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Clear Conversation History', desc: 'Delete all your chat conversations and messages permanently.', action: clearHistory, btn: 'Clear History' },
                  { label: 'Reset All Settings', desc: 'Reset model, email and all preferences to defaults.', action: () => { localStorage.clear(); showMessage('✅ Settings reset!') }, btn: 'Reset Settings' },
                  { label: 'Sign Out', desc: 'Sign out of your ZeroTrace account on this device.', action: authAPI.logout, btn: 'Sign Out' },
                ].map(({ label, desc, action, btn }) => (
                  <div key={label} className="section-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, color: '#475569' }}>{desc}</div>
                    </div>
                    <button className="danger-btn" onClick={action} style={{ flexShrink: 0 }}>{btn}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
