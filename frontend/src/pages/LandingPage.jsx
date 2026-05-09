import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TYPED_WORDS = [
  'Research the top 5 EV companies and send me a PDF report',
  'Open Gmail and reply to all unread emails',
  'Fill out this web form and submit it',
  'Summarize 10 news articles on AI this week',
  'Send a meeting invite to my team for Monday 10am',
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [typedText, setTypedText] = useState('')
  const [wordIdx, setWordIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const canvasRef = useRef(null)

  // Typewriter effect
  useEffect(() => {
    const word = TYPED_WORDS[wordIdx]
    let timeout
    if (!deleting && charIdx < word.length) {
      timeout = setTimeout(() => {
        setTypedText(word.slice(0, charIdx + 1))
        setCharIdx(c => c + 1)
      }, 38)
    } else if (!deleting && charIdx === word.length) {
      timeout = setTimeout(() => setDeleting(true), 2200)
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => {
        setTypedText(word.slice(0, charIdx - 1))
        setCharIdx(c => c - 1)
      }, 18)
    } else if (deleting && charIdx === 0) {
      setDeleting(false)
      setWordIdx(w => (w + 1) % TYPED_WORDS.length)
    }
    return () => clearTimeout(timeout)
  }, [charIdx, deleting, wordIdx])

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight

    const resize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(99,179,237,${p.alpha})`
        ctx.fill()
      })
      // Draw faint connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(99,179,237,${0.08 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050b14',
      color: '#e2e8f0',
      fontFamily: "'Sora', 'Segoe UI', sans-serif",
      overflowX: 'hidden',
      position: 'relative',
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .glow-btn {
          background: linear-gradient(135deg, #0ea5e9, #6366f1);
          border: none;
          color: #fff;
          padding: 14px 36px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 0 24px rgba(14,165,233,0.35);
          font-family: 'Sora', sans-serif;
          letter-spacing: 0.3px;
        }
        .glow-btn:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 0 40px rgba(14,165,233,0.55);
        }

        .outline-btn {
          background: transparent;
          border: 1.5px solid rgba(99,179,237,0.4);
          color: #93c5fd;
          padding: 13px 32px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Sora', sans-serif;
        }
        .outline-btn:hover {
          border-color: #63b3ed;
          background: rgba(99,179,237,0.08);
          color: #bfdbfe;
        }

        .feature-card {
          background: rgba(14,25,45,0.7);
          border: 1px solid rgba(99,179,237,0.12);
          border-radius: 20px;
          padding: 32px 28px;
          transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
          backdrop-filter: blur(12px);
        }
        .feature-card:hover {
          transform: translateY(-6px);
          border-color: rgba(99,179,237,0.35);
          box-shadow: 0 12px 40px rgba(14,165,233,0.12);
        }

        .nav-link {
          color: #94a3b8;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
          cursor: pointer;
        }
        .nav-link:hover { color: #e2e8f0; }

        .stat-num {
          font-size: 42px;
          font-weight: 800;
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1;
        }

        .badge {
          display: inline-block;
          background: rgba(14,165,233,0.12);
          border: 1px solid rgba(14,165,233,0.25);
          color: #38bdf8;
          padding: 5px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-family: 'JetBrains Mono', monospace;
        }

        .automation-pill {
          background: rgba(14,25,45,0.8);
          border: 1px solid rgba(99,179,237,0.18);
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          color: #7dd3fc;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.2s;
        }
        .automation-pill:hover {
          border-color: rgba(99,179,237,0.4);
          background: rgba(14,165,233,0.08);
        }

        .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .dot-green { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
        .dot-blue { background: #38bdf8; box-shadow: 0 0 6px #38bdf8; }
        .dot-purple { background: #a78bfa; box-shadow: 0 0 6px #a78bfa; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.8s ease forwards; }
        .delay-1 { animation-delay: 0.15s; opacity: 0; }
        .delay-2 { animation-delay: 0.3s; opacity: 0; }
        .delay-3 { animation-delay: 0.45s; opacity: 0; }
        .delay-4 { animation-delay: 0.6s; opacity: 0; }

        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.7; }
          70% { transform: scale(1.08); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        .pulse { animation: pulse-ring 2.5s ease-out infinite; }

        .cursor-blink::after {
          content: '|';
          animation: blink 1s step-start infinite;
          color: #38bdf8;
        }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }} />

      {/* Gradient orbs */}
      <div style={{ position: 'fixed', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

      {/* NAVBAR */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 60px', background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(99,179,237,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px', color: '#e2e8f0' }}>ZeroTrace</span>
        </div>
        <div style={{ display: 'flex', gap: 36 }}>
          <span className="nav-link">Features</span>
          <span className="nav-link">How it works</span>
          <span className="nav-link">Privacy</span>
          <span className="nav-link">Docs</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="outline-btn" style={{ padding: '9px 22px', fontSize: 14 }} onClick={() => navigate('/login')}>Sign in</button>
          <button className="glow-btn" style={{ padding: '9px 22px', fontSize: 14 }} onClick={() => navigate('/signup')}>Get Started</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '120px 40px 80px' }}>
        <div className="fade-up" style={{ marginBottom: 24 }}>
          <span className="badge">100% Local · Zero Cloud · Open Source</span>
        </div>

        <h1 className="fade-up delay-1" style={{ fontSize: 'clamp(42px, 6vw, 80px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-2px', maxWidth: 900, color: '#f0f9ff' }}>
          Your AI that works{' '}
          <span style={{ background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            completely offline
          </span>
        </h1>

        <p className="fade-up delay-2" style={{ marginTop: 24, fontSize: 18, color: '#94a3b8', maxWidth: 600, lineHeight: 1.7 }}>
          Research, write, automate tasks, send emails, fill forms — all powered by a local LLM running on your machine. Your data never leaves.
        </p>

        {/* Typewriter prompt box */}
        <div className="fade-up delay-3" style={{ marginTop: 40, width: '100%', maxWidth: 680, background: 'rgba(14,25,45,0.85)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(16px)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>Z</div>
          <span className="cursor-blink" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#7dd3fc', flex: 1, textAlign: 'left' }}>
            {typedText}
          </span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>

        <div className="fade-up delay-4" style={{ marginTop: 32, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="glow-btn" onClick={() => navigate('/signup')}>Start for Free</button>
          <button className="outline-btn" onClick={() => navigate('/chat')}>See it live →</button>
        </div>

        {/* Stats */}
        <div className="fade-up delay-4" style={{ marginTop: 72, display: 'flex', gap: 64, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[['100%', 'Data stays local'], ['₹0', 'API costs ever'], ['10+', 'Task types automated'], ['5x', 'Faster than manual']].map(([n, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div className="stat-num">{n}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#64748b', fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AUTOMATION TYPES */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 60px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span className="badge" style={{ marginBottom: 16, display: 'inline-block' }}>Capabilities</span>
          <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1.5px', color: '#f0f9ff' }}>What it can do for you</h2>
          <p style={{ marginTop: 14, color: '#64748b', fontSize: 16 }}>Give it a goal in plain English. Watch it execute.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {[
            { icon: '🌐', title: 'Browser Automation', desc: 'Opens Chrome, navigates URLs, fills forms, clicks buttons, scrapes content — autonomously.', color: '#0ea5e9', pills: ['Google Search', 'Form Fill', 'Web Scrape'] },
            { icon: '📧', title: 'Email Tasks', desc: 'Reads your inbox, composes replies, sends emails with attachments using your local SMTP.', color: '#6366f1', pills: ['Send Email', 'Read Inbox', 'Reply All'] },
            { icon: '📄', title: 'PDF & Files', desc: 'Creates PDFs from research, converts formats, organizes your local file system.', color: '#0891b2', pills: ['Create PDF', 'Convert', 'Organize'] },
            { icon: '🔍', title: 'Deep Research', desc: 'Searches multiple sources, summarizes findings, produces structured reports automatically.', color: '#7c3aed', pills: ['Multi-source', 'Summarize', 'Export'] },
            { icon: '⚡', title: 'Task Chaining', desc: 'Research → Write PDF → Send Email — all in one prompt. Multi-step pipelines run in sequence.', color: '#0d9488', pills: ['Sequential', 'Parallel', 'Conditional'] },
            { icon: '🔒', title: 'Complete Privacy', desc: 'All AI runs on Ollama locally. Zero API calls. Zero data sent anywhere. Ever.', color: '#dc2626', pills: ['Offline', 'Local LLM', 'No Logs'] },
          ].map(({ icon, title, desc, color, pills }) => (
            <div key={title} className="feature-card">
              <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: '#f0f9ff', marginBottom: 10 }}>{title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.65, marginBottom: 18 }}>{desc}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pills.map(p => <span key={p} style={{ background: `rgba(${color === '#0ea5e9' ? '14,165,233' : color === '#6366f1' ? '99,102,241' : color === '#0891b2' ? '8,145,178' : color === '#7c3aed' ? '124,58,237' : color === '#0d9488' ? '13,148,136' : '220,38,38'},0.1}`, border: `1px solid ${color}33`, borderRadius: 999, padding: '4px 12px', fontSize: 12, color, fontWeight: 600 }}>{p}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 60px', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <span className="badge" style={{ marginBottom: 16, display: 'inline-block' }}>How it works</span>
        <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1.5px', color: '#f0f9ff', marginBottom: 60 }}>Three steps. Fully local.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { n: '01', title: 'Type your goal', desc: 'Write anything in plain English — no commands, no syntax. Just what you want done.' },
            { n: '02', title: 'AI plans & executes', desc: 'Local LLM (Llama 3 via Ollama) breaks it into tasks. Selenium + smtplib execute them.' },
            { n: '03', title: 'See results live', desc: 'Watch the task queue run in real-time via WebSocket. Every action logged on your machine.' },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ padding: '36px 28px', background: 'rgba(14,25,45,0.5)', border: '1px solid rgba(99,179,237,0.1)', borderRadius: 20, position: 'relative' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 48, fontWeight: 700, color: 'rgba(99,179,237,0.12)', lineHeight: 1, marginBottom: 16 }}>{n}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f0f9ff', marginBottom: 10 }}>{title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE TASK DEMO MOCKUP */}
      <section style={{ position: 'relative', zIndex: 1, padding: '40px 60px 100px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ background: 'rgba(9,18,34,0.9)', border: '1px solid rgba(99,179,237,0.18)', borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(20px)' }}>
          {/* Window bar */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(99,179,237,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            <span style={{ marginLeft: 12, fontSize: 12, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>ZeroTrace — Task Execution</span>
          </div>
          {/* Task list */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, color: '#475569', fontFamily: "'JetBrains Mono', monospace", marginBottom: 16 }}>Goal: "Research AI trends, make a PDF, email to me"</div>
            {[
              { label: 'Web search: top AI news this week', status: 'done', dot: 'dot-green' },
              { label: 'Scraping 8 articles...', status: 'done', dot: 'dot-green' },
              { label: 'LLM summarizing content via Ollama', status: 'done', dot: 'dot-green' },
              { label: 'Creating PDF with ReportLab', status: 'running', dot: 'dot-blue' },
              { label: 'Opening Gmail SMTP connection', status: 'pending', dot: 'dot-purple' },
              { label: 'Sending email with attachment', status: 'pending', dot: 'dot-purple' },
            ].map(({ label, status, dot }, i) => (
              <div key={i} className="automation-pill" style={{ marginBottom: 8, opacity: status === 'pending' ? 0.45 : 1 }}>
                <span className={`dot ${dot}`} />
                <span style={{ flex: 1, color: status === 'done' ? '#4ade80' : status === 'running' ? '#7dd3fc' : '#94a3b8', fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 11, color: status === 'done' ? '#4ade80' : status === 'running' ? '#38bdf8' : '#475569', fontWeight: 600 }}>{status === 'done' ? '✓' : status === 'running' ? '⟳' : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '60px 40px 120px' }}>
        <div style={{ background: 'rgba(14,25,45,0.7)', border: '1px solid rgba(99,179,237,0.15)', borderRadius: 28, padding: '72px 40px', maxWidth: 700, margin: '0 auto', backdropFilter: 'blur(20px)' }}>
          <h2 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1.5px', color: '#f0f9ff', marginBottom: 16 }}>Run it on your machine.<br />Own your intelligence.</h2>
          <p style={{ color: '#64748b', fontSize: 16, marginBottom: 36, lineHeight: 1.65 }}>Free. Open source. No API keys. No cloud. Just your local AI working for you.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="glow-btn" onClick={() => navigate('/signup')}>Get Started Free</button>
            <button className="outline-btn">View on GitHub</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(99,179,237,0.08)', padding: '32px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>Z</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>ZeroTrace</span>
        </div>
        <span style={{ fontSize: 13, color: '#334155' }}>Built for DSATM CSE 2025–26 · Privacy-First AI Project</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Privacy', 'GitHub', 'Docs'].map(l => <span key={l} className="nav-link" style={{ fontSize: 13 }}>{l}</span>)}
        </div>
      </footer>
    </div>
  )
}
